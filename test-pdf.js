import pdfParse from 'pdf-parse';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const testPDF = async () => {
  const pdfPath = process.argv[2];
  
  if (!pdfPath) {
    console.log('Usage: node test-pdf.js <pdf-file>');
    process.exit(1);
  }

  if (!fs.existsSync(pdfPath)) {
    console.log('File not found:', pdfPath);
    process.exit(1);
  }

  console.log('Testing PDF:', pdfPath);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('ERROR: GEMINI_API_KEY not set');
    process.exit(1);
  }

  console.log('API Key:', apiKey.substring(0, 10) + '...');

  const buffer = fs.readFileSync(pdfPath);
  console.log('File size:', buffer.length, 'bytes');

  try {
    console.log('Extracting text...');
    const data = await pdfParse(buffer);
    console.log('Text length:', data.text?.length || 0);
    console.log('First 200 chars:', data.text?.substring(0, 200));

    if (!data.text || data.text.trim().length < 20) {
      console.log('ERROR: Could not extract text');
      process.exit(1);
    }

    console.log('Sending to Gemini...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analyze this and return ONLY JSON:
{
  "summary": "2-3 sentence summary",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "topics": ["topic 1", "topic 2"],
  "questions": ["question 1"]
}

Content:
${data.text.substring(0, 8000)}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    console.log('\n=== GEMINI RESPONSE ===');
    console.log(response);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('\n=== PARSED JSON ===');
      console.log(JSON.stringify(parsed, null, 2));
    }

    console.log('\n=== TEST COMPLETE ===');
  } catch (err: any) {
    console.log('ERROR:', err.message);
    process.exit(1);
  }
};

testPDF();
