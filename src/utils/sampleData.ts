import { Drive, FileItem } from '../types';

/**
 * Procedural sample data generator to provide a rich out-of-the-box catalog of files
 * across 4 realistic external hard drives. This simulates realistic files of all types
 * and sizes without bloating the source code file with thousands of lines of raw JSON.
 */
export function generateSampleDrives(): Drive[] {
  const drives: Drive[] = [];

  // --- DRIVE 1: MEDIA VAULT (Drive E) ---
  const driveEItems: FileItem[] = [];
  const movies = [
    { name: 'Interstellar (2014) 2160p HDR.mkv', size: 58248800000, ext: '.mkv' },
    { name: 'Inception (2010) REMUX.mkv', size: 42100000000, ext: '.mkv' },
    { name: 'Spirited Away (2001) 1080p.mp4', size: 2420000000, ext: '.mp4' },
    { name: 'The Dark Knight (2008) IMAX.mkv', size: 31500000000, ext: '.mkv' },
    { name: 'Pulp Fiction 4K.mkv', size: 28400000000, ext: '.mkv' },
  ];

  const tvShows = [
    { show: 'Breaking Bad', season: 1, episodes: 7 },
    { show: 'Breaking Bad', season: 2, episodes: 13 },
    { show: 'Stranger Things', season: 4, episodes: 9 },
    { show: 'Planet Earth II', season: 1, episodes: 6 },
  ];

  const musicAlbums = [
    { artist: 'Pink Floyd', album: 'The Dark Side of the Moon (1973) [FLAC]', tracks: 10 },
    { artist: 'Daft Punk', album: 'Random Access Memories (2013) [24bit-88.2kHz]', tracks: 13 },
    { artist: 'Hans Zimmer', album: 'Interstellar OST (Deluxe Version)', tracks: 21 },
    { artist: 'Miles Davis', album: 'Kind of Blue (1959) [SACD]', tracks: 6 },
  ];

  // Populate Drive E: Movies
  movies.forEach(m => {
    driveEItems.push({
      Name: m.name,
      FullName: `E:\\Movies\\${m.name}`,
      Extension: m.ext,
      Length: m.size,
      DriveId: 'drive-e'
    });
  });

  // Populate Drive E: TV Shows
  tvShows.forEach(tv => {
    for (let ep = 1; ep <= tv.episodes; ep++) {
      const epNum = ep < 10 ? `S0${tv.season}E0${ep}` : `S0${tv.season}E${ep}`;
      const epName = `${tv.show} - ${epNum} - 1080p.HEVC.mkv`;
      const size = 800 * 1024 * 1024 + Math.floor(Math.random() * 400 * 1024 * 1024); // 800MB - 1.2GB
      driveEItems.push({
        Name: epName,
        FullName: `E:\\TV Shows\\${tv.show}\\Season 0${tv.season}\\${epName}`,
        Extension: '.mkv',
        Length: size,
        DriveId: 'drive-e'
      });
    }
  });

  // Populate Drive E: Music
  musicAlbums.forEach(ma => {
    for (let t = 1; t <= ma.tracks; t++) {
      const trackName = `${t < 10 ? '0' + t : t} - Track Title ${t}.flac`;
      const size = 25 * 1024 * 1024 + Math.floor(Math.random() * 35 * 1024 * 1024); // 25MB - 60MB flac
      driveEItems.push({
        Name: trackName,
        FullName: `E:\\Music\\${ma.artist}\\${ma.album}\\${trackName}`,
        Extension: '.flac',
        Length: size,
        DriveId: 'drive-e'
      });
    }
  });

  // Populate Drive E: Vacation Footage (Procedural subfolders)
  const locations = ['Hawaii_Trip', 'Europe_Backpacking', 'Japan_Tokyo_Kyoto', 'Camping_Yosemite'];
  locations.forEach(loc => {
    const years = ['2023', '2024'];
    years.forEach(yr => {
      const clipCount = 8 + Math.floor(Math.random() * 12);
      for (let c = 1; c <= clipCount; c++) {
        const clipName = `DSC_${1000 + c}_Clip_${yr}.mov`;
        const size = 150 * 1024 * 1024 + Math.floor(Math.random() * 850 * 1024 * 1024); // 150MB - 1GB
        driveEItems.push({
          Name: clipName,
          FullName: `E:\\Vacation Footage\\${yr}\\${loc}\\${clipName}`,
          Extension: '.mov',
          Length: size,
          DriveId: 'drive-e'
        });
      }
    });
  });

  drives.push({
    id: 'drive-e',
    name: 'Media Vault',
    letter: 'E',
    color: 'emerald',
    icon: 'hard-drive',
    lastUpdated: '2026-07-15 14:32',
    fileCount: driveEItems.length,
    totalSize: driveEItems.reduce((acc, item) => acc + item.Length, 0),
    items: driveEItems,
    description: 'High capacity drive storing movies, FLAC audio archives, and raw 4K vacation clips.'
  });


  // --- DRIVE 2: WORK ARCHIVE (Drive F) ---
  const driveFItems: FileItem[] = [];
  const clientNames = ['AcmeCorp', 'StarkIndustries', 'WayneEnterprises', 'Initech', 'SoylentCorp'];
  const docTypes = ['Invoices', 'Contracts', 'Project_Briefs', 'Deliverables', 'Financials'];

  // Procedural client documents
  clientNames.forEach(client => {
    docTypes.forEach(docType => {
      const docCount = 3 + Math.floor(Math.random() * 6);
      for (let d = 1; d <= docCount; d++) {
        const ext = Math.random() > 0.3 ? '.pdf' : Math.random() > 0.5 ? '.docx' : '.xlsx';
        const docName = `${client}_${docType}_Q${1 + (d % 4)}_${2022 + (d % 4)}${ext}`;
        const size = 45 * 1024 + Math.floor(Math.random() * 4 * 1024 * 1024); // 45KB - 4MB
        driveFItems.push({
          Name: docName,
          FullName: `F:\\Clients\\${client}\\${docType}\\${docName}`,
          Extension: ext,
          Length: size,
          DriveId: 'drive-f'
        });
      }
    });
  });

  // Source code projects (web development simulation)
  const projects = ['personal-portfolio', 'e-commerce-backend', 'custom-crm-app', 'data-visualizer'];
  projects.forEach(proj => {
    const files = [
      { name: 'package.json', ext: '.json', size: 1200 },
      { name: 'vite.config.ts', ext: '.ts', size: 850 },
      { name: 'tsconfig.json', ext: '.json', size: 450 },
      { name: 'README.md', ext: '.md', size: 4500 },
      { name: 'index.html', ext: '.html', size: 600 },
      { name: 'src/main.tsx', ext: '.tsx', size: 1500 },
      { name: 'src/App.tsx', ext: '.tsx', size: 12000 },
      { name: 'src/index.css', ext: '.css', size: 3000 },
      { name: 'src/components/Button.tsx', ext: '.tsx', size: 2400 },
      { name: 'src/components/Card.tsx', ext: '.tsx', size: 3800 },
      { name: 'src/utils/helpers.ts', ext: '.ts', size: 8900 },
      { name: 'dist/bundle.js', ext: '.js', size: 524000 },
    ];
    
    // Add multiple src components procedurally to pad out the drive
    for (let i = 1; i <= 8; i++) {
      files.push({ name: `src/components/LayoutVariant_${i}.tsx`, ext: '.tsx', size: 1200 + i * 400 });
      files.push({ name: `src/hooks/useDataHook_${i}.ts`, ext: '.ts', size: 800 + i * 300 });
    }

    files.forEach(f => {
      driveFItems.push({
        Name: f.name.substring(f.name.lastIndexOf('/') + 1),
        FullName: `F:\\Projects\\${proj}\\${f.name.replace(/\//g, '\\')}`,
        Extension: f.ext,
        Length: f.size,
        DriveId: 'drive-f'
      });
    });
  });

  // eBooks and Learning
  const techCategories = ['React', 'NodeJS', 'TypeScript', 'Docker', 'SystemDesign', 'Algorithms'];
  techCategories.forEach(cat => {
    const bookCount = 2 + Math.floor(Math.random() * 4);
    for (let b = 1; b <= bookCount; b++) {
      const bookName = `Mastering_${cat}_Development_Edition_${b}.pdf`;
      const size = 12 * 1024 * 1024 + Math.floor(Math.random() * 45 * 1024 * 1024); // 12MB - 57MB
      driveFItems.push({
        Name: bookName,
        FullName: `F:\\eBooks\\${cat}\\${bookName}`,
        Extension: '.pdf',
        Length: size,
        DriveId: 'drive-f'
      });
    }
  });

  // Archive and backups
  for (let z = 1; z <= 6; z++) {
    const zipName = `Project_Archive_Backup_${2018 + z}_06_30.zip`;
    const size = 120 * 1024 * 1024 + Math.floor(Math.random() * 1400 * 1024 * 1024); // 120MB - 1.5GB
    driveFItems.push({
      Name: zipName,
      FullName: `F:\\Backups\\System_Archives\\${zipName}`,
      Extension: '.zip',
      Length: size,
      DriveId: 'drive-f'
    });
  }

  drives.push({
    id: 'drive-f',
    name: 'Work Archive',
    letter: 'F',
    color: 'blue',
    icon: 'database',
    lastUpdated: '2026-07-18 09:15',
    fileCount: driveFItems.length,
    totalSize: driveFItems.reduce((acc, item) => acc + item.Length, 0),
    items: driveFItems,
    description: 'Ultra-fast SSD with client invoices, tax spreadsheets, active codebases, and technical PDFs.'
  });


  // --- DRIVE 3: CREATIVE BACKUP (Drive G) ---
  const driveGItems: FileItem[] = [];
  const photoAlbums = ['Summer_Solstice_2025', 'Wedding_Sarah_Dave', 'Corporate_Gala_2025', 'Product_Shoot_XYZ', 'Street_Photography_SF'];
  
  photoAlbums.forEach(album => {
    const photoCount = 45 + Math.floor(Math.random() * 55); // 45 to 100 photo files per album
    for (let p = 1; p <= photoCount; p++) {
      const num = p < 100 ? (p < 10 ? `00${p}` : `0${p}`) : `${p}`;
      const sizeRaw = 24 * 1024 * 1024 + Math.floor(Math.random() * 18 * 1024 * 1024); // 24MB - 42MB (RAW CR2)
      const sizeJpg = 3 * 1024 * 1024 + Math.floor(Math.random() * 7 * 1024 * 1024); // 3MB - 10MB (JPEG)
      
      // RAW File
      driveGItems.push({
        Name: `IMG_${4000 + p}.CR2`,
        FullName: `G:\\Photography\\${album}\\RAW\\IMG_${4000 + p}.CR2`,
        Extension: '.CR2',
        Length: sizeRaw,
        DriveId: 'drive-g'
      });
      
      // JPEG Export for half the photos
      if (Math.random() > 0.5) {
        driveGItems.push({
          Name: `IMG_${4000 + p}_EDITED.JPG`,
          FullName: `G:\\Photography\\${album}\\Exports\\IMG_${4000 + p}_EDITED.JPG`,
          Extension: '.JPG',
          Length: sizeJpg,
          DriveId: 'drive-g'
        });
      }
    }
  });

  // Design assets (PSD/AI)
  const projectsDesigner = ['AppMockups', 'BrandingKit_Acme', 'BannerAdvertisements', 'Illustrations_2025'];
  projectsDesigner.forEach(dp => {
    const designCount = 4 + Math.floor(Math.random() * 6);
    for (let d = 1; d <= designCount; d++) {
      const namePsd = `${dp}_v${d}_final.psd`;
      const sizePsd = 120 * 1024 * 1024 + Math.floor(Math.random() * 450 * 1024 * 1024); // 120MB - 570MB
      driveGItems.push({
        Name: namePsd,
        FullName: `G:\\Design\\${dp}\\${namePsd}`,
        Extension: '.psd',
        Length: sizePsd,
        DriveId: 'drive-g'
      });
    }
  });

  drives.push({
    id: 'drive-g',
    name: 'Creative Hub',
    letter: 'G',
    color: 'violet',
    icon: 'archive',
    lastUpdated: '2026-07-10 18:44',
    fileCount: driveGItems.length,
    totalSize: driveGItems.reduce((acc, item) => acc + item.Length, 0),
    items: driveGItems,
    description: 'High-speed storage containing photography RAW portfolios, edited JPG exports, and Photoshop layout files.'
  });


  // --- DRIVE 4: COLD BACKUP (Drive H) ---
  const driveHItems: FileItem[] = [];
  const yearsOld = ['2015', '2016', '2017'];
  
  yearsOld.forEach(yr => {
    // Old scans and PDFs
    for (let s = 1; s <= 15; s++) {
      const scanName = `Scan_Document_${yr}_${100 + s}.pdf`;
      const size = 150 * 1024 + Math.floor(Math.random() * 800 * 1024); // 150KB - 950KB
      driveHItems.push({
        Name: scanName,
        FullName: `H:\\OldArchive\\${yr}_scans\\${scanName}`,
        Extension: '.pdf',
        Length: size,
        DriveId: 'drive-h'
      });
    }

    // Old family snapshots
    for (let snapshot = 1; snapshot <= 30; snapshot++) {
      const name = `Snap_${yr}_0${1 + (snapshot % 12)}_${snapshot}.jpg`;
      const size = 800 * 1024 + Math.floor(Math.random() * 2 * 1024 * 1024); // 800KB - 2.8MB
      driveHItems.push({
        Name: name,
        FullName: `H:\\OldArchive\\Family_Photos_${yr}\\${name}`,
        Extension: '.jpg',
        Length: size,
        DriveId: 'drive-h'
      });
    }
  });

  // Massive legacy zip files
  const legacyArchives = ['My_Documents_Backup_2015.rar', 'Old_Laptop_User_Folder_Backup_2017.zip', 'External_Drive_Mirror_2016.iso'];
  legacyArchives.forEach(la => {
    const size = 2 * 1024 * 1024 * 1024 + Math.floor(Math.random() * 12 * 1024 * 1024 * 1024); // 2GB - 14GB
    driveHItems.push({
      Name: la,
      FullName: `H:\\Legacy_System_Backups\\${la}`,
      Extension: la.endsWith('.zip') ? '.zip' : la.endsWith('.rar') ? '.rar' : '.iso',
      Length: size,
      DriveId: 'drive-h'
    });
  });

  drives.push({
    id: 'drive-h',
    name: 'Legacy Cold Hub',
    letter: 'H',
    color: 'rose',
    icon: 'disc',
    lastUpdated: '2025-11-02 11:21',
    fileCount: driveHItems.length,
    totalSize: driveHItems.reduce((acc, item) => acc + item.Length, 0),
    items: driveHItems,
    description: 'Spinning disk HDD for historic server snapshots, retro family JPG catalogs, and old scanning records.'
  });

  // --- DRIVE 5: AUDIO & SOUND VAULT (Drive I) ---
  const driveIItems: FileItem[] = [];
  const audioBooks = [
    { title: 'The Hobbit', duration: 11, author: 'Tolkien' },
    { title: 'Dune Chronicles', duration: 22, author: 'Herbert' },
    { title: 'Foundation Trilogy', duration: 18, author: 'Asimov' },
  ];
  const soundEffects = ['Laser_Blast', 'Swoosh_Fast', 'Explosion_Deep', 'Ambient_Rain_Loop', 'Crowd_Cheering', 'SciFi_Computer_Beep'];

  // Populate Drive I: Audiobooks
  audioBooks.forEach(ab => {
    const abName = `${ab.title} - Read by Narrator (${ab.author}).m4b`;
    const size = ab.duration * 45 * 1024 * 1024; // 45MB per hour of audio
    driveIItems.push({
      Name: abName,
      FullName: `I:\\Audiobooks\\Fiction\\${ab.title}\\${abName}`,
      Extension: '.m4b',
      Length: size,
      DriveId: 'drive-i'
    });
  });

  // Populate Drive I: Sound Effects (SFX library)
  soundEffects.forEach(sfx => {
    for (let take = 1; take <= 5; take++) {
      const name = `${sfx}_Take_0${take}.wav`;
      const size = 12 * 1024 * 1024 + Math.floor(Math.random() * 8 * 1024 * 1024); // 12MB - 20MB uncompressed WAV
      driveIItems.push({
        Name: name,
        FullName: `I:\\Sound_Library\\SFX\\${sfx}\\${name}`,
        Extension: '.wav',
        Length: size,
        DriveId: 'drive-i'
      });
    }
  });

  // Music production stems and multitracks
  const musicStems = ['Drums', 'Bassline', 'Lead_Synth', 'Vocals_Dry', 'Vocals_Wet', 'FX_Risers', 'Acoustic_Guitar'];
  for (let track = 1; track <= 3; track++) {
    musicStems.forEach(stem => {
      const stemName = `Stem_Track_0${track}_${stem}.wav`;
      const size = 45 * 1024 * 1024 + Math.floor(Math.random() * 25 * 1024 * 1024); // 45-70MB 24-bit WAV stem
      driveIItems.push({
        Name: stemName,
        FullName: `I:\\Projects\\Audio_Stems\\Track_0${track}\\${stemName}`,
        Extension: '.wav',
        Length: size,
        DriveId: 'drive-i'
      });
    });
  }

  drives.push({
    id: 'drive-i',
    name: 'Audio Sound Vault',
    letter: 'I',
    color: 'cyan',
    icon: 'disc',
    lastUpdated: '2026-06-18 10:45',
    fileCount: driveIItems.length,
    totalSize: driveIItems.reduce((acc, item) => acc + item.Length, 0),
    items: driveIItems,
    description: 'FLAC soundtracks, custom audiobooks, multi-track audio stems, and standard WAV sound effects.'
  });


  // --- DRIVE 6: RETRO ARCHIVE & OS HUB (Drive J) ---
  const driveJItems: FileItem[] = [];
  const retroConsoles = ['SNES', 'SegaGenesis', 'PlayStation1', 'N64', 'GameBoyColor'];
  const osList = ['ubuntu-24.04-desktop-amd64.iso', 'debian-12.5.0-amd64-DVD-1.iso', 'archlinux-2026.07.01-x86_64.iso', 'fedora-workstation-40.iso', 'clonezilla-live-3.1.2.iso'];

  // Retro ROMs
  retroConsoles.forEach(console => {
    const romCount = 12 + Math.floor(Math.random() * 15);
    const ext = console === 'SNES' ? '.sfc' : console === 'SegaGenesis' ? '.bin' : console === 'PlayStation1' ? '.chd' : '.z64';
    for (let r = 1; r <= romCount; r++) {
      const romName = `Retro_Game_Title_${console}_${r}${ext}`;
      const size = (console === 'PlayStation1' ? 350 : 2) * 1024 * 1024 + Math.floor(Math.random() * 200 * 1024 * 1024); // 2MB ROMs or 350MB-550MB CHD discs
      driveJItems.push({
        Name: romName,
        FullName: `J:\\Emulation\\ROMs\\${console}\\${romName}`,
        Extension: ext,
        Length: size,
        DriveId: 'drive-j'
      });
    }
  });

  // Operating Systems & Utilities ISOs
  osList.forEach(iso => {
    const size = 1200 * 1024 * 1025 + Math.floor(Math.random() * 3200 * 1024 * 1024); // 1.2GB - 4.4GB ISOs
    driveJItems.push({
      Name: iso,
      FullName: `J:\\Operating_Systems\\Linux\\${iso}`,
      Extension: '.iso',
      Length: size,
      DriveId: 'drive-j'
    });
  });

  drives.push({
    id: 'drive-j',
    name: 'Retro Station',
    letter: 'J',
    color: 'amber',
    icon: 'database',
    lastUpdated: '2026-07-22 22:15',
    fileCount: driveJItems.length,
    totalSize: driveJItems.reduce((acc, item) => acc + item.Length, 0),
    items: driveJItems,
    description: 'System image back-ups, bootable Linux ISO utilities, and custom retro gaming emulation files.'
  });


  // --- DRIVE 7: DEEP LEARNING DEPOT (Drive K) ---
  const driveKItems: FileItem[] = [];
  const datasets = ['imagenet_mini_subset', 'coco_captions_2025', 'glove_word_embeddings', 'imdb_sentiment_reviews', 'climate_change_timeseries'];
  const notebooks = ['eda_and_pre_processing.ipynb', 'model_training_loop.ipynb', 'inference_demo.ipynb', 'quantization_to_onnx.ipynb'];

  // Big Dataset CSVs/Weights
  datasets.forEach(ds => {
    // Large raw CSVs
    const csvName = `${ds}_raw_records.csv`;
    const csvSize = 120 * 1024 * 1024 + Math.floor(Math.random() * 350 * 1024 * 1024); // 120MB - 470MB CSV
    driveKItems.push({
      Name: csvName,
      FullName: `K:\\AI_Research\\Datasets\\${ds}\\${csvName}`,
      Extension: '.csv',
      Length: csvSize,
      DriveId: 'drive-k'
    });

    // Model training checkpoints (.pth or .h5)
    for (let epoch = 1; epoch <= 3; epoch++) {
      const chkName = `${ds}_weights_epoch_${epoch * 10}.pth`;
      const size = 250 * 1024 * 1024 + Math.floor(Math.random() * 1200 * 1024 * 1024); // 250MB - 1.45GB PyTorch checkpoints
      driveKItems.push({
        Name: chkName,
        FullName: `K:\\AI_Research\\Checkpoints\\${ds}\\${chkName}`,
        Extension: '.pth',
        Length: size,
        DriveId: 'drive-k'
      });
    }

    // Jupyter Notebooks
    notebooks.forEach(nb => {
      const size = 15 * 1024 + Math.floor(Math.random() * 450 * 1024); // 15KB - 465KB notebooks with outputs
      driveKItems.push({
        Name: `${ds}_${nb}`,
        FullName: `K:\\AI_Research\\Notebooks\\${ds}\\${ds}_${nb}`,
        Extension: '.ipynb',
        Length: size,
        DriveId: 'drive-k'
      });
    });
  });

  drives.push({
    id: 'drive-k',
    name: 'Deep Learning Depot',
    letter: 'K',
    color: 'indigo',
    icon: 'database',
    lastUpdated: '2026-07-25 17:30',
    fileCount: driveKItems.length,
    totalSize: driveKItems.reduce((acc, item) => acc + item.Length, 0),
    items: driveKItems,
    description: 'PyTorch model weights, Jupyter notebook pipelines, GloVe embeddings, and massive CSV test databases.'
  });

  return drives;
}
