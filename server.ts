import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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

// Automatically create tables on startup if database is connected
async function initializeDatabase() {
  const dbPool = getPool();
  if (!dbPool) return;

  try {
    const client = await dbPool.connect();
    console.log('🔌 Connected to PostgreSQL database. Checking schema...');
    
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
    await client.query(`CREATE INDEX IF NOT EXISTS idx_files_extension ON files(extension)`);

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

  // 2. Retrieve all drives (with nested file items)
  app.get('/api/drives', async (req, res) => {
    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ 
        error: 'Database is not connected.', 
        details: dbErrorMsg || 'Please configure POSTGRES_URL.' 
      });
    }

    try {
      console.log('Fetching drives and files from Postgres...');
      const drivesResult = await dbPool.query('SELECT * FROM drives ORDER BY name ASC');
      const filesResult = await dbPool.query('SELECT * FROM files ORDER BY name ASC');

      const filesByDrive = new Map<string, any[]>();
      for (const file of filesResult.rows) {
        const dId = file.drive_id;
        if (!filesByDrive.has(dId)) {
          filesByDrive.set(dId, []);
        }
        filesByDrive.get(dId)!.push({
          Name: file.name,
          FullName: file.full_name,
          Extension: file.extension,
          Length: Number(file.length),
          DriveId: dId
        });
      }

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
        items: filesByDrive.get(row.id) || []
      }));

      res.json(drives);
    } catch (err: any) {
      console.error('Error fetching drives from Postgres:', err);
      res.status(500).json({ error: 'Failed to retrieve storage catalogs.', details: err.message });
    }
  });

  // 3. Create or completely overwrite a drive catalog (with efficient batch file insert)
  app.post('/api/drives', async (req, res) => {
    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ 
        error: 'Database is not connected.', 
        details: dbErrorMsg || 'Please configure POSTGRES_URL.' 
      });
    }

    const { id, name, letter, color, icon, lastUpdated, fileCount, totalSize, description, items } = req.body;

    if (!id || !name || !letter) {
      return res.status(400).json({ error: 'Missing required drive parameters: id, name, or letter.' });
    }

    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert or update the drive profile
      await client.query(`
        INSERT INTO drives (id, name, letter, color, icon, last_updated, file_count, total_size, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          letter = EXCLUDED.letter,
          color = EXCLUDED.color,
          icon = EXCLUDED.icon,
          last_updated = EXCLUDED.last_updated,
          file_count = EXCLUDED.file_count,
          total_size = EXCLUDED.total_size,
          description = EXCLUDED.description
      `, [id, name, letter, color, icon, lastUpdated, fileCount || 0, totalSize || 0, description || '']);

      // 2. Clear old files associated with this drive
      await client.query('DELETE FROM files WHERE drive_id = $1', [id]);

      // 3. Perform chunked/batch files insertions (extremely fast and memory efficient)
      if (items && Array.isArray(items) && items.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < items.length; i += batchSize) {
          const chunk = items.slice(i, i + batchSize);
          const placeholders: string[] = [];
          const values: any[] = [];

          for (let j = 0; j < chunk.length; j++) {
            const file = chunk[j];
            const offset = j * 5;
            placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
            values.push(id, file.Name, file.FullName, file.Extension || '', file.Length || 0);
          }

          const insertQuery = `
            INSERT INTO files (drive_id, name, full_name, extension, length)
            VALUES ${placeholders.join(', ')}
          `;
          await client.query(insertQuery, values);
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
  app.patch('/api/drives/:id', async (req, res) => {
    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ error: 'Database is not connected.' });
    }

    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing field: name' });
    }

    try {
      const result = await dbPool.query(
        'UPDATE drives SET name = $1 WHERE id = $2 RETURNING *',
        [name, id]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Drive catalog not found.' });
      }
      res.json({ success: true, drive: result.rows[0] });
    } catch (err: any) {
      console.error('Failed to rename drive:', err);
      res.status(500).json({ error: 'Failed to update drive properties.', details: err.message });
    }
  });

  // 5. Delete a drive catalog (cascades automatically to delete associated files)
  app.delete('/api/drives/:id', async (req, res) => {
    const dbPool = getPool();
    if (!dbPool || !dbConnected) {
      return res.status(503).json({ error: 'Database is not connected.' });
    }

    const { id } = req.params;

    try {
      const result = await dbPool.query('DELETE FROM drives WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Drive catalog not found.' });
      }
      res.json({ success: true, message: `Catalog for drive '${result.rows[0].name}' deleted.` });
    } catch (err: any) {
      console.error('Failed to delete drive catalog:', err);
      res.status(500).json({ error: 'Failed to remove storage catalog.', details: err.message });
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
