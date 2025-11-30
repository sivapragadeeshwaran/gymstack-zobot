// controllers/aiAssistantController.js
const axios = require("axios");

const sessionStore = require("../utils/sessionStore");

// OAuth Token Generator
async function getOAuthToken() {
  try {
    // Check if we have a real OAuth URL configured
    const oauthUrl = process.env.OAUTH_URL || "https://oauth.example.com/token";

    // If we're using the example URL (for testing/development), return a mock token
    if (oauthUrl === "https://oauth.example.com/token") {
      return "mock-oauth-token-for-development";
    }

    // Otherwise, make a real OAuth request
    const res = await axios.post(oauthUrl, {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: "client_credentials",
    });

    return res.data.access_token;
  } catch (error) {
    console.error("OAuth Token Error:", error);

    // For development purposes, return a mock token if OAuth fails
    if (process.env.NODE_ENV === "development") {
      return "fallback-mock-oauth-token";
    }

    throw new Error("Failed to get OAuth token");
  }
}

// Call Groq AI using OAuth token
async function callGroqAI(userMessage) {
  try {
    // First get OAuth 2.0 token
    const token = await getOAuthToken();

    // Check for polite messages first
    const lowerMessage = userMessage.toLowerCase();
    const politePhrases = [
      "thank you",
      "thanks",
      "sorry",
      "welcome",
      "hi",
      "hello",
      "good morning",
      "good afternoon",
      "good evening",
    ];

    if (politePhrases.some((phrase) => lowerMessage.includes(phrase))) {
      // Return a polite response for greetings and thanks
      if (lowerMessage.includes("thank") || lowerMessage.includes("thanks")) {
        return "You're very welcome! 😊 I'm happy to help with any fitness questions you have. What else would you like to know about workouts, nutrition, or exercises?";
      } else if (lowerMessage.includes("sorry")) {
        return "No need to apologize! 😊 I'm here to help. Feel free to ask me anything about fitness, workouts, or nutrition.";
      } else if (lowerMessage.includes("welcome")) {
        return "Thank you! 😊 I'm excited to help you on your fitness journey. What would you like to know today?";
      } else if (
        lowerMessage.includes("hello") ||
        lowerMessage.includes("hi")
      ) {
        return "Hello there! 👋 I'm your AI fitness assistant. How can I help you with your fitness goals today?";
      } else {
        return "Good to see you! 😊 I'm here to help with all your fitness questions. What would you like to know?";
      }
    }

    // Now call Groq API with the updated model
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "openai/gpt-oss-20b", // Updated to use the supported model
        messages: [
          {
            role: "system",
            content:
              "You are a professional fitness assistant for a gym. You ONLY answer fitness-related questions about workouts, nutrition, exercise techniques, and general fitness advice. If the user asks anything not related to fitness, respond with: 'I'm sorry, I can only help with fitness-related questions. Please ask me something about workouts, nutrition, exercises, or fitness tips.' Keep responses concise but informative. Use emojis occasionally to make the conversation friendly and engaging.",
          },
          { role: "user", content: userMessage },
        ],
        temperature: 1,
        max_completion_tokens: 8192, // Updated parameter name
        top_p: 1,
        reasoning_effort: "medium", // Added parameter from playground example
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "X-OAUTH-TOKEN": token, // Competition requirement
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Groq AI Error:", error);

    // Log more details about the error
    if (error.response) {
      console.error("Error Response Data:", error.response.data);
      console.error("Error Response Status:", error.response.status);
    }

    // For development purposes, return a mock response if Groq API fails
    if (process.env.NODE_ENV === "development") {
      // Check if the message is fitness-related
      const lowerMessage = userMessage.toLowerCase();
      const fitnessKeywords = [
        "workout",
        "exercise",
        "fitness",
        "gym",
        "nutrition",
        "diet",
        "protein",
        "muscle",
        "weight",
        "fat",
        "cardio",
        "strength",
        "training",
        "health",
        "bodybuilding",
        "running",
        "yoga",
        "pilates",
        "stretching",
        "lifting",
        "squat",
        "bench",
        "deadlift",
        "bmi",
        "calorie",
        "supplement",
      ];

      const isFitnessRelated = fitnessKeywords.some((keyword) =>
        lowerMessage.includes(keyword)
      );

      if (!isFitnessRelated) {
        return "I'm sorry, I can only help with fitness-related questions. Please ask me something about workouts, nutrition, exercises, or fitness tips. 😊";
      }

      // Check for polite messages
      const politePhrases = [
        "thank you",
        "thanks",
        "sorry",
        "welcome",
        "hi",
        "hello",
        "good morning",
        "good afternoon",
        "good evening",
      ];

      if (politePhrases.some((phrase) => lowerMessage.includes(phrase))) {
        if (lowerMessage.includes("thank") || lowerMessage.includes("thanks")) {
          return "You're very welcome! 😊 I'm happy to help with any fitness questions you have. What else would you like to know about workouts, nutrition, or exercises?";
        } else if (lowerMessage.includes("sorry")) {
          return "No need to apologize! 😊 I'm here to help. Feel free to ask me anything about fitness, workouts, or nutrition.";
        } else if (lowerMessage.includes("welcome")) {
          return "Thank you! 😊 I'm excited to help you on your fitness journey. What would you like to know today?";
        } else if (
          lowerMessage.includes("hello") ||
          lowerMessage.includes("hi")
        ) {
          return "Hello there! 👋 I'm your AI fitness assistant. How can I help you with your fitness goals today?";
        } else {
          return "Good to see you! 😊 I'm here to help with all your fitness questions. What would you like to know?";
        }
      }

      // Simple rule-based responses for common fitness questions
      if (
        lowerMessage.includes("workout plan") ||
        lowerMessage.includes("workout")
      ) {
        return "Here's a basic workout plan for beginners: 💪\n\n• Monday: Chest & Triceps\n• Tuesday: Back & Biceps\n• Wednesday: Rest or Cardio\n• Thursday: Legs & Shoulders\n• Friday: Core & Cardio\n• Saturday: Full Body\n• Sunday: Rest\n\nRemember to start with light weights and focus on proper form. Consult with a trainer before starting any new exercise program. 🏋️‍♂️";
      }

      if (
        lowerMessage.includes("nutrition") ||
        lowerMessage.includes("diet") ||
        lowerMessage.includes("protein")
      ) {
        return "For optimal fitness results, focus on these nutrition principles: 🥗\n\n• Eat protein with every meal (chicken, fish, eggs, legumes)\n• Include vegetables in at least 2 meals daily\n• Drink 2-3 liters of water per day 💧\n• Limit processed foods and added sugars\n• Choose whole grains over refined grains\n• Time your meals around your workouts (eat protein within 2 hours after training)\n\nA general guideline is to consume about 1.6-2.2g of protein per kg of body weight daily. 🍗";
      }

      if (
        lowerMessage.includes("exercise") ||
        lowerMessage.includes("form") ||
        lowerMessage.includes("technique")
      ) {
        return "Proper exercise form is crucial to prevent injury and maximize results: 🧘‍♂️\n\n• Always warm up before exercising\n• Start with lighter weights to perfect your form\n• Focus on the muscle you're targeting\n• Use a full range of motion\n• Don't use momentum to lift weights\n• Breathe out during exertion and in during relaxation\n• If you're unsure, ask a trainer to demonstrate\n\nWhich specific exercise would you like form tips for? 🤔";
      }

      if (
        lowerMessage.includes("bmi") ||
        lowerMessage.includes("weight") ||
        lowerMessage.includes("fat")
      ) {
        return "BMI (Body Mass Index) is a measure of body fat based on height and weight. A healthy BMI range is typically 18.5-24.9. However, BMI doesn't account for muscle mass, so athletes may have a higher BMI but still be healthy. For a more accurate assessment, consider body fat percentage, waist circumference, and overall fitness level. 📊";
      }

      return "As a fitness assistant, I'm here to help with your workout and nutrition questions. I can provide information on exercise routines, proper form, nutrition guidelines, and general fitness advice. What specific aspect of fitness would you like to know more about? 🤔";
    }

    throw new Error("Failed to get AI response");
  }
}

// Main AI Assistant Handler
exports.handleAIAssistant = async (message, res, session, sessionId) => {
  // Determine the context (new visitor or member) based on session properties
  const isNewVisitor = session.visitorStep !== undefined;
  const backButton = isNewVisitor
    ? "⬅️ Back to Main Menu"
    : "⬅️ Back to Dashboard";

  // Handle back button clicks
  if (message === backButton) {
    if (isNewVisitor) {
      // For new visitors, go back to the main greeting
      session.visitorStep = "greeting";
      sessionStore.set(sessionId, session);

      const greeting =
        "👋 Welcome to Strength Zone Gym! I'm your virtual assistant. How can I help you today?";

      const payload = {
        action: "reply",
        replies: [greeting],
        suggestions: [
          "Membership Plans",
          "BMI Calculator",
          "Our Trainers",
          "Training Programs",
          "Gym Info",
          "Contact Us",
          "🤖 Talk to AI Assistant",
        ],
      };

      return res.json(payload);
    } else {
      // For members, go back to the member dashboard
      session.memberStep = "dashboard";
      sessionStore.set(sessionId, session);
      return showMemberDashboard(res, session, sessionId);
    }
  }

  // Handle initial AI Assistant greeting
  if (message === "🤖 Talk to AI Assistant" || !message) {
    // Create image widget for the welcome message
    const imageWidget = {
      text: "Hi! I'm your AI Fitness Assistant. 😊\n\nI can help you with workout plans, nutrition advice, exercise demonstrations, and general fitness tips.\n\nYou can ask me anything related to fitness! 💪",
      image:
        "https://easy-peasy.ai/cdn-cgi/image/quality=70,format=auto,width=500/https://media.easy-peasy.ai/27feb2bb-aeb4-4a83-9fb6-8f3f2a15885e/77de380e-5718-4dc0-848c-2345cc3cb082.png",
      image_position: "fit",
    };

    return res.json({
      action: "reply",
      replies: [imageWidget], // Only the image widget with the text
      suggestions: [backButton], // Show the appropriate back button
    });
  }

  try {
    // Get AI response from Groq
    const aiResponse = await callGroqAI(message);

    // Format the response
    const formattedResponse = `🤖 AI Assistant\n\n${aiResponse}`;

    return res.json({
      action: "reply",
      replies: [formattedResponse],
      suggestions: [backButton], // Show the appropriate back button
    });
  } catch (error) {
    console.error("🤖 [AI] Error:", error);

    // Fallback response
    return res.json({
      action: "reply",
      replies: [
        "🤖 AI Assistant\n\nI'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again later or ask one of our trainers for assistance. 😊",
      ],
      suggestions: [backButton], // Show the appropriate back button
    });
  }
};

// Dashboard function (needed for navigation)
function showMemberDashboard(res, session, sessionId) {
  const greeting = `👋 Welcome ${
    session.username || "Member"
  }! How can I assist you today?`;

  const payload = {
    action: "reply",
    replies: [greeting],
    suggestions: [
      "Membership Status",
      "Renew Membership",
      "Show Today's / Weekly Class",
      "Update Profile",
      "BMI Calculator",
      "Talk to AI Assistant",
    ],
  };

  // Make sure session step is dashboard
  session.memberStep = "dashboard";
  sessionStore.set(sessionId, session);

  return res.json(payload);
}
