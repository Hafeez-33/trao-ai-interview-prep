import { MongoClient, Db } from "mongodb";
import { config } from "../config/env.js";

let clientPromise: Promise<MongoClient> | null = null;
let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Returns a Promise that resolves to the singleton MongoClient instance.
 */
export function getClientPromise(): Promise<MongoClient> {
  if (clientPromise) {
    return clientPromise;
  }

  const mongoClient = new MongoClient(config.databaseUrl, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  clientPromise = mongoClient.connect().then((c) => {
    client = c;
    db = c.db();
    return c;
  });

  return clientPromise;
}

/**
 * Connect to MongoDB using the singleton MongoClient.
 * Pings the database on initial connection to guarantee reachability.
 */
export async function connectDatabase(): Promise<Db> {
  if (db && client) {
    return db;
  }

  try {
    const mongoClient = await getClientPromise();
    client = mongoClient;
    db = mongoClient.db();

    // Verify connection by issuing a ping command
    await db.command({ ping: 1 });

    return db;
  } catch (error) {
    // Reset cached promise so subsequent attempts can retry
    clientPromise = null;
    client = null;
    db = null;

    const rawMessage =
      error instanceof Error ? error.message : "Unknown database connection failure";
    // Ensure raw error message does not contain credentials
    const safeMessage = rawMessage.replace(/\/\/([^:]+):([^@]+)@/g, "/***@");
    throw new Error(`Failed to connect to MongoDB: ${safeMessage}`);
  }
}

/**
 * Returns the active MongoDB Db instance.
 * Throws if the database has not been initialized.
 */
export function getDatabase(): Db {
  if (!db) {
    throw new Error("Database not connected. Call connectDatabase() first.");
  }
  return db;
}

/**
 * Returns the active MongoClient instance.
 */
export function getClient(): MongoClient {
  if (!client) {
    throw new Error("MongoClient not connected. Call connectDatabase() first.");
  }
  return client;
}

/**
 * Pings the database to verify live connectivity.
 * Used by health checks.
 */
export async function pingDatabase(): Promise<boolean> {
  if (!client || !db) {
    return false;
  }

  try {
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully closes the MongoDB connection.
 */
export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    clientPromise = null;
    client = null;
    db = null;
  }
}
