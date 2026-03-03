import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[PDF] GEMINI_API_KEY not set!');
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error: any) {
    console.error('[PDF] Extract error:', error.message);
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
  console.log('[PDF] Processing:', filename);
  
  const text = await extractTextFromPDF(pdfBuffer);
  console.log('[PDF] Extracted text length:', text?.length || 0);
  
  if (!text || text.trim().length < 20) {
    return {
      topics: [],
      questions: [],
      summary: 'Could not extract text from PDF',
      keyPoints: [],
      cached: false
    };
  }

  const genAI = getGeminiClient();
  
  if (!genAI) {
    return {
      topics: [],
      questions: [],
      summary: 'ERROR: GEMINI_API_KEY not configured on server',
      keyPoints: [],
      cached: false
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analyze this PDF content and return ONLY valid JSON:

{
  "summary": "2-3 sentence summary",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "topics": ["topic 1", "topic 2", "topic 3"],
  "questions": ["question 1", "question 2"]
}

Content:
${text.substring(0, 10000)}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    console.log('[PDF] Gemini response:', response.substring(0, 300));

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        topics: parsed.topics || [],
        questions: parsed.questions || [],
        summary: parsed.summary || 'Analysis complete',
        keyPoints: parsed.keyPoints || [],
        cached: false
      };
    }

    return {
      topics: [],
      questions: [],
      summary: 'AI returned invalid format: ' + response.substring(0, 200),
      keyPoints: [],
      cached: false
    };
  } catch (error: any) {
    console.error('[PDF] Gemini error:', error.message);
    return {
      topics: [],
      questions: [],
      summary: 'ERROR: ' + error.message,
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
