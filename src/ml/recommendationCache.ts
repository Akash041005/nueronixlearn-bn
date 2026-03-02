import RecommendationCache from '../models/RecommendationCache';
import { IVideoRecommendation } from '../models/RecommendationCache';

export async function getCachedVideos(
  topicName: string, 
  subject: string
): Promise<IVideoRecommendation[] | null> {
  const normalizedTopic = topicName.toLowerCase().trim();
  const normalizedSubject = subject.toLowerCase().trim();
  
  const cached = await RecommendationCache.findOne({
    topicName: normalizedTopic,
    subject: normalizedSubject
  });
  
  if (cached) {
    return cached.videos;
  }
  
  return null;
}

export async function cacheVideos(
  topicName: string,
  subject: string,
  videos: IVideoRecommendation[]
): Promise<void> {
  const normalizedTopic = topicName.toLowerCase().trim();
  const normalizedSubject = subject.toLowerCase().trim();
  
  await RecommendationCache.findOneAndUpdate(
    { topicName: normalizedTopic, subject: normalizedSubject },
    {
      topicName: normalizedTopic,
      subject: normalizedSubject,
      videos,
      createdAt: new Date()
    },
    { upsert: true }
  );
}

export function getFallbackVideos(
  topic: string, 
  subject: string
): IVideoRecommendation[] {
  const fallbackVideos: Record<string, IVideoRecommendation[]> = {
    math: [
      { title: `${topic} - Complete Tutorial`, url: '', thumbnail: '', duration: '15 min', channelName: 'Khan Academy' },
      { title: `${topic} - Step by Step`, url: '', thumbnail: '', duration: '20 min', channelName: 'Vedantu' }
    ],
    physics: [
      { title: `${topic} - Physics Explained`, url: '', thumbnail: '', duration: '18 min', channelName: 'Khan Academy' },
      { title: `${topic} - Concept Clear`, url: '', thumbnail: '', duration: '25 min', channelName: 'Physics Wallah' }
    ],
    chemistry: [
      { title: `${topic} - Chemistry Basics`, url: '', thumbnail: '', duration: '15 min', channelName: 'Khan Academy' },
      { title: `${topic} - Reactions`, url: '', thumbnail: '', duration: '20 min', channelName: 'Vedantu' }
    ],
    biology: [
      { title: `${topic} - Biology Explained`, url: '', thumbnail: '', duration: '15 min', channelName: 'Khan Academy' },
      { title: `${topic} - Diagrams`, url: '', thumbnail: '', duration: '18 min', channelName: 'Vedantu' }
    ],
    default: [
      { title: `${topic} - ${subject} Tutorial`, url: '', thumbnail: '', duration: '15 min', channelName: 'Education Channel' }
    ]
  };
  
  const subjectLower = subject.toLowerCase();
  const key = Object.keys(fallbackVideos).find(k => subjectLower.includes(k));
  
  return fallbackVideos[key || 'default'];
}
