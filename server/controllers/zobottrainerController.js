const sessionStore = require("../utils/sessionStore");
const User = require("../Models/user-model");
const Trainer = require("../Models/trainer-model");
const ClassSchedule = require("../Models/classSchedule");
const aiAssistantController = require("./aiAssistantController");
const problemReportController = require("./problemReportController");

// Helper function to extract time from Zoho timeslots response
function extractTimeFromZohoResponse(message) {
  if (message && typeof message === "object" && message.value) {
    return message.value;
  }

  if (typeof message === "string") {
    const timeMatch = message.match(/(\d{1,2}:\d{2}\s[AP]M)/);
    if (timeMatch) {
      const timeStr = timeMatch[1];
      const [time, period] = timeStr.split(" ");
      let [hours, minutes] = time.split(":").map(Number);

      if (period === "PM" && hours !== 12) {
        hours += 12;
      } else if (period === "AM" && hours === 12) {
        hours = 0;
      }

      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
    }

    const time24Match = message.match(/(\d{1,2}:\d{2})/);
    if (time24Match) {
      return time24Match[1];
    }
  }

  return null;
}

function getNextDateForDay(day) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const today = new Date();
  const todayDay = today.getDay();
  const targetDay = days.indexOf(day);

  let daysToAdd = (targetDay - todayDay + 7) % 7;

  if (daysToAdd === 0) {
    daysToAdd = 7;
  }

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysToAdd);
  return nextDate;
}

async function getTrainerFromSession(session, sessionId) {
  try {
    const userId = session.userId;

    if (!userId) {
      return { error: "No user ID found in session" };
    }

    const trainer = await Trainer.findOne({ userId: userId });

    if (!trainer) {
      return { error: "Trainer profile not found" };
    }

    session.trainerId = trainer._id;
    sessionStore.set(sessionId, session);

    return { trainer };
  } catch (error) {
    console.error("❌ [TRAINER] Error getting trainer:", error);
    return { error: "Error retrieving trainer profile" };
  }
}

// ----------------------- Main Handler -----------------------
exports.handleTrainer = (message, res, session, sessionId) => {
  console.log("🎯 [TRAINER] Handler called");
  console.log("🎯 [TRAINER] Current step:", session.trainerStep);
  console.log("🎯 [TRAINER] Message:", message);

  if (!session.trainerStep) {
    session.trainerStep = "dashboard";
    sessionStore.set(sessionId, session);
  }

  const msg = (message || "").toString().trim();

  if (msg.includes("Back to Dashboard") || msg.includes("⬅️")) {
    session.trainerStep = "dashboard";
    session.problemReportStep = null;
    sessionStore.set(sessionId, session);
    return showTrainerDashboard(res, session, sessionId);
  }

  if (session.trainerStep === "dashboard") {
    switch (msg) {
      case "👥 View Members":
        session.trainerStep = "view_members";
        sessionStore.set(sessionId, session);
        return handleViewMembers(msg, res, session, sessionId);
      case "📝 Update Profile":
        session.trainerStep = "update_profile";
        sessionStore.set(sessionId, session);
        return handleUpdateProfile(msg, res, session, sessionId);
      case "📅 Add Class Schedule":
        session.trainerStep = "add_class_title";
        sessionStore.set(sessionId, session);
        return handleAddClassSchedule(msg, res, session, sessionId);
      case "🚨 Report an Issue":
        session.trainerStep = "problem_report";
        session.problemReportStep = null; // Reset problem report flow
        sessionStore.set(sessionId, session);
        return problemReportController.handleProblemReport(
          "",
          res,
          session,
          sessionId
        );
      case "🤖 Talk to AI Assistant":
        session.trainerStep = "ai_assistant";
        sessionStore.set(sessionId, session);
        return handleAIAssistant(msg, res, session, sessionId);
      default:
        return showTrainerDashboard(res, session, sessionId);
    }
  }

  // If in problem report flow, handle it
  if (session.trainerStep === "problem_report" || session.problemReportStep) {
    return problemReportController.handleProblemReport(
      msg,
      res,
      session,
      sessionId
    );
  }

  switch (session.trainerStep) {
    case "view_members":
      return handleViewMembers(msg, res, session, sessionId);

    case "update_profile":
    case "profile_field_select":
    case "profile_field_update":
    case "profile_update_confirm":
      return handleUpdateProfile(msg, res, session, sessionId);

    case "add_class_title":
    case "add_class_day":
    case "add_class_time":
    case "add_class_notes":
    case "add_class_confirm":
      return handleAddClassSchedule(msg, res, session, sessionId);

    case "ai_assistant":
      return handleAIAssistant(msg, res, session, sessionId);

    default:
      session.trainerStep = "dashboard";
      sessionStore.set(sessionId, session);
      return showTrainerDashboard(res, session, sessionId);
  }
};

// ----------------------- Dashboard -----------------------
function showTrainerDashboard(res, session, sessionId) {
  const greeting = `👋 Welcome ${
    session.username || "Trainer"
  }! How can I assist you today?`;

  const payload = {
    platform: "ZOHOSALESIQ",
    action: "reply",
    replies: [greeting],
    suggestions: [
      "👥 View Members",
      "📝 Update Profile",
      "📅 Add Class Schedule",
      "🚨 Report an Issue",
      "🤖 Talk to AI Assistant",
    ],
  };

  session.trainerStep = "dashboard";
  session.problemReportStep = null; // Clear any problem report state
  sessionStore.set(sessionId, session);

  return res.json(payload);
}

async function handleViewMembers(message, res, session, sessionId) {
  try {
    const { trainer, error } = await getTrainerFromSession(session, sessionId);

    if (error || !trainer) {
      return res.json({
        action: "reply",
        replies: [
          "Sorry, I couldn't find your trainer profile. Please contact admin.",
        ],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    const members = await User.find({
      role: "user",
      assignedTrainerId: trainer._id,
    }).populate("membershipPlan");

    if (members.length === 0) {
      return res.json({
        action: "reply",
        replies: ["You don't have any members assigned to you yet."],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    let response = `👥 MEMBERS ASSIGNED TO YOU\n\n`;
    response += `Total Members: ${members.length}\n\n`;

    members.forEach((member, index) => {
      response += `${index + 1}. ${member.username}\n`;
      response += `   Email: ${member.email}\n`;
      response += `   Phone: ${member.phone}\n`;
      response += `   Membership: ${
        member.membershipPlan ? member.membershipPlan.name : "Unknown"
      }\n`;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const membershipExpiryDate = new Date(member.membershipExpiryDate);
      const timeDiff = membershipExpiryDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
      const isActive = daysLeft > 0;

      response += `   Status: ${isActive ? "Active" : "Expired"}\n`;
      if (isActive) {
        response += `   Days Left: ${daysLeft}\n`;
      }
      response += `\n`;
    });

    session.trainerStep = "dashboard";
    sessionStore.set(sessionId, session);

    return res.json({
      action: "reply",
      replies: [response],
      suggestions: [
        "👥 View Members",
        "📝 Update Profile",
        "📅 Add Class Schedule",
        "🚨 Report an Issue",
        "🤖 Talk to AI Assistant",
      ],
    });
  } catch (error) {
    console.error("🔥 [TRAINER] Error fetching members:", error);

    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error retrieving your members. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Dashboard"],
    });
  }
}

async function handleUpdateProfile(message, res, session, sessionId) {
  try {
    if (message === "⬅️ Back to Dashboard") {
      session.trainerStep = "dashboard";
      sessionStore.set(sessionId, session);
      return showTrainerDashboard(res, session, sessionId);
    }

    const { trainer, error } = await getTrainerFromSession(session, sessionId);

    if (error || !trainer) {
      return res.json({
        action: "reply",
        replies: [
          "Sorry, I couldn't find your trainer profile. Please contact admin.",
        ],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    if (session.trainerStep === "update_profile") {
      let profileInfo = `📋 CURRENT PROFILE\n\n`;
      profileInfo += `Name: ${trainer.name}\n`;
      profileInfo += `Experience: ${trainer.experience} years\n`;
      profileInfo += `Specialization: ${trainer.specialization}\n\n`;
      profileInfo += `Which field would you like to update?`;

      session.trainerStep = "profile_field_select";
      sessionStore.set(sessionId, session);

      return res.json({
        action: "reply",
        replies: [profileInfo],
        suggestions: [
          "💼 Experience",
          "🎯 Specialization",
          "⬅️ Back to Dashboard",
        ],
      });
    }

    if (session.trainerStep === "profile_field_select") {
      if (message === "💼 Experience") {
        session.updateField = "experience";
        session.trainerStep = "profile_field_update";
        sessionStore.set(sessionId, session);

        return res.json({
          action: "reply",
          replies: ["Please enter your years of experience (numbers only):"],
        });
      } else if (message === "🎯 Specialization") {
        session.updateField = "specialization";
        session.trainerStep = "profile_field_update";
        sessionStore.set(sessionId, session);

        return res.json({
          action: "reply",
          replies: [
            "Please enter your specialization (e.g., Yoga, Weightlifting, Cardio):",
          ],
        });
      } else {
        return res.json({
          action: "reply",
          replies: ["Please select a valid field to update:"],
          suggestions: [
            "💼 Experience",
            "🎯 Specialization",
            "⬅️ Back to Dashboard",
          ],
        });
      }
    }

    if (session.trainerStep === "profile_field_update") {
      const field = session.updateField;
      let newValue = message;
      let isValid = true;

      if (field === "experience") {
        if (!/^\d+$/.test(newValue.trim())) {
          isValid = false;
        } else {
          const experience = parseInt(newValue.trim(), 10);
          if (isNaN(experience) || experience < 0 || experience > 50) {
            isValid = false;
          } else {
            newValue = experience;
          }
        }
      } else if (field === "specialization") {
        if (!newValue || newValue.trim().length < 2) {
          isValid = false;
        }
      }

      if (!isValid) {
        return res.json({
          action: "reply",
          replies: ["Invalid input. Please enter a valid value:"],
        });
      }

      session.newValue = newValue;
      session.trainerStep = "profile_update_confirm";
      sessionStore.set(sessionId, session);

      const fieldDisplayName = field.charAt(0).toUpperCase() + field.slice(1);
      const displayValue =
        field === "experience" ? `${newValue} years` : newValue;

      return res.json({
        action: "reply",
        replies: [
          `You are about to update your ${fieldDisplayName} to: ${displayValue}\n\nDo you want to proceed?`,
        ],
        suggestions: ["✅ Yes", "❌ No", "⬅️ Back to Dashboard"],
      });
    }

    if (session.trainerStep === "profile_update_confirm") {
      if (message.includes("Yes") || message === "✅ Yes") {
        const field = session.updateField;
        const newValue = session.newValue;

        const updateObj = {};
        updateObj[field] = newValue;

        await Trainer.findByIdAndUpdate(trainer._id, updateObj);

        session.trainerStep = "dashboard";
        sessionStore.set(sessionId, session);

        const fieldDisplayName = field.charAt(0).toUpperCase() + field.slice(1);
        const displayValue =
          field === "experience" ? `${newValue} years` : newValue;

        return res.json({
          action: "reply",
          replies: [
            `✅ Your ${fieldDisplayName} has been updated to: ${displayValue}`,
          ],
          suggestions: [
            "👥 View Members",
            "📝 Update Profile",
            "📅 Add Class Schedule",
            "🚨 Report an Issue",
            "🤖 Talk to AI Assistant",
          ],
        });
      } else if (message.includes("No") || message === "❌ No") {
        session.trainerStep = "update_profile";
        sessionStore.set(sessionId, session);
        return handleUpdateProfile("", res, session, sessionId);
      } else {
        return res.json({
          action: "reply",
          replies: ["Please select a valid option: Yes or No"],
          suggestions: ["✅ Yes", "❌ No", "⬅️ Back to Dashboard"],
        });
      }
    }
  } catch (error) {
    console.error("🔥 [TRAINER] Error in update profile:", error);

    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error updating your profile. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Dashboard"],
    });
  }
}

async function handleAddClassSchedule(message, res, session, sessionId) {
  try {
    if (message === "⬅️ Back to Dashboard") {
      session.trainerStep = "dashboard";
      sessionStore.set(sessionId, session);
      return showTrainerDashboard(res, session, sessionId);
    }

    const { trainer, error } = await getTrainerFromSession(session, sessionId);

    if (error || !trainer) {
      return res.json({
        action: "reply",
        replies: [
          "Sorry, I couldn't find your trainer profile. Please contact admin.",
        ],
        suggestions: ["⬅️ Back to Dashboard"],
      });
    }

    if (!session.classScheduleData) {
      session.classScheduleData = {};
      sessionStore.set(sessionId, session);
    }

    if (session.trainerStep === "add_class_title") {
      if (!message || message === "📅 Add Class Schedule") {
        return res.json({
          action: "reply",
          replies: ["Enter Class Name:"],
          input: {
            type: "name",
            placeholder: "Pull Day",
            value: "",
            error: ["Enter name as per govt issued id"],
          },
        });
      }

      if (!message || message.trim().length < 2) {
        return res.json({
          action: "reply",
          replies: ["Please enter a valid name (at least 2 characters):"],
          input: {
            type: "name",
            placeholder: "Enter your class name",
            value: "",
            error: ["Enter name as per govt issued id"],
          },
        });
      }

      session.classScheduleData.title = message;
      session.trainerStep = "add_class_day";
      sessionStore.set(sessionId, session);

      return res.json({
        action: "reply",
        replies: ["Select the day for the class:"],
        input: {
          type: "select",
          name: "class_day",
          label: "Class Day",
          placeholder: "Choose day",
          mandatory: true,
          options: [
            { text: "Monday", value: "Monday" },
            { text: "Tuesday", value: "Tuesday" },
            { text: "Wednesday", value: "Wednesday" },
            { text: "Thursday", value: "Thursday" },
            { text: "Friday", value: "Friday" },
            { text: "Saturday", value: "Saturday" },
            { text: "Sunday", value: "Sunday" },
          ],
        },
      });
    }

    if (session.trainerStep === "add_class_day") {
      let dayValue = message;

      if (message && typeof message === "object" && message.value) {
        dayValue = message.value;
      }

      const validDays = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];
      if (!validDays.includes(dayValue)) {
        return res.json({
          action: "reply",
          replies: ["Invalid day selected. Please try again."],
          input: {
            type: "select",
            name: "class_day",
            label: "Class Day",
            placeholder: "Choose day",
            mandatory: true,
            options: [
              { text: "Monday", value: "Monday" },
              { text: "Tuesday", value: "Tuesday" },
              { text: "Wednesday", value: "Wednesday" },
              { text: "Thursday", value: "Thursday" },
              { text: "Friday", value: "Friday" },
              { text: "Saturday", value: "Saturday" },
              { text: "Sunday", value: "Sunday" },
            ],
          },
        });
      }

      session.classScheduleData.day = dayValue;
      session.trainerStep = "add_class_time";
      sessionStore.set(sessionId, session);

      const nextDate = getNextDateForDay(dayValue);

      return res.json({
        action: "reply",
        replies: ["These are the available slots, please select one."],
        input: {
          type: "timeslots",
          tz: true,
          label: "Schedule a meeting",
          date: nextDate.toLocaleDateString("en-GB"),
          time_zone_id: "Asia/Calcutta",
          slots: [
            "00:00",
            "01:00",
            "02:00",
            "03:00",
            "04:00",
            "05:00",
            "06:00",
            "07:00",
            "08:00",
            "09:00",
            "10:00",
            "11:00",
            "12:00",
            "13:00",
            "14:00",
            "15:00",
            "16:00",
            "17:00",
            "18:00",
            "19:00",
            "20:00",
            "21:00",
            "22:00",
            "23:00",
          ],
        },
      });
    }

    if (session.trainerStep === "add_class_time") {
      let timeValue = extractTimeFromZohoResponse(message);

      const validSlots = ["09:00", "10:00", "11:00", "13:00", "15:00", "17:00"];
      if (!timeValue || !validSlots.includes(timeValue)) {
        const nextDate = getNextDateForDay(session.classScheduleData.day);

        return res.json({
          action: "reply",
          replies: ["Please select a valid time slot:"],
          input: {
            type: "timeslots",
            tz: true,
            label: "Schedule a meeting",
            date: nextDate.toLocaleDateString("en-GB"),
            time_zone_id: "Asia/Calcutta",
            slots: validSlots,
          },
        });
      }

      session.classScheduleData.time = timeValue;
      session.trainerStep = "add_class_notes";
      sessionStore.set(sessionId, session);

      return res.json({
        action: "reply",
        replies: [
          "Please enter any additional notes for the class (or type 'skip' for no notes):",
        ],
      });
    }

    if (session.trainerStep === "add_class_notes") {
      session.classScheduleData.notes =
        message && message.toLowerCase() !== "skip" ? message : "";
      session.trainerStep = "add_class_confirm";
      sessionStore.set(sessionId, session);

      const confirmation =
        `Please confirm your class schedule:\n\n` +
        `Name: ${session.classScheduleData.title}\n` +
        `Day: ${session.classScheduleData.day}\n` +
        `Time: ${session.classScheduleData.time}\n` +
        `Notes: ${session.classScheduleData.notes || "None"}\n\n` +
        `Is this correct?`;

      return res.json({
        action: "reply",
        replies: [confirmation],
        suggestions: [
          "✅ Yes, Add Class",
          "🔄 No, Start Over",
          "⬅️ Back to Dashboard",
        ],
      });
    }

    if (session.trainerStep === "add_class_confirm") {
      if (message.includes("Yes") || message.includes("Add Class")) {
        try {
          const newClassSchedule = new ClassSchedule({
            trainerId: trainer.userId,
            title: session.classScheduleData.title,
            day: session.classScheduleData.day,
            time: session.classScheduleData.time,
            note: session.classScheduleData.notes,
          });

          await newClassSchedule.save();

          let confirmation = `✅ Class schedule "${session.classScheduleData.title}" has been added successfully!\n\n`;
          confirmation += `Day: ${session.classScheduleData.day}\n`;
          confirmation += `Time: ${session.classScheduleData.time}\n`;
          if (session.classScheduleData.notes) {
            confirmation += `Notes: ${session.classScheduleData.notes}\n`;
          }

          session.trainerStep = "dashboard";
          session.classScheduleData = null;
          sessionStore.set(sessionId, session);

          return res.json({
            action: "reply",
            replies: [confirmation],
            suggestions: [
              "👥 View Members",
              "📝 Update Profile",
              "📅 Add Class Schedule",
              "🚨 Report an Issue",
              "🤖 Talk to AI Assistant",
            ],
          });
        } catch (error) {
          console.error(
            "❌ [TRAINER] Error saving class schedule to database:",
            error
          );

          if (error.name === "ValidationError") {
            const validationErrors = Object.values(error.errors).map(
              (err) => err.message
            );
            return res.json({
              action: "reply",
              replies: [
                "Validation error: " + validationErrors.join(", "),
                "Please try again.",
              ],
              suggestions: ["⬅️ Back to Dashboard"],
            });
          }

          return res.json({
            action: "reply",
            replies: [
              "Sorry, there was an error creating the class schedule. Please try again later.",
            ],
            suggestions: ["⬅️ Back to Dashboard"],
          });
        }
      } else if (message.includes("No") || message.includes("Start Over")) {
        session.trainerStep = "add_class_title";
        session.classScheduleData = null;
        sessionStore.set(sessionId, session);

        return res.json({
          action: "reply",
          replies: ["Let's start over. Please enter class name:"],
          input: {
            type: "name",
            placeholder: "Enter your class name",
            value: "",
            error: ["Enter name as per govt issued id"],
          },
        });
      } else {
        return res.json({
          action: "reply",
          replies: ["Please select a valid option:"],
          suggestions: [
            "✅ Yes, Add Class",
            "🔄 No, Start Over",
            "⬅️ Back to Dashboard",
          ],
        });
      }
    }

    session.trainerStep = "dashboard";
    sessionStore.set(sessionId, session);
    return showTrainerDashboard(res, session, sessionId);
  } catch (error) {
    console.error("❌ [TRAINER] Error in add class schedule:", error);

    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error processing your request. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Dashboard"],
    });
  }
}

function handleAIAssistant(message, res, session, sessionId) {
  return aiAssistantController.handleAIAssistant(
    message,
    res,
    session,
    sessionId
  );
}

module.exports = {
  handleTrainer: exports.handleTrainer,
  showTrainerDashboard,
  handleViewMembers,
  handleUpdateProfile,
  handleAddClassSchedule,
  handleAIAssistant,
  getTrainerFromSession,
};
