import { Collection, ObjectId } from "mongodb";
import { getDatabase } from "./connection.js";
import {
  IKitDocument,
  CreateKitParams,
  UpdateKitParams,
  InternalKitQuestion,
  InternalKitFlashcard,
  GenerationStatus,
  KitCoverage,
  KitSchedule,
} from "../types/kit.js";
import { isValidObjectId } from "../utils/validation.js";

const KITS_COLLECTION = "kits";

/**
 * Returns the MongoDB collection for kits.
 */
export function getKitsCollection(): Collection<IKitDocument> {
  return getDatabase().collection<IKitDocument>(KITS_COLLECTION);
}

/**
 * Ensures required indexes for the kits collection.
 * Creates the useful listing index: { userId: 1, createdAt: -1 }
 * to enable efficient retrieval of user kits sorted newest first.
 */
export async function ensureKitIndexes(): Promise<void> {
  const collection = getKitsCollection();
  await collection.createIndex(
    { userId: 1, createdAt: -1 },
    { name: "idx_kits_userId_createdAt" }
  );
}

/**
 * Creates and persists a new Kit document owned by the authenticated user.
 */
export async function createKit(params: CreateKitParams): Promise<IKitDocument> {
  const now = new Date();
  const collection = getKitsCollection();

  const doc: IKitDocument = {
    userId: params.userId,
    status: "pending",
    jd: params.jd,
    source: {
      company: "",
      company_url: params.company_url || "",
      role: "",
      location: "",
      jd_chars: params.jd.length,
      researched_at: "",
      pages_used: [],
    },
    company_brief: {
      summary: "",
      what_they_do: "",
      sources: [],
    },
    role: {
      title: "",
      seniority: "",
      responsibilities: [],
      requirements: [],
    },
    questions: [],
    flashcards: [],
    schedule: {
      days_available: params.days || 5,
      days: [],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc);
  doc._id = result.insertedId;

  return doc;
}

/**
 * Finds a single Kit by ID, enforcing ownership at the database query level.
 * Returns null if the kit does not exist or does not belong to the user.
 */
export async function findKitById(
  kitId: string,
  userId: string
): Promise<IKitDocument | null> {
  if (!isValidObjectId(kitId)) {
    return null;
  }

  const collection = getKitsCollection();
  return collection.findOne({
    _id: new ObjectId(kitId),
    userId,
  });
}

/**
 * Lists all kits owned by the authenticated user, ordered newest first.
 */
export async function listKitsByUser(userId: string): Promise<IKitDocument[]> {
  const collection = getKitsCollection();
  return collection
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
}

/**
 * Updates editable Phase 1/4 fields of a Kit, strictly enforcing ownership at query level.
 * Guarantees ownership, internal IDs, and creation timestamps cannot be changed.
 */
export async function updateKit(
  kitId: string,
  userId: string,
  params: UpdateKitParams
): Promise<IKitDocument | null> {
  if (!isValidObjectId(kitId)) {
    return null;
  }

  const collection = getKitsCollection();
  const updateFields: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (params.jd !== undefined) {
    updateFields["jd"] = params.jd;
    updateFields["source.jd_chars"] = params.jd.length;
  }

  if (params.company_url !== undefined) {
    updateFields["source.company_url"] = params.company_url;
  }

  if (params.days !== undefined) {
    updateFields["schedule.days_available"] = params.days;
  }

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(kitId), userId },
    { $set: updateFields },
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Deletes a Kit owned by the authenticated user.
 * Returns true if deleted, false if not found or unauthorized.
 */
export async function deleteKit(kitId: string, userId: string): Promise<boolean> {
  if (!isValidObjectId(kitId)) {
    return false;
  }

  const collection = getKitsCollection();
  const result = await collection.deleteOne({
    _id: new ObjectId(kitId),
    userId,
  });

  return result.deletedCount === 1;
}

/**
 * Updates extracted requirements for a Kit, strictly enforcing ownership at query level.
 */
export async function updateKitRequirements(
  kitId: string,
  userId: string,
  requirements: IKitDocument["role"]["requirements"]
): Promise<IKitDocument | null> {
  if (!isValidObjectId(kitId)) {
    return null;
  }

  const collection = getKitsCollection();
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(kitId), userId },
    {
      $set: {
        "role.requirements": requirements,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return result;
}

import { CrawledPage } from "../services/crawler/types.js";
import { ResearchResult } from "../services/research/types.js";

/**
 * Updates crawled pages, cached page contents, and researched timestamp for a Kit.
 */
export async function updateKitCrawlResult(
  kitId: string,
  userId: string,
  pagesUsed: string[],
  researchedAt: string,
  crawledPages?: CrawledPage[]
): Promise<IKitDocument | null> {
  if (!isValidObjectId(kitId)) {
    return null;
  }

  const collection = getKitsCollection();
  const setFields: Record<string, unknown> = {
    "source.pages_used": pagesUsed,
    "source.researched_at": researchedAt,
    updatedAt: new Date(),
  };

  if (crawledPages) {
    setFields["crawled_pages"] = crawledPages;
  }

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(kitId), userId },
    {
      $set: setFields,
    },
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Updates research results for a Kit, strictly enforcing ownership at query level
 * and preserving user-edited brief per docs/STATE.md.
 */
export async function updateKitResearchResult(
  kitId: string,
  userId: string,
  research: ResearchResult,
  preserveEditedBrief = true
): Promise<IKitDocument | null> {
  if (!isValidObjectId(kitId)) {
    return null;
  }

  const collection = getKitsCollection();

  const existing = await collection.findOne({
    _id: new ObjectId(kitId),
    userId,
  });

  if (!existing) {
    return null;
  }

  const updateFields: Record<string, unknown> = {
    "source.researched_at": new Date().toISOString(),
    "source.pages_used": research.sourcesUsed,
    "interview_research": research.interviewResearch,
    updatedAt: new Date(),
  };

  if (research.companyName && !existing.source?.company) {
    updateFields["source.company"] = research.companyName;
  }

  // State preservation per docs/STATE.md:
  // If user has edited the company brief, preserve summary and what_they_do
  const isEdited = existing.company_brief?.is_edited === true;
  if (!preserveEditedBrief || !isEdited) {
    updateFields["company_brief.summary"] = research.companyBrief.summary;
    updateFields["company_brief.what_they_do"] = research.companyBrief.what_they_do;
    updateFields["company_brief.sources"] = research.companyBrief.sources;
  } else {
    // Preserve existing summary and what_they_do, update verified sources
    updateFields["company_brief.sources"] = research.companyBrief.sources;
  }

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(kitId), userId },
    { $set: updateFields },
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Updates questions, flashcards, and status for a Kit.
 * Enforces ownership at query level and records updated timestamp.
 */
export async function updateKitQuestionsAndFlashcards(
  kitId: string,
  userId: string,
  questions: InternalKitQuestion[],
  flashcards: InternalKitFlashcard[],
  status: GenerationStatus = "completed"
): Promise<IKitDocument | null> {
  if (!isValidObjectId(kitId)) {
    return null;
  }

  const collection = getKitsCollection();
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(kitId), userId },
    {
      $set: {
        questions,
        flashcards,
        status,
        updatedAt: new Date(),
      },
      $unset: {
        errorMessage: "",
      },
    },
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Updates the generation status and optional error message for a Kit.
 * Enforces ownership at query level.
 */
export async function updateKitStatus(
  kitId: string,
  userId: string,
  status: GenerationStatus,
  errorMessage?: string
): Promise<IKitDocument | null> {
  if (!isValidObjectId(kitId)) {
    return null;
  }

  const collection = getKitsCollection();
  const setFields: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  const updateDoc: Record<string, unknown> = { $set: setFields };
  if (errorMessage) {
    setFields["errorMessage"] = errorMessage;
  } else {
    updateDoc["$unset"] = { errorMessage: "" };
  }

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(kitId), userId },
    updateDoc,
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Updates questions, coverage, and status for a Kit.
 * Strictly enforces query-level ownership and records updated timestamp.
 */
export async function updateKitCoverage(
  kitId: string,
  userId: string,
  questions: InternalKitQuestion[],
  coverage: KitCoverage,
  status: GenerationStatus = "completed"
): Promise<IKitDocument | null> {
  if (!isValidObjectId(kitId)) {
    return null;
  }

  const collection = getKitsCollection();
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(kitId), userId },
    {
      $set: {
        questions,
        "coverage.uncovered_requirement_ids": coverage.uncovered_requirement_ids,
        "coverage.passes": coverage.passes,
        status,
        updatedAt: new Date(),
      },
      $unset: {
        errorMessage: "",
      },
    },
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Updates schedule for a Kit.
 * Strictly enforces query-level ownership and records updated timestamp.
 */
export async function updateKitSchedule(
  kitId: string,
  userId: string,
  schedule: KitSchedule
): Promise<IKitDocument | null> {
  if (!isValidObjectId(kitId)) {
    return null;
  }

  const collection = getKitsCollection();
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(kitId), userId },
    {
      $set: {
        "schedule.days_available": schedule.days_available,
        "schedule.days": schedule.days,
        updatedAt: new Date(),
      },
      $unset: {
        errorMessage: "",
      },
    },
    { returnDocument: "after" }
  );

  return result;
}

import { KitCompanyBrief } from "../types/kit.js";

/**
 * Updates full kit state following a successful regeneration.
 * Enforces ownership at query level and updates timestamp.
 */
export async function updateKitRegenerationResult(
  kitId: string,
  userId: string,
  data: {
    questions: InternalKitQuestion[];
    flashcards: InternalKitFlashcard[];
    coverage: KitCoverage;
    schedule: KitSchedule;
    company_brief?: KitCompanyBrief;
    status: GenerationStatus;
  }
): Promise<IKitDocument | null> {
  if (!isValidObjectId(kitId)) {
    return null;
  }

  const collection = getKitsCollection();
  const setFields: Record<string, unknown> = {
    questions: data.questions,
    flashcards: data.flashcards,
    "coverage.uncovered_requirement_ids": data.coverage.uncovered_requirement_ids,
    "coverage.passes": data.coverage.passes,
    "schedule.days_available": data.schedule.days_available,
    "schedule.days": data.schedule.days,
    status: data.status,
    updatedAt: new Date(),
  };

  if (data.company_brief) {
    setFields["company_brief"] = data.company_brief;
  }

  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(kitId), userId },
    {
      $set: setFields,
      $unset: { errorMessage: "" },
    },
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Restores previous valid kit state on failed regeneration.
 * Sets status to 'failed' and records errorMessage.
 */
export async function restoreKitOnFailedRegeneration(
  kitId: string,
  userId: string,
  previousState: {
    questions: InternalKitQuestion[];
    flashcards: InternalKitFlashcard[];
    coverage: KitCoverage;
    schedule: KitSchedule;
    company_brief: KitCompanyBrief;
  },
  errorMessage: string
): Promise<IKitDocument | null> {
  if (!isValidObjectId(kitId)) {
    return null;
  }

  const collection = getKitsCollection();
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(kitId), userId },
    {
      $set: {
        questions: previousState.questions,
        flashcards: previousState.flashcards,
        coverage: previousState.coverage,
        schedule: previousState.schedule,
        company_brief: previousState.company_brief,
        status: "failed",
        errorMessage,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return result;
}
