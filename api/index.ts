import express from 'express';
import path from 'path';
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

  const connectionString = process.env.POSTGRES_URL || 
                           process.env.DATABASE_URL || 
                           "postgres://d463b0d780af2c53de7ea8b42a657e1bb276a8910072df489bad0ff5894a4432:sk_BvXdkpfT_6mf-pXGJibSl@db.prisma.io:5432/postgres?sslmode=require";
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

async function seedDemoData(client: any, userId: number) {
  console.log('🌱 Starting automatic database seeding for user "demo"...');

  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const drivesToSeed = [
    {
      id: 'demo-drive-e',
      name: 'Media Vault',
      letter: 'E',
      color: 'emerald',
      icon: 'hard-drive',
      last_updated: timestamp,
      description: 'High capacity drive storing movies, FLAC audio archives, and raw 4K vacation clips.'
    },
    {
      id: 'demo-drive-f',
      name: 'Work Archive',
      letter: 'F',
      color: 'blue',
      icon: 'database',
      last_updated: timestamp,
      description: 'Ultra-fast SSD with client invoices, tax spreadsheets, active codebases, and technical PDFs.'
    },
    {
      id: 'demo-drive-g',
      name: 'Creative Hub',
      letter: 'G',
      color: 'violet',
      icon: 'archive',
      last_updated: timestamp,
      description: 'High-speed storage containing photography RAW portfolios, edited JPG exports, and Photoshop layout files.'
    },
    {
      id: 'demo-drive-h',
      name: 'Legacy Cold Hub',
      letter: 'H',
      color: 'rose',
      icon: 'disc',
      last_updated: timestamp,
      description: 'Spinning disk HDD for historic server snapshots, retro family JPG catalogs, and old scanning records.'
    },
    {
      id: 'demo-drive-i',
      name: 'Audio Sound Vault',
      letter: 'I',
      color: 'cyan',
      icon: 'music',
      last_updated: timestamp,
      description: 'FLAC soundtracks, custom audiobooks, multi-track audio stems, and standard WAV sound effects.'
    },
    {
      id: 'demo-drive-j',
      name: 'Retro Station',
      letter: 'J',
      color: 'amber',
      icon: 'database',
      last_updated: timestamp,
      description: 'System image back-ups, bootable Linux ISO utilities, and custom retro gaming emulation files.'
    },
    {
      id: 'demo-drive-k',
      name: 'Deep Learning Depot',
      letter: 'K',
      color: 'indigo',
      icon: 'database',
      last_updated: timestamp,
      description: 'PyTorch model weights, Jupyter notebook pipelines, GloVe embeddings, and massive CSV test databases.'
    }
  ];

  for (const drv of drivesToSeed) {
    // Insert/update drive metadata
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
        description = EXCLUDED.description
    `, [drv.id, userId, drv.name, drv.letter, drv.color, drv.icon, drv.last_updated, 0, 0, drv.description]);

    // Clear old files for this drive to prevent accumulation
    await client.query('DELETE FROM files WHERE drive_id = $1', [drv.id]);

    const files: Array<{ Name: string; FullName: string; Extension: string; Length: number }> = [];

    // Generate files procedurally
    if (drv.id === 'demo-drive-e') {
      // Movies
      const movies = [
        { name: 'Interstellar (2014) 2160p HDR.mkv', size: 58248800000, ext: '.mkv' },
        { name: 'Inception (2010) REMUX.mkv', size: 42100000000, ext: '.mkv' },
        { name: 'Spirited Away (2001) 1080p.mp4', size: 2420000000, ext: '.mp4' },
        { name: 'The Dark Knight (2008) IMAX.mkv', size: 31500000000, ext: '.mkv' },
        { name: 'Pulp Fiction 4K.mkv', size: 28400000000, ext: '.mkv' },
        { name: 'Gladiator (2000) Extended 2160p.mkv', size: 52100000000, ext: '.mkv' },
        { name: 'Spider-Man Into The Spider-Verse 4K.mp4', size: 14500000000, ext: '.mp4' },
        { name: 'The Matrix (1999) UHD REMUX.mkv', size: 48900000000, ext: '.mkv' },
      ];
      movies.forEach(m => {
        files.push({ Name: m.name, FullName: `E:\\Movies\\${m.name}`, Extension: m.ext, Length: m.size });
      });

      // TV Shows
      const tvShows = [
        { show: 'Breaking Bad', season: 1, episodes: 7 },
        { show: 'Breaking Bad', season: 2, episodes: 13 },
        { show: 'Stranger Things', season: 4, episodes: 9 },
        { show: 'Planet Earth II', season: 1, episodes: 6 },
        { show: 'The Office US', season: 3, episodes: 24 }
      ];
      tvShows.forEach(tv => {
        for (let ep = 1; ep <= tv.episodes; ep++) {
          const epNum = ep < 10 ? `S0${tv.season}E0${ep}` : `S0${tv.season}E${ep}`;
          const epName = `${tv.show} - ${epNum} - 1080p.HEVC.mkv`;
          const size = 800 * 1024 * 1024 + (ep * 13579) % 400000000;
          files.push({
            Name: epName,
            FullName: `E:\\TV Shows\\${tv.show}\\Season 0${tv.season}\\${epName}`,
            Extension: '.mkv',
            Length: size
          });
        }
      });

      // Music (FLAC files)
      const musicAlbums = [
        { artist: 'Pink Floyd', album: 'The Dark Side of the Moon (1973) [FLAC]', tracks: 10 },
        { artist: 'Daft Punk', album: 'Random Access Memories (2013) [24bit-88.2kHz]', tracks: 13 },
        { artist: 'Hans Zimmer', album: 'Interstellar OST (Deluxe Version)', tracks: 21 },
        { artist: 'Miles Davis', album: 'Kind of Blue (1959) [SACD]', tracks: 6 }
      ];
      musicAlbums.forEach(ma => {
        for (let t = 1; t <= ma.tracks; t++) {
          const trackName = `${t < 10 ? '0' + t : t} - Track Title ${t}.flac`;
          const size = 25000000 + (t * 246813) % 35000000;
          files.push({
            Name: trackName,
            FullName: `E:\\Music\\${ma.artist}\\${ma.album}\\${trackName}`,
            Extension: '.flac',
            Length: size
          });
        }
      });

      // Vacation Footage
      const locations = ['Hawaii_Trip', 'Europe_Backpacking', 'Japan_Tokyo_Kyoto', 'Camping_Yosemite'];
      locations.forEach(loc => {
        const years = ['2023', '2024'];
        years.forEach(yr => {
          const clipCount = 10;
          for (let c = 1; c <= clipCount; c++) {
            const clipName = `DSC_${1000 + c}_Clip_${yr}.mov`;
            const size = 150000000 + (c * 1746283) % 850000000;
            files.push({
              Name: clipName,
              FullName: `E:\\Vacation Footage\\${yr}\\${loc}\\${clipName}`,
              Extension: '.mov',
              Length: size
            });
          }
        });
      });
    }

    if (drv.id === 'demo-drive-f') {
      // Work Archive
      const clientNames = ['AcmeCorp', 'StarkIndustries', 'WayneEnterprises', 'Initech', 'SoylentCorp', 'TyrellCorp', 'UmbrellaCorp'];
      const docTypes = ['Invoices', 'Contracts', 'Project_Briefs', 'Deliverables', 'Financials'];

      clientNames.forEach(client => {
        docTypes.forEach(docType => {
          const docCount = 4;
          for (let d = 1; d <= docCount; d++) {
            const ext = d === 1 ? '.pdf' : d === 2 ? '.docx' : d === 3 ? '.xlsx' : '.pptx';
            const docName = `${client}_${docType}_Q${d}_2024${ext}`;
            const size = 45000 + (d * 83749) % 3500000;
            files.push({
              Name: docName,
              FullName: `F:\\Clients\\${client}\\${docType}\\${docName}`,
              Extension: ext,
              Length: size
            });
          }
        });
      });

      // Source Code projects
      const projects = ['personal-portfolio', 'e-commerce-backend', 'custom-crm-app', 'data-visualizer', 'machine-learning-sandbox'];
      projects.forEach(proj => {
        const standardFiles = [
          { name: 'package.json', ext: '.json', size: 1200 },
          { name: 'vite.config.ts', ext: '.ts', size: 850 },
          { name: 'tsconfig.json', ext: '.json', size: 450 },
          { name: 'README.md', ext: '.md', size: 4500 },
          { name: 'index.html', ext: '.html', size: 600 },
          { name: 'src/main.tsx', ext: '.tsx', size: 1500 },
          { name: 'src/App.tsx', ext: '.tsx', size: 12000 },
          { name: 'src/index.css', ext: '.css', size: 3000 },
        ];

        // Add regular project files
        standardFiles.forEach(sf => {
          files.push({
            Name: sf.name.substring(sf.name.lastIndexOf('/') + 1),
            FullName: `F:\\Projects\\${proj}\\${sf.name.replace(/\//g, '\\')}`,
            Extension: sf.ext,
            Length: sf.size
          });
        });

        // Add extra components to pad
        for (let i = 1; i <= 15; i++) {
          files.push({
            Name: `LayoutComponent_V${i}.tsx`,
            FullName: `F:\\Projects\\${proj}\\src\\components\\LayoutComponent_V${i}.tsx`,
            Extension: '.tsx',
            Length: 1200 + i * 380
          });
          files.push({
            Name: `service_utility_${i}.ts`,
            FullName: `F:\\Projects\\${proj}\\src\\utils\\service_utility_${i}.ts`,
            Extension: '.ts',
            Length: 900 + i * 270
          });
        }
      });

      // eBooks
      const techCategories = ['React', 'NodeJS', 'TypeScript', 'Docker', 'SystemDesign', 'Algorithms', 'Rust_Programming', 'Kubernetes'];
      techCategories.forEach(cat => {
        for (let b = 1; b <= 3; b++) {
          const bookName = `Mastering_${cat}_Development_Edition_${b}.pdf`;
          const size = 12000000 + (b * 4821379) % 45000000;
          files.push({
            Name: bookName,
            FullName: `F:\\eBooks\\${cat}\\${bookName}`,
            Extension: '.pdf',
            Length: size
          });
        }
      });

      // Backups and zips
      for (let z = 1; z <= 6; z++) {
        const zipName = `Project_Archive_Backup_${2018 + z}_06_30.zip`;
        const size = 120000000 + z * 184729370;
        files.push({
          Name: zipName,
          FullName: `F:\\Backups\\System_Archives\\${zipName}`,
          Extension: '.zip',
          Length: size
        });
      }

      // Explicit duplicate 1
      files.push({
        Name: 'Project_Archive_Backup_2022_06_30.zip',
        FullName: 'F:\\Backups\\System_Archives\\Project_Archive_Backup_2022_06_30.zip',
        Extension: '.zip',
        Length: 450000000
      });
    }

    if (drv.id === 'demo-drive-g') {
      // Creative Hub
      const photoAlbums = ['Summer_Solstice_2025', 'Wedding_Sarah_Dave', 'Corporate_Gala_2025', 'Product_Shoot_XYZ', 'Street_Photography_SF', 'Norway_Fjords_Expedition'];
      photoAlbums.forEach(album => {
        for (let p = 1; p <= 60; p++) {
          const sizeRaw = 24000000 + (p * 372849) % 18000000; // ~24MB - 42MB
          const sizeJpg = 3000000 + (p * 184729) % 7000000;   // ~3MB - 10MB

          files.push({
            Name: `DSC_${5000 + p}.CR2`,
            FullName: `G:\\Photography\\${album}\\RAW\\DSC_${5000 + p}.CR2`,
            Extension: '.CR2',
            Length: sizeRaw
          });

          // JPG Export
          if (p % 2 === 0) {
            files.push({
              Name: `DSC_${5000 + p}_EDITED.JPG`,
              FullName: `G:\\Photography\\${album}\\Exports\\DSC_${5000 + p}_EDITED.JPG`,
              Extension: '.JPG',
              Length: sizeJpg
            });
          }
        }
      });

      // Design Projects
      const designers = ['AppMockups_ReIndex', 'BrandingKit_Acme', 'BannerAdvertisements', 'Illustrations_2025', 'Infographic_Templates'];
      designers.forEach(dp => {
        for (let d = 1; d <= 5; d++) {
          const namePsd = `${dp}_v${d}_final.psd`;
          const sizePsd = 120000000 + d * 73829103;
          files.push({
            Name: namePsd,
            FullName: `G:\\Design\\${dp}\\${namePsd}`,
            Extension: '.psd',
            Length: sizePsd
          });
        }
      });
    }

    if (drv.id === 'demo-drive-h') {
      // Legacy Cold Hub
      const yearsOld = ['2015', '2016', '2017', '2018'];
      yearsOld.forEach(yr => {
        for (let s = 1; s <= 25; s++) {
          const scanName = `Scan_Document_${yr}_${100 + s}.pdf`;
          const size = 150000 + (s * 3829) % 800000;
          files.push({
            Name: scanName,
            FullName: `H:\\OldArchive\\${yr}_scans\\${scanName}`,
            Extension: '.pdf',
            Length: size
          });
        }

        // Snapshots
        for (let snapshot = 1; snapshot <= 25; snapshot++) {
          const snapName = `Snap_${yr}_08_${snapshot}.jpg`;
          const size = 800000 + (snapshot * 92183) % 2000000;
          files.push({
            Name: snapName,
            FullName: `H:\\OldArchive\\Family_Photos_${yr}\\${snapName}`,
            Extension: '.jpg',
            Length: size
          });
        }
      });

      // Legacy zips & ISOs
      const legacyArchives = ['My_Documents_Backup_2015.rar', 'Old_Laptop_User_Folder_Backup_2017.zip', 'External_Drive_Mirror_2016.iso'];
      legacyArchives.forEach(la => {
        const size = 2000000000 + (la.length * 48293710);
        files.push({
          Name: la,
          FullName: `H:\\Legacy_System_Backups\\${la}`,
          Extension: la.endsWith('.zip') ? '.zip' : la.endsWith('.rar') ? '.rar' : '.iso',
          Length: size
        });
      });

      // Duplicate entries matching files from other drives
      files.push({
        Name: 'Project_Archive_Backup_2022_06_30.zip',
        FullName: 'H:\\Legacy_System_Backups\\Project_Archive_Backup_2022_06_30.zip',
        Extension: '.zip',
        Length: 450000000
      });

      files.push({
        Name: 'archlinux-2026.07.01-x86_64.iso',
        FullName: 'H:\\Legacy_System_Backups\\archlinux-2026.07.01-x86_64.iso',
        Extension: '.iso',
        Length: 1800000000
      });

      files.push({
        Name: 'Mastering_TypeScript_Development_Edition_1.pdf',
        FullName: 'H:\\Legacy_System_Backups\\Mastering_TypeScript_Development_Edition_1.pdf',
        Extension: '.pdf',
        Length: 24000000
      });

      files.push({
        Name: 'DSC_5001.CR2',
        FullName: 'H:\\Legacy_System_Backups\\DSC_5001.CR2',
        Extension: '.CR2',
        Length: 24372849
      });
    }

    if (drv.id === 'demo-drive-i') {
      // Audio Sound Vault
      const audioBooks = [
        { title: 'The Hobbit', duration: 11, author: 'Tolkien' },
        { title: 'Dune Chronicles', duration: 22, author: 'Herbert' },
        { title: 'Foundation Trilogy', duration: 18, author: 'Asimov' },
        { title: 'Sapiens A Brief History', duration: 15, author: 'Harari' },
        { title: 'Steve Jobs Biography', duration: 25, author: 'Isaacson' }
      ];
      audioBooks.forEach(ab => {
        const abName = `${ab.title} - Read by Narrator (${ab.author}).m4b`;
        const size = ab.duration * 45 * 1024 * 1024;
        files.push({
          Name: abName,
          FullName: `I:\\Audiobooks\\Fiction\\${ab.title}\\${abName}`,
          Extension: '.m4b',
          Length: size
        });
      });

      const soundEffects = ['Laser_Blast', 'Swoosh_Fast', 'Explosion_Deep', 'Ambient_Rain_Loop', 'Crowd_Cheering', 'SciFi_Computer_Beep', 'Footsteps_Wood', 'Car_Engine_Idle'];
      soundEffects.forEach(sfx => {
        for (let take = 1; take <= 10; take++) {
          const name = `${sfx}_Take_0${take}.wav`;
          const size = 12000000 + (take * 837291) % 8000000;
          files.push({
            Name: name,
            FullName: `I:\\Sound_Library\\SFX\\${sfx}\\${name}`,
            Extension: '.wav',
            Length: size
          });
        }
      });

      const musicStems = ['Drums', 'Bassline', 'Lead_Synth', 'Vocals_Dry', 'Vocals_Wet', 'FX_Risers', 'Acoustic_Guitar', 'Keys_Rhodes', 'Orchestral_Strings'];
      for (let track = 1; track <= 5; track++) {
        musicStems.forEach(stem => {
          const stemName = `Stem_Track_0${track}_${stem}.wav`;
          const size = 45000000 + (track * stem.length * 37219) % 25000000;
          files.push({
            Name: stemName,
            FullName: `I:\\Projects\\Audio_Stems\\Track_0${track}\\${stemName}`,
            Extension: '.wav',
            Length: size
          });
        });
      }
    }

    if (drv.id === 'demo-drive-j') {
      const retroConsoles = ['SNES', 'SegaGenesis', 'PlayStation1', 'N64', 'GameBoyColor', 'NES', 'SegaSaturn'];
      retroConsoles.forEach(console => {
        const romCount = 20;
        const ext = console === 'SNES' ? '.sfc' : console === 'SegaGenesis' ? '.bin' : console === 'PlayStation1' ? '.chd' : console === 'SegaSaturn' ? '.iso' : '.z64';
        for (let r = 1; r <= romCount; r++) {
          const romName = `Retro_Game_Title_${console}_${r}${ext}`;
          const isCD = console === 'PlayStation1' || console === 'SegaSaturn';
          const size = (isCD ? 350 : 2) * 1024 * 1024 + (r * 1837492) % (200 * 1024 * 1024);
          files.push({
            Name: romName,
            FullName: `J:\\Emulation\\ROMs\\${console}\\${romName}`,
            Extension: ext,
            Length: size
          });
        }
      });

      const osList = ['ubuntu-24.04-desktop-amd64.iso', 'debian-12.5.0-amd64-DVD-1.iso', 'archlinux-2026.07.01-x86_64.iso', 'fedora-workstation-40.iso', 'clonezilla-live-3.1.2.iso', 'kali-linux-2026.2-installer-amd64.iso', 'proxmox-ve_8.1-1.iso'];
      osList.forEach(iso => {
        let size = 1200000000;
        if (iso === 'archlinux-2026.07.01-x86_64.iso') {
          size = 1800000000;
        } else {
          size = 1200000000 + (iso.length * 83719280) % 3200000000;
        }
        files.push({
          Name: iso,
          FullName: `J:\\Operating_Systems\\Linux\\${iso}`,
          Extension: '.iso',
          Length: size
        });
      });
    }

    if (drv.id === 'demo-drive-k') {
      const datasets = ['imagenet_mini_subset', 'coco_captions_2025', 'glove_word_embeddings', 'imdb_sentiment_reviews', 'climate_change_timeseries', 'mnist_full_pack', 'resnet_features_precomputed'];
      const notebooks = ['eda_and_pre_processing.ipynb', 'model_training_loop.ipynb', 'inference_demo.ipynb', 'quantization_to_onnx.ipynb', 'dataset_balancing.ipynb'];

      datasets.forEach(ds => {
        const csvName = `${ds}_raw_records.csv`;
        const csvSize = 120000000 + (ds.length * 7382910) % 350000000;
        files.push({
          Name: csvName,
          FullName: `K:\\AI_Research\\Datasets\\${ds}\\${csvName}`,
          Extension: '.csv',
          Length: csvSize
        });

        for (let epoch = 1; epoch <= 4; epoch++) {
          const chkName = `${ds}_weights_epoch_${epoch * 10}.pth`;
          const size = 250000000 + epoch * 138491038;
          files.push({
            Name: chkName,
            FullName: `K:\\AI_Research\\Checkpoints\\${ds}\\${chkName}`,
            Extension: '.pth',
            Length: size
          });
        }

        notebooks.forEach(nb => {
          const size = 15000 + (nb.length * 8213) % 450000;
          files.push({
            Name: `${ds}_${nb}`,
            FullName: `K:\\AI_Research\\Notebooks\\${ds}\\${ds}_${nb}`,
            Extension: '.ipynb',
            Length: size
          });
        });
      });
    }

    // Now insert files in bulk UNNEST array batches
    const totalSizeSum = files.reduce((acc, f) => acc + f.Length, 0);
    const totalCount = files.length;

    // Update drive counts
    await client.query(`
      UPDATE drives 
      SET file_count = $1, total_size = $2
      WHERE id = $3
    `, [totalCount, totalSizeSum, drv.id]);

    console.log(`Inserting ${totalCount} files for ${drv.name} in database...`);

    // Perform UNNEST bulk array insertions
    if (files.length > 0) {
      const batchSize = 10000;
      for (let i = 0; i < files.length; i += batchSize) {
        const chunk = files.slice(i, i + batchSize);
        
        const names: string[] = [];
        const fullNames: string[] = [];
        const extensions: string[] = [];
        const lengths: number[] = [];

        for (const file of chunk) {
          names.push(file.Name);
          fullNames.push(file.FullName);
          extensions.push(file.Extension);
          lengths.push(file.Length);
        }

        const insertQuery = `
          INSERT INTO files (drive_id, name, full_name, extension, length)
          SELECT $1, t.name, t.full_name, t.extension, t.length
          FROM UNNEST($2::text[], $3::text[], $4::text[], $5::bigint[]) AS t(name, full_name, extension, length)
        `;
        await client.query(insertQuery, [drv.id, names, fullNames, extensions, lengths]);
      }
    }
  }

  console.log('✅ Demo user account database seeding completed successfully!');
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
        extension TEXT,
        length BIGINT NOT NULL
      )
    `);

    // Safely upgrade existing VARCHAR(50) extension columns to TEXT
    try {
      await client.query(`ALTER TABLE files ALTER COLUMN extension TYPE TEXT`);
    } catch (err: any) {
      console.warn('Skipped or failed altering files.extension column type to TEXT:', err.message);
    }

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

    // Seed demo user if it doesn't exist
    try {
      const demoUserCheck = await client.query("SELECT id FROM users WHERE username = 'demo'");
      if (demoUserCheck.rowCount === 0) {
        console.log('Seeding demo user profile ("demo" / "demo")...');
        const passwordHash = hashPassword('demo');
        const insertUserRes = await client.query(
          "INSERT INTO users (username, password_hash) VALUES ('demo', $1) RETURNING id",
          [passwordHash]
        );
        const demoUserId = insertUserRes.rows[0].id;
        await seedDemoData(client, demoUserId);
      } else {
        console.log('Demo user "demo" already exists.');
      }
    } catch (seedErr: any) {
      console.error('⚠️ Failed to seed demo user database:', seedErr);
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

const app = express();

// Parse JSON payloads up to 100MB (crucial for uploading massive file indices)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Express middleware to ensure database is initialized on any request (crucial for Vercel serverless)
let dbInitializationPromise: Promise<void> | null = null;
async function ensureDbInitialized() {
  if (!dbInitializationPromise) {
    dbInitializationPromise = initializeDatabase();
  }
  return dbInitializationPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureDbInitialized();
  } catch (err) {
    console.error('Error ensuring database is initialized:', err);
  }
  next();
});

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

    // Force seed on login for the demo user if they don't have all 7 drives or files seeded
    if (user.username === 'demo') {
      const client = await dbPool.connect();
      try {
        const drivesCheck = await client.query('SELECT COUNT(*)::int as cnt FROM drives WHERE user_id = $1', [user.id]);
        const driveCount = drivesCheck.rows[0].cnt;
        
        const filesCheck = await client.query(
          'SELECT COUNT(*)::int as cnt FROM files f JOIN drives d ON f.drive_id = d.id WHERE d.user_id = $1',
          [user.id]
        );
        const fileCount = filesCheck.rows[0].cnt;

        if (driveCount < 7 || fileCount === 0) {
          console.log(`Demo user logged in but has incomplete data (${driveCount}/7 drives, ${fileCount} files). Forcing database re-seed...`);
          await seedDemoData(client, user.id);
        } else {
          console.log(`Demo user logged in. All ${driveCount} drives and ${fileCount} files are fully active in the database.`);
        }
      } catch (seedErr) {
        console.error('Error during demo user login verification/seeding:', seedErr);
      } finally {
        client.release();
      }
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

// 1.5. Get a lightweight manifest of all drive modification states and metadata for client caching
app.get('/api/drives/manifest', authenticateUser, async (req, res) => {
  const dbPool = getPool();
  if (!dbPool || !dbConnected) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const userId = req.user!.id;

  try {
    let manifestResult = await dbPool.query(
      'SELECT id, last_updated, file_count FROM drives WHERE user_id = $1',
      [userId]
    );

    if (manifestResult.rowCount === 0 && req.user!.username === 'demo') {
      console.log('Demo user has no drives for manifest. Seeding first...');
      const client = await dbPool.connect();
      try {
        await seedDemoData(client, userId);
        manifestResult = await dbPool.query(
          'SELECT id, last_updated, file_count FROM drives WHERE user_id = $1',
          [userId]
        );
      } catch (seedErr) {
        console.error('Error in inline demo seeding for manifest:', seedErr);
      } finally {
        client.release();
      }
    }

    const manifest: Record<string, { lastUpdated: string; fileCount: number }> = {};
    for (const row of manifestResult.rows) {
      manifest[row.id] = {
        lastUpdated: row.last_updated,
        fileCount: Number(row.file_count) || 0
      };
    }

    res.json({
      success: true,
      manifest
    });
  } catch (err: any) {
    console.error('Error fetching drives manifest:', err);
    res.status(500).json({ error: 'Failed to retrieve drive manifest.', details: err.message });
  }
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
    let drivesResult = await dbPool.query('SELECT * FROM drives WHERE user_id = $1 ORDER BY name ASC', [userId]);

    if (drivesResult.rowCount === 0 && req.user!.username === 'demo') {
      console.log('Demo user has 0 drives. Performing inline auto-seeding...');
      const client = await dbPool.connect();
      try {
        await seedDemoData(client, userId);
        drivesResult = await dbPool.query('SELECT * FROM drives WHERE user_id = $1 ORDER BY name ASC', [userId]);
      } catch (seedErr) {
        console.error('Error in inline demo seeding:', seedErr);
      } finally {
        client.release();
      }
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
      items: [] // Empty by default in high-performance mode; files fetched on-demand via search endpoint
    }));

    res.json(drives);
  } catch (err: any) {
    console.error('Error fetching drives from Postgres:', err);
    res.status(500).json({ error: 'Failed to retrieve storage catalogs.', details: err.message });
  }
});

// 2b. Retrieve all files (unfiltered, unlimited) for a specific drive catalog (highly optimized for tree building)
app.get('/api/drives/:id/files', authenticateUser, async (req, res) => {
  const dbPool = getPool();
  if (!dbPool || !dbConnected) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const { id } = req.params;
  const userId = req.user!.id;

  try {
    // Verify ownership
    const driveCheck = await dbPool.query('SELECT id FROM drives WHERE id = $1 AND user_id = $2', [id, userId]);
    if (driveCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Drive catalog not found or not owned by you.' });
    }

    const filesResult = await dbPool.query(
      `SELECT name as "Name", full_name as "FullName", extension as "Extension", length as "Length", drive_id as "DriveId"
       FROM files 
       WHERE drive_id = $1
       ORDER BY full_name ASC`,
      [id]
    );

    res.json({
      success: true,
      files: filesResult.rows.map(row => ({
        ...row,
        Length: Number(row.Length) || 0
      }))
    });
  } catch (err: any) {
    console.error('Error fetching complete drive files:', err);
    res.status(500).json({ error: 'Failed to retrieve drive files.', details: err.message });
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

// 3b. Append a chunk of files to a drive catalog (for serverless payload-limit bypassing)
app.post('/api/drives/:id/chunks', authenticateUser, async (req, res) => {
  const dbPool = getPool();
  if (!dbPool || !dbConnected) {
    return res.status(503).json({ 
      error: 'Database is not connected.', 
      details: dbErrorMsg || 'Please configure POSTGRES_URL.' 
    });
  }

  const { id } = req.params;
  const { items } = req.body;
  const userId = req.user!.id;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Missing or invalid items array in request body.' });
  }

  // Verify that the drive exists and is owned by the user
  try {
    const driveCheck = await dbPool.query('SELECT id FROM drives WHERE id = $1 AND user_id = $2', [id, userId]);
    if (driveCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Drive catalog not found or not owned by you.' });
    }
  } catch (err: any) {
    console.error('Error verifying drive ownership:', err);
    return res.status(500).json({ error: 'Failed to verify drive ownership.', details: err.message });
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    // Perform UNNEST bulk array insertions
    if (items.length > 0) {
      const names: string[] = [];
      const fullNames: string[] = [];
      const extensions: string[] = [];
      const lengths: number[] = [];

      for (const file of items) {
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

    await client.query('COMMIT');
    res.json({ success: true, message: `Successfully uploaded ${items.length} file records to drive ${id}.` });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Failed to save file chunk to Postgres:', err);
    res.status(500).json({ error: 'Database transaction failed while saving file chunk.', details: err.message });
  } finally {
    client.release();
  }
});

// 3c. Recalculate drive metadata from the files table
app.post('/api/drives/:id/recalculate', authenticateUser, async (req, res) => {
  const dbPool = getPool();
  if (!dbPool || !dbConnected) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const { id } = req.params;
  const userId = req.user!.id;

  try {
    // Verify that the drive exists and is owned by the user
    const driveCheck = await dbPool.query('SELECT name FROM drives WHERE id = $1 AND user_id = $2', [id, userId]);
    if (driveCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Drive catalog not found or not owned by you.' });
    }

    // Query actual statistics from the files table
    const statsResult = await dbPool.query(
      'SELECT COUNT(*)::integer as file_count, COALESCE(SUM(length), 0)::bigint as total_size FROM files WHERE drive_id = $1',
      [id]
    );

    const { file_count, total_size } = statsResult.rows[0];

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Update the drives table with the recalculated stats
    const updateResult = await dbPool.query(`
      UPDATE drives
      SET file_count = $1, total_size = $2, last_updated = $3
      WHERE id = $4 AND user_id = $5
      RETURNING *
    `, [file_count, total_size, timestamp, id, userId]);

    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: 'Failed to update drive catalog.' });
    }

    const updatedDrive = updateResult.rows[0];

    res.json({
      success: true,
      drive: {
        id: updatedDrive.id,
        name: updatedDrive.name,
        letter: updatedDrive.letter,
        color: updatedDrive.color,
        icon: updatedDrive.icon,
        lastUpdated: updatedDrive.last_updated,
        fileCount: Number(updatedDrive.file_count) || 0,
        totalSize: Number(updatedDrive.total_size) || 0,
        description: updatedDrive.description || ''
      }
    });
  } catch (err: any) {
    console.error('Failed to recalculate drive metadata:', err);
    res.status(500).json({ error: 'Failed to recalculate drive metadata.', details: err.message });
  }
});

// 4. Update single drive properties (like renaming or appending metadata)
app.patch('/api/drives/:id', authenticateUser, async (req, res) => {
  const dbPool = getPool();
  if (!dbPool || !dbConnected) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const { id } = req.params;
  const { name, fileCount, totalSize, lastUpdated, description } = req.body;
  const userId = req.user!.id;

  try {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIdx++}`);
      values.push(name);
    }
    if (fileCount !== undefined) {
      fields.push(`file_count = $${paramIdx++}`);
      values.push(fileCount);
    }
    if (totalSize !== undefined) {
      fields.push(`total_size = $${paramIdx++}`);
      values.push(totalSize);
    }
    if (lastUpdated !== undefined) {
      fields.push(`last_updated = $${paramIdx++}`);
      values.push(lastUpdated);
    }
    if (description !== undefined) {
      fields.push(`description = $${paramIdx++}`);
      values.push(description);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update.' });
    }

    values.push(id, userId);
    const updateQuery = `
      UPDATE drives 
      SET ${fields.join(', ')} 
      WHERE id = $${paramIdx++} AND user_id = $${paramIdx++} 
      RETURNING *
    `;

    const result = await dbPool.query(updateQuery, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Drive catalog not found or not owned by you.' });
    }
    res.json({ success: true, drive: result.rows[0] });
  } catch (err: any) {
    console.error('Failed to update drive properties:', err);
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
      files: resultsResult.rows.map(row => ({
        ...row,
        Length: Number(row.Length) || 0
      })),
      totalCount,
      availableExtensions
    });
  } catch (err: any) {
    console.error('Server search execution failed:', err);
    res.status(500).json({ error: 'Search failed.', details: err.message });
  }
});

// 7. Find cross-drive duplicates with JSON aggregated details for space optimization
app.get('/api/duplicates', authenticateUser, async (req, res) => {
  const dbPool = getPool();
  if (!dbPool || !dbConnected) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const userId = req.user!.id;
  const { 
    query = '', 
    extension = '', 
    minSize = '0',
    limit = '100'
  } = req.query as Record<string, string>;

  try {
    let sql = `
      FROM files f 
      JOIN drives d ON f.drive_id = d.id 
      WHERE d.user_id = $1 AND f.length > 0
    `;
    const params: any[] = [userId];
    let paramIdx = 2;

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

    // Filter by search query (on filename)
    const searchStr = query.trim();
    if (searchStr) {
      sql += ` AND f.name ILIKE $${paramIdx++}`;
      params.push(`%${searchStr}%`);
    }

    const dupQuery = `
      SELECT 
        f.name, 
        f.length,
        COUNT(*)::int as duplicate_count,
        JSON_AGG(JSON_BUILD_OBJECT(
          'Name', f.name,
          'FullName', f.full_name,
          'Extension', f.extension,
          'Length', f.length,
          'DriveId', f.drive_id,
          'DriveName', d.name
        )) as occurrences
      ${sql}
      GROUP BY f.name, f.length
      HAVING COUNT(*) > 1
      ORDER BY f.length DESC
      LIMIT $${paramIdx}
    `;
    params.push(parseInt(limit, 10) || 100);

    const dupResult = await dbPool.query(dupQuery, params);

    res.json({
      success: true,
      duplicates: dupResult.rows.map(row => ({
        name: row.name,
        length: Number(row.length),
        duplicate_count: Number(row.duplicate_count),
        occurrences: Array.isArray(row.occurrences)
          ? row.occurrences.map((occ: any) => ({
              ...occ,
              Length: Number(occ.Length) || 0
            }))
          : []
      }))
    });
  } catch (err: any) {
    console.error('Server duplicates query failed:', err);
    res.status(500).json({ error: 'Failed to retrieve duplicate indices.', details: err.message });
  }
});

// 7.5. Batch cleanup duplicates from database to synchronize state
app.post('/api/duplicates/cleanup', authenticateUser, async (req, res) => {
  const dbPool = getPool();
  if (!dbPool || !dbConnected) {
    return res.status(503).json({ error: 'Database is not connected.' });
  }

  const userId = req.user!.id;
  const { filesToDelete } = req.body as { filesToDelete: Array<{ DriveId: string; FullName: string }> };

  if (!filesToDelete || !Array.isArray(filesToDelete) || filesToDelete.length === 0) {
    return res.status(400).json({ error: 'No files provided for cleanup.' });
  }

  try {
    // Validate that the user owns the drives of the files they want to delete
    const driveResult = await dbPool.query('SELECT id FROM drives WHERE user_id = $1', [userId]);
    const userDriveIds = new Set(driveResult.rows.map(row => row.id));

    const validDeletes = filesToDelete.filter(f => userDriveIds.has(f.DriveId));

    if (validDeletes.length === 0) {
      return res.json({ success: true, count: 0, message: 'No valid files on user drives to delete.' });
    }

    const driveIds = validDeletes.map(f => f.DriveId);
    const fullNames = validDeletes.map(f => f.FullName);

    // Batch delete
    const deleteQuery = `
      DELETE FROM files f
      USING UNNEST($1::text[], $2::text[]) AS t(drive_id, full_name)
      WHERE f.drive_id = t.drive_id AND f.full_name = t.full_name
    `;

    const result = await dbPool.query(deleteQuery, [driveIds, fullNames]);

    // Recalculate drive stats
    const uniqueDriveIds = Array.from(new Set(driveIds));
    for (const dId of uniqueDriveIds) {
      await dbPool.query(`
        UPDATE drives
        SET 
          file_count = (SELECT COUNT(*)::integer FROM files WHERE drive_id = $1),
          total_size = COALESCE((SELECT SUM(length)::bigint FROM files WHERE drive_id = $1), 0)
        WHERE id = $1
      `, [dId]);
    }

    res.json({
      success: true,
      count: result.rowCount || validDeletes.length,
      message: `Successfully cleaned up ${result.rowCount || validDeletes.length} duplicate file records from database.`
    });
  } catch (err: any) {
    console.error('Failed to cleanup duplicates in database:', err);
    res.status(500).json({ error: 'Failed to cleanup duplicate file records.', details: err.message });
  }
});

export default app;
