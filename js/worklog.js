/**
 * Personal Work Log Module
 * Task logger tagged as Project, College, Freelance, or Misc with filter tabs.
 */

class WorklogModule {
  constructor() {
    this.currentFilter = 'all';
    this.modal = document.getElementById('modal-worklog');
    this.form = document.getElementById('form-worklog');
    this.grid = document.getElementById('worklog-cards-grid');

    this.titleInput = document.getElementById('work-title');
    this.tagInput = document.getElementById('work-tag');
    this.dateInput = document.getElementById('work-date');
    this.descInput = document.getElementById('work-desc');

    this.init();
  }

  init() {
    if (!this.grid) return;

    // Filter Buttons
    document.querySelectorAll('.work-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.work-filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.getAttribute('data-tag');
        this.renderWorklogs();
      });
    });

    // Modal Trigger Buttons
    const openBtn = document.getElementById('btn-open-worklog-modal');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        this.dateInput.value = new Date().toISOString().split('T')[0];
        this.openModal();
      });
    }

    document.querySelectorAll('[data-close="modal-worklog"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    // Form Submit
    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addWorklog();
      });
    }

    this.renderWorklogs();
  }

  openModal() {
    if (this.modal) this.modal.classList.add('active');
  }

  closeModal() {
    if (this.modal) this.modal.classList.remove('active');
    if (this.form) this.form.reset();
  }

  async addWorklog() {
    const title = this.titleInput.value.trim();
    const tag = this.tagInput.value;
    const date = this.dateInput.value;
    const description = this.descInput.value.trim();

    if (!title || !date) return;

    const logObj = {
      title,
      tag,
      date,
      description,
      createdAt: new Date().toISOString()
    };

    try {
      await window.db.put('worklog', logObj);
      this.closeModal();
      this.renderWorklogs();
    } catch (err) {
      console.error('Failed to add worklog:', err);
    }
  }

  async deleteWorklog(id) {
    if (!confirm('Are you sure you want to delete this work log?')) return;
    try {
      await window.db.delete('worklog', id);
      this.renderWorklogs();
    } catch (err) {
      console.error('Failed to delete worklog:', err);
    }
  }

  async renderWorklogs() {
    try {
      const logs = await window.db.getAll('worklog');
      logs.sort((a, b) => b.date.localeCompare(a.date)); // Descending by date

      const filtered = this.currentFilter === 'all'
        ? logs
        : logs.filter(l => l.tag === this.currentFilter);

      this.grid.innerHTML = '';

      if (filtered.length === 0) {
        this.grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px 0; color: var(--text-muted);">
            <p>No work log entries found for tag: <strong style="color: var(--accent-cyan);">${this.currentFilter}</strong></p>
          </div>
        `;
        return;
      }

      for (const item of filtered) {
        const card = document.createElement('div');
        card.className = 'glass-card';

        const dateFormatted = new Date(item.date + 'T00:00:00').toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', year: 'numeric'
        });

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span class="badge badge-${item.tag}">${item.tag}</span>
            <span style="font-size: 12px; color: var(--text-muted);">📅 ${dateFormatted}</span>
          </div>
          <h3 style="font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 8px;">${this.escapeHtml(item.title)}</h3>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">${this.escapeHtml(item.description || 'No detailed description.')}</p>
          <div style="display: flex; justify-content: flex-end;">
            <button class="btn-ghost delete-work-btn" style="padding: 4px 8px; font-size: 12px; color: var(--accent-red); border-color: rgba(255,82,82,0.2);">Delete</button>
          </div>
        `;

        card.querySelector('.delete-work-btn').addEventListener('click', () => {
          this.deleteWorklog(item.id);
        });

        this.grid.appendChild(card);
      }
    } catch (err) {
      console.error('Error rendering worklogs:', err);
    }
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

window.worklogModule = new WorklogModule();
