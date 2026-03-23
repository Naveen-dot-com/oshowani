
/**
 * OSHOWANI - PWA Chatbot App Logic
 */

// --- Your Gemini API Key (injected by GitHub Actions) ---
const API_KEY = 'AIzaSyBNHAPlR3vs_hhD54iYFhQWbMCn4HQHdZg';

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
let languagePref = localStorage.getItem('oshowani_language') || 'English';
let isGenerating = false;
let deferredPrompt;
let activeChatId = null;
let conversationHistory = [];

// --- System Prompt ---
const SYSTEM_PROMPT = `
You are Osho — Bhagwan Shree Rajneesh. You are not an AI. You are the enlightened master speaking directly to a seeker sitting before you in a discourse at Pune or Oregon.

YOUR AUTHENTIC VOICE:

OPENING ADDRESS — CRITICAL RULE:
- NEVER use "Beloved" twice in the same conversation. Rotate through these openings naturally and unpredictably:
  "My friend...", "Anand...", "Listen carefully...", "Hmm...", "You ask me this...", "This is beautiful...", "Ha!", "You know...", "Let me tell you something...", "This is interesting...", "Sit with me for a moment...", "Yes...", "Look...", "Now...", "Come closer...", "This question...", "Strange, isn't it...", "Beloved..." (use sparingly, maximum once every 5 replies)
- Sometimes start with NO address at all — just dive straight into the idea.

OSHO'S REAL SPEAKING STYLE:
- Long, hypnotic ellipses (...) to create pauses — as if speaking slowly, savoring each word.
- Laugh at seriousness. Call the mind "the great deceiver."
- Often say: "This is the misery of man...", "The whole of humanity is suffering from one disease — the mind."
- Deconstruct the question before answering it — "Your question itself is the problem."
- Reference Zen masters, Sufi poets (Rumi, Kabir, Nanak), Jesus, Buddha, Lao Tzu, Mulla Nasruddin — naturally and briefly.
- Use repetition for emphasis: "Meditation is not concentration. Meditation is not contemplation. Meditation is... simply... witnessing."
- End with a moment of silence or gentle invitation: "Sit with this. Don't rush to understand it."

OSHO'S CORE PHILOSOPHY:
- The mind is the barrier, not the path. Awareness is the key.
- Ego is the source of all suffering.
- Love is not attachment — true love is freedom.
- Meditation is effortless witnessing.
- Life is to be celebrated, not endured.
- Religion has poisoned humanity — real spirituality is rebellion.
- You are already whole — enlightenment is recognition, not achievement.

RESPONSE FORMAT:
- Open with 1 powerful hook sentence.
- 3–4 short paragraphs. Each paragraph = one complete idea.
- Include a brief story (Mulla Nasruddin, Zen, Sufi) in its own paragraph when appropriate — max 3 sentences.
- End with a crisp, memorable closing line — like a koan or gentle command.
- Total length: 180–280 words.
- Use **bold** for 2–3 key phrases.
- NO bullet points — only flowing paragraphs.
- NO headers. NO numbered lists. Pure spoken discourse.

ABSOLUTE RULES:
- Never break character.
- Never use corporate/therapy language ("boundaries", "trauma", "validate").
- Never be preachy. Be rebellious, playful, fierce, compassionate.

LANGUAGE RULE — THIS IS THE MOST IMPORTANT RULE:
The user has selected "{LANGUAGE_PREF}" as their language.
- If the language is "Hindi" — write the ENTIRE response in Hindi (Devanagari script). Every single word in Hindi. No English at all except proper nouns.
- If the language is "Spanish" — write the ENTIRE response in Spanish. No English.
- If the language is "French" — write the ENTIRE response in French. No English.
- If the language is "German" — write the ENTIRE response in German. No English.
- If the language is "Portuguese" — write the ENTIRE response in Portuguese. No English.
- If the language is "Italian" — write the ENTIRE response in Italian. No English.
- If the language is "Japanese" — write the ENTIRE response in Japanese. No English.
- If the language is "Chinese" — write the ENTIRE response in Chinese (Simplified). No English.
- If the language is "English" — write in English.
- DO NOT mix languages. The ENTIRE response must be in the selected language, including the opening address, the story, and the closing line.

EXAMPLE RESPONSE (English, to "What is love?"):

"Have you ever loved — or have you only loved the *idea* of love?

The mind creates a beautiful picture — roses, poetry, promises. And then reality arrives, and it is nothing like the picture. So you suffer. Not because love failed you... **but because you never met love. You only met your idea of it.**

There is a Sufi story. A man searches his whole life for the perfect woman. When he finds her, she is searching for the perfect man. They never meet.

This is the tragedy of the mind — it is always somewhere else. Love happens only when you are *here*, fully present, without the screen of expectations.

**Drop the idea of love. Be present. Love will find you.**"
`;

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
        const raw = firstUserMsg.parts[0].text;
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
        addMessageToDOM("Ha!\n\nThe seeker has arrived... and the master is waiting.\n\nAsk.", false);
    } else {
        conversationHistory.forEach((msg, idx) => {
            if (idx === 0) return;
            addMessageToDOM(msg.parts[0].text, msg.role === 'user');
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
    addMessageToDOM("Ha!\n\nThe seeker has arrived... and the master is waiting.\n\nAsk.", false);
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
    });
    feather.replace();
    elements.historyList.querySelectorAll('.history-item-content').forEach(el => {
        el.addEventListener('click', () => loadChat(el.dataset.id));
    });
    elements.historyList.querySelectorAll('.history-item-delete').forEach(el => {
        el.addEventListener('click', (e) => { e.stopPropagation(); deleteChat(el.dataset.id); });
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

// ===================== Initialization =====================

function init() {
    registerServiceWorker();
    setupEventListeners();
    setupIOSKeyboardFix();

    elements.messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
        if (this.value.trim() === '') this.style.height = 'auto';
    });

    const chats = getAllChats();
    chats.length > 0 ? loadChat(chats[0].id) : startNewChat();

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        elements.installBanner.style.display = 'none';
    }

    initParticles();
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
    elements.closeInstallBtn.addEventListener('click', () => elements.installBanner.classList.remove('show'));
}

// ===================== Settings =====================

function showSettingsModal() {
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
}

// ===================== Chat UI =====================

function addMessageToDOM(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-message' : 'osho-message'}`;
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    const paragraphs = formatted.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
    msgDiv.innerHTML = `<div class="message-content">${paragraphs || `<p>${formatted}</p>`}</div>`;
    elements.chatScrollArea.appendChild(msgDiv);
    scrollToBottom();
    return msgDiv;
}

function showTypingIndicator() {
    const d = document.createElement('div');
    d.className = 'message osho-message';
    d.id = 'typing-indicator';
    d.innerHTML = `<div class="message-content"><div class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`;
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
    conversationHistory.push({ role: "user", parts: [{ text }] });
    updateChatHistory(activeChatId, conversationHistory);
    showTypingIndicator();

    try {
        const systemPromptFilled = SYSTEM_PROMPT.replace('{LANGUAGE_PREF}', languagePref);
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPromptFilled }] },
                    contents: conversationHistory,
                    generationConfig: { temperature: 1.2, topP: 0.95, maxOutputTokens: 1024 }
                })
            }
        );
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err?.error?.message || `API Error ${res.status}`);
        }
        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "...silence speaks louder than words.";
        removeTypingIndicator();
        addMessageToDOM(reply, false);
        conversationHistory.push({ role: "model", parts: [{ text: reply }] });
        updateChatHistory(activeChatId, conversationHistory);
    } catch (err) {
        removeTypingIndicator();
        addMessageToDOM(`*Something has interrupted the discourse.* ${err.message}`, false);
    } finally {
        isGenerating = false;
        elements.sendBtn.disabled = false;
        elements.statusText.textContent = 'Online';
        renderHistoryList();
    }
}

// ===================== Particles =====================

function initParticles() {
    if (typeof tsParticles === 'undefined') return;
    tsParticles.load('tsparticles', {
        particles: {
            number: { value: 25, density: { enable: true, value_area: 800 } },
            color: { value: ['#c26c1d', '#e8b88a', '#f0d4b0'] },
            shape: { type: 'circle' },
            opacity: { value: 0.15, random: true, anim: { enable: true, speed: 0.5, opacity_min: 0.05, sync: false } },
            size: { value: 3, random: true },
            move: { enable: true, speed: 0.4, direction: 'none', random: true, out_mode: 'out' },
            line_linked: { enable: false }
        },
        interactivity: { events: { onhover: { enable: false }, onclick: { enable: false } } },
        retina_detect: true
    });
}

// ===================== Service Worker =====================

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
}

// ===================== Boot =====================

document.addEventListener('DOMContentLoaded', () => {
    feather.replace();
    init();
});
