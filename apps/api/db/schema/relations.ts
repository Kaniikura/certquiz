import { relations } from 'drizzle-orm';
import { badges, problemReports, userBadges } from './community';
import { categories, exams } from './exam';
import {
  bookmarks,
  questionCategories,
  questionExams,
  questionHistory,
  questionOptions,
  questions,
} from './question';
import { quizSessions, sessionQuestions, sessionSelectedOptions } from './quiz';
import { subscriptions, userProgress, users } from './user';

// User relations
export const usersRelations = relations(users, ({ one, many }) => ({
  progress: one(userProgress),
  subscription: one(subscriptions),
  badges: many(userBadges),
  createdQuestions: many(questions),
  reports: many(problemReports),
  sessions: many(quizSessions),
  bookmarks: many(bookmarks),
}));

// User progress relations
export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.id],
  }),
}));

// Subscription relations
export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

// Exam relations
export const examsRelations = relations(exams, ({ many }) => ({
  questions: many(questionExams),
  sessions: many(quizSessions),
}));

// Category relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  questions: many(questionCategories),
  sessions: many(quizSessions),
}));

// Question relations
export const questionsRelations = relations(questions, ({ one, many }) => ({
  creator: one(users, {
    fields: [questions.createdById],
    references: [users.id],
  }),
  options: many(questionOptions),
  exams: many(questionExams),
  categories: many(questionCategories),
  reports: many(problemReports),
  bookmarks: many(bookmarks),
  history: many(questionHistory),
  sessionQuestions: many(sessionQuestions),
}));

// Question options relations
export const questionOptionsRelations = relations(questionOptions, ({ one, many }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
  selectedOptions: many(sessionSelectedOptions),
}));

// Question-Exam junction relations
export const questionExamsRelations = relations(questionExams, ({ one }) => ({
  question: one(questions, {
    fields: [questionExams.questionId],
    references: [questions.id],
  }),
  exam: one(exams, {
    fields: [questionExams.examId],
    references: [exams.id],
  }),
}));

// Question-Category junction relations
export const questionCategoriesRelations = relations(questionCategories, ({ one }) => ({
  question: one(questions, {
    fields: [questionCategories.questionId],
    references: [questions.id],
  }),
  category: one(categories, {
    fields: [questionCategories.categoryId],
    references: [categories.id],
  }),
}));

// Bookmark relations
export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
  question: one(questions, {
    fields: [bookmarks.questionId],
    references: [questions.id],
  }),
}));

// Question history relations
export const questionHistoryRelations = relations(questionHistory, ({ one }) => ({
  question: one(questions, {
    fields: [questionHistory.questionId],
    references: [questions.id],
  }),
  editor: one(users, {
    fields: [questionHistory.editedById],
    references: [users.id],
  }),
}));

// Quiz session relations
export const quizSessionsRelations = relations(quizSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [quizSessions.userId],
    references: [users.id],
  }),
  exam: one(exams, {
    fields: [quizSessions.examId],
    references: [exams.id],
  }),
  category: one(categories, {
    fields: [quizSessions.categoryId],
    references: [categories.id],
  }),
  questions: many(sessionQuestions),
  selectedOptions: many(sessionSelectedOptions),
}));

// Session questions relations
export const sessionQuestionsRelations = relations(sessionQuestions, ({ one, many }) => ({
  session: one(quizSessions, {
    fields: [sessionQuestions.sessionId],
    references: [quizSessions.id],
  }),
  question: one(questions, {
    fields: [sessionQuestions.questionId],
    references: [questions.id],
  }),
  selectedOptions: many(sessionSelectedOptions),
}));

// Session selected options relations
export const sessionSelectedOptionsRelations = relations(sessionSelectedOptions, ({ one }) => ({
  session: one(quizSessions, {
    fields: [sessionSelectedOptions.sessionId],
    references: [quizSessions.id],
  }),
  question: one(questions, {
    fields: [sessionSelectedOptions.questionId],
    references: [questions.id],
  }),
  option: one(questionOptions, {
    fields: [sessionSelectedOptions.optionId],
    references: [questionOptions.id],
  }),
}));

// Badge relations
export const badgesRelations = relations(badges, ({ many }) => ({
  userBadges: many(userBadges),
}));

// User badges relations
export const userBadgesRelations = relations(userBadges, ({ one }) => ({
  user: one(users, {
    fields: [userBadges.userId],
    references: [users.id],
  }),
  badge: one(badges, {
    fields: [userBadges.badgeId],
    references: [badges.id],
  }),
}));

// Problem reports relations
export const problemReportsRelations = relations(problemReports, ({ one }) => ({
  question: one(questions, {
    fields: [problemReports.questionId],
    references: [questions.id],
  }),
  reporter: one(users, {
    fields: [problemReports.reporterId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [problemReports.reviewedById],
    references: [users.id],
  }),
}));
