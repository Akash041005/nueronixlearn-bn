import keyManager from './keyManager';

export interface VideoRecommendation {
  videoId: string;
  title: string;
  channelName: string;
  duration: string;
  url?: string;
  thumbnail?: string;
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function searchYouTubeAPI(query: string): Promise<VideoRecommendation[]> {
  if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY.startsWith('AIza')) {
    return [];
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('YouTube API error:', data.error);
      return [];
    }

    const videos: VideoRecommendation[] = (data.items || []).map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelName: item.snippet.channelTitle,
      duration: '',
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`
    }));

    return videos;
  } catch (error) {
    console.error('YouTube search error:', error);
    return [];
  }
}

export async function searchYouTubeVideos(topic: string, subject: string): Promise<VideoRecommendation[]> {
  const searchQuery = `${subject} ${topic} tutorial for beginners`;
  
  // Try YouTube API first
  const youtubeVideos = await searchYouTubeAPI(searchQuery);
  
  if (youtubeVideos.length > 0) {
    return youtubeVideos;
  }
  
  // Fallback to Gemini AI if no YouTube API key
  let keyIndex = -1;
  try {
    const { client, keyIndex: idx } = keyManager.getChatbotClient();
    keyIndex = idx;
    
    if (!client) {
      return getYouTubeSearchFallback(topic, subject);
    }
    
    const prompt = `Search for educational YouTube videos about "${searchQuery}".
    
    Return a JSON array of 3 video recommendations with this exact format:
    [
      {
        "videoId": "YouTube video ID (11 chars)",
        "title": "Video title",
        "channelName": "Channel name", 
        "duration": "duration in minutes"
      }
    ]
    
    IMPORTANT: Use real YouTube video IDs that actually exist on YouTube.
    
    If you cannot find real video IDs, return an empty array [].`;
    
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const videos = JSON.parse(jsonMatch[0]);
      // Add search URL to each video for fallback
      return videos.map((v: VideoRecommendation) => ({
        ...v,
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(subject + ' ' + topic + ' ' + v.title)}`
      }));
    }
    
    return getYouTubeSearchFallback(topic, subject);
  } catch (error) {
    console.error('Video search error:', error);
    if (keyIndex >= 0) keyManager.reportChatbotError(keyIndex);
    return getYouTubeSearchFallback(topic, subject);
  } finally {
    if (keyIndex >= 0) keyManager.releaseChatbotKey(keyIndex);
  }
}

function getYouTubeSearchFallback(topic: string, subject: string): VideoRecommendation[] {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(subject + ' ' + topic + ' tutorial')}`;
  
  return [
    {
      videoId: '',
      title: `Search ${topic} ${subject} tutorials on YouTube`,
      channelName: 'Click to search YouTube',
      duration: '',
      url: searchUrl
    },
    {
      videoId: '',
      title: `${topic} - ${subject} for Beginners`,
      channelName: 'Click to search YouTube', 
      duration: '',
      url: searchUrl
    },
    {
      videoId: '',
      title: `Learn ${topic} in ${subject}`,
      channelName: 'Click to search YouTube',
      duration: '',
      url: searchUrl
    }
  ];
}

export async function getVideosForWeakTopics(
  topics: string[],
  subject: string
): Promise<Map<string, VideoRecommendation[]>> {
  const videoMap = new Map<string, VideoRecommendation[]>();
  
  for (const topic of topics) {
    const videos = await searchYouTubeVideos(topic, subject);
    videoMap.set(topic, videos);
  }
  
  return videoMap;
}

export async function generateTodoListForWeakTopic(
  topic: string,
  subject: string
): Promise<string[]> {
  const prompt = `Break down "${topic}" in ${subject} into 5-7 learning steps.
  
  Return a JSON array of strings:
  ["step 1", "step 2", "step 3", ...]`;

  let keyIndex = -1;
  try {
    const { client, keyIndex: idx } = keyManager.getChatbotClient();
    keyIndex = idx;
    
    if (!client) {
      return [`Understand ${topic} basics`, `Learn ${topic} concepts`, `Practice ${topic}`, `Review ${topic}`, `Test ${topic}`];
    }
    
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return [`Understand ${topic} basics`, `Learn ${topic} concepts`, `Practice ${topic}`];
  } catch (error) {
    console.error('Todo generation error:', error);
    if (keyIndex >= 0) keyManager.reportChatbotError(keyIndex);
    return [`Understand ${topic} basics`, `Learn ${topic} concepts`, `Practice ${topic}`];
  } finally {
    if (keyIndex >= 0) keyManager.releaseChatbotKey(keyIndex);
  }
}
