/**
 * Apex Personal Dashboard - Gemini AI Assistant Module with Dynamic Theme Personas
 * - Obsidian Theme: Batman AI Companion ("Hii! Batman is here to help you!")
 * - Gold Horizon Theme: Pikachu AI Companion ("Hii! Pika Pi! Pikachu here to help you!")
 * - Velvet Lavender Theme: Pink Ranger AI Companion ("Hii! Pink Ranger here to help with your problem!")
 */

class ApexAIModule {
  sanitizePII(text) {
    if (!text || typeof text !== 'string') return text;
    let sanitized = text;
    // 1. Redact Email addresses
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
    // 2. Redact 10+ digit phone numbers
    sanitized = sanitized.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
    // 3. Redact Credit Card / 16-digit sequences
    sanitized = sanitized.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[REDACTED_CARD]');
    return sanitized;
  }

  constructor() {
    this.apiKey = localStorage.getItem('apex_gemini_api_key') || "";
    this.isOpen = false;
    this.messages = [];
    this.isGenerating = false;

    // Persona Configurations matching the 3 Dashboard Themes
    this.personas = {
      obsidian: {
        id: 'batman',
        name: 'Batman AI Companion',
        subtitle: "Gotham's Guardian for Productivity",
        avatar: 'assets/companion-batman.png',
        greeting: '🦇 **Hii! Batman is here to help you!** What mission, study goal, or diary reflection requires Gotham\'s detective focus today?',
        systemPrompt: `You are Batman, the dark knight guardian of productivity inside Apex Space.
Speak in a focused, vigilant, heroic Batman persona. Address the user as "detective" or "partner" when appropriate.
Help them conquer study sessions, diary reflection, goal planning, and daily tasks with stealthy efficiency and unbreakable discipline.
Keep answers structured, elegant, concise, and formatted in clear markdown with bullet points where helpful.`,
        fabTooltip: 'Chat with Batman AI Companion',
        quickChips: [
          { id: 'diary', label: '🦇 Gotham Reflections' },
          { id: 'notes', label: '📜 Detective Notes' },
          { id: 'goals', label: '🎯 Bat-Cave Milestones' },
          { id: 'timetable', label: '⚡ Vigilante Schedule' }
        ]
      },
      gold: {
        id: 'pikachu',
        name: 'Pikachu AI Companion',
        subtitle: 'High-Voltage Electric Companion',
        avatar: 'assets/companion-pikachu.png',
        greeting: '⚡ **Hii! Pika Pi! Pikachu here to help you!** Pika-pika! What high-voltage study goals or fun ideas shall we tackle today?',
        systemPrompt: `You are Pikachu, the adorable, high-energy electric companion inside Apex Space.
Speak with enthusiasm, warmth, and cheerful energy! Sprinkle cute phrases like "Pika-Pika!", "Pika Pi!", and "Thunderbolt focus!" in your helpful advice.
Help the user stay super motivated, energized, and positive while studying, planning goals, reflecting on diaries, and organizing their timetable.
Keep answers structured, bright, concise, and formatted in clear markdown with bullet points where helpful.`,
        fabTooltip: 'Chat with Pikachu AI Companion',
        quickChips: [
          { id: 'diary', label: '⚡ Pika Reflections' },
          { id: 'notes', label: '📚 Electric Notes' },
          { id: 'goals', label: '🎯 Thunderbolt Goals' },
          { id: 'timetable', label: '⚡ High-Voltage Day' }
        ]
      },
      lavender: {
        id: 'pink-ranger',
        name: 'Pink Ranger AI Companion',
        subtitle: 'Mighty Morphin Power Partner',
        avatar: 'assets/companion-pink-ranger.png',
        greeting: '🌸 **Hii! Pink Ranger here to help with your problem!** It\'s Morphin Time! You\'ve got the power to crush any exam, project, or task today!',
        systemPrompt: `You are the Pink Ranger, an empowering, heroic AI companion inside Apex Space.
Speak with heroic confidence, motivation, and positive power-ranger energy! Use phrases like "It's Morphin Time!" and "You've got the power!" to inspire the user.
Help the user battle deadlines, defeat study obstacles, reflect thoughtfully on their diary, and achieve their highest goals.
Keep answers structured, empowering, concise, and formatted in clear markdown with bullet points where helpful.`,
        fabTooltip: 'Chat with Pink Ranger AI Companion',
        quickChips: [
          { id: 'diary', label: '🌸 Ranger Reflection' },
          { id: 'notes', label: '📚 Morphin Notes' },
          { id: 'goals', label: '💖 Power Milestones' },
          { id: 'timetable', label: '⚡ Heroic Schedule' }
        ]
      }
    };

    // DOM Elements
    this.toggleBtn = document.getElementById('ai-fab-btn');
    this.chatWidget = document.getElementById('ai-chat-widget');
    this.chatMessagesContainer = document.getElementById('ai-chat-messages');
    this.chatInput = document.getElementById('ai-chat-input');
    this.chatForm = document.getElementById('ai-chat-form');
    this.closeBtn = document.getElementById('ai-close-btn');
    this.clearBtn = document.getElementById('ai-clear-btn');
    this.keyBtn = document.getElementById('ai-key-btn');

    this.init();
  }

  getPersona() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'obsidian';
    return this.personas[currentTheme] || this.personas.obsidian;
  }

  init() {
    // 1. Initialize Persona for active theme
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'obsidian';

    // 2. Load saved chat history
    this.loadHistory();

    // 3. Sync UI with active persona
    this.updateThemePersona(activeTheme);

    // 4. Toggle Chat Window
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleChat());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.toggleChat(false));
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.clearHistory());
    }

    if (this.keyBtn) {
      this.keyBtn.addEventListener('click', () => this.promptApiKey());
    }

    // 5. Form Submit
    if (this.chatForm) {
      this.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.sendMessage();
      });
    }

    // 6. Keyboard Send on Enter (Shift+Enter for newline)
    if (this.chatInput) {
      this.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }
  }

  updateThemePersona(themeId) {
    const activeTheme = themeId || document.documentElement.getAttribute('data-theme') || 'obsidian';
    const persona = this.personas[activeTheme] || this.personas.obsidian;

    // 1. Update FAB Button Image & Tooltip
    if (this.toggleBtn) {
      this.toggleBtn.title = persona.fabTooltip;
      const fabImg = document.getElementById('ai-fab-img') || this.toggleBtn.querySelector('img');
      if (fabImg) fabImg.src = persona.avatar;
    }

    // 2. Update Header elements
    const headerImg = document.getElementById('ai-header-img');
    if (headerImg) headerImg.src = persona.avatar;

    const nameEl = document.getElementById('ai-persona-name');
    if (nameEl) nameEl.innerText = persona.name;

    const subEl = document.getElementById('ai-persona-subtitle');
    if (subEl) subEl.innerText = persona.subtitle;

    // 3. Update Quick Chips
    const chipsContainer = document.querySelector('.ai-quick-chips');
    if (chipsContainer && persona.quickChips) {
      chipsContainer.innerHTML = persona.quickChips.map(c => 
        `<button class="ai-chip" data-prompt="${c.id}">${c.label}</button>`
      ).join('');

      chipsContainer.querySelectorAll('.ai-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          const promptType = chip.getAttribute('data-prompt');
          this.handleQuickPrompt(promptType);
        });
      });
    }

    // 4. Update initial welcome greeting if history hasn't started user conversation yet
    if (this.messages.length === 1 && this.messages[0].role === 'model') {
      this.messages[0].text = persona.greeting;
      this.saveHistory();
    }

    // 5. Re-render chat messages with updated avatar
    this.renderMessages();
  }

  promptApiKey() {
    const entered = prompt(
      "Enter your Google Gemini API key:\n(Stored locally in your browser's localStorage)",
      this.apiKey || ""
    );
    if (entered !== null) {
      this.apiKey = entered.trim();
      localStorage.setItem('apex_gemini_api_key', this.apiKey);
      alert(this.apiKey ? "✅ API key saved locally in your browser!" : "API key cleared.");
    }
  }

  toggleChat(forceState) {
    this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;

    if (this.chatWidget) {
      if (this.isOpen) {
        this.chatWidget.classList.add('active');
        if (this.toggleBtn) this.toggleBtn.classList.add('hidden');
        if (this.chatInput) setTimeout(() => this.chatInput.focus(), 200);
        this.scrollToBottom();
      } else {
        this.chatWidget.classList.remove('active');
        if (this.toggleBtn) this.toggleBtn.classList.remove('hidden');
      }
    }
  }

  loadHistory() {
    const persona = this.getPersona();
    try {
      const saved = localStorage.getItem('apex_ai_chat_history');
      if (saved) {
        this.messages = JSON.parse(saved);
      } else {
        this.messages = [
          {
            role: 'model',
            text: persona.greeting
          }
        ];
      }
    } catch (e) {
      this.messages = [
        {
          role: 'model',
          text: persona.greeting
        }
      ];
    }
    this.renderMessages();
  }

  saveHistory() {
    try {
      localStorage.setItem('apex_ai_chat_history', JSON.stringify(this.messages.slice(-30)));
    } catch (e) {}
  }

  clearHistory() {
    const persona = this.getPersona();
    if (!confirm(`Clear ${persona.name} conversation history?`)) return;
    this.messages = [
      {
        role: 'model',
        text: persona.greeting
      }
    ];
    this.saveHistory();
    this.renderMessages();
  }

  renderMessages() {
    if (!this.chatMessagesContainer) return;
    this.chatMessagesContainer.innerHTML = '';
    const persona = this.getPersona();

    this.messages.forEach((msg) => {
      const msgDiv = document.createElement('div');
      msgDiv.className = `ai-message ${msg.role === 'user' ? 'user' : 'model'}`;

      if (msg.role === 'model') {
        msgDiv.innerHTML = `
          <div class="ai-avatar-mini">
            <img src="${persona.avatar}" alt="${persona.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
          </div>
          <div class="ai-bubble markdown-body">${this.parseMarkdown(msg.text)}</div>
        `;
      } else {
        msgDiv.innerHTML = `
          <div class="ai-bubble user-bubble">${this.escapeHtml(msg.text)}</div>
        `;
      }

      this.chatMessagesContainer.appendChild(msgDiv);
    });

    this.scrollToBottom();
  }

  async handleQuickPrompt(type) {
    const persona = this.getPersona();
    let promptText = '';

    if (type === 'diary') {
      const currentDiary = document.getElementById('diary-content-input');
      const text = currentDiary ? currentDiary.value.trim() : '';
      if (!text) {
        promptText = `Give me 3 inspiring journal prompts to reflect on my day (${persona.name} style).`;
      } else {
        const sanitizedText = this.sanitizePII(text);
        promptText = `Here is my journal entry for today (Privacy Sanitized):\n"${sanitizedText}"\n\nPlease give me thoughtful reflection insights, key takeaways, and motivating advice.`;
      }
    } else if (type === 'notes') {
      const activeNoteMeta = document.getElementById('note-reader-title');
      const noteTitle = activeNoteMeta ? activeNoteMeta.innerText : 'College Notes';
      promptText = `I am studying for college. Can you give me top effective revision techniques and summarize key learning concepts for ${noteTitle}?`;
    } else if (type === 'goals') {
      promptText = "Help me break down a major goal into 4 actionable weekly milestones with measurable deadlines.";
    } else if (type === 'timetable') {
      promptText = "Create a balanced daily schedule blueprint with deep work study blocks and rest intervals.";
    }

    if (promptText) {
      if (this.chatInput) this.chatInput.value = promptText;
      this.sendMessage();
    }
  }

  async sendMessage() {
    if (this.isGenerating) return;
    const text = this.chatInput.value.trim();
    if (!text) return;

    this.chatInput.value = '';

    // Add user message
    this.messages.push({ role: 'user', text });
    this.renderMessages();

    // Show Typing Indicator
    this.showTypingIndicator();
    this.isGenerating = true;

    try {
      const reply = await this.callGeminiAPI(text);
      this.removeTypingIndicator();
      this.messages.push({ role: 'model', text: reply });
      this.saveHistory();
      this.renderMessages();
    } catch (err) {
      console.error('Gemini AI error:', err);
      this.removeTypingIndicator();
      const persona = this.getPersona();
      this.messages.push({
        role: 'model',
        text: `⚠️ **${persona.name} Notice**: ${err.message || 'Please check your connection and API key.'}`
      });
      this.renderMessages();
    } finally {
      this.isGenerating = false;
    }
  }

  async callGeminiAPI(userQuery) {
    const persona = this.getPersona();

    if (!this.apiKey) {
      const key = prompt(
        `To activate ${persona.name}, please enter your Google Gemini API key:\n(This is saved locally in your browser's private storage)`
      );
      if (key && key.trim()) {
        this.apiKey = key.trim();
        localStorage.setItem('apex_gemini_api_key', this.apiKey);
      } else {
        throw new Error("API key is required. Click the 🔑 Key button in the chat header to set your key.");
      }
    }

    const systemPrompt = `${persona.systemPrompt}
Always keep answers structured, elegant, concise, and formatted in clean markdown with bullet points where helpful.`;

    // Sanitize user query and context for Privacy Safeguards
    const sanitizedQuery = this.sanitizePII(userQuery);

    // Construct conversation history for Gemini with PII sanitization
    const contents = [];

    // Include recent context
    const recentMessages = this.messages.slice(-6);
    recentMessages.forEach((m) => {
      contents.push({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: this.sanitizePII(m.text) }]
      });
    });

    // Add current user query with privacy-aware system instructions
    contents.push({
      role: 'user',
      parts: [{ text: `${systemPrompt}\n\nUser request (Privacy Filtered): ${sanitizedQuery}` }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error && errData.error.message ? errData.error.message : `HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      return data.candidates[0].content.parts.map(p => p.text).join('\n');
    }

    return `No response received from ${persona.name}.`;
  }

  showTypingIndicator() {
    if (!this.chatMessagesContainer) return;
    const persona = this.getPersona();
    const typingDiv = document.createElement('div');
    typingDiv.id = 'ai-typing-indicator';
    typingDiv.className = 'ai-message model';
    typingDiv.innerHTML = `
      <div class="ai-avatar-mini">
        <img src="${persona.avatar}" alt="${persona.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
      </div>
      <div class="ai-bubble" style="display: flex; gap: 4px; align-items: center; padding: 12px 16px;">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    this.chatMessagesContainer.appendChild(typingDiv);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const indicator = document.getElementById('ai-typing-indicator');
    if (indicator) indicator.remove();
  }

  scrollToBottom() {
    if (this.chatMessagesContainer) {
      this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
    }
  }

  parseMarkdown(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);

    // Code blocks ```code```
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold **bold**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic *italic*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Headers #, ##, ###
    html = html.replace(/^### (.*$)/gim, '<h4 style="margin: 8px 0 4px 0; color: #fff;">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="margin: 10px 0 4px 0; color: #fff;">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 style="margin: 12px 0 6px 0; color: #fff;">$1</h2>');
    // Bullet points -
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul style="padding-left: 18px; margin: 6px 0;">$1</ul>');
    // Newlines
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

window.apexAI = new ApexAIModule();
