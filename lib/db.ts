import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "users.json");

// Private persistent cloud bucket name for this project on kvdb.io
const CLOUD_DB_URL = "https://kvdb.io/4yCezdK1C7kX3j2sUeNypv/all_users";

export interface UserData {
  passwordHash: string;
  salt: string;
  progress: any;
  notes: any;
  studyHistory: any[];
  completedDays: any;
  updatedAt: string;
  token?: string;
}

export interface DbSchema {
  users: {
    [username: string]: UserData;
  };
}

let dbCache: DbSchema | null = null;

function initializeLocalDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
  }
}

// Read the database asynchronously (checks cloud, falls back to local)
export async function readDb(): Promise<DbSchema> {
  // Try fetching from the cloud database first
  try {
    const res = await fetch(CLOUD_DB_URL, {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
    });
    if (res.ok) {
      const data = await res.json();
      dbCache = data;
      return data;
    }
  } catch (e) {
    console.warn("Could not read from cloud DB, falling back to local storage...", e);
  }

  // Fallback to local file
  if (dbCache) return dbCache;
  initializeLocalDb();
  try {
    const content = fs.readFileSync(DB_FILE, "utf-8");
    dbCache = JSON.parse(content);
    return dbCache!;
  } catch (e) {
    return { users: {} };
  }
}

// Write to the database (saves to local file and syncs to cloud)
export async function writeDb(data: DbSchema): Promise<void> {
  dbCache = data;

  // 1. Write to local file for offline usage
  try {
    initializeLocalDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Local file database write failed", e);
  }

  // 2. Synchronize to the cloud database for serverless persistence
  try {
    const response = await fetch(CLOUD_DB_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      console.error("Cloud DB write returned non-OK response:", response.status);
    }
  } catch (e) {
    console.error("Cloud DB write failed", e);
  }
}

// Hash password helper
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}

// Generate salt
export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}
