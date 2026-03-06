import { Router, Response } from 'express';
import Joi from 'joi';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  createUserSubject,
  getUserSubjects,
  getRoadmapProgress,
  getNextIncompleteTopic,
  markTopicComplete,
  markSubtopicComplete,
  generateAndStoreSubtopics,
  deleteUserSubject,
  initializeStudyPlanFromWeakAreas
} from '../ml/roadmapService';
import { getResourcesForSubtopic, getResourcesForTopic, getVideosOnly, getBlogsOnly } from '../ml/resourceService';
import User from '../models/User';

const router = Router();

const addSubjectSchema = Joi.object({
  subject: Joi.string().min(1).max(100).required()
});

const completeSubtopicSchema = Joi.object({
  subject: Joi.string().min(1).max(100).required(),
  topicTitle: Joi.string().min(1).max(200).required(),
  subtopicTitle: Joi.string().min(1).max(200).required()
});

const completeTopicSchema = Joi.object({
  subject: Joi.string().min(1).max(100).required(),
  topicTitle: Joi.string().min(1).max(200).required()
});

router.post('/add-subject', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = addSubjectSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { subject } = value;
    const userId = req.user!._id.toString();

    // createUserSubject now handles all cases:
    //   - New subject: generate + store
    //   - Existing subject with < 6 topics: delete bad data + regenerate
    //   - Existing subject with >= 6 topics: return existing
    const { subjectDoc, topics } = await createUserSubject(userId, subject);

    // Always re-fetch full progress so we return complete subtopic data too
    const progress = await getRoadmapProgress(userId, subject);

    res.json({
      message: topics.length >= 6 ? 'Roadmap generated successfully' : 'Subject added',
      subject: subjectDoc,
      topics: progress.topics,
      subtopics: progress.subtopics
    });
  } catch (err: any) {
    console.error('Error adding subject — message:', err?.message);
    console.error('Error adding subject — stack:', err?.stack);
    res.status(500).json({ error: err?.message || 'Failed to add subject' });
  }
});

router.get('/subjects', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let subjects = await getUserSubjects(req.user!._id.toString());

    // If no subjects exist yet, auto-seed from the user's weak areas (set during onboarding)
    if (subjects.length === 0) {
      const user = await User.findById(req.user!._id);
      const weakAreas: string[] = user?.profile?.weakAreas || [];
      const subjectInterests: string[] = user?.profile?.subjectInterests || [];
      const allAreas = [...new Set([...weakAreas, ...subjectInterests])];

      if (allAreas.length > 0) {
        console.log(`Auto-seeding study plan for new user from ${allAreas.length} weak areas / interests`);
        for (const area of allAreas) {
          try {
            await createUserSubject(req.user!._id.toString(), area);
          } catch (seedErr) {
            console.error(`Failed to auto-seed subject "${area}":`, seedErr);
          }
        }
        subjects = await getUserSubjects(req.user!._id.toString());
      }
    }

    res.json({ subjects });
  } catch (err) {
    console.error('Error fetching subjects:', err);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

router.get('/roadmap/:subject', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject } = req.params;
    
    const progress = await getRoadmapProgress(
      req.user!._id.toString(),
      subject
    );

    const nextTopic = await getNextIncompleteTopic(
      req.user!._id.toString(),
      subject
    );

    res.json({
      topics: progress.topics,
      subtopics: progress.subtopics,
      nextTopic
    });
  } catch (err) {
    console.error('Error fetching roadmap:', err);
    res.status(500).json({ error: 'Failed to fetch roadmap' });
  }
});

router.post('/complete-topic', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = completeTopicSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { subject, topicTitle } = value;

    const { completed, nextTopic } = await markTopicComplete(
      req.user!._id.toString(),
      subject,
      topicTitle
    );

    if (!completed) {
      return res.status(404).json({ error: 'Topic not found or already completed' });
    }

    res.json({
      message: 'Topic completed',
      completed,
      nextTopic
    });
  } catch (err) {
    console.error('Error completing topic:', err);
    res.status(500).json({ error: 'Failed to complete topic' });
  }
});

router.post('/complete-subtopic', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { error, value } = completeSubtopicSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { subject, topicTitle, subtopicTitle } = value;

    const { completed, nextSubtopic, topicCompleted } = await markSubtopicComplete(
      req.user!._id.toString(),
      subject,
      topicTitle,
      subtopicTitle
    );

    if (!completed) {
      return res.status(404).json({ error: 'Subtopic not found or already completed' });
    }

    res.json({
      message: 'Subtopic completed',
      completed,
      nextSubtopic,
      topicCompleted
    });
  } catch (err) {
    console.error('Error completing subtopic:', err);
    res.status(500).json({ error: 'Failed to complete subtopic' });
  }
});

router.get('/next/:subject', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject } = req.params;

    const nextTopic = await getNextIncompleteTopic(
      req.user!._id.toString(),
      subject
    );

    if (!nextTopic) {
      return res.json({
        topic: null,
        message: 'All topics completed!',
        resources: { videos: [], blogs: [] }
      });
    }

    const resources = await getResourcesForTopic(nextTopic.topicTitle, subject);

    res.json({
      topic: nextTopic,
      resources
    });
  } catch (err) {
    console.error('Error fetching next topic:', err);
    res.status(500).json({ error: 'Failed to fetch next topic' });
  }
});

router.get('/subtopics/:subject/:topicTitle', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, topicTitle } = req.params;

    const subtopics = await generateAndStoreSubtopics(
      req.user!._id.toString(),
      subject,
      topicTitle
    );

    res.json({ subtopics });
  } catch (err) {
    console.error('Error fetching subtopics:', err);
    res.status(500).json({ error: 'Failed to fetch subtopics' });
  }
});

router.get('/resources/subtopic/:subject/:topicTitle/:subtopicTitle', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, topicTitle, subtopicTitle } = req.params;

    console.log('Fetching resources for:', { subject, topicTitle, subtopicTitle });

    const resources = await getResourcesForSubtopic(subtopicTitle, topicTitle, subject);

    res.json(resources);
  } catch (err) {
    console.error('Error fetching subtopic resources:', err);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

router.get('/resources/:subject/:topic', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, topic } = req.params;
    const type = req.query.type as string;

    let resources;
    if (type === 'videos') {
      const videos = await getVideosOnly(topic, subject);
      resources = { videos, blogs: [] };
    } else if (type === 'blogs') {
      const blogs = await getBlogsOnly(topic, subject);
      resources = { videos: [], blogs };
    } else {
      resources = await getResourcesForTopic(topic, subject);
    }

    res.json(resources);
  } catch (err) {
    console.error('Error fetching resources:', err);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

router.delete('/subject/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await deleteUserSubject(req.user!._id.toString(), req.params.id);
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    console.error('Error deleting subject:', err);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

router.post('/initialize-from-weak-areas', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const createdSubjects = await initializeStudyPlanFromWeakAreas(req.user!._id.toString());
    res.json({
      message: 'Study plan initialized from weak areas',
      createdSubjects
    });
  } catch (err) {
    console.error('Error initializing study plan:', err);
    res.status(500).json({ error: 'Failed to initialize study plan' });
  }
});

export default router;
