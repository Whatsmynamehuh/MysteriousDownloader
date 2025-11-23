let confirmResolve = null;

export function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('.modal-content').classList.remove('scale-95');
        }, 10);
    }
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('opacity-0');
        modal.querySelector('.modal-content').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }, 300);
    }
}

export function shakeModal() {
    const card = document.getElementById('loginCard');
    if (card) {
        card.classList.remove('shake-anim');
        void card.offsetWidth; // trigger reflow
        card.classList.add('shake-anim');
    }
}

export function showConfirm(message) {
    return new Promise((resolve) => {
        const msgEl = document.getElementById('confirmMessage');
        if (msgEl) msgEl.textContent = message;
        openModal('confirmModal');
        confirmResolve = resolve;
    });
}

// Setup listeners for the confirm modal
// We use a setup function or just run it top-level if we are sure DOM is ready or we use event delegation.
// Since modules are deferred by default in HTML, we might need to wait for DOM.
// But usually, modules are imported in main.js which waits for DOM.
// Let's export a setup function or just attach if elements exist.

export function setupModalListeners() {
    const cancelBtn = document.getElementById('confirmCancelBtn');
    const okBtn = document.getElementById('confirmOkBtn');

    if (cancelBtn) {
        cancelBtn.onclick = () => { 
            closeModal('confirmModal'); 
            if (confirmResolve) confirmResolve(false); 
        };
    }

    if (okBtn) {
        okBtn.onclick = () => { 
            closeModal('confirmModal'); 
            if (confirmResolve) confirmResolve(true); 
        };
    }
}
