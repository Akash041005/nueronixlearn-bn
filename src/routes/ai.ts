import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import LearningProfile from '../models/LearningProfile';
import UserLearningBehavior from '../models/UserLearningBehavior';
import User from '../models/User';
import { generateChatResponse } from '../ml/neuroBot';

const router = Router();

router.get('/recommendation', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;

    const user = await User.findById(userId);
    let learningProfile = null;
    
    if (user?.role === 'student') {
      learningProfile = await LearningProfile.findOne({ userId });
      
      if (!learningProfile) {
        learningProfile = new LearningProfile({
          userId,
          learningPace: 'medium',
          experienceLevel: 'beginner',
          subjects: [],
          strongTopics: [],
          weakTopics: [],
          completedTopics: [],
          recommendedTopics: []
        });
        await learningProfile.save();
        console.log('[AI] Created default learning profile for user:', userId);
      }
    }

    const userBehaviors = await UserLearningBehavior.find({ userId });

    const completedTopics = userBehaviors
      .filter(b => b.completed)
      .map(b => b.topic);
    
    const weakTopics = learningProfile?.weakTopics || [];
    const strongTopics = learningProfile?.strongTopics || [];
    const profileSubjects = learningProfile?.subjects || [];

    const contextPrompt = `
You are an AI learning mentor for NeuronixLearn platform.

User learning profile:
- Learning Pace: ${learningProfile?.learningPace || 'medium'}
- Experience Level: ${learningProfile?.experienceLevel || 'beginner'}
- Subjects of interest: ${profileSubjects.join(', ') || 'Not specified'}
- Strong topics: ${strongTopics.length > 0 ? strongTopics.join(', ') : 'None identified yet'}
- Weak topics: ${weakTopics.length > 0 ? weakTopics.join(', ') : 'None identified yet'}
- Completed topics: ${completedTopics.length > 0 ? completedTopics.join(', ') : 'None yet'}

Based on this profile, recommend the next learning step in a short, actionable message (1-2 sentences).
Focus on:
1. Addressing weak topics first
2. Building on strong topics
3. Following the user's learning pace
4. Being encouraging and supportive

If there are weak topics, suggest reviewing them before moving on.
If the user has completed several topics, suggest the next logical topic in their learning path.
If no data is available yet, encourage them to start learning.

Provide a clear, concise recommendation.
`;

    const aiResponse = await generateChatResponse(
      contextPrompt,
      {
        userId: userId.toString(),
        userProfile: {
          name: user?.name || 'Student',
          grade: user?.profile?.grade,
          subjectInterests: profileSubjects,
          weakAreas: weakTopics,
          preferredLearningStyle: user?.profile?.preferredLearningStyle || 'mixed',
          learningGoals: user?.profile?.learningGoals || [],
          currentPerformanceLevel: user?.profile?.currentPerformanceLevel || 'average',
          pacePreference: learningProfile?.learningPace || 'medium'
        },
        learningHistory: [],
        cognitiveLoadScore: user?.cognitiveLoad || 50,
        currentStreak: user?.progress?.currentStreak || 0,
        completedCourses: completedTopics.length,
        enrolledCourses: profileSubjects.length,
        intent: user?.intent
      }
    );

    res.json({
      recommendation: aiResponse.response,
      learningPace: learningProfile?.learningPace || 'medium',
      experienceLevel: learningProfile?.experienceLevel || 'beginner',
      weakTopics,
      strongTopics,
      completedTopicsCount: completedTopics.length
    });
  } catch (err) {
    console.error('AI Recommendation error:', err);
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});

router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;

    const learningProfile = await LearningProfile.findOne({ userId });
    const userBehaviors = await UserLearningBehavior.find({ userId });

    if (!learningProfile) {
      return res.status(404).json({ error: 'Learning profile not found' });
    }

    res.json({
      profile: learningProfile,
      behaviors: userBehaviors
    });
  } catch (err) {
    console.error('Learning profile error:', err);
    res.status(500).json({ error: 'Failed to fetch learning profile' });
  }
});

router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { learningPace, experienceLevel, subjects, strongTopics, weakTopics } = req.body;

    const learningProfile = await LearningProfile.findOneAndUpdate(
      { userId },
      {
        ...(learningPace && { learningPace }),
        ...(experienceLevel && { experienceLevel }),
        ...(subjects && { subjects }),
        ...(strongTopics && { strongTopics }),
        ...(weakTopics && { weakTopics })
      },
      { new: true, upsert: true }
    );

    res.json({
      message: 'Learning profile updated',
      profile: learningProfile
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update learning profile' });
  }
});

router.post('/topic-progress', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;
    const { subject, topic, timeSpent, quizScore, attempts, completed } = req.body;

    let progress = await UserLearningBehavior.findOne({ userId, subject, topic });

    if (progress) {
      progress.timeSpent = (progress.timeSpent || 0) + (timeSpent || 0);
      if (quizScore !== undefined) progress.quizScore = quizScore;
      if (attempts !== undefined) progress.attempts = (progress.attempts || 0) + attempts;
      if (completed !== undefined) progress.completed = completed;
      progress.lastStudied = new Date();
      await progress.save();
    } else {
      progress = new UserLearningBehavior({
        userId,
        subject,
        topic,
        timeSpent: timeSpent || 0,
        quizScore: quizScore || 0,
        attempts: attempts || 0,
        completed: completed || false,
        lastStudied: new Date()
      });
      await progress.save();
    }

    const learningProfile = await LearningProfile.findOne({ userId });
    if (learningProfile) {
      if (quizScore !== undefined && quizScore < 50) {
        const topicKey = `${subject}:${topic}`;
        if (!learningProfile.weakTopics.includes(topicKey)) {
          learningProfile.weakTopics.push(topicKey);
          await learningProfile.save();
        }
      } else if (quizScore !== undefined && quizScore > 80) {
        const topicKey = `${subject}:${topic}`;
        if (!learningProfile.strongTopics.includes(topicKey)) {
          learningProfile.strongTopics.push(topicKey);
          await learningProfile.save();
        }
      }

      if (completed) {
        const topicKey = `${subject}:${topic}`;
        if (!learningProfile.completedTopics.includes(topicKey)) {
          learningProfile.completedTopics.push(topicKey);
          await learningProfile.save();
        }
      }
    }

    res.json({
      message: 'Topic progress updated',
      progress
    });
  } catch (err) {
    console.error('Topic progress error:', err);
    res.status(500).json({ error: 'Failed to update topic progress' });
  }
});

router.get('/learning-twin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!._id;

    const learningProfile = await LearningProfile.findOne({ userId });
    const userBehaviors = await UserLearningBehavior.find({ userId }).sort({ lastStudied: -1 });

    if (!learningProfile) {
      return res.status(404).json({ error: 'Learning profile not found' });
    }

    const recentActivity = userBehaviors.slice(0, 10).map(b => ({
      subject: b.subject,
      topic: b.topic,
      timeSpent: b.timeSpent,
      quizScore: b.quizScore,
      completed: b.completed,
      lastStudied: b.lastStudied
    }));

    const avgQuizScore = userBehaviors.length > 0
      ? userBehaviors.reduce((sum, b) => sum + (b.quizScore || 0), 0) / userBehaviors.length
      : 0;

    const totalTimeSpent = userBehaviors.reduce((sum, b) => sum + (b.timeSpent || 0), 0);

    res.json({
      learningPace: learningProfile.learningPace,
      experienceLevel: learningProfile.experienceLevel,
      subjects: learningProfile.subjects,
      strongTopics: learningProfile.strongTopics,
      weakTopics: learningProfile.weakTopics,
      completedTopics: learningProfile.completedTopics,
      recentActivity,
      stats: {
        totalTopicsStudied: userBehaviors.length,
        avgQuizScore: Math.round(avgQuizScore),
        totalTimeSpent,
        completedCount: learningProfile.completedTopics.length
      }
    });
  } catch (err) {
    console.error('Learning twin error:', err);
    res.status(500).json({ error: 'Failed to fetch learning twin data' });
  }
});

export default router;
