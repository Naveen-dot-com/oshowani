/**
 * OSHOWANI - PWA Chatbot App Logic
 */

// DOM Elements
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
    statusText: document.querySelector('.status-text')
};

// --- SECURITY WARNING ---
// Hardcoding API keys on the frontend is heavily discouraged for production as
// anyone can inspect the code and decode the key. Base64 is NOT encryption, just encoding.
// Replace 'WU9VUl9CQVNFNjRfRU5DT0RFRF9BUElfS0VZX0hFUkU=' with btoa('YOUR_ACTUAL_API_KEY')
const ENCRYPTED_API_KEY = 'AIzaSyDxLMQ4QeGT-ftsBrZbTaQQVi81vOzfH3g'; // Base64 placeholder

// State
let apiKey = '';
try {
    apiKey = atob(ENCRYPTED_API_KEY);
} catch (e) {
    console.error("Invalid Base64 API Key string");
}
let languagePref = localStorage.getItem('oshowani_language') || 'English';
let isGenerating = false;
let deferredPrompt;

// OSHO System Prompt Personality
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

Respond profoundly and authentically as Osho delivering a discourse. Let your words be a powerful transmission of insight and advice.
`;

// Conversation History
let conversationHistory = [
    {
        role: "user",
        parts: [{ text: "Who are you?" }]
    },
    {
        role: "model",
        parts: [{ text: "Beloved... I am here. Ask whatever is in your heart, not your mind. The mind asks out of curiosity, the heart asks out of a deep thirst." }]
    }
];

// ----- Initialization -----
function init() {
    registerServiceWorker();
    setupEventListeners();
    
    // Auto-resize textarea
    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value.trim() === '') {
            this.style.height = 'auto';
        }
    });

    if (!apiKey) {
        showSettingsModal();
    }
    
    // Check if installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        elements.installBanner.style.display = 'none';
    }
}

// ----- Event Listeners -----
function setupEventListeners() {
    // Send Message
    elements.sendBtn.addEventListener('click', handleSend);
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Settings
    elements.settingsBtn.addEventListener('click', showSettingsModal);
    elements.closeSettingsBtn.addEventListener('click', hideSettingsModal);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) hideSettingsModal();
    });

        elements.apiKeyInput.type = type === 'password' ? 'text' : 'password';
        elements.toggleKeyVisibility.textContent = type === 'password' ? 'Hide' : 'Show';
    });

    // PWA Install
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        setTimeout(() => elements.installBanner.classList.add('show'), 3000);
    });

    elements.installBtn.addEventListener('click', async () => {
        elements.installBanner.classList.remove('show');
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
        }
    });

    elements.closeInstallBtn.addEventListener('click', () => {
        elements.installBanner.classList.remove('show');
    });
}

// ----- Settings Logic -----
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

// ----- Chat UI -----
function addMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-message' : 'osho-message'}`;
    
    // Format markdown (bold/italics) visually as bold
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
        .replace(/\\n/g, '<br>');

    msgDiv.innerHTML = `
        <div class="message-content">
            <p>${formattedText}</p>
        </div>
    `;
    
    // Insert before typing indicator if it exists, otherwise append
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        elements.chatScrollArea.insertBefore(msgDiv, typingIndicator);
    } else {
        elements.chatScrollArea.appendChild(msgDiv);
    }
    
    scrollToBottom();
    return msgDiv;
}

function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message osho-message';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-content">
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    elements.chatScrollArea.appendChild(typingDiv);
    scrollToBottom();
}

function removeTyping() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function scrollToBottom() {
    elements.chatScrollArea.scrollTop = elements.chatScrollArea.scrollHeight;
}

// ----- Core Logic -----
async function handleSend() {
    const text = elements.messageInput.value.trim();
    if (!text || isGenerating) return;

    if (!apiKey) {
        showSettingsModal();
        return;
    }

    // Add user message
    addMessage(text, true);
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto'; // reset height
    
    // Add to history
    conversationHistory.push({ role: "user", parts: [{ text }] });

    // UI state
    isGenerating = true;
    elements.statusText.textContent = "OSHOWANI is meditating...";
    showTyping();

    try {
        await generateResponse();
    } catch (error) {
        console.error(error);
        removeTyping();
        addMessage("Beloved... the connections of the world are currently disturbed. Let us sit in silence, and try again when the winds are favorable. (Error: " + error.message + ")", false);
    } finally {
        isGenerating = false;
        elements.statusText.textContent = "Wisdom flows...";
    }
}

async function generateResponse() {
    const customizedPrompt = SYSTEM_PROMPT.replace('{LANGUAGE_PREF}', languagePref);

    const requestBody = {
        systemInstruction: { parts: [{ text: customizedPrompt }] },
        contents: conversationHistory,
        generationConfig: {
            temperature: 1.15,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2500
        }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errObj = await response.json();
        throw new Error(errObj.error?.message || response.statusText);
    }

    const data = await response.json();
    removeTyping();
    
    let fullResponse = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        fullResponse = data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Invalid response from the cosmos (API error)");
    }

    // Add message bubble to UI
    addMessage(fullResponse, false);
    
    // Add to history
    conversationHistory.push({ role: "model", parts: [{ text: fullResponse }] });
}

// ----- Service Worker -----
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('ServiceWorker registered:', reg.scope))
                .catch(err => console.error('ServiceWorker registration failed:', err));
        });
    }
}

// Run
document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // ----- Particle Background Initialization -----
    tsParticles.load("tsparticles", {
        preset: "links",
        background: { color: "transparent" },
        particles: {
            number: { value: 60, density: { enable: true, value_area: 800 } },
            color: { value: "#c26c1d" },
            links: { color: "#c26c1d", distance: 150, enable: true, opacity: 0.3, width: 1 },
            move: { enable: true, speed: 1.5, direction: "none", random: true, straight: false, outModes: "bounce" },
            size: { value: 2 },
            opacity: { value: 0.4 }
        },
        interactivity: {
            detectsOn: "window",
            events: {
                onHover: { enable: true, mode: "grab" },
                onClick: { enable: true, mode: "push" },
                resize: true
            },
            modes: {
                grab: { distance: 200, links: { opacity: 0.8 } },
                push: { quantity: 3 }
            }
        },
        retina_detect: true
    });
});
`;

// Conversation History
let conversationHistory = [
    {
        role: "user",
        parts: [{ text: "Who are you?" }]
    },
    {
        role: "model",
        parts: [{ text: "Beloved... I am here. Ask whatever is in your heart, not your mind. The mind asks out of curiosity, the heart asks out of a deep thirst." }]
    }
];

// ----- Initialization -----
function init() {
    registerServiceWorker();
    setupEventListeners();

    // Auto-resize textarea
    elements.messageInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value.trim() === '') {
            this.style.height = 'auto';
        }
    });

    // NOTE: No longer prompts for API key on startup — it is hardcoded above.

    // Check if installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        elements.installBanner.style.display = 'none';
    }
}

// ----- Event Listeners -----
function setupEventListeners() {
    // Send Message
    elements.sendBtn.addEventListener('click', handleSend);
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Settings (Language only — API key is hardcoded)
    elements.settingsBtn.addEventListener('click', showSettingsModal);
    elements.closeSettingsBtn.addEventListener('click', hideSettingsModal);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) hideSettingsModal();
    });

    // PWA Install
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        setTimeout(() => elements.installBanner.classList.add('show'), 3000);
    });

    elements.installBtn.addEventListener('click', async () => {
        elements.installBanner.classList.remove('show');
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
        }
    });

    elements.closeInstallBtn.addEventListener('click', () => {
        elements.installBanner.classList.remove('show');
    });
}

// ----- Settings Logic (Language Only) -----
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

// ----- Chat UI -----
function addMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-message' : 'osho-message'}`;

    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
        .replace(/\\n/g, '<br>');

    msgDiv.innerHTML = `
        <div class="message-content">
            <p>${formattedText}</p>
        </div>
    `;

    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        elements.chatScrollArea.insertBefore(msgDiv, typingIndicator);
    } else {
        elements.chatScrollArea.appendChild(msgDiv);
    }

    scrollToBottom();
    return msgDiv;
}

function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message osho-message';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-content">
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    elements.chatScrollArea.appendChild(typingDiv);
    scrollToBottom();
}

function removeTyping() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function scrollToBottom() {
    elements.chatScrollArea.scrollTop = elements.chatScrollArea.scrollHeight;
}

// ----- Core Logic -----
async function handleSend() {
    const text = elements.messageInput.value.trim();
    if (!text || isGenerating) return;

    addMessage(text, true);
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';

    conversationHistory.push({ role: "user", parts: [{ text }] });

    isGenerating = true;
    elements.statusText.textContent = "OSHOWANI is meditating...";
    showTyping();

    try {
        await generateResponse();
    } catch (error) {
        console.error(error);
        removeTyping();
        addMessage("Beloved... the connections of the world are currently disturbed. Let us sit in silence, and try again when the winds are favorable. (Error: " + error.message + ")", false);
    } finally {
        isGenerating = false;
        elements.statusText.textContent = "Wisdom flows...";
    }
}

async function generateResponse() {
    const customizedPrompt = SYSTEM_PROMPT.replace('{LANGUAGE_PREF}', languagePref);

    const requestBody = {
        systemInstruction: { parts: [{ text: customizedPrompt }] },
        contents: conversationHistory,
        generationConfig: {
            temperature: 1.15,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2500
        }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errObj = await response.json();
        throw new Error(errObj.error?.message || response.statusText);
    }

    const data = await response.json();
    removeTyping();

    let fullResponse = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        fullResponse = data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Invalid response from the cosmos (API error)");
    }

    addMessage(fullResponse, false);
    conversationHistory.push({ role: "model", parts: [{ text: fullResponse }] });
}

// ----- Service Worker -----
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('ServiceWorker registered:', reg.scope))
                .catch(err => console.error('ServiceWorker registration failed:', err));
        });
    }
}

// Run
document.addEventListener('DOMContentLoaded', () => {
    init();

    tsParticles.load("tsparticles", {
        preset: "links",
        background: { color: "transparent" },
        particles: {
            number: { value: 60, density: { enable: true, value_area: 800 } },
            color: { value: "#c26c1d" },
            links: { color: "#c26c1d", distance: 150, enable: true, opacity: 0.3, width: 1 },
            move: { enable: true, speed: 1.5, direction: "none", random: true, straight: false, outModes: "bounce" },
            size: { value: 2 },
            opacity: { value: 0.4 }
        },
        interactivity: {
            detectsOn: "window",
            events: {
                onHover: { enable: true, mode: "grab" },
                onClick: { enable: true, mode: "push" },
                resize: true
            },
            modes: {
                grab: { distance: 200, links: { opacity: 0.8 } },
                push: { quantity: 3 }
            }
        },
        retina_detect: true
    });
});

// Conversation History
let conversationHistory = [
    {
        role: "user",
        parts: [{ text: "Who are you?" }]
    },
    {
        role: "model",
        parts: [{ text: "Beloved... I am here. Ask whatever is in your heart, not your mind. The mind asks out of curiosity, the heart asks out of a deep thirst." }]
    }
];

// ----- Initialization -----
function init() {
    registerServiceWorker();
    setupEventListeners();
    
    // Auto-resize textarea
    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.value.trim() === '') {
            this.style.height = 'auto';
        }
    });

    if (!apiKey) {
        showSettingsModal();
    }
    
    // Check if installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
        elements.installBanner.style.display = 'none';
    }
}

// ----- Event Listeners -----
function setupEventListeners() {
    // Send Message
    elements.sendBtn.addEventListener('click', handleSend);
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // Settings
    elements.settingsBtn.addEventListener('click', showSettingsModal);
    elements.closeSettingsBtn.addEventListener('click', hideSettingsModal);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) hideSettingsModal();
    });

        elements.apiKeyInput.type = type === 'password' ? 'text' : 'password';
        elements.toggleKeyVisibility.textContent = type === 'password' ? 'Hide' : 'Show';
    });

    // PWA Install
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        setTimeout(() => elements.installBanner.classList.add('show'), 3000);
    });

    elements.installBtn.addEventListener('click', async () => {
        elements.installBanner.classList.remove('show');
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
        }
    });

    elements.closeInstallBtn.addEventListener('click', () => {
        elements.installBanner.classList.remove('show');
    });
}

// ----- Settings Logic -----
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

// ----- Chat UI -----
function addMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-message' : 'osho-message'}`;
    
    // Format markdown (bold/italics) visually as bold
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
        .replace(/\\n/g, '<br>');

    msgDiv.innerHTML = `
        <div class="message-content">
            <p>${formattedText}</p>
        </div>
    `;
    
    // Insert before typing indicator if it exists, otherwise append
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        elements.chatScrollArea.insertBefore(msgDiv, typingIndicator);
    } else {
        elements.chatScrollArea.appendChild(msgDiv);
    }
    
    scrollToBottom();
    return msgDiv;
}

function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message osho-message';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-content">
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    elements.chatScrollArea.appendChild(typingDiv);
    scrollToBottom();
}

function removeTyping() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function scrollToBottom() {
    elements.chatScrollArea.scrollTop = elements.chatScrollArea.scrollHeight;
}

// ----- Core Logic -----
async function handleSend() {
    const text = elements.messageInput.value.trim();
    if (!text || isGenerating) return;

    if (!apiKey) {
        showSettingsModal();
        return;
    }

    // Add user message
    addMessage(text, true);
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto'; // reset height
    
    // Add to history
    conversationHistory.push({ role: "user", parts: [{ text }] });

    // UI state
    isGenerating = true;
    elements.statusText.textContent = "OSHOWANI is meditating...";
    showTyping();

    try {
        await generateResponse();
    } catch (error) {
        console.error(error);
        removeTyping();
        addMessage("Beloved... the connections of the world are currently disturbed. Let us sit in silence, and try again when the winds are favorable. (Error: " + error.message + ")", false);
    } finally {
        isGenerating = false;
        elements.statusText.textContent = "Wisdom flows...";
    }
}

async function generateResponse() {
    const customizedPrompt = SYSTEM_PROMPT.replace('{LANGUAGE_PREF}', languagePref);

    const requestBody = {
        systemInstruction: { parts: [{ text: customizedPrompt }] },
        contents: conversationHistory,
        generationConfig: {
            temperature: 1.15,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2500
        }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errObj = await response.json();
        throw new Error(errObj.error?.message || response.statusText);
    }

    const data = await response.json();
    removeTyping();
    
    let fullResponse = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        fullResponse = data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Invalid response from the cosmos (API error)");
    }

    // Add message bubble to UI
    addMessage(fullResponse, false);
    
    // Add to history
    conversationHistory.push({ role: "model", parts: [{ text: fullResponse }] });
}

// ----- Service Worker -----
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('ServiceWorker registered:', reg.scope))
                .catch(err => console.error('ServiceWorker registration failed:', err));
        });
    }
}

// Run
document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // ----- Particle Background Initialization -----
    tsParticles.load("tsparticles", {
        preset: "links",
        background: { color: "transparent" },
        particles: {
            number: { value: 60, density: { enable: true, value_area: 800 } },
            color: { value: "#c26c1d" },
            links: { color: "#c26c1d", distance: 150, enable: true, opacity: 0.3, width: 1 },
            move: { enable: true, speed: 1.5, direction: "none", random: true, straight: false, outModes: "bounce" },
            size: { value: 2 },
            opacity: { value: 0.4 }
        },
        interactivity: {
            detectsOn: "window",
            events: {
                onHover: { enable: true, mode: "grab" },
                onClick: { enable: true, mode: "push" },
                resize: true
            },
            modes: {
                grab: { distance: 200, links: { opacity: 0.8 } },
                push: { quantity: 3 }
            }
        },
        retina_detect: true
    });
});
