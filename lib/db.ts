import crypto from "crypto";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_Cymk8Dd7hNUp@ep-crimson-math-aou4n1yr.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

// Create a connection pool to Neon PostgreSQL
const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

export interface UserData {
  passwordHash: string;
  salt: string;
  progress: any;
  notes: any;
  studyHistory: any[];
  completedDays: any;
  studyPlan?: any;
  hardVerses?: any;
  updatedAt: string;
  token?: string;
}

export interface DbSchema {
  users: {
    [username: string]: UserData;
  };
}

let isInitialized = false;

// Initialize table if it doesn't exist
async function initDb() {
  if (isInitialized) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        username VARCHAR(255) PRIMARY KEY,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        progress JSONB DEFAULT '{}'::jsonb,
        notes JSONB DEFAULT '{}'::jsonb,
        study_history JSONB DEFAULT '[]'::jsonb,
        completed_days JSONB DEFAULT '{}'::jsonb,
        study_plan JSONB DEFAULT NULL,
        hard_verses JSONB DEFAULT '{}'::jsonb,
        token TEXT,
        updated_at TEXT
      );
    `);
    // Ensure column exists for existing tables
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS study_plan JSONB DEFAULT NULL;
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS hard_verses JSONB DEFAULT '{}'::jsonb;
    `);
    isInitialized = true;
  } catch (error) {
    console.error("Failed to initialize database table in PostgreSQL", error);
  } finally {
    client.release();
  }
}

// Read the database asynchronously from PostgreSQL
export async function readDb(): Promise<DbSchema> {
  await initDb();
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT * FROM users");
    const users: { [username: string]: UserData } = {};
    
    res.rows.forEach((row) => {
      users[row.username] = {
        passwordHash: row.password_hash,
        salt: row.salt,
        progress: row.progress || {},
        notes: row.notes || {},
        studyHistory: row.study_history || [],
        completedDays: row.completed_days || {},
        studyPlan: row.study_plan || null,
        hardVerses: row.hard_verses || {},
        token: row.token || undefined,
        updatedAt: row.updated_at || new Date().toISOString(),
      };
    });
    
    return { users };
  } catch (e) {
    console.error("PostgreSQL read query failed", e);
    return { users: {} };
  } finally {
    client.release();
  }
}

// Write to the database by upserting users into PostgreSQL
export async function writeDb(data: DbSchema): Promise<void> {
  await initDb();
  const client = await pool.connect();
  try {
    // Perform transactional inserts/updates to avoid race conditions or partial updates
    await client.query("BEGIN");
    for (const username of Object.keys(data.users)) {
      const u = data.users[username];
      await client.query(
        `INSERT INTO users (username, password_hash, salt, progress, notes, study_history, completed_days, study_plan, hard_verses, token, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (username) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           salt = EXCLUDED.salt,
           progress = EXCLUDED.progress,
           notes = EXCLUDED.notes,
           study_history = EXCLUDED.study_history,
           completed_days = EXCLUDED.completed_days,
           study_plan = EXCLUDED.study_plan,
           hard_verses = EXCLUDED.hard_verses,
           token = EXCLUDED.token,
           updated_at = EXCLUDED.updated_at`,
        [
          username,
          u.passwordHash,
          u.salt,
          JSON.stringify(u.progress || {}),
          JSON.stringify(u.notes || {}),
          JSON.stringify(u.studyHistory || []),
          JSON.stringify(u.completedDays || {}),
          u.studyPlan ? JSON.stringify(u.studyPlan) : null,
          JSON.stringify(u.hardVerses || {}),
          u.token || null,
          u.updatedAt || new Date().toISOString()
        ]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("PostgreSQL write/sync transaction failed", e);
    throw e;
  } finally {
    client.release();
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
