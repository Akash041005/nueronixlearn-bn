import { Router, Response } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import LearningProfile from "../models/LearningProfile";
import User from "../models/User";
import { generateChatResponse } from "../ml/neuroBot";
import { generateAIVideo, fetchAllImages, generatePollinationsFallback } from "../services/videoService";

const router = Router();

const POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt";

interface Slide {
  type: "title" | "explanation" | "diagram" | "example";
  content: string;
  imageUrl?: string;
}

interface VideoScript {
  intro: string;
  mainContent: string;
  example: string;
  summary: string;
}

router.get("/test", (req, res) => {
  res.json({
    message: "aiMedia routes working",
    version: "2.0.0",
    features: ["slides", "diagram", "video"]
  });
});

async function getEducationalImages(query: string, limit: number = 4): Promise<string[]> {
  try {
    const images = await fetchAllImages(query, limit);
    return images;
  } catch (error) {
    console.error('[ImageFetch] Error:', error);
    return [];
  }
}

function generateFallbackSlides(topic: string, subject: string): Slide[] {
  return [
    { type: "title", content: topic },
    { type: "explanation", content: `Understanding ${topic} in ${subject}` },
    { type: "diagram", content: `${topic} diagram` },
    { type: "example", content: `Example of ${topic}` }
  ];
}

async function generateSlideScript(
  topic: string,
  subject: string,
  experienceLevel: string,
  learningPace: string
): Promise<Slide[]> {
  const prompt = `
Create a 4-slide educational explanation about "${topic}" in ${subject}.

Experience level: ${experienceLevel}
Learning pace: ${learningPace}

Return ONLY a valid JSON array with exactly 4 slides:

[
  { "type":"title", "content":"Short engaging title for ${topic}" },
  { "type":"explanation", "content":"2-3 sentence clear explanation of ${topic}" },
  { "type":"diagram", "content":"Description of what the diagram should show" },
  { "type":"example", "content":"A simple practical example related to ${topic}" }
]

Respond ONLY with JSON, no other text.`;

  try {
    const aiResponse = await generateChatResponse(prompt, {
      userId: 'system',
      userProfile: {
        name: 'AI',
        pacePreference: learningPace,
        experienceLevel
      },
      learningHistory: [],
      cognitiveLoadScore: 50,
      currentStreak: 0,
      completedCourses: 0,
      enrolledCourses: 0,
      intent: null
    });

    const jsonMatch = aiResponse.response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const slides = JSON.parse(jsonMatch[0]) as Slide[];
      if (slides.length === 4 && slides.every(s => s.type && s.content)) {
        return slides;
      }
    }
  } catch (error) {
    console.error('[SlideScript] AI generation error:', error);
  }

  return generateFallbackSlides(topic, subject);
}

async function generateVideoScript(
  topic: string,
  subject: string,
  subtopic: string | undefined,
  experienceLevel: string,
  learningPace: string
): Promise<VideoScript> {
  const prompt = `
Create a short teaching script for an educational video about "${topic}" in ${subject}.

${subtopic ? `Subtopic: ${subtopic}` : ''}
Experience level: ${experienceLevel}
Learning pace: ${learningPace}

Create a clear, conversational script for a 60-90 second video.
Keep sentences short and simple.

Return ONLY valid JSON:

{
  "intro": "Welcome message and brief intro (15-20 words)",
  "mainContent": "Core explanation (30-40 words)",
  "example": "Simple practical example (20-30 words)",
  "summary": "Quick recap and encouragement (15-20 words)"
}

Respond ONLY with JSON, no other text.`;

  try {
    const aiResponse = await generateChatResponse(prompt, {
      userId: 'system',
      userProfile: {
        name: 'AI',
        pacePreference: learningPace,
        experienceLevel
      },
      learningHistory: [],
      cognitiveLoadScore: 50,
      currentStreak: 0,
      completedCourses: 0,
      enrolledCourses: 0,
      intent: null
    });

    const jsonMatch = aiResponse.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const script = JSON.parse(jsonMatch[0]) as VideoScript;
      if (script.intro && script.mainContent && script.example && script.summary) {
        return script;
      }
    }
  } catch (error) {
    console.error('[VideoScript] AI generation error:', error);
  }

  return {
    intro: `Welcome to learning about ${topic} in ${subject}. Let's explore this interesting topic together.`,
    mainContent: `${topic} is an important concept in ${subject}. It helps us understand how things work and provides a foundation for further learning.`,
    example: `For example, when you encounter ${topic} in real situations, you can apply this knowledge to solve problems and understand concepts better.`,
    summary: `Great job! You've learned the basics of ${topic}. Keep practicing and exploring to deepen your understanding.`
  };
}

router.post("/generate-slides", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, subject } = req.body;

    if (!topic || !subject) {
      return res.status(400).json({
        error: "Topic and subject are required"
      });
    }

    const userId = req.user!._id;
    console.log(`[Slides] Generating for: ${topic} in ${subject}`);

    const learningProfile = await LearningProfile.findOne({ userId });
    const user = await User.findById(userId);

    const learningPace = learningProfile?.learningPace || "moderate";
    const experienceLevel = learningProfile?.experienceLevel || "beginner";

    const slides = await generateSlideScript(topic, subject, experienceLevel, learningPace);

    const imageQuery = `${topic} ${subject}`;
    console.log(`[Slides] Fetching images for: ${imageQuery}`);
    
    const imageUrls = await getEducationalImages(imageQuery, 4);

    if (imageUrls.length > 0) {
      console.log(`[Slides] Found ${imageUrls.length} images`);
      
      slides.forEach((slide, idx) => {
        if (imageUrls[idx]) {
          slide.imageUrl = imageUrls[idx];
        }
      });
    } else {
      console.log(`[Slides] Using AI-generated fallback images`);
      slides.forEach((slide, idx) => {
        if (slide.type === 'diagram' || slide.type === 'explanation') {
          slide.imageUrl = generatePollinationsFallback(imageQuery, idx);
        }
      });
    }

    return res.json({
      success: true,
      topic,
      subject,
      slides,
      imageUrls,
      generatedAt: new Date()
    });

  } catch (err) {
    console.error("[Slides] Error:", err);

    return res.status(500).json({
      error: "Failed to generate slides"
    });
  }
});

router.get("/diagram/:topic/:subject", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const topic = decodeURIComponent(req.params.topic);
    const subject = decodeURIComponent(req.params.subject);

    const userId = req.user!._id;
    const learningProfile = await LearningProfile.findOne({ userId });
    const experienceLevel = learningProfile?.experienceLevel || "beginner";

    console.log(`[Diagram] Generating for: ${topic} in ${subject}`);

    const imageQuery = `${topic} ${subject} ${experienceLevel} educational diagram`;
    const imageUrls = await getEducationalImages(imageQuery, 1);

    let imageUrl: string;
    if (imageUrls.length > 0) {
      imageUrl = imageUrls[0];
    } else {
      imageUrl = generatePollinationsFallback(imageQuery, 0);
    }

    res.json({
      success: true,
      topic,
      subject,
      imageUrl,
      experienceLevel
    });

  } catch (err) {
    console.error("[Diagram] Error:", err);

    res.status(500).json({
      error: "Failed to generate diagram"
    });
  }
});

router.post("/generate-video", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, subject, subtopic } = req.body;

    if (!topic || !subject) {
      return res.status(400).json({
        error: "Topic and subject are required"
      });
    }

    const userId = req.user!._id;
    console.log(`[Video] Starting generation for: ${topic} in ${subject}`);

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
      }
    }

    const learningPace = learningProfile?.learningPace || "medium";
    const experienceLevel = learningProfile?.experienceLevel || "beginner";

    const script = await generateVideoScript(topic, subject, subtopic, experienceLevel, learningPace);
    console.log(`[Video] Script generated`);

    const imageQuery = `${topic} ${subject} ${subtopic || ''}`.trim();
    const imageUrls = await getEducationalImages(imageQuery, 6);
    console.log(`[Video] Found ${imageUrls.length} images`);

    const videoResult = await generateAIVideo(
      userId.toString(),
      subject,
      topic,
      subtopic,
      script
    );

    console.log(`[Video] Video generation complete: ${videoResult.videoUrl ? 'success' : 'failed'}`);

    return res.json({
      success: true,
      topic,
      subject,
      subtopic,
      script,
      slideImageUrl: imageUrls[0] || generatePollinationsFallback(imageQuery, 0),
      imageUrls: imageUrls.length > 0 ? imageUrls : [generatePollinationsFallback(imageQuery, 0)],
      videoUrl: videoResult.videoUrl,
      videoGenerated: !!videoResult.videoUrl,
      cached: videoResult.cached,
      message: videoResult.videoUrl 
        ? 'Video generated successfully!' 
        : 'Script and images ready. Video generation requires server-side processing.'
    });

  } catch (err) {
    console.error("[Video] Error:", err);

    return res.status(500).json({
      error: "Failed to generate video"
    });
  }
});

router.get("/video-status/:topic", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const topic = decodeURIComponent(req.params.topic);
    const userId = req.user!._id;

    const cache = await VideoCache.findOne({
      userId,
      topic: topic.toLowerCase(),
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (cache) {
      return res.json({
        status: cache.videoUrl ? 'ready' : 'processing',
        videoUrl: cache.videoUrl,
        imageUrls: cache.imageUrls,
        script: cache.script,
        cached: true
      });
    }

    return res.json({
      status: 'not_found',
      message: 'No video found for this topic'
    });

  } catch (err) {
    console.error("[VideoStatus] Error:", err);
    res.status(500).json({ error: "Failed to check video status" });
  }
});

import VideoCache from '../models/VideoCache';

export default router;
