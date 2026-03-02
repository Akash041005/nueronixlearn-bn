import AIUsage from '../models/AIUsage';

const DAILY_LIMITS = {
  chatbot: 50,
  recommendation: 20,
  topicGeneration: 10,
  total: 100
};

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export async function canUseAI(type: keyof typeof DAILY_LIMITS): Promise<boolean> {
  const today = getTodayDate();
  
  let usage = await AIUsage.findOne({ date: today });
  
  if (!usage) {
    usage = new AIUsage({
      date: today,
      chatbotCalls: 0,
      recommendationCalls: 0,
      topicGenerationCalls: 0,
      totalTokens: 0
    });
    await usage.save();
  }
  
  const limits = DAILY_LIMITS;
  
  switch (type) {
    case 'chatbot':
      return usage.chatbotCalls < limits.chatbot;
    case 'recommendation':
      return usage.recommendationCalls < limits.recommendation;
    case 'topicGeneration':
      return usage.topicGenerationCalls < limits.topicGeneration;
    default:
      const totalUsed = usage.chatbotCalls + usage.recommendationCalls + usage.topicGenerationCalls;
      return totalUsed < limits.total;
  }
}

export async function incrementAIUsage(
  type: 'chatbot' | 'recommendation' | 'topicGeneration',
  tokens: number = 0
): Promise<void> {
  const today = getTodayDate();
  
  const updateField: Record<string, number> = {
    lastUpdated: Date.now()
  };
  
  if (tokens > 0) {
    updateField.totalTokens = tokens;
  }
  
  switch (type) {
    case 'chatbot':
      updateField['chatbotCalls'] = 1;
      break;
    case 'recommendation':
      updateField['recommendationCalls'] = 1;
      break;
    case 'topicGeneration':
      updateField['topicGenerationCalls'] = 1;
      break;
  }
  
  await AIUsage.findOneAndUpdate(
    { date: today },
    {
      $inc: {
        [type === 'chatbot' ? 'chatbotCalls' : 
          type === 'recommendation' ? 'recommendationCalls' : 'topicGenerationCalls']: 1,
        ...(tokens > 0 ? { totalTokens: tokens } : {})
      },
      $set: { lastUpdated: new Date() }
    },
    { upsert: true }
  );
}

export async function getAIUsageToday(): Promise<{
  date: string;
  chatbotCalls: number;
  recommendationCalls: number;
  topicGenerationCalls: number;
  totalTokens: number;
  limits: typeof DAILY_LIMITS;
}> {
  const today = getTodayDate();
  
  let usage = await AIUsage.findOne({ date: today });
  
  if (!usage) {
    return {
      date: today,
      chatbotCalls: 0,
      recommendationCalls: 0,
      topicGenerationCalls: 0,
      totalTokens: 0,
      limits: DAILY_LIMITS
    };
  }
  
  return {
    date: usage.date,
    chatbotCalls: usage.chatbotCalls,
    recommendationCalls: usage.recommendationCalls,
    topicGenerationCalls: usage.topicGenerationCalls,
    totalTokens: usage.totalTokens,
    limits: DAILY_LIMITS
  };
}

export function isAILimited(): boolean {
  return false;
}
