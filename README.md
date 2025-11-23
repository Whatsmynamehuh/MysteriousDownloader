# MysteriousDownloader (DDownloaderv2)

A powerful, modern, and modular Web UI for downloading high-quality audio from Apple Music. Built with Python (FastAPI) and Vanilla JavaScript, designed to run seamlessly in Docker.

## 📸 Screenshots

| **Login** | **Search** |
|:---:|:---:|
| ![Login Page](https://via.placeholder.com/400x300.png?text=Login+Page) | ![Search Page](https://via.placeholder.com/400x300.png?text=Search+Page) |

| **Discography** | **Queue (Hero UI)** |
|:---:|:---:|
| ![Discography Modal](https://via.placeholder.com/400x300.png?text=Discography+Modal) | ![Unified Queue](https://via.placeholder.com/400x300.png?text=Unified+Queue+Hero) |

| **History** | **Settings** |
|:---:|:---:|
| ![History View](https://via.placeholder.com/400x300.png?text=History+View) | ![Settings Page](https://via.placeholder.com/400x300.png?text=Settings+Page) |

## ✨ Features

*   **Modern Glass UI:** A beautiful, responsive interface built with Tailwind CSS and glassmorphism principles.
*   **Powerful Search:** Search for Songs, Albums, Artists, and Playlists directly from Apple Music.
*   **Unified Active Queue:** 
    *   **Hero Cards:** Active downloads appear as large, rich cards with live progress bars.
    *   **Tracklist Toggle:** Expand active album downloads to see real-time status of every individual track.
    *   **Concurrency Control:** Set parallel download limits (1-3) directly from the UI.
*   **Smart History:**
    *   **Separated Views:** Distinct sections for "Completed" and "Failed" downloads.
    *   **Retry Logic:** One-click retry for failed items.
    *   **Detailed Archives:** Expand completed albums to verify track counts and details.
*   **Advanced Configuration:** Full settings editor for codec selection (ALAC, AAC, Atmos), file naming formats, and region settings.
*   **Authentication:** Built-in login flow with 2FA support for Apple Music.
*   **Real-time Logs:** Integrated console for monitoring the backend downloader process.

## 🚀 Installation (Docker)

The recommended way to run MysteriousDownloader is via Docker Compose.

### 1. Prerequisites
*   Docker
*   Docker Compose

### 2. Setup
Create a folder for the application and create a `docker-compose.yml` file (or clone this repo):

```yaml
version: '3'
services:
  downloader:
    image: ghcr.io/whatsmynamehuh/mysteriousdownloader:latest # Or build locally
    container_name: apple-music-downloader
    ports:
      - "58000:5000"   # Web UI
      - "10020:10020"  # Decryption Service
    volumes:
      # Config Persistence
      - ./config:/app/config
      # Music Storage (Map to your host music library)
      - ./downloads:/app/downloads
      # Wrapper Data Persistence (Login Session)
      - ./wrapper_data:/app/wrapper_data
    restart: unless-stopped
```

### 3. Run
Start the container:
```bash
docker-compose up -d
```

Access the Web UI at: `http://localhost:58000`

## 🛠️ Usage

1.  **Login:** On first launch, you will be prompted to log in with your Apple ID. The UI handles the 2FA flow interactively.
2.  **Search:** Use the Search tab to find music. You can select your desired codec (ALAC, AAC, Atmos) next to the search bar.
3.  **Download:**
    *   **Click Cards:** Click any search result to add it to the queue.
    *   **Discography:** Click an Artist to view their full discography. Use "Select All" or click cards to batch download.
    *   **Paste URL:** Paste an Apple Music link directly into the search bar and hit Enter.
4.  **Monitor:** Switch to the **Queue** tab to watch progress. Use the "Parallel" dropdown in Search to speed up or slow down processing.

## 🏗️ Architecture

*   **Backend:** Python 3.12 + FastAPI. Acts as an orchestrator, managing the queue, calling the binary tools, and serving the frontend.
*   **Frontend:** Vanilla JavaScript (ES Modules). No build step required. 
    *   `main.js`: Entry point.
    *   `queue.js`: Handles real-time updates and the rich card rendering.
    *   `search.js`: Manages search results and artist data.
*   **Core Binaries:**
    *   `apple-music-downloader`: Go-based CLI tool for fetching stream data.
    *   `wrapper`: Node.js-based tool for ALAC decryption and authentication.

## ⚙️ Configuration

You can configure the application via the **Settings** tab in the Web UI or by editing `config/config.yaml`.

**Key Settings:**
*   `media-user-token` / `authorization-token`: For manual auth (if needed).
*   `alac-save-folder`: Default path `/app/downloads/ALAC`.
*   `album-folder-format`: Customize how folders are named (e.g., `{ArtistName} - {AlbumName}`).
*   `parallel-downloads`: Default concurrency limit.

## 📝 Credits

*   **Core Tools:** `apple-music-downloader` and `wrapper` by **ZHAAREY**.
*   **Backend/Logic:** Python/FastAPI orchestration.
*   **UI Design:** Custom Glassmorphism interface.

---
*Disclaimer: This tool is for educational purposes only. Respect copyright laws and terms of service.*
