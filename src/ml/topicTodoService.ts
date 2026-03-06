import TopicLibrary, { ITopic } from '../models/TopicLibrary';
import UserTodo, { IUserTodo } from '../models/UserTodo';
import keyManager from './keyManager';

interface TopicItem {
  title: string;
  order: number;
}

const DEFAULT_TOPICS: Record<string, TopicItem[]> = {
  mathematics: [
    { title: 'Number Systems', order: 1 },
    { title: 'Algebra Fundamentals', order: 2 },
    { title: 'Linear Equations', order: 3 },
    { title: 'Quadratic Equations', order: 4 },
    { title: 'Polynomials', order: 5 },
    { title: 'Arithmetic Progression', order: 6 },
    { title: 'Triangles', order: 7 },
    { title: 'Coordinate Geometry', order: 8 },
    { title: 'Trigonometry Basics', order: 9 },
    { title: 'Statistics', order: 10 },
    { title: 'Probability', order: 11 }
  ],
  physics: [
    { title: 'Introduction to Physics', order: 1 },
    { title: 'Motion in One Dimension', order: 2 },
    { title: 'Motion in Two Dimensions', order: 3 },
    { title: 'Newton\'s Laws of Motion', order: 4 },
    { title: 'Work, Energy and Power', order: 5 },
    { title: 'Momentum and Collisions', order: 6 },
    { title: 'Rotational Motion', order: 7 },
    { title: 'Gravitation', order: 8 },
    { title: 'Mechanical Properties of Solids', order: 9 },
    { title: 'Wave Motion', order: 10 },
    { title: 'Sound Waves', order: 11 },
    { title: 'Light Reflection', order: 12 },
    { title: 'Light Refraction', order: 13 },
    { title: 'Electric Charges and Fields', order: 14 },
    { title: 'Current Electricity', order: 15 },
    { title: 'Magnetic Effects of Current', order: 16 },
    { title: 'Electromagnetic Induction', order: 17 }
  ],
  chemistry: [
    { title: 'Atomic Structure', order: 1 },
    { title: 'Classification of Elements', order: 2 },
    { title: 'Chemical Bonding', order: 3 },
    { title: 'States of Matter', order: 4 },
    { title: 'Thermodynamics', order: 5 },
    { title: 'Chemical Equilibrium', order: 6 },
    { title: 'Redox Reactions', order: 7 },
    { title: 'Hydrogen', order: 8 },
    { title: 's-Block Elements', order: 9 },
    { title: 'p-Block Elements', order: 10 },
    { title: 'Organic Chemistry Basics', order: 11 },
    { title: 'Hydrocarbons', order: 12 },
    { title: 'Environmental Chemistry', order: 13 }
  ],
  biology: [
    { title: 'Cell: The Unit of Life', order: 1 },
    { title: 'Cell Division - Mitosis', order: 2 },
    { title: 'Cell Division - Meiosis', order: 3 },
    { title: 'Photosynthesis', order: 4 },
    { title: 'Respiration', order: 5 },
    { title: 'Digestion and Absorption', order: 6 },
    { title: 'Excretory Products', order: 7 },
    { title: 'Locomotion and Movement', order: 8 },
    { title: 'Neural Control and Coordination', order: 9 },
    { title: 'Chemical Coordination', order: 10 },
    { title: 'Human Reproduction', order: 11 },
    { title: 'Heredity and Evolution', order: 12 },
    { title: 'Principles of Inheritance', order: 13 },
    { title: 'Molecular Basis of Inheritance', order: 14 },
    { title: 'Ecosystem', order: 15 },
    { title: 'Biodiversity', order: 16 }
  ],
  english: [
    { title: 'Grammar - Parts of Speech', order: 1 },
    { title: 'Grammar - Tenses', order: 2 },
    { title: 'Grammar - Active and Passive Voice', order: 3 },
    { title: 'Grammar - Direct and Indirect Speech', order: 4 },
    { title: 'Vocabulary Building', order: 5 },
    { title: 'Reading Comprehension', order: 6 },
    { title: 'Letter Writing', order: 7 },
    { title: 'Essay Writing', order: 8 },
    { title: 'Story Writing', order: 9 },
    { title: 'Poetry Analysis', order: 10 },
    { title: 'Precis Writing', order: 11 },
    { title: 'Transformation of Sentences', order: 12 }
  ],
  computer_science: [
    { title: 'Introduction to Programming', order: 1 },
    { title: 'Variables and Data Types', order: 2 },
    { title: 'Control Structures', order: 3 },
    { title: 'Functions and Modules', order: 4 },
    { title: 'Arrays and Strings', order: 5 },
    { title: 'Pointers and Structures', order: 6 },
    { title: 'Object-Oriented Programming', order: 7 },
    { title: 'Data Structures - Linked Lists', order: 8 },
    { title: 'Data Structures - Stacks and Queues', order: 9 },
    { title: 'Algorithms - Sorting', order: 10 },
    { title: 'Algorithms - Searching', order: 11 },
    { title: 'Time and Space Complexity', order: 12 },
    { title: 'Database Management Systems', order: 13 },
    { title: 'SQL Queries', order: 14 },
    { title: 'Computer Networks', order: 15 },
    { title: 'Operating Systems', order: 16 },
    { title: 'Web Development Basics', order: 17 }
  ],
  operating_systems: [
    { title: 'Introduction to Operating Systems', order: 1 },
    { title: 'Process Management', order: 2 },
    { title: 'Threads and Multithreading', order: 3 },
    { title: 'CPU Scheduling', order: 4 },
    { title: 'Process Synchronization', order: 5 },
    { title: 'Deadlocks', order: 6 },
    { title: 'Memory Management', order: 7 },
    { title: 'Paging', order: 8 },
    { title: 'Segmentation', order: 9 },
    { title: 'Virtual Memory', order: 10 },
    { title: 'File Systems', order: 11 },
    { title: 'I/O Systems', order: 12 },
    { title: 'Virtualization', order: 13 },
    { title: 'Linux Basics', order: 14 }
  ],
  history: [
    { title: 'Ancient Civilizations', order: 1 },
    { title: 'Indus Valley Civilization', order: 2 },
    { title: 'Vedic Period', order: 3 },
    { title: 'Maurya Empire', order: 4 },
    { title: 'Medieval India', order: 5 },
    { title: 'Delhi Sultanate', order: 6 },
    { title: 'Mughal Empire', order: 7 },
    { title: 'British Raj', order: 8 },
    { title: 'Indian Independence Movement', order: 9 },
    { title: 'World War I', order: 10 },
    { title: 'World War II', order: 11 },
    { title: 'Cold War Era', order: 12 }
  ],
  economics: [
    { title: 'Introduction to Economics', order: 1 },
    { title: 'Demand and Supply', order: 2 },
    { title: 'Consumer Behavior', order: 3 },
    { title: 'Production and Cost', order: 4 },
    { title: 'Market Structures', order: 5 },
    { title: 'National Income', order: 6 },
    { title: 'Money and Banking', order: 7 },
    { title: 'Government Budget', order: 8 },
    { title: 'Balance of Payments', order: 9 },
    { title: 'International Trade', order: 10 },
    { title: 'Economic Development', order: 11 }
  ],
  accountancy: [
    { title: 'Introduction to Accounting', order: 1 },
    { title: 'Book Keeping', order: 2 },
    { title: 'Journal and Ledger', order: 3 },
    { title: 'Trial Balance', order: 4 },
    { title: 'Final Accounts', order: 5 },
    { title: 'Depreciation', order: 6 },
    { title: 'Bill of Exchange', order: 7 },
    { title: 'Joint Venture', order: 8 },
    { title: 'Partnership Accounts', order: 9 },
    { title: 'Company Accounts', order: 10 },
    { title: 'Financial Statements', order: 11 }
  ],
  business_studies: [
    { title: 'Nature and Purpose of Business', order: 1 },
    { title: 'Forms of Business Organizations', order: 2 },
    { title: 'Business Correspondence', order: 3 },
    { title: 'Business Services', order: 4 },
    { title: 'Emerging Modes of Business', order: 5 },
    { title: 'Business Finance', order: 6 },
    { title: 'Marketing', order: 7 },
    { title: 'Consumer Protection', order: 8 },
    { title: 'Principles of Management', order: 9 },
    { title: 'Management Functions', order: 10 }
  ],
  geography: [
    { title: 'Physical Geography', order: 1 },
    { title: 'Structure of Earth', order: 2 },
    { title: 'Rocks and Minerals', order: 3 },
    { title: 'Landforms', order: 4 },
    { title: 'Climate and Weather', order: 5 },
    { title: 'Water Cycle', order: 6 },
    { title: 'Oceanography', order: 7 },
    { title: 'India: Physical Features', order: 8 },
    { title: 'India: Climate', order: 9 },
    { title: 'Natural Vegetation', order: 10 },
    { title: 'Map Reading', order: 11 }
  ]
};

export async function getTopicsForSubject(subject: string): Promise<TopicItem[] | null> {
  const normalizedSubject = subject.toLowerCase().trim();
  
  const topicLibrary = await TopicLibrary.findOne({ 
    subject: normalizedSubject 
  });
  
  if (topicLibrary) {
    return topicLibrary.topics as TopicItem[];
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

export async function generateAndCacheTopics(subject: string): Promise<TopicItem[]> {
  const normalizedSubject = subject.toLowerCase().trim();
  
  const defaultTopics = DEFAULT_TOPICS[normalizedSubject];
  
  if (defaultTopics) {
    await TopicLibrary.findOneAndUpdate(
      { subject: normalizedSubject },
      {
        subject: normalizedSubject,
        normalizedSubject,
        topics: defaultTopics,
        source: 'hardcoded',
        createdAt: new Date()
      },
      { upsert: true }
    );
    return defaultTopics;
  }
  
  const { client } = keyManager.getRecoClient();
  
  if (client) {
    try {
      const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });
      
      const prompt = `Generate a structured list of 10 fundamental topics for learning ${subject}.
      Return ONLY a JSON array with order numbers like:
      [{"title": "topic name", "order": 1}, {"title": "topic name", "order": 2}, ...]`;
      
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      const match = response.match(/\[[\s\S]*\]/);
      if (match) {
        const topics = JSON.parse(match[0]);
        
        await TopicLibrary.findOneAndUpdate(
          { subject: normalizedSubject },
          {
            subject: normalizedSubject,
            normalizedSubject,
            topics,
            source: 'ai',
            createdAt: new Date()
          },
          { upsert: true }
        );
        
        return topics;
      }
    } catch (error) {
      console.error('Error generating topics:', error);
    }
  }
  
  return [{ title: `${subject} Basics`, order: 1 }];
}

export async function createUserTodos(
  userId: string, 
  subject: string, 
  topicTitle: string
): Promise<IUserTodo | null> {
  const normalizedSubject = subject.toLowerCase().trim();
  
  const existingTodo = await UserTodo.findOne({
    userId,
    subject: normalizedSubject,
    topicTitle
  });
  
  if (existingTodo) {
    return existingTodo;
  }
  
  const maxOrder = await UserTodo.findOne({ userId })
    .sort({ order: -1 })
    .select('order');
  
  const newTodo = new UserTodo({
    userId,
    subject: normalizedSubject,
    topicTitle,
    completed: false,
    order: (maxOrder?.order || 0) + 1
  });
  
  await newTodo.save();
  return newTodo;
}

export async function createMultipleTodos(
  userId: string,
  subject: string,
  topics: TopicItem[]
): Promise<void> {
  for (const topic of topics) {
    await createUserTodos(userId, subject, topic.title);
  }
}

export async function getUserTodos(userId: string): Promise<IUserTodo[]> {
  return UserTodo.find({ userId }).sort({ order: 1 });
}

export async function getNextIncompleteTopic(userId: string): Promise<IUserTodo | null> {
  return UserTodo.findOne({ userId, completed: false }).sort({ order: 1 });
}

export async function markTodoComplete(todoId: string, userId: string): Promise<IUserTodo | null> {
  const result = await UserTodo.findOneAndUpdate(
    { _id: todoId, userId, completed: false },
    { completed: true, completedAt: new Date() },
    { new: true }
  );
  
  return result;
}

export async function getAllIncompleteTopics(userId: string): Promise<IUserTodo[]> {
  return UserTodo.find({ userId, completed: false }).sort({ order: 1 });
}

export async function getTodoBySubject(userId: string, subject: string): Promise<IUserTodo[]> {
  return UserTodo.find({ userId, subject: subject.toLowerCase() }).sort({ order: 1 });
}

export async function deleteTopicFromTodos(userId: string, topicTitle: string): Promise<void> {
  await UserTodo.deleteOne({ userId, topicTitle });
}
