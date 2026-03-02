import Course from '../models/Course';
import UserProgress from '../models/UserProgress';
import Recommendation from '../models/Recommendation';
import Feedback from '../models/Feedback';
import User from '../models/User';

import {
  generateStructuredRecommendations,
  analyzeFeedbackAndAdjust,
  detectIntent,
  validateRecommendationSafety,
  RecommendationRequest,
  StructuredRecommendation
} from './geminiService';

/* =====================================================
   BUILD AI REQUEST
===================================================== */

async function buildRecommendationRequest(
  userId: string
): Promise<RecommendationRequest | null> {
  const user = await User.findById(userId);
  if (!user) return null;

  const userProgress = await UserProgress.find({ userId });

  const completedCourseIds = userProgress
    .filter(p => p.completed)
    .map(p => p.courseId);

  const completedCourses = await Course.find({
    _id: { $in: completedCourseIds }
  }).select('title concepts');

  const feedbackHistory = await Feedback.find({ userId })
    .sort({ createdAt: -1 })
    .limit(10);

  // ✅ SAFE COPY
  const allWeakAreas = [...(user.profile.weakAreas || [])];

  completedCourses.forEach(course => {
    if (course.concepts?.length) {
      allWeakAreas.push(...course.concepts);
    }
  });

  const recentLoads = userProgress
    .flatMap(p => p.cognitiveLoadHistory || [])
    .slice(-10);

  const avgLoad =
    recentLoads.length > 0
      ? recentLoads.reduce((sum, h) => sum + h.loadLevel, 0) /
        recentLoads.length
      : 50;

  const intent = user.intent || detectIntent(user.profile);

  return {
    userProfile: {
      grade: user.profile.grade || '',
      subjectInterests: user.profile.subjectInterests || [],
      weakAreas: [...new Set(allWeakAreas)],
      preferredLearningStyle:
        user.profile.preferredLearningStyle || 'mixed',
      learningGoals: user.profile.learningGoals || [],
      currentPerformanceLevel:
        user.profile.currentPerformanceLevel || 'average',
      pacePreference: user.profile.pacePreference || 'medium'
    },
    learningHistory: userProgress.map(p => ({
      courseId: p.courseId.toString(),
      title:
        completedCourses.find(
          c => c._id.toString() === p.courseId.toString()
        )?.title || '',
      completed: p.completed,
      score: p.score || 0
    })),
    weakConcepts: [...new Set(allWeakAreas)],
    feedbackNotes: feedbackHistory.map(f => f.feedback),
    cognitiveLoadScore: Math.round(avgLoad),
    intent
  };
}

/* =====================================================
   MAIN RECOMMENDATION
===================================================== */

export async function getGeminiRecommendations(
  userId: string
): Promise<StructuredRecommendation> {
  const request = await buildRecommendationRequest(userId);

  if (!request) {
    return {
      recommendedCourses: [],
      priorityLevel: 'medium',
      estimatedCompletionTime: 'Unable to calculate',
      difficultyLevel: 'intermediate',
      reasoning: 'User profile not found',
      nextSteps: ['Complete your profile']
    };
  }

  const recommendation =
    await generateStructuredRecommendations(request);

  if (!validateRecommendationSafety(recommendation)) {
    return {
      recommendedCourses: [],
      priorityLevel: 'medium',
      estimatedCompletionTime: 'Unavailable',
      difficultyLevel: 'intermediate',
      reasoning: 'Safety validation failed',
      nextSteps: ['Contact support']
    };
  }

  // Faster mapping using Map
  const titles = recommendation.recommendedCourses.map(c => c.title);
  const courseDocs = await Course.find({ title: { $in: titles } });

  const courseMap = new Map(
    courseDocs.map(c => [c.title, c._id])
  );

  const intent = request.intent;

  const dbRecommendation = new Recommendation({
    userId,
    intent,
    recommendedCourses:
      recommendation.recommendedCourses.map(c => ({
        courseId: courseMap.get(c.title) || undefined,
        title: c.title,
        reason: c.reason
      })),
    priorityLevel: recommendation.priorityLevel,
    estimatedCompletionTime:
      recommendation.estimatedCompletionTime,
    difficultyLevel: recommendation.difficultyLevel,
    reasoning: recommendation.reasoning,
    nextSteps: recommendation.nextSteps,
    cognitiveLoadAtTime: request.cognitiveLoadScore
  });

  await dbRecommendation.save();

  await User.findByIdAndUpdate(userId, {
    intent,
    onboardingCompleted: true
  });

  return recommendation;
}

/* =====================================================
   HANDLE FEEDBACK
===================================================== */

export async function handleUserFeedback(
  userId: string,
  feedbackText: string,
  feedbackType: 'difficulty' | 'pace' | 'content' | 'general',
  courseId?: string
): Promise<StructuredRecommendation> {
  const user = await User.findById(userId);

  const latestRecommendation = await Recommendation.findOne({
    userId
  }).sort({ generatedAt: -1 });

  if (!latestRecommendation) {
    throw new Error('No previous recommendation found');
  }

  await Feedback.create({
    userId,
    courseId,
    type: feedbackType,
    feedback: feedbackText,
    cognitiveLoadAtTime: user?.cognitiveLoad || 50,
    recommendationId: latestRecommendation._id
  });

  const adjustedRecommendation =
    await analyzeFeedbackAndAdjust(
      {
        recommendedCourses:
          latestRecommendation.recommendedCourses.map(c => ({
            courseId: c.courseId?.toString() || '',
            title: c.title,
            reason: c.reason
          })),
        priorityLevel: latestRecommendation.priorityLevel,
        estimatedCompletionTime:
          latestRecommendation.estimatedCompletionTime,
        difficultyLevel:
          latestRecommendation.difficultyLevel,
        reasoning: latestRecommendation.reasoning,
        nextSteps: latestRecommendation.nextSteps
      },
      feedbackText,
      user?.cognitiveLoad || 50
    );

  const titles =
    adjustedRecommendation.recommendedCourses.map(
      c => c.title
    );

  const courseDocs = await Course.find({
    title: { $in: titles }
  });

  const courseMap = new Map(
    courseDocs.map(c => [c.title, c._id])
  );

  const newRecommendation = new Recommendation({
    userId,
    intent: latestRecommendation.intent,
    recommendedCourses:
      adjustedRecommendation.recommendedCourses.map(
        c => ({
          courseId: courseMap.get(c.title) || undefined,
          title: c.title,
          reason: c.reason
        })
      ),
    priorityLevel: adjustedRecommendation.priorityLevel,
    estimatedCompletionTime:
      adjustedRecommendation.estimatedCompletionTime,
    difficultyLevel: adjustedRecommendation.difficultyLevel,
    reasoning: adjustedRecommendation.reasoning,
    nextSteps: adjustedRecommendation.nextSteps,
    cognitiveLoadAtTime: user?.cognitiveLoad || 50,
    feedbackHistory: [
      {
        feedback: feedbackText,
        timestamp: new Date(),
        adjustedRecommendation: true
      }
    ]
  });

  await newRecommendation.save();

  return adjustedRecommendation;
}