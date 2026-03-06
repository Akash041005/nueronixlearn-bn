import TopicLibrary from '../models/TopicLibrary';
import UserTopicProgress from '../models/UserTopicProgress';
import Subject from '../models/Subject';
import User from '../models/User';
import WeakTopic from '../models/WeakTopic';
import keyManager from './keyManager';

interface SubtopicItem {
  title: string;
  order: number;
}

interface TopicItem {
  title: string;
  order: number;
  subtopics: SubtopicItem[];
}

type CachedTopicItem = {
  title: string;
  order: number;
  subtopics?: SubtopicItem[];
};

const DEFAULT_TOPICS: Record<string, TopicItem[]> = {
  mathematics: [
    { title: 'Number Systems', order: 1, subtopics: [{ title: 'Natural Numbers', order: 1 }, { title: 'Integers', order: 2 }, { title: 'Rational Numbers', order: 3 }, { title: 'Real Numbers', order: 4 }] },
    { title: 'Algebra Fundamentals', order: 2, subtopics: [{ title: 'Variables and Constants', order: 1 }, { title: 'Expressions', order: 2 }, { title: 'Equations', order: 3 }] },
    { title: 'Linear Equations', order: 3, subtopics: [{ title: 'Single Variable', order: 1 }, { title: 'Two Variables', order: 2 }, { title: 'Word Problems', order: 3 }] },
    { title: 'Quadratic Equations', order: 4, subtopics: [{ title: 'Factoring', order: 1 }, { title: 'Quadratic Formula', order: 2 }, { title: 'Graphing', order: 3 }] },
    { title: 'Polynomials', order: 5, subtopics: [{ title: 'Degree of Polynomial', order: 1 }, { title: 'Roots', order: 2 }, { title: 'Factorization', order: 3 }] }
  ],
  physics: [
    { title: 'Introduction to Physics', order: 1, subtopics: [{ title: 'Nature of Physics', order: 1 }, { title: 'Units and Measurements', order: 2 }, { title: 'Scalars and Vectors', order: 3 }] },
    { title: 'Motion in One Dimension', order: 2, subtopics: [{ title: 'Speed and Velocity', order: 1 }, { title: 'Acceleration', order: 2 }, { title: 'Kinematic Equations', order: 3 }] },
    { title: "Newton's Laws of Motion", order: 3, subtopics: [{ title: 'First Law', order: 1 }, { title: 'Second Law', order: 2 }, { title: 'Third Law', order: 3 }, { title: 'Friction', order: 4 }] },
    { title: 'Work, Energy and Power', order: 4, subtopics: [{ title: 'Work', order: 1 }, { title: 'Kinetic Energy', order: 2 }, { title: 'Potential Energy', order: 3 }, { title: 'Power', order: 4 }] },
    { title: 'Momentum and Collisions', order: 5, subtopics: [{ title: 'Linear Momentum', order: 1 }, { title: 'Conservation of Momentum', order: 2 }, { title: 'Elastic Collisions', order: 3 }] }
  ],
  chemistry: [
    { title: 'Atomic Structure', order: 1, subtopics: [{ title: 'Subatomic Particles', order: 1 }, { title: 'Bohr Model', order: 2 }, { title: 'Electronic Configuration', order: 3 }] },
    { title: 'Classification of Elements', order: 2, subtopics: [{ title: 'Periodic Table', order: 1 }, { title: 'Periodic Trends', order: 2 }, { title: 'Groups and Periods', order: 3 }] },
    { title: 'Chemical Bonding', order: 3, subtopics: [{ title: 'Ionic Bonding', order: 1 }, { title: 'Covalent Bonding', order: 2 }, { title: 'Metallic Bonding', order: 3 }] },
    { title: 'States of Matter', order: 4, subtopics: [{ title: 'Solids', order: 1 }, { title: 'Liquids', order: 2 }, { title: 'Gases', order: 3 }] },
    { title: 'Thermodynamics', order: 5, subtopics: [{ title: 'Laws of Thermodynamics', order: 1 }, { title: 'Enthalpy', order: 2 }, { title: 'Entropy', order: 3 }] }
  ],
  biology: [
    { title: 'Cell: The Unit of Life', order: 1, subtopics: [{ title: 'Cell Theory', order: 1 }, { title: 'Cell Structure', order: 2 }, { title: 'Cell Organelles', order: 3 }] },
    { title: 'Cell Division - Mitosis', order: 2, subtopics: [{ title: 'Interphase', order: 1 }, { title: 'Prophase', order: 2 }, { title: 'Metaphase', order: 3 }, { title: 'Anaphase', order: 4 }, { title: 'Telophase', order: 5 }] },
    { title: 'Cell Division - Meiosis', order: 3, subtopics: [{ title: 'Meiosis I', order: 1 }, { title: 'Meiosis II', order: 2 }, { title: 'Crossing Over', order: 3 }] },
    { title: 'Photosynthesis', order: 4, subtopics: [{ title: 'Light Reactions', order: 1 }, { title: 'Dark Reactions', order: 2 }, { title: 'Chlorophyll', order: 3 }] },
    { title: 'Respiration', order: 5, subtopics: [{ title: 'Glycolysis', order: 1 }, { title: 'Krebs Cycle', order: 2 }, { title: 'Electron Transport', order: 3 }] }
  ],
  computer_science: [
    { title: 'Introduction to Programming', order: 1, subtopics: [{ title: 'What is Programming', order: 1 }, { title: 'Programming Languages', order: 2 }, { title: 'Hello World', order: 3 }] },
    { title: 'Variables and Data Types', order: 2, subtopics: [{ title: 'Variables', order: 1 }, { title: 'Primitive Types', order: 2 }, { title: 'Type Conversion', order: 3 }] },
    { title: 'Control Structures', order: 3, subtopics: [{ title: 'If-Else', order: 1 }, { title: 'Switch', order: 2 }, { title: 'Loops', order: 3 }] },
    { title: 'Functions and Modules', order: 4, subtopics: [{ title: 'Function Definition', order: 1 }, { title: 'Parameters', order: 2 }, { title: 'Return Values', order: 3 }] },
    { title: 'Data Structures - Arrays', order: 5, subtopics: [{ title: 'Array Basics', order: 1 }, { title: 'Array Operations', order: 2 }, { title: 'Multi-dimensional Arrays', order: 3 }] }
  ]
};

export async function getTopicsForSubject(subject: string): Promise<TopicItem[] | null> {
  const normalizedSubject = subject.toLowerCase().trim();
  
  const topicLibrary = await TopicLibrary.findOne({ 
    normalizedSubject 
  });
  
  if (topicLibrary && topicLibrary.topics.length > 0) {
    return (topicLibrary.topics as CachedTopicItem[]).map(t => ({
      title: t.title,
      order: t.order,
      subtopics: t.subtopics || []
    }));
  }
  
  return null;
}

export async function getTopicsArrayForSubject(subject: string): Promise<string[]> {
  const topics = await getTopicsForSubject(subject);
  if (topics) {
    return topics.sort((a, b) => a.order - b.order).map(t => t.title);
  }
  return [];
}

// Minimum topics required for a cached roadmap to be considered valid.
// Anything below this means the previous generation failed/was a fallback.
const MIN_VALID_TOPICS = 6;

export async function generateAndCacheRoadmap(
  subject: string,
  forceRegenerate = false
): Promise<TopicItem[]> {
  const normalizedSubject = subject.toLowerCase().trim();

  // Only use the cache when:
  //   1. We're not forcing a regeneration
  //   2. The cache has a proper roadmap (>= MIN_VALID_TOPICS topics)
  //   3. At least some topics already have subtopics
  if (!forceRegenerate) {
    const existingRoadmap = await TopicLibrary.findOne({ normalizedSubject });
    if (
      existingRoadmap &&
      existingRoadmap.topics.length >= MIN_VALID_TOPICS
    ) {
      const cached = (existingRoadmap.topics as CachedTopicItem[]).map(t => ({
        title: t.title,
        order: t.order,
        subtopics: t.subtopics || []
      }));
      console.log(`[Roadmap Cache] HIT for "${subject}" — ${cached.length} topics`);
      return cached;
    }
    if (existingRoadmap) {
      // Cache exists but is bad — delete it and regenerate
      console.warn(`[Roadmap Cache] Stale cache for "${subject}" (${existingRoadmap.topics.length} topics) — regenerating`);
      await TopicLibrary.deleteOne({ normalizedSubject });
    }
  }

  // Try the hardcoded defaults first (instant, no AI call needed)
  const defaultTopics = DEFAULT_TOPICS[normalizedSubject];
  if (defaultTopics && !forceRegenerate) {
    await TopicLibrary.findOneAndUpdate(
      { normalizedSubject },
      { subject, normalizedSubject, topics: defaultTopics, source: 'hardcoded', updatedAt: new Date() },
      { upsert: true }
    );
    return defaultTopics;
  }

  // Generate with AI
  const aiTopics = await generateRoadmapWithAI(subject);

  if (aiTopics.length >= MIN_VALID_TOPICS) {
    await TopicLibrary.findOneAndUpdate(
      { normalizedSubject },
      { subject, normalizedSubject, topics: aiTopics, source: 'ai', updatedAt: new Date() },
      { upsert: true }
    );
    console.log(`[Roadmap AI] Cached ${aiTopics.length} topics for "${subject}"`);
    return aiTopics;
  }

  // AI returned too few topics — do NOT cache, just return what we have
  // (the next call will try AI again)
  console.error(`[Roadmap AI] Only got ${aiTopics.length} topics for "${subject}" — not caching`);
  return aiTopics.length > 0 ? aiTopics : getDefaultRoadmap(subject);
}

// Model fallback chain — tries each in order until one returns a valid roadmap
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-pro',
];

async function generateRoadmapWithAI(subject: string): Promise<TopicItem[]> {
  const { client, keyIndex } = keyManager.getRecoClient();

  if (!client) {
    console.warn('[Roadmap AI] No Gemini client configured');
    return getDefaultRoadmap(subject);
  }

  const prompt = `You are a curriculum designer. Create a complete learning roadmap for the subject: "${subject}".

IMPORTANT: Return ONLY a raw JSON array. No markdown, no code fences, no explanation text.

Each element must follow this exact shape:
{
  "title": "Topic Name",
  "order": 1,
  "subtopics": [
    { "title": "Subtopic Name", "order": 1 },
    { "title": "Subtopic Name", "order": 2 }
  ]
}

Rules:
- Generate 8 to 12 topics total, ordered from beginner to advanced
- Every topic MUST have 4 to 6 subtopics
- Topics must build on each other logically
- Use specific, practical names — not generic names like "Introduction" or "Advanced Topics"

Start your response with [ and end with ] — nothing else.`;

  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(`[Roadmap AI] Trying model "${modelName}" for subject "${subject}"`);
      const model  = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const raw    = result.response.text().trim();

      console.log(`[Roadmap AI] "${modelName}" response (first 200 chars):`, raw.substring(0, 200));

      const parsed = extractJsonArray(raw, subject);
      if (parsed && parsed.length >= 6) {
        console.log(`[Roadmap AI] "${modelName}" succeeded — ${parsed.length} topics for "${subject}"`);
        if (keyIndex >= 0) keyManager.releaseRecoKey(keyIndex);
        return parsed;
      }
      console.warn(`[Roadmap AI] "${modelName}" returned too few topics (${parsed?.length ?? 0}) — trying next`);
    } catch (err: any) {
      console.error(`[Roadmap AI] "${modelName}" failed:`, err?.message || err);
      // Continue to next model
    }
  }

  if (keyIndex >= 0) keyManager.releaseRecoKey(keyIndex);
  console.error(`[Roadmap AI] All models failed for "${subject}" — using default roadmap`);
  return getDefaultRoadmap(subject);
}

/**
 * Robustly extract a TopicItem[] from a Gemini response that may contain
 * markdown code fences, object wrappers, or stray text.
 */
function extractJsonArray(raw: string, subject: string): TopicItem[] | null {
  let jsonStr: string | null = null;

  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // 2. Bare JSON array
  if (!jsonStr) {
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (arrMatch) jsonStr = arrMatch[0];
  }

  // 3. JSON object wrapping the array  {"topics": [...]} or {"roadmap": [...]}
  if (!jsonStr) {
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        const obj = JSON.parse(objMatch[0]);
        const arr = obj.topics || obj.roadmap || obj.data ||
          Object.values(obj).find((v) => Array.isArray(v));
        if (arr) jsonStr = JSON.stringify(arr);
      } catch { /* ignore */ }
    }
  }

  if (!jsonStr) return null;

  try {
    let parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      // Unwrap one level
      parsed = parsed.topics || parsed.roadmap || [];
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    return parsed.map((t: any, idx: number) => ({
      title:     (t.title || t.name || `${subject} Topic ${idx + 1}`).trim(),
      order:     t.order ?? idx + 1,
      subtopics: Array.isArray(t.subtopics)
        ? t.subtopics.map((s: any, sIdx: number) => ({
            title: (s.title || s.name || `Subtopic ${sIdx + 1}`).trim(),
            order: s.order ?? sIdx + 1,
          }))
        : [],
    }));
  } catch (e) {
    console.error('[Roadmap AI] JSON.parse failed:', (e as Error).message);
    return null;
  }
}

async function generateSubtopicsForTopic(topicTitle: string, subject: string): Promise<SubtopicItem[]> {
  const { client, keyIndex } = keyManager.getRecoClient();

  if (!client) return getDefaultSubtopics(topicTitle);

  const prompt = `Break down the topic "${topicTitle}" in "${subject}" into 5 to 7 specific learning subtopics.

Return ONLY a raw JSON array — no markdown, no explanation, no code fences.

Format:
[
  { "title": "Subtopic Name", "order": 1 },
  { "title": "Subtopic Name", "order": 2 }
]

Start your response with [ and end with ] — nothing else.`;

  for (const modelName of GEMINI_MODELS) {
    try {
      const model  = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const raw    = result.response.text().trim();

      const jsonStr =
        (raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [])[1]?.trim() ||
        (raw.match(/\[[\s\S]*\]/) || [])[0] ||
        null;

      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (keyIndex >= 0) keyManager.releaseRecoKey(keyIndex);
          return parsed.map((s: any, idx: number) => ({
            title: (s.title || s.name || `Subtopic ${idx + 1}`).trim(),
            order: s.order ?? idx + 1,
          }));
        }
      }
    } catch (err: any) {
      console.error(`[generateSubtopics] "${modelName}" failed for "${topicTitle}":`, err?.message);
    }
  }

  if (keyIndex >= 0) keyManager.releaseRecoKey(keyIndex);
  return getDefaultSubtopics(topicTitle);
}

function getDefaultRoadmap(subject: string): TopicItem[] {
  return [
    { title: 'Introduction', order: 1, subtopics: [{ title: 'Basics', order: 1 }, { title: 'Fundamentals', order: 2 }] },
    { title: 'Core Concepts', order: 2, subtopics: [{ title: 'Concept 1', order: 1 }, { title: 'Concept 2', order: 2 }] },
    { title: 'Advanced Topics', order: 3, subtopics: [{ title: 'Topic 1', order: 1 }, { title: 'Topic 2', order: 2 }] },
    { title: 'Practice', order: 4, subtopics: [{ title: 'Exercise 1', order: 1 }, { title: 'Exercise 2', order: 2 }] }
  ];
}

function getDefaultSubtopics(topicTitle: string): SubtopicItem[] {
  return [
    { title: `${topicTitle} Basics`, order: 1 },
    { title: `Understanding ${topicTitle}`, order: 2 },
    { title: `Practicing ${topicTitle}`, order: 3 }
  ];
}

export async function createUserSubject(
  userId: string,
  subject: string,
  forceRegenerate = false
): Promise<{ subjectDoc: any; topics: TopicItem[] }> {
  const normalizedSubject = subject.toLowerCase().trim();

  const existingSubject = await Subject.findOne({ userId, subject: normalizedSubject });

  if (existingSubject && !forceRegenerate) {
    // Check if the user's progress data is adequate
    const existingTopicCount = await UserTopicProgress.countDocuments({
      userId,
      subject: normalizedSubject,
      subtopicTitle: ''  // only count top-level topic rows
    });

    if (existingTopicCount >= MIN_VALID_TOPICS) {
      // Good data — just return the cached roadmap
      const topics = await generateAndCacheRoadmap(subject);
      return { subjectDoc: existingSubject, topics };
    }

    // Bad/incomplete progress data — delete it and regenerate
    console.warn(
      `[createUserSubject] Subject "${subject}" exists for user ${userId} but only has ` +
      `${existingTopicCount} topic rows — deleting and regenerating`
    );
    await UserTopicProgress.deleteMany({ userId, subject: normalizedSubject });
  }

  // Create (or ensure) the Subject doc
  const subjectDoc = await Subject.findOneAndUpdate(
    { userId, subject: normalizedSubject },
    { userId, subject: normalizedSubject, createdAt: new Date() },
    { upsert: true, new: true }
  );

  // Step 1: Get roadmap from AI (topics + subtopics in one call)
  //         Force regenerate in the cache too if we're doing a full regeneration
  let topics = await generateAndCacheRoadmap(subject, forceRegenerate);

  // Step 2: For any topic that came back with zero subtopics, generate them now
  //         Run in parallel — non-fatal if some fail
  const topicsWithoutSubs = topics.filter(t => !t.subtopics || t.subtopics.length === 0);

  if (topicsWithoutSubs.length > 0) {
    console.log(`[createUserSubject] ${topicsWithoutSubs.length} topics missing subtopics — generating now`);

    const results = await Promise.allSettled(
      topicsWithoutSubs.map(t => generateSubtopicsForTopic(t.title, subject))
    );

    topics = topics.map(t => {
      if (t.subtopics && t.subtopics.length > 0) return t;
      const i = topicsWithoutSubs.findIndex(x => x.title === t.title);
      if (i < 0 || results[i].status === 'rejected') return t;
      return { ...t, subtopics: (results[i] as PromiseFulfilledResult<SubtopicItem[]>).value };
    });

    // Persist the now-complete roadmap back to the cache
    try {
      await TopicLibrary.findOneAndUpdate(
        { normalizedSubject },
        { $set: { topics, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (cacheErr) {
      console.warn('[createUserSubject] Could not update topic cache:', cacheErr);
    }
  }

  // Step 3: Write all topics + all their subtopics to UserTopicProgress in one shot
  await createUserTopicProgress(userId, normalizedSubject, topics);

  console.log(`[createUserSubject] Created subject "${subject}" with ${topics.length} topics, ` +
    `${topics.reduce((n, t) => n + (t.subtopics?.length ?? 0), 0)} total subtopics`);

  return { subjectDoc, topics };
}

async function createUserTopicProgress(
  userId: string,
  subject: string,
  topics: TopicItem[]
): Promise<void> {
  if (topics.length === 0) return;

  const now = new Date();
  const ops: any[] = [];

  for (const topic of topics) {
    // Topic-level row — use empty string as placeholder for subtopicTitle to avoid null issues
    ops.push({
      updateOne: {
        filter: { userId, subject, topicTitle: topic.title, subtopicTitle: '' },
        update: {
          $set:         { order: topic.order, completed: false },
          $setOnInsert: { userId, subject, topicTitle: topic.title, subtopicTitle: '', createdAt: now },
        },
        upsert: true,
      },
    });

    for (const sub of topic.subtopics || []) {
      if (!sub.title) continue;
      ops.push({
        updateOne: {
          filter: { userId, subject, topicTitle: topic.title, subtopicTitle: sub.title },
          update: {
            $set:         { order: sub.order, completed: false },
            $setOnInsert: { userId, subject, topicTitle: topic.title, subtopicTitle: sub.title, createdAt: now },
          },
          upsert: true,
        },
      });
    }
  }

  if (ops.length === 0) return;

  try {
    // ordered:false — continue all ops even if one fails (e.g. stale duplicate key)
    await UserTopicProgress.bulkWrite(ops, { ordered: false });
    console.log(`[createUserTopicProgress] Wrote ${ops.length} progress records for subject "${subject}"`);
  } catch (err: any) {
    // bulkWrite with ordered:false throws if ALL ops fail; partial success is OK
    console.error('[createUserTopicProgress] bulkWrite error:', err?.message);
    throw err;
  }
}

export async function getUserSubjects(userId: string): Promise<any[]> {
  return Subject.find({ userId }).sort({ createdAt: -1 });
}

export async function getRoadmapProgress(
  userId: string,
  subject: string
): Promise<{ topics: any[]; subtopics: any[] }> {
  const normalizedSubject = subject.toLowerCase().trim();
  
  // Topic rows have subtopicTitle as empty string (not null)
  const topics = await UserTopicProgress.find({
    userId,
    subject: normalizedSubject,
    subtopicTitle: ''
  }).sort({ order: 1 });

  // Subtopic rows have an actual string value in subtopicTitle
  const subtopics = await UserTopicProgress.find({
    userId,
    subject: normalizedSubject,
    subtopicTitle: { $ne: '', $exists: true }
  }).sort({ order: 1 });

  return { topics, subtopics };
}

export async function getNextIncompleteTopic(
  userId: string,
  subject: string
): Promise<any | null> {
  const normalizedSubject = subject.toLowerCase().trim();
  
  const topic = await UserTopicProgress.findOne({
    userId,
    subject: normalizedSubject,
    subtopicTitle: '',
    completed: false
  }).sort({ order: 1 });

  return topic;
}

export async function getNextIncompleteSubtopic(
  userId: string,
  subject: string,
  topicTitle: string
): Promise<any | null> {
  const normalizedSubject = subject.toLowerCase().trim();
  
  const subtopic = await UserTopicProgress.findOne({
    userId,
    subject: normalizedSubject,
    topicTitle,
    subtopicTitle: { $ne: '' },
    completed: false
  }).sort({ order: 1 });

  return subtopic;
}

export async function markSubtopicComplete(
  userId: string,
  subject: string,
  topicTitle: string,
  subtopicTitle: string
): Promise<{ completed: any; nextSubtopic: any | null; topicCompleted: boolean }> {
  const normalizedSubject = subject.toLowerCase().trim();
  
  const completed = await UserTopicProgress.findOneAndUpdate(
    { userId, subject: normalizedSubject, topicTitle, subtopicTitle, completed: false },
    { completed: true, completedAt: new Date() },
    { new: true }
  );

  const nextSubtopic = await getNextIncompleteSubtopic(userId, normalizedSubject, topicTitle);
  
  const remainingSubtopics = await UserTopicProgress.countDocuments({
    userId,
    subject: normalizedSubject,
    topicTitle,
    subtopicTitle: { $ne: '' },
    completed: false
  });

  const topicCompleted = remainingSubtopics === 0;

  return { completed, nextSubtopic, topicCompleted };
}

export async function markTopicComplete(
  userId: string,
  subject: string,
  topicTitle: string
): Promise<{ completed: any; nextTopic: any | null }> {
  const normalizedSubject = subject.toLowerCase().trim();
  
  const completed = await UserTopicProgress.findOneAndUpdate(
    { userId, subject: normalizedSubject, topicTitle, subtopicTitle: '', completed: false },
    { completed: true, completedAt: new Date() },
    { new: true }
  );

  const nextTopic = await getNextIncompleteTopic(userId, normalizedSubject);

  return { completed, nextTopic };
}

export async function generateAndStoreSubtopics(
  userId: string,
  subject: string,
  topicTitle: string
): Promise<SubtopicItem[]> {
  const normalizedSubject = subject.toLowerCase().trim();
  
  const existingSubtopics = await UserTopicProgress.find({
    userId,
    subject: normalizedSubject,
    topicTitle,
    subtopicTitle: { $ne: '' }
  });

  if (existingSubtopics.length > 0) {
    return existingSubtopics.map(s => ({
      title: s.subtopicTitle,
      order: s.order
    }));
  }

  const cachedTopics = await TopicLibrary.findOne({ normalizedSubject });
  let subtopics: SubtopicItem[] = [];
  
  if (cachedTopics) {
    const topic = cachedTopics.topics.find(t => t.title === topicTitle);
    if (topic?.subtopics) {
      subtopics = topic.subtopics;
    }
  }

  if (subtopics.length === 0) {
    subtopics = await generateSubtopicsForTopic(topicTitle, subject);
  }

  for (const subtopic of subtopics) {
    await UserTopicProgress.findOneAndUpdate(
      { userId, subject: normalizedSubject, topicTitle, subtopicTitle: subtopic.title },
      {
        userId,
        subject: normalizedSubject,
        topicTitle,
        subtopicTitle: subtopic.title,
        order: subtopic.order,
        completed: false,
        createdAt: new Date()
      },
      { upsert: true }
    );
  }

  return subtopics;
}

export async function deleteUserSubject(
  userId: string,
  subjectId: string
): Promise<void> {
  const subject = await Subject.findOne({ _id: subjectId, userId });
  if (subject) {
    await UserTopicProgress.deleteMany({
      userId,
      subject: subject.subject
    });
    await Subject.deleteOne({ _id: subjectId, userId });
  }
}

export async function initializeStudyPlanFromWeakAreas(userId: string): Promise<any[]> {
  const user = await User.findById(userId);
  if (!user) return [];

  const createdSubjects: any[] = [];
  
  const weakAreas = user.profile?.weakAreas || [];
  
  for (const area of weakAreas) {
    try {
      const normalizedArea = area.toLowerCase().trim();
      
      const existingSubject = await Subject.findOne({
        userId,
        subject: normalizedArea
      });

      if (!existingSubject) {
        const { subjectDoc, topics } = await createUserSubject(userId, area);
        createdSubjects.push({ subject: subjectDoc, topics });
      }
    } catch (error) {
      console.error(`Failed to create subject from weak area ${area}:`, error);
    }
  }

  const weakTopicsFromDb = await WeakTopic.find({ userId }).limit(10);
  
  const subjectsFromWeakTopics = new Set<string>();
  for (const wt of weakTopicsFromDb) {
    if (!subjectsFromWeakTopics.has(wt.subject.toLowerCase())) {
      subjectsFromWeakTopics.add(wt.subject.toLowerCase());
      
      try {
        const existingSubject = await Subject.findOne({
          userId,
          subject: wt.subject.toLowerCase()
        });

        if (!existingSubject) {
          const { subjectDoc, topics } = await createUserSubject(userId, wt.subject);
          createdSubjects.push({ subject: subjectDoc, topics });
        }
      } catch (error) {
        console.error(`Failed to create subject from weak topic ${wt.subject}:`, error);
      }
    }
  }

  return createdSubjects;
}
