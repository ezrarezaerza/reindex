import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
      };
    }
  }
}

const { Pool } = pg;
const PORT = 3000;

// Initialize PostgreSQL pool lazily to prevent crashing if credentials are not yet set
let pool: pg.Pool | null = null;
let dbConnected = false;
let dbErrorMsg = '';

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    dbErrorMsg = 'Database connection string (POSTGRES_URL) is not defined in environment variables.';
    console.warn('⚠️ [DB Warning]: ' + dbErrorMsg);
    return null;
  }

  try {
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false // Required for Vercel/Neon serverless Postgres
      },
      connectionTimeoutMillis: 5000, // Fast timeout so server doesn't hang
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
      dbConnected = false;
      dbErrorMsg = err.message;
    });

    return pool;
  } catch (err: any) {
    dbErrorMsg = err.message;
    console.error('Failed to initialize PostgreSQL pool:', err);
    return null;
  }
}

// Helper to hash passwords using PBKDF2 sync
function hashPassword(password: string): string {
  const salt = 'reindex_secure_salt_key_99';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

// Automatically create tables on startup if database is connected
async function initializeDatabase() {
  const dbPool = getPool();
  if (!dbPool) return;

  try {
    const client = await dbPool.connect();
    console.log('🔌 Connected to PostgreSQL database. Checking schema...');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(255) PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL
      )
    `);

    // Create drives table
    await client.query(`
      CREATE TABLE IF NOT EXISTS drives (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        letter VARCHAR(10) NOT NULL,
        color VARCHAR(50) NOT NULL,
        icon VARCHAR(50) NOT NULL,
        last_updated VARCHAR(50) NOT NULL,
        file_count INT DEFAULT 0,
        total_size BIGINT DEFAULT 0,
        description TEXT
      )
    `);

    // Add user_id column to drives if it doesn't exist
    try {
      await client.query(`ALTER TABLE drives ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE`);
    } catch (err) {
      console.log('drives table user_id column already exists or alter skipped.');
    }

    // Create files table
    await client.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        drive_id VARCHAR(50) REFERENCES drives(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        extension VARCHAR(50),
        length BIGINT NOT NULL
      )
    `);

    // Add indexes for efficient search
    await client.query(`CREATE INDEX IF NOT EXISTS idx_files_drive_id ON files(drive_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_files_name ON files(name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_files_fullname ON files(full_name)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_files_length ON files(length)`);

    // Try creating trgm extension and GIN indexes for fuzzy search (highly robust fallback if unsupported)
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_files_name_trgm ON files USING gin (name gin_trgm_ops)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_files_fullname_trgm ON files USING gin (full_name gin_trgm_ops)`);
      console.log('⚡ pg_trgm extension and GIN trigram indexes initialized for ultra-fast searches.');
    } catch (e: any) {
      console.warn('⚠️ pg_trgm extension or GIN trigram index creation skipped (regular indices will be used):', e.message);
    }

    client.release();
    dbConnected = true;
    dbErrorMsg = '';
    console.log('✅ Database schema initialized and indexes verified.');
  } catch (err: any) {
    dbConnected = false;
    dbErrorMsg = err.message;
    console.error('❌ Database schema initialization failed:', err);
  }
}

async function startServer() {
  const app = express();

  // Parse JSON payloads up to 100MB (crucial for uploading massive file indices)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Run database initialization
  await initializeDatabase();

  // --- Authentication Middleware ---
  async function authenticateUser(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = req.headers['x-auth-token'] || req.headers['authorization']?.toString().replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' });
    }

    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ error: 'Database is currently offline.' });
    }

    try {
      const sessionResult = await dbPool.query(`
        SELECT s.token, s.user_id, u.username, s.expires_at 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.token = $1 AND s.expires_at > CURRENT_TIMESTAMP
      `, [token]);

      if (sessionResult.rowCount === 0) {
        return res.status(401).json({ error: 'Session is invalid or expired.', code: 'UNAUTHORIZED' });
      }

      req.user = {
        id: sessionResult.rows[0].user_id,
        username: sessionResult.rows[0].username
      };
      next();
    } catch (err: any) {
      console.error('Session verification failed:', err);
      res.status(500).json({ error: 'Auth check failure.', details: err.message });
    }
  }

  // --- API Endpoints ---

  // 1. Get database connectivity status
  app.get('/api/db-status', async (req, res) => {
    const dbPool = getPool();
    if (!dbPool) {
      return res.json({ connected: false, error: dbErrorMsg || 'No credentials configured.' });
    }

    try {
      const client = await dbPool.connect();
      await client.query('SELECT 1');
      client.release();
      dbConnected = true;
      res.json({ connected: true });
    } catch (err: any) {
      dbConnected = false;
      dbErrorMsg = err.message;
      res.json({ connected: false, error: err.message });
    }
  });

  // --- Authentication Operations ---

  // Register a new user profile
  app.post('/api/auth/register', async (req, res) => {
    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ error: 'Database is offline.' });
    }

    const { username, password } = req.body;
    if (!username || !password || username.trim().length < 3 || password.length < 4) {
      return res.status(400).json({ error: 'Username must be at least 3 characters and password at least 4 characters.' });
    }

    try {
      const userCheck = await dbPool.query('SELECT id FROM users WHERE username = $1', [username.trim()]);
      if (userCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Username is already taken.' });
      }

      const passwordHash = hashPassword(password);
      const insertResult = await dbPool.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
        [username.trim(), passwordHash]
      );

      const newUser = insertResult.rows[0];
      
      // Auto-generate session token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      await dbPool.query(
        'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
        [token, newUser.id, expiresAt]
      );

      res.status(201).json({
        success: true,
        token,
        user: { id: newUser.id, username: newUser.username }
      });
    } catch (err: any) {
      console.error('Registration failed:', err);
      res.status(500).json({ error: 'Failed to complete registration.', details: err.message });
    }
  });

  // Authenticate and log in an existing user
  app.post('/api/auth/login', async (req, res) => {
    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ error: 'Database is offline.' });
    }

    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
      const userResult = await dbPool.query('SELECT * FROM users WHERE username = $1', [username.trim()]);
      if (userResult.rowCount === 0) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      const user = userResult.rows[0];
      if (user.password_hash !== hashPassword(password)) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      // Generate session token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      await dbPool.query(
        'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
        [token, user.id, expiresAt]
      );

      res.json({
        success: true,
        token,
        user: { id: user.id, username: user.username }
      });
    } catch (err: any) {
      console.error('Login failed:', err);
      res.status(500).json({ error: 'Failed to complete authentication.', details: err.message });
    }
  });

  // Log out current user (destroy session)
  app.post('/api/auth/logout', async (req, res) => {
    const dbPool = getPool();
    if (!dbPool) return res.status(503).json({ error: 'Database is offline.' });

    const token = req.headers['x-auth-token'] || req.headers['authorization']?.toString().replace('Bearer ', '');
    if (!token) {
      return res.json({ success: true, message: 'Already logged out.' });
    }

    try {
      await dbPool.query('DELETE FROM sessions WHERE token = $1', [token]);
      res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err: any) {
      console.error('Logout failed:', err);
      res.status(500).json({ error: 'Failed to clear session.', details: err.message });
    }
  });

  // Verify session and fetch profile
  app.get('/api/auth/me', authenticateUser, (req, res) => {
    res.json({ success: true, user: req.user });
  });

  // 2. Retrieve all drives (metadata-only, extremely fast) for the active user
  app.get('/api/drives', authenticateUser, async (req, res) => {
    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ 
        error: 'Database is not connected.', 
        details: dbErrorMsg || 'Please configure POSTGRES_URL.' 
      });
    }

    const userId = req.user!.id;

    try {
      console.log(`Fetching drives for user ID [${userId}] from Postgres...`);
      const drivesResult = await dbPool.query('SELECT * FROM drives WHERE user_id = $1 ORDER BY name ASC', [userId]);

      const drives = drivesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        letter: row.letter,
        color: row.color,
        icon: row.icon,
        lastUpdated: row.last_updated,
        fileCount: Number(row.file_count) || 0,
        totalSize: Number(row.total_size) || 0,
        description: row.description || '',
        items: [] // Empty by default in high-performance mode; files fetched on-demand via search endpoint
      }));

      res.json(drives);
    } catch (err: any) {
      console.error('Error fetching drives from Postgres:', err);
      res.status(500).json({ error: 'Failed to retrieve storage catalogs.', details: err.message });
    }
  });

  // 3. Create or completely overwrite a drive catalog (with ultra-fast UNNEST array bulk insert)
  app.post('/api/drives', authenticateUser, async (req, res) => {
    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ 
        error: 'Database is not connected.', 
        details: dbErrorMsg || 'Please configure POSTGRES_URL.' 
      });
    }

    const { id, name, letter, color, icon, lastUpdated, fileCount, totalSize, description, items } = req.body;
    const userId = req.user!.id;

    if (!id || !name || !letter) {
      return res.status(400).json({ error: 'Missing required drive parameters: id, name, or letter.' });
    }

    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert or update the drive profile scoped to this user
      await client.query(`
        INSERT INTO drives (id, user_id, name, letter, color, icon, last_updated, file_count, total_size, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          name = EXCLUDED.name,
          letter = EXCLUDED.letter,
          color = EXCLUDED.color,
          icon = EXCLUDED.icon,
          last_updated = EXCLUDED.last_updated,
          file_count = EXCLUDED.file_count,
          total_size = EXCLUDED.total_size,
          description = EXCLUDED.description
      `, [id, userId, name, letter, color, icon, lastUpdated, fileCount || 0, totalSize || 0, description || '']);

      // 2. Clear old files associated with this drive
      await client.query('DELETE FROM files WHERE drive_id = $1', [id]);

      // 3. Perform UNNEST bulk array insertions (maximum performance and low latency)
      if (items && Array.isArray(items) && items.length > 0) {
        const batchSize = 25000; // Batch into sizes of 25k to control raw request payload limits
        for (let i = 0; i < items.length; i += batchSize) {
          const chunk = items.slice(i, i + batchSize);
          
          const names: string[] = [];
          const fullNames: string[] = [];
          const extensions: string[] = [];
          const lengths: number[] = [];

          for (const file of chunk) {
            names.push(file.Name || 'Unnamed file');
            fullNames.push(file.FullName || '');
            extensions.push(file.Extension || '');
            lengths.push(Number(file.Length ?? 0));
          }

          const insertQuery = `
            INSERT INTO files (drive_id, name, full_name, extension, length)
            SELECT $1, t.name, t.full_name, t.extension, t.length
            FROM UNNEST($2::text[], $3::text[], $4::text[], $5::bigint[]) AS t(name, full_name, extension, length)
          `;
          await client.query(insertQuery, [id, names, fullNames, extensions, lengths]);
        }
      }

      await client.query('COMMIT');
      console.log(`Successfully stored catalog for drive [${name}] with ${items?.length || 0} files.`);
      res.json({ success: true, message: `Drive catalog '${name}' synchronized successfully.` });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('Failed to save drive catalog to Postgres:', err);
      res.status(500).json({ error: 'Database transaction failed while saving catalog.', details: err.message });
    } finally {
      client.release();
    }
  });

  // 4. Update single drive properties (like renaming)
  app.patch('/api/drives/:id', authenticateUser, async (req, res) => {
    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ error: 'Database is not connected.' });
    }

    const { id } = req.params;
    const { name } = req.body;
    const userId = req.user!.id;

    if (!name) {
      return res.status(400).json({ error: 'Missing field: name' });
    }

    try {
      const result = await dbPool.query(
        'UPDATE drives SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
        [name, id, userId]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Drive catalog not found or not owned by you.' });
      }
      res.json({ success: true, drive: result.rows[0] });
    } catch (err: any) {
      console.error('Failed to rename drive:', err);
      res.status(500).json({ error: 'Failed to update drive properties.', details: err.message });
    }
  });

  // 5. Delete a drive catalog (cascades automatically to delete associated files)
  app.delete('/api/drives/:id', authenticateUser, async (req, res) => {
    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ error: 'Database is not connected.' });
    }

    const { id } = req.params;
    const userId = req.user!.id;

    try {
      const result = await dbPool.query('DELETE FROM drives WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Drive catalog not found or not owned by you.' });
      }
      res.json({ success: true, message: `Catalog for drive '${result.rows[0].name}' deleted.` });
    } catch (err: any) {
      console.error('Failed to delete drive catalog:', err);
      res.status(500).json({ error: 'Failed to remove storage catalog.', details: err.message });
    }
  });

  // 6. Highly optimized database search with pagination and size/ext filters
  app.get('/api/search', authenticateUser, async (req, res) => {
    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ error: 'Database is not connected.' });
    }

    const userId = req.user!.id;
    const { 
      query = '', 
      driveId = '', 
      extension = '', 
      minSize = '0', 
      maxSize = '-1', 
      sortBy = 'name-asc',
      limit = '1000',
      offset = '0'
    } = req.query as Record<string, string>;

    try {
      let sql = `
        FROM files f 
        JOIN drives d ON f.drive_id = d.id 
        WHERE d.user_id = $1
      `;
      const params: any[] = [userId];
      let paramIdx = 2;

      // Filter by driveId
      if (driveId) {
        sql += ` AND f.drive_id = $${paramIdx++}`;
        params.push(driveId);
      }

      // Filter by extension
      if (extension) {
        sql += ` AND LOWER(f.extension) = LOWER($${paramIdx++})`;
        params.push(extension);
      }

      // Filter by minSize
      const minVal = Number(minSize);
      if (!isNaN(minVal) && minVal > 0) {
        sql += ` AND f.length >= $${paramIdx++}`;
        params.push(minVal);
      }

      // Filter by maxSize
      const maxVal = Number(maxSize);
      if (!isNaN(maxVal) && maxVal >= 0) {
        sql += ` AND f.length <= $${paramIdx++}`;
        params.push(maxVal);
      }

      // Substring fuzzy matching on name or full_name
      const searchStr = query.trim();
      if (searchStr) {
        sql += ` AND (f.name ILIKE $${paramIdx} OR f.full_name ILIKE $${paramIdx})`;
        params.push(`%${searchStr}%`);
        paramIdx++;
      }

      // 1. Fetch total count
      const countResult = await dbPool.query(`SELECT COUNT(*)::int as total ${sql}`, params);
      const totalCount = countResult.rows[0].total;

      // 2. Fetch results with proper order by clause
      let orderByClause = '';
      if (sortBy === 'name-asc') {
        orderByClause = 'ORDER BY f.name ASC';
      } else if (sortBy === 'name-desc') {
        orderByClause = 'ORDER BY f.name DESC';
      } else if (sortBy === 'size-asc') {
        orderByClause = 'ORDER BY f.length ASC';
      } else if (sortBy === 'size-desc') {
        orderByClause = 'ORDER BY f.length DESC';
      } else if (sortBy === 'path-asc') {
        orderByClause = 'ORDER BY f.full_name ASC';
      } else {
        orderByClause = 'ORDER BY f.name ASC';
      }

      const limitVal = parseInt(limit, 10);
      const offsetVal = parseInt(offset, 10);
      const queryParams = [...params];
      let limitOffsetClause = '';

      if (!isNaN(limitVal) && limitVal > 0) {
        limitOffsetClause += ` LIMIT $${paramIdx++}`;
        queryParams.push(limitVal);
      }
      if (!isNaN(offsetVal) && offsetVal >= 0) {
        limitOffsetClause += ` OFFSET $${paramIdx++}`;
        queryParams.push(offsetVal);
      }

      const fieldsSql = `
        SELECT f.name as "Name", f.full_name as "FullName", f.extension as "Extension", f.length as "Length", f.drive_id as "DriveId"
        ${sql}
        ${orderByClause}
        ${limitOffsetClause}
      `;

      const resultsResult = await dbPool.query(fieldsSql, queryParams);

      // 3. Fast list of top 100 extensions inside the user's active drives
      const extResult = await dbPool.query(`
        SELECT f.extension, COUNT(*)::int as cnt
        FROM files f
        JOIN drives d ON f.drive_id = d.id
        WHERE d.user_id = $1 AND f.extension IS NOT NULL AND f.extension <> ''
        GROUP BY f.extension
        ORDER BY cnt DESC
        LIMIT 100
      `, [userId]);

      const availableExtensions = extResult.rows.map(r => r.extension);

      res.json({
        success: true,
        files: resultsResult.rows,
        totalCount,
        availableExtensions
      });
    } catch (err: any) {
      console.error('Server search execution failed:', err);
      res.status(500).json({ error: 'Search failed.', details: err.message });
    }
  });


  // --- Vite Asset Serving & Production Flow ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
}

startServer();
