import { Router, Response } from 'express';
import User from '../models/User';
import UserBehavior from '../models/UserBehavior';
import { authenticate, AuthRequest } from '../middleware/auth';
import keyManager from '../ml/keyManager';

const router = Router();

const ANALYSIS_INTERVAL = 2 * 24 * 60 * 60 * 1000; // 2 days

router.get('/my-behavior', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let behavior = await UserBehavior.findOne({ userId: req.user?._id });
    
    if (!behavior) {
      behavior = new UserBehavior({
        userId: req.user?._id,
        chatTone: 'friendly',
        preferredResponseLength: 'medium',
        topicsOfInterest: [],
        emotionalState: 'neutral',
        interactionPatterns: {
          totalChats: 0,
          questionsAsked: 0,
          topicsDiscussed: [],
          avgSessionLength: 0,
          lastActive: new Date()
        }
      });
      await behavior.save();
    }

    res.json({ behavior });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/update-behavior', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { message, response, sessionLength } = req.body;
    
    let behavior = await UserBehavior.findOne({ userId: req.user?._id });
    if (!behavior) {
      behavior = new UserBehavior({ userId: req.user?._id });
    }

    behavior.interactionPatterns.totalChats += 1;
    behavior.interactionPatterns.lastActive = new Date();

    // Count questions
    if (message.includes('?')) {
      behavior.interactionPatterns.questionsAsked += 1;
    }

    // Detect topics mentioned
    const lowerMsg = message.toLowerCase();
    const topicKeywords = ['math', 'science', 'physics', 'chemistry', 'biology', 'history', 'english', 'coding', 'programming'];
    topicKeywords.forEach(topic => {
      if (lowerMsg.includes(topic) && !behavior!.topicsOfInterest.includes(topic)) {
        behavior!.topicsOfInterest.push(topic);
        behavior!.interactionPatterns.topicsDiscussed.push(topic);
      }
    });

    // Update average session length
    if (sessionLength) {
      const currentAvg = behavior.interactionPatterns.avgSessionLength;
      const total = behavior.interactionPatterns.totalChats;
      behavior.interactionPatterns.avgSessionLength = ((currentAvg * (total - 1)) + sessionLength) / total;
    }

    await behavior.save();

    res.json({ message: 'Behavior updated', behavior });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/analyze-behavior', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const behavior = await UserBehavior.findOne({ userId: req.user?._id });
    const user = await User.findById(req.user?._id);

    if (!behavior || !user) {
      return res.status(404).json({ error: 'User data not found' });
    }

    const { client, keyIndex } = keyManager.getRecoClient();
    
    if (!client) {
      return res.status(500).json({ error: 'AI not configured' });
    }

    const prompt = `Analyze this user's chat behavior and update their profile:

User: ${user.name}
Total Chats: ${behavior.interactionPatterns.totalChats}
Questions Asked: ${behavior.interactionPatterns.questionsAsked}
Topics Discussed: ${behavior.interactionPatterns.topicsDiscussed.join(', ')}
Avg Session Length: ${Math.round(behavior.interactionPatterns.avgSessionLength)} minutes
Current Tone: ${behavior.chatTone}
Current Emotional State: ${behavior.emotionalState}

Return JSON with updated values:
{
  "chatTone": "formal|casual|friendly|motivational|strict",
  "preferredResponseLength": "short|medium|long",
  "emotionalState": "neutral|motivated|frustrated|confident|anxious",
  "topicsOfInterest": ["topic1", "topic2"],
  "summary": "brief summary of user behavior"
}`;

    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    keyManager.releaseRecoKey(keyIndex);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      
      behavior.chatTone = analysis.chatTone || behavior.chatTone;
      behavior.preferredResponseLength = analysis.preferredResponseLength || behavior.preferredResponseLength;
      behavior.emotionalState = analysis.emotionalState || behavior.emotionalState;
      behavior.topicsOfInterest = analysis.topicsOfInterest || behavior.topicsOfInterest;
      behavior.lastAnalyzed = new Date();
      
      behavior.analysisHistory.push({
        date: new Date(),
        tone: behavior.chatTone,
        emotionalState: behavior.emotionalState,
        summary: analysis.summary || 'Behavior analyzed'
      });

      await behavior.save();
    }

    res.json({ message: 'Behavior analyzed', behavior });
  } catch (err) {
    console.error('Behavior analysis error:', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

router.get('/should-analyze', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const behavior = await UserBehavior.findOne({ userId: req.user?._id });
    
    if (!behavior) {
      return res.json({ shouldAnalyze: true, reason: 'No behavior data yet' });
    }

    const timeSinceLastAnalysis = Date.now() - new Date(behavior.lastAnalyzed).getTime();
    const shouldAnalyze = timeSinceLastAnalysis > ANALYSIS_INTERVAL;

    res.json({
      shouldAnalyze,
      lastAnalyzed: behavior.lastAnalyzed,
      timeUntilNext: shouldAnalyze ? 0 : ANALYSIS_INTERVAL - timeSinceLastAnalysis
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
