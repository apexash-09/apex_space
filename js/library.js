/**
 * Apex Personal Dashboard - Digital Library & Textbook Marketplace Module
 * Academic textbooks, open access research papers, and one-click "🛒 Add to Buy List" integration.
 */

class LibraryModule {
  constructor() {
    this.savedBooks = new Set();
    this.books = [
      { id: 'b1', title: 'Clean Code: A Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin', category: 'Computer Science', price: 599, priceLabel: '₹599', isFreePdf: false, url: 'https://openlibrary.org/' },
      { id: 'b2', title: 'Introduction to Algorithms (CLRS 4th Ed)', author: 'Cormen, Leiserson, Rivest', category: 'Algorithms', price: 899, priceLabel: '₹899', isFreePdf: false, url: 'https://openlibrary.org/' },
      { id: 'b3', title: 'Operating System Concepts (Silberschatz)', author: 'Silberschatz, Galvin, Gagne', category: 'Computer Science', price: 0, priceLabel: 'FREE Open Access', isFreePdf: true, url: 'https://openlibrary.org/' },
      { id: 'b4', title: 'Design Patterns: Elements of Reusable Object-Oriented Software', author: 'Gang of Four (GoF)', category: 'Software Design', price: 650, priceLabel: '₹650', isFreePdf: false, url: 'https://openlibrary.org/' },
      { id: 'b5', title: 'Calculus & Analytical Geometry', author: 'George B. Thomas', category: 'Mathematics', price: 0, priceLabel: 'FREE Open Access', isFreePdf: true, url: 'https://openlibrary.org/' },
      { id: 'b6', title: 'University Physics with Modern Physics', author: 'Sears & Zemansky', category: 'Physics', price: 0, priceLabel: 'FREE Open Access', isFreePdf: true, url: 'https://openlibrary.org/' }
    ];

    this.init();
  }

  init() {
    this.renderLibrary();
  }

  async saveToBuyList(book) {
    if (!window.db) return;
    try {
      const itemObj = {
        name: `📖 Book: ${book.title} (${book.author})`,
        price: book.price,
        saved: 0,
        status: book.price === 0 ? 'bought' : 'saving',
        createdAt: new Date().toISOString()
      };

      await window.db.put('buylist', itemObj);
      this.savedBooks.add(book.id);
      this.renderLibrary();

      if (window.buyListModule) {
        window.buyListModule.renderBuyList();
      }

      if (window.socialModule && window.socialModule.showToast) {
        window.socialModule.showToast(`Added "${book.title}" to Buy List 🛒!`, 'success');
      } else {
        alert(`Added "${book.title}" to Buy List 🛒!`);
      }
    } catch (err) {
      console.error('Error adding book to buy list:', err);
    }
  }

  renderLibrary() {
    const container = document.getElementById('library-books-grid');
    if (!container) return;

    container.innerHTML = this.books.map(book => {
      const isSaved = this.savedBooks.has(book.id);
      return `
        <div class="glass-panel" style="padding: 18px; border-radius: var(--radius-card); display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--border-subtle);">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 11px; padding: 3px 8px; border-radius: 12px; background: rgba(255,255,255,0.08); color: var(--text-muted); font-weight: 600;">${book.category}</span>
              <span style="font-size: 12px; font-weight: 800; color: ${book.isFreePdf ? '#34d399' : '#ffffff'};">${book.priceLabel}</span>
            </div>
            <div style="font-size: 32px; margin-bottom: 8px; text-align: center;">📖</div>
            <h3 style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px; line-height: 1.4; text-align: center;">${book.title}</h3>
            <p style="font-size: 12px; color: var(--text-muted); text-align: center; margin-bottom: 14px;">by ${book.author}</p>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <a href="${book.url}" target="_blank" class="btn-ghost" style="flex: 1; text-align: center; text-decoration: none; padding: 8px; font-size: 11px; font-weight: 600;">Open Book</a>
            <button onclick="window.libraryModule.saveToBuyList(window.libraryModule.books.find(b => b.id === '${book.id}'))" class="${isSaved ? 'btn-ghost' : 'btn-primary'}" style="flex: 1; padding: 8px; font-size: 11px; justify-content: center; ${isSaved ? 'color:#34d399; border-color:rgba(52,211,153,0.4);' : ''}">
              ${isSaved ? '✅ Saved' : '🛒 Buy List'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.LibraryModule = LibraryModule;
document.addEventListener('DOMContentLoaded', () => {
  window.libraryModule = new LibraryModule();
});
