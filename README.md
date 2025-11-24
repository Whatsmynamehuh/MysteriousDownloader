# MysteriousDownloader (DDownloaderv2)

A powerful, modern, and modular Web UI for downloading high-quality audio from Apple Music. Built with Python (FastAPI) and Vanilla JavaScript, designed to run seamlessly in Docker.

## 📸 Screenshots

To add screenshots, place your images in the `screenshots/` folder.

### Login
![Login](https://github.com/user-attachments/assets/741a660f-b5c8-4a0f-93c0-6675286d3a0a)

### Search
![Search](https://github.com/user-attachments/assets/2c816b7e-7cd0-4de3-a879-8c8eb8b2deea")

### Discography
![Discography](screenshots/discography.png)

### Queue (Unified Hero)
![Queue](screenshots/queue.png)

### History
![History](screenshots/history.png)

### Settings
![Settings](screenshots/settings.png)

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

### 📂 Changing Download Location
To change where files are saved on your actual computer/server, you do **not** need to edit the app settings. Instead, update the **Docker Volume mapping** in `docker-compose.yml`.

1.  Open `docker-compose.yml`.
2.  Find the `volumes` section.
3.  Change the left side of the mapping:
    ```yaml
    volumes:
      - /your/custom/music/path:/app/downloads  <-- CHANGE THIS
    ```
    *   **Left Side:** The folder on your computer/Unraid server.
    *   **Right Side:** `/app/downloads` (Do NOT change this, it's where the app looks internally).

### 🔑 Authentication Helper
The application includes a built-in login system, but if you need to manually grab tokens (e.g., for a specific region or troubleshooting):
1.  Go to **Settings > Authentication & Region**.
2.  Click the **COPY SCRIPT** button.
3.  Open [music.apple.com](https://music.apple.com) in your browser and sign in.
4.  Open Developer Tools (**F12**) and go to the **Console** tab.
5.  Paste the script and press **Enter**.
6.  A popup will appear with your `media-user-token` and `authorization-token`. Copy these back into the Settings fields.

## 📝 Credits

*   **Core Tools:** `apple-music-downloader` and `wrapper` by **ZHAAREY**.
*   **Backend/Logic:** Python/FastAPI orchestration.
*   **UI Design:** Custom Glassmorphism interface.

---
*Disclaimer: This tool is for educational purposes only. Respect copyright laws and terms of service.*
