import { Collection, ObjectId } from "mongodb";
import { getDatabase } from "./connection.js";
import {
  IKitDocument,
  CreateKitParams,
  UpdateKitParams,
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
