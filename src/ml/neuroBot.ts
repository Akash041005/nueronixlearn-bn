import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import WeakTopic from '../models/WeakTopic';
import User from '../models/User';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export interface ChatContext {
  userId: string;
  userProfile: {
    name: string;
    weakAreas: string[];
  };
}

// ===============================
// MAIN CHAT FUNCTION (HYBRID)
// ===============================
export async function generateChatResponse(
  message: string,
  context: ChatContext
): Promise<{ response: string; detectedWeakTopic?: string }> {

  const lowerMsg = message.toLowerCase();
  const name = context.userProfile.name;

  // -------------------------------
  // Greeting (Hardcoded)
  // -------------------------------
  if (["hi", "hello", "hey"].some(word => lowerMsg === word)) {
    return {
      response: `Hi ${name}! 👋 I'm Neuro Bot. Ask me anything!`
    };
  }

  // -------------------------------
  // Weak Area Detection (Manual WAK logic)
  // -------------------------------
  const weakPatterns = [
    "weak at",
    "struggling with",
    "difficult",
    "hard to understand",
    "confused about",
    "not good at"
  ];

  for (const pattern of weakPatterns) {
    if (lowerMsg.includes(pattern)) {

      const topic = message
        .substring(lowerMsg.indexOf(pattern) + pattern.length)
        .trim()
        .replace(/[?.,!]/g, '');

      return {
        response: `I understand ${name} 💙  

It’s completely okay to struggle with ${topic}.  
Would you like me to add this to your weak topics list?`,
        detectedWeakTopic: topic
      };
    }
  }

  // -------------------------------
  // EVERYTHING ELSE → AI
  // -------------------------------
  const prompt = `
You are Neuro Bot, a helpful learning assistant.

Student name: ${name}

Respond clearly and in simple language.
Avoid harmful content.

Question:
${message}
`;

  const result = await model.generateContent(prompt);
  const aiResponse = result.response.text();

  return { response: aiResponse };
}


// ===============================
// LEARNING SUGGESTION (AI)
// ===============================
export async function generateLearningSuggestion(context: ChatContext) {

  const prompt = `
Suggest one helpful study action for ${context.userProfile.name}.
Keep it short.
`;

  const result = await model.generateContent(prompt);
  const suggestion = result.response.text();

  return {
    suggestion,
    reason: "AI generated suggestion",
    priority: "medium"
  };
}


// ===============================
// INITIAL GREETING
// ===============================
export function createInitialGreeting(name: string): string {
  return `Hi ${name}! 👋 I'm Neuro Bot. Ask me anything!`;
}


// ===============================
// SAFETY CHECK
// ===============================
export function validateMessageSafety(message: string): boolean {
  const blockedTerms = ['harm', 'illegal', 'violence', 'explicit', 'hate'];
  const lower = message.toLowerCase();
  return !blockedTerms.some(term => lower.includes(term));
}


// ===============================
// ADD WEAK TOPIC TO DB
// ===============================
export async function addWeakTopicFromChat(
  userId: string,
  topicName: string,
  subject: string
) {
  const existing = await WeakTopic.findOne({
    userId,
    topicName: { $regex: new RegExp(topicName, 'i') }
  });

  if (!existing) {
    await WeakTopic.create({
      userId,
      topicName,
      subject,
      completed: false,
      source: 'chatbot'
    });

    await User.findByIdAndUpdate(userId, {
      $addToSet: { 'profile.weakAreas': topicName }
    });
  }
}