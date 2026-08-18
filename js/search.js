/**
 * Apex Personal Global Search Module
 * Real-time unified keyword search filtering across Diary, College Notes, Work Log, and Goals.
 */

class SearchModule {
  constructor() {
    this.searchInput = document.getElementById('global-search-input');
    this.resultsOverlay = document.getElementById('search-results-overlay');

    this.init();
  }

  init() {
    if (!this.searchInput || !this.resultsOverlay) return;

    this.searchInput.addEventListener('input', () => this.handleSearch());
    this.searchInput.addEventListener('focus', () => {
      if (this.searchInput.value.trim().length >= 2) {
        this.resultsOverlay.classList.add('active');
      }
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.searchInput.contains(e.target) && !this.resultsOverlay.contains(e.target)) {
        this.resultsOverlay.classList.remove('active');
      }
    });
  }

  async handleSearch() {
    const query = this.searchInput.value.trim().toLowerCase();

    if (query.length < 2) {
      this.resultsOverlay.classList.remove('active');
      this.resultsOverlay.innerHTML = '';
      return;
    }

    try {
      // Search across stores
      const [diaries, notes, worklogs, goals] = await Promise.all([
        window.db.getAll('diary'),
        window.db.getAll('notes'),
        window.db.getAll('worklog'),
        window.db.getAll('goals')
      ]);

      const results = [];

      // 1. Search Diary
      diaries.forEach(d => {
        if ((d.title && d.title.toLowerCase().includes(query)) || (d.content && d.content.toLowerCase().includes(query))) {
          results.push({
            type: 'diary',
            badge: 'DIARY',
            title: d.title || d.date,
            snippet: (d.content || '').slice(0, 90) + '...',
            targetKey: d.date
          });
        }
      });

      // 2. Search College Notes
      notes.forEach(n => {
        if ((n.title && n.title.toLowerCase().includes(query)) || (n.subject && n.subject.toLowerCase().includes(query)) || (n.textContent && n.textContent.toLowerCase().includes(query))) {
          results.push({
            type: 'notes',
            badge: `NOTE (${n.subject})`,
            title: n.title,
            snippet: n.fileName ? `File: ${n.fileName}` : ((n.textContent || '').slice(0, 90) + '...'),
            targetKey: n.id
          });
        }
      });

      // 3. Search Work Log
      worklogs.forEach(w => {
        if ((w.title && w.title.toLowerCase().includes(query)) || (w.description && w.description.toLowerCase().includes(query)) || (w.tag && w.tag.toLowerCase().includes(query))) {
          results.push({
            type: 'worklog',
            badge: `WORKLOG (${w.tag})`,
            title: w.title,
            snippet: w.description || 'No description',
            targetKey: w.id
          });
        }
      });

      // 4. Search Goals
      goals.forEach(g => {
        if ((g.title && g.title.toLowerCase().includes(query)) || (g.description && g.description.toLowerCase().includes(query))) {
          results.push({
            type: 'goals',
            badge: 'GOAL',
            title: g.title,
            snippet: `${g.progress}% Complete • ${g.description || ''}`,
            targetKey: g.id
          });
        }
      });

      this.renderResults(results, query);
    } catch (err) {
      console.error('Global search error:', err);
    }
  }

  renderResults(results, query) {
    this.resultsOverlay.innerHTML = '';

    if (results.length === 0) {
      this.resultsOverlay.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No matching results found for "<strong>${this.escapeHtml(query)}</strong>"
        </div>
      `;
      this.resultsOverlay.classList.add('active');
      return;
    }

    results.forEach(res => {
      const item = document.createElement('div');
      item.className = 'search-result-item';

      item.innerHTML = `
        <div class="search-result-title">
          <span>${this.escapeHtml(res.title)}</span>
          <span class="badge badge-project" style="font-size: 9px; padding: 2px 6px;">${res.badge}</span>
        </div>
        <div class="search-result-snippet">${this.escapeHtml(res.snippet)}</div>
      `;

      item.addEventListener('click', () => {
        this.navigateToResult(res);
      });

      this.resultsOverlay.appendChild(item);
    });

    this.resultsOverlay.classList.add('active');
  }

  navigateToResult(res) {
    this.resultsOverlay.classList.remove('active');
    this.searchInput.value = '';

    if (window.appRouter) {
      window.appRouter.switchTab(res.type);
    }

    if (res.type === 'diary' && window.diaryModule) {
      window.diaryModule.currentDate = res.targetKey;
      window.diaryModule.datePicker.value = res.targetKey;
      window.diaryModule.loadEntryForDate(res.targetKey);
    }

    if (res.type === 'notes' && window.notesModule) {
      window.notesModule.viewNote(res.targetKey);
    }
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

window.searchModule = new SearchModule();
