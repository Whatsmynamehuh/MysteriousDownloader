import { showConfirm } from './modals.js';
import { apiClearHistory } from './api.js';

let expandedBatchTasks = new Set();

export async function updateQueue() {
    try {
        const res = await fetch('/api/queue?t=' + Date.now());
        if (!res.ok) return;
        const queue = await res.json();

        // Segment Tasks
        const activeTasks = queue.filter(t => t.status === 'downloading');
        const nextUpTasks = queue.filter(t => t.status === 'pending');
        const completedTasks = queue.filter(t => t.status === 'completed');
        const failedTasks = queue.filter(t => t.status === 'failed');

        // Update Badge
        const badge = document.getElementById('queueCountBadge');
        if (badge) badge.innerText = nextUpTasks.length;

        // Render Sections
        renderActiveHeroes(activeTasks);
        renderNextUpList(nextUpTasks);
        renderHistoryFailed(failedTasks);
        renderHistoryCompleted(completedTasks);

    } catch (e) { console.error("Queue Update Error:", e); }
}

export async function clearHistory() {
    try {
        const res = await apiClearHistory();
        if (res.ok) updateQueue();
        else alert("Failed to clear history");
    } catch (e) { console.error(e); }
}

// --- RENDERERS ---

function renderActiveHeroes(tasks) {
    const container = document.getElementById('activeTaskContainer');
    if (!container) return;
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-10 glass rounded-3xl">No active downloads</div>';
        return;
    }

    container.innerHTML = ''; // Clear container

    tasks.forEach(task => {
        // Parse Progress Safely
        let current = 1;
        let total = task.total_tracks || '?';
        let percent = 0;
        let songName = "Initializing...";
        const progressStr = task.progress || "";

        try {
            const trackMatch = progressStr.match(/Track (\d+)[\/| of ](\d+)/) || progressStr.match(/(\d+)\/(\d+)/);
            if (trackMatch) { 
                current = parseInt(trackMatch[1]); 
                total = parseInt(trackMatch[2]); 
            } else if (typeof task.total_tracks === 'number' && Array.isArray(task.sub_tasks)) {
                const pendingCount = task.sub_tasks.filter(t => t.status === 'pending').length;
                current = task.total_tracks - pendingCount;
                if (current < 1) current = 1;
            }

            const pctMatch = progressStr.match(/(\d+)%/);
            if (pctMatch) percent = parseInt(pctMatch[1]);

            const colonIdx = progressStr.indexOf(':');
            if (colonIdx > -1) {
                songName = progressStr.substring(colonIdx + 1).trim();
                if (songName.includes('Skipped')) songName = songName.replace('Skipped (Exists)', '').trim() + ' <span class="text-gray-500 text-xs italic">(Skipping)</span>';
            } else if (progressStr.includes("Decrypting")) songName = "Decrypting...";
            else if (progressStr.includes("Downloading")) songName = "Downloading...";
        } catch (e) { console.warn(e); }

        const isExpanded = expandedBatchTasks.has(task.id);
        const listClass = isExpanded ? '' : 'hidden';
        const btnText = isExpanded ? 'HIDE TRACKS' : 'VIEW TRACKS';
        const albumArt = task.image || "https://music.apple.com/assets/default/album-cover.png";

        // Sub-tasks HTML
        const subTasksHtml = (task.sub_tasks || []).map(st => {
            let rowClass = 'opacity-50 hover:opacity-80 transition border border-transparent';
            let icon = '<span class="text-xs font-bold text-gray-600">PENDING</span>';
            
            if (st.status === 'completed') { 
                icon = '<span class="text-green-400 font-bold text-[10px]">DONE</span>';
                rowClass = 'opacity-70 hover:opacity-100';
            } else if (st.status === 'failed') { 
                icon = '<span class="text-red-500 font-bold text-[10px]">FAIL</span>';
            } else if (st.status === 'skipped') {
                icon = '<span class="text-yellow-500 font-bold text-[10px]">SKIP</span>';
            } else if (st.status === 'downloading') { 
                rowClass = 'bg-white/10 border-pink-500/30 opacity-100 relative overflow-hidden';
                icon = '<span class="text-blue-400 font-bold text-[10px] animate-pulse">>>></span>';
            }

            return `
            <div class="flex items-center justify-between p-2 rounded mb-1 ${rowClass} w-full">
                ${st.status === 'downloading' ? '<div class="absolute left-0 top-0 bottom-0 w-0.5 bg-pink-500"></div>' : ''}
                
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <span class="text-xs font-mono text-gray-500 w-6 text-right flex-shrink-0">${st.track_number || '-'}</span>
                    <span class="text-sm text-gray-300 truncate font-medium">${st.title}</span>
                </div>
                
                <div class="flex-shrink-0 ml-2">
                    ${icon}
                </div>
            </div>`;
        }).join('');

        const card = document.createElement('div');
        card.className = "glass rounded-3xl overflow-hidden relative group shadow-2xl border border-white/10 mb-6";
        card.innerHTML = `
            <!-- Background Blur -->
            <div class="absolute inset-0 z-0 pointer-events-none">
                <img src="${albumArt}" class="w-full h-full object-cover opacity-30 blur-2xl scale-110">
                <div class="absolute inset-0 bg-gradient-to-t from-[#0f0c29] via-[#0f0c29]/60 to-transparent"></div>
            </div>

            <div class="relative z-10 p-8 pb-0">
                <div class="flex gap-8 items-start">
                    <div class="w-32 h-32 rounded-2xl overflow-hidden shadow-lg border border-white/10 flex-shrink-0">
                        <img src="${albumArt}" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 min-w-0 flex flex-col h-32 justify-between">
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500 text-white shadow-[0_0_10px_rgba(236,72,153,0.5)]">BATCH</span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-300 border border-white/10 uppercase">${task.codec || 'ALAC'}</span>
                            </div>
                            <h1 class="text-4xl font-bold text-white truncate leading-tight" title="${task.album}">${task.album || task.title}</h1>
                            <p class="text-xl text-gray-300 truncate">${task.artist}</p>
                        </div>
                        <div class="flex justify-between items-end pb-2">
                            <div class="text-sm text-pink-300 font-mono animate-pulse truncate max-w-[300px]">
                                > ${songName}
                            </div>
                            <div class="text-right">
                                <div class="text-3xl font-bold leading-none">${current} <span class="text-lg text-gray-500">/ ${total}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="relative w-full h-1.5 bg-white/5 mt-6">
                <div class="absolute top-0 left-0 h-full bg-gradient-to-r from-pink-500 to-purple-500 shadow-[0_0_15px_rgba(236,72,153,0.5)] transition-all duration-500 ease-out" style="width: ${percent}%"></div>
            </div>

            <!-- Tracklist Toggle Area -->
            <div class="bg-black/20 border-t border-white/5 backdrop-blur-md">
                <div class="px-8 py-2 flex justify-between items-center cursor-pointer hover:bg-white/5 transition text-xs text-gray-400 font-bold tracking-wider uppercase toggle-btn">
                    <span>Tracklist</span>
                    <svg class="w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
                <div id="tracklist-${task.id}" class="px-4 pb-4 space-y-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 ${listClass}">
                    ${subTasksHtml || '<div class="text-center text-xs text-gray-500 py-2">Loading tracks...</div>'}
                </div>
            </div>
        `;
        
        // Attach Event
        const toggleHeader = card.querySelector('.toggle-btn');
        if(toggleHeader) {
            toggleHeader.onclick = () => {
                if (expandedBatchTasks.has(task.id)) expandedBatchTasks.delete(task.id);
                else expandedBatchTasks.add(task.id);
                
                const list = document.getElementById(`tracklist-${task.id}`);
                const icon = toggleHeader.querySelector('svg');
                if(list) list.classList.toggle('hidden');
                if(icon) icon.classList.toggle('rotate-180');
            };
        }

        container.appendChild(card);
    });
}

function renderNextUpList(tasks) {
    const container = document.getElementById('nextUpContainer');
    if (!container) return;
    
    if (tasks.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-center py-4 text-sm">Queue is empty</div>';
        return;
    }

    let html = '';
    tasks.forEach((task, index) => {
        html += `
        <div class="flex items-center gap-4 p-3 hover:bg-white/5 rounded-lg transition text-sm border-b border-white/5 last:border-0">
            <div class="w-8 text-center text-gray-500 font-mono">${index + 1}</div>
            <div class="flex-1 min-w-0">
                <div class="text-gray-200 font-medium truncate">${task.title || task.url}</div>
                <div class="text-xs text-gray-500 truncate">${task.artist || 'Unknown Artist'}</div>
            </div>
            <div class="text-xs text-gray-500 font-bold tracking-wider uppercase">PENDING</div>
        </div>`;
    });
    container.innerHTML = html;
}

function renderHistoryFailed(tasks) {
    const container = document.getElementById('historyFailedContainer');
    const section = document.getElementById('historyFailedSection');
    if (!container || !section) return;

    if (tasks.length === 0) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');

    container.innerHTML = tasks.map(task => `
        <div class="glass-card rounded-2xl overflow-hidden p-4 flex items-center gap-5 border-red-500/30 bg-red-500/5">
            <div class="w-16 h-16 rounded-lg overflow-hidden bg-black/50 flex-shrink-0 shadow-lg grayscale opacity-70">
                <img src="${task.image || 'https://music.apple.com/assets/default/album-cover.png'}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 min-w-0">
                <h3 class="text-lg font-bold text-gray-300 truncate">${task.title}</h3>
                <p class="text-red-400 text-sm truncate">Download Failed</p>
                <div class="text-[10px] text-red-400/70 mt-1 font-mono truncate">${task.progress || 'Unknown Error'}</div>
            </div>
            <div class="text-right">
                <button onclick="retryTask('${task.url}')" class="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition flex items-center gap-2">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    RETRY
                </button>
            </div>
        </div>
    `).join('');
}

function renderHistoryCompleted(tasks) {
    const container = document.getElementById('historyCompletedContainer');
    if (!container) return;

    if (tasks.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-center py-10">No history</div>';
        return;
    }

    // Group by Artist -> Album for History? Or just flat list of "Jobs"?
    // The user liked the "Card" style. A flattened list of Cards (one card per job) is cleaner.
    // If it was a batch job, show the "Album Card". If single, show "Single Card".

    container.innerHTML = tasks.map(task => {
        const isAlbum = task.sub_tasks && task.sub_tasks.length > 1;
        const trackCount = task.total_tracks || (task.sub_tasks ? task.sub_tasks.length : 1);
        
        // ALBUM CARD
        if (isAlbum) {
            return `
            <div class="glass-card rounded-2xl overflow-hidden group">
                <div class="p-4 flex items-center gap-5 cursor-pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
                    <div class="w-16 h-16 rounded-lg overflow-hidden bg-black/50 flex-shrink-0 shadow-lg">
                        <img src="${task.image || 'https://music.apple.com/assets/default/album-cover.png'}" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="text-lg font-bold text-white truncate">${task.album || task.title}</h3>
                        <p class="text-gray-400 text-sm truncate">${task.artist}</p>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-300 uppercase">${task.codec}</span>
                            <span class="text-[10px] text-gray-500">${trackCount} Tracks</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-green-400 font-bold text-sm flex items-center gap-1 justify-end">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            COMPLETED
                        </div>
                    </div>
                </div>
                <div class="bg-black/20 border-t border-white/5 p-4 hidden">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                        ${(task.sub_tasks || []).map(st => `
                            <div class="flex justify-between text-xs py-1 px-2 hover:bg-white/5 rounded group/track">
                                <div class="flex gap-3 text-gray-300">
                                    <span class="font-mono text-gray-500 w-4 text-right">${st.track_number}</span>
                                    <span>${st.title}</span>
                                </div>
                                <span class="text-green-500/50 group-hover/track:text-green-400 transition">Done</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
        } 
        // SINGLE CARD
        else {
            return `
            <div class="glass-card rounded-2xl overflow-hidden p-4 flex items-center gap-5">
                <div class="w-16 h-16 rounded-lg overflow-hidden bg-black/50 flex-shrink-0 shadow-lg">
                    <img src="${task.image || 'https://music.apple.com/assets/default/album-cover.png'}" class="w-full h-full object-cover">
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-lg font-bold text-white truncate">${task.title}</h3>
                    <p class="text-gray-400 text-sm truncate">${task.artist}</p>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-gray-300 uppercase">${task.codec}</span>
                        <span class="text-[10px] text-gray-500">Single</span>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-green-400 font-bold text-sm flex items-center gap-1 justify-end">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        COMPLETED
                    </div>
                </div>
            </div>`;
        }
    }).join('');
}

// Global retry function (attached to window for inline onclick)
window.retryTask = async (url) => {
    // Logic to retry... basically add to queue again
    // Use import from api.js if possible, or dispatch event
    // For simplicity, let's assume we can call the global handler
    if (window.handleSearchOrDownload) {
        // Hacky: Put URL in search box and trigger? No, use API directly.
        // Need to import addToQueue from api.js but this function is global context.
        // Better: emit event or import in main.js and expose.
        // For now, just re-add via fetch manually to avoid circular deps or scope issues.
        try {
            await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url, codec: 'alac' }) // default codec
            });
            updateQueue();
        } catch(e) { alert(e); }
    }
};

export function connectLogStream() {
    const ws = new WebSocket(`ws://${window.location.host}/ws/logs`);
    const consoleDiv = document.getElementById('console');
    
    ws.onmessage = function (event) {
        if (!consoleDiv) return;
        const text = event.data;
        
        // Check for update-in-place candidates
        const isProgress = text.includes("Downloading") || text.includes("Decrypting");
        const lastChild = consoleDiv.lastElementChild;
        
        if (isProgress && lastChild && (lastChild.textContent.includes("Downloading") || lastChild.textContent.includes("Decrypting"))) {
            lastChild.textContent = "> " + text;
        } else {
            const msg = document.createElement('div');
            msg.textContent = "> " + text;
            consoleDiv.appendChild(msg);
        }
        
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    };
}