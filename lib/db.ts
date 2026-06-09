import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "users.json");

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

// Ensure the data directory and db file exist
function initializeDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
  }
}

// Read the database
export function readDb(): DbSchema {
  initializeDb();
  try {
    const content = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(content);
  } catch (e) {
    return { users: {} };
  }
}

// Write to the database
export function writeDb(data: DbSchema) {
  initializeDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Hash password helper
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}

// Generate salt
export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}
