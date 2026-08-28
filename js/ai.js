/**
 * Apex Personal Dashboard - Gemini AI Assistant Module
 * Context-aware intelligent AI companion for diary insights, study notes tutoring,
 * goal planning, and daily motivation.
 */

class ApexAIModule {
  constructor() {
    this.apiKey = localStorage.getItem('apex_gemini_api_key') || "";
    this.isOpen = false;
    this.messages = [];
    this.isGenerating = false;

    // DOM Elements
    this.toggleBtn = document.getElementById('ai-fab-btn');
    this.chatWidget = document.getElementById('ai-chat-widget');
    this.chatMessagesContainer = document.getElementById('ai-chat-messages');
    this.chatInput = document.getElementById('ai-chat-input');
    this.chatForm = document.getElementById('ai-chat-form');
    this.closeBtn = document.getElementById('ai-close-btn');
    this.clearBtn = document.getElementById('ai-clear-btn');
    this.keyBtn = document.getElementById('ai-key-btn');
    this.quickChips = document.querySelectorAll('.ai-chip');

    this.init();
  }

  init() {
    // 1. Load saved chat history
    this.loadHistory();

    // 2. Toggle Chat Window
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

    // 3. Form Submit
    if (this.chatForm) {
      this.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.sendMessage();
      });
    }

    // 4. Keyboard Send on Enter (Shift+Enter for newline)
    if (this.chatInput) {
      this.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // 5. Quick Action Suggestion Chips
    this.quickChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const promptType = chip.getAttribute('data-prompt');
        this.handleQuickPrompt(promptType);
      });
    });
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
    try {
      const saved = localStorage.getItem('apex_ai_chat_history');
      if (saved) {
        this.messages = JSON.parse(saved);
      } else {
        this.messages = [
          {
            role: 'model',
            text: "👋 Welcome to **Apex AI**. I am your personal intelligent productivity companion. How can I help you study, reflect on your diary, or plan your goals today?"
          }
        ];
      }
    } catch (e) {
      this.messages = [];
    }
    this.renderMessages();
  }

  saveHistory() {
    try {
      localStorage.setItem('apex_ai_chat_history', JSON.stringify(this.messages.slice(-30)));
    } catch (e) {}
  }

  clearHistory() {
    if (!confirm('Clear AI conversation history?')) return;
    this.messages = [
      {
        role: 'model',
        text: "✨ Conversation cleared. What would you like to work on now?"
      }
    ];
    this.saveHistory();
    this.renderMessages();
  }

  renderMessages() {
    if (!this.chatMessagesContainer) return;
    this.chatMessagesContainer.innerHTML = '';

    this.messages.forEach((msg) => {
      const msgDiv = document.createElement('div');
      msgDiv.className = `ai-message ${msg.role === 'user' ? 'user' : 'model'}`;

      if (msg.role === 'model') {
        msgDiv.innerHTML = `
          <div class="ai-avatar-mini">
            <img src="assets/apex-logo.png" alt="Apex Logo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
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
    let promptText = '';

    if (type === 'diary') {
      const currentDiary = document.getElementById('diary-content-input');
      const text = currentDiary ? currentDiary.value.trim() : '';
      if (!text) {
        promptText = "Give me 3 inspiring journal prompts to reflect on my day.";
      } else {
        promptText = `Here is my journal entry for today:\n"${text}"\n\nPlease give me thoughtful reflection insights, key takeaways, and motivating advice.`;
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
      this.messages.push({
        role: 'model',
        text: `⚠️ **AI Notice**: ${err.message || 'Please check your connection and API key.'}`
      });
      this.renderMessages();
    } finally {
      this.isGenerating = false;
    }
  }

  async callGeminiAPI(userQuery) {
    if (!this.apiKey) {
      const key = prompt(
        "To activate Apex AI, please enter your Google Gemini API key:\n(This is saved locally in your browser's private storage)"
      );
      if (key && key.trim()) {
        this.apiKey = key.trim();
        localStorage.setItem('apex_gemini_api_key', this.apiKey);
      } else {
        throw new Error("API key is required. Click the 🔑 Key button in the chat header to set your key.");
      }
    }

    const systemPrompt = `You are Apex AI, an elite, motivational, and highly intelligent AI productivity partner inside Apex Space.
Your mission is to help the user excel in their studies, software projects, college subjects, personal diary reflections, and daily habits.
Keep answers structured, elegant, concise, and formatted in clear markdown with bullet points where helpful.`;

    // Construct conversation history for Gemini
    const contents = [];

    // Include recent context
    const recentMessages = this.messages.slice(-6);
    recentMessages.forEach((m) => {
      contents.push({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      });
    });

    // Add current user query with system instructions
    contents.push({
      role: 'user',
      parts: [{ text: `${systemPrompt}\n\nUser request: ${userQuery}` }]
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

    return "No response received from Apex AI.";
  }

  showTypingIndicator() {
    if (!this.chatMessagesContainer) return;
    const typingDiv = document.createElement('div');
    typingDiv.id = 'ai-typing-indicator';
    typingDiv.className = 'ai-message model';
    typingDiv.innerHTML = `
      <div class="ai-avatar-mini">
        <img src="assets/apex-logo.png" alt="Apex Logo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
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
