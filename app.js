/**
 * OSHOWANI - PWA Chatbot App Logic
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
- Reference Zen masters, Sufi poets (Rumi, Kabir), Mulla Nasruddin — briefly.
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
- Include a brief story (Mulla Nasruddin, Zen, Sufi) when appropriate — max 2 sentences.
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
    { role: "model", parts: [{ text: "Ha!\n\nThe seeker has arrived... and the master is waiting.\n\nAsk." }] }
];

// ===================== Chat Storage =====================
function getAllChats() {
    try { return JSON.parse(localStorage.getItem('oshowani_chats') || '[]'); }
    catch (e) { return []; }
}

function saveAllChats(chats) {
    localStorage.setItem('oshowani_chats', JSON.stringify(chats));
}

function createNewChat() {
    const id = 'chat_' + Date.now();
    const chat = { id, title: 'New Discourse', createdAt: Date.now(), messages: JSON.parse(JSON.stringify(INITIAL_HISTORY)) };
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

function loadChat(chatId) {
    const chat = getAllChats().find(c => c.id === chatId);
    if (!chat) return;
    activeChatId = chatId;
    conversationHistory = JSON.parse(JSON.stringify(chat.messages));
    elements.chatScrollArea.innerHTML = '';
    if (conversationHistory.length <= 2) {
        addMessageToDOM("Namaste.\n\n" +
            "This is Oshowani — an AI companion inspired by\n" +
            "the wisdom of Osho's teachings on meditation,\n" +
            "awareness, love, and freedom.\n\n" +
            "Every question is a doorway. Step in.", false);
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
    addMessageToDOM("Namaste.\n\n" +
            "This is Oshowani — an AI companion inspired by\n" +
            "the wisdom of Osho's teachings on meditation,\n" +
            "awareness, love, and freedom.\n\n" +
            "Every question is a doorway. Step in.", false);
    renderHistoryList();
    closeHistorySidebar();
    scrollToBottom();
}

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
            <div class="history-item-content" data-id="${chat.id}">
                <span class="history-item-icon"><i data-feather="message-circle"></i></span>
                <span class="history-item-title">${escapeHtml(chat.title)}</span>
            </div>
            <button class="history-item-delete" data-id="${chat.id}" title="Delete">
                <i data-feather="trash-2"></i>
            </button>`;
        elements.historyList.appendChild(item);
        feather.replace();
        elements.historyList.querySelectorAll('.history-item-content').forEach(el =>
            el.addEventListener('click', () => loadChat(el.dataset.id)));
        elements.historyList.querySelectorAll('.history-item-delete').forEach(el =>
            el.addEventListener('click', (e) => { e.stopPropagation(); deleteChat(el.dataset.id); }));
    });
}

// ===================== History Sidebar =====================
function openHistorySidebar() {
    elements.historySidebar.classList.add('open');
    elements.historyOverlay.classList.add('active');
    renderHistoryList();
}

function closeHistorySidebar() {
    elements.historySidebar.classList.remove('open');
    elements.historyOverlay.classList.remove('active');
}

// ===================== iOS Keyboard Fix =====================
function setupIOSKeyboardFix() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIOS || !window.visualViewport) return;
    const container = document.querySelector('.app-container');
    const update = () => {
        const vv = window.visualViewport;
        container.style.height = vv.height + 'px';
        container.style.top = vv.offsetTop + 'px';
        container.style.bottom = 'auto';
        requestAnimationFrame(() => {
            elements.chatScrollArea.scrollTop = elements.chatScrollArea.scrollHeight;
        });
    };
    window.visualViewport.addEventListener('resize', update);
    window.visualViewport.addEventListener('scroll', update);
    update();
}

// ===================== Theme =====================
function injectThemeCSS() {
    const style = document.createElement('style');
    style.id = 'oshowani-theme-css';
    style.textContent = `
        #theme-toggle-btn {
            background: none; border: none; cursor: pointer;
            padding: 8px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            opacity: 0.8; transition: opacity 0.2s, background 0.2s;
            color: inherit;
        }
        #theme-toggle-btn:hover { opacity: 1; background: rgba(255,255,255,0.1); }
    `;
    document.head.appendChild(style);
}

function initThemeToggle() {
    document.body.setAttribute('data-theme', themePref);
    const btn = document.createElement('button');
    btn.id = 'theme-toggle-btn';
    btn.className = 'header-btn';
    btn.setAttribute('title', 'Toggle light/dark mode');
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.innerHTML = themePref === 'dark'
        ? '<i data-feather="sun"></i>'
        : '<i data-feather="moon"></i>';
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn && settingsBtn.parentNode) {
        settingsBtn.parentNode.insertBefore(btn, settingsBtn);
    }
    btn.addEventListener('click', () => {
        themePref = themePref === 'dark' ? 'light' : 'dark';
        localStorage.setItem('oshowani_theme', themePref);
        document.body.setAttribute('data-theme', themePref);
        btn.innerHTML = themePref === 'dark'
            ? '<i data-feather="sun"></i>'
            : '<i data-feather="moon"></i>';
        feather.replace();
    });
}

// ===================== Dandelion Seeds =====================
let dandelionCanvas = null;
let dandelionCtx = null;
let dandelionList = [];

class DandelionSeed {
    constructor(w, h, initial) {
        this.w = w; this.h = h;
        this.reset(initial);
    }

    reset(initial) {
        this.x = Math.random() * this.w;
        this.y = initial ? Math.random() * this.h : -60;
        this.scale = 0.55 + Math.random() * 0.7;
        this.fallSpeed = 0.18 + Math.random() * 0.25;
        this.angle = (Math.random() - 0.5) * 0.4;
        this.rotSpeed = (Math.random() - 0.5) * 0.004;
        this.swayAmp = 1.0 + Math.random() * 1.5;
        this.swaySpeed = 0.004 + Math.random() * 0.008;
        this.swayPhase = Math.random() * Math.PI * 2;
        this.opacity = 0.55 + Math.random() * 0.38;
        this.drift = (Math.random() - 0.5) * 0.15;
        this.t = Math.random() * 1000;
        this.numFilaments = 20 + Math.floor(Math.random() * 8);
        this.filamentLen = 13 + Math.random() * 7;
    }

    update() {
        this.t++;
        this.y += this.fallSpeed;
        this.x += Math.sin(this.t * this.swaySpeed + this.swayPhase) * this.swayAmp * 0.07 + this.drift;
        this.angle += this.rotSpeed * Math.sin(this.t * this.swaySpeed * 0.4) * 0.0008;
        if (this.y > this.h + 80) this.reset(false);
    }

    draw(ctx, isDark) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = this.opacity;
        this.drawSeed(ctx, isDark);
        ctx.restore();
    }

    drawSeed(ctx, isDark) {
        const s = this.scale;
        const primaryColor   = isDark ? 'rgba(255,255,255,0.95)' : 'rgba(60,45,30,0.90)';
        const secondaryColor = isDark ? 'rgba(220,220,220,0.70)' : 'rgba(80,60,35,0.65)';
        const tipColor       = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(50,35,18,0.80)';
        const stemColor      = isDark ? 'rgba(210,210,210,0.80)' : 'rgba(70,50,25,0.75)';

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const filLen = this.filamentLen * s;
        const stemLen = 18 * s;
        const seedR = 2.2 * s;
        const n = this.numFilaments;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, stemLen);
        ctx.strokeStyle = stemColor;
        ctx.lineWidth = Math.max(0.6, 1.1 * s);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(0, stemLen, seedR * 0.7, seedR * 1.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = primaryColor;
        ctx.fill();

        for (let i = 0; i < n; i++) {
            const spreadAngle = (i / n) * Math.PI * 2;
            const tiltX = Math.sin(spreadAngle) * filLen;
            const tiltY = -Math.abs(Math.cos(spreadAngle)) * filLen * 0.85 - filLen * 0.25;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(tiltX * 0.45, tiltY * 0.3, tiltX, tiltY);
            ctx.strokeStyle = secondaryColor;
            ctx.lineWidth = Math.max(0.35, 0.55 * s);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(tiltX, tiltY, Math.max(1.0, 1.6 * s), 0, Math.PI * 2);
            ctx.fillStyle = tipColor;
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1.2, 2.2 * s), 0, Math.PI * 2);
        ctx.fillStyle = primaryColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2.0, 3.5 * s), 0, Math.PI * 2);
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(60,45,30,0.18)';
        ctx.lineWidth = Math.max(0.5, 0.8 * s);
        ctx.stroke();
    }
}

function initDandelions() {
    const old = document.getElementById('tsparticles');
    if (old) old.style.display = 'none';
    dandelionCanvas = document.createElement('canvas');
    dandelionCanvas.id = 'dandelion-canvas';
    Object.assign(dandelionCanvas.style, {
        position: 'fixed',
        top: '0', left: '0',
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: '0'
    });
    document.body.appendChild(dandelionCanvas);
    dandelionCtx = dandelionCanvas.getContext('2d');
    resizeDandelionCanvas();
    window.addEventListener('resize', resizeDandelionCanvas);
    for (let i = 0; i < 22; i++) {
        dandelionList.push(new DandelionSeed(dandelionCanvas.width, dandelionCanvas.height, true));
    }
    animateDandelions();
}

function resizeDandelionCanvas() {
    if (!dandelionCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    dandelionCanvas.width = cssW * dpr;
    dandelionCanvas.height = cssH * dpr;
    dandelionCanvas.style.width = cssW + 'px';
    dandelionCanvas.style.height = cssH + 'px';
    if (dandelionCtx) dandelionCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dandelionList.forEach(d => { d.w = cssW; d.h = cssH; });
}

function animateDandelions() {
    if (!dandelionCtx) return;
    dandelionCtx.clearRect(0, 0, dandelionCanvas.width, dandelionCanvas.height);
    const isDark = document.body.getAttribute('data-theme') !== 'light';
    dandelionList.forEach(d => { d.update(); d.draw(dandelionCtx, isDark); });
    requestAnimationFrame(animateDandelions);
}

// ===================== Initialization =====================
function init() {
    registerServiceWorker();
    injectThemeCSS();
    initThemeToggle();
    setupEventListeners();
    setupIOSKeyboardFix();

    elements.messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
        if (!this.value.trim()) this.style.height = 'auto';
    });

    const chats = getAllChats();
    chats.length > 0 ? loadChat(chats[0].id) : startNewChat();

    // ✅ SPLASH — signals app is ready; splash fades out after 3s minimum
    window.hideSplash && window.hideSplash();

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        elements.installBanner.style.display = 'none';
    }

    initDandelions();
}

// ===================== Event Listeners =====================
function setupEventListeners() {
    elements.sendBtn.addEventListener('click', handleSend);
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    elements.settingsBtn.addEventListener('click', showSettingsModal);
    elements.closeSettingsBtn.addEventListener('click', hideSettingsModal);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) hideSettingsModal();
    });
    elements.languageSelect.addEventListener('change', () => {
        languagePref = elements.languageSelect.value;
        localStorage.setItem('oshowani_language', languagePref);
        const prev = elements.statusText.textContent;
        elements.statusText.textContent = `Language: ${languagePref} ✓`;
        setTimeout(() => { elements.statusText.textContent = prev; }, 2000);
    });
    elements.historyBtn.addEventListener('click', openHistorySidebar);
    elements.closeHistoryBtn.addEventListener('click', closeHistorySidebar);
    elements.historyOverlay.addEventListener('click', closeHistorySidebar);
    elements.newChatBtn.addEventListener('click', startNewChat);

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        setTimeout(() => elements.installBanner.classList.add('show'), 3000);
    });
    elements.installBtn.addEventListener('click', async () => {
        elements.installBanner.classList.remove('show');
        if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
        }
    });
    elements.closeInstallBtn.addEventListener('click', () => {
        elements.installBanner.classList.remove('show');
    });
}

// ===================== Settings =====================
function showSettingsModal() {
    languagePref = localStorage.getItem('oshowani_language') || 'Auto';
    elements.languageSelect.value = languagePref;
    elements.settingsModal.classList.add('active');
}

function hideSettingsModal() {
    elements.settingsModal.classList.remove('active');
}

function saveSettings() {
    languagePref = elements.languageSelect.value;
    localStorage.setItem('oshowani_language', languagePref);
    hideSettingsModal();
    const prev = elements.statusText.textContent;
    elements.statusText.textContent = `Language: ${languagePref} ✓`;
    setTimeout(() => { elements.statusText.textContent = prev; }, 2000);
}

// ===================== Chat UI =====================
function addMessageToDOM(text, isUser) {
    if (isUser === undefined) isUser = false;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message ' + (isUser ? 'user-message' : 'osho-message');
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **bold**
        .replace(/__(.*?)__/g, '<strong>$1</strong>')       // __bold__
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')       // *single star* → also bold
        .replace(/_(.*?)_/g, '<em>$1</em>');                // _underscore_ → italic
    const paragraphs = formatted.split(/\n\n+/);
    msgDiv.innerHTML = `<div class="message-content">${paragraphs.map(p =>
        `<p>${p.replace(/\n/g, '<br>')}</p>`
    ).join('')}</div>`;
    elements.chatScrollArea.appendChild(msgDiv);
    scrollToBottom();
    return msgDiv;
}

function showTypingIndicator() {
    const d = document.createElement('div');
    d.className = 'message osho-message';
    d.id = 'typing-indicator';
    d.innerHTML = `<div class="message-content"><div class="typing-dots">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    </div></div>`;
    elements.chatScrollArea.appendChild(d);
    scrollToBottom();
}

function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

function scrollToBottom() {
    elements.chatScrollArea.scrollTop = elements.chatScrollArea.scrollHeight;
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

    conversationHistory.push({ role: 'user', parts: [{ text: messageText }] });
    updateChatHistory(activeChatId, conversationHistory);
    showTypingIndicator();

    try {
        const systemPromptFilled = SYSTEM_PROMPT.replace('{LANGUAGE_PREF}', currentLang);
        const res = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPromptFilled }] },
                contents: conversationHistory,
                generationConfig: { temperature: 1.2, topP: 0.95, maxOutputTokens: 800 }
            })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err?.error?.message || `API Error ${res.status}`);
        }
        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '...silence speaks louder than words.';
        removeTypingIndicator();
        addMessageToDOM(reply, false);
        conversationHistory.push({ role: 'model', parts: [{ text: reply }] });
        updateChatHistory(activeChatId, conversationHistory);
    } catch (err) {
        removeTypingIndicator();
        addMessageToDOM(`Something has interrupted the discourse. ${err.message}`, false);
    } finally {
        isGenerating = false;
        elements.sendBtn.disabled = false;
        elements.statusText.textContent = 'Online';
        renderHistoryList();
    }
}

// ===================== Service Worker =====================
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
}

// ===================== Boot =====================
document.addEventListener('DOMContentLoaded', function () {
    feather.replace();
    init();
});
