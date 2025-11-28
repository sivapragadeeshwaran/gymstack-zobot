// controllers/newVisitorController.js
const sessionStore = require("../utils/sessionStore");
const Plan = require("../Models/plan");
const Trainer = require("../Models/trainer-model");
const mongoose = require("mongoose");
const aiAssistantController = require("./aiAssistantController");
const freeTrialController = require("./freeTrialController");

// Base URL for constructing absolute image paths
const BASE_URL = process.env.BASE_URL || "https://yourdomain.com"; // Replace with your actual domain

exports.handleNewVisitor = (message, res, session, visitorId) => {
  // Initialize visitor session if not already done
  if (!session.visitorStep) {
    session.visitorStep = "greeting";
    sessionStore.set(visitorId, session);
  }

  const msg = (message || "").toString().trim();

  // Handle bot URLs from carousel actions
  if (msg.startsWith("bot://")) {
    try {
      const url = new URL(msg, "http://dummy.com");
      const path = url.pathname.substring(2); // Remove the leading '/'
      const params = Object.fromEntries(url.searchParams.entries());

      switch (path) {
        case "selectPlan":
          return res.json({
            action: "reply",
            replies: [
              `You selected the ${params.plan_name} plan. Please visit our gym to complete the registration.`,
            ],
            suggestions: ["⬅️ Back to Main Menu"],
          });

        case "viewTrainer":
          return res.json({
            action: "reply",
            replies: [
              `You requested to view ${params.trainer_name}'s profile. Please visit our gym for more details.`,
            ],
            suggestions: ["⬅️ Back to Main Menu"],
          });

        case "learnProgram":
          return res.json({
            action: "reply",
            replies: [
              `You requested more information about ${params.program_name}. Please visit our gym for complete details.`,
            ],
            suggestions: ["⬅️ Back to Main Menu"],
          });

        default:
          return res.json({
            action: "reply",
            replies: [
              "I'm not sure how to handle that request. Please try again.",
            ],
            suggestions: ["⬅️ Back to Main Menu"],
          });
      }
    } catch (error) {
      console.error("Error parsing bot URL:", error);
      return res.json({
        action: "reply",
        replies: ["I'm not sure how to handle that request. Please try again."],
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }
  }

  // Handle "Back to Main Menu" at any point
  if (msg === "⬅️ Back to Main Menu") {
    session.visitorStep = "greeting";
    sessionStore.set(visitorId, session);
    return showGreeting(res, session, visitorId);
  }

  // Handle navigation
  if (session.visitorStep === "greeting") {
    // Check for both original text and text with emojis
    switch (msg) {
      case "Membership Plans":
      case "💳 Membership Plans":
        session.visitorStep = "membership_plans";
        sessionStore.set(visitorId, session);
        return showMembershipPlans(res, session, visitorId);

      case "BMI Calculator":
      case "📊 BMI Calculator":
        session.visitorStep = "bmi_calculator";
        sessionStore.set(visitorId, session);
        return handleBMICalculator(msg, res, session, visitorId);

      case "Our Trainers":
      case "🏋️‍♂️ Our Trainers":
        session.visitorStep = "trainers";
        sessionStore.set(visitorId, session);
        return showTrainers(res, session, visitorId);

      case "Training Programs":
      case "📝 Training Programs":
        session.visitorStep = "training_programs";
        sessionStore.set(visitorId, session);
        return showTrainingPrograms(res, session, visitorId);

      case "Gym Info":
      case "ℹ️ Gym Info":
        session.visitorStep = "gym_info";
        sessionStore.set(visitorId, session);
        return showGymInfo(res, session, visitorId);

      case "Contact Us":
      case "📞 Contact Us":
        session.visitorStep = "contact";
        sessionStore.set(visitorId, session);
        return handleContactForm(msg, res, session, visitorId);

      case "🤖 Talk to AI Assistant":
        session.visitorStep = "ai_assistant";
        sessionStore.set(visitorId, session);
        return handleAIAssistant(msg, res, session, visitorId);

      case "Book Free Trial":
      case "📅 Book Free Trial":
        session.visitorStep = "free_trial";
        sessionStore.set(visitorId, session);
        return freeTrialController.handleFreeTrial(
          msg,
          res,
          session,
          visitorId
        );

      default:
        return showGreeting(res, session, visitorId);
    }
  }

  // Handle feature-specific steps
  switch (session.visitorStep) {
    // BMI Calculator steps
    case "bmi_calculator":
    case "bmi_height":
    case "bmi_weight":
    case "bmi_gender":
    case "bmi_experience":
      return handleBMICalculator(msg, res, session, visitorId);

    // Contact form steps
    case "contact":
    case "contact_name":
    case "contact_email":
    case "contact_subject":
    case "contact_message":
    case "contact_confirm":
      return handleContactForm(msg, res, session, visitorId);

    // AI Assistant steps
    case "ai_assistant":
      return handleAIAssistant(msg, res, session, visitorId);

    // Free Trial steps
    case "free_trial":
    case "free_trial_name":
    case "free_trial_email":
    case "free_trial_phone":
    case "free_trial_email_otp":
    case "free_trial_datetime":
    case "free_trial_personal_training":
    case "free_trial_trainer_selection":
    case "free_trial_trainer_specialization":
    case "free_trial_confirmation":
    case "free_trial_booked":
    case "free_trial_update":
    case "free_trial_cancel":
      return freeTrialController.handleFreeTrial(msg, res, session, visitorId);

    default:
      session.visitorStep = "greeting";
      sessionStore.set(visitorId, session);
      return showGreeting(res, session, visitorId);
  }
};

// ----------------------- Greeting -----------------------
function showGreeting(res, session, visitorId) {
  const greeting =
    "👋 Welcome to Strength Zone Gym! I'm your virtual assistant. How can I help you today?";

  const payload = {
    action: "reply",
    replies: [greeting],
    suggestions: [
      "💳 Membership Plans",
      "📊 BMI Calculator",
      "🏋️‍♂️ Our Trainers",
      "📝 Training Programs",
      "ℹ️ Gym Info",
      "📞 Contact Us",
      "🤖 Talk to AI Assistant",
      "📅 Book Free Trial",
    ],
  };

  // Make sure session step is greeting
  session.visitorStep = "greeting";
  sessionStore.set(visitorId, session);

  return res.json(payload);
}

// ----------------------- Membership Plans -----------------------
async function showMembershipPlans(res, session, visitorId) {
  try {
    // Fetch all membership plans
    const plans = await Plan.find();

    if (plans.length === 0) {
      return res.json({
        action: "reply",
        replies: ["Sorry, no membership plans are available at the moment."],
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }

    // Create carousel items
    const carouselItems = plans.map((plan) => {
      // Default facilities that must appear under every plan
      const defaultFacilities = [
        "Unlimited gym access",
        "Locker rooms & changing area",
        "Free Wi-Fi access",
      ];

      // Combine default facilities with plan-specific facilities
      const allFacilities = [...defaultFacilities, ...(plan.facilities || [])];

      // Handle image URL
      let imageUrl =
        "https://www.shutterstock.com/image-vector/gym-membership-card-access-fitness-260nw-2612436473.jpg";

      if (plan.image && plan.image.trim() !== "") {
        if (
          plan.image.startsWith("http://") ||
          plan.image.startsWith("https://")
        ) {
          imageUrl = plan.image.trim();
        } else {
          // Convert relative path to absolute URL
          imageUrl = `${BASE_URL}${
            plan.image.startsWith("/") ? "" : "/"
          }${plan.image.trim()}`;
        }
      }

      return {
        title: plan.name,
        subtitle: `Duration: ${plan.period} | Price: ${
          plan.price
        } INR | Facilities: ${allFacilities.join(", ")}`,
        id: plan._id.toString(),
        image: imageUrl,
        actions: [
          {
            type: "url",
            link: ``,
          },
        ],
      };
    });

    const payload = {
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        {
          type: "multiple-product",
          text: "Here are our membership plans:",
          elements: carouselItems,
        },
      ],
      suggestions: ["⬅️ Back to Main Menu"],
    };

    // Reset session to greeting
    session.visitorStep = "greeting";
    sessionStore.set(visitorId, session);

    return res.json(payload);
  } catch (error) {
    console.error("🔥 [NEW VISITOR] Error fetching membership plans:", error);
    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error retrieving membership plans. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Main Menu"],
    });
  }
}

// ----------------------- BMI Calculator -----------------------
async function handleBMICalculator(message, res, session, visitorId) {
  try {
    // Handle "Back to Main Menu" at any point
    if (message === "⬅️ Back to Main Menu") {
      session.visitorStep = "greeting";
      sessionStore.set(visitorId, session);
      return showGreeting(res, session, visitorId);
    }

    // Handle height input
    if (session.visitorStep === "bmi_calculator") {
      session.visitorStep = "bmi_height";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: ["Please enter your height in centimeters:"],
      });
    }

    // Handle height input
    if (session.visitorStep === "bmi_height") {
      // Validate height
      if (
        !/^\d+$/.test(message) ||
        parseInt(message) < 50 ||
        parseInt(message) > 250
      ) {
        return res.json({
          action: "reply",
          replies: [
            "Please enter a valid height between 50 and 250 centimeters:",
          ],
        });
      }

      // Store height and move to weight input
      session.height = parseInt(message);
      session.visitorStep = "bmi_weight";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: ["Please enter your weight in kilograms:"],
      });
    }

    // Handle weight input
    if (session.visitorStep === "bmi_weight") {
      // Validate weight
      if (
        !/^\d+(\.\d+)?$/.test(message) ||
        parseFloat(message) < 20 ||
        parseFloat(message) > 300
      ) {
        return res.json({
          action: "reply",
          replies: [
            "Please enter a valid weight between 20 and 300 kilograms:",
          ],
        });
      }

      // Store weight and move to gender input
      session.weight = parseFloat(message);
      session.visitorStep = "bmi_gender";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: ["Please select your gender:"],
        suggestions: ["Male", "Female", "⬅️ Back to Main Menu"],
      });
    }

    // Handle gender input
    if (session.visitorStep === "bmi_gender") {
      if (!["Male", "Female"].includes(message)) {
        return res.json({
          action: "reply",
          replies: ["Please select a valid gender:"],
          suggestions: ["Male", "Female", "⬅️ Back to Main Menu"],
        });
      }

      // Get height and weight from session
      const heightCm = session.height;
      const weightKg = session.weight;
      const gender = message;

      // Convert height to meters
      const heightM = heightCm / 100;

      // Calculate BMI
      const bmi = weightKg / (heightM * heightM);

      // Determine BMI category
      let category = "";
      if (bmi < 18.5) {
        category = "Underweight";
      } else if (bmi >= 18.5 && bmi <= 24.9) {
        category = "Normal";
      } else if (bmi >= 25 && bmi <= 29.9) {
        category = "Overweight";
      } else {
        category = "Obese";
      }

      // Store BMI data and ask about training program
      session.bmi = bmi;
      session.bmiCategory = category;
      session.gender = gender;
      session.visitorStep = "bmi_experience";
      sessionStore.set(visitorId, session);

      // Prepare response
      let response = `📊 BMI CALCULATOR RESULTS\n\n`;
      response += `Height: ${heightCm} cm\n`;
      response += `Weight: ${weightKg} kg\n`;
      response += `Gender: ${gender}\n`;
      response += `BMI Value: ${bmi.toFixed(1)}\n`;
      response += `Category: ${category}\n\n`;
      response += `Would you like a personalized training program?`;

      return res.json({
        action: "reply",
        replies: [response],
        suggestions: ["Yes", "No", "⬅️ Back to Main Menu"],
      });
    }

    // Handle training program request
    if (session.visitorStep === "bmi_experience") {
      if (message === "No") {
        // Reset session to greeting
        session.visitorStep = "greeting";
        sessionStore.set(visitorId, session);
        return showGreeting(res, session, visitorId);
      }

      if (message === "Yes") {
        session.visitorStep = "bmi_experience";
        sessionStore.set(visitorId, session);

        return res.json({
          action: "reply",
          replies: ["What is your workout experience level?"],
          suggestions: [
            "Beginner",
            "Intermediate",
            "Advanced",
            "⬅️ Back to Main Menu",
          ],
        });
      }

      // Handle experience level selection
      if (["Beginner", "Intermediate", "Advanced"].includes(message)) {
        const experience = message;
        const bmiCategory = session.bmiCategory;

        // Recommend training program based on experience
        let recommendedPrograms = [];

        if (experience === "Advanced") {
          recommendedPrograms = [
            {
              name: "Power Lifting",
              description:
                "Focus on building maximum strength through compound lifts like squats, deadlifts, and bench presses. Ideal for those looking to compete or increase raw strength.",
              image:
                "https://sfhealthtech.com/cdn/shop/articles/A_Comprehensive_Guide_to_Powerlifting.jpg?v=1715158133",
            },
            {
              name: "Crossfit",
              description:
                "High-intensity functional movements combining cardio, weightlifting, and bodyweight exercises. Great for overall fitness and endurance.",
              image:
                "https://hips.hearstapps.com/hmg-prod/images/cross-fit-1518811942.jpg?resize=640:*",
            },
          ];
        } else if (experience === "Intermediate") {
          recommendedPrograms = [
            {
              name: "Weight Training",
              description:
                "Structured resistance training to build muscle mass and strength. Includes both free weights and machine exercises.",
              image:
                "https://cdn.muscleandstrength.com/sites/default/files/field/image/workout/fit-man-dumbbell-workout-400.jpg",
            },
            {
              name: "Crossfit",
              description:
                "High-intensity functional movements combining cardio, weightlifting, and bodyweight exercises. Great for overall fitness and endurance.",
              image:
                "https://hips.hearstapps.com/hmg-prod/images/cross-fit-1518811942.jpg?resize=640:*",
            },
          ];
        } else {
          recommendedPrograms = [
            {
              name: "Weight Training",
              description:
                "Structured resistance training to build muscle mass and strength. Includes both free weights and machine exercises.",
              image:
                "https://cdn.muscleandstrength.com/sites/default/files/field/image/workout/fit-man-dumbbell-workout-400.jpg",
            },
            {
              name: "Calisthenics",
              description:
                "Bodyweight training focusing on strength, flexibility, and endurance. Perfect for building functional strength without equipment.",
              image:
                "https://cdn.shopify.com/s/files/1/2513/1876/files/startwiththebasic-beginner-guide.jpg?v=1715766321",
            },
          ];
        }

        // Create image widgets for each recommended program
        const programWidgets = recommendedPrograms.map((program) => ({
          text: `${program.name}\n\n${program.description}`,
          image: program.image,
          image_position: "fit",
        }));

        // Add introductory text
        const introText = `Based on your experience level (${experience}) and BMI category (${bmiCategory}), we recommend these programs:`;

        session.recommendedPrograms = recommendedPrograms.map((p) => p.name);
        session.visitorStep = "greeting";
        sessionStore.set(visitorId, session);

        return res.json({
          action: "reply",
          replies: [introText, ...programWidgets],
          suggestions: ["⬅️ Back to Main Menu"],
        });
      }

      // Invalid option
      return res.json({
        action: "reply",
        replies: ["Please select a valid experience level:"],
        suggestions: [
          "Beginner",
          "Intermediate",
          "Advanced",
          "⬅️ Back to Main Menu",
        ],
      });
    }
  } catch (error) {
    console.error("🔥 [NEW VISITOR] Error in BMI calculator:", error);
    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error calculating your BMI. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Main Menu"],
    });
  }
}

// ----------------------- Trainers -----------------------
async function showTrainers(res, session, visitorId) {
  console.log("🔥 [NEW VISITOR] Showing trainers");

  try {
    // Fetch all trainers
    const trainers = await Trainer.find();

    if (trainers.length === 0) {
      return res.json({
        action: "reply",
        replies: ["Sorry, no trainers are available at the moment."],
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }

    // Log trainers without profile pictures
    const trainersWithoutPics = trainers.filter(
      (trainer) => !trainer.profilePic || trainer.profilePic.trim() === ""
    );

    if (trainersWithoutPics.length > 0) {
      console.log(
        "⚠️ [NEW VISITOR] Trainers without profile pictures:",
        trainersWithoutPics.map((t) => t.name).join(", ")
      );
    }

    // Create carousel items
    const carouselItems = trainers.map((trainer) => {
      // FIXED: Improved image handling logic
      let imageUrl =
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1170&q=80"; // Default trainer image

      if (trainer.profilePic && trainer.profilePic.trim() !== "") {
        // If profilePic is a full URL, use it directly
        if (
          trainer.profilePic.startsWith("http://") ||
          trainer.profilePic.startsWith("https://")
        ) {
          imageUrl = trainer.profilePic.trim();
        }
        // If profilePic is a relative path, convert to absolute URL
        else {
          imageUrl = `${BASE_URL}${
            trainer.profilePic.startsWith("/") ? "" : "/"
          }${trainer.profilePic.trim()}`;
        }
      } else {
        // Log that this trainer is using the default image
        console.log(
          `⚠️ [NEW VISITOR] Trainer ${trainer.name} is using default image`
        );
      }

      return {
        title: trainer.name,
        subtitle: `Experience: ${trainer.experience} years | Specialization: ${trainer.specialization}`,
        id: trainer._id.toString(),
        image: imageUrl,
        actions: [
          {
            type: "url",
            link: ``,
          },
        ],
      };
    });

    const payload = {
      platform: "ZOHOSALESIQ",
      action: "reply",
      replies: [
        {
          type: "multiple-product",
          text: "Meet our expert trainers:",
          elements: carouselItems,
        },
      ],
      suggestions: ["⬅️ Back to Main Menu"],
    };

    // Reset session to greeting
    session.visitorStep = "greeting";
    sessionStore.set(visitorId, session);

    return res.json(payload);
  } catch (error) {
    console.error("🔥 [NEW VISITOR] Error fetching trainers:", error);
    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error retrieving trainer information. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Main Menu"],
    });
  }
}

// ----------------------- Training Programs -----------------------
function showTrainingPrograms(res, session, visitorId) {
  // Define training programs with descriptions
  const programs = [
    {
      name: "Power Lifting",
      description:
        "Focus on building maximum strength through compound lifts like squats, deadlifts, and bench presses. Ideal for those looking to compete or increase raw strength.",
      image:
        "https://sfhealthtech.com/cdn/shop/articles/A_Comprehensive_Guide_to_Powerlifting.jpg?v=1715158133",
      link: "https://www.specialolympicsma.org/blog/stories/unlocking-your-strength-health-benefits-of-powerlifting",
    },
    {
      name: "Crossfit",
      description:
        "High-intensity functional movements combining cardio, weightlifting, and bodyweight exercises. Great for overall fitness and endurance.",
      image:
        "https://hips.hearstapps.com/hmg-prod/images/cross-fit-1518811942.jpg?resize=640:*",
      link: "https://www.healthline.com/health/exercise-fitness/crossfit-benefits",
    },
    {
      name: "Calisthenics",
      description:
        "Bodyweight training focusing on strength, flexibility, and endurance. Perfect for building functional strength without equipment.",
      image:
        "https://cdn.shopify.com/s/files/1/2513/1876/files/startwiththebasic-beginner-guide.jpg?v=1715766321",
      link: "https://www.medicalnewstoday.com/articles/calisthenics",
    },
    {
      name: "Weight Training",
      description:
        "Structured resistance training to build muscle mass and strength. Includes both free weights and machine exercises.",
      image:
        "https://cdn.muscleandstrength.com/sites/default/files/field/image/workout/fit-man-dumbbell-workout-400.jpg",
      link: "https://www.health.harvard.edu/topics/exercise-and-fitness",
    },
  ];

  // Create carousel items
  const carouselItems = programs.map((program) => {
    return {
      title: program.name,
      subtitle: program.description,
      id: program.name.replace(/\s+/g, "_").toLowerCase(),
      image: program.image,
      actions: [
        {
          label: "Learn More",
          type: "url",
          link: `${program.link}`,
        },
      ],
    };
  });

  const payload = {
    platform: "ZOHOSALESIQ",
    action: "reply",
    replies: [
      {
        type: "multiple-product",
        text: "Explore our training programs:",
        elements: carouselItems,
      },
    ],
    suggestions: ["⬅️ Back to Main Menu"],
  };

  // Reset session to greeting
  session.visitorStep = "greeting";
  sessionStore.set(visitorId, session);

  return res.json(payload);
}

// ----------------------- Gym Info -----------------------
function showGymInfo(res, session, visitorId) {
  // Gym timings
  const timings =
    `🕒 GYM TIMINGS\n\n` +
    `Monday to Saturday: 5:00 AM to 10:30 PM\n` +
    `Sunday: 6:00 AM to 5:00 PM`;

  // Facilities
  const facilities =
    `🏋️ FACILITIES\n\n` +
    `• Unlimited gym access\n` +
    `• Locker rooms & changing area\n` +
    `• Free Wi-Fi access\n` +
    `• Personal trainer availability\n` +
    `• Diet consultation support`;

  const payload = {
    action: "reply",
    replies: [timings, facilities],
    suggestions: ["⬅️ Back to Main Menu"],
  };

  // Reset session to greeting
  session.visitorStep = "greeting";
  sessionStore.set(visitorId, session);

  return res.json(payload);
}

// ----------------------- Contact Form -----------------------
async function handleContactForm(message, res, session, visitorId) {
  try {
    // Handle "Back to Main Menu" at any point
    if (message === "⬅️ Back to Main Menu") {
      session.visitorStep = "greeting";
      sessionStore.set(visitorId, session);
      return showGreeting(res, session, visitorId);
    }

    // Display contact form options and immediately ask for name
    if (session.visitorStep === "contact") {
      session.visitorStep = "contact_name";
      sessionStore.set(visitorId, session);

      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: [
          "📞 CONTACT US\n\n" +
            "You can reach us at: +91 9876543210\n\n" +
            "Or fill out the contact form below:\n\n" +
            "Let us know your name.",
        ],
        input: {
          type: "name",
          placeholder: "Enter your name",
          value: "",
          error: ["Enter name as per govt issued id"],
        },
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }

    // Handle name input
    if (session.visitorStep === "contact_name") {
      // If this is the first time entering this step (message is "Contact Us")
      if (message === "Contact Us" || message === "📞 Contact Us") {
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: ["Great! May I know your name?"],
          input: {
            type: "name",
            placeholder: "Enter your name",
            value: "",
            error: ["Enter name as per govt issued id"],
          },
          suggestions: ["⬅️ Back to Main Menu"],
        });
      }

      if (!message || message.trim() === "") {
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: ["Please enter your name:"],
          input: {
            type: "name",
            placeholder: "Enter your name",
            value: "",
            error: ["Enter name as per govt issued id"],
          },
          suggestions: ["⬅️ Back to Main Menu"],
        });
      }

      session.contactName = message;
      session.visitorStep = "contact_email";
      sessionStore.set(visitorId, session);

      return res.json({
        platform: "ZOHOSALESIQ",
        action: "reply",
        replies: ["And your email address?"],
        input: {
          type: "email",
          placeholder: "Enter the email address",
          value: "",
          error: ["Enter a valid email address"],
        },
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }

    // Handle email input
    if (session.visitorStep === "contact_email") {
      // Simple email validation
      const emailRegex = /\S+@\S+\.\S+/;
      if (!emailRegex.test(message)) {
        return res.json({
          platform: "ZOHOSALESIQ",
          action: "reply",
          replies: ["Please enter a valid email address:"],
          input: {
            type: "email",
            placeholder: "Enter the email address",
            value: "",
            error: ["Enter a valid email address"],
          },
          suggestions: ["⬅️ Back to Main Menu"],
        });
      }

      session.contactEmail = message;
      session.visitorStep = "contact_subject";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: ["Please enter the subject of your message:"],
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }

    // Handle subject input
    if (session.visitorStep === "contact_subject") {
      if (!message || message.trim() === "") {
        return res.json({
          action: "reply",
          replies: ["Please enter the subject:"],
          suggestions: ["⬅️ Back to Main Menu"],
        });
      }

      session.contactSubject = message;
      session.visitorStep = "contact_message";
      sessionStore.set(visitorId, session);

      return res.json({
        action: "reply",
        replies: ["Please enter your message:"],
        suggestions: ["⬅️ Back to Main Menu"],
      });
    }

    // Handle message input
    if (session.visitorStep === "contact_message") {
      if (!message || message.trim() === "") {
        return res.json({
          action: "reply",
          replies: ["Please enter your message:"],
          suggestions: ["⬅️ Back to Main Menu"],
        });
      }

      session.contactMessage = message;
      session.visitorStep = "contact_confirm";
      sessionStore.set(visitorId, session);

      // Show confirmation
      let response = `Please confirm your contact details:\n\n`;
      response += `Name: ${session.contactName}\n`;
      response += `Email: ${session.contactEmail}\n`;
      response += `Subject: ${session.contactSubject}\n`;
      response += `Message: ${session.contactMessage}\n\n`;
      response += `Is this correct?`;

      return res.json({
        action: "reply",
        replies: [response],
        suggestions: ["Yes", "No", "⬅️ Back to Main Menu"],
      });
    }

    // Handle confirmation
    if (session.visitorStep === "contact_confirm") {
      if (message === "Yes") {
        // In a real implementation, you would send an email here
        // For now, we'll just show a success message

        // Reset session to greeting
        session.visitorStep = "greeting";
        sessionStore.set(visitorId, session);

        return res.json({
          action: "reply",
          replies: [
            "✅ Thank you for contacting us! We have received your message and will get back to you soon.\n\n" +
              "You can also call us directly at: +91 9876543210",
          ],
          suggestions: ["⬅️ Back to Main Menu"],
        });
      } else if (message === "No") {
        // Go back to name input
        session.visitorStep = "contact_name";
        sessionStore.set(visitorId, session);
        return handleContactForm("", res, session, visitorId);
      } else {
        return res.json({
          action: "reply",
          replies: ["Please select a valid option: Yes or No"],
          suggestions: ["Yes", "No", "⬅️ Back to Main Menu"],
        });
      }
    }
  } catch (error) {
    console.error("🔥 [NEW VISITOR] Error in contact form:", error);
    return res.json({
      action: "reply",
      replies: [
        "Sorry, there was an error processing your request. Please try again later.",
      ],
      suggestions: ["⬅️ Back to Main Menu"],
    });
  }
}

// ----------------------- AI Assistant -----------------------
function handleAIAssistant(message, res, session, visitorId) {
  // Delegate to the AI assistant controller
  return aiAssistantController.handleAIAssistant(
    message,
    res,
    session,
    visitorId
  );
}
