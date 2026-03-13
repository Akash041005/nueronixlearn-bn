import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import VideoCache from '../models/VideoCache';

const execAsync = promisify(exec);

const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php';
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const VIDEOS_DIR = path.join(PUBLIC_DIR, 'videos');

if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

interface ImageSource {
  name: string;
  fetch: (query: string, limit: number) => Promise<string[]>;
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWikimediaImages(query: string, limit: number = 6): Promise<string[]> {
  try {
    console.log(`[Wikimedia] Fetching images for: ${query}`);
    
    const searchTerms = query.split(' ').slice(0, 3).join(' ');
    
    const response = await axios.get(WIKIMEDIA_API, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: `${searchTerms} diagram OR chart OR illustration`,
        srlimit: Math.min(limit * 2, 20),
        format: 'json',
        origin: '*'
      },
      timeout: 10000
    });

    const searchResults = response.data?.query?.search || [];
    
    if (searchResults.length === 0) {
      console.log('[Wikimedia] No results found');
      return [];
    }

    const imageUrls: string[] = [];
    const processedTitles = new Set<string>();
    
    for (const result of searchResults.slice(0, limit * 2)) {
      if (imageUrls.length >= limit) break;
      
      const title = result.title;
      if (processedTitles.has(title)) continue;
      processedTitles.add(title);

      try {
        const imageInfo = await axios.get(WIKIMEDIA_API, {
          params: {
            action: 'query',
            titles: title,
            prop: 'imageinfo',
            iiprop: 'url|extmetadata',
            iiurlwidth: 800,
            iiurlheight: 600,
            format: 'json',
            origin: '*'
          },
          timeout: 8000
        });

        const pages = imageInfo.data?.query?.pages || {};
        for (const pageId in pages) {
          const page = pages[pageId];
          if (page.imageinfo && page.imageinfo[0]) {
            const info = page.imageinfo[0];
            const thumbUrl = info.thumburl || info.url;
            
            if (thumbUrl && !thumbUrl.includes('/special/')) {
              const ext = info.extmetadata?.FileExtension?.value || 'jpg';
              if (!['svg', 'gif'].includes(ext)) {
                imageUrls.push(thumbUrl);
                console.log(`[Wikimedia] Found: ${title} -> ${thumbUrl.substring(0, 60)}...`);
              }
            }
          }
        }
        
        await delay(100);
        
      } catch (imgErr) {
        console.log(`[Wikimedia] Error fetching: ${title}`);
      }
    }

    console.log(`[Wikimedia] Found ${imageUrls.length} images`);
    return imageUrls;
    
  } catch (error) {
    console.error('[Wikimedia] API error:', error instanceof Error ? error.message : 'Unknown');
    return [];
  }
}

async function fetchUnsplashImages(query: string, limit: number = 6): Promise<string[]> {
  try {
    const apiKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!apiKey) {
      console.log('[Unsplash] No API key configured');
      return [];
    }

    console.log(`[Unsplash] Fetching images for: ${query}`);
    
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: query,
        per_page: limit,
        orientation: 'landscape'
      },
      headers: {
        Authorization: `Client-ID ${apiKey}`
      },
      timeout: 10000
    });

    const urls = (response.data.results || [])
      .filter((photo: any) => photo.urls?.regular)
      .map((photo: any) => photo.urls.regular);

    console.log(`[Unsplash] Found ${urls.length} images`);
    return urls;
    
  } catch (error) {
    console.log('[Unsplash] Error:', error instanceof Error ? error.message : 'Unknown');
    return [];
  }
}

async function fetchPexelsImages(query: string, limit: number = 6): Promise<string[]> {
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      console.log('[Pexels] No API key configured');
      return [];
    }

    console.log(`[Pexels] Fetching images for: ${query}`);
    
    const response = await axios.get('https://api.pexels.com/v1/search', {
      params: {
        query: query,
        per_page: limit,
        orientation: 'landscape'
      },
      headers: {
        Authorization: apiKey
      },
      timeout: 10000
    });

    const urls = (response.data.photos || [])
      .map((photo: any) => photo.src?.large || photo.src?.medium);

    console.log(`[Pexels] Found ${urls.length} images`);
    return urls;
    
  } catch (error) {
    console.log('[Pexels] Error:', error instanceof Error ? error.message : 'Unknown');
    return [];
  }
}

function generatePollinationsFallback(query: string, index: number = 0): string {
  const seed = Date.now() + index;
  const encodedQuery = encodeURIComponent(`${query} educational diagram illustration`);
  return `https://image.pollinations.ai/prompt/${encodedQuery}?seed=${seed}&width=800&height=600&nologo=true`;
}

async function fetchAllImages(query: string, limit: number = 6): Promise<string[]> {
  const sources: ImageSource[] = [
    { name: 'Wikimedia', fetch: fetchWikimediaImages },
    { name: 'Unsplash', fetch: fetchUnsplashImages },
    { name: 'Pexels', fetch: fetchPexelsImages }
  ];

  for (const source of sources) {
    try {
      const images = await source.fetch(query, limit);
      if (images.length > 0) {
        console.log(`[ImageFetch] Using ${source.name}: ${images.length} images`);
        return images;
      }
    } catch (err) {
      console.log(`[ImageFetch] ${source.name} failed, trying next source`);
    }
  }

  console.log('[ImageFetch] All APIs failed, using Pollinations AI fallback');
  const fallbackImages: string[] = [];
  for (let i = 0; i < limit; i++) {
    fallbackImages.push(generatePollinationsFallback(query, i));
  }
  return fallbackImages;
}

export async function downloadImage(url: string, filename: string): Promise<string | null> {
  try {
    console.log(`[Download] Downloading: ${url.substring(0, 60)}...`);
    
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'NeuronixLearn/1.0 (Educational Platform)'
      }
    });
    
    const filepath = path.join(VIDEOS_DIR, filename);
    fs.writeFileSync(filepath, response.data);
    
    console.log(`[Download] Saved: ${filepath}`);
    return filepath;
    
  } catch (error) {
    console.error(`[Download] Error downloading ${url}:`, error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

export async function generateTTS(text: string, filename: string): Promise<string | null> {
  try {
    console.log(`[TTS] Generating audio for text (${text.length} chars)`);
    
    const apiKey = process.env.VOICERSS_KEY || process.env.TTS_API_KEY;
    
    if (!apiKey || apiKey === 'demo') {
      console.log('[TTS] No API key, using browser-based TTS (client-side)');
      return null;
    }

    const ttsProviders = [
      {
        name: 'VoiceRSS',
        url: `https://api.voicerss.org/?key=${apiKey}&hl=en-us&src=${encodeURIComponent(text)}&c=MP3`
      },
      {
        name: 'Google TTS (fallback)',
        url: `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en-US&client=tw-ob`
      }
    ];

    for (const provider of ttsProviders) {
      try {
        const response = await axios.get(provider.url, { 
          responseType: 'arraybuffer',
          timeout: 15000
        });

        if (response.data && response.data.length > 0) {
          const filepath = path.join(VIDEOS_DIR, filename);
          fs.writeFileSync(filepath, response.data);
          console.log(`[TTS] Saved: ${filepath}`);
          return filepath;
        }
      } catch (err) {
        console.log(`[TTS] ${provider.name} failed:`, err instanceof Error ? err.message : 'Unknown');
      }
    }

    console.log('[TTS] All providers failed');
    return null;
    
  } catch (error) {
    console.error('[TTS] Error:', error);
    return null;
  }
}

export async function createVideoFromImages(
  imagePaths: string[], 
  audioPath: string | null, 
  outputFilename: string
): Promise<string | null> {
  try {
    if (imagePaths.length === 0) {
      console.log('[FFmpeg] No images provided');
      return null;
    }

    console.log(`[FFmpeg] Creating video with ${imagePaths.length} images`);
    
    const outputPath = path.join(VIDEOS_DIR, outputFilename);
    const durationPerImage = 4;

    const imageInputs = imagePaths.map((imgPath, i) => 
      `-loop 1 -t ${durationPerImage} -i "${imgPath}"`
    ).join(' ');

    let filterComplex = '';
    let mapOptions = '';

    if (imagePaths.length > 1) {
      const inputs = imagePaths.map((_, i) => `[${i}:v]`).join('');
      filterComplex = `${inputs}concat=n=${imagePaths.length}:v=1:a=0[outv]`;
      mapOptions = '-map [outv]';
    } else {
      filterComplex = '[0:v]scale=800:600:force_original_aspect_ratio=decrease,pad=800:600:(ow-iw)/2:(oh-ih)/2,setsar=1[outv]';
      mapOptions = '-map [outv]';
    }

    if (audioPath && fs.existsSync(audioPath)) {
      const audioIndex = imagePaths.length;
      filterComplex += `;[${audioIndex}:a]volume=0.8[aout]`;
      mapOptions += ` -map [aout] -c:a aac -b:a 128k`;
    } else {
      mapOptions += ' -an';
    }

    const command = `ffmpeg ${imageInputs} ${audioPath && fs.existsSync(audioPath) ? `-i "${audioPath}"` : ''} -filter_complex "${filterComplex}" ${mapOptions} -c:v libx264 -tune stillimage -crf 23 -pix_fmt yuv420p -shortest -y "${outputPath}"`;

    console.log('[FFmpeg] Running command...');
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
    
    if (stderr && stderr.includes('Error')) {
      console.error('[FFmpeg] Error:', stderr);
    }

    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`[FFmpeg] Video created: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return outputPath;
    }

    return null;
    
  } catch (error) {
    console.error('[FFmpeg] Error:', error instanceof Error ? error.message : 'Unknown');
    return null;
  }
}

export async function generateAIVideo(
  userId: string,
  subject: string,
  topic: string,
  subtopic: string | undefined,
  script: {
    intro: string;
    mainContent: string;
    example: string;
    summary: string;
  }
): Promise<{ videoUrl: string; cached: boolean; script: typeof script; imageUrls: string[] }> {
  
  const cacheKey = { userId, subject, topic, subtopic: subtopic || null };
  const searchQuery = `${topic} ${subject} ${subtopic || ''}`.trim();
  
  console.log(`[VideoGen] Processing: ${searchQuery}`);
  
  try {
    const existingCache = await VideoCache.findOne({
      userId,
      subject: subject.toLowerCase(),
      topic: topic.toLowerCase(),
      subtopic: subtopic?.toLowerCase(),
      expiresAt: { $gt: new Date() }
    });

    if (existingCache && existingCache.videoUrl) {
      console.log('[VideoGen] Returning cached video');
      return { 
        videoUrl: existingCache.videoUrl, 
        cached: true,
        script: existingCache.script || script,
        imageUrls: existingCache.imageUrls || []
      };
    }

    console.log('[VideoGen] Fetching images...');
    const imageUrls = await fetchAllImages(searchQuery, 6);
    
    console.log('[VideoGen] Downloading images...');
    const imagePaths: string[] = [];
    for (let i = 0; i < Math.min(imageUrls.length, 4); i++) {
      const ext = path.extname(new URL(imageUrls[i]).pathname) || '.jpg';
      const filepath = await downloadImage(imageUrls[i], `img_${topic.replace(/[^a-z0-9]/gi, '_')}_${i}${ext}`);
      if (filepath) imagePaths.push(filepath);
    }

    if (imagePaths.length === 0) {
      console.log('[VideoGen] No images downloaded, generating with AI');
      for (let i = 0; i < 4; i++) {
        const fallbackUrl = generatePollinationsFallback(searchQuery, i);
        const filepath = await downloadImage(fallbackUrl, `img_${topic.replace(/[^a-z0-9]/gi, '_')}_fallback_${i}.jpg`);
        if (filepath) imagePaths.push(filepath);
      }
    }

    console.log('[VideoGen] Generating narration...');
    const fullScript = `${script.intro} ${script.mainContent} ${script.example} ${script.summary}`;
    const audioFilename = `audio_${topic.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.mp3`;
    const audioPath = await generateTTS(fullScript, audioFilename);

    console.log('[VideoGen] Creating video...');
    const videoFilename = `video_${topic.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.mp4`;
    const videoPath = await createVideoFromImages(imagePaths, audioPath, videoFilename);

    let videoUrl = videoPath ? `/videos/${path.basename(videoPath)}` : '';

    if (!videoUrl) {
      console.log('[VideoGen] Video creation failed, using images only');
    }

    const videoCache = new VideoCache({
      userId,
      subject: subject.toLowerCase(),
      topic: topic.toLowerCase(),
      subtopic: subtopic?.toLowerCase(),
      videoUrl,
      script,
      imageUrls
    });
    
    await videoCache.save();
    console.log('[VideoGen] Cached to database');

    for (const imgPath of imagePaths) {
      try { if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath); } catch {}
    }
    if (audioPath) {
      try { if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch {}
    }

    return { videoUrl, cached: false, script, imageUrls };
    
  } catch (error) {
    console.error('[VideoGen] Fatal error:', error);
    return { 
      videoUrl: '', 
      cached: false, 
      script, 
      imageUrls: [] 
    };
  }
}

export { fetchWikimediaImages, fetchAllImages, generatePollinationsFallback };
