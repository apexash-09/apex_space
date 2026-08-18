/**
 * Personal Diary Module
 * Date-keyed journal entries with markdown parser, history list, streak logging, and keyboard shortcuts.
 * Supports pressing Enter on title input or Ctrl+Enter / Cmd+Enter on content textarea to save & clear instantly!
 */

class DiaryModule {
  constructor() {
    this.currentDate = this.getTodayString();
    this.isEditing = true;

    this.datePicker = document.getElementById('diary-date-picker');
    this.titleInput = document.getElementById('diary-entry-title');
    this.contentInput = document.getElementById('diary-content-input');
    this.previewBox = document.getElementById('diary-content-preview');
    this.wordCountLabel = document.getElementById('diary-word-count');
    this.historyList = document.getElementById('diary-history-list');

    this.btnSave = document.getElementById('btn-save-diary');
    this.btnEditorTab = document.getElementById('btn-tab-editor');
    this.btnPreviewTab = document.getElementById('btn-tab-preview');

    this.init();
  }

  init() {
    if (!this.datePicker) return;

    this.datePicker.value = this.currentDate;

    // Event Listeners
    this.datePicker.addEventListener('change', (e) => {
      this.currentDate = e.target.value;
      this.loadEntryForDate(this.currentDate);
    });

    this.contentInput.addEventListener('input', () => {
      this.updateWordCount();
      this.updatePreview();
    });

    // Keyboard Shortcuts: Enter on Title or Ctrl+Enter / Cmd+Enter on Content
    this.titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.saveCurrentEntry();
      }
    });

    this.contentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.saveCurrentEntry();
      }
    });

    this.btnSave.addEventListener('click', () => this.saveCurrentEntry());

    this.btnEditorTab.addEventListener('click', () => this.switchTab('editor'));
    this.btnPreviewTab.addEventListener('click', () => this.switchTab('preview'));

    // Initial Load
    this.loadEntryForDate(this.currentDate);
    this.loadHistoryList();
  }

  getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async loadEntryForDate(dateStr) {
    try {
      const entry = await window.db.get('diary', dateStr);
      if (entry) {
        this.titleInput.value = entry.title || '';
        this.contentInput.value = entry.content || '';
      } else {
        this.titleInput.value = '';
        this.contentInput.value = '';
      }
      this.updateWordCount();
      this.updatePreview();
    } catch (err) {
      console.error('Error loading diary entry:', err);
    }
  }

  async saveCurrentEntry() {
    const title = this.titleInput.value.trim() || `Journal - ${this.currentDate}`;
    const content = this.contentInput.value.trim();

    if (!content) {
      alert('Please write some thoughts before saving.');
      return;
    }

    const entryObj = {
      date: this.currentDate,
      title: title,
      content: content,
      updatedAt: new Date().toISOString()
    };

    try {
      await window.db.put('diary', entryObj);
      
      // Auto-register activity in Study Streak Heatmap!
      if (window.streakModule) {
        await window.streakModule.recordActivity(this.currentDate, 'diary');
      }

      this.loadHistoryList();

      // Clear text inputs after saving
      this.titleInput.value = '';
      this.contentInput.value = '';
      this.updateWordCount();
      this.updatePreview();
      this.switchTab('editor');

      // Quick save toast feedback
      const originalText = this.btnSave.innerText;
      this.btnSave.innerText = 'Saved & Cleared! ✓';
      this.btnSave.style.background = '#ffffff';
      this.btnSave.style.color = '#000000';
      setTimeout(() => {
        this.btnSave.innerText = originalText;
        this.btnSave.style.background = '';
        this.btnSave.style.color = '';
      }, 1800);
    } catch (err) {
      console.error('Failed to save diary entry:', err);
      alert('Failed to save entry to IndexedDB.');
    }
  }

  async loadHistoryList() {
    try {
      const entries = await window.db.getAll('diary');
      entries.sort((a, b) => b.date.localeCompare(a.date));

      this.historyList.innerHTML = '';

      if (entries.length === 0) {
        this.historyList.innerHTML = `
          <p style="font-size: 13px; color: var(--text-dim); text-align: center; padding: 20px 0;">No entries yet. Write your first thought today!</p>
        `;
        return;
      }

      for (const item of entries) {
        const div = document.createElement('div');
        div.className = `glass-card ${item.date === this.currentDate ? 'active' : ''}`;
        div.style.padding = '12px 14px';
        div.style.cursor = 'pointer';

        const dateFormatted = new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', year: 'numeric'
        });

        div.innerHTML = `
          <div style="font-size: 13px; font-weight: 600; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${this.escapeHtml(item.title)}</div>
          <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: var(--text-muted);">
            <span>📅 ${dateFormatted}</span>
            <span>${item.content.split(/\s+/).filter(Boolean).length} words</span>
          </div>
        `;

        div.addEventListener('click', () => {
          this.currentDate = item.date;
          this.datePicker.value = item.date;
          this.loadEntryForDate(item.date);
          this.loadHistoryList();
        });

        this.historyList.appendChild(div);
      }
    } catch (err) {
      console.error('Error rendering diary history:', err);
    }
  }

  switchTab(tab) {
    if (tab === 'editor') {
      this.contentInput.style.display = 'block';
      this.previewBox.style.display = 'none';
      this.btnEditorTab.classList.add('active');
      this.btnPreviewTab.classList.remove('active');
    } else {
      this.updatePreview();
      this.contentInput.style.display = 'none';
      this.previewBox.style.display = 'block';
      this.btnPreviewTab.classList.add('active');
      this.btnEditorTab.classList.remove('active');
    }
  }

  updateWordCount() {
    const text = this.contentInput.value.trim();
    const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
    this.wordCountLabel.innerText = `${count} word${count === 1 ? '' : 's'}`;
  }

  updatePreview() {
    const markdownText = this.contentInput.value;
    this.previewBox.innerHTML = this.parseMarkdown(markdownText);
  }

  parseMarkdown(text) {
    if (!text) return '<p style="color: var(--text-dim); font-style: italic;">Nothing to preview...</p>';

    let html = text;

    html = this.escapeHtml(html);

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic *text*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Blockquotes > text
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Bullet lists - item
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');

    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;

    return html;
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.diaryModule = new DiaryModule();
