/**
 * Personal Buy List Module
 * Wishlist tracker with price, savings meter, status (saving/bought), and deposit modal.
 */

class BuyListModule {
  constructor() {
    this.modalBuy = document.getElementById('modal-buy');
    this.formBuy = document.getElementById('form-buy');

    this.modalDeposit = document.getElementById('modal-deposit');
    this.formDeposit = document.getElementById('form-deposit');

    this.grid = document.getElementById('buylist-items-grid');

    this.nameInput = document.getElementById('buy-name');
    this.priceInput = document.getElementById('buy-price');
    this.savedInput = document.getElementById('buy-saved');

    this.depositItemIdInput = document.getElementById('deposit-item-id');
    this.depositItemTitleLabel = document.getElementById('deposit-item-title');
    this.depositAmountInput = document.getElementById('deposit-amount');

    this.init();
  }

  init() {
    if (!this.grid) return;

    // Triggers
    const openBuyBtn = document.getElementById('btn-open-buy-modal');
    if (openBuyBtn) {
      openBuyBtn.addEventListener('click', () => this.openBuyModal());
    }

    document.querySelectorAll('[data-close="modal-buy"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeBuyModal());
    });

    document.querySelectorAll('[data-close="modal-deposit"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeDepositModal());
    });

    if (this.formBuy) {
      this.formBuy.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addBuyItem();
      });
    }

    if (this.formDeposit) {
      this.formDeposit.addEventListener('submit', (e) => {
        e.preventDefault();
        this.processDeposit();
      });
    }

    this.renderBuyList();
  }

  openBuyModal() {
    if (this.modalBuy) this.modalBuy.classList.add('active');
  }

  closeBuyModal() {
    if (this.modalBuy) this.modalBuy.classList.remove('active');
    if (this.formBuy) this.formBuy.reset();
  }

  openDepositModal(item) {
    this.depositItemIdInput.value = item.id;
    this.depositItemTitleLabel.innerText = `Add funds for "${item.name}" (Target: $${item.price.toFixed(2)})`;
    if (this.modalDeposit) this.modalDeposit.classList.add('active');
  }

  closeDepositModal() {
    if (this.modalDeposit) this.modalDeposit.classList.remove('active');
    if (this.formDeposit) this.formDeposit.reset();
  }

  async addBuyItem() {
    const name = this.nameInput.value.trim();
    const price = parseFloat(this.priceInput.value);
    const saved = parseFloat(this.savedInput.value) || 0;

    if (!name || isNaN(price) || price <= 0) return;

    const status = saved >= price ? 'bought' : 'saving';

    const itemObj = {
      name,
      price,
      saved,
      status,
      createdAt: new Date().toISOString()
    };

    try {
      await window.db.put('buylist', itemObj);
      this.closeBuyModal();
      this.renderBuyList();
    } catch (err) {
      console.error('Failed to add wishlist item:', err);
    }
  }

  async processDeposit() {
    const id = parseInt(this.depositItemIdInput.value);
    const amount = parseFloat(this.depositAmountInput.value);

    if (isNaN(amount) || amount <= 0) return;

    try {
      const item = await window.db.get('buylist', id);
      if (item) {
        item.saved += amount;
        if (item.saved >= item.price) {
          item.status = 'bought';
        }
        await window.db.put('buylist', item);
        this.closeDepositModal();
        this.renderBuyList();
      }
    } catch (err) {
      console.error('Failed to process deposit:', err);
    }
  }

  async toggleStatus(id) {
    try {
      const item = await window.db.get('buylist', id);
      if (item) {
        item.status = item.status === 'bought' ? 'saving' : 'bought';
        if (item.status === 'bought' && item.saved < item.price) {
          item.saved = item.price; // Auto fill saved to target
        }
        await window.db.put('buylist', item);
        this.renderBuyList();
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  }

  async deleteItem(id) {
    if (!confirm('Remove item from buy list?')) return;
    try {
      await window.db.delete('buylist', id);
      this.renderBuyList();
    } catch (err) {
      console.error('Failed to delete wishlist item:', err);
    }
  }

  async renderBuyList() {
    try {
      const items = await window.db.getAll('buylist');
      this.grid.innerHTML = '';

      if (items.length === 0) {
        this.grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 40px 0; color: var(--text-muted);">
            <p>Your wishlist is empty. Click <strong>+ Add Item</strong> to start tracking savings!</p>
          </div>
        `;
        return;
      }

      for (const item of items) {
        const card = document.createElement('div');
        card.className = 'glass-card';

        const pct = Math.min(100, Math.round((item.saved / item.price) * 100));
        const isBought = item.status === 'bought';

        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #fff;">${this.escapeHtml(item.name)}</h3>
            <span class="badge ${isBought ? 'badge-freelance' : 'badge-misc'}">${isBought ? 'Bought ✓' : 'Saving'}</span>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
            <span>Saved: <strong style="color: var(--accent-cyan);">$${item.saved.toFixed(2)}</strong></span>
            <span>Target: <strong style="color: #fff;">$${item.price.toFixed(2)}</strong></span>
          </div>

          <div class="progress-container">
            <div class="progress-fill" style="width: ${pct}%; ${isBought ? 'background: linear-gradient(90deg, #00e676, #00b0ff);' : ''}"></div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px;">
            ${!isBought ? `<button class="btn-ghost deposit-btn" style="padding: 4px 10px; font-size: 12px; color: var(--accent-cyan);">+ Add Savings</button>` : '<span></span>'}
            <div style="display: flex; gap: 6px;">
              <button class="btn-ghost toggle-status-btn" style="padding: 4px 8px; font-size: 11px;">${isBought ? 'Mark Saving' : 'Mark Bought'}</button>
              <button class="btn-ghost delete-item-btn" style="padding: 4px 8px; font-size: 12px; color: var(--accent-red); border-color: rgba(255,82,82,0.2);">Delete</button>
            </div>
          </div>
        `;

        const depositBtn = card.querySelector('.deposit-btn');
        if (depositBtn) {
          depositBtn.addEventListener('click', () => this.openDepositModal(item));
        }

        card.querySelector('.toggle-status-btn').addEventListener('click', () => {
          this.toggleStatus(item.id);
        });

        card.querySelector('.delete-item-btn').addEventListener('click', () => {
          this.deleteItem(item.id);
        });

        this.grid.appendChild(card);
      }
    } catch (err) {
      console.error('Error rendering buy list:', err);
    }
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

window.buyListModule = new BuyListModule();
