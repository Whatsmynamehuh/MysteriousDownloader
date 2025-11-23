// Main Entry Point
import { handleSearchOrDownload } from './search.js';
import { updateQueue, connectLogStream, clearHistory } from './queue.js'; 
import { pollLoginStatus, handleLogin, submit2FA } from './auth.js';
import { openModal, closeModal, showConfirm, setupModalListeners } from './modals.js';
import { handleCardClick } from './cards.js';
import { loadSettings, saveSettings } from './settings.js';
import { updateParallelLimit } from './api.js';

// Expose necessary functions globally for HTML inline handlers
window.handleSearchOrDownload = handleSearchOrDownload;
window.startLogin = handleLogin; 
window.submit2FA = submit2FA;
window.openModal = openModal;
window.closeModal = closeModal;
window.saveSettings = saveSettings; 
window.updateParallelLimit = updateParallelLimit; 

// Wrapper for clearHistory to include confirmation
window.clearHistory = async () => {
    if (await showConfirm("Are you sure you want to clear the download history?")) {
        await clearHistory();
    }
};

// Global Card Click Handler (called by inline onclick if we used it there, though search.js handles it mostly)
window.onArtistCardClick = (card, url, e) => {
    handleCardClick(e, card, null); 
};

// Tab Switching
window.switchTab = (tabId) => {
    ['view-search', 'view-queue', 'view-history', 'view-settings'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    document.querySelectorAll('nav button').forEach(el => {
        el.classList.replace('text-white', 'text-gray-300'); 
        el.classList.replace('tab-active', 'tab-inactive'); 
    });
    
    const targetId = 'view-' + tabId;
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.classList.remove('hidden');
    
    const btn = document.getElementById('tab-' + tabId);
    if (btn) {
        btn.classList.replace('text-gray-300', 'text-white');
        btn.classList.replace('tab-inactive', 'tab-active');
    }

    if (tabId === 'settings') loadSettings();
    if (tabId === 'history') updateQueue(); // Refresh queue/history when switching to it
};

// Queue Refresh Event
window.addEventListener('refreshQueue', updateQueue);

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    pollLoginStatus();
    connectLogStream();
    updateQueue();
    setInterval(updateQueue, 2000);
    
    // Setup modal listeners (cancel/ok buttons)
    setupModalListeners();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearchOrDownload();
        });
    }

    // Tips Rotation
    let currentTip = 0;
    setInterval(() => {
        const tips = document.querySelectorAll('.tip-text');
        if (tips.length > 0) {
            tips[currentTip].classList.remove('tip-active');
            currentTip = (currentTip + 1) % tips.length;
            tips[currentTip].classList.add('tip-active');
        }
    }, 3000);
});
