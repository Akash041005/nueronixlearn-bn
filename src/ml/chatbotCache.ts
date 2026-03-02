import crypto from 'crypto';
import ChatbotCache from '../models/ChatbotCache';

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashQuestion(question: string): string {
  return crypto.createHash('md5').update(question).digest('hex');
}

export async function getCachedResponse(question: string): Promise<string | null> {
  const normalized = normalizeQuestion(question);
  
  const cached = await ChatbotCache.findOne({ normalizedQuestion: normalized });
  
  if (cached) {
    return cached.answer;
  }
  
  return null;
}

export async function cacheResponse(
  question: string, 
  answer: string, 
  source: 'ai' | 'hardcoded' = 'ai'
): Promise<void> {
  const normalized = normalizeQuestion(question);
  const hashed = hashQuestion(normalized);
  
  await ChatbotCache.findOneAndUpdate(
    { normalizedQuestion: normalized },
    {
      questionText: question,
      normalizedQuestion: normalized,
      answer,
      source,
      createdAt: new Date()
    },
    { upsert: true }
  );
}

export function getHardcodedResponse(message: string): string | null {
  const lowerMsg = message.toLowerCase().trim();
  
  const hardcodedResponses: Record<string, string> = {
    'hello': 'Hi there! How can I help you with your studies today?',
    'hi': 'Hello! What would you like to learn about?',
    'hey': 'Hey! Ready to learn something new?',
    'help': 'I can help you with:\n• Understanding difficult concepts\n• Finding study resources\n• Exam preparation tips\n• Tracking your progress\n\nWhat do you need help with?',
    'thanks': 'You\'re welcome! Let me know if you need anything else.',
    'thank you': 'You\'re welcome! Keep up the great work!',
    'bye': 'Goodbye! Keep learning and stay curious!',
    'goodbye': 'See you later! Don\'t forget to practice daily!',
    'what can you do': 'I can help you with:\n• Answering questions about any subject\n• Explaining difficult concepts\n• Suggesting study resources\n• Creating study plans\n• Exam preparation tips',
    'who are you': 'I\'m Neuro Bot, your AI learning assistant! I\'m here to help you with your studies and track your progress.'
  };
  
  for (const [key, response] of Object.entries(hardcodedResponses)) {
    if (lowerMsg === key || lowerMsg.startsWith(key + ' ') || lowerMsg.endsWith(' ' + key)) {
      return response;
    }
  }
  
  return null;
}

export function isWeakTopicMessage(message: string): { isWeak: boolean; topic?: string } {
  const lowerMsg = message.toLowerCase();
  
  const weakPatterns = [
    { pattern: 'weak at ', extract: true },
    { pattern: 'struggling with ', extract: true },
    { pattern: 'difficult to understand', extract: false },
    { pattern: 'hard to understand', extract: false },
    { pattern: 'confused about ', extract: true },
    { pattern: 'not good at ', extract: true },
    { pattern: 'problem with ', extract: true },
    { pattern: 'stuck on ', extract: true },
    { pattern: 'cant understand', extract: false },
    { pattern: 'cannot understand', extract: false },
    { pattern: 'finding it hard', extract: false },
    { pattern: 'dont understand', extract: false },
    { pattern: "don't understand", extract: false }
  ];
  
  for (const { pattern, extract } of weakPatterns) {
    if (lowerMsg.includes(pattern)) {
      if (extract) {
        const words = message.split(' ');
        const patternIndex = words.findIndex(w => 
          w.toLowerCase().includes(pattern.replace(' ', '').replace(' ', ''))
        );
        if (patternIndex >= 0 && patternIndex < words.length - 1) {
          const topic = words.slice(patternIndex + 1).join(' ').replace(/[?.,!]/g, '');
          return { isWeak: true, topic };
        }
      }
      return { isWeak: true };
    }
  }
  
  return { isWeak: false };
}
