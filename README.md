# Gym Management System with AI Chatbot

A comprehensive gym management system featuring an intelligent AI chatbot for automated fitness support.

## 🎯 Overview

This innovative gym management solution integrates an AI-powered chatbot (Zobot) using SalesIQ webhook that intelligently adapts to four distinct user roles: Admin, Trainer, Existing Member, and New Visitor. The chatbot leverages live gym database details to provide real-time, contextually relevant responses. By automating fitness consultations, streamlining free trial bookings via Google Calendar, integrating seamless payment processing through Razorpay, and delivering real-time revenue analytics and trainer utilization insights, the system dramatically reduces manual administrative work. The AI chatbot serves as a 24/7 fitness expert, answering personalized workout and nutrition questions while seamlessly supporting operational efficiency—making gym management smarter, faster, and more engaging.

## 👥 User Roles & Testing

### Test Credentials

| Role | Email ID |
|------|----------|
| **Admin** | zohoadmin@gmail.com |
| **Trainer** | zohotrainer@gmail.com |
| **Existing Member** | zohomember@gmail.com / santhi@gmail.com |
| **New Visitor** | Any email ID |

> **Note:** To switch between roles during testing, type `reset` in the chatbot message box.

## ✨ Features by Role

### 🔐 Admin Features

**Member & Staff Management**
- Add and manage members, trainers, and administrators
- Create and customize membership plans
- Track expired and expiring memberships with automated email notifications

**Comprehensive Reports**
- **Membership Analytics**
  - Total member count
  - New members this month
  - Active vs expired members
  - Membership plan distribution
  
- **Financial Reports**
  - Current month revenue
  - Previous month comparison
  - Profit analysis
  - 6-month revenue trends
  - Plan-wise revenue breakdown
  - Automated revenue calculation and display
  
- **Trainer Utilization**
  - Total number of trainers
  - Members assigned per trainer
  - Workload distribution

### 💪 Trainer Features

- View complete list of assigned members
- Update professional profile (experience, specialization, certifications)
- Add and manage weekly class schedules
- **Talk to AI** - Click the "Talk to AI" button to interact with AI Assistant for fitness and diet support

### 🆕 New Visitor Features

- Browse membership plans and pricing
- View trainer profiles and specializations
- Explore gym programs and facilities
- **BMI Calculator** with personalized health suggestions
- Access gym information and amenities
- **Contact Form** (sends email to admin with confirmation to user)
- **Talk to AI** - Click the "Talk to AI" button for fitness and diet support
- **Book Free Trial** with:
  - Google Calendar integration
  - Email confirmations
  - Ability to update or cancel bookings

### 🏋️ Existing Member Features

- View membership status (active/expired)
- Renew membership with:
  - Available plans display
  - Integrated payment processing
- Access today's and weekly class schedules
- Update personal profile information
- **BMI calculator** with fitness recommendations
- **Talk to AI** - Click the "Talk to AI" button for 24/7 fitness and diet support

## 🤖 AI Chatbot Features

The AI chatbot is accessible through the **"Talk to AI"** button available for Trainers, Existing Members, and New Visitors. The chatbot uses **live gym database details** and **answers only fitness-related questions**, providing:

- Personalized workout routines and exercise recommendations
- Exercise form and technique guidance
- Workout programming advice
- Training methodology support
- Fitness assessment recommendations
- Exercise alternatives and modifications
- Nutrition and diet advice
- Diet and nutrition tips
- Fitness goal planning and setting advice
- General gym and fitness information
- Beginner workout guidance
- Exercise explanations and benefits
- General fitness and health questions

## 🛠️ Tech Stack

**AI & Chatbot**
- SalesIQ Webhook (Zobot)
- Groq AI Model (OpenAI GPT-OSS-20B)
- Live Gym Database Integration

**Payment Integration**
- Razorpay

**Security**
- OAuth 2.0 (AI integration authentication)

## 🚀 Chatbot Benefits

- **⚡ Fast Automated Responses** - Instant answers to fitness and diet-related queries
- **🕐 24/7 Availability** - Round-the-clock fitness support without human intervention
- **📉 Reduced Manual Support** - AI handles routine fitness inquiries automatically, reducing manual work in gyms
- **📈 Increased Engagement** - Interactive chatbot enhances member experience
- **🎯 Personalized Guidance** - Tailored fitness and diet advice based on user queries and roles
- **💪 Expert Knowledge** - AI-powered responses based on fitness best practices
- **🔄 Consistent Support** - Reliable and accurate fitness information anytime
- **⚙️ Operational Efficiency** - Frees up staff time by automating common fitness questions
- **📊 Real-Time Data Access** - Uses live gym database for contextually accurate responses
- **📧 Automated Membership Reminders** - Sends membership renewal reminders through email automatically
- **💼 Admin Dashboard Automation** - Displays comprehensive revenue reports, member analytics, and trainer utilization data to admin, eliminating manual calculation and reporting work

## 📋 Installation

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Configure your environment variables:
# - Zobot webhook URL
# - Groq AI API key (OAuth 2.0)
# - Database connection string
# - Razorpay API keys

# Start the development server
npm run dev
```

## ⚙️ Configuration

1. **Chatbot Integration**: Configure SalesIQ webhook and Zobot settings with OAuth 2.0
2. **AI Model**: Add Groq AI API key with OAuth 2.0 authentication for fitness queries
3. **Database Connection**: Set up live gym database connection for real-time data access
4. **Payment Gateway**: Configure Razorpay API keys for payment processing
5. **Role-Based Access**: Set up user roles for personalized chatbot interactions

## 📝 Usage

1. Access the gym website through your web browser
2. Login with the appropriate role (Trainer, Existing Member, or New Visitor)
3. Click the **"Talk to AI"** button to open the AI assistant
4. Ask any **fitness or diet-related questions**
5. Receive instant AI-powered responses tailored to your role using live gym data
6. Type `reset` in the chatbot to switch testing roles (for testing purposes)

---

**Built with ❤️ for fitness enthusiasts**
