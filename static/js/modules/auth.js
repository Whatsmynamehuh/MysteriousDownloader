import { openModal, closeModal, shakeModal } from './modals.js';

let loginPollInterval = null;

export async function pollLoginStatus() {
    if (loginPollInterval) { clearInterval(loginPollInterval); loginPollInterval = null; }
    const check = async () => {
        try {
            // Add timestamp to prevent caching
            const res = await fetch(`/api/login/status?t=${Date.now()}`);
            const data = await res.json();
            console.log("Login Status:", data);

            const dot = document.getElementById('statusDot');
            const text = document.getElementById('statusText');
            const loginForm = document.getElementById('loginForm');
            const twoFaForm = document.getElementById('2faForm');

            if (text) text.textContent = data.status.toUpperCase();
            if (dot) dot.className = 'status-dot';

            if (data.status === 'idle') {
                if (dot) dot.classList.add('status-idle');
                if (loginForm) { loginForm.classList.remove('hidden'); loginForm.style.display = 'block'; }
                if (twoFaForm) { twoFaForm.classList.add('hidden'); twoFaForm.style.display = 'none'; }
                openModal('loginModal');
            } else if (data.status === 'authenticating') {
                if (dot) dot.classList.add('status-waiting');
                // Keep current form state
            } else if (data.status === 'waiting_2fa') {
                if (dot) dot.classList.add('status-waiting');
                if (loginForm) { loginForm.classList.add('hidden'); loginForm.style.display = 'none'; }
                if (twoFaForm) { twoFaForm.classList.remove('hidden'); twoFaForm.style.display = 'block'; }
                openModal('loginModal');
            } else if (data.status === 'success') {
                if (dot) dot.classList.add('status-success');
                if (text) text.textContent = "LOGGED IN";
                closeModal('loginModal');
                if (loginPollInterval) { clearInterval(loginPollInterval); loginPollInterval = null; }
                return;
            } else if (data.status === 'failed') {
                if (dot) dot.classList.add('status-failed');
                if (loginForm) { loginForm.classList.remove('hidden'); loginForm.style.display = 'block'; }
                if (twoFaForm) { twoFaForm.classList.add('hidden'); twoFaForm.style.display = 'none'; }
                openModal('loginModal');
                shakeModal();
            }
        } catch (e) { console.error("Poll Error:", e); }
    };
    check();
    loginPollInterval = setInterval(check, 2000);
}

export async function handleLogin() {
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;
    if (!user || !pass) return shakeModal();
    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass })
        });
        if (res.ok) pollLoginStatus(); else shakeModal();
    } catch (e) { shakeModal(); }
}

export async function submit2FA() {
    const code = document.getElementById('2faCode').value;
    if (!code) return shakeModal();
    try {
        await fetch('/api/2fa', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code })
        });
    } catch (e) { shakeModal(); }
}
