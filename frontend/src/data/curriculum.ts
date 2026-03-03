export interface LessonData {
  id: string;
  title: string;
  description: string;
  path: string[];
  locked: boolean;
  icon: string;
  color: string;
}

export const LESSONS: LessonData[] = [
  {
    id: 'the-basics',
    title: 'The Basics',
    description: 'Learn to say Hello and introduce yourself.',
    path: ['hello', 'my', 'name', 'nice', 'meet', 'you'],
    locked: false,
    icon: '👋',
    color: 'bg-blue-500' // Matches the blue theme in the mockup
  },
  {
    id: 'forest-friends',
    title: 'Forest Friends',
    description: 'Meet the animals of the forest.',
    path: ['bear', 'rabbit', 'tree', 'bird'],
    locked: true,
    icon: '🌲',
    color: 'bg-green-600'
  },
  {
    id: 'yummy-time',
    title: 'Yummy Time',
    description: 'Learn signs for your favorite foods.',
    path: ['apple', 'milk', 'cookie', 'eat'],
    locked: true,
    icon: '🍎',
    color: 'bg-orange-500'
  },
  {
    id: 'feeling-good',
    title: 'Feeling Good',
    description: 'Express how you feel.',
    path: ['happy', 'sad', 'angry', 'excited'],
    locked: true,
    icon: '😊',
    color: 'bg-purple-500' // Matches the dark blue/purple theme of the mockup popup
  }
];

export const getLessonById = (id: string): LessonData | undefined => {
  return LESSONS.find(lesson => lesson.id === id);
};
