// Search & Results Logic
import { apiSearch, apiResolveArtist, addToQueue } from './api.js';
import { openModal, closeModal } from './modals.js';

let selectedArtistItems = new Set();
let isSelectionMode = false;

// We need to store current artist data globally or within module scope to access it for "Download All"
// To make it accessible for the "toggleArtistItemSelection" helper which might be called from inline (if we used inline),
// but we are trying to avoid inline. We'll attach to window if necessary or keep it module scoped.
let currentArtistData = null;

export async function handleSearchOrDownload() {
    const input = document.getElementById('searchInput').value;
    if (!input) return;
    if (input.includes('music.apple.com')) {
        addToQueue(input); 
    } else {
        search(input);
    }
}

export async function search(query) {
    const resultsDiv = document.getElementById('searchResults');
    if (resultsDiv) resultsDiv.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10">Searching...</div>';
    
    try {
        const data = await apiSearch(query);
        
        resultsDiv.innerHTML = '';
        resultsDiv.className = 'flex flex-col gap-10'; // Change grid to column stack

        const hasResults = Object.values(data).some(arr => arr.length > 0);
        if (!hasResults) {
            resultsDiv.innerHTML = '<div class="text-center text-gray-400 py-10 w-full">No results found</div>';
            return;
        }

        const createSection = (title, items) => {
            if (!items || items.length === 0) return;
            
            const section = document.createElement('div');
            section.className = 'flex flex-col gap-4';
            
            const header = document.createElement('h3');
            header.className = 'text-2xl font-bold text-white border-b border-white/10 pb-2';
            header.textContent = title;
            section.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6';
            
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = "glass rounded-xl p-4 hover:bg-white/10 transition cursor-pointer group flex flex-col";
                card.onclick = () => {
                    if (item.type === 'artists') openArtistModal(item);
                    else if (item.type === 'albums') openAlbumModal(item);
                    else addToQueue(item.url, item.name, item.artist, item.album, item.image);
                };
                card.innerHTML = `
                    <div class="aspect-square rounded-lg overflow-hidden mb-3 relative shadow-lg bg-black/50">
                        <img src="${item.image}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <svg class="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                    </div>
                    <h3 class="font-bold truncate text-white text-sm mb-1" title="${item.name}">${item.name}</h3>
                    <p class="text-xs text-gray-400 truncate">${item.artist || item.type}</p>
                    <span class="text-[10px] bg-white/10 px-2 py-0.5 rounded mt-auto self-start text-gray-300 uppercase tracking-wider">${item.type}</span>
                `;
                grid.appendChild(card);
            });
            section.appendChild(grid);
            resultsDiv.appendChild(section);
        };

        createSection('Top Results', data.top);
        createSection('Songs', data.songs);
        createSection('Albums', data.albums);
        createSection('Artists', data.artists);
        createSection('Playlists', data.playlists);
        createSection('Music Videos', data.music_videos);

    } catch (e) {
        resultsDiv.innerHTML = `<div class="text-center text-red-400 py-10 w-full">Error: ${e}</div>`;
    }
}

// --- Artist Modal Logic ---

// Exporting these to window so HTML onclicks can find them (if we use onclick in innerHTML)
// However, better practice is to attach listeners.
// For now, to keep it simple with generated HTML strings, we will attach to window.
window.downloadAllArtistItems = downloadAllArtistItems;
window.downloadSelectedArtistItems = downloadSelectedArtistItems;
window.toggleSectionSelection = toggleSectionSelection;


async function openArtistModal(artistItem) {
    const modal = document.getElementById('artistModal');
    const contentDiv = document.getElementById('artistModalContent');
    
    document.getElementById('artistModalName').textContent = artistItem.name;
    const link = document.getElementById('artistModalLink');
    link.href = artistItem.url || '#';
    link.style.display = artistItem.url ? 'inline' : 'none';
    
    contentDiv.innerHTML = '<div class="text-center py-10"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div><p class="mt-4 text-gray-400">Loading discography...</p></div>';
    
    // Reset Selection
    selectedArtistItems.clear();
    isSelectionMode = false;
    updateArtistSelectionUI();
    
    openModal('artistModal');
    
    try {
        if (!artistItem.url) throw new Error("Artist URL not available.");

        const data = await apiResolveArtist(artistItem.url);
        contentDiv.innerHTML = '';

        // Header Controls
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'flex justify-end gap-3 mb-6';
        controlsDiv.innerHTML = `
            <button onclick="downloadAllArtistItems()" class="btn-primary px-6 py-2 rounded-lg text-sm shadow-lg flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Download Discography
            </button>
        `;
        contentDiv.appendChild(controlsDiv);

        currentArtistData = data;

        const createSection = (title, items) => {
            if (!items || items.length === 0) return;
            
            const section = document.createElement('div');
            section.className = 'flex flex-col gap-4 mb-8';
            
            const header = document.createElement('h3');
            header.className = 'text-xl font-bold text-white border-b border-white/10 pb-2 flex justify-between items-center';
            header.innerHTML = `
                ${title}
                <button onclick="toggleSectionSelection('${title}')" class="text-xs text-pink-400 hover:text-pink-300 font-normal">Select All</button>
            `;
            section.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'flex gap-4 overflow-x-auto pb-6 snap-x scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent px-1';
            grid.id = `section-${title.replace(/\s+/g, '-')}`;
            
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = "glass rounded-xl p-3 transition-all duration-300 cursor-pointer group flex-shrink-0 w-40 snap-start flex flex-col relative border border-transparent";
                card.dataset.id = item.url; 
                
                const imgUrl = item.image || "https://music.apple.com/assets/default/album-cover.png";                
                card.innerHTML = `
                    <div class="absolute top-2 right-2 z-50 selection-trigger p-1 rounded-full">
                        <div class="selection-ring w-6 h-6 rounded-full border-2 border-white/60 bg-black/60 flex items-center justify-center transition-colors hover:border-pink-400 hover:bg-black/80 shadow-lg backdrop-blur-sm">
                            <div class="selection-dot w-3 h-3 rounded-full bg-pink-500 opacity-0 transform scale-0 transition-all"></div>
                        </div>
                    </div>
                    <div class="aspect-square rounded-lg overflow-hidden mb-2 relative shadow-lg bg-black/50">
                        <img src="${imgUrl}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition pointer-events-none"></div>
                    </div>
                    <h3 class="font-bold truncate text-white text-xs mb-0.5" title="${item.name}">${item.name}</h3>
                    <p class="text-[10px] text-gray-400 truncate">${item.artist || 'Artist'}</p>
                    <div class="mt-auto flex justify-between items-end w-full">
                        ${item.releaseDate ? `<span class="text-[10px] text-gray-500">${item.releaseDate.substring(0, 4)}</span>` : ''}
                        ${item.trackCount ? `<span class="text-[10px] text-gray-500 bg-white/5 px-1.5 rounded">${item.trackCount} Tracks</span>` : ''}
                    </div>
                `;
                
                // Manual event listener to avoid inline onclick issues
                card.addEventListener('click', (e) => {
                    // Always toggle selection on click, regardless of where on the card is clicked
                    toggleArtistItemSelection(item, card);
                })

                grid.appendChild(card);
            });
            section.appendChild(grid);
            contentDiv.appendChild(section);
        };

        const sortByDate = (arr) => arr.sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));

        createSection('Albums', sortByDate(data.albums));
        createSection('EPs', sortByDate(data.eps));
        createSection('Singles', sortByDate(data.singles));
        createSection('Compilations', sortByDate(data.compilations));
        createSection('Music Videos', sortByDate(data.music_videos));

        if (contentDiv.children.length <= 1) { 
             contentDiv.innerHTML += '<div class="text-center text-gray-500 py-10">No content found for this artist.</div>';
        }

        const fab = document.createElement('div');
        fab.id = 'artist-fab';
        fab.className = 'absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4 translate-y-20 transition-transform duration-300 z-50';
        fab.innerHTML = `
            <span class="text-sm font-bold text-white"><span id="selected-count">0</span> Selected</span>
            <button onclick="downloadSelectedArtistItems()" class="btn-primary px-6 py-2 rounded-lg text-xs font-bold">DOWNLOAD</button>
        `;
        document.querySelector('#artistModal .modal-content').appendChild(fab);

    } catch (e) {
        console.error(e);
        contentDiv.innerHTML = `<div class="text-center text-red-400 py-10">Error: ${e.message}</div>`;
    }
}

function toggleArtistItemSelection(item, cardElement) {
    const id = item.url;
    const ring = cardElement.querySelector('.selection-ring');
    const dot = cardElement.querySelector('.selection-dot');
    
    if (selectedArtistItems.has(id)) {
        selectedArtistItems.delete(id);
        cardElement.classList.remove('ring-2', 'ring-pink-500', 'shadow-[0_0_15px_rgba(236,72,153,0.3)]', 'bg-white/5');
        ring.classList.replace('border-pink-500', 'border-white/50');
        dot.classList.add('opacity-0', 'scale-0');
        
        if (currentArtistData.selected) {
            currentArtistData.selected = currentArtistData.selected.filter(i => i.url !== id);
        }
    } else {
        selectedArtistItems.add(id);
        cardElement.classList.add('ring-2', 'ring-pink-500', 'shadow-[0_0_15px_rgba(236,72,153,0.3)]', 'bg-white/5');
        ring.classList.replace('border-white/50', 'border-pink-500');
        dot.classList.remove('opacity-0', 'scale-0');
        
        if (!currentArtistData.selected) currentArtistData.selected = [];
        currentArtistData.selected.push(item);
    }
    
    updateArtistSelectionUI();
}

function updateArtistSelectionUI() {
    const fab = document.getElementById('artist-fab');
    const countSpan = document.getElementById('selected-count');
    
    if (fab && countSpan) {
        const count = selectedArtistItems.size;
        countSpan.textContent = count;
        
        if (count > 0) {
            fab.classList.remove('translate-y-20');
        } else {
            fab.classList.add('translate-y-20');
        }
    }
}

function toggleSectionSelection(title) {
    const sectionId = `section-${title.replace(/\s+/g, '-')}`;
    const grid = document.getElementById(sectionId);
    if (!grid) return;
    
    const cards = grid.children;
    let allSelected = true;
    
    for (let card of cards) {
        if (!selectedArtistItems.has(card.dataset.id)) {
            allSelected = false;
            break;
        }
    }
    
    for (let card of cards) {
        const isSelected = selectedArtistItems.has(card.dataset.id);
        if (allSelected && isSelected) card.click(); 
        if (!allSelected && !isSelected) card.click(); 
    }
}

function downloadAllArtistItems() {
    if (!currentArtistData) return;
    
    const allItems = [
        ...currentArtistData.albums,
        ...currentArtistData.eps,
        ...currentArtistData.singles,
        ...currentArtistData.compilations,
        ...currentArtistData.music_videos
    ];
    
    if (allItems.length === 0) return;
    
    if (confirm(`Add all ${allItems.length} items to queue?`)) {
        allItems.forEach(item => addToQueue(item.url, item.name, item.artist, item.album, item.image, item.trackNumber, item.trackCount));
        closeModal('artistModal');
    }
}

function downloadSelectedArtistItems() {
    if (!currentArtistData || !currentArtistData.selected) return;
    
    const items = currentArtistData.selected;
    items.forEach(item => {
        // If the item itself is an album/EP/single, its NAME is the album name.
        // If it's a song, it usually has an 'album' property.
        const albumName = (item.type === 'albums' || item.type === 'eps' || item.type === 'singles') ? item.name : item.album;
        
        addToQueue(item.url, item.name, item.artist, albumName, item.image, item.trackNumber, item.trackCount);
    });
    
    selectedArtistItems.clear();
    updateArtistSelectionUI();
    currentArtistData.selected = [];
    
    const btn = document.querySelector('#artist-fab button');
    btn.textContent = "ADDED!";
    setTimeout(() => {
        closeModal('artistModal');
    }, 1000);
}

function openAlbumModal(item) {
    // For now, just add to queue directly. 
    addToQueue(item.url, item.name, item.artist, item.album, item.image, item.trackNumber, item.trackCount);
}
