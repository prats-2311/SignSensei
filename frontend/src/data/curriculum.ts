export interface LessonWord {
  word: string;
  description: string;
}

export interface LessonData {
  id: string;
  title: string;
  description: string;
  path: LessonWord[];
  locked: boolean;
  icon: string;
  color: string;
  bossStageSentence?: string;
}

export const LESSONS: LessonData[] = [
  {
    id: 'the-basics',
    title: 'The Basics',
    description: 'Learn to say Hello and introduce yourself.',
    path: [
      { word: 'hello', description: 'Place your hand, palm facing forward, and bring it to your forehead for a salute.' },
      { word: 'my', description: 'Take your open hand and place it flat against your chest.' },
      { word: 'name', description: 'Use your H-handshape (two fingers together) and tap it twice on your chest.' },
      { word: 'nice', description: 'Place your non-dominant hand flat, palm up. Brush your dominant hand across it from fingertips to wrist.' },
      { word: 'meet', description: 'Hold both hands in "1" shapes, palms facing each other, and bring them together.' },
      { word: 'you', description: 'Point your index finger toward the other person.' }
    ],
    bossStageSentence: 'hello, my name nice meet you',
    locked: false,
    icon: '👋',
    color: 'bg-blue-500' // Matches the blue theme in the mockup
  },
  {
    id: 'forest-friends',
    title: 'Forest Friends',
    description: 'Meet the animals of the forest.',
    path: [
      { word: 'bear', description: 'Cross your arms over your chest and scratch near your shoulders.' },
      { word: 'rabbit', description: 'Cross your arms, making U-shapes with both hands ("bunny ears"), and twitch them.' },
      { word: 'tree', description: 'Rest your dominant elbow on your non-dominant hand. Twist your dominant hand back and forth like leaves fluttering.' },
      { word: 'bird', description: 'Make a beak near your mouth with your index finger and thumb, and tweet them together.' }
    ],
    bossStageSentence: 'bear rabbit tree bird',
    locked: true,
    icon: '🌲',
    color: 'bg-green-600'
  },
  {
    id: 'yummy-time',
    title: 'Yummy Time',
    description: 'Learn signs for your favorite foods.',
    path: [
      { word: 'apple', description: 'Twist the knuckle of your index finger into your cheek.' },
      { word: 'milk', description: 'Open and close your fist like you are milking a cow.' },
      { word: 'cookie', description: 'Place your non-dominant hand flat. Use your dominant hand like a cookie cutter, twisting it on the flat hand.' },
      { word: 'eat', description: 'Bring your fingers together to your thumb and tap them against your mouth.' }
    ],
    bossStageSentence: 'eat apple cookie drink milk',
    locked: true,
    icon: '🍎',
    color: 'bg-orange-500'
  },
  {
    id: 'feeling-good',
    title: 'Feeling Good',
    description: 'Express how you feel.',
    path: [
      { word: 'happy', description: 'Brush both open hands upward on your chest.' },
      { word: 'sad', description: 'Hold both hands with fingers spread in front of your face and pull them downward while frowning.' },
      { word: 'angry', description: 'Make a claw shape with your hand and pull it forcefully away from your chest or face.' },
      { word: 'excited', description: 'Use your middle fingers to alternately brush upward on your chest quickly.' }
    ],
    bossStageSentence: 'happy sad angry excited',
    locked: true,
    icon: '😊',
    color: 'bg-purple-500' // Matches the dark blue/purple theme of the mockup popup
  }
];

export const getLessonById = (id: string): LessonData | undefined => {
  return LESSONS.find(lesson => lesson.id === id);
};
