import { GoogleGenerativeAI } from '@google/generative-ai';
import keyManager from './keyManager';

const MODEL_NAME = 'gemini-2.0-flash';

export interface RecommendationRequest {
  userProfile: {
    grade?: string;
    subjectInterests: string[];
    weakAreas: string[];
    preferredLearningStyle: string;
    learningGoals: string[];
    currentPerformanceLevel: string;
    pacePreference: string;
  };
  learningHistory: Array<{
    courseId: string;
    title: string;
    completed: boolean;
    score: number;
  }>;
  weakConcepts: string[];
  feedbackNotes: string[];
  cognitiveLoadScore: number;
  intent: string | null;
}

export interface StructuredRecommendation {
  recommendedCourses: Array<{
    courseId: string;
    title: string;
    reason: string;
  }>;
  priorityLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedCompletionTime: string;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced' | 'adaptive';
  reasoning: string;
  nextSteps: string[];
}

const SYSTEM_PROMPT = `
You are an autonomous AI educational recommendation agent.

STRICT RULES:
1. Respond ONLY with valid JSON.
2. No extra text outside JSON.
3. Prioritize weak areas.
4. Consider cognitive load.
5. Adjust difficulty based on performance.

Return EXACTLY this format:

{
  "recommendedCourses": [{"courseId": "string", "title": "string", "reason": "string"}],
  "priorityLevel": "low|medium|high|critical",
  "estimatedCompletionTime": "string",
  "difficultyLevel": "beginner|intermediate|advanced|adaptive",
  "reasoning": "string",
  "nextSteps": ["string"]
}
`;

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in AI response');
  return JSON.parse(match[0]);
}

async function callGemini(prompt: string) {
  const { client, keyIndex } = keyManager.getRecoClient();

  if (!client) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const model = client.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    return extractJson(response);
  } finally {
    keyManager.releaseRecoKey(keyIndex);
  }
}

export async function generateStructuredRecommendations(
  request: RecommendationRequest
): Promise<StructuredRecommendation> {
  try {
    const prompt = `
${SYSTEM_PROMPT}

STUDENT PROFILE:
${JSON.stringify(request.userProfile, null, 2)}

LEARNING HISTORY:
${JSON.stringify(request.learningHistory, null, 2)}

WEAK CONCEPTS:
${request.weakConcepts.join(', ') || 'None'}

FEEDBACK:
${request.feedbackNotes.join('; ') || 'None'}

COGNITIVE LOAD:
${request.cognitiveLoadScore}/100

INTENT:
${request.intent || 'Not specified'}
`;

    const parsed = await callGemini(prompt);

    return {
      recommendedCourses: parsed.recommendedCourses || [],
      priorityLevel: parsed.priorityLevel || 'medium',
      estimatedCompletionTime: parsed.estimatedCompletionTime || '4 weeks',
      difficultyLevel: parsed.difficultyLevel || 'intermediate',
      reasoning: parsed.reasoning || 'Generated based on profile analysis',
      nextSteps: parsed.nextSteps || [],
    };
  } catch (error) {
    console.error('Recommendation Error:', error);

    return {
      recommendedCourses: [],
      priorityLevel: 'medium',
      estimatedCompletionTime: 'Unavailable',
      difficultyLevel: 'intermediate',
      reasoning: 'AI service unavailable. Using fallback.',
      nextSteps: ['Try again later'],
    };
  }
}

export async function analyzeFeedbackAndAdjust(
  originalRecommendation: StructuredRecommendation,
  feedback: string,
  cognitiveLoadScore: number
): Promise<StructuredRecommendation> {
  try {
    const prompt = `
Adjust recommendation based on feedback.

ORIGINAL:
${JSON.stringify(originalRecommendation, null, 2)}

FEEDBACK:
${feedback}

COGNITIVE LOAD:
${cognitiveLoadScore}/100

Return updated JSON in required format.
`;

    return await callGemini(prompt);
  } catch (error) {
    console.error('Feedback Adjustment Error:', error);

    return {
      ...originalRecommendation,
      reasoning: originalRecommendation.reasoning + `. Feedback noted: ${feedback}`,
      nextSteps: [...originalRecommendation.nextSteps, 'Gradually adjusting difficulty'],
    };
  }
}

export function detectIntent(
  userProfile: RecommendationRequest['userProfile']
): string {
  const goals = userProfile.learningGoals || [];

  if (
    goals.includes('certification') ||
    goals.includes('jee') ||
    goals.includes('neet') ||
    goals.includes('board_exams')
  ) {
    return 'certification_preparation';
  }

  if (goals.includes('skill_improvement')) {
    return 'skill_improvement';
  }

  if (goals.includes('career')) {
    return 'career_readiness';
  }

  return 'topic_exploration';
}

export function validateRecommendationSafety(
  recommendation: StructuredRecommendation
): boolean {
  const blockedTerms = ['illegal', 'harmful', 'dangerous', 'unsafe'];

  const content = JSON.stringify(recommendation).toLowerCase();

  return !blockedTerms.some((term) => content.includes(term));
}
