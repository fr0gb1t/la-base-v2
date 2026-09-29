/**
 * La Base Game Server
 * Fastify + Socket.io backend
 */

import Fastify from 'fastify';
import FastifyIO from 'fastify-socket.io';
import { setupSocketHandlers } from './socket.js';
import { initDB, query, closeDB } from './db.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  authMiddleware,
} from './auth.js';
import type { FastifyInstance } from 'fastify';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const fastify: any = Fastify({
    logger: true,
  });

  // Initialize database
  try {
    await initDB();
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }

  // Register Socket.io plugin
  await fastify.register(FastifyIO, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Setup Socket.io handlers
  setupSocketHandlers(fastify.io);

  fastify.addHook('onRequest', async (request: any, reply: any) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
      return reply.status(204).send();
    }
  });

  // ============ UTILITY ENDPOINTS ============

  // Health check endpoint
  fastify.get('/health', async (request: any, reply: any) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API version endpoint
  fastify.get('/api/version', async (request: any, reply: any) => {
    return { version: '0.1.0', server: 'La Base Game Server' };
  });

  // Server stats endpoint (for monitoring)
  fastify.get('/api/stats', async (request: any, reply: any) => {
    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      connectedUsers: fastify.io.engine.clientsCount,
    };
  });

  // ============ AUTH ENDPOINTS ============

  // POST /api/auth/register
  fastify.post('/api/auth/register', async (request: any, reply: any) => {
    try {
      const { email, username, password } = request.body;

      // Validate inputs
      if (!email || !username || !password) {
        return reply.status(400).send({ error: 'Missing email, username, or password' });
      }

      if (password.length < 6) {
        return reply.status(400).send({ error: 'La contraseña debe tener al menos 6 caracteres' });
      }

      // Check if email already exists
      const emailExists = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (emailExists.rows.length > 0) {
        return reply.status(400).send({ error: 'Email already registered' });
      }

      // Check if username already exists
      const usernameExists = await query('SELECT id FROM users WHERE username = $1', [username]);
      if (usernameExists.rows.length > 0) {
        return reply.status(400).send({ error: 'Ese usuario ya está en uso' });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Insert user
      const userResult = await query(
        'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [email, username, passwordHash]
      );

      const userId = userResult.rows[0].id;

      // Insert player stats
      await query(
        'INSERT INTO player_stats (user_id) VALUES ($1)',
        [userId]
      );

      // Generate token
      const token = generateToken(userId, username);

      return reply.status(201).send({
        token,
        userId,
        username,
      });
    } catch (err) {
      console.error('Register error:', err);
      return reply.status(500).send({ error: 'No se pudo crear la cuenta' });
    }
  });

  // POST /api/auth/login
  fastify.post('/api/auth/login', async (request: any, reply: any) => {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return reply.status(400).send({ error: 'Missing email or password' });
      }

      // Get user by email
      const result = await query(
        'SELECT id, username, password_hash FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return reply.status(401).send({ error: 'Email o contraseña inválidos' });
      }

      const user = result.rows[0];

      // Verify password
      const passwordValid = await verifyPassword(password, user.password_hash);
      if (!passwordValid) {
        return reply.status(401).send({ error: 'Email o contraseña inválidos' });
      }

      // Generate token
      const token = generateToken(user.id, user.username);

      return reply.send({
        token,
        userId: user.id,
        username: user.username,
      });
    } catch (err) {
      console.error('Login error:', err);
      return reply.status(500).send({ error: 'No se pudo iniciar sesión' });
    }
  });

  // ============ GAME DATA ENDPOINTS ============

  // GET /api/rankings
  fastify.get('/api/rankings', async (request: any, reply: any) => {
    try {
      const result = await query(`
        SELECT
          u.id,
          u.username,
          ps.games_played,
          ps.wins,
          ps.losses,
          ps.avg_score,
          ROW_NUMBER() OVER (ORDER BY ps.wins DESC, ps.avg_score DESC) as rank
        FROM users u
        JOIN player_stats ps ON u.id = ps.user_id
        ORDER BY ps.wins DESC, ps.avg_score DESC
        LIMIT 20
      `);

      return reply.send(
        result.rows.map((row: any) => ({
          rank: row.rank,
          userId: row.id,
          username: row.username,
          gamesPlayed: row.games_played,
          wins: row.wins,
          losses: row.losses,
          avgScore: parseFloat(row.avg_score),
        }))
      );
    } catch (err) {
      console.error('Rankings error:', err);
      return reply.status(500).send({ error: 'Failed to fetch rankings' });
    }
  });

  // GET /api/user/:userId/history
  fastify.get(
    '/api/user/:userId/history',
    { preHandler: authMiddleware },
    async (request: any, reply: any) => {
      try {
        const { userId } = request.params;

        // Verify user is requesting their own history or is admin (simplified)
        if (request.user.userId !== userId) {
          return reply.status(403).send({ error: 'No podés ver el historial de otro usuario' });
        }

        const result = await query(
          `SELECT * FROM game_records
           WHERE $1 = ANY(player_ids)
           ORDER BY played_at DESC
           LIMIT 20`,
          [userId]
        );

        return reply.send(
          result.rows.map((row: any) => ({
            gameId: row.id,
            playerIds: row.player_ids,
            winnerTeam: row.winner_team,
            scores: row.scores,
            structure: row.structure,
            playedAt: row.played_at,
          }))
        );
      } catch (err) {
        console.error('History error:', err);
        return reply.status(500).send({ error: 'Failed to fetch game history' });
      }
    }
  );

  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`🎮 La Base Server running on http://${HOST}:${PORT}`);
    console.log(`📡 Socket.io ready for connections`);
    console.log(`💾 Database connected`);
  } catch (err) {
    fastify.log.error(err);
    await closeDB();
    process.exit(1);
  }
}

start().catch(async (err) => {
  console.error('Fatal error:', err);
  await closeDB();
  process.exit(1);
});
