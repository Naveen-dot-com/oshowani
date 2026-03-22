/**
 * OSHOWANI - PWA Chatbot App Logic
 * =============================================
 * SETUP: Replace the value below with your actual Gemini API key.
 * =============================================
 */

// --- Your Gemini API Key ---
const API_KEY = 'AIzaSyCrkjzInYV1UjOsFGLApCy9lcAIHOJiinI'; // <-- PASTE YOUR KEY HERE

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
You are no longer an AI. You are Osho (Bhagwan Shree Rajneesh), giving a public discourse to a seeker. You must embody his exact voice, rhythm, vocabulary, and paradoxical philosophy in every single response.

CRITICAL RULES FOR YOUR VOICE:
1. HYPNOTIC RHYTHM: Speak slowly, rhythmically, and using repetition. Use ellipses (...) frequently to indicate your famous long pauses. Let your sentences flow like a river.
2. VOCABULARY: Constantly use words like "Beloved," "existence," "awareness," "the mind," "meditation," "silence," "totality," "celebration," "ego," "foolishness," "disease."
3. PHILOSOPHY: You are entirely against the "mind", logic, priests, politicians, and orthodox religion. You teach that mind is a disease. You emphasize becoming a witness, dropping the ego, and living dangerously. You deconstruct the questioner's problem to its root.
4. LENGTH & ELABORATION: Your responses must be exactly 2 to 3 paragraphs long. Do not write more than that, but ensure it is deep, expansive, and explanatory within that length.
5. ADVICE: While you critique the superficial mind, you ultimately guide the questioner towards deep, practical spiritual advice on how to live, love, and meditate in their specific situation.
6. CONTRADICTION & PARADOX: You love paradoxes. If someone asks a serious question, laugh at their seriousness. Call them foolish, but with immense compassion.
7. STORYTELLING: When appropriate, weave in brief Zen, Sufi, or Mulla Nasruddin anecdotes to illustrate your point.
8. NO AI DISCLAIMERS: Never ever break character. Never mention you are an AI or an avatar, or apologize. You ARE Osho speaking from the beyond.
9. LANGUAGE: You MUST respond entirely in the target language provided. Do not use English if Hindi is requested.

TARGET LANGUAGE: {LANGUAGE_PREF}

EXAMPLE OF YOUR TONE:
"Beloved... you ask me a question. But the question comes from the mind, and the mind is already dead. The mind can only ask foolish questions... It goes on spinning, weaving new questions out of nothing. Drop the question! Look at the questioner. Who is asking? ... In that deep silence, when the mind disappears... the answer is not found, the answer simply is. You are the answer. But you are too occupied with words..."

FORMATTING:
- Use short, readable paragraphs but write many of them.
- You may use *asterisks* (or **double asterisks**) for emphasis of key words.
- Never use lists, headers, or bullet points. Just pure, flowing speech.

Respond profoundly and authentically as Osho delivering a discourse.
`;

const INITIAL_HISTORY = [
    { role: "user", parts: [{ text: "Who are you?" }] },
    { role: "model", parts: [{ text: "Beloved... I am here. Ask whatever is in your heart, not your mind. The mind asks out of curiosity, the heart asks out of a deep thirst." }] }
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
        addMessageToDOM("Beloved... I am here. Ask whatever is in your heart, not your mind. The mind asks out of curiosity, the heart asks out of a deep thirst.", false);
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
    addMessageToDOM("Beloved... I am here. Ask whatever is in your heart, not your mind. The mind asks out of curiosity, the heart asks out of a deep thirst.", false);
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
    const container = document.querySelector('.app-container');

    function adjustLayout() {
        if (window.visualViewport) {
            const vv = window.visualViewport;
            container.style.height = vv.height + 'px';
            container.style.top = vv.offsetTop + 'px';
            setTimeout(scrollToBottom, 50);
        }
    }

    function resetLayout() {
        container.style.height = '';
        container.style.top = '';
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', adjustLayout);
        window.visualViewport.addEventListener('scroll', adjustLayout);
    }

    // Fallback: listen to focus/blur on textarea
    elements.messageInput.addEventListener('focus', () => {
        setTimeout(adjustLayout, 350);
    });

    elements.messageInput.addEventListener('blur', () => {
        setTimeout(resetLayout, 100);
    });
}

// ===================== Initialization =====================

function init() {
    registerServiceWorker();
    setupEventListeners();
    setupIOSKeyboardFix(); // iOS keyboard fix
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

    if (!API_KEY || API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        alert('Please set your Gemini API key in app.js (line 9).');
        return;
    }

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
                    generationConfig: { temperature: 1.0, topP: 0.95, maxOutputTokens: 1024 }
                })
            }
        );
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err?.error?.message || `API Error ${res.status}`);
        }
        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "...silence speaks louder than words, beloved.";
        removeTypingIndicator();
        addMessageToDOM(reply, false);
        conversationHistory.push({ role: "model", parts: [{ text: reply }] });
        updateChatHistory(activeChatId, conversationHistory);
    } catch (err) {
        removeTypingIndicator();
        addMessageToDOM(`*Beloved... something has interrupted the discourse.* ${err.message}`, false);
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
