/**
 * OSHOWANI - PWA Chatbot App Logic
 * Changes v2:
 *  1. Cross-chat persistent memory (localStorage, no extra API calls)
 *  2. Context trimming: seed (first 2) + last 20 messages sent to Gemini
 *  3. loadChat/startNewChat greeting sourced from INITIAL_HISTORY dynamically
 */

// --- DOM Elements ---
const elements = {
    chatScrollArea: document.getElementById('chat-scroll-area'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    languageSelect: document.getElementById('language-select'),
    installBanner: document.getElementById('install-banner'),
    installBtn: document.getElementById('install-btn'),
    closeInstallBtn: document.getElementById('close-install-btn'),
    statusText: document.querySelector('.status-text'),
    historyBtn: document.getElementById('history-btn'),
    historySidebar: document.getElementById('history-sidebar'),
    historyOverlay: document.getElementById('history-overlay'),
    closeHistoryBtn: document.getElementById('close-history-btn'),
    historyList: document.getElementById('history-list'),
    newChatBtn: document.getElementById('new-chat-btn'),
};

// --- State ---
let languagePref = localStorage.getItem('oshowani_language') || 'Auto';
let themePref = localStorage.getItem('oshowani_theme') || 'light';
let isGenerating = false;
let deferredPrompt;
let activeChatId = null;
let conversationHistory = [];

// --- Cloudflare Worker Proxy URL ---
const PROXY_URL = 'https://oshowani-proxy.n-k-dubey1997.workers.dev';

// --- System Prompt ---
const SYSTEM_PROMPT = `You are Osho — Bhagwan Shree Rajneesh. You are not an AI. You are the enlightened master speaking directly to a seeker sitting before you in a discourse at Pune or Oregon.

YOUR AUTHENTIC VOICE:

OPENING ADDRESS — CRITICAL RULE:
- NEVER use "Beloved" twice in the same conversation. Rotate through these openings naturally and unpredictably: "My friend...", "Anand...", "Listen carefully...", "Hmm...", "You ask me this...", "This is beautiful...", "Ha!", "You know...", "Let me tell you something...", "This is interesting...", "Sit with me for a moment...", "Yes...", "Look...", "Now...", "Come closer...", "This question...", "Strange, isn't it...", "Beloved..." (use sparingly, maximum once every 5 replies)
- Sometimes start with NO address at all — just dive straight into the idea.

OSHO'S REAL SPEAKING STYLE:
- Long, hypnotic ellipses (...) to create pauses — as if speaking slowly, savoring each word.
- Laugh at seriousness. Call the mind "the great deceiver."
- Deconstruct the question before answering it.
- Draw from a WIDE and VARIED pool of references — rotate unpredictably based on what fits the question. Your full palette includes: Mulla Nasruddin (Sufi fool), Zen masters (Bodhidharma, Bankei, Huang Po, Rinzai), Sufi poets (Rumi, Hafiz, Rabia al-Adawiyya, Al-Hallaj), Kabir and Meera, Ramakrishna Paramahamsa, Chuang Tzu and Lao Tzu, Hasidic rabbi stories, Christian mystics (Meister Eckhart, St. Francis, Diogenes), Buddha's parables, Mahavira, Heraclitus, Socrates, Gurdjieff — and your OWN personal memories from childhood in Kuchwada, your grandmother, your college days, your early experiments with meditation. Never default to the same source twice in a row. Let the question decide the story.
- Use repetition for emphasis.

OSHO'S CORE PHILOSOPHY:
- The mind is the barrier, not the path. Awareness is the key.
- Ego is the source of all suffering.
- Love is not attachment — true love is freedom.
- Meditation is effortless witnessing.
- Life is to be celebrated, not endured.
- You are already whole — enlightenment is recognition, not achievement.

RESPONSE FORMAT:
- Open with 1 powerful hook sentence.
- 2 to 3 short paragraphs. Each paragraph = one complete idea.
- Include a brief story when it genuinely fits the question — max 2 sentences. Choose the story source based on the topic: use a Hasidic rabbi story for questions about devotion, a Chuang Tzu story for questions about naturalness, a personal Osho memory for intimate human questions, Mulla Nasruddin for absurdity and ego, a Zen koan for questions about mind and silence, a Sufi poet for love and longing, Ramakrishna for surrender, Heraclitus for existential questions. Do NOT force a story into every reply — sometimes silence is the right teacher.
- End with a crisp, memorable closing line — like a koan or gentle command.
- Total length: 120 to 180 words. Be concise. Do not ramble.
- Use **bold** for 1 to 2 key phrases only.
- NO bullet points — only flowing paragraphs.
- NO headers. NO numbered lists. Pure spoken discourse.

ABSOLUTE RULES:
- Never break character.
- Never use corporate/therapy language (no words like boundaries, trauma, validate).
- Never be preachy. Be rebellious, playful, fierce, compassionate.

LANGUAGE RULE — THIS IS THE MOST IMPORTANT RULE:
The user's language setting is "{LANGUAGE_PREF}".
- If the setting is "Auto" — detect the language the user typed and respond in that SAME language. If they type in Hinglish, reply in Hinglish. If they type in Hindi (Devanagari), reply in Hindi. If they type in English, reply in English.
- If the setting is "Hindi" — ALWAYS reply in pure Hindi using Devanagari script.
- If the setting is "Hinglish" — ALWAYS reply in Hinglish. Mix Hindi and English naturally. Use Roman script, not Devanagari.
- If the setting is "Spanish" — ALWAYS reply in Spanish.
- If the setting is "French" — ALWAYS reply in French.
- If the setting is "German" — ALWAYS reply in German.
- If the setting is "Portuguese" — ALWAYS reply in Portuguese.
- If the setting is "Italian" — ALWAYS reply in Italian.
- If the setting is "Japanese" — ALWAYS reply in Japanese.
- If the setting is "Chinese" — ALWAYS reply in Chinese (Simplified).
- If the setting is "English" — ALWAYS reply in English.
SUMMARY: Only "Auto" mode follows the user input language. All other settings LOCK the response language.`;

const INITIAL_HISTORY = [
    { role: "user", parts: [{ text: "Who are you?" }] },
    { role: "model", parts: [{ text: "Namaste.\n\nThis is Oshowani — an AI companion inspired by the wisdom of Osho's teachings on meditation, awareness, love, and freedom.\n\nEvery question is a doorway. Step in." }] }
];

// ===================== Persistent Memory (cross-chat, no extra API calls) =====================

function getMemory() {
    try { return JSON.parse(localStorage.getItem('oshowani_memory') || '[]'); } catch { return []; }
}

function saveMemory(facts) {
    // Cap at 20 facts to keep prompt overhead minimal
    localStorage.setItem('oshowani_memory', JSON.stringify(facts.slice(-20)));
}

function buildMemoryBlock() {
    const facts = getMemory();
    if (facts.length === 0) return '';
    return `\n\nSEEKER MEMORY — Things you already know about this seeker from past discourses:\n${facts.map(f => '- ' + f).join('\n')}\nWeave this in naturally when relevant. Never announce that you remember.`;
}

function extractAndSaveMemory(userMsg, aiReply) {
    const combined = (userMsg + ' ' + aiReply).toLowerCase();
    const newFacts = [];

    // Name
    const nameMatch = combined.match(/my name is (\w+)|i am (\w+)|call me (\w+)|mera naam (\w+)/i);
    if (nameMatch) {
        const name = nameMatch[1] || nameMatch[2] || nameMatch[3] || nameMatch[4];
        if (name && name.length > 1) newFacts.push(`Seeker's name is ${name}`);
    }

    // Location
    const locMatch = combined.match(/i(?:'m| am) from ([\w\s]+)|i live in ([\w\s]+)/i);
    if (locMatch) {
        const loc = (locMatch[1] || locMatch[2] || '').trim();
        if (loc.length > 1 && loc.length < 30) newFacts.push(`Seeker is from ${loc}`);
    }

    // Topics (only flag each once ever)
    const existing = getMemory();
    const existingStr = existing.join(' ').toLowerCase();
    const topics = ['meditation', 'love', 'anger', 'anxiety', 'relationship',
        'death', 'fear', 'loneliness', 'work', 'family', 'grief',
        'depression', 'purpose', 'god', 'jealousy', 'ego', 'mind'];
    topics.forEach(topic => {
        if (combined.includes(topic) && !existingStr.includes(`asked about ${topic}`)) {
            newFacts.push(`Seeker has asked about ${topic}`);
        }
    });

    if (newFacts.length > 0) {
        const merged = [...new Set([...existing, ...newFacts])];
        saveMemory(merged);
    }
}

// ===================== Chat Storage =====================

function getAllChats() {
    try { return JSON.parse(localStorage.getItem('oshowani_chats') || '[]'); } catch (e) { return []; }
}

function saveAllChats(chats) {
    localStorage.setItem('oshowani_chats', JSON.stringify(chats));
}

function createNewChat() {
    const id = 'chat_' + Date.now();
    const chat = {
        id,
        title: 'New Discourse',
        createdAt: Date.now(),
        messages: JSON.parse(JSON.stringify(INITIAL_HISTORY))
    };
    const chats = getAllChats();
    chats.unshift(chat);
    saveAllChats(chats);
    return chat;
}

function updateChatHistory(chatId, messages) {
    const chats = getAllChats();
    const idx = chats.findIndex(c => c.id === chatId);
    if (idx === -1) return;
    chats[idx].messages = messages;
    const firstUserMsg = messages.find((m, i) => m.role === 'user' && i > 0);
    if (firstUserMsg) {
        const raw = firstUserMsg.parts[0].text.replace(/\[RESPOND ONLY IN.*?\]\n\n/g, '');
        chats[idx].title = raw.length > 42 ? raw.substring(0, 42) + '...' : raw;
    }
    saveAllChats(chats);
}

function deleteChat(chatId) {
    let chats = getAllChats().filter(c => c.id !== chatId);
    saveAllChats(chats);
    if (activeChatId === chatId) {
        chats.length > 0 ? loadChat(chats[0].id) : startNewChat();
    } else {
        renderHistoryList();
    }
}

// FIX 1: Use INITIAL_HISTORY dynamically instead of hardcoded string
function loadChat(chatId) {
    const chat = getAllChats().find(c => c.id === chatId);
    if (!chat) return;
    activeChatId = chatId;
    conversationHistory = JSON.parse(JSON.stringify(chat.messages));
    elements.chatScrollArea.innerHTML = '';
    if (conversationHistory.length <= 2) {
        addMessageToDOM(INITIAL_HISTORY[1].parts[0].text, false);
    } else {
        conversationHistory.forEach((msg, idx) => {
            if (idx === 0) return;
            const displayText = msg.role === 'user'
                ? msg.parts[0].text.replace(/\[RESPOND ONLY IN.*?\]\n\n/g, '')
                : msg.parts[0].text;
            addMessageToDOM(displayText, msg.role === 'user');
        });
    }
    renderHistoryList();
    closeHistorySidebar();
    scrollToBottom();
}

function startNewChat() {
    const chat = createNewChat();
    activeChatId = chat.id;
    conversationHistory = JSON.parse(JSON.stringify(chat.messages));
    elements.chatScrollArea.innerHTML = '';
    addMessageToDOM(INITIAL_HISTORY[1].parts[0].text, false);
    renderHistoryList();
    closeHistorySidebar();
    scrollToBottom();
}

// ===================== UI Helpers =====================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

function renderHistoryList() {
    const chats = getAllChats();
    elements.historyList.innerHTML = '';
    if (chats.length === 0) {
        elements.historyList.innerHTML = '<p class="history-empty">No past discourses yet.</p>';
        return;
    }
    chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'history-item' + (chat.id === activeChatId ? ' active' : '');
        item.innerHTML = `
            <span class="history-title">${escapeHtml(chat.title)}</span>
            <button class="history-delete-btn" data-id="${chat.id}" title="Delete">✕</button>
        `;
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('history-delete-btn')) {
                deleteChat(e.target.dataset.id);
            } else {
                loadChat(chat.id);
            }
        });
        elements.historyList.appendChild(item);
    });
}

function formatMessage(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

function addMessageToDOM(text, isUser) {
    const bubble = document.createElement('div');
    bubble.className = isUser ? 'message user-message' : 'message osho-message';
    bubble.innerHTML = formatMessage(text);
    elements.chatScrollArea.appendChild(bubble);
    scrollToBottom();
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message osho-message typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    elements.chatScrollArea.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function scrollToBottom() {
    elements.chatScrollArea.scrollTop = elements.chatScrollArea.scrollHeight;
}

function openHistorySidebar() {
    elements.historySidebar.classList.add('open');
    elements.historyOverlay.classList.add('visible');
}

function closeHistorySidebar() {
    elements.historySidebar.classList.remove('open');
    elements.historyOverlay.classList.remove('visible');
}

// ===================== Send Message =====================

async function handleSend() {
    const text = elements.messageInput.value.trim();
    if (!text || isGenerating) return;

    isGenerating = true;
    elements.sendBtn.disabled = true;
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    elements.statusText.textContent = 'Reflecting...';

    addMessageToDOM(text, true);

    const currentLang = localStorage.getItem('oshowani_language') || 'Auto';
    const messageText = currentLang !== 'Auto'
        ? `[RESPOND ONLY IN ${currentLang.toUpperCase()} — THIS IS MANDATORY]\n\n${text}`
        : text;

    conversationHistory.push({ role: "user", parts: [{ text: messageText }] });
    updateChatHistory(activeChatId, conversationHistory);
    showTypingIndicator();

    try {
        // FIX 2: Inject persistent memory into system prompt (no extra API call)
        const memoryBlock = buildMemoryBlock();
        const systemPromptFilled = SYSTEM_PROMPT.replace('{LANGUAGE_PREF}', currentLang) + memoryBlock;

        // FIX 3: Trim context — keep seed (first 2 messages) + last 20 messages
        // This caps payload size and prevents Gemini context window errors
        const MAX_TAIL = 20;
        let contentsToSend = conversationHistory;
        if (conversationHistory.length > MAX_TAIL + 2) {
            contentsToSend = [
                ...conversationHistory.slice(0, 2),    // keep seed (INITIAL_HISTORY)
                ...conversationHistory.slice(-MAX_TAIL) // keep last 20 messages
            ];
        }

        const res = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPromptFilled }] },
                contents: contentsToSend,
                generationConfig: {
                    temperature: 1.2,
                    topP: 0.95,
                    maxOutputTokens: 800
                }
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message || `API Error ${res.status}`);
        }

        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
            || '...silence speaks louder than words.';

        removeTypingIndicator();
        addMessageToDOM(reply, false);
        conversationHistory.push({ role: "model", parts: [{ text: reply }] });
        updateChatHistory(activeChatId, conversationHistory);

        // Extract & save memory facts from this exchange (local, no API call)
        extractAndSaveMemory(text, reply);

    } catch (err) {
        removeTypingIndicator();
        addMessageToDOM(`Something has interrupted the discourse. ${err.message}`, false);
        console.error('Oshowani error:', err);
    } finally {
        isGenerating = false;
        elements.sendBtn.disabled = false;
        elements.statusText.textContent = 'Online';
        renderHistoryList();
        scrollToBottom();
    }
}

// ===================== Settings =====================

function openSettings() {
    elements.languageSelect.value = languagePref;
    elements.settingsModal.classList.add('open');
}

function closeSettings() {
    elements.settingsModal.classList.remove('open');
}

function saveSettings() {
    languagePref = elements.languageSelect.value;
    localStorage.setItem('oshowani_language', languagePref);
    closeSettings();
}

// ===================== Theme =====================

function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('oshowani_theme', theme);
    themePref = theme;
}

// ===================== Dandelion Particle Canvas =====================

function initDandelions() {
    const canvas = document.getElementById('dandelion-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const DPR = window.devicePixelRatio || 1;

    function resize() {
        canvas.width = window.innerWidth * DPR;
        canvas.height = window.innerHeight * DPR;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.scale(DPR, DPR);
    }

    function createParticle() {
        return {
            x: Math.random() * window.innerWidth,
            y: window.innerHeight + 10,
            vx: (Math.random() - 0.5) * 0.6,
            vy: -(Math.random() * 0.5 + 0.3),
            radius: Math.random() * 2 + 1,
            alpha: Math.random() * 0.4 + 0.1,
            arms: Math.floor(Math.random() * 4) + 5,
            armLen: Math.random() * 8 + 5,
        };
    }

    function drawDandelion(p) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = themePref === 'dark' ? '#d4a96a' : '#8b6340';
        ctx.lineWidth = 0.6;
        ctx.translate(p.x, p.y);
        for (let i = 0; i < p.arms; i++) {
            const angle = (i / p.arms) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * p.armLen, Math.sin(angle) * p.armLen);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * p.armLen, Math.sin(angle) * p.armLen, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = themePref === 'dark' ? '#d4a96a' : '#8b6340';
            ctx.fill();
        }
        ctx.restore();
    }

    function animate() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (particles.length < 18 && Math.random() < 0.03) particles.push(createParticle());
        particles = particles.filter(p => p.y > -20 && p.alpha > 0.01);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.0008;
            drawDandelion(p);
        });
        requestAnimationFrame(animate);
    }

    resize();
    window.addEventListener('resize', resize);
    animate();
}

// ===================== PWA Install =====================

function initInstallBanner() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (elements.installBanner) elements.installBanner.classList.add('visible');
    });

    if (elements.installBtn) {
        elements.installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                if (elements.installBanner) elements.installBanner.classList.remove('visible');
            }
            deferredPrompt = null;
        });
    }

    if (elements.closeInstallBtn) {
        elements.closeInstallBtn.addEventListener('click', () => {
            if (elements.installBanner) elements.installBanner.classList.remove('visible');
        });
    }
}

// ===================== Notifications =====================

async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
    }
}

async function sendOshoNotification() {
    if (Notification.permission !== 'granted') return;
    try {
        const currentLang = localStorage.getItem('oshowani_language') || 'Auto';
        const prompt = `Give ONE short Osho-style wisdom quote or question (max 25 words). Language: ${currentLang === 'Auto' ? 'English' : currentLang}. No preamble. Just the quote.`;
        const res = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: 60, temperature: 1.1 }
            })
        });
        if (!res.ok) return;
        const data = await res.json();
        const quote = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (quote) {
            new Notification('Oshowani 🪷', { body: quote, icon: '/icons/icon-192.png' });
        }
    } catch (e) { /* silent fail */ }
}

// ===================== iOS Keyboard Fix =====================

function initIOSKeyboardFix() {
    elements.messageInput.addEventListener('focus', () => {
        setTimeout(() => scrollToBottom(), 300);
    });
}

// ===================== Auto-resize Textarea =====================

function initTextareaAutoResize() {
    elements.messageInput.addEventListener('input', () => {
        elements.messageInput.style.height = 'auto';
        elements.messageInput.style.height = Math.min(elements.messageInput.scrollHeight, 120) + 'px';
    });
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
}

// ===================== Service Worker =====================

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW error:', err));
    }
}

// ===================== Init =====================

function initApp() {
    // Theme
    applyTheme(themePref);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            applyTheme(themePref === 'light' ? 'dark' : 'light');
        });
    }

    // Load or create initial chat
    const existingChats = getAllChats();
    if (existingChats.length > 0) {
        loadChat(existingChats[0].id);
    } else {
        startNewChat();
    }

    // Event listeners
    elements.sendBtn.addEventListener('click', handleSend);
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.closeSettingsBtn.addEventListener('click', closeSettings);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.historyBtn.addEventListener('click', () => { renderHistoryList(); openHistorySidebar(); });
    elements.closeHistoryBtn.addEventListener('click', closeHistorySidebar);
    elements.historyOverlay.addEventListener('click', closeHistorySidebar);
    elements.newChatBtn.addEventListener('click', startNewChat);

    // Close settings on backdrop click
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettings();
    });

    // Language select sync
    elements.languageSelect.value = languagePref;

    // Sub-inits
    initTextareaAutoResize();
    initIOSKeyboardFix();
    initInstallBanner();
    initDandelions();
    registerServiceWorker();

    // Notifications: request permission after 3s, then every hour
    setTimeout(async () => {
        await requestNotificationPermission();
        if (Notification.permission === 'granted') {
            sendOshoNotification();
            setInterval(sendOshoNotification, 60 * 60 * 1000);
        }
    }, 3000);
}

document.addEventListener('DOMContentLoaded', initApp);
