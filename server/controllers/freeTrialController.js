// controllers/freeTrialController.js
const sessionStore = require("../utils/sessionStore");
const Trainer = require("../Models/trainer-model");
const newVisitorController = require("./NewVisitorController");
const generateOtp = require("../utils/generateOtp");
const { transporter } = require("./sendMailController");
const googleCalendarController = require("./googleCalendarController");

// Helper function to send booking confirmation email
function sendBookingConfirmationEmail(session) {
  if (!session.freeTrialData || !session.freeTrialData.email) {
    console.error(
      "🔥 [FREE TRIAL] Cannot send confirmation email - missing data"
    );
    return;
  }

  const {
    name,
    email,
    phone,
    date,
    time,
    rawDate,
    trainer,
    personalTraining,
    bookingId,
  } = session.freeTrialData;

  // Format date for display
  let formattedDate = date;
  if (rawDate) {
    const [day, month, year] = rawDate.split("/");
    const dateObj = new Date(`${year}-${month}-${day}`);
    formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // Format time for display
  const formattedTime = formatTime(time);

  let emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #4CAF50; text-align: center;">Free Trial Booking Confirmation</h2>
      <p>Dear ${name},</p>
      <p>Your free trial has been successfully booked! Here are your booking details:</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">Booking Details</h3>
        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedTime}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        
        ${
          personalTraining && trainer
            ? `
          <p><strong>Personal Training:</strong> Yes</p>
          <p><strong>Trainer:</strong> ${trainer.name}</p>
          ${
            trainer.specialization
              ? `<p><strong>Specialization:</strong> ${trainer.specialization}</p>`
              : ""
          }
          ${
            trainer.experience
              ? `<p><strong>Experience:</strong> ${trainer.experience} years</p>`
              : ""
          }
        `
            : "<p><strong>Personal Training:</strong> No</p>"
        }
      </div>
      
      <p>Please arrive 10 minutes before your scheduled time. If you need to make any changes to your booking, please contact us.</p>
      
      <p>Thank you for choosing our gym!</p>
      <p>Best regards,<br>The Gym Team</p>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@gym.com",
    to: email,
    subject: "Your Free Trial Booking Confirmation",
    html: emailContent,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(
        "🔥 [FREE TRIAL] Error sending booking confirmation email:",
        error
      );
    } else {
      console.log(
        "🔥 [FREE TRIAL] Booking confirmation email sent:",
        info.messageId
      );
    }
  });
}

// Helper function to send booking cancellation email
function sendBookingCancellationEmail(session) {
  if (!session.freeTrialData || !session.freeTrialData.email) {
    console.error(
      "🔥 [FREE TRIAL] Cannot send cancellation email - missing data"
    );
    return;
  }

  const { name, email, bookingId } = session.freeTrialData;

  const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #F44336; text-align: center;">Free Trial Booking Cancellation</h2>
      <p>Dear ${name},</p>
      <p>Your free trial booking has been cancelled as requested.</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">Cancellation Details</h3>
        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p><strong>Status:</strong> Cancelled</p>
      </div>
      
      <p>We're sorry to see you go. If you change your mind, you can always book another free trial at our gym.</p>
      
      <p>Thank you for your interest in our gym!</p>
      <p>Best regards,<br>The Gym Team</p>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@gym.com",
    to: email,
    subject: "Your Free Trial Booking Cancellation",
    html: emailContent,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(
        "🔥 [FREE TRIAL] Error sending booking cancellation email:",
        error
      );
    } else {
      console.log(
        "🔥 [FREE TRIAL] Booking cancellation email sent:",
        info.messageId
      );
    }
  });
}

// Helper function to send booking update email
function sendBookingUpdateEmail(session) {
  if (!session.freeTrialData || !session.freeTrialData.email) {
    console.error("🔥 [FREE TRIAL] Cannot send update email - missing data");
    return;
  }

  const {
    name,
    email,
    phone,
    date,
    time,
    rawDate,
    trainer,
    personalTraining,
    bookingId,
  } = session.freeTrialData;

  // Format date for display
  let formattedDate = date;
  if (rawDate) {
    const [day, month, year] = rawDate.split("/");
    const dateObj = new Date(`${year}-${month}-${day}`);
    formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  // Format time for display
  const formattedTime = formatTime(time);

  let emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2196F3; text-align: center;">Free Trial Booking Updated</h2>
      <p>Dear ${name},</p>
      <p>Your free trial booking information has been successfully updated. Here are your updated booking details:</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">Updated Booking Details</h3>
        <p><strong>Booking ID:</strong> ${bookingId}</p>
        <p><strong>Date:</strong> ${formattedDate}</p>
        <p><strong>Time:</strong> ${formattedTime}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        
        ${
          personalTraining && trainer
            ? `
          <p><strong>Personal Training:</strong> Yes</p>
          <p><strong>Trainer:</strong> ${trainer.name}</p>
          ${
            trainer.specialization
              ? `<p><strong>Specialization:</strong> ${trainer.specialization}</p>`
              : ""
          }
          ${
            trainer.experience
              ? `<p><strong>Experience:</strong> ${trainer.experience} years</p>`
              : ""
          }
        `
            : "<p><strong>Personal Training:</strong> No</p>"
        }
      </div>
      
      <p>Please arrive 10 minutes before your scheduled time. If you need to make any further changes to your booking, please contact us.</p>
      
      <p>Thank you for choosing our gym!</p>
      <p>Best regards,<br>The Gym Team</p>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@gym.com",
    to: email,
    subject: "Your Free Trial Booking Has Been Updated",
    html: emailContent,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(
        "🔥 [FREE TRIAL] Error sending booking update email:",
        error
      );
    } else {
      console.log("🔥 [FREE TRIAL] Booking update email sent:", info.messageId);
    }
  });
}

exports.handleFreeTrial = (message, res, session, visitorId) => {
  if (message && typeof message === "object") {
    console.log("🔥 [FREE TRIAL] Message object keys:", Object.keys(message));
    console.log("🔥 [FREE TRIAL] Message object type:", message.type);
  }

  try {
    // Initialize free trial data if not exists
    if (!session.freeTrialData) {
      session.freeTrialData = {};
      sessionStore.set(visitorId, session);
    }

    // Handle function invocations from carousel actions
    if (
      message &&
      typeof message === "object" &&
      message.type === "invoke.function"
    ) {
      console.log(
        "🔥 [FREE TRIAL] Processing invoke.function with name:",
        message.name
      );
      const { name, data } = message;

      switch (name) {
        case "selectTrainer":
          session.freeTrialData.trainer = {
            id: data.trainer_id,
            name: data.trainer_name,
          };
          session.visitorStep = "free_trial_confirmation";
          sessionStore.set(visitorId, session);

          return showBookingSummary(res, session, visitorId);

        default:
          return res.json({
            action: "reply",
            replies: [
              "I'm not sure how to handle that request. Please try again.",
            ],
            suggestions: ["⬅️ Back to Main Menu"],
          });
      }
    }

    // Handle carousel selections from Zoho SalesIQ
    if (
      message &&
      typeof message === "object" &&
      message.meta &&
      message.meta.card_data &&
      message.meta.card_data.type === "multiple-product" &&
      message.meta.card_data.value
    ) {
      try {
        const cardData = JSON.parse(message.meta.card_data.value);
        if (cardData.action && cardData.action.name === "selectTrainer") {
          // Extract trainer information
          const trainerId = cardData.element.id;
          const trainerName = cardData.element.title;

          session.freeTrialData.trainer = {
            id: trainerId,
            name: trainerName,
          };
          session.visitorStep = "free_trial_confirmation";
          sessionStore.set(visitorId, session);

          return showBookingSummary(res, session, visitorId);
        }
      } catch (error) {
        console.error("🔥 [FREE TRIAL] Error parsing card_data:", error);
      }
    }

    // Handle date-timeslots selection - both as object and as formatted string
    let dateObj = null;
    let timeStr = null;

    if (
      message &&
      typeof message === "object" &&
      message.type === "date-timeslots"
    ) {
      dateObj = message.date;
      timeStr = message.time;
    } else if (
      typeof message === "string" &&
      (session.visitorStep === "free_trial_datetime" ||
        (session.visitorStep === "free_trial_update" &&
          session.freeTrialData.fieldToUpdate === "date & time"))
    ) {
      // Parse the formatted date string
      const dateMatch = message.match(
        /(\w+), (\w+) (\d+), (\d+) at (\d+):(\d+) ([AP]M)/
      );

      if (dateMatch) {
        const [, dayOfWeek, month, day, year, hours, minutes, period] =
          dateMatch;

        // Format date as DD/MM/YYYY
        const monthMap = {
          January: "01",
          February: "02",
          March: "03",
          April: "04",
          May: "05",
          June: "06",
          July: "07",
          August: "08",
          September: "09",
          October: "10",
          November: "11",
          December: "12",
        };

        const monthNum = monthMap[month];
        dateObj = `${day.padStart(2, "0")}/${monthNum}/${year}`;

        // Format time as HH:MM in 24-hour format
        let hour = parseInt(hours);
        if (period === "PM" && hour !== 12) {
          hour += 12;
        } else if (period === "AM" && hour === 12) {
          hour = 0;
        }
        timeStr = `${hour.toString().padStart(2, "0")}:${minutes}`;
      }
    }

    if (dateObj && timeStr) {
      // Parse the date to get day of week
      const [day, month, year] = dateObj.split("/");
      const selectedDate = new Date(`${year}-${month}-${day}`);

      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const dayOfWeek = days[selectedDate.getDay()];

      // Parse the time
      const [hours, minutes] = timeStr.split(":").map(Number);
      const timeInMinutes = hours * 60 + minutes;

      // Check if the time is within allowed hours
      let isValidTime = false;

      if (dayOfWeek === "sunday") {
        // Sunday: 6 AM to 5 PM (6:00 to 17:00)
        isValidTime = timeInMinutes >= 360 && timeInMinutes <= 1020;
      } else {
        // Monday - Saturday: 6 AM to 8 PM (6:00 to 20:00)
        isValidTime = timeInMinutes >= 360 && timeInMinutes <= 1200;
      }

      if (!isValidTime) {
        return res.json({
          action: "reply",
          replies: [
            `Invalid time for ${dayOfWeek}. Please select a time within our allowed hours:\nMonday – Saturday: 6 AM to 8 PM\nSunday: 6 AM to 5 PM`,
          ],
          suggestions: ["⬅️ Back to Main Menu"],
        });
      }

      // Store date and time
      session.freeTrialData.date = dayOfWeek;
      session.freeTrialData.time = timeStr;
      session.freeTrialData.rawDate = dateObj; // Store the raw date for display

      // Check if we're in the update flow
      if (session.visitorStep === "free_trial_update") {
        // Clear the fieldToUpdate flag
        session.freeTrialData.fieldToUpdate = null;
        sessionStore.set(visitorId, session);

        // Show updated booking summary
        return showUpdatedBookingSummary(res, session, visitorId);
      } else {
        session.visitorStep = "free_trial_personal_training";
        sessionStore.set(visitorId, session);

        return res.json({
          action: "reply",
          replies: [
            `Great! Your free trial is scheduled for ${dayOfWeek} at ${formatTime(
              timeStr
            )}.\n\nDo you want personal training during your free trial?`,
          ],
          suggestions: ["Yes", "No", "⬅️ Back to Main Menu"],
        });
      }
    }

    // Handle "Back to Main Menu" at any point
    if (message === "⬅️ Back to Main Menu") {
      session.visitorStep = "greeting";
      sessionStore.set(visitorId, session);
      return newVisitorController.showGreeting(res, session, visitorId);
    }

    // Handle free trial flow based on current step
    switch (session.visitorStep) {
      case "free_trial":
        return handleFreeTrialStart(message, res, session, visitorId);

      case "free_trial_name":
        return handleNameInput(message, res, session, visitorId);

      case "free_trial_email":
        return handleEmailInput(message, res, session, visitorId);

      case "free_trial_phone":
        return handlePhoneInput(message, res, session, visitorId);

      case "free_trial_email_otp":
        return handleEmailOTPVerification(message, res, session, visitorId);

      case "free_trial_datetime":
        return handleDateTimeSelection(message, res, session, visitorId);

      case "free_trial_personal_training":
        return handlePersonalTrainingOption(message, res, session, visitorId);

      case "free_trial_trainer_selection":
        // Check #1 - At the Switch Case Level
        // If we're at the trainer_selection step BUT a trainer is already selected,
        // don't ask again—just show the booking summary
        if (session.freeTrialData.trainer) {
          session.visitorStep = "free_trial_confirmation";
          sessionStore.set(visitorId, session);
          return showBookingSummary(res, session, visitorId);
        }

        return handleTrainerSelection(message, res, session, visitorId);

      case "free_trial_trainer_specialization":
        return handleTrainerSpecialization(message, res, session, visitorId);

      case "free_trial_confirmation":
        return handleBookingConfirmation(message, res, session, visitorId);

      case "free_trial_booked":
        return handlePostBookingActions(message, res, session, visitorId);

      case "free_trial_update":
        return handleUpdateInformation(message, res, session, visitorId);

      case "free_trial_cancel":
        return handleCancelBooking(message, res, session, visitorId);

      default:
        session.visitorStep = "free_trial";
        sessionStore.set(visitorId, session);
        return handleFreeTrialStart("", res, session, visitorId);
    }
  } catch (error) {
    console.error("🔥 [FREE TRIAL] Error in handleFreeTrial:", error);
    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error processing your request. Please try again.",
      ],
      suggestions: ["⬅️ Back to Main Menu"],
    });
  }
};

// Start of free trial booking flow
function handleFreeTrialStart(message, res, session, visitorId) {
  session.visitorStep = "free_trial_name";
  sessionStore.set(visitorId, session);

  const response = {
    platform: "ZOHOSALESIQ",
    action: "reply",
    replies: ["Let's book your free trial! Please enter your full name:"],
    input: {
      type: "name",
      placeholder: "Enter your full name",
    },
    suggestions: ["⬅️ Back to Main Menu"],
  };

  return res.json(response);
}

// Handle name input
function handleNameInput(message, res, session, visitorId) {
  // If this is the first time entering this step (message is "Book Free Trial")
  if (message === "Book Free Trial") {
    const response = {
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please enter your full name:"],
      input: {
        type: "name",
        placeholder: "Enter your full name",
      },
      suggestions: ["⬅️ Back to Main Menu"],
    };

    return res.json(response);
  }

  if (!message || message.trim() === "") {
    const response = {
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please enter a valid name:"],
      input: {
        type: "name",
        placeholder: "Enter your full name",
        error: ["Name is required"],
      },
      suggestions: ["⬅️ Back to Main Menu"],
    };

    return res.json(response);
  }

  // Store name and move to next step
  session.freeTrialData.name = message.trim();
  session.visitorStep = "free_trial_email";
  sessionStore.set(visitorId, session);

  const response = {
    action: "reply",
    replies: ["Thank you! Now please enter your email address:"],
    input: {
      type: "email",
      name: "email",
      placeholder: "your.email@example.com",
      label: "Email Address",
      mandatory: true,
    },
    suggestions: ["⬅️ Back to Main Menu"],
  };

  return res.json(response);
}

// Handle email input
async function handleEmailInput(message, res, session, visitorId) {
  const emailRegex = /\S+@\S+\.\S+/;
  const emailMatch = message.match(emailRegex);
  const email = emailMatch ? emailMatch[0].trim() : message.trim();

  if (!emailRegex.test(email)) {
    return res.json({
      action: "reply",
      replies: ["Please enter a valid email address:"],
      input: {
        type: "email",
        name: "email",
        placeholder: "your.email@example.com",
        label: "Email Address",
        mandatory: true,
      },
      suggestions: ["⬅️ Back to Main Menu"],
    });
  }

  // Store email and generate OTP
  session.freeTrialData.email = email;
  const emailOtp = generateOtp();
  session.freeTrialData.emailOTP = emailOtp;
  session.freeTrialData.otpGeneratedAt = Date.now();

  console.log("🔥 [FREE TRIAL] Generated OTP:", emailOtp, "for email:", email);

  // ✅ Move to next step IMMEDIATELY
  session.visitorStep = "free_trial_phone";
  sessionStore.set(visitorId, session);

  // ✅ Build mail options BEFORE response
  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@gym.com",
    to: email,
    subject: "Your OTP for Free Trial Registration",
    text: `Your OTP for free trial registration is: ${emailOtp}. Valid for 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4CAF50; text-align: center;">OTP Verification</h2>
        <p>Hello,</p>
        <p>Thank you for booking a free trial at our gym!</p>
        <p>Your OTP for email verification is:</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h1 style="color: #4CAF50; margin: 0; font-size: 36px; letter-spacing: 5px;">${emailOtp}</h1>
        </div>
        <p><strong>This OTP is valid for 10 minutes.</strong></p>
        <p>If you didn't request this OTP, please ignore this email.</p>
        <p>Best regards,<br>The Gym Team</p>
      </div>
    `,
  };

  // ✅ SEND RESPONSE IMMEDIATELY
  console.log("📧 [FREE TRIAL] Sending response first, then email");
  res.json({
    action: "reply",
    replies: [
      `📧 Verification code is being sent to ${email}\n\nIt may take a few seconds to arrive. Check your inbox and spam folder.\n\n📱 Meanwhile, please enter your phone number:`,
    ],
    input: {
      type: "tel",
      name: "phone",
      placeholder: "+91 9876543210",
      label: "Phone Number",
      mandatory: true,
    },
    suggestions: ["⬅️ Back to Main Menu"],
  });

  // ✅ SEND EMAIL IN BACKGROUND (after response is sent)
  setImmediate(() => {
    console.log(
      "📧 [FREE TRIAL] Now sending OTP email in background to:",
      email
    );

    transporter
      .sendMail(mailOptions)
      .then((info) => {
        console.log("✅ [FREE TRIAL] OTP email sent successfully!");
        console.log("   Message ID:", info.messageId);
        console.log("   Sent to:", email);
        console.log("   OTP:", emailOtp);
      })
      .catch((error) => {
        console.error("❌ [FREE TRIAL] Failed to send OTP email!");
        console.error("   Error:", error.message);
        console.error("   Email address:", email);
      });
  });

  // ✅ IMPORTANT: Don't return anything after res.json()
  // The response has already been sent
}
// Handle phone input
function handlePhoneInput(message, res, session, visitorId) {
  console.log("🔥 [FREE TRIAL] handlePhoneInput - Message:", message);

  // Clean the phone number by removing all non-digit characters
  const cleanPhone = message.replace(/\D/g, "");

  // Remove '91' country code if present at the beginning
  let finalPhone = cleanPhone;
  if (cleanPhone.startsWith("91") && cleanPhone.length > 10) {
    finalPhone = cleanPhone.substring(2);
  }

  // Phone validation (exactly 10 digits after cleaning)
  const phoneRegex = /^\d{10}$/;

  if (!phoneRegex.test(finalPhone)) {
    return res.json({
      action: "reply",
      replies: [
        "❌ Invalid phone number.\n\nPlease enter a valid 10-digit phone number:",
      ],
      input: {
        type: "tel",
        name: "phone",
        placeholder: "+91 9876543210",
        label: "Phone Number",
        mandatory: true,
      },
      suggestions: ["⬅️ Back to Main Menu"],
    });
  }

  // Store phone and move to OTP verification
  session.freeTrialData.phone = finalPhone;
  session.visitorStep = "free_trial_email_otp";
  sessionStore.set(visitorId, session);

  console.log("✅ [FREE TRIAL] Phone saved, moving to OTP verification");

  return res.json({
    action: "reply",
    replies: [
      `✅ Phone number saved: ${finalPhone}\n\n🔐 Please enter the OTP sent to ${session.freeTrialData.email}\n\n⏱️ Check your inbox (it may take 10-30 seconds to arrive)`,
    ],
    input: {
      type: "text",
      name: "otp",
      placeholder: "Enter 6-digit OTP",
      label: "Verification Code",
      mandatory: true,
    },
    suggestions: ["Resend OTP", "⬅️ Back to Main Menu"],
  });
}
// Handle email OTP verification
function handleEmailOTPVerification(message, res, session, visitorId) {
  console.log("🔥 [FREE TRIAL] OTP Verification - Received:", message);

  // Handle "Resend OTP" request
  if (message === "Resend OTP") {
    return handleResendOTP(res, session, visitorId);
  }

  // Clean the OTP input (remove spaces, dashes, etc.)
  const cleanOTP = message.replace(/\D/g, "");

  // Check if OTP is expired (10 minutes = 600000 ms)
  const otpAge = Date.now() - (session.freeTrialData.otpGeneratedAt || 0);
  const isExpired = otpAge > 10 * 60 * 1000;

  if (isExpired) {
    console.log("⏱️ [FREE TRIAL] OTP expired");
    return res.json({
      action: "reply",
      replies: [
        "⏱️ Your OTP has expired (valid for 10 minutes).\n\nPlease request a new one:",
      ],
      input: {
        type: "text",
        name: "otp",
        placeholder: "Enter 6-digit OTP",
        label: "Verification Code",
        mandatory: true,
      },
      suggestions: ["Resend OTP", "⬅️ Back to Main Menu"],
    });
  }

  // Verify OTP
  if (cleanOTP !== session.freeTrialData.emailOTP) {
    console.log("❌ [FREE TRIAL] Invalid OTP entered");

    // Track failed attempts
    session.freeTrialData.otpAttempts =
      (session.freeTrialData.otpAttempts || 0) + 1;
    sessionStore.set(visitorId, session);

    // Block after 5 failed attempts
    if (session.freeTrialData.otpAttempts >= 5) {
      console.log("🚫 [FREE TRIAL] Too many failed attempts");
      return res.json({
        action: "reply",
        replies: ["❌ Too many failed attempts.\n\nPlease request a new OTP:"],
        suggestions: ["Resend OTP", "⬅️ Back to Main Menu"],
      });
    }

    return res.json({
      action: "reply",
      replies: [
        `❌ Invalid OTP. (${
          5 - session.freeTrialData.otpAttempts
        } attempts remaining)\n\nPlease try again:`,
      ],
      input: {
        type: "text",
        name: "otp",
        placeholder: "Enter 6-digit OTP",
        label: "Verification Code",
        mandatory: true,
      },
      suggestions: ["Resend OTP", "⬅️ Back to Main Menu"],
    });
  }

  console.log("✅ [FREE TRIAL] OTP verified successfully");

  // Reset OTP attempts
  session.freeTrialData.otpAttempts = 0;
  session.freeTrialData.emailVerified = true;
  session.visitorStep = "free_trial_datetime";
  sessionStore.set(visitorId, session);

  // Generate time slots for the next 5 days
  const slots = generateTimeSlots();

  return res.json({
    platform: "ZOHOSALESIQ",
    action: "reply",
    replies: [
      "✅ Email verified successfully!\n\n📅 Please select a date and time for your free trial:",
    ],
    input: {
      type: "date-timeslots",
      tz: true,
      label: "Select a time",
      time_zone_id: "Asia/Calcutta",
      slots: slots,
    },
    suggestions: ["⬅️ Back to Main Menu"],
  });
}

// Handle resend OTP
function handleResendOTP(res, session, visitorId) {
  console.log("🔥 [FREE TRIAL] Resending OTP");

  const now = Date.now();
  const lastResendTime = session.freeTrialData.lastResendTime || 0;
  const timeSinceLastResend = now - lastResendTime;

  if (timeSinceLastResend < 30000) {
    const waitSeconds = Math.ceil((30000 - timeSinceLastResend) / 1000);
    return res.json({
      action: "reply",
      replies: [
        `⏱️ Please wait ${waitSeconds} seconds before requesting a new OTP.\n\nEnter your current OTP:`,
      ],
      input: {
        type: "text",
        name: "otp",
        placeholder: "Enter 6-digit OTP",
        label: "Verification Code",
        mandatory: true,
      },
      suggestions: ["⬅️ Back to Main Menu"],
    });
  }

  const emailOtp = generateOtp();
  session.freeTrialData.emailOTP = emailOtp;
  session.freeTrialData.otpGeneratedAt = now;
  session.freeTrialData.lastResendTime = now;
  session.freeTrialData.otpAttempts = 0;
  sessionStore.set(visitorId, session);

  console.log("🔥 [FREE TRIAL] New OTP generated:", emailOtp);

  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@gym.com",
    to: session.freeTrialData.email,
    subject: "Your NEW OTP for Free Trial Registration",
    text: `Your NEW OTP for free trial registration is: ${emailOtp}. Valid for 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4CAF50; text-align: center;">New OTP Verification</h2>
        <p>Hello,</p>
        <p>You requested a new OTP for free trial registration.</p>
        <p>Your NEW OTP is:</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <h1 style="color: #4CAF50; margin: 0; font-size: 36px; letter-spacing: 5px;">${emailOtp}</h1>
        </div>
        <p><strong>This OTP is valid for 10 minutes.</strong></p>
        <p>Best regards,<br>The Gym Team</p>
      </div>
    `,
  };

  // ✅ SEND RESPONSE FIRST
  res.json({
    action: "reply",
    replies: [
      `📧 A new OTP has been sent to ${session.freeTrialData.email}\n\n🔐 Please enter the new OTP (it may take 10-30 seconds to arrive):`,
    ],
    input: {
      type: "text",
      name: "otp",
      placeholder: "Enter 6-digit OTP",
      label: "Verification Code",
      mandatory: true,
    },
    suggestions: ["⬅️ Back to Main Menu"],
  });

  // ✅ SEND EMAIL IN BACKGROUND
  setImmediate(() => {
    console.log("📧 [FREE TRIAL] Sending NEW OTP email in background");
    transporter
      .sendMail(mailOptions)
      .then((info) => {
        console.log("✅ [FREE TRIAL] New OTP email sent successfully!");
        console.log("   Message ID:", info.messageId);
      })
      .catch((error) => {
        console.error("❌ [FREE TRIAL] Failed to send new OTP email!");
        console.error("   Error:", error.message);
      });
  });
}

// Helper function to generate time slots
function generateTimeSlots() {
  const slots = {};
  const today = new Date();

  // Generate slots for the next 5 days
  for (let i = 0; i < 5; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    // Format date as DD/MM/YYYY
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const dateKey = `${day}/${month}/${year}`;

    // Determine day of week
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Define time slots based on day of week
    const timeSlots = [];

    if (dayOfWeek === 0) {
      // Sunday
      // 6 AM to 5 PM in 30-minute intervals
      for (let hour = 6; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const time = `${hour.toString().padStart(2, "0")}:${minute
            .toString()
            .padStart(2, "0")}`;
          timeSlots.push(time);
        }
      }
    } else {
      // Monday - Saturday
      // 6 AM to 8 PM in 30-minute intervals
      for (let hour = 6; hour < 20; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const time = `${hour.toString().padStart(2, "0")}:${minute
            .toString()
            .padStart(2, "0")}`;
          timeSlots.push(time);
        }
      }
    }

    slots[dateKey] = timeSlots;
  }

  return slots;
}

// Handle date/time selection
function handleDateTimeSelection(message, res, session, visitorId) {
  // If the user sends a text message instead of using the date-timeslots
  if (
    typeof message === "string" &&
    !message.includes("at") &&
    !message.includes("GMT")
  ) {
    // Generate time slots for the next 5 days
    const slots = generateTimeSlots();

    return res.json({
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: ["Please use the date-time selector above to choose a slot."],
      input: {
        type: "date-timeslots",
        tz: true,
        label: "Select a time",
        time_zone_id: "Asia/Calcutta",
        slots: slots,
      },
      suggestions: ["⬅️ Back to Main Menu"],
    });
  }

  // If we get here, it means the date-time selection was already processed in the main function
  // but we need to handle the case where it wasn't properly parsed
  if (
    typeof message === "string" &&
    (message.includes("at") || message.includes("GMT"))
  ) {
    // Parse the formatted date string
    const dateMatch = message.match(
      /(\w+), (\w+) (\d+), (\d+) at (\d+):(\d+) ([AP]M)/
    );

    if (dateMatch) {
      const [, dayOfWeek, month, day, year, hours, minutes, period] = dateMatch;

      // Format date as DD/MM/YYYY
      const monthMap = {
        January: "01",
        February: "02",
        March: "03",
        April: "04",
        May: "05",
        June: "06",
        July: "07",
        August: "08",
        September: "09",
        October: "10",
        November: "11",
        December: "12",
      };

      const monthNum = monthMap[month];
      const dateObj = `${day.padStart(2, "0")}/${monthNum}/${year}`;

      // Format time as HH:MM in 24-hour format
      let hour = parseInt(hours);
      if (period === "PM" && hour !== 12) {
        hour += 12;
      } else if (period === "AM" && hour === 12) {
        hour = 0;
      }
      const timeStr = `${hour.toString().padStart(2, "0")}:${minutes}`;

      // Parse the date to get day of week
      const [dayPart, monthPart, yearPart] = dateObj.split("/");
      const selectedDate = new Date(`${yearPart}-${monthPart}-${dayPart}`);

      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const dayOfWeekName = days[selectedDate.getDay()];

      // Store date and time
      session.freeTrialData.date = dayOfWeekName;
      session.freeTrialData.time = timeStr;
      session.freeTrialData.rawDate = dateObj;
      session.visitorStep = "free_trial_personal_training";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: [
          `Great! Your free trial is scheduled for ${dayOfWeekName} at ${formatTime(
            timeStr
          )}.\n\nDo you want personal training during your free trial?`,
        ],
        suggestions: ["Yes", "No", "⬅️ Back to Main Menu"],
      });
    }
  }

  // Generate time slots for the next 5 days
  const slots = generateTimeSlots();

  // Default response
  return res.json({
    platform: "ZOHOSALESIQ",
    action: "reply",
    replies: ["Please select a date and time using the selector above."],
    input: {
      type: "date-timeslots",
      tz: true,
      label: "Select a time",
      time_zone_id: "Asia/Calcutta",
      slots: slots,
    },
    suggestions: ["⬅️ Back to Main Menu"],
  });
}

// Handle personal training option
function handlePersonalTrainingOption(message, res, session, visitorId) {
  if (message === "Yes") {
    session.freeTrialData.personalTraining = true;
    session.visitorStep = "free_trial_trainer_selection";
    sessionStore.set(visitorId, session);

    const response = {
      action: "reply",
      replies: [
        "Would you like to:\n1. See all trainers\n2. Get a trainer recommendation based on your needs",
      ],
      suggestions: [
        "See All Trainers",
        "Get Recommendation",
        "⬅️ Back to Main Menu",
      ],
    };

    return res.json(response);
  } else if (message === "No") {
    session.freeTrialData.personalTraining = false;
    session.freeTrialData.trainer = null;
    session.visitorStep = "free_trial_confirmation";
    sessionStore.set(visitorId, session);

    return showBookingSummary(res, session, visitorId);
  } else {
    const response = {
      action: "reply",
      replies: ["Please select a valid option:"],
      suggestions: ["Yes", "No", "⬅️ Back to Main Menu"],
    };

    return res.json(response);
  }
}

// Handle trainer selection - COMPLETE FIXED VERSION
async function handleTrainerSelection(message, res, session, visitorId) {
  // Check #1 - If trainer is already selected, skip to confirmation
  if (
    session.freeTrialData.trainer &&
    message !== "See All Trainers" &&
    message !== "Get Recommendation"
  ) {
    session.visitorStep = "free_trial_confirmation";
    sessionStore.set(visitorId, session);
    return showBookingSummary(res, session, visitorId);
  }

  // Handle dropdown selection from Zoho SalesIQ
  if (
    typeof message === "string" &&
    message.includes(" - ") &&
    ![
      "See All Trainers",
      "Get Recommendation",
      "Select Different Trainer",
      "Confirm Booking",
    ].includes(message)
  ) {
    try {
      const trainerName = message.split(" - ")[0].trim();

      const trainer = await Trainer.findOne({ name: trainerName });

      if (!trainer) {
        console.error(
          "🔥 [FREE TRIAL] Trainer not found with name:",
          trainerName
        );
        return res.json({
          action: "reply",
          replies: [
            "Sorry, the selected trainer could not be found. Please try again.",
          ],
          suggestions: ["See All Trainers", "⬅️ Back to Main Menu"],
        });
      }
      session.freeTrialData.trainer = {
        id: trainer._id.toString(),
        name: trainer.name,
        specialization: trainer.specialization,
        experience: trainer.experience,
      };
      session.visitorStep = "free_trial_confirmation";
      sessionStore.set(visitorId, session);

      return showBookingSummary(res, session, visitorId);
    } catch (error) {
      console.error("🔥 [FREE TRIAL] Error finding trainer:", error);
      return res.json({
        action: "reply",
        replies: [
          "Sorry, there was an error finding the trainer. Please try again.",
        ],
        suggestions: ["See All Trainers", "⬅️ Back to Main Menu"],
      });
    }
  }

  // Handle "See All Trainers"
  if (message === "See All Trainers") {
    try {
      const trainers = await Trainer.find();

      if (trainers.length === 0) {
        return res.json({
          action: "reply",
          replies: ["Sorry, no trainers are available at the moment."],
          suggestions: ["⬅️ Back to Main Menu"],
        });
      }

      // Build trainer display as individual cards
      const trainerReplies = ["🏋️ **Our Available Trainers:**\n"];

      trainers.forEach((trainer, index) => {
        trainerReplies.push({
          text: `**${trainer.name}**\n\n✨ Specialization: ${trainer.specialization}\n📊 Experience: ${trainer.experience} years`,
          image:
            trainer.profilePic ||
            "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80",
          image_position: "fit",
        });
      });

      trainerReplies.push(
        "\nℹ️ Please select a trainer from the dropdown below:"
      );

      // Create dropdown options
      const trainerOptions = trainers.map((trainer) => ({
        text: `${trainer.name} - ${trainer.specialization}`,
        value: `${trainer.name} - ${trainer.specialization}`,
      }));

      const payload = {
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: trainerReplies,
        input: {
          type: "select",
          name: "trainer",
          label: "Select Your Trainer",
          placeholder: "Choose a trainer",
          mandatory: true,
          options: trainerOptions,
        },
        suggestions: ["⬅️ Back to Main Menu"],
      };

      return res.json(payload);
    } catch (error) {
      console.error("🔥 [FREE TRIAL] Error fetching trainers:", error);
      return res.json({
        action: "reply",
        replies: [
          "Sorry, there was an error retrieving trainer information. Please try again later.",
        ],
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }
  }

  // Handle "Get Recommendation"
  if (message === "Get Recommendation") {
    session.visitorStep = "free_trial_trainer_specialization";
    sessionStore.set(visitorId, session);
    return handleTrainerSpecialization("", res, session, visitorId);
  }

  // Handle "Confirm Booking"
  if (message === "Confirm Booking") {
    session.visitorStep = "free_trial_confirmation";
    sessionStore.set(visitorId, session);

    return showBookingSummary(res, session, visitorId);
  }

  // Handle "Select Different Trainer"
  if (message === "Select Different Trainer") {
    return handleTrainerSelection("See All Trainers", res, session, visitorId);
  }

  // Default case

  return res.json({
    action: "reply",
    replies: ["Please select a valid option:"],
    suggestions: [
      "See All Trainers",
      "Get Recommendation",
      "⬅️ Back to Main Menu",
    ],
  });
}

// Handle trainer specialization
async function handleTrainerSpecialization(message, res, session, visitorId) {
  // Check if user selected "Select This Trainer"
  if (message === "Select This Trainer") {
    if (session.freeTrialData.trainer) {
      session.visitorStep = "free_trial_confirmation";
      sessionStore.set(visitorId, session);

      return showBookingSummary(res, session, visitorId);
    } else {
      return res.json({
        action: "reply",
        replies: ["No trainer was selected. Please try again."],
        suggestions: ["See All Trainers", "⬅️ Back to Main Menu"],
      });
    }
  }

  // Check if user selected "See All Trainers"
  if (message === "See All Trainers") {
    session.visitorStep = "free_trial_trainer_selection";
    sessionStore.set(visitorId, session);
    return handleTrainerSelection("See All Trainers", res, session, visitorId);
  }

  // Handle specialization selection from dropdown
  // Zoho sends the specialization as a plain string
  if (
    typeof message === "string" &&
    message !== "" &&
    ![
      "Select This Trainer",
      "See All Trainers",
      "⬅️ Back to Main Menu",
    ].includes(message)
  ) {
    const specialization = message.toLowerCase().trim();

    try {
      // Find a trainer with the specified specialization
      const trainers = await Trainer.find({
        specialization: { $regex: specialization, $options: "i" },
      });

      if (trainers.length === 0) {
        return res.json({
          action: "reply",
          replies: [
            "Sorry, we couldn't find a trainer with that specialization. Would you like to see all trainers instead?",
          ],
          suggestions: ["See All Trainers", "⬅️ Back to Main Menu"],
        });
      }

      // Get the first matching trainer
      const trainer = trainers[0];

      // Store trainer in session immediately
      session.freeTrialData.trainer = {
        id: trainer._id.toString(),
        name: trainer.name,
        specialization: trainer.specialization,
        experience: trainer.experience,
      };
      sessionStore.set(visitorId, session);

      // Create trainer widget
      const trainerWidget = {
        text: `Recommended Trainer\n\nName: ${trainer.name}\nSpecialization: ${trainer.specialization}\nExperience: ${trainer.experience} years`,
        image:
          trainer.profilePic ||
          "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80",
        image_position: "fit",
      };

      return res.json({
        action: "reply",
        replies: [trainerWidget],
        suggestions: [
          "Select This Trainer",
          "See All Trainers",
          "⬅️ Back to Main Menu",
        ],
      });
    } catch (error) {
      console.error("🔥 [FREE TRIAL] Error finding trainer:", error);
      return res.json({
        action: "reply",
        replies: [
          "Sorry, there was an error finding a trainer. Please try again later.",
        ],
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }
  }

  // First time showing specialization options - show dropdown
  try {
    // Fetch all distinct specializations from trainers
    const specializations = await Trainer.distinct("specialization");

    if (specializations.length === 0) {
      return res.json({
        action: "reply",
        replies: ["No specializations available. Please try again later."],
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }

    // Format options - Use specialization as BOTH text AND value
    const options = specializations.map((spec) => ({
      text: spec,
      value: spec, // Changed: Use the specialization name directly instead of lowercase
    }));

    return res.json({
      action: "reply",
      replies: ["What specialization are you looking for?"],
      input: {
        type: "select",
        name: "specialization",
        label: "Specialization",
        placeholder: "Choose specialization",
        mandatory: true,
        options: options,
      },
      suggestions: ["⬅️ Back to Main Menu"],
    });
  } catch (error) {
    console.error("🔥 [FREE TRIAL] Error fetching specializations:", error);
    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error retrieving specializations. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Main Menu"],
    });
  }
}

// Show booking summary
function showBookingSummary(res, session, visitorId) {
  let summary = "Please confirm your free trial booking details:\n\n";
  summary += `Name: ${session.freeTrialData.name}\n`;
  summary += `Email: ${session.freeTrialData.email}\n`;
  summary += `Phone: ${session.freeTrialData.phone}\n`;

  // Format the date for display
  if (session.freeTrialData.rawDate) {
    const [day, month, year] = session.freeTrialData.rawDate.split("/");
    const dateObj = new Date(`${year}-${month}-${day}`);
    summary += `Date: ${dateObj.toLocaleDateString()}\n`;
  } else {
    summary += `Date: ${session.freeTrialData.date}\n`;
  }

  summary += `Time: ${formatTime(session.freeTrialData.time)}\n`;

  if (session.freeTrialData.personalTraining && session.freeTrialData.trainer) {
    summary += `Personal Training: Yes\n`;
    summary += `Trainer: ${session.freeTrialData.trainer.name}\n`;

    // Add trainer details if available
    if (session.freeTrialData.trainer.specialization) {
      summary += `Specialization: ${session.freeTrialData.trainer.specialization}\n`;
    }
    if (session.freeTrialData.trainer.experience) {
      summary += `Experience: ${session.freeTrialData.trainer.experience} years\n`;
    }
  } else {
    summary += `Personal Training: No\n`;
  }

  summary += "\nDo you want to confirm your free trial booking?";

  session.visitorStep = "free_trial_confirmation";
  sessionStore.set(visitorId, session);

  const response = {
    action: "reply",
    replies: [summary],
    suggestions: ["Confirm", "⬅️ Back to Main Menu"],
  };

  return res.json(response);
}

// Handle booking confirmation
async function handleBookingConfirmation(message, res, session, visitorId) {
  if (message === "Confirm") {
    try {
      // Generate booking ID
      session.freeTrialData.confirmed = true;
      session.freeTrialData.bookingId = "FT" + Date.now();

      try {
        const calendarResult =
          await googleCalendarController.createFreeTrialEvent({
            name: session.freeTrialData.name,
            email: session.freeTrialData.email,
            phone: session.freeTrialData.phone,
            rawDate: session.freeTrialData.rawDate,
            time: session.freeTrialData.time,
            personalTraining: session.freeTrialData.personalTraining,
            trainer: session.freeTrialData.trainer,
            bookingId: session.freeTrialData.bookingId,
            timeZone: "Asia/Kolkata",
          });

        session.freeTrialData.calendarEventId = calendarResult.eventId;
        session.freeTrialData.calendarEventLink = calendarResult.eventLink;
      } catch (calendarError) {
        console.error(
          "❌ [FREE TRIAL] Failed to create calendar event:",
          calendarError.message
        );

        // ⚠️ IMPORTANT: Add this warning to the response
        session.freeTrialData.calendarWarning =
          "Calendar sync failed - event not added to Google Calendar";
      }

      // Update session
      session.visitorStep = "free_trial_booked";
      sessionStore.set(visitorId, session);

      // Send booking confirmation email
      sendBookingConfirmationEmail(session);

      // Build response message
      let responseMessage =
        "Your free trial has been successfully booked! 🎉\n\n";
      responseMessage +=
        "Booking ID: " + session.freeTrialData.bookingId + "\n\n";

      responseMessage +=
        "A confirmation email has been sent to your registered email address.\n\n";
      responseMessage +=
        "You can now update your information or cancel your booking if needed.";

      const response = {
        action: "reply",
        replies: [responseMessage],
        suggestions: [
          "Update Information",
          "Cancel Free Trial",
          "⬅️ Back to Main Menu",
        ],
      };

      return res.json(response);
    } catch (error) {
      console.error("🔥 [FREE TRIAL] Error in booking confirmation:", error);
      return res.json({
        action: "reply",
        replies: [
          "Sorry, there was an error confirming your booking. Please try again or contact support.",
        ],
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }
  } else {
    const response = {
      action: "reply",
      replies: ["Please confirm your booking:"],
      suggestions: ["Confirm", "⬅️ Back to Main Menu"],
    };

    return res.json(response);
  }
}

// Handle post-booking actions
function handlePostBookingActions(message, res, session, visitorId) {
  if (message === "Update Information") {
    session.visitorStep = "free_trial_update";
    sessionStore.set(visitorId, session);

    const response = {
      action: "reply",
      replies: ["What information would you like to update?"],
      suggestions: [
        "Name",
        "Email",
        "Phone",
        "Date & Time", // Changed from separate Date and Time to combined Date & Time
        "⬅️ Back to Main Menu",
      ],
    };

    return res.json(response);
  } else if (message === "Cancel Free Trial") {
    session.visitorStep = "free_trial_cancel";
    sessionStore.set(visitorId, session);

    const response = {
      action: "reply",
      replies: ["Are you sure you want to cancel your free trial?"],
      suggestions: ["Yes", "No", "⬅️ Back to Main Menu"],
    };

    return res.json(response);
  } else {
    const response = {
      action: "reply",
      replies: ["Please select a valid option:"],
      suggestions: [
        "Update Information",
        "Cancel Free Trial",
        "⬅️ Back to Main Menu",
      ],
    };

    return res.json(response);
  }
}

// Handle update information
function handleUpdateInformation(message, res, session, visitorId) {
  // If we are waiting for a value to update (i.e., fieldToUpdate is set)
  if (session.freeTrialData.fieldToUpdate) {
    const field = session.freeTrialData.fieldToUpdate;

    // Validate and update the field
    switch (field) {
      case "name":
        if (!message || message.trim().length < 2) {
          return res.json({
            platform: "ZOHOSALESIQ",
            action: "reply",
            replies: ["Please enter a valid name (at least 2 characters):"],
            input: {
              type: "name",
              placeholder: "Enter your full name",
              error: ["Name is required"],
            },
            suggestions: ["⬅️ Back to Main Menu"],
          });
        }
        session.freeTrialData.name = message.trim();
        break;

      case "email":
        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(message)) {
          return res.json({
            action: "reply",
            replies: ["Please enter a valid email address:"],
            input: {
              type: "email",
              name: "email",
              placeholder: "your.email@example.com",
              label: "Email Address",
              mandatory: true,
            },
            suggestions: ["⬅️ Back to Main Menu"],
          });
        }
        session.freeTrialData.email = message.trim();
        break;

      case "phone":
        const cleanPhone = message.replace(/\D/g, "");
        let finalPhone = cleanPhone;
        if (cleanPhone.startsWith("91") && cleanPhone.length > 10) {
          finalPhone = cleanPhone.substring(2);
        }
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(finalPhone)) {
          return res.json({
            action: "reply",
            replies: ["Please enter a valid 10-digit phone number:"],
            input: {
              type: "tel",
              name: "phone",
              placeholder: "+91 9876543210",
              label: "Phone Number",
              mandatory: true,
            },
            suggestions: ["⬅️ Back to Main Menu"],
          });
        }
        session.freeTrialData.phone = finalPhone;
        break;

      case "date & time":
        // This should have been handled by the date-timeslots input, so we shouldn't get here

        break;
    }

    // Clear the fieldToUpdate flag
    session.freeTrialData.fieldToUpdate = null;
    sessionStore.set(visitorId, session);

    // Show updated booking summary
    return showUpdatedBookingSummary(res, session, visitorId);
  }

  // Otherwise, we are selecting which field to update
  const fieldToUpdate = message.toLowerCase();

  if (["name", "email", "phone", "date & time"].includes(fieldToUpdate)) {
    session.freeTrialData.fieldToUpdate = fieldToUpdate;
    sessionStore.set(visitorId, session);

    if (fieldToUpdate === "date & time") {
      // Use date-timeslots for date/time updates
      const slots = generateTimeSlots();

      const response = {
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [`Please select your new date and time:`],
        input: {
          type: "date-timeslots",
          tz: true,
          label: "Update Date & Time",
          time_zone_id: "Asia/Calcutta",
          slots: slots,
        },
        suggestions: ["⬅️ Back to Main Menu"],
      };

      return res.json(response);
    } else {
      let prompt = "";
      let inputType = "text";
      let inputConfig = {};

      switch (fieldToUpdate) {
        case "name":
          prompt = "Please enter your new name:";
          inputType = "name";
          inputConfig = {
            type: "name",
            placeholder: "Enter your full name",
          };
          break;
        case "email":
          prompt = "Please enter your new email:";
          inputType = "email";
          inputConfig = {
            type: "email",
            name: "email",
            placeholder: "your.email@example.com",
            label: "Email Address",
            mandatory: true,
          };
          break;
        case "phone":
          prompt = "Please enter your new phone number:";
          inputType = "tel";
          inputConfig = {
            type: "tel",
            name: "phone",
            placeholder: "+91 9876543210",
            label: "Phone Number",
            mandatory: true,
          };
          break;
      }

      const response = {
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [prompt],
      };

      // Add input configuration if it's not a simple text input
      if (inputType !== "text") {
        response.input = inputConfig;
      }

      response.suggestions = ["⬅️ Back to Main Menu"];

      return res.json(response);
    }
  } else {
    const response = {
      action: "reply",
      replies: ["Please select a valid field to update:"],
      suggestions: [
        "Name",
        "Email",
        "Phone",
        "Date & Time", // Changed from separate Date and Time to combined Date & Time
        "⬅️ Back to Main Menu",
      ],
    };

    return res.json(response);
  }
}

// Handle cancel booking
async function handleCancelBooking(message, res, session, visitorId) {
  if (message === "Yes") {
    try {
      // 🎯 DELETE GOOGLE CALENDAR EVENT
      if (session.freeTrialData.calendarEventId) {
        try {
          await googleCalendarController.cancelFreeTrialEvent(
            session.freeTrialData.calendarEventId,
            session.freeTrialData.email
          );
        } catch (calendarError) {
          console.error(
            "❌ [FREE TRIAL] Failed to cancel calendar event:",
            calendarError.message
          );
          // Don't fail the entire cancellation if calendar deletion fails
        }
      }

      // Mark the booking as cancelled
      session.freeTrialData.cancelled = true;
      sessionStore.set(visitorId, session);

      // Send booking cancellation email
      sendBookingCancellationEmail(session);

      // Send cancellation confirmation message
      const response = {
        action: "reply",
        replies: [
          "Your free trial booking has been successfully cancelled. \n\n A cancellation confirmation has been sent to your registered email address.\n\nWe hope to see you again soon!",
        ],
        suggestions: ["⬅️ Back to Main Menu"],
      };

      return res.json(response);
    } catch (error) {
      console.error("🔥 [FREE TRIAL] Error in handleCancelBooking:", error);
      return res.json({
        action: "reply",
        replies: [
          "Your booking has been cancelled, but there was an error updating the calendar. Please contact support if needed.",
        ],
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }
  } else if (message === "No") {
    session.visitorStep = "free_trial_booked";
    sessionStore.set(visitorId, session);

    const response = {
      action: "reply",
      replies: [
        "Your free trial booking is still active. What would you like to do?",
      ],
      suggestions: [
        "Update Information",
        "Cancel Free Trial",
        "⬅️ Back to Main Menu",
      ],
    };

    return res.json(response);
  } else {
    const response = {
      action: "reply",
      replies: ["Please select a valid option:"],
      suggestions: ["Yes", "No", "⬅️ Back to Main Menu"],
    };

    return res.json(response);
  }
}

// New function to show updated booking summary
async function showUpdatedBookingSummary(res, session, visitorId) {
  try {
    // 🎯 UPDATE GOOGLE CALENDAR EVENT
    if (session.freeTrialData.calendarEventId) {
      try {
        await googleCalendarController.updateFreeTrialEvent(
          session.freeTrialData.calendarEventId,
          {
            name: session.freeTrialData.name,
            email: session.freeTrialData.email,
            phone: session.freeTrialData.phone,
            rawDate: session.freeTrialData.rawDate,
            time: session.freeTrialData.time,
            personalTraining: session.freeTrialData.personalTraining,
            trainer: session.freeTrialData.trainer,
            bookingId: session.freeTrialData.bookingId,
            timeZone: "Asia/Kolkata",
          }
        );
      } catch (calendarError) {
        console.error(
          "❌ [FREE TRIAL] Failed to update calendar event:",
          calendarError.message
        );
        // Don't fail the entire update if calendar update fails
      }
    }

    let summary = "Your free trial booking has been updated:\n\n";
    summary += `Name: ${session.freeTrialData.name}\n`;
    summary += `Email: ${session.freeTrialData.email}\n`;
    summary += `Phone: ${session.freeTrialData.phone}\n`;

    // Format the date for display
    if (session.freeTrialData.rawDate) {
      const [day, month, year] = session.freeTrialData.rawDate.split("/");
      const dateObj = new Date(`${year}-${month}-${day}`);
      summary += `Date: ${dateObj.toLocaleDateString()}\n`;
    } else {
      summary += `Date: ${session.freeTrialData.date}\n`;
    }

    summary += `Time: ${formatTime(session.freeTrialData.time)}\n`;

    if (
      session.freeTrialData.personalTraining &&
      session.freeTrialData.trainer
    ) {
      summary += `Personal Training: Yes\n`;
      summary += `Trainer: ${session.freeTrialData.trainer.name}\n`;

      if (session.freeTrialData.trainer.specialization) {
        summary += `Specialization: ${session.freeTrialData.trainer.specialization}\n`;
      }
      if (session.freeTrialData.trainer.experience) {
        summary += `Experience: ${session.freeTrialData.trainer.experience} years\n`;
      }
    } else {
      summary += `Personal Training: No\n`;
    }

    session.visitorStep = "free_trial_booked";
    sessionStore.set(visitorId, session);

    // Send booking update email
    sendBookingUpdateEmail(session);

    const response = {
      action: "reply",
      replies: [
        summary +
          "\n\nYour Google Calendar event has been updated.\nAn update confirmation has been sent to your registered email address.",
      ],
      suggestions: [
        "Update Information",
        "Cancel Free Trial",
        "⬅️ Back to Main Menu",
      ],
    };

    return res.json(response);
  } catch (error) {
    console.error("🔥 [FREE TRIAL] Error in showUpdatedBookingSummary:", error);
    return res.json({
      action: "reply",
      replies: [
        "Your booking information has been updated, but there was an error updating the calendar. Please contact support if needed.",
      ],
      suggestions: [
        "Update Information",
        "Cancel Free Trial",
        "⬅️ Back to Main Menu",
      ],
    });
  }
}

// Helper function to format time
function formatTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}
