/**
 * Personal Goals Module
 * Goal tracking cards with custom progress slider and interactive milestones.
 */

class GoalsModule {
  constructor() {
    this.modal = document.getElementById('modal-goal');
    this.form = document.getElementById('form-goal');
    this.grid = document.getElementById('goals-list-grid');

    this.titleInput = document.getElementById('goal-title');
    this.descInput = document.getElementById('goal-desc');
    this.progressInput = document.getElementById('goal-progress');
    this.progressValLabel = document.getElementById('goal-progress-val');

    this.init();
  }

  init() {
    if (!this.grid) return;

    const openBtn = document.getElementById('btn-open-goal-modal');
    if (openBtn) {
      openBtn.addEventListener('click', () => this.openModal());
    }

    document.querySelectorAll('[data-close="modal-goal"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    if (this.progressInput) {
      this.progressInput.addEventListener('input', (e) => {
        this.progressValLabel.innerText = `${e.target.value}%`;
      });
    }

    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addGoal();
      });
    }

    this.renderGoals();
  }

  openModal() {
    if (this.modal) this.modal.classList.add('active');
  }

  closeModal() {
    if (this.modal) this.modal.classList.remove('active');
    if (this.form) this.form.reset();
    if (this.progressValLabel) this.progressValLabel.innerText = '0%';
  }

  async addGoal() {
    const title = this.titleInput.value.trim();
    const description = this.descInput.value.trim();
    const progress = parseInt(this.progressInput.value) || 0;

    if (!title) return;

    const goalObj = {
      title,
      description,
      progress,
      createdAt: new Date().toISOString()
    };

    try {
      await window.db.put('goals', goalObj);
      this.closeModal();
      this.renderGoals();
    } catch (err) {
      console.error('Failed to add goal:', err);
    }
  }

  async updateProgress(id, newProgress) {
    try {
      const goal = await window.db.get('goals', id);
      if (goal) {
        goal.progress = Math.min(100, Math.max(0, newProgress));
        await window.db.put('goals', goal);
        this.renderGoals();
      }
    } catch (err) {
      console.error('Failed to update goal progress:', err);
    }
  }

  async deleteGoal(id) {
    if (!confirm('Delete this goal?')) return;
    try {
      await window.db.delete('goals', id);
      this.renderGoals();
    } catch (err) {
      console.error('Failed to delete goal:', err);
    }
  }

  async renderGoals() {
    try {
      const goals = await window.db.getAll('goals');
      this.grid.innerHTML = '';

      if (goals.length === 0) {
        this.grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px 0; color: var(--text-muted);">
            <p>No goals set yet. Click <strong>+ Add Goal</strong> to define your milestones!</p>
          </div>
        `;
        return;
      }

      for (const item of goals) {
        const card = document.createElement('div');
        card.className = 'glass-card';

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #fff;">${this.escapeHtml(item.title)}</h3>
            <span style="font-size: 14px; font-weight: 700; color: var(--accent-cyan);">${item.progress}%</span>
          </div>

          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 14px; line-height: 1.5;">${this.escapeHtml(item.description || 'No detailed strategy.')}</p>

          <div class="progress-container">
            <div class="progress-fill" style="width: ${item.progress}%;"></div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
            <div style="display: flex; gap: 6px;">
              <button class="btn-ghost quick-step-btn" data-step="-10" style="padding: 4px 8px; font-size: 11px;">-10%</button>
              <button class="btn-ghost quick-step-btn" data-step="+10" style="padding: 4px 8px; font-size: 11px;">+10%</button>
            </div>
            <button class="btn-ghost delete-goal-btn" style="padding: 4px 8px; font-size: 12px; color: var(--accent-red); border-color: rgba(255,82,82,0.2);">Delete</button>
          </div>
        `;

        card.querySelectorAll('.quick-step-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const delta = parseInt(e.target.getAttribute('data-step'));
            this.updateProgress(item.id, item.progress + delta);
          });
        });

        card.querySelector('.delete-goal-btn').addEventListener('click', () => {
          this.deleteGoal(item.id);
        });

        this.grid.appendChild(card);
      }
    } catch (err) {
      console.error('Error rendering goals:', err);
    }
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

window.goalsModule = new GoalsModule();
