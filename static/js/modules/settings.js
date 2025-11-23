// Settings Logic
import { showMessage } from './utils.js';

let storefrontData = null;

// We use string concatenation to avoid nested backtick hell in the template literal
const TOKEN_SCRIPT = `
(async () => {
    try {
        const instance = window.MusicKit?.getInstance();
        if (!instance) throw new Error('MusicKit not found. Are you logged in?');
        
        const userToken = instance.musicUserToken;
        const authToken = instance.developerToken;

        if (!userToken) throw new Error('Media User Token is empty. Please sign in to Apple Music.');
        if (!authToken) throw new Error('Authorization Token is empty. Refresh the page and try again.');
        
        const copyToClipboard = (text, btn) => {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(() => {
                    btn.innerText = 'COPIED';
                    setTimeout(() => btn.innerText = 'COPY', 2000);
                }).catch(err => {
                    console.error('Async: Could not copy text: ', err);
                    fallbackCopy(text, btn);
                });
            } else {
                fallbackCopy(text, btn);
            }
        };

        const fallbackCopy = (text, btn) => {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";  
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    btn.innerText = 'COPIED';
                    setTimeout(() => btn.innerText = 'COPY', 2000);
                } else {
                    btn.innerText = 'FAILED';
                    console.error('Fallback: Copying text command was unsuccessful');
                }
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
                btn.innerText = 'ERROR';
            }
            document.body.removeChild(textArea);
        };

        const div = document.createElement('div');
        div.id = 'amd-token-popup';
        div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;backdrop-filter:blur(5px);';
        
        const cardStyle = 'background:#1a1a1a;padding:30px;border-radius:20px;color:white;max-width:500px;width:90%;box-shadow:0 20px 50px rgba(0,0,0,0.5);border:1px solid #333;';
        
        div.innerHTML = '<div style="' + cardStyle + '">' + 
            '<h2 style="margin:0 0 20px;color:white;font-size:24px;">AMD Tokens</h2>' + 
            '<div style="margin-bottom:20px;">' + 
                '<label style="display:block;font-size:12px;color:#888;margin-bottom:8px;font-weight:600;">Media User Token</label>' + 
                '<div style="display:flex;gap:10px;">' + 
                    '<input type="text" value="' + userToken + '" readonly style="flex:1;background:#2a2a2a;border:1px solid #333;padding:12px;color:#ddd;border-radius:8px;outline:none;">' + 
                    '<button id="btn-copy-user" style="background:#fa2d48;border:none;color:white;padding:0 20px;border-radius:8px;cursor:pointer;font-weight:bold;">COPY</button>' + 
                '</div>' + 
            '</div>' + 
            '<div style="margin-bottom:20px;">' + 
                '<label style="display:block;font-size:12px;color:#888;margin-bottom:8px;font-weight:600;">Authorization Token</label>' + 
                '<div style="display:flex;gap:10px;">' + 
                    '<input type="text" value="' + authToken + '" readonly style="flex:1;background:#2a2a2a;border:1px solid #333;padding:12px;color:#ddd;border-radius:8px;outline:none;">' + 
                    '<button id="btn-copy-auth" style="background:#fa2d48;border:none;color:white;padding:0 20px;border-radius:8px;cursor:pointer;font-weight:bold;">COPY</button>' + 
                '</div>' + 
            '</div>' + 
            '<button id="amd-close-btn" style="width:100%;padding:15px;background:transparent;border:1px solid #444;color:#888;border-radius:10px;cursor:pointer;font-weight:600;">CLOSE</button>' + 
        '</div>';
        
        const existing = document.getElementById('amd-token-popup');
        if (existing) existing.remove();

        document.body.appendChild(div);
        
        document.getElementById('btn-copy-user').onclick = (e) => copyToClipboard(userToken, e.target);
        document.getElementById('btn-copy-auth').onclick = (e) => copyToClipboard(authToken, e.target);
        document.getElementById('amd-close-btn').onclick = () => div.remove();
        
    } catch (e) {
        console.error('AMD Token Error:', e);
        if (!e.message.includes('lyrics') && !e.message.includes('MEDIA_DESCRIPTOR')) {
            alert('Error: ' + e.message);
        }
    }
})();
`;

async function loadStorefrontData() {
    if (storefrontData) return;
    try {
        const res = await fetch('/static/data/storefronts.json');
        const json = await res.json();
        storefrontData = json.data || json;
    } catch (e) {
        console.error("Failed to load storefronts.json", e);
    }
}

export async function loadSettings() {
    try {
        await loadStorefrontData();
        const res = await fetch('/api/settings');
        const config = await res.json();
        console.log("Loaded Config:", config);

        const form = document.getElementById('settingsForm');
        if (!form) return;
        form.innerHTML = '';

        const createField = (key, value, label, type = 'text', options = [], description = null) => {
            const div = document.createElement('div');
            let inputHtml = '';

            if (type === 'boolean') {
                inputHtml = `
                    <select data-key="${key}" class="glass-input w-full rounded-lg px-4 py-2 text-white bg-black/50">
                        <option value="true" ${value === true ? 'selected' : ''}>True</option>
                        <option value="false" ${value === false ? 'selected' : ''}>False</option>
                    </select>
                `;
            } else if (type === 'select') {
                const opts = options.map(o => `<option value="${o}" ${value === o ? 'selected' : ''}>${o}</option>`).join('');
                inputHtml = `
                    <select data-key="${key}" class="glass-input w-full rounded-lg px-4 py-2 text-white bg-black/50">
                        ${opts}
                    </select>
                `;
            } else {
                inputHtml = `<input type="text" data-key="${key}" value="${value !== undefined && value !== null ? value : ''}" class="glass-input w-full rounded-lg px-4 py-2">`;
            }

            let descHtml = '';
            if (description) {
                descHtml = `<p class="text-xs text-gray-500 mt-1 font-mono whitespace-pre-wrap">${description}</p>`;
            }

            div.innerHTML = `
                <label class="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">${label || key}</label>
                ${inputHtml}
                ${descHtml}
            `;
            return div;
        };

        const createSection = (title) => {
            const h3 = document.createElement('h3');
            h3.className = "text-xl font-bold text-white mt-8 mb-4 pb-2 border-b border-white/10";
            h3.textContent = title;
            form.appendChild(h3);
        }

        createSection("Authentication & Region");
        
        const tokenHelpDiv = document.createElement('div');
        tokenHelpDiv.className = "mb-6 p-4 rounded-xl bg-white/5 border border-white/10";
        tokenHelpDiv.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <h4 class="font-bold text-white text-sm">Need Tokens?</h4>
                    <p class="text-xs text-gray-400 mt-1">Copy this script, paste it into the Console (F12) on music.apple.com</p>
                </div>
                <button id="copy-token-script-btn" class="btn-secondary px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-white/20 transition">
                    COPY SCRIPT
                </button>
            </div>
        `;
        form.appendChild(tokenHelpDiv);
        
        const copyBtn = tokenHelpDiv.querySelector('#copy-token-script-btn');
        if (copyBtn) copyBtn.onclick = copyTokenScript;

        form.appendChild(createField('media-user-token', config['media-user-token'], 'Media User Token'));
        form.appendChild(createField('authorization-token', config['authorization-token'], 'Authorization Token'));
        
        if (storefrontData) {
            storefrontData.sort((a, b) => a.attributes.name.localeCompare(b.attributes.name));

            const sfDiv = document.createElement('div');
            const sfOptions = storefrontData.map(s => 
                `<option value="${s.id}" ${config['storefront'] === s.id ? 'selected' : ''}>${s.attributes.name} (${s.id})</option>`
            ).join('');
            
            sfDiv.innerHTML = `
                <label class="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Storefront (Region)</label>
                <select data-key="storefront" id="storefrontSelect" class="glass-input w-full rounded-lg px-4 py-2 text-white bg-black/50">
                    <option value="" disabled ${!config['storefront'] ? 'selected' : ''}>Select Region...</option>
                    ${sfOptions}
                </select>
            `;
            form.appendChild(sfDiv);

            const langDiv = document.createElement('div');
            langDiv.innerHTML = `
                <label class="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Language</label>
                <select data-key="language" id="languageSelect" class="glass-input w-full rounded-lg px-4 py-2 text-white bg-black/50">
                    <option value="" disabled selected>Select Language...</option>
                </select>
            `;
            form.appendChild(langDiv);

            const sfSelect = sfDiv.querySelector('select');
            const langSelect = langDiv.querySelector('select');

            const updateLangOptions = (sfId, selectedLang) => {
                langSelect.innerHTML = '';
                const sf = storefrontData.find(s => s.id === sfId);
                if (sf && sf.attributes && sf.attributes.supportedLanguageTags) {
                    sf.attributes.supportedLanguageTags.forEach(tag => {
                        const opt = document.createElement('option');
                        opt.value = tag;
                        opt.textContent = tag;
                        if (tag === selectedLang) opt.selected = true;
                        langSelect.appendChild(opt);
                    });
                    if (!selectedLang || !sf.attributes.supportedLanguageTags.includes(selectedLang)) {
                         if (sf.attributes.defaultLanguageTag) {
                             langSelect.value = sf.attributes.defaultLanguageTag;
                         }
                    }
                } else {
                     langSelect.innerHTML = '<option value="" disabled>No languages found</option>';
                }
            };

            if (sfSelect.value) {
                updateLangOptions(sfSelect.value, config['language']);
            }

            sfSelect.addEventListener('change', (e) => {
                updateLangOptions(e.target.value, null);
            });

        } else {
            form.appendChild(createField('storefront', config['storefront'], 'Storefront (e.g. us, jp, uk)'));
            form.appendChild(createField('language', config['language'], 'Language'));
        }

        createSection("Download Settings");
        form.appendChild(createField('alac-save-folder', config['alac-save-folder'], 'ALAC Save Folder'));
        form.appendChild(createField('atmos-save-folder', config['atmos-save-folder'], 'Atmos Save Folder'));
        form.appendChild(createField('aac-save-folder', config['aac-save-folder'], 'AAC Save Folder'));
        form.appendChild(createField('max-memory-limit', config['max-memory-limit'], 'Max Memory Limit (MB)'));
        form.appendChild(createField('limit-max', config['limit-max'], 'Max Download Limit'));
        form.appendChild(createField('parallel-downloads', config['parallel-downloads'], 'Parallel Downloads'));

        createSection("Audio Quality");
        form.appendChild(createField('preferred-quality', config['preferred-quality'], 'Preferred Quality', 'select', ['ALAC', 'AAC', 'Atmos']));
        form.appendChild(createField('alac-max', config['alac-max'], 'ALAC Max Sample Rate', 'select', ['192000', '96000', '48000', '44100']));
        form.appendChild(createField('atmos-max', config['atmos-max'], 'Atmos Max', 'select', ['2768', '2448']));
        form.appendChild(createField('aac-type', config['aac-type'], 'AAC Type', 'select', ['aac-lc', 'aac', 'aac-binaural', 'aac-downmix']));

        createSection("Lyrics & Metadata");
        form.appendChild(createField('lrc-type', config['lrc-type'], 'Lyrics Type', 'select', ['lyrics', 'syllable-lyrics']));
        form.appendChild(createField('lrc-format', config['lrc-format'], 'Lyrics Format', 'select', ['lrc', 'ttml']));
        form.appendChild(createField('embed-lrc', config['embed-lrc'], 'Embed Lyrics', 'boolean'));
        form.appendChild(createField('save-lrc-file', config['save-lrc-file'], 'Save Lyrics File', 'boolean'));
        form.appendChild(createField('embed-cover', config['embed-cover'], 'Embed Cover', 'boolean'));
        form.appendChild(createField('cover-format', config['cover-format'], 'Cover Format', 'select', ['jpg', 'png', 'original']));
        form.appendChild(createField('cover-size', config['cover-size'], 'Cover Size'));

        createSection("Naming Formats");
        form.appendChild(createField('album-folder-format', config['album-folder-format'], 'Album Folder Format', 'text', [], 
            '{AlbumId} {AlbumName} {ArtistName} {ReleaseDate} {ReleaseYear} {UPC} {Copyright} {Quality} {Codec} {Tag} {RecordLabel}\nExample: {ReleaseYear} - {ArtistName} - {AlbumName}({AlbumId})({UPC})({Copyright}){Codec}'));
        form.appendChild(createField('playlist-folder-format', config['playlist-folder-format'], 'Playlist Folder Format', 'text', [], 
            '{PlaylistId} {PlaylistName} {ArtistName} {Quality} {Codec} {Tag}'));
        form.appendChild(createField('song-file-format', config['song-file-format'], 'Song File Format', 'text', [], 
            '{SongId} {SongNumer} {SongName} {DiscNumber} {TrackNumber} {Quality} {Codec} {Tag}\nExample: Disk {DiscNumber} - Track {TrackNumber} {SongName} [{Quality}]{{Tag}}'));
        form.appendChild(createField('artist-folder-format', config['artist-folder-format'], 'Artist Folder Format', 'text', [], 
            '{ArtistId} {ArtistName}/{UrlArtistName}\nIf set "", will not make artist folder'));

        createSection("Advanced / Other");
        form.appendChild(createField('decrypt-m3u8-port', config['decrypt-m3u8-port'], 'Decrypt Port'));
        form.appendChild(createField('get-m3u8-port', config['get-m3u8-port'], 'Get M3U8 Port'));
        form.appendChild(createField('get-m3u8-mode', config['get-m3u8-mode'], 'Get M3U8 Mode'));
        form.appendChild(createField('ffmpeg-path', config['ffmpeg-path'], 'FFmpeg Path'));

        const btnDiv = document.createElement('div');
        btnDiv.className = "mt-10 pt-6 border-t border-white/10 flex justify-end";
        btnDiv.innerHTML = `<button onclick="window.saveSettings()" class="btn-primary px-8 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition">SAVE SETTINGS</button>`;
        form.appendChild(btnDiv);

    } catch (e) {
        console.error("Load Settings Error:", e);
        const form = document.getElementById('settingsForm');
        if (form) form.innerHTML = `<div class="text-center text-red-400 py-10">Failed to load settings: ${e.message}</div>`;
    }
}

export async function saveSettings() {
    const inputs = document.querySelectorAll('#settingsForm [data-key]');
    const updates = {};

    inputs.forEach(input => {
        const key = input.dataset.key;
        let value = input.value;

        if (input.tagName === 'SELECT' && (value === 'true' || value === 'false')) {
            value = value === 'true';
        } else if (!isNaN(value) && value !== '' && key !== 'cover-size' && !key.includes('format') && !key.includes('token') && !key.includes('path')) {
            if (!value.includes(':') && !value.includes('x')) {
                value = Number(value);
            }
        }
        updates[key] = value;
    });

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (res.ok) {
            showMessage('Settings Saved', 'Your configuration has been updated.');
        } else {
            showMessage('Error', 'Failed to save settings.');
        }
    } catch (e) {
        showMessage('Error', 'Failed to save settings: ' + e);
    }
}

export function copyTokenScript() {
    const copyFallback = () => {
        const textArea = document.createElement("textarea");
        textArea.value = TOKEN_SCRIPT;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showMessage('Script Copied!', '1. Go to music.apple.com\n2. Open Console (F12)\n3. Paste & Enter\n4. Copy tokens back here.');
        } catch (err) {
            console.error('Fallback copy failed', err);
            showMessage('Error', 'Failed to copy script manually.');
        }
        document.body.removeChild(textArea);
    };

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(TOKEN_SCRIPT).then(() => {
            showMessage('Script Copied!', '1. Go to music.apple.com\n2. Open Console (F12)\n3. Paste & Enter\n4. Copy tokens back here.');
        }).catch(err => {
            console.error('Clipboard API failed', err);
            copyFallback();
        });
    } else {
        copyFallback();
    }
}