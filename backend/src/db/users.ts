import { Collection, ObjectId } from "mongodb";
import { getDatabase } from "./connection.js";
import { IUser } from "../types/auth.js";

const USERS_COLLECTION = "users";

/**
 * Returns the MongoDB collection for users.
 */
export function getUsersCollection(): Collection<IUser> {
  return getDatabase().collection<IUser>(USERS_COLLECTION);
}

/**
 * Ensures unique index on email for the users collection.
 * Idempotent and safe to run on startup.
 */
export async function ensureUserIndexes(): Promise<void> {
  const collection = getUsersCollection();
  await collection.createIndex({ email: 1 }, { unique: true, name: "idx_users_email_unique" });
}

/**
 * Finds a user by normalized email address.
 */
export async function findUserByEmail(email: string): Promise<IUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const collection = getUsersCollection();
  return collection.findOne({ email: normalizedEmail });
}

/**
 * Finds a user by their MongoDB ObjectId string.
 */
export async function findUserById(id: string): Promise<IUser | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }
  const collection = getUsersCollection();
  return collection.findOne({ _id: new ObjectId(id) });
}

/**
 * Creates and persists a new user record.
 */
export async function createUser(
  email: string,
  passwordHash: string,
  name?: string
): Promise<IUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();

  const userDoc: IUser = {
    email: normalizedEmail,
    passwordHash,
    ...(name ? { name: name.trim() } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const collection = getUsersCollection();
  const result = await collection.insertOne(userDoc);
  userDoc._id = result.insertedId;

  return userDoc;
}
