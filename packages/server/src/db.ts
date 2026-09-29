/**
 * Database connection and initialization
 * PostgreSQL + node-postgres (pg)
 */

import { Pool, QueryResult } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

/** Without DATABASE_URL the server runs guest-only (no accounts, rankings or history). */
export const dbEnabled = Boolean(DATABASE_URL);

const pool = dbEnabled ? new Pool({ connectionString: DATABASE_URL }) : null;

/**
 * Execute a query and return results
 */
export async function query(text: string, values?: any[]): Promise<QueryResult> {
  if (!pool) throw new Error('Database disabled (DATABASE_URL not set)');
  const start = Date.now();
  try {
    const result = await pool.query(text, values);
    const duration = Date.now() - start;
    console.log(`[DB Query] ${duration}ms — ${text.substring(0, 50)}...`);
    return result;
  } catch (err) {
    console.error('[DB Error]', err);
    throw err;
  }
}

/**
 * Initialize database schema
 * Creates tables if they don't exist
 */
export async function initDB(): Promise<void> {
  if (!dbEnabled) {
    console.warn('[DB] DATABASE_URL not set: running guest-only (auth, rankings and history disabled)');
    return;
  }
  console.log('[DB] Initializing database schema...');

  try {
    // Users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB] ✓ users table ready');

    // Game records table
    await query(`
      CREATE TABLE IF NOT EXISTS game_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_ids UUID[] NOT NULL,
        winner_team VARCHAR(10) NOT NULL,
        scores JSONB NOT NULL,
        structure VARCHAR(20) NOT NULL,
        played_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB] ✓ game_records table ready');

    // Player stats table
    await query(`
      CREATE TABLE IF NOT EXISTS player_stats (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        games_played INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        avg_score DECIMAL(6,2) DEFAULT 0
      );
    `);
    console.log('[DB] ✓ player_stats table ready');

    console.log('[DB] Schema initialization complete');
  } catch (err) {
    console.error('[DB] Schema initialization failed:', err);
    throw err;
  }
}

/**
 * Close database connection
 */
export async function closeDB(): Promise<void> {
  if (!pool) return;
  await pool.end();
  console.log('[DB] Connection pool closed');
}

export { Pool };
