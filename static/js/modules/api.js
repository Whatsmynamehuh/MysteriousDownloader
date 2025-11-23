// API & Queue Interactions
import { showMessage } from './utils.js';

// We need a way to refresh the queue that the main module or queue module can use.
// For now, we'll expose the raw API calls here, and the UI updating logic will likely live in queue.js.

export async function apiAddToQueue(data) {
    try {
        const res = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            return true;
        } else {
            alert('Failed to add to queue');
            return false;
        }
    } catch (e) {
        alert('Error: ' + e);
        return false;
    }
}

export async function apiSearch(query) {
    const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
    return await res.json();
}

export async function apiResolveArtist(url) {
    const res = await fetch(`/api/artist?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error(`Failed to load artist data: ${res.statusText}`);
    return await res.json();
}

export async function apiClearHistory() {
    return await fetch('/api/history/clear', { method: 'POST' });
}

export async function updateParallelLimit() {
    const limit = document.getElementById('parallelSelect').value;
    try {
        await fetch('/api/settings/parallel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: parseInt(limit) })
        });
    } catch (e) {
        console.error("Failed to update parallel limit", e);
    }
}

export async function addToQueue(url, title = null, artist = null, album = null, image = null, track_number = null, total_tracks = null) {
    const codecSelect = document.getElementById('codecSelect');
    const codec = codecSelect ? codecSelect.value : 'alac'; // Default fallback
    
    const body = { url, codec, title, artist, album, image, track_number, total_tracks };
    const success = await apiAddToQueue(body);
    
    if (success) {
        // Dispatch event for queue refresh
        window.dispatchEvent(new Event('refreshQueue'));
        
        const btn = document.querySelector('.btn-primary');
        if (btn) { 
            const originalText = btn.innerText; 
            btn.innerText = "ADDED!"; 
            setTimeout(() => btn.innerText = originalText, 2000); 
        }
    }
}
