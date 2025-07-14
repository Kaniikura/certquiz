export interface User {
  id: string;
  email: string;
  username: string;
  role: 'guest' | 'user' | 'premium' | 'admin';
  identityProviderId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  examType: 'CCNP' | 'CCIE';
  category: string;
  tags: string[];
  questionText: string;
  type: 'single' | 'multiple';
  options: QuestionOption[];
  explanation: string;
  detailedExplanation?: string;
  images?: string[];
  createdById: string;
  createdByName?: string;
  isUserGenerated: boolean;
  isPremium: boolean;
  status: 'active' | 'pending' | 'archived';
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface QuizSession {
  id: string;
  userId: string;
  examType?: string;
  category?: string;
  questionCount: number;
  currentIndex: number;
  score?: number;
  isPaused: boolean;
  startedAt: Date;
  completedAt?: Date;
}

export interface SessionQuestion {
  sessionId: string;
  questionId: string;
  order: number;
  answeredAt?: Date;
  selectedOptions: string[];
  isCorrect?: boolean;
}

export interface UserProgress {
  userId: string;
  level: number;
  experience: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  studyTime: number; // in minutes
  streak: number;
  lastStudyDate?: Date;
  categoryStats: Record<string, CategoryStats>;
  updatedAt: Date;
}

export interface CategoryStats {
  attempted: number;
  correct: number;
  accuracy: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirementType: 'questions_solved' | 'accuracy' | 'streak' | 'category_mastery';
  requirementValue: number;
  requirementCategory?: string;
  createdAt: Date;
}

export interface UserBadge {
  userId: string;
  badgeId: string;
  unlockedAt: Date;
}

export interface ProblemReport {
  id: string;
  questionId: string;
  reporterId: string;
  type: 'error' | 'unclear' | 'outdated';
  description: string;
  status: 'pending' | 'accepted' | 'rejected';
  adminComment?: string;
  reviewedById?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface Subscription {
  userId: string;
  plan: 'free' | 'premium';
  status: 'active' | 'cancelled' | 'expired';
  buyMeACoffeeEmail?: string;
  startDate: Date;
  endDate?: Date;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  token: string;
  refreshToken?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Quiz types
export interface QuizStartRequest {
  questionCount: 1 | 3 | 5 | 10;
  examType?: string;
  category?: string;
}

export interface QuizAnswerRequest {
  questionId: string;
  selectedOptions: string[];
}

export interface QuizAnswerResponse {
  isCorrect: boolean;
  explanation: string;
  correctOptions: string[];
  nextQuestion?: Question;
  isComplete: boolean;
}

export interface QuizResults {
  score: number;
  total: number;
  accuracy: number;
  duration: number; // in seconds
  questions: QuizResultQuestion[];
}

export interface QuizResultQuestion {
  id: string;
  questionText: string;
  isCorrect: boolean;
  selectedOptions: string[];
  correctOptions: string[];
}
