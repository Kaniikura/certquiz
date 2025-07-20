/**
 * Scoring utilities for quiz results
 * @fileoverview Helper functions for answer scoring and result building
 */

import type { QuizSession } from '../domain/aggregates/QuizSession';
import type { QuestionId } from '../domain/value-objects/Ids';
import type { AnswerOption, AnswerResult, ScoreSummary } from './dto';
import type { QuestionDetails } from './QuestionDetailsService';

/**
 * Checks if a submitted answer is correct
 * @param selectedOptionIds - User's selected option IDs
 * @param correctOptionIds - Correct option IDs for the question
 * @returns Whether the answer is correct
 */
export function isAnswerCorrect(selectedOptionIds: string[], correctOptionIds: string[]): boolean {
  const selectedSet = new Set(selectedOptionIds);
  const correctSet = new Set(correctOptionIds);

  return selectedSet.size === correctSet.size && [...selectedSet].every((id) => correctSet.has(id));
}

/**
 * Builds answer options with selection and correctness info
 * @param questionDetails - Question details from service
 * @param selectedOptionIds - User's selected option IDs
 * @returns Formatted answer options
 */
export function buildAnswerOptions(
  questionDetails: QuestionDetails,
  selectedOptionIds: string[]
): AnswerOption[] {
  return questionDetails.options.map((option) => ({
    id: option.id,
    text: option.text,
    isCorrect: option.isCorrect,
    wasSelected: selectedOptionIds.some((selectedId) => selectedId === option.id),
  }));
}

/**
 * Builds answer results from session answers and question details
 * @param session - Quiz session with submitted answers
 * @param questionDetailsMap - Map of question details
 * @returns Array of answer results and correct count
 */
export function buildAnswerResults(
  session: QuizSession,
  questionDetailsMap: Map<QuestionId, QuestionDetails>
): { answerResults: AnswerResult[]; correctCount: number } {
  const answerResults: AnswerResult[] = [];
  let correctCount = 0;
  const submittedAnswers = session.getAnswers();

  for (const [questionId, answer] of submittedAnswers) {
    const questionDetails = questionDetailsMap.get(questionId);
    if (!questionDetails) {
      continue; // Skip if question details not found
    }

    // Convert IDs to strings for comparison
    const selectedIds = answer.selectedOptionIds.map((id) => id.toString());
    const correctIds = questionDetails.correctOptionIds.map((id) => id.toString());

    // Check correctness
    const isCorrect = isAnswerCorrect(selectedIds, correctIds);
    if (isCorrect) {
      correctCount++;
    }

    // Build answer result
    const answerResult: AnswerResult = {
      questionId: questionId,
      selectedOptionIds: [...answer.selectedOptionIds],
      correctOptionIds: [...questionDetails.correctOptionIds],
      isCorrect: isCorrect,
      submittedAt: answer.answeredAt,
      questionText: questionDetails.text,
      options: buildAnswerOptions(questionDetails, selectedIds),
    };

    answerResults.push(answerResult);
  }

  return { answerResults, correctCount };
}

/**
 * Calculates score summary for quiz results
 * @param correctAnswers - Number of correct answers
 * @param totalQuestions - Total number of questions
 * @param passingCriteria - Optional passing criteria (not yet implemented)
 * @returns Score summary with percentage and pass/fail
 */
export function calculateScoreSummary(
  correctAnswers: number,
  totalQuestions: number,
  passingCriteria?: { passingPercentage: number }
): ScoreSummary {
  const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  // Passing criteria not yet implemented in domain model
  const passed = passingCriteria ? percentage >= passingCriteria.passingPercentage : null;
  const passingPercentage = passingCriteria?.passingPercentage ?? null;

  return {
    correctAnswers,
    totalQuestions,
    percentage,
    passed,
    passingPercentage,
  };
}
