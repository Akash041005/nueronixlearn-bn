import UserProgress from '../models/UserProgress';

interface CognitiveMetrics {
  timeOnModule: number;
  errorRate: number;
  hintUsage: number;
  attempts: number;
  previousLoad?: number;
}

export async function predictCognitiveLoad(
  userId: string, 
  courseId: string, 
  metrics: CognitiveMetrics
): Promise<number> {
  const progress = await UserProgress.findOne({ userId, courseId });
  
  let loadLevel = metrics.previousLoad || 50;

  if (metrics.timeOnModule > 600) {
    loadLevel += 15;
  } else if (metrics.timeOnModule > 300) {
    loadLevel += 5;
  }

  if (metrics.errorRate > 0.5) {
    loadLevel += 20;
  } else if (metrics.errorRate > 0.3) {
    loadLevel += 10;
  } else if (metrics.errorRate < 0.2) {
    loadLevel -= 5;
  }

  if (metrics.hintUsage > 3) {
    loadLevel += 15;
  } else if (metrics.hintUsage > 1) {
    loadLevel += 5;
  }

  if (metrics.attempts > 3) {
    loadLevel += 10;
  } else if (metrics.attempts === 1 && metrics.errorRate < 0.2) {
    loadLevel -= 10;
  }

  if (progress?.cognitiveLoadHistory && progress.cognitiveLoadHistory.length > 0) {
    const recentLoads = progress.cognitiveLoadHistory.slice(-5).map(h => h.loadLevel);
    const avgRecentLoad = recentLoads.reduce((a, b) => a + b, 0) / recentLoads.length;
    loadLevel = (loadLevel + avgRecentLoad) / 2;
  }

  loadLevel = Math.max(0, Math.min(100, loadLevel));

  return Math.round(loadLevel);
}

export function getDifficultySuggestion(loadLevel: number): string {
  if (loadLevel >= 80) {
    return 'reduce';
  } else if (loadLevel >= 60) {
    return 'maintain';
  } else if (loadLevel >= 40) {
    return 'increase';
  } else {
    return 'increase_significantly';
  }
}

export function getCognitiveLoadAdvice(loadLevel: number): string[] {
  const advice: string[] = [];

  if (loadLevel >= 80) {
    advice.push('Take a short break before continuing');
    advice.push('Review previous material before moving on');
    advice.push('Consider switching to easier content');
  } else if (loadLevel >= 60) {
    advice.push('Take regular breaks');
    advice.push('Focus on one concept at a time');
  } else if (loadLevel >= 40) {
    advice.push('You\'re in the optimal learning zone');
    advice.push('Continue with the current pace');
  } else {
    advice.push('You\'re ready for more challenging content');
    advice.push('Consider advancing to the next level');
  }

  return advice;
}

export async function analyzeCognitivePattern(userId: string, courseId: string) {
  const progress = await UserProgress.findOne({ userId, courseId });
  
  if (!progress || progress.cognitiveLoadHistory.length < 5) {
    return {
      pattern: 'insufficient_data',
      trend: 0,
      advice: ['Continue learning to generate more data']
    };
  }

  const recent = progress.cognitiveLoadHistory.slice(-10);
  const earlier = progress.cognitiveLoadHistory.slice(-20, -10);
  
  const recentAvg = recent.reduce((sum, h) => sum + h.loadLevel, 0) / recent.length;
  const earlierAvg = earlier.length > 0 
    ? earlier.reduce((sum, h) => sum + h.loadLevel, 0) / earlier.length 
    : recentAvg;

  const trend = recentAvg - earlierAvg;
  
  let pattern: string;
  if (trend < -10) {
    pattern = 'improving';
  } else if (trend > 10) {
    pattern = 'declining';
  } else {
    pattern = 'stable';
  }

  return {
    pattern,
    trend: Math.round(trend),
    averageLoad: Math.round(recentAvg),
    advice: getCognitiveLoadAdvice(recentAvg)
  };
}
