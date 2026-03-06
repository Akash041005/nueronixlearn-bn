import keyManager from './keyManager';

export interface VideoResource {
  title: string;
  thumbnail?: string;
  url: string;
  channelName?: string;
  duration?: string;
}

export interface BlogResource {
  title: string;
  url: string;
  source: 'Wikipedia' | 'GeeksForGeeks' | 'Blog' | 'Documentation';
  description?: string;
}

export interface Resources {
  videos: VideoResource[];
  blogs: BlogResource[];
  aiUnavailable?: boolean;  // true when AI/YouTube APIs are unavailable
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

function buildSearchQuery(subtopic: string, topic: string, subject: string): string {
  // Format: "subject topic subtopic" — puts broad context first so YouTube/search
  // can narrow down to the exact concept. e.g. "javascript variables let vs const"
  return `${subject} ${topic} ${subtopic}`;
}

async function searchYouTube(query: string): Promise<VideoResource[]> {
  if (!YOUTUBE_API_KEY) {
    console.log('No YouTube API key, using fallback');
    return getYouTubeFallback(query);
  }

  try {
    console.log('Searching YouTube with API key for:', query);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json() as any;

    if (data.error) {
      console.error('YouTube API error:', data.error);
      return getYouTubeFallback(query);
    }

    if (!data.items || data.items.length === 0) {
      console.log('No YouTube results, using fallback');
      return getYouTubeFallback(query);
    }

    const videos = (data.items || []).map((item: any) => ({
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      channelName: item.snippet.channelTitle
    }));

    console.log('YouTube API returned:', videos.length, 'videos');
    return videos;
  } catch (error) {
    console.error('YouTube search error:', error);
    return getYouTubeFallback(query);
  }
}

function getYouTubeFallback(query: string): VideoResource[] {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  
  return [
    {
      title: `Search "${query}" tutorials on YouTube`,
      url: searchUrl,
      channelName: 'Click to search YouTube'
    },
    {
      title: `${query} - Complete Tutorial`,
      url: searchUrl,
      channelName: 'Click to search YouTube'
    },
    {
      title: `Learn ${query}`,
      url: searchUrl,
      channelName: 'Click to search YouTube'
    }
  ];
}

function searchWikipedia(topic: string): BlogResource {
  return {
    title: `${topic} - Wikipedia`,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/ /g, '_'))}`,
    source: 'Wikipedia',
    description: 'Encyclopedia article'
  };
}

function searchGeeksForGeeks(topic: string, subject: string): BlogResource {
  const gfgTopic = `${subject} ${topic}`.toLowerCase().replace(/ /g, '-');
  return {
    title: `${topic} - GeeksforGeeks`,
    url: `https://www.geeksforgeeks.org/${encodeURIComponent(gfgTopic)}`,
    source: 'GeeksForGeeks',
    description: 'Computer science tutorials'
  };
}

function getDocumentationLinks(topic: string, subject: string): BlogResource[] {
  const docLinks: BlogResource[] = [];
  const topicLower = topic.toLowerCase();
  const subjectLower = subject.toLowerCase();

  if (subjectLower === 'python' || topicLower.includes('python')) {
    docLinks.push({
      title: 'Python Documentation',
      url: 'https://docs.python.org/3/',
      source: 'Documentation'
    });
  }

  if (subjectLower === 'javascript' || topicLower.includes('javascript') || topicLower.includes('js')) {
    docLinks.push({
      title: 'MDN JavaScript Guide',
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
      source: 'Documentation'
    });
  }

  if (subjectLower === 'react' || topicLower.includes('react')) {
    docLinks.push({
      title: 'React Documentation',
      url: 'https://react.dev/',
      source: 'Documentation'
    });
  }

  if (subjectLower === 'nodejs' || topicLower.includes('node') || topicLower.includes('express')) {
    docLinks.push({
      title: 'Node.js Documentation',
      url: 'https://nodejs.org/docs/',
      source: 'Documentation'
    });
  }

  if (subjectLower === 'sql' || topicLower.includes('database') || topicLower.includes('sql')) {
    docLinks.push({
      title: 'SQL Documentation',
      url: 'https://www.w3schools.com/sql/',
      source: 'Documentation'
    });
  }

  if (subjectLower === 'machine_learning' || subjectLower === 'ml' || topicLower.includes('machine learning')) {
    docLinks.push({
      title: 'Scikit-learn Documentation',
      url: 'https://scikit-learn.org/stable/',
      source: 'Documentation'
    });
  }

  return docLinks;
}

async function searchBlogsWithAI(subtopic: string, topic: string, subject: string): Promise<BlogResource[]> {
  const { client } = keyManager.getChatbotClient();
  
  if (!client) {
    return getDefaultBlogResources(subtopic, topic, subject);
  }

  try {
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const searchQuery = buildSearchQuery(subtopic, topic, subject);
    
    const prompt = `Find helpful blog posts, tutorials, and documentation links for learning "${subtopic}" in the context of "${topic}" topic for ${subject}.
    
Return ONLY a JSON array of up to 3 resources with this format:
[
  { "title": "Resource Title", "url": "https://...", "description": "Brief description" }
]

Only include real, working URLs. Focus on well-known educational resources like Wikipedia, GeeksForGeeks, MDN, official documentation, and quality blogs.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const match = response.match(/\[[\s\S]*\]/);
    if (match) {
      const blogs = JSON.parse(match[0]);
      return blogs.map((b: any) => ({
        title: b.title,
        url: b.url,
        source: 'Blog' as const,
        description: b.description
      }));
    }
  } catch (error) {
    console.error('Blog search error:', error);
  }

  return getDefaultBlogResources(subtopic, topic, subject);
}

function getDefaultBlogResources(subtopic: string, topic: string, subject: string): BlogResource[] {
  const subtopicEncoded = encodeURIComponent(subtopic.toLowerCase().replace(/ /g, '-'));
  const subjectEncoded = encodeURIComponent(subject.toLowerCase().replace(/ /g, '-'));
  const topicEncoded = encodeURIComponent(topic.toLowerCase().replace(/ /g, '-'));
  
  return [
    {
      title: `${subtopic} Tutorial - TutorialsPoint`,
      url: `https://www.tutorialspoint.com/${subjectEncoded}/${subtopicEncoded}.htm`,
      source: 'Blog',
      description: 'Free online tutorials'
    },
    {
      title: `${subtopic} - Javatpoint`,
      url: `https://www.javatpoint.com/${subtopicEncoded}`,
      source: 'Blog',
      description: 'JavaTPoint tutorials'
    },
    {
      title: `${subtopic} - W3Schools`,
      url: `https://www.w3schools.com/${subjectEncoded}/${subtopicEncoded}`,
      source: 'Blog',
      description: 'W3Schools online learning'
    },
    {
      title: `${subtopic} - Programiz`,
      url: `https://www.programiz.com/${subjectEncoded}/${subtopicEncoded}`,
      source: 'Blog',
      description: 'Programiz tutorials'
    }
  ];
}

export async function getResourcesForSubtopic(
  subtopic: string,
  topic: string,
  subject: string
): Promise<Resources> {
  const searchQuery = buildSearchQuery(subtopic, topic, subject);

  let videos: VideoResource[] = [];
  let blogsFromAI: BlogResource[] = [];
  let aiUnavailable = false;

  try {
    videos = await searchYouTube(searchQuery);
  } catch (error) {
    console.error('YouTube search failed, using fallback:', error);
    videos = getYouTubeFallback(searchQuery);
  }

  if (videos.length === 0) {
    videos = getYouTubeFallback(searchQuery);
  }

  try {
    blogsFromAI = await searchBlogsWithAI(subtopic, topic, subject);
  } catch (error: any) {
    console.error('Blog search failed, using fallback:', error);
    // Detect AI quota/credit exhaustion errors
    const msg = (error?.message || '').toLowerCase();
    if (
      msg.includes('quota') ||
      msg.includes('credit') ||
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('resource_exhausted') ||
      (error?.status === 429)
    ) {
      aiUnavailable = true;
    }
    blogsFromAI = getDefaultBlogResources(subtopic, topic, subject);
  }

  const wikiLink = searchWikipedia(subtopic);
  const gfgLink = searchGeeksForGeeks(subtopic, subject);
  const docLinks = getDocumentationLinks(subtopic, subject);

  // Deduplicate blogs by URL
  const seenUrls = new Set<string>();
  const allBlogs: BlogResource[] = [];
  
  for (const blog of [wikiLink, gfgLink, ...docLinks, ...blogsFromAI]) {
    if (!seenUrls.has(blog.url)) {
      seenUrls.add(blog.url);
      allBlogs.push(blog);
    }
  }

  return {
    videos,
    blogs: allBlogs,
    aiUnavailable
  };
}

export async function getResourcesForTopic(
  topic: string,
  subject: string
): Promise<Resources> {
  // Fallback: no subtopic available — search by subject + topic
  const searchQuery = `${subject} ${topic} tutorial`;

  const [videos, blogsFromAI] = await Promise.all([
    searchYouTube(searchQuery),
    searchBlogsWithAI(topic, topic, subject)
  ]);

  const blogs: BlogResource[] = [
    searchWikipedia(topic),
    searchGeeksForGeeks(topic, subject),
    ...getDocumentationLinks(topic, subject),
    ...blogsFromAI
  ];

  return {
    videos,
    blogs
  };
}

export async function getVideosOnly(topic: string, subject: string): Promise<VideoResource[]> {
  const searchQuery = `${topic} ${subject} tutorial`;
  return searchYouTube(searchQuery);
}

export async function getBlogsOnly(topic: string, subject: string): Promise<BlogResource[]> {
  const searchQuery = `${topic} ${subject}`;
  
  const blogs: BlogResource[] = [
    searchWikipedia(topic),
    searchGeeksForGeeks(topic, subject),
    ...getDocumentationLinks(topic, subject),
    ...(await searchBlogsWithAI(topic, topic, subject))
  ];

  return blogs;
}
