import { Router, Response } from 'express';
import Joi from 'joi';
import User from '../models/User';
import UserProgress from '../models/UserProgress';
import WeakTopic from '../models/WeakTopic';
import { authenticate, AuthRequest } from '../middleware/auth';
import { 
  generateChatResponse, 
  generateLearningSuggestion,
  createInitialGreeting,
  validateMessageSafety,
  addWeakTopicFromChat
} from '../ml/neuroBot';
import { searchYouTubeVideos, generateTodoListForWeakTopic } from '../ml/youtubeService';
import { 
  getCachedResponse, 
  cacheResponse, 
  getHardcodedResponse, 
  isWeakTopicMessage 
} from '../ml/chatbotCache';
import { canUseAI, incrementAIUsage } from '../ml/aiUsageLimiter';
import { createUserTodos, getUserTodos, markTodoComplete, getNextIncompleteTopic } from '../ml/topicTodoService';
import { getCachedVideos, cacheVideos, getFallbackVideos } from '../ml/recommendationCache';

const router = Router();

const chatSchema = Joi.object({
  message: Joi.string().min(1).max(1000).required()
});

const MAX_CONTEXT_LENGTH = 20;
const contextStore: Map<string, { role: string; content: string; timestamp: Date }[]> = new Map();

router.get('/greeting', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const greeting = createInitialGreeting(user.name);

    const context = contextStore.get(req.user!._id.toString()) || [];
    context.push({ role: 'assistant', content: greeting, timestamp: new Date() });
    contextStore.set(req.user!._id.toString(), context);

    res.json({ message: greeting });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = chatSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (!validateMessageSafety(value.message)) {
      return res.status(400).json({ error: 'Message contains inappropriate content' });
    }

    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let context = contextStore.get(req.user!._id.toString()) || [];
    context.push({ role: 'user', content: value.message, timestamp: new Date() });
    
    if (context.length > MAX_CONTEXT_LENGTH) {
      context = context.slice(-MAX_CONTEXT_LENGTH);
    }

    let response: string;
    let source: 'cached' | 'hardcoded' | 'ai' = 'cached';
    let detectedWeakTopic: string | undefined;

    const hardcodedResponse = getHardcodedResponse(value.message);
    if (hardcodedResponse) {
      response = hardcodedResponse;
      source = 'hardcoded';
    } else {
      const cachedResponse = await getCachedResponse(value.message);
      if (cachedResponse) {
        response = cachedResponse;
        source = 'cached';
      } else {
        const canUse = await canUseAI('chatbot');
        if (canUse) {
          const userProgress = await UserProgress.find({ userId: req.user?._id });
          
          const progressWithCourses = await Promise.all(
            userProgress.map(async (p) => {
              const course = await import('../models/Course').then(m => 
                m.default.findById(p.courseId).select('title')
              );
              return {
                courseName: course?.title || 'Unknown',
                progress: Math.round((p.completedModules.length / 10) * 100),
                score: p.score
              };
            })
          );

          const contextData = {
            userId: req.user!._id.toString(),
            userProfile: {
              name: user.name,
              grade: user.profile.grade,
              subjectInterests: user.profile.subjectInterests || [],
              weakAreas: user.profile.weakAreas || [],
              preferredLearningStyle: user.profile.preferredLearningStyle || 'mixed',
              learningGoals: user.profile.learningGoals || [],
              currentPerformanceLevel: user.profile.currentPerformanceLevel || 'average',
              pacePreference: user.profile.pacePreference || 'medium'
            },
            learningHistory: progressWithCourses,
            cognitiveLoadScore: user.cognitiveLoad || 50,
            currentStreak: user.progress?.currentStreak || 0,
            completedCourses: userProgress.filter(p => p.completed).length,
            enrolledCourses: userProgress.length,
            intent: user.intent
          };

          const aiResult = await generateChatResponse(value.message, contextData);
          response = aiResult.response;
          detectedWeakTopic = aiResult.detectedWeakTopic;
          source = 'ai';

          await cacheResponse(value.message, response, 'ai');
          await incrementAIUsage('chatbot');
        } else {
          response = "AI daily limit reached. Please try again tomorrow or check cached responses.";
          source = 'cached';
        }
      }
    }

    const weakCheck = isWeakTopicMessage(value.message);
    if (weakCheck.isWeak && weakCheck.topic) {
      detectedWeakTopic = weakCheck.topic;
    }

    context.push({ role: 'assistant', content: response, timestamp: new Date() });
    contextStore.set(req.user!._id.toString(), context);

    res.json({ 
      message: response,
      source,
      detectedWeakTopic: detectedWeakTopic ? {
        topic: detectedWeakTopic,
        subject: user.profile.subjectInterests[0] || 'General'
      } : null,
      context: context.slice(-5)
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to get response' });
  }
});

router.post('/add-weak-topic', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, subject } = req.body;
    if (!topic || !subject) {
      return res.status(400).json({ error: 'Topic and subject required' });
    }

    await addWeakTopicFromChat(req.user!._id, topic, subject);
    
    await createUserTodos(req.user!._id.toString(), subject, topic);

    res.json({ message: 'Topic added to weak areas and todo created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add weak topic' });
  }
});

router.get('/suggestion', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userProgress = await UserProgress.find({ userId: req.user?._id });

    const nextTodo = await getNextIncompleteTopic(req.user!._id.toString());
    
    if (nextTodo) {
      const cachedVideos = await getCachedVideos(nextTodo.topicTitle, nextTodo.subject);
      if (cachedVideos) {
        return res.json({
          suggestion: `Continue learning: ${nextTodo.topicTitle}`,
          reason: `This is your next topic in ${nextTodo.subject}`,
          priority: 'high',
          topic: nextTodo.topicTitle,
          subject: nextTodo.subject,
          videos: cachedVideos
        });
      }
    }

    const contextData = {
      userId: req.user!._id.toString(),
      userProfile: {
        name: user.name,
        grade: user.profile.grade,
        subjectInterests: user.profile.subjectInterests || [],
        weakAreas: user.profile.weakAreas || [],
        preferredLearningStyle: user.profile.preferredLearningStyle || 'mixed',
        learningGoals: user.profile.learningGoals || [],
        currentPerformanceLevel: user.profile.currentPerformanceLevel || 'average',
        pacePreference: user.profile.pacePreference || 'medium'
      },
      learningHistory: [],
      cognitiveLoadScore: user.cognitiveLoad || 50,
      currentStreak: user.progress?.currentStreak || 0,
      completedCourses: userProgress.filter(p => p.completed).length,
      enrolledCourses: userProgress.length,
      intent: user.intent
    };

    const suggestion = await generateLearningSuggestion(contextData);
    res.json(suggestion);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/weak-topics', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const topics = await WeakTopic.find({ userId: req.user?._id }).sort({ createdAt: -1 });
    res.json({ topics });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/weak-topics/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { completed } = req.body;
    const topic = await WeakTopic.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?._id },
      { 
        completed: completed || false,
        completedAt: completed ? new Date() : undefined
      },
      { new: true }
    );
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    res.json({ topic });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/weak-topics/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await WeakTopic.findOneAndDelete({ _id: req.params.id, userId: req.user?._id });
    res.json({ message: 'Topic removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/weak-topics/:id/videos', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const topic = await WeakTopic.findOne({ _id: req.params.id, userId: req.user?._id });
    if (!topic) return res.status(404).json({ error: 'Topic not found' });

    const cachedVideos = await getCachedVideos(topic.topicName, topic.subject);
    if (cachedVideos) {
      return res.json({ videos: cachedVideos, source: 'cached' });
    }

    const videos = await searchYouTubeVideos(topic.topicName, topic.subject);
    
    if (videos && videos.length > 0) {
      await cacheVideos(topic.topicName, topic.subject, videos);
    }
    
    res.json({ videos: videos.length > 0 ? videos : getFallbackVideos(topic.topicName, topic.subject) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get videos' });
  }
});

router.get('/next-video', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const incompleteTopics = await WeakTopic.find({ 
      userId: req.user?._id, 
      completed: false 
    }).sort({ createdAt: 1 });

    if (incompleteTopics.length === 0) {
      return res.json({ 
        message: 'No weak topics. Great job!',
        topic: null,
        videos: [] 
      });
    }

    const nextTopic = incompleteTopics[0];
    
    const cachedVideos = await getCachedVideos(nextTopic.topicName, nextTopic.subject);
    if (cachedVideos) {
      return res.json({
        topic: nextTopic,
        videos: cachedVideos,
        source: 'cached'
      });
    }

    const videos = await searchYouTubeVideos(nextTopic.topicName, nextTopic.subject);
    
    if (videos && videos.length > 0) {
      await cacheVideos(nextTopic.topicName, nextTopic.subject, videos);
    }

    res.json({
      topic: nextTopic,
      videos: videos.length > 0 ? videos : getFallbackVideos(nextTopic.topicName, nextTopic.subject)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get next video' });
  }
});

router.post('/weak-topics/:id/generate-todo', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const topic = await WeakTopic.findOne({ _id: req.params.id, userId: req.user?._id });
    if (!topic) return res.status(404).json({ error: 'Topic not found' });

    const todoItems = await generateTodoListForWeakTopic(topic.topicName, topic.subject);
    res.json({ todoItems });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate todo' });
  }
});

router.get('/todos', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const todos = await getUserTodos(req.user!._id.toString());
    res.json({ todos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get todos' });
  }
});

router.put('/todos/:id/complete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const success = await markTodoComplete(req.params.id, req.user!._id.toString());
    if (!success) return res.status(404).json({ error: 'Todo not found' });
    res.json({ message: 'Todo marked as complete' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

router.get('/context', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const context = contextStore.get(req.user!._id.toString()) || [];
    res.json({ context: context.slice(-10) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/clear-context', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    contextStore.delete(req.user!._id.toString());
    res.json({ message: 'Chat context cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
