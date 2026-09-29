/**
 * Database connection and initialization
 * PostgreSQL + node-postgres (pg)
 */

import { Pool, QueryResult } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://labase:labase_dev@localhost:5432/labase';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

/**
 * Execute a query and return results
 */
export async function query(text: string, values?: any[]): Promise<QueryResult> {
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
  await pool.end();
  console.log('[DB] Connection pool closed');
}

export { Pool };
