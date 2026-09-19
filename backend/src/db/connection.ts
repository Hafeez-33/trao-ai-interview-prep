import { MongoClient, Db } from "mongodb";
import { config, sanitizeDatabaseUrl } from "../config/env.js";

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Connect to MongoDB using the singleton MongoClient.
 * Pings the database on initial connection to guarantee reachability.
 */
export async function connectDatabase(): Promise<Db> {
  if (db && client) {
    return db;
  }

  try {
    const mongoClient = new MongoClient(config.databaseUrl, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    await mongoClient.connect();
    
    // Use the default database specified in the connection string (or admin for ping)
    const database = mongoClient.db();
    
    // Verify connection by issuing a ping command
    await database.command({ ping: 1 });

    client = mongoClient;
    db = database;

    return db;
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown database connection failure";
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
    client = null;
    db = null;
  }
}
