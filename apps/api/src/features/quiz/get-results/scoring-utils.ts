/**
 * Scoring utilities for quiz results
 * @fileoverview Helper functions for answer scoring and result building
 */

import type { QuizSession } from '../domain/aggregates/QuizSession';
import type { Answer } from '../domain/entities/Answer';
import { OptionId, type QuestionId } from '../domain/value-objects/Ids';
import type { QuestionDetails } from '../domain/value-objects/QuestionDetailsService';
import type { AnswerOption, AnswerResult, ScoreSummary } from './dto';

/**
 * Checks if a submitted answer is correct
 * @param selectedOptionIds - User's selected option IDs
 * @param correctOptionIds - Correct option IDs for the question
 * @returns Whether the answer is correct
 */
function isAnswerCorrect(
  selectedOptionIds: readonly OptionId[],
  correctOptionIds: readonly OptionId[]
): boolean {
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
function buildAnswerOptions(
  questionDetails: QuestionDetails,
  selectedOptionIds: readonly OptionId[]
): AnswerOption[] {
  return questionDetails.options.map((option) => ({
    id: OptionId.of(option.id),
    text: option.text,
    isCorrect: option.isCorrect,
    wasSelected: selectedOptionIds.some((selectedId) => selectedId.toString() === option.id),
  }));
}

/**
 * Builds answer results from answer array and question details (improved version)
 * @param answers - Array of submitted answers
 * @param questionDetailsMap - Map of question details
 * @returns Array of answer results and correct count
 */
export function buildAnswerResultsFromAnswers(
  answers: ReadonlyMap<QuestionId, Answer>,
  questionDetailsMap: Map<QuestionId, QuestionDetails>
): { answerResults: AnswerResult[]; correctCount: number } {
  const answerResults: AnswerResult[] = [];
  let correctCount = 0;

  for (const [questionId, answer] of answers) {
    const questionDetails = questionDetailsMap.get(questionId);
    if (!questionDetails) {
      continue; // Skip if question details not found
    }

    // Check correctness using OptionId arrays directly
    const isCorrect = isAnswerCorrect(answer.selectedOptionIds, questionDetails.correctOptionIds);
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
      options: buildAnswerOptions(questionDetails, answer.selectedOptionIds),
    };

    answerResults.push(answerResult);
  }

  return { answerResults, correctCount };
}

/**
 * Builds answer results from session answers and question details (backward compatibility wrapper)
 * @param session - Quiz session with submitted answers
 * @param questionDetailsMap - Map of question details
 * @returns Array of answer results and correct count
 */
export function buildAnswerResults(
  session: QuizSession,
  questionDetailsMap: Map<QuestionId, QuestionDetails>
): { answerResults: AnswerResult[]; correctCount: number } {
  const submittedAnswers = session.getAnswers();
  return buildAnswerResultsFromAnswers(submittedAnswers, questionDetailsMap);
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
