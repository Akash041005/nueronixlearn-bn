import { Router, Response } from 'express';
import Joi from 'joi';
import Course from '../models/Course';
import User from '../models/User';
import UserProgress from '../models/UserProgress';
import Recommendation from '../models/Recommendation';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getGeminiRecommendations, handleUserFeedback } from '../ml/recommendationEngine';
import { analyzeResponse } from '../ml/nlpAnalyzer';
import { predictCognitiveLoad, getDifficultySuggestion, analyzeCognitivePattern } from '../ml/cognitiveLoad';
import { detectIntent, validateRecommendationSafety } from '../ml/geminiService';

const router = Router();

const feedbackSchema = Joi.object({
  feedback: Joi.string().min(1).max(500).required(),
  type: Joi.string().valid('difficulty', 'pace', 'content', 'general').required(),
  courseId: Joi.string()
});

router.get('/recommendations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const recommendations = await getGeminiRecommendations(req.user!._id.toString());
    res.json({ recommendations });
  } catch (err) {
    console.error('Recommendation error:', err);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

router.post('/feedback', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = feedbackSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const adjustedRecommendation = await handleUserFeedback(
      req.user!._id.toString(),
      value.feedback,
      value.type,
      value.courseId
    );

    res.json({ 
      recommendation: adjustedRecommendation,
      message: 'Recommendations adjusted based on your feedback'
    });
  } catch (err) {
    console.error('Feedback error:', err);
    res.status(500).json({ error: 'Failed to process feedback' });
  }
});

router.get('/intent', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const intent = user.intent || detectIntent(user.profile);
    
    await User.findByIdAndUpdate(req.user!._id, { intent });

    res.json({ intent });
  } catch (err) {
    res.status(500).json({ error: 'Failed to detect intent' });
  }
});

router.get('/cognitive-pattern', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { courseId } = req.query;
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    const pattern = await analyzeCognitivePattern(
      req.user!._id.toString(),
      courseId as string
    );

    res.json(pattern);
  } catch (err) {
    res.status(500).json({ error: 'Failed to analyze cognitive pattern' });
  }
});

router.get('/difficulty-suggestion', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { loadLevel } = req.query;
    const level = loadLevel ? parseInt(loadLevel as string) : 50;
    
    const suggestion = getDifficultySuggestion(level);
    res.json({ suggestion, loadLevel: level });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get difficulty suggestion' });
  }
});

router.post('/analyze-response', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { response, question } = req.body;
    const analysis = await analyzeResponse(response, question);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: 'Failed to analyze response' });
  }
});

router.post('/cognitive-load', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { courseId, metrics } = req.body;
    const loadLevel = await predictCognitiveLoad(req.user!._id.toString(), courseId, metrics);

    let progress = await UserProgress.findOne({ userId: req.user?._id, courseId });
    if (progress) {
      progress.cognitiveLoadHistory.push({ timestamp: new Date(), loadLevel });
      if (progress.cognitiveLoadHistory.length > 100) {
        progress.cognitiveLoadHistory = progress.cognitiveLoadHistory.slice(-100);
      }
      await progress.save();
    }

    await User.findByIdAndUpdate(req.user?._id, { cognitiveLoad: loadLevel });

    const difficultySuggestion = getDifficultySuggestion(loadLevel);

    res.json({ 
      cognitiveLoad: loadLevel,
      difficultySuggestion
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to predict cognitive load' });
  }
});

export default router;
