import pdfParse from 'pdf-parse';
import keyManager from './keyManager';
import crypto from 'crypto';

interface PDFCache {
  hash: string;
  topics: string[];
  questions: string[];
  summary: string;
  processedAt: Date;
}

const pdfCache: Map<string, PDFCache> = new Map();

function hashContent(content: string): string {
  return crypto.createHash('md5').update(content).toString();
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
  cached: boolean;
}> {
  const text = await extractTextFromPDF(pdfBuffer);
  
  if (!text) {
    return {
      topics: [],
      questions: [],
      summary: 'Could not extract text from PDF',
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
      cached: true
    };
  }

  const { client } = keyManager.getRecoClient();
  
  if (!client) {
    return {
      topics: extractTopicsFromText(text),
      questions: [],
      summary: 'AI not configured. Topics extracted manually.',
      cached: false
    };
  }

  try {
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analyze this educational content and:
    1. Identify 8-12 main topics/subjects covered
    2. Generate 5-10 practice questions from the content
    3. Give a brief summary
    
    Content: ${text.substring(0, 8000)}
    
    Return JSON:
    {
      "topics": ["topic1", "topic2", ...],
      "questions": ["question1", "question2", ...],
      "summary": "brief summary"
    }`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const match = response.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      
      pdfCache.set(contentHash, {
        hash: contentHash,
        topics: parsed.topics || [],
        questions: parsed.questions || [],
        summary: parsed.summary || '',
        processedAt: new Date()
      });

      return {
        topics: parsed.topics || [],
        questions: parsed.questions || [],
        summary: parsed.summary || '',
        cached: false
      };
    }
  } catch (error) {
    console.error('PDF AI processing error:', error);
  }

  return {
    topics: extractTopicsFromText(text),
    questions: [],
    summary: 'Processed without AI',
    cached: false
  };
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
