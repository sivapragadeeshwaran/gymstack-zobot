const sessionStore = require("../utils/sessionStore");
const User = require("../Models/user-model");
const Trainer = require("../Models/trainer-model");
const Plan = require("../Models/plan");
const moment = require("moment");

// Function to get membership statistics
async function getMembershipStatistics() {
  try {
    // Get current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate dates for this month and last month
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    // Get total members count
    const totalMembers = await User.countDocuments({ role: "user" });

    // Get new members this month
    const newMembersThisMonth = await User.countDocuments({
      role: "user",
      createdAt: { $gte: thisMonthStart, $lt: today },
    });

    // Get active members (those with non-expired memberships)
    const activeMembers = await User.countDocuments({
      role: "user",
      membershipExpiryDate: { $gte: today },
    });

    // Get expired members
    const expiredMembers = await User.countDocuments({
      role: "user",
      membershipExpiryDate: { $lt: today },
    });

    // Get members by membership plan
    const membersByPlan = await User.aggregate([
      { $match: { role: "user" } },
      { $group: { _id: "$membershipPlan", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "plans",
          localField: "_id",
          foreignField: "_id",
          as: "plan",
        },
      },
      { $unwind: "$plan" },
      { $project: { planName: "$plan.name", count: 1, _id: 0 } },
    ]);

    return {
      totalMembers,
      newMembersThisMonth,
      activeMembers,
      expiredMembers,
      membersByPlan,
    };
  } catch (error) {
    console.error("Error getting membership statistics:", error);
    throw error;
  }
}

// Function to get financial summary
async function getFinancialSummary() {
  try {
    // Get current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate dates for the past 6 months
    const sixMonthsAgo = moment().subtract(5, "months").startOf("month");
    const monthsList = [];

    // Step 1: Create a list of last 6 months
    for (let i = 0; i < 6; i++) {
      const month = moment(sixMonthsAgo).add(i, "months");
      monthsList.push({
        label: month.format("MMM"),
        year: month.year(),
        month: month.month() + 1, // moment months are 0-indexed
        revenue: 0,
      });
    }

    // Step 2: Aggregate actual revenue data for the past 6 months
    const revenue = await User.aggregate([
      {
        $match: {
          feeStatus: "Paid",
          feePaidDate: { $gte: sixMonthsAgo.toDate() },
        },
      },
      {
        $lookup: {
          from: "plans",
          localField: "membershipPlan",
          foreignField: "_id",
          as: "planInfo",
        },
      },
      { $unwind: "$planInfo" },
      {
        $group: {
          _id: {
            year: { $year: "$feePaidDate" },
            month: { $month: "$feePaidDate" },
          },
          totalRevenue: { $sum: "$planInfo.price" },
        },
      },
    ]);

    // Step 3: Merge real data into monthsList
    revenue.forEach((item) => {
      const match = monthsList.find(
        (m) => m.year === item._id.year && m.month === item._id.month
      );
      if (match) {
        match.revenue = item.totalRevenue;
      }
    });

    // Format result for past 6 months revenue
    const pastSixMonthsRevenue = monthsList.map((m) => ({
      month: m.label,
      revenue: m.revenue,
    }));

    // Calculate total revenue for the past 6 months
    const totalRevenue = pastSixMonthsRevenue.reduce(
      (sum, month) => sum + month.revenue,
      0
    );

    // Get current month's revenue
    const currentMonthStart = moment().startOf("month").toDate();
    const currentMonthEnd = moment().endOf("month").toDate();
    const currentMonthPayments = await User.find({
      role: "user",
      feeStatus: "Paid",
      feePaidDate: { $gte: currentMonthStart, $lte: currentMonthEnd },
    }).populate("membershipPlan");

    const currentMonthRevenue = currentMonthPayments.reduce((sum, user) => {
      const planPrice = user.membershipPlan?.price || 0;
      return sum + planPrice;
    }, 0);

    // Get last month's revenue
    const lastMonthStart = moment()
      .subtract(1, "months")
      .startOf("month")
      .toDate();
    const lastMonthEnd = moment().subtract(1, "months").endOf("month").toDate();
    const lastMonthPayments = await User.find({
      role: "user",
      feeStatus: "Paid",
      feePaidDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
    }).populate("membershipPlan");

    const lastMonthRevenue = lastMonthPayments.reduce((sum, user) => {
      const planPrice = user.membershipPlan?.price || 0;
      return sum + planPrice;
    }, 0);

    // Calculate profit/loss
    const profitLoss = currentMonthRevenue - lastMonthRevenue;
    const profitLossPercentage =
      lastMonthRevenue > 0
        ? ((profitLoss / lastMonthRevenue) * 100).toFixed(2)
        : 0;

    // Get revenue by membership plan for active users
    const activeUsers = await User.find({
      role: "user",
      membershipExpiryDate: { $gte: today },
    }).populate("membershipPlan");

    // Calculate revenue by plan
    const revenueByPlanMap = {};
    activeUsers.forEach((user) => {
      if (user.membershipPlan) {
        const planName = user.membershipPlan.name;
        const planPrice = user.membershipPlan.price;

        if (!revenueByPlanMap[planName]) {
          revenueByPlanMap[planName] = 0;
        }
        revenueByPlanMap[planName] += planPrice;
      }
    });

    // Convert to array format
    const revenueByPlan = Object.keys(revenueByPlanMap).map((planName) => ({
      planName,
      revenue: revenueByPlanMap[planName],
    }));

    // Find most popular plan
    const planCounts = await User.aggregate([
      { $match: { membershipPlan: { $ne: null } } },
      { $group: { _id: "$membershipPlan", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: "plans",
          localField: "_id",
          foreignField: "_id",
          as: "planDetails",
        },
      },
      { $unwind: "$planDetails" },
      {
        $project: {
          _id: 0,
          name: "$planDetails.name",
          count: 1,
        },
      },
    ]);
    const mostPopularPlan = planCounts[0] || { name: "No Data", count: 0 };

    return {
      currentMonthRevenue,
      lastMonthRevenue,
      profitLoss,
      profitLossPercentage,
      pastSixMonthsRevenue,
      totalRevenue,
      revenueByPlan,
      mostPopularPlan,
    };
  } catch (error) {
    console.error("Error getting financial summary:", error);
    throw error;
  }
}

// Function to get trainer utilization
async function getTrainerUtilization() {
  try {
    // Get all trainers with their assigned members populated
    const trainers = await Trainer.find().populate("assignedMembers", "_id");

    // Calculate trainer utilization
    const trainerUtilization = trainers.map((trainer) => ({
      trainerName: trainer.name,
      specialization: trainer.specialization,
      experience: trainer.experience,
      assignedMembers: trainer.assignedMembers.length,
    }));

    // Find most popular specialization
    const specializations = {};
    trainerUtilization.forEach((trainer) => {
      if (specializations[trainer.specialization]) {
        specializations[trainer.specialization] += trainer.assignedMembers;
      } else {
        specializations[trainer.specialization] = trainer.assignedMembers;
      }
    });

    let mostPopularClass = "";
    let maxMembers = 0;
    for (const specialization in specializations) {
      if (specializations[specialization] > maxMembers) {
        maxMembers = specializations[specialization];
        mostPopularClass = specialization;
      }
    }

    return {
      trainerUtilization,
      mostPopularClass,
      totalTrainers: trainers.length,
    };
  } catch (error) {
    console.error("Error getting trainer utilization:", error);
    throw error;
  }
}

// Main function to handle view reports
async function handleViewReports(res, session, visitorId) {
  try {
    // Set session step to track which report type is selected
    session.adminStep = "viewReports_selectType";
    sessionStore.set(visitorId, session);

    const payload = {
      action: "reply",
      replies: [
        "📊 REPORTS",
        "",
        "Please select a report type to view details:",
      ],
      suggestions: [
        "Membership Statistics",
        "Financial Summary",
        "Trainer Utilization",
        "⬅️ Back to Dashboard",
      ],
    };

    return res.json(payload);
  } catch (error) {
    console.error("🔥 [REPORTS] Error in handleViewReports:", error);

    const errorPayload = {
      action: "reply",
      replies: [
        "Sorry, there was an error loading reports. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Dashboard"],
    };

    return res.json(errorPayload);
  }
}

// Function to handle report type selection
async function handleReportTypeSelection(message, res, session, visitorId) {
  try {
    let reportContent = "";
    let reportTitle = "";

    switch (message) {
      case "Membership Statistics":
        const membershipStats = await getMembershipStatistics();

        reportTitle = "📊 MEMBERSHIP STATISTICS";
        reportContent = `👥 Total Members: ${membershipStats.totalMembers}\n`;
        reportContent += `🆕 New Members (This Month): ${membershipStats.newMembersThisMonth}\n`;
        reportContent += `✅ Active Members: ${membershipStats.activeMembers}\n`;
        reportContent += `❌ Expired Members: ${membershipStats.expiredMembers}\n\n`;
        reportContent += "📋 Members by Plan:\n";

        membershipStats.membersByPlan.forEach((plan) => {
          reportContent += `• ${plan.planName}: ${plan.count} members\n`;
        });
        break;

      case "Financial Summary":
        const financialStats = await getFinancialSummary();

        // Determine profit/loss emoji and text
        const profitLossEmoji = financialStats.profitLoss >= 0 ? "📈" : "📉";
        const profitLossText =
          financialStats.profitLoss >= 0 ? "Profit" : "Loss";
        const profitLossAmount = Math.abs(
          financialStats.profitLoss
        ).toLocaleString();

        reportTitle = "💰 FINANCIAL SUMMARY";
        reportContent = `💸 Current Month Revenue: ₹${financialStats.currentMonthRevenue.toLocaleString()}\n`;
        reportContent += `💸 Last Month Revenue: ₹${financialStats.lastMonthRevenue.toLocaleString()}\n`;
        reportContent += `${profitLossEmoji} ${profitLossText}: ₹${profitLossAmount} (${financialStats.profitLossPercentage}%)\n`;
        reportContent += `💎 Total Revenue (Past 6 Months): ₹${financialStats.totalRevenue.toLocaleString()}\n`;
        reportContent += `🏆 Most Popular Plan: ${financialStats.mostPopularPlan.name} (${financialStats.mostPopularPlan.count} members)\n\n`;
        reportContent += "📊 Revenue by Plan (Active Users):\n";

        financialStats.revenueByPlan.forEach((plan) => {
          reportContent += `• ${
            plan.planName
          }: ₹${plan.revenue.toLocaleString()}\n`;
        });

        reportContent += "\n📅 Past 6 Months Revenue:\n";
        financialStats.pastSixMonthsRevenue.forEach((month) => {
          reportContent += `• ${
            month.month
          }: ₹${month.revenue.toLocaleString()}\n`;
        });
        break;

      case "Trainer Utilization":
        const trainerStats = await getTrainerUtilization();

        reportTitle = "🏋️ TRAINER UTILIZATION";
        reportContent = `👨‍🏫 Total Trainers: ${trainerStats.totalTrainers}\n\n`;
        reportContent += "👤 Trainer Details:\n";

        trainerStats.trainerUtilization.forEach((trainer) => {
          reportContent += `• ${trainer.trainerName} (${trainer.specialization}): ${trainer.assignedMembers} members\n`;
        });
        break;

      case "⬅️ Back to Dashboard":
        // Set session step to dashboard
        session.adminStep = "dashboard";
        sessionStore.set(visitorId, session);

        // Create a simple dashboard response instead of importing the function
        const greeting = `👋 Welcome Admin ${
          session.username || ""
        }! Here's your dashboard:`;

        const dashboardPayload = {
          action: "reply",
          replies: [greeting],
          suggestions: [
            "➕ Add Member",
            "🏋️ Add Trainer",
            "🔑 Add Admin",
            "💳 Add New Membership",
            "⏰ Expiring Members",
            "📊 View Reports",
          ],
        };

        return res.json(dashboardPayload);

      default:
        return handleViewReports(res, session, visitorId);
    }

    // Prepare the response with a single message containing the entire report
    const fullReport = `${reportTitle}\n\n${reportContent}`;

    // Set session step to track that we're viewing a report
    session.adminStep = "viewReports_viewing";
    sessionStore.set(visitorId, session);

    const payload = {
      action: "reply",
      replies: [fullReport], // Single message with the entire report
      suggestions: [
        "Membership Statistics",
        "Financial Summary",
        "Trainer Utilization",
        "⬅️ Back to Dashboard",
      ],
    };

    return res.json(payload);
  } catch (error) {
    console.error("🔥 [REPORTS] Error in handleReportTypeSelection:", error);

    const errorPayload = {
      action: "reply",
      replies: [
        "Sorry, there was an error loading the report. Please try again later.",
      ],
      suggestions: [
        "Membership Statistics",
        "Financial Summary",
        "Trainer Utilization",
        "⬅️ Back to Dashboard",
      ],
    };

    return res.json(errorPayload);
  }
}

module.exports = {
  handleViewReports,
  handleReportTypeSelection,
};
