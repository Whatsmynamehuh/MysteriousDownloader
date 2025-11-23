import os
import asyncio
import subprocess
import logging
import requests
import re
import time
import json
import threading
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from contextlib import asynccontextmanager
from ruamel.yaml import YAML

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Set umask to 0 to ensure created files are world-writable
os.umask(0o000)

# Global State
QUEUE: List[Dict[str, Any]] = []
LOG_CLIENTS: List[WebSocket] = []
CONFIG_PATH = "/app/config/config.yaml"
DOWNLOADER_BIN = "apple-music-downloader"
WRAPPER_BIN = "./wrapper"
WRAPPER_DATA = "/app/wrapper_data"
CACHE_DEV_TOKEN: Optional[str] = None
LOGIN_STATUS = {"status": "idle"}
LOGIN_PROCESS: Optional[asyncio.subprocess.Process] = None
WRAPPER_DAEMON_PROCESS: Optional[subprocess.Popen] = None
MAX_PARALLEL = 3

yaml = YAML()
yaml.preserve_quotes = True

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Logic
    global WRAPPER_DAEMON_PROCESS
    try:
        if os.path.exists(CONFIG_PATH):
            dest = "config.yaml"
            if not os.path.exists(dest):
                try:
                    os.symlink(CONFIG_PATH, dest)
                    logger.info(f"Created symlink for config.yaml in {os.getcwd()}")
                except Exception as e:
                    logger.warning(f"Failed to create config symlink: {e}")
        
        logger.info("Starting Wrapper Daemon...")
        os.makedirs(f"{WRAPPER_DATA}/data/com.apple.android.music/files", exist_ok=True)
        os.makedirs(f"{WRAPPER_DATA}/user/0/com.apple.android.music/files", exist_ok=True)
        
        env = os.environ.copy()
        env["ANDROID_DATA"] = WRAPPER_DATA
        env["ANDROID_ROOT"] = f"{WRAPPER_DATA}/system"
        
        cmd = [WRAPPER_BIN, "-H", "0.0.0.0"]
        WRAPPER_DAEMON_PROCESS = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, text=True
        )
        logger.info(f"Wrapper Daemon started with PID {WRAPPER_DAEMON_PROCESS.pid}")
        
        def log_wrapper(proc):
            for line in iter(proc.stdout.readline, ''):
                if line: logger.info(f"[Wrapper Daemon] {line.strip()}")
        
        threading.Thread(target=log_wrapper, args=(WRAPPER_DAEMON_PROCESS,), daemon=True).start()

    except Exception as e:
        logger.error(f"Failed to start Wrapper Daemon: {e}")

    yield 

    if WRAPPER_DAEMON_PROCESS:
        logger.info("Stopping Wrapper Daemon...")
        try:
            WRAPPER_DAEMON_PROCESS.terminate()
            WRAPPER_DAEMON_PROCESS.wait(timeout=5)
        except Exception:
            WRAPPER_DAEMON_PROCESS.kill()

app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")

class DownloadRequest(BaseModel):
    url: str
    codec: str = "alac"
    title: Optional[str] = None
    artist: Optional[str] = None
    album: Optional[str] = None
    image: Optional[str] = None
    track_number: Optional[int] = None
    total_tracks: Optional[int] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class TwoFARequest(BaseModel):
    code: str

class ParallelLimitRequest(BaseModel):
    limit: int

async def broadcast_log(message: str):
    logger.info(message)
    for client in LOG_CLIENTS:
        try:
            await client.send_text(message)
        except:
            pass

def load_config():
    try:
        if os.path.exists("/app/config"):
            os.chmod("/app/config", 0o777)
    except:
        pass

    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r') as f:
                return yaml.load(f) or {}
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return {}
    
    default_config = """media-user-token: ""
authorization-token: ""
language: ""
lrc-type: "lyrics"
lrc-format: "lrc"
embed-lrc: true
save-lrc-file: false
save-artist-cover: false
save-animated-artwork: false
emby-animated-artwork: false
embed-cover: true
cover-size: 5000x5000
cover-format: jpg
alac-save-folder: /app/downloads/ALAC
atmos-save-folder: /app/downloads/Atmos
燬-save-folder: /app/downloads/AAC
max-memory-limit: 256
decrypt-m3u8-port: "127.0.0.1:10020"
get-m3u8-port: "127.0.0.1:20020"
get-m3u8-from-device: true
get-m3u8-mode: hires
燬-type: aac-lc
alac-max: 192000
atmos-max: 2768
limit-max: 200
album-folder-format: "{AlbumName}"
playlist-folder-format: "{PlaylistName}"
song-file-format: "{SongNumer}. {SongName}"
artist-folder-format: "{UrlArtistName}"
explicit-choice : "[E]"
clean-choice : "[C]"
apple-master-choice : "[M]"
use-songinfo-for-playlist: false
dl-albumcover-for-playlist: false
mv-audio-type: atmos
mv-max: 2160
storefront: "us"
convert-after-download: false
convert-format: "flac"
convert-keep-original: false
convert-skip-if-source-matches: true
ffmpeg-path: "ffmpeg"
convert-extra-args: ""
convert-warn-lossy-to-lossless: true
convert-skip-lossy-to-lossless: true
"""
    try:
        with open(CONFIG_PATH, 'w') as f:
            f.write(default_config)
        with open(CONFIG_PATH, 'r') as f:
            return yaml.load(f)
    except Exception as e:
        logger.error(f"Failed to create default config: {e}")
        return {}

def save_config(config: Dict):
    try:
        with open(CONFIG_PATH, 'w') as f:
            yaml.dump(config, f)
    except Exception as e:
        logger.error(f"Failed to save config: {e}")

def get_apple_music_dev_token(storefront: str) -> Optional[str]:
    global CACHE_DEV_TOKEN
    if CACHE_DEV_TOKEN:
        return CACHE_DEV_TOKEN
    try:
        logging.info(f"Fetching new developer token for storefront: {storefront}...")
        homepage_res = requests.get(f'https://music.apple.com/{storefront}/browse', timeout=20)
        homepage_res.raise_for_status()
        match = re.search(r'/assets/index-legacy[~-][^/"]+\.js', homepage_res.text)
        if not match: return None
        js_url = f"https://music.apple.com{match.group(0)}"
        js_res = requests.get(js_url, timeout=20)
        js_res.raise_for_status()
        token_match = re.search(r'eyJh[a-zA-Z0-9\._-]+', js_res.text)
        if not token_match: return None
        CACHE_DEV_TOKEN = token_match.group(0)
        return CACHE_DEV_TOKEN
    except Exception as e:
        logging.error(f"Failed to get developer token: {e}")
        return None

def parse_api_item(item: dict, size: int = 600) -> Optional[dict]:
    if not item or not item.get('attributes'): return None
    attrs = item['attributes']
    artwork_url = attrs.get('artwork', {}).get('url', '')
    if artwork_url and '{w}' in artwork_url:
        artwork_url = artwork_url.replace('{w}', str(size)).replace('{h}', str(size))
    return {
        'id': item.get('id'),
        'type': item.get('type'),
        'name': attrs.get('name'),
        'artist': attrs.get('artistName'),
        'album': attrs.get('albumName'),
        'url': attrs.get('url'),
        'image': artwork_url,
        'releaseDate': attrs.get('releaseDate'),
        'trackNumber': attrs.get('trackNumber'),
        'trackCount': attrs.get('trackCount'),
        'hasLyrics': attrs.get('hasLyrics', False)
    }

def api_search(query: str, storefront: str = "us") -> Dict[str, List[Dict]]:
    token = get_apple_music_dev_token(storefront)
    if not token: return {}
    headers = {
        "Authorization": f"Bearer {token}",
        "Origin": "https://music.apple.com",
        "Referer": "https://music.apple.com/"
    }
    types = "songs,albums,artists,music-videos,playlists"
    params = {"term": query, "types": types, "limit": 10}
    api_url = f"https://amp-api.music.apple.com/v1/catalog/{storefront}/search"
    try:
        response = requests.get(api_url, headers=headers, params=params, timeout=20)
        if response.status_code in [401, 403]:
            global CACHE_DEV_TOKEN
            CACHE_DEV_TOKEN = None
            token = get_apple_music_dev_token(storefront)
            if token:
                headers["Authorization"] = f"Bearer {token}"
                response = requests.get(api_url, headers=headers, params=params, timeout=20)
        response.raise_for_status()
        data = response.json()
        grouped_results = {"top": [], "songs": [], "albums": [], "artists": [], "playlists": [], "music_videos": []}
        if 'results' in data:
            for cat_key, dict_key in [('songs', 'songs'), ('albums', 'albums'), ('artists', 'artists'), ('music-videos', 'music_videos'), ('playlists', 'playlists')]:
                items = data['results'].get(cat_key, {}).get('data', [])
                parsed_items = [p for item in items if (p := parse_api_item(item))]
                grouped_results[dict_key] = parsed_items
                if parsed_items: grouped_results["top"].append(parsed_items[0])
        return grouped_results
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return {}

# --- ROUTES ---

@app.get("/", response_class=HTMLResponse)
async def read_root():
    response = FileResponse("index.html")
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.get("/api/search")
async def search(query: str):
    config = load_config()
    storefront = config.get('storefront', 'us')
    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(None, api_search, query, storefront)
    return results

@app.get("/api/artist")
async def resolve_artist(url: str):
    match = re.search(r'music\.apple\.com/([a-z]{2})/artist/[^/]+/(\d+)', url)
    if not match: raise HTTPException(status_code=400, detail="Invalid URL")
    storefront, artist_id = match.groups()
    token = get_apple_music_dev_token(storefront)
    headers = {"Authorization": f"Bearer {token}", "Origin": "https://music.apple.com"}
    categorized = {"albums": [], "eps": [], "singles": [], "music_videos": [], "compilations": []}
    try:
        views = "full-albums,singles,compilations,music-videos,featured-albums"
        api_url = f"https://amp-api.music.apple.com/v1/catalog/{storefront}/artists/{artist_id}?views={views}"
        response = requests.get(api_url, headers=headers, timeout=20)
        if response.status_code in [401, 403]:
             global CACHE_DEV_TOKEN; CACHE_DEV_TOKEN = None
             token = get_apple_music_dev_token(storefront)
             headers["Authorization"] = f"Bearer {token}"
             response = requests.get(api_url, headers=headers, timeout=20)
        response.raise_for_status()
        data = response.json()
        artist_data = data.get('data', [])[0]
        if not artist_data: return categorized
        relationships = artist_data.get('views', {})
        def process_view(view_name, target_list):
            items = relationships.get(view_name, {}).get('data', [])
            for item in items:
                parsed = parse_api_item(item)
                if parsed: target_list.append(parsed)
        process_view('full-albums', categorized['albums'])
        process_view('singles', categorized['singles'])
        process_view('compilations', categorized['compilations'])
        process_view('music-videos', categorized['music_videos'])
        real_singles = []
        real_eps = []
        for item in categorized['singles']:
            if item['name'].lower().endswith(' - ep'): real_eps.append(item)
            else: real_singles.append(item)
        categorized['singles'] = real_singles
        categorized['eps'] = real_eps
        return categorized
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def enrich_metadata(task: Dict):
    try:
        url = task['url']
        match = re.search(r'music\.apple\.com/([a-z]{2})/(album|playlist|music-video|station)/([^/]+)/(\d+)', url)
        if not match: return
        storefront, type_str, _, id_str = match.groups()
        song_match = re.search(r'\?i=(\d+)', url)
        if song_match:
            id_str = song_match.group(1)
            type_str = "songs"
        elif type_str == "album": type_str = "albums"
        elif type_str == "playlist": type_str = "playlists"
        elif type_str == "music-video": type_str = "music-videos"

        token = get_apple_music_dev_token(storefront)
        if not token: return
        headers = {"Authorization": f"Bearer {token}", "Origin": "https://music.apple.com"}
        api_url = f"https://amp-api.music.apple.com/v1/catalog/{storefront}/{type_str}/{id_str}"
        if type_str == "albums": api_url += "?views=tracks"

        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(None, lambda: requests.get(api_url, headers=headers))
        if resp.status_code == 200:
            data = resp.json()
            item = data['data'][0]
            parsed = parse_api_item(item)
            if parsed:
                if not task.get('title') and parsed.get('name'): task['title'] = parsed['name']
                if not task.get('artist') and parsed.get('artist'): task['artist'] = parsed['artist']
                if not task.get('album') and parsed.get('album'): task['album'] = parsed['album']
                if not task.get('image') and parsed.get('image'): task['image'] = parsed['image']
                if type_str == "albums" and parsed.get('name'):
                    task['album'] = parsed['name']
                    task['title'] = parsed['name']
                    task['sub_tasks'] = []
                    
                    tracks_data = []
                    if 'views' in item and 'tracks' in item['views']:
                        tracks_data = item['views']['tracks'].get('data', [])
                    elif 'relationships' in item and 'tracks' in item['relationships']:
                        tracks_data = item['relationships']['tracks'].get('data', [])
                        
                    for t in tracks_data:
                        t_attrs = t.get('attributes', {})
                        task['sub_tasks'].append({
                            'track_number': t_attrs.get('trackNumber'),
                            'title': t_attrs.get('name'),
                            'status': 'pending'
                        })
                await broadcast_log(f"Metadata resolved: {task.get('artist')} - {task.get('album')} ({len(task['sub_tasks'])} tracks)")
    except Exception as e:
        logger.error(f"Metadata enrichment failed: {e}")

@app.post("/api/settings/parallel")
async def set_parallel_limit(req: ParallelLimitRequest):
    global MAX_PARALLEL
    MAX_PARALLEL = req.limit
    await broadcast_log(f"Parallel limit set to {MAX_PARALLEL}")
    asyncio.create_task(process_queue())
    return {"status": "updated", "limit": MAX_PARALLEL}

@app.post("/api/download")
async def add_download(req: DownloadRequest):
    task = req.dict()
    task['status'] = 'pending'
    task['id'] = len(QUEUE) + 1
    task['sub_tasks'] = []
    QUEUE.append(task)
    await broadcast_log(f"Added to queue: {req.url}")
    asyncio.create_task(enrich_metadata(task))
    asyncio.create_task(process_queue())
    return {"status": "added", "task": task}

@app.get("/api/queue")
async def get_queue():
    return QUEUE

@app.post("/api/history/clear")
async def clear_history():
    global QUEUE
    QUEUE = [t for t in QUEUE if t['status'] in ['pending', 'downloading']]
    await broadcast_log("History cleared.")
    return {"status": "cleared"}

@app.get("/api/settings")
async def get_settings():
    return load_config()

@app.post("/api/settings")
async def update_settings(req: Request):
    new_settings = await req.json()
    current = load_config()
    current.update(new_settings)
    save_config(current)
    await broadcast_log("Settings updated")
    return {"status": "updated"}

@app.get("/api/login/status")
async def get_login_status():
    return LOGIN_STATUS

@app.post("/api/login")
async def login(req: LoginRequest):
    global LOGIN_STATUS, LOGIN_PROCESS, WRAPPER_DAEMON_PROCESS
    if WRAPPER_DAEMON_PROCESS:
        WRAPPER_DAEMON_PROCESS.terminate()
        WRAPPER_DAEMON_PROCESS.wait()
        WRAPPER_DAEMON_PROCESS = None
    if LOGIN_PROCESS and LOGIN_PROCESS.returncode is None:
        try:
            LOGIN_PROCESS.terminate()
            await asyncio.wait_for(LOGIN_PROCESS.wait(), timeout=2.0)
        except: LOGIN_PROCESS.kill()
        LOGIN_PROCESS = None
    LOGIN_STATUS["status"] = "authenticating"
    env = os.environ.copy()
    env["ANDROID_DATA"] = WRAPPER_DATA
    env["ANDROID_ROOT"] = f"{WRAPPER_DATA}/system"
    try:
        cmd = [WRAPPER_BIN, "-L", f"{req.username}:{req.password}"]
        LOGIN_PROCESS = await asyncio.create_subprocess_exec(
            *cmd, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, env=env
        )
        asyncio.create_task(monitor_login(LOGIN_PROCESS))
        return {"status": "started"}
    except Exception as e:
        LOGIN_STATUS["status"] = "failed"
        restart_daemon()
        return {"status": "failed", "error": str(e)}

def restart_daemon():
    global WRAPPER_DAEMON_PROCESS
    env = os.environ.copy()
    env["ANDROID_DATA"] = WRAPPER_DATA
    env["ANDROID_ROOT"] = f"{WRAPPER_DATA}/system"
    cmd = [WRAPPER_BIN, "-H", "0.0.0.0"]
    WRAPPER_DAEMON_PROCESS = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, text=True
    )
    def log_wrapper(proc):
        for line in iter(proc.stdout.readline, ''):
            if line: logger.info(f"[Wrapper Daemon] {line.strip()}")
    threading.Thread(target=log_wrapper, args=(WRAPPER_DAEMON_PROCESS,), daemon=True).start()

async def monitor_login(process: asyncio.subprocess.Process):
    global LOGIN_STATUS
    while True:
        if process.returncode is not None: break
        try: line_bytes = await process.stdout.readline()
        except: break
        if line_bytes:
            line = line_bytes.decode('utf-8', errors='replace')
            await broadcast_log(f"[Wrapper] {line.strip()}")
            if "2FA: true" in line or "authentication code" in line.lower() or "code:" in line.lower():
                LOGIN_STATUS["status"] = "waiting_2fa"
            elif "success" in line.lower() or "logged in" in line.lower() or "response type 6" in line.lower():
                LOGIN_STATUS["status"] = "success"
        else: break
    await process.wait()
    if LOGIN_STATUS["status"] != "success": LOGIN_STATUS["status"] = "failed"
    restart_daemon()

@app.post("/api/2fa")
async def submit_2fa(req: TwoFARequest):
    global LOGIN_PROCESS, LOGIN_STATUS
    if LOGIN_STATUS["status"] != "waiting_2fa" or not LOGIN_PROCESS:
        return {"status": "error"}
    try:
        if LOGIN_PROCESS.stdin:
            LOGIN_PROCESS.stdin.write(f"{req.code}\n".encode())
            await LOGIN_PROCESS.stdin.drain()
            LOGIN_STATUS["status"] = "authenticating"
            return {"status": "submitted"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.websocket("/ws/logs")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    LOG_CLIENTS.append(websocket)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect:
        LOG_CLIENTS.remove(websocket)

async def process_queue():
    # Concurrency Control
    active_count = len([t for t in QUEUE if t['status'] == 'downloading'])
    if active_count >= MAX_PARALLEL:
        return

    task = next((t for t in QUEUE if t['status'] == 'pending'), None)
    if not task: return
    task['status'] = 'downloading'
    task['progress'] = 'Starting...'
    await broadcast_log(f"Starting download: {task['url']}")
    current_track_idx = -1
    try:
        cmd = [DOWNLOADER_BIN]
        if task['codec'] == 'aac': cmd.append('--aac')
        elif task['codec'] == 'atmos' or task['codec'] == 'ec3': cmd.append('--atmos')
        if "/music-video/" in task['url']: pass 
        elif "/song/" in task['url'] or "?i=" in task['url']: cmd.append("--song")
        elif "/album/" in task['url']: cmd.append("--all-album")
        cmd.append(task['url'])
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, cwd="/app" 
        )
        # Monitor Progress
        total_tracks = task.get('total_tracks') or 1
        completed_tracks = 0
        next_line_is_track_name = False
        buffer = b""
        
        while True:
            if process.returncode is not None: break
            try:
                chunk = await process.stdout.read(4096) # Read larger chunk
            except: break
            if not chunk: break
            
            buffer += chunk
            
            while True:
                # Find next newline (either \r or \n)
                match_n = buffer.find(b'\n')
                match_r = buffer.find(b'\r')
                
                if match_n == -1 and match_r == -1:
                    break # No complete line yet
                
                # Find the earliest delimiter
                if match_n != -1 and (match_r == -1 or match_n < match_r):
                    delimiter = match_n
                    advance = 1
                else:
                    delimiter = match_r
                    advance = 1
                
                line_bytes = buffer[:delimiter]
                buffer = buffer[delimiter+advance:] # Move buffer forward
                
                line = line_bytes.decode('utf-8', errors='replace').strip()
                if not line: continue

                # --- PARSING LOGIC ---
                # Log significant events only to Websocket (Filtered to avoid insane spam if needed, but User requested visibility)
                # We will broadcast everything relevant, and let Frontend handle the update-in-place.
                if any(x in line for x in ["Track", "Decrypted", "Queue", "Failed", "Downloading", "Decrypting"]):
                     await broadcast_log(f"[Downloader] {line}")

                # Pattern: "Track 1 of 14:"
                track_match = re.search(r'Track (\d+) of (\d+):', line)
                if track_match:
                    current = int(track_match.group(1))
                    total = int(track_match.group(2))
                    completed_tracks = current - 1
                    task['total_tracks'] = total
                    percent = int((completed_tracks / total) * 100)
                    task['progress'] = f"Track {current}/{total} ({percent}%)"
                    
                    # Update Sub-Task Status
                    if 'sub_tasks' in task and task['sub_tasks']:
                        if current_track_idx >= 0 and current_track_idx < len(task['sub_tasks']):
                             task['sub_tasks'][current_track_idx]['status'] = 'completed'
                        current_track_idx = -1
                        for idx, st in enumerate(task['sub_tasks']):
                            if st.get('track_number') == current:
                                current_track_idx = idx
                                st['status'] = 'downloading'
                                break
                    next_line_is_track_name = True
                    continue

                if next_line_is_track_name and line:
                    task['progress'] += f": {line}"
                    next_line_is_track_name = False
                    continue
                
                if "Track already exists locally" in line:
                    if 'sub_tasks' in task and current_track_idx != -1: task['sub_tasks'][current_track_idx]['status'] = 'skipped'
                    completed_tracks += 1
                
                # Parse Progress Bar (Update UI but don't log)
                decrypt_match = re.search(r'Decrypting\.\.\.\s+(\d+)%', line)
                if decrypt_match:
                    percent = decrypt_match.group(1)
                    task['progress'] = f"Decrypting {percent}% [{completed_tracks + 1}/{total_tracks}]"
                    
                download_match = re.search(r'Downloading\.\.\.\s+(\d+)%', line)
                if download_match:
                    percent = download_match.group(1)
                    task['progress'] = f"Downloading {percent}% [{completed_tracks + 1}/{total_tracks}]"
                # ---------------------
        rc = await process.wait()
        if rc == 0:
            if 'sub_tasks' in task and current_track_idx != -1: task['sub_tasks'][current_track_idx]['status'] = 'completed'
            task['status'] = 'completed'
            task['progress'] = '100% Done'
        else:
            if 'sub_tasks' in task and current_track_idx != -1: task['sub_tasks'][current_track_idx]['status'] = 'failed'
            task['status'] = 'failed'
    except Exception as e:
        task['status'] = 'failed'
        task['progress'] = f"Error: {str(e)}"
    await process_queue()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
