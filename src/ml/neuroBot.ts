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
    weakAreas?: string[];
    strongTopics?: string[];
    subjects?: string[];
    pacePreference?: string;
    learningPace?: string;
    experienceLevel?: string;
    preferredLearningStyle?: string;
    learningGoals?: string[];
    currentPerformanceLevel?: string;
    grade?: string;
    subjectInterests?: string[];
  };
  learningHistory?: Array<{
    courseName: string;
    progress: number;
    score: number;
  }>;
  cognitiveLoadScore?: number;
  currentStreak?: number;
  completedCourses?: number;
  enrolledCourses?: number;
  intent?: string | null;
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
  const learningPace = context.userProfile.learningPace || context.userProfile.pacePreference || 'moderate';
  const experienceLevel = context.userProfile.experienceLevel || 'beginner';
  const weakTopics = context.userProfile.weakAreas || [];
  const strongTopics = context.userProfile.strongTopics || [];
  const subjects = context.userProfile.subjects || context.userProfile.subjectInterests || [];

  let explanationStyle = 'simple';
  if (learningPace === 'slow') explanationStyle = 'very detailed and slow-paced';
  if (learningPace === 'fast') explanationStyle = 'concise and fast-paced';
  if (experienceLevel === 'intermediate') explanationStyle = 'moderate detail';
  if (experienceLevel === 'professional') explanationStyle = 'advanced and technical';

  const prompt = `
You are Neuro Bot, a personal AI teacher for NeuronixLearn platform.

Student information:
- Name: ${name}
- Learning Pace: ${learningPace}
- Experience Level: ${experienceLevel}
- Subjects of interest: ${subjects.length > 0 ? subjects.join(', ') : 'Not specified'}
- Strong topics: ${strongTopics.length > 0 ? strongTopics.join(', ') : 'None identified'}
- Weak topics: ${weakTopics.length > 0 ? weakTopics.join(', ') : 'None identified'}

Adapt your explanation style: ${explanationStyle}
- If the topic is in weak topics → explain more simply with examples
- If the topic is in strong topics → go deeper and challenge them
- Keep explanations appropriate for ${experienceLevel} level

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