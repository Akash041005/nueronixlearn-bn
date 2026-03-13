import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import xss from 'xss-clean';
import path from 'path';

import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import learningRoutes from './routes/learning';
import analyticsRoutes from './routes/analytics';
import mlRoutes from './routes/ml';
import examRoutes from './routes/exams';
import diaryRoutes from './routes/diary';
import chatbotRoutes from './routes/chatbot';
import behaviorRoutes from './routes/behavior';
import adminRoutes from './routes/admin';
import topicsRoutes from './routes/topics';
import aiRoutes from './routes/ai';
import aiMediaRoutes from './routes/aiMedia';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(xss());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (videos, images)
app.use('/public', express.static(path.join(process.cwd(), 'public')));
app.use('/videos', express.static(path.join(process.cwd(), 'public/videos')));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// General limit: 500 requests per 15 min per IP (covers normal navigation)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Strict limit: 30 requests per 15 min for expensive AI generation endpoints
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests, please wait a moment and try again.' }
});

app.use('/api/', generalLimiter);

// Apply the stricter AI limiter to routes that call Gemini or YouTube
app.use('/api/topics/add-subject', aiLimiter);
app.use('/api/topics/resources', aiLimiter);
app.use('/api/chatbot/chat', aiLimiter);
app.use('/api/ai/recommendation', aiLimiter);
app.use('/api/ai-media/generate-slides', aiLimiter);
app.use('/api/ai-media/generate-video', aiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/learn', learningRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-media', aiMediaRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/diary', diaryRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/behavior', behaviorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/topics', topicsRoutes);

/* =========================
    HEALTH CHECK
 ========================= */

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* DEBUG: Print all routes AFTER all routes are registered */
app._router.stack.forEach((middleware: any) => {
  if (middleware.route) {
    console.log(`ROUTE: ${middleware.route.path} [${Object.keys(middleware.route.methods).join(', ')}]`);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler: any) => {
      if (handler.route) {
        console.log(`ROUTER: ${handler.route.path} [${Object.keys(handler.route.methods).join(', ')}]`);
      }
    });
  }
});
console.log('=== All routes registered ===');

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nueronixlearn')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.listen(PORT, () => {
  console.log(`NueronixLearn server running on port ${PORT}`);
});

export default app;
