interface AnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  keywords: string[];
  concepts: string[];
  quality: number;
  feedback: string;
}

export async function analyzeResponse(response: string, question?: string): Promise<AnalysisResult> {
  const result: AnalysisResult = {
    sentiment: 'neutral',
    confidence: 0.5,
    keywords: [],
    concepts: [],
    quality: 50,
    feedback: ''
  };

  if (!response || response.trim().length === 0) {
    result.feedback = 'Please provide an answer.';
    return result;
  }

  const words = response.toLowerCase().split(/\s+/);
  
  const positiveWords = ['good', 'great', 'excellent', 'correct', 'right', 'understand', 'learned', 'helpful', 'clear', 'well'];
  const negativeWords = ['confused', 'wrong', 'difficult', 'hard', " don't understand" ,'unclear', 'struggling'];
  
  let positiveCount = words.filter(w => positiveWords.some(pw => w.includes(pw))).length;
  let negativeCount = words.filter(w => negativeWords.some(nw => w.includes(nw))).length;

  if (positiveCount > negativeCount) {
    result.sentiment = 'positive';
    result.confidence = Math.min(0.5 + (positiveCount * 0.1), 0.95);
  } else if (negativeCount > positiveCount) {
    result.sentiment = 'negative';
    result.confidence = Math.min(0.5 + (negativeCount * 0.1), 0.95);
  } else {
    result.sentiment = 'neutral';
    result.confidence = 0.5;
  }

  const techKeywords = [
    'algorithm', 'function', 'variable', 'loop', 'condition', 'array', 'object',
    'class', 'method', 'api', 'database', 'server', 'client', 'frontend', 'backend',
    'react', 'node', 'javascript', 'python', 'html', 'css', 'query', 'data',
    'machine', 'learning', 'neural', 'network', 'model', 'training', 'prediction'
  ];
  
  result.keywords = words.filter(w => techKeywords.some(k => w.includes(k)));
  
  result.concepts = [...new Set(result.keywords.map(k => {
    if (k.includes('algorithm')) return 'Algorithms';
    if (k.includes('react') || k.includes('frontend')) return 'Frontend Development';
    if (k.includes('node') || k.includes('backend')) return 'Backend Development';
    if (k.includes('database') || k.includes('query')) return 'Database';
    if (k.includes('machine') || k.includes('neural')) return 'Machine Learning';
    return k.charAt(0).toUpperCase() + k.slice(1);
  }))];

  const lengthScore = Math.min(response.length / 200, 1) * 30;
  const keywordScore = Math.min(result.keywords.length * 10, 40);
  const sentimentScore = result.sentiment === 'positive' ? 30 : (result.sentiment === 'neutral' ? 20 : 10);
  
  result.quality = Math.round(lengthScore + keywordScore + sentimentScore);

  if (result.quality >= 80) {
    result.feedback = 'Excellent answer! You have a strong understanding of the concept.';
  } else if (result.quality >= 60) {
    result.feedback = 'Good answer. Consider adding more detail to strengthen your response.';
  } else if (result.quality >= 40) {
    result.feedback = 'You\'re on the right track. Try to elaborate more on the key concepts.';
  } else {
    result.feedback = 'Consider reviewing the material and providing a more detailed response.';
  }

  return result;
}

export function extractConcepts(text: string): string[] {
  const concepts = new Set<string>();
  
  const conceptPatterns: Record<string, RegExp> = {
    'JavaScript': /\b(javascript|js|es6|node)\b/i,
    'React': /\b(react|jsx|hooks|components)\b/i,
    'Python': /\b(python|py|django|flask)\b/i,
    'Machine Learning': /\b(machine learning|ml|model|training|prediction)\b/i,
    'Database': /\b(database|sql|mongodb|query)\b/i,
    'API': /\b(api|rest|endpoint|request)\b/i,
    'Algorithms': /\b(algorithm|complexity|big-o|sort|search)\b/i
  };

  for (const [concept, pattern] of Object.entries(conceptPatterns)) {
    if (pattern.test(text)) {
      concepts.add(concept);
    }
  }

  return Array.from(concepts);
}
