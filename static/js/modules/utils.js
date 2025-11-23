// Utility Functions
import { openModal } from './modals.js';

export const state = {
    // Shared state can go here
};

export function showMessage(title, message) {
    const titleEl = document.getElementById('messageTitle');
    const bodyEl = document.getElementById('messageBody');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = message;
    openModal('messageModal');
}
