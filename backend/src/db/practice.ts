import { Collection, ObjectId } from "mongodb";
import { getDatabase } from "./connection.js";

export const PRACTICE_PROGRESS_COLLECTION = "practice_progress";

export interface QuestionPracticeState {
  question_id: string;
  confidence: 1 | 2 | 3 | null;
  attempts: number;
  lastPracticedAt?: string;
}

export interface IPracticeProgressDocument {
  _id?: ObjectId;
  userId: string;
  kitId: string;
  questionStates: QuestionPracticeState[];
  currentQuestionId: string | null;
  sessionStartedAt: Date;
  lastPracticedAt: Date;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Returns the MongoDB collection for practice progress.
 */
export function getPracticeProgressCollection(): Collection<IPracticeProgressDocument> {
  return getDatabase().collection<IPracticeProgressDocument>(PRACTICE_PROGRESS_COLLECTION);
}

/**
 * Ensures unique compound index on { userId: 1, kitId: 1 } for fast lookups
 * and guaranteeing one practice progress record per user per kit.
 */
export async function ensurePracticeProgressIndexes(): Promise<void> {
  const collection = getPracticeProgressCollection();
  await collection.createIndex(
    { userId: 1, kitId: 1 },
    { unique: true, name: "idx_practice_progress_userId_kitId" }
  );
}

/**
 * Finds practice progress document for a given kit and user.
 * Enforces ownership boundary by querying with both kitId and userId.
 */
export async function findPracticeProgress(
  kitId: string,
  userId: string
): Promise<IPracticeProgressDocument | null> {
  const collection = getPracticeProgressCollection();
  return collection.findOne({ kitId, userId });
}

/**
 * Creates a new practice progress document for a given kit and user.
 * Initializes questionStates for all provided question IDs.
 */
export async function createPracticeProgress(
  kitId: string,
  userId: string,
  questionIds: string[]
): Promise<IPracticeProgressDocument> {
  const collection = getPracticeProgressCollection();
  const now = new Date();

  const questionStates: QuestionPracticeState[] = questionIds.map((qId) => ({
    question_id: qId,
    confidence: null,
    attempts: 0,
  }));

  const doc: IPracticeProgressDocument = {
    userId,
    kitId,
    questionStates,
    currentQuestionId: questionIds.length > 0 ? questionIds[0] : null,
    sessionStartedAt: now,
    lastPracticedAt: now,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

/**
 * Updates an existing practice progress document for a given kit and user.
 * Enforces ownership boundary by querying with both kitId and userId.
 */
export async function updatePracticeProgress(
  kitId: string,
  userId: string,
  update: Partial<IPracticeProgressDocument>
): Promise<IPracticeProgressDocument | null> {
  const collection = getPracticeProgressCollection();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { kitId, userId },
    {
      $set: {
        ...update,
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Resets practice progress for a given kit and user.
 * Clears confidence values, resets attempts to 0, sets completed to false,
 * and resets currentQuestionId to the first question.
 * Enforces ownership boundary by querying with both kitId and userId.
 */
export async function resetPracticeProgress(
  kitId: string,
  userId: string,
  questionIds: string[]
): Promise<IPracticeProgressDocument | null> {
  const collection = getPracticeProgressCollection();
  const now = new Date();

  const resetStates: QuestionPracticeState[] = questionIds.map((qId) => ({
    question_id: qId,
    confidence: null,
    attempts: 0,
  }));

  const result = await collection.findOneAndUpdate(
    { kitId, userId },
    {
      $set: {
        questionStates: resetStates,
        currentQuestionId: questionIds.length > 0 ? questionIds[0] : null,
        completed: false,
        lastPracticedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );

  return result;
}
