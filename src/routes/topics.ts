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
  subject: Joi.string().min(1).max(200).required(),
  topicTitle: Joi.string().min(1).max(200).required()
});


/* ---------------- ADD SUBJECT ---------------- */

router.post('/add-subject', authenticate, async (req: AuthRequest, res: Response) => {
  try {

    const { error, value } = addSubjectSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const subject = value.subject.trim();
    const userId = req.user!._id.toString();

    const { subjectDoc, topics } = await createUserSubject(userId, subject);

    const progress = await getRoadmapProgress(userId, subject);

    res.json({
      message: 'Roadmap generated successfully',
      subject: subjectDoc,
      topics: progress?.topics || [],
      subtopics: progress?.subtopics || {}
    });

  } catch (err: any) {

    console.error('Error adding subject:', err);

    res.status(500).json({
      error: err?.message || 'Failed to add subject'
    });

  }
});


/* ---------------- GET SUBJECTS ---------------- */

router.get('/subjects', authenticate, async (req: AuthRequest, res: Response) => {

  try {

    let subjects = await getUserSubjects(req.user!._id.toString());

    if (subjects.length === 0) {

      const user = await User.findById(req.user!._id);

      const weakAreas: string[] = user?.profile?.weakAreas || [];
      const subjectInterests: string[] = user?.profile?.subjectInterests || [];

      const allAreas = [...new Set([...weakAreas, ...subjectInterests])];

      if (allAreas.length > 0) {

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


/* ---------------- ROADMAP ---------------- */

router.get('/roadmap/:subject', authenticate, async (req: AuthRequest, res: Response) => {

  try {

    const subject = decodeURIComponent(req.params.subject);

    const progress = await getRoadmapProgress(
      req.user!._id.toString(),
      subject
    );

    const nextTopic = await getNextIncompleteTopic(
      req.user!._id.toString(),
      subject
    );

    res.json({
      topics: progress?.topics || [],
      subtopics: progress?.subtopics || {},
      nextTopic
    });

  } catch (err) {

    console.error('Error fetching roadmap:', err);

    res.status(500).json({ error: 'Failed to fetch roadmap' });

  }

});


/* ---------------- COMPLETE TOPIC ---------------- */

router.post('/complete-topic', authenticate, async (req: AuthRequest, res: Response) => {

  try {

    const { error, value } = completeTopicSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

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


/* ---------------- COMPLETE SUBTOPIC ---------------- */

router.post('/complete-subtopic', authenticate, async (req: AuthRequest, res: Response) => {

  try {

    const { error, value } = completeSubtopicSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

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


/* ---------------- NEXT TOPIC ---------------- */

router.get('/next/:subject', authenticate, async (req: AuthRequest, res: Response) => {

  try {

    const subject = decodeURIComponent(req.params.subject);

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


/* ---------------- SUBTOPICS ---------------- */

router.get('/subtopics/:subject/:topicTitle', authenticate, async (req: AuthRequest, res: Response) => {

  try {

    const subject = decodeURIComponent(req.params.subject);
    const topicTitle = decodeURIComponent(req.params.topicTitle);

    const subtopics = await generateAndStoreSubtopics(
      req.user!._id.toString(),
      subject,
      topicTitle
    );

    res.json({
      subtopics: subtopics || []
    });

  } catch (err) {

    console.error('Error fetching subtopics:', err);

    res.status(500).json({ error: 'Failed to fetch subtopics' });

  }

});


/* ---------------- SUBTOPIC RESOURCES ---------------- */

router.get('/resources/subtopic/:subject/:topicTitle/:subtopicTitle', authenticate, async (req: AuthRequest, res: Response) => {

  try {

    const subject = decodeURIComponent(req.params.subject);
    const topicTitle = decodeURIComponent(req.params.topicTitle);
    const subtopicTitle = decodeURIComponent(req.params.subtopicTitle);

    const resources = await getResourcesForSubtopic(
      subtopicTitle,
      topicTitle,
      subject
    );

    res.json(resources || { videos: [], blogs: [] });

  } catch (err) {

    console.error('Error fetching subtopic resources:', err);

    res.status(500).json({ error: 'Failed to fetch resources' });

  }

});


/* ---------------- RESOURCES ---------------- */

router.get('/resources/:subject/:topic', authenticate, async (req: AuthRequest, res: Response) => {

  try {

    const subject = decodeURIComponent(req.params.subject);
    const topic = decodeURIComponent(req.params.topic);

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

    res.json(resources || { videos: [], blogs: [] });

  } catch (err) {

    console.error('Error fetching resources:', err);

    res.status(500).json({ error: 'Failed to fetch resources' });

  }

});


/* ---------------- DELETE SUBJECT ---------------- */

router.delete('/subject/:id', authenticate, async (req: AuthRequest, res: Response) => {

  try {

    await deleteUserSubject(req.user!._id.toString(), req.params.id);

    res.json({ message: 'Subject deleted successfully' });

  } catch (err) {

    console.error('Error deleting subject:', err);

    res.status(500).json({ error: 'Failed to delete subject' });

  }

});


/* ---------------- INITIALIZE FROM WEAK AREAS ---------------- */

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