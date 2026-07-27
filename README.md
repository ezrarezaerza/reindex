# ReIndex — High-Performance External Storage Catalog & Search Engine

ReIndex is a sleek, ultra-fast, offline-first search index and file catalog manager for external hard drives, SSDs, NAS, and backup archives. It acts as a unified digital brain for all your disconnected physical media, allowing you to instantly search, visualize, and optimize files across multiple drives—even when they are not plugged into your computer.

<p align="center">
  <img src="public/icon-192x192.png" width="128" height="128" alt="ReIndex Brand Icon" />
</p>

## ✨ Core Capabilities

### 📂 Unified Drive Cataloging
- **Disconnected Browsing**: Import file system listings of any external hard drive (HDDs, high-speed SSDs, SD cards, server back-ups, cold-storage HDDs) and browse them with full path and size preservation.
- **Dynamic Partition Management**: Add, rename, customize, and color-code drive letter profiles (e.g. `E:\ Media Vault`, `G:\ Creative Hub`) to align with your physical drives.

### 🔍 Instant Fuzzy Search
- **Sub-Millisecond Search**: Fast matching engine supporting search by partial filenames, directories, file sizes, or exact extensions.
- **Multi-select Extension Filters**: One-tap filters for popular file groupings like video, audio, code, and document formats.

### 📊 Rich Storage Analytics
- **Interactive Folder Tree Maps**: Dynamically visualize storage usage across your folders using high-performance hierarchical visualizers.
- **Interactive Directory Trees**: Expand, collapse, and traverse directories instantly with inline size indicators.
- **Content Breakdowns**: Detailed charts breaking down storage allocations by size categories and file types.

### 🧹 Storage & Space Optimizer
- **Cross-Drive Duplication Detector**: Scan your entire drive registry to identify duplicate file groups (identical size and name) across different drives, detailing redundant space that can be reclaimed.
- **Deep Nesting Scanner**: Identify deeply buried archives or excessive directory structures.

### ⚙️ Script & Export Center
- **Robocopy Script Generator**: Seamlessly generate production-ready Windows `robocopy` or Linux `rsync` scripts to sync folder structures safely in the background.
- **Sync Catalog Exporters**: Export your indexing database to structured formats for portability.

### 🏷️ Virtual Collections & Custom Tags
- **Logical Labels**: Assign metadata and custom category labels to index items across different drives without moving the physical files.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion (animations).
- **Backend**: Node.js, Express, tsx.
- **Database**: PostgreSQL (with pg client & connection pooling) or dynamic fallback to browser `localStorage` Cache.
- **Bundler & Build Tool**: Vite (assets), esbuild (Express server bundle compiling into CJS for containerized environments).

---

## 🚀 Getting Started

### Local Storage Mode (Offline Out-of-the-Box)
ReIndex runs completely in **Local Cache Mode** if no database is connected. All profiles, drives, custom tags, and file indexes are securely maintained in your browser’s local cache without any server-side dependencies.

### PostgreSQL Cloud Mode (Persistent Synchronization)
To enable multi-device sync and durable backups, configure a PostgreSQL database by adding the connection string:

1. Create a `.env` file in the root directory:
   ```env
   POSTGRES_URL=postgresql://username:password@host:port/database
   ```
2. Run the start command:
   ```bash
   npm run dev
   ```
3. The server will automatically detect the connection, provision the SQL tables (users, sessions, drives, files), and seamlessly migrate your offline caches.

---

## 📂 Project Structure

```
├── api/                  # Express REST API controllers and endpoints
├── public/               # Static assets & brand SVG icons
├── src/
│   ├── components/       # Reusable React components (TreeMap, SpaceOptimizer, Sidebar, etc.)
│   ├── utils/            # Indexing algorithms, sample data templates, and helpers
│   ├── types.ts          # Unified TS Interfaces & Enums
│   ├── App.tsx           # Primary application coordinator and routing controller
│   └── main.tsx          # React application entry point
├── server.ts             # Express & Vite development server
└── package.json          # Dependency and script management
```

---

## 📜 Development Commands

| Command | Action |
|:---|:---|
| `npm run dev` | Boots the full-stack server under `http://localhost:3000` |
| `npm run build` | Builds optimized React static output and compiles backend server |
| `npm run lint` | Runs type-safety checks via TypeScript compiler |
| `npm run clean` | Purges generated distribution build folders |
