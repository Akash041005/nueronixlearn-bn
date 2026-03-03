import pdfParse from 'pdf-parse';
import crypto from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface PDFCache {
  hash: string;
  topics: string[];
  questions: string[];
  summary: string;
  keyPoints: string[];
  processedAt: Date;
}

const pdfCache: Map<string, PDFCache> = new Map();

function hashContent(content: string): string {
  return crypto.createHash('md5').update(content).toString();
}

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured');
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    return '';
  }
}

export async function processPDF(
  pdfBuffer: Buffer,
  filename: string
): Promise<{
  topics: string[];
  questions: string[];
  summary: string;
  keyPoints: string[];
  cached: boolean;
}> {
  const text = await extractTextFromPDF(pdfBuffer);
  
  if (!text || text.trim().length < 50) {
    return {
      topics: [],
      questions: [],
      summary: 'Could not extract text from PDF. The file may be empty or corrupted.',
      keyPoints: [],
      cached: false
    };
  }

  const contentHash = hashContent(text);

  const cached = pdfCache.get(contentHash);
  if (cached) {
    return {
      topics: cached.topics,
      questions: cached.questions,
      summary: cached.summary,
      keyPoints: cached.keyPoints,
      cached: true
    };
  }

  const genAI = getGeminiClient();
  
  if (!genAI) {
    return {
      topics: extractTopicsFromText(text),
      questions: [],
      summary: 'AI not configured. Please set GEMINI_API_KEY in environment.',
      keyPoints: [],
      cached: false
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const truncatedText = text.substring(0, 15000);

    const prompt = `You are an AI teaching assistant. Analyze this educational document and provide:

1. A clear SUMMARY (2-3 sentences)
2. A list of KEY POINTS (5-8 items)
3. Main TOPICS covered (8-12 items)
4. 5-7 PRACTICE QUESTIONS to test understanding

PDF Content:
${truncatedText}

Respond in this JSON format only:
{
  "summary": "your summary here",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "topics": ["topic 1", "topic 2", "topic 3", "topic 4", "topic 5", "topic 6", "topic 7", "topic 8"],
  "questions": ["question 1", "question 2", "question 3", "question 4", "question 5"]
}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    console.log('Gemini PDF response:', response.substring(0, 500));

    let parsed: any = null;
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('JSON parse error:', e);
      }
    }

    if (!parsed) {
      const lines = response.split('\n').filter(l => l.trim());
      const summaryMatch = response.match(/summary["']?\s*[:=]\s*["']([^"']+)/i);
      const summary = summaryMatch ? summaryMatch[1] : lines.slice(0, 3).join(' ');
      
      parsed = {
        summary: summary || 'Analysis complete',
        keyPoints: lines.filter(l => l.match(/^[•\-\d]/)).slice(0, 5),
        topics: [],
        questions: []
      };
    }

    const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [];
    const summary = parsed.summary || 'Analysis complete';

    pdfCache.set(contentHash, {
      hash: contentHash,
      topics,
      questions,
      summary,
      keyPoints,
      processedAt: new Date()
    });

    return {
      topics,
      questions,
      summary,
      keyPoints,
      cached: false
    };
  } catch (error: any) {
    console.error('PDF AI processing error:', error);
    
    if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
      return {
        topics: extractTopicsFromText(text),
        questions: [],
        summary: 'AI quota exceeded. Please try again later.',
        keyPoints: [],
        cached: false
      };
    }
    
    return {
      topics: extractTopicsFromText(text),
      questions: [],
      summary: 'Processed with limited AI analysis',
      keyPoints: [],
      cached: false
    };
  }
}

function extractTopicsFromText(text: string): string[] {
  const lines = text.split('\n').filter(line => line.trim().length > 5);
  const topics: string[] = [];
  
  const keywords = ['chapter', 'topic', 'section', 'introduction', 'overview', 'summary', 'conclusion'];
  
  for (const line of lines.slice(0, 50)) {
    const lower = line.toLowerCase();
    if (keywords.some(k => lower.includes(k)) || line.match(/^[A-Z][A-Za-z\s]+$/)) {
      const cleaned = line.replace(/[^a-zA-Z0-9\s]/g, '').trim();
      if (cleaned.length > 3 && cleaned.length < 80) {
        topics.push(cleaned);
      }
    }
  }

  return topics.slice(0, 10);
}

export async function addTopicsToStudyPlan(
  userId: string,
  subject: string,
  topics: string[]
): Promise<{ added: number; duplicates: number }> {
  const { createUserTodos } = await import('./topicTodoService');
  
  let added = 0;
  let duplicates = 0;

  for (let i = 0; i < topics.length; i++) {
    try {
      await createUserTodos(userId, subject, topics[i]);
      added++;
    } catch (error: any) {
      if (error.code === 11000) {
        duplicates++;
      }
    }
  }

  return { added, duplicates };
}
