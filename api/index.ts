import dotenv from 'dotenv';
dotenv.config();

import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import xss from 'xss-clean';

import authRoutes from '../src/routes/auth';
import courseRoutes from '../src/routes/courses';
import learningRoutes from '../src/routes/learning';
import analyticsRoutes from '../src/routes/analytics';
import mlRoutes from '../src/routes/ml';
import examRoutes from '../src/routes/exams';
import diaryRoutes from '../src/routes/diary';
import chatbotRoutes from '../src/routes/chatbot';
import behaviorRoutes from '../src/routes/behavior';
import adminRoutes from '../src/routes/admin';
import topicsRoutes from '../src/routes/topics';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(xss());
app.use(express.json({ limit: '10mb', verify: (req, res, buf) => {
  (req as any).rawBody = buf;
}}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

let isConnected = false;

async function connectDB() {
  if (!isConnected && process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      isConnected = true;
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  }
}

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: () => process.env.NODE_ENV === 'production'
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests, please wait a moment and try again.' },
  skip: () => process.env.NODE_ENV === 'production'
});

app.use('/api/', generalLimiter);

app.use('/api/topics/add-subject', aiLimiter);
app.use('/api/topics/resources', aiLimiter);
app.use('/api/chatbot/chat', aiLimiter);
app.use('/api/ml/recommendations', aiLimiter);
app.use('/api/ml/upload-pdf', aiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/learn', learningRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/behavior', behaviorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/topics', topicsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

connectDB();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  return app(req, res);
}
