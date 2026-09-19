/**
 * Apex Personal Dashboard - Courses & Skill Tracks Module
 * Promoted free and paid courses with one-click "🛒 Add to Buy List" integration.
 */

class CoursesModule {
  constructor() {
    this.savedItems = new Set();
    this.courses = [
      { id: 'c1', title: 'Full-Stack Web Development Bootcamp', provider: 'freeCodeCamp', price: 0, priceLabel: 'FREE', rating: '4.9 ⭐', duration: '40 hrs', tag: 'Web Dev', url: 'https://www.freecodecamp.org/' },
      { id: 'c2', title: 'Data Structures & Algorithms in Java / C++', provider: 'Udemy', price: 499, priceLabel: '₹499', rating: '4.8 ⭐', duration: '32 hrs', tag: 'DSA', url: 'https://www.udemy.com/' },
      { id: 'c3', title: 'Machine Learning & AI Specialization', provider: 'Coursera', price: 799, priceLabel: '₹799', rating: '4.9 ⭐', duration: '60 hrs', tag: 'AI / ML', url: 'https://www.coursera.org/' },
      { id: 'c4', title: 'Cloud Computing & AWS Solutions Architect', provider: 'AWS Skill Builder', price: 0, priceLabel: 'FREE', rating: '4.7 ⭐', duration: '25 hrs', tag: 'Cloud', url: 'https://explore.skillbuilder.aws/' },
      { id: 'c5', title: 'Cybersecurity & Ethical Hacking Essentials', provider: 'TryHackMe', price: 0, priceLabel: 'FREE', rating: '4.8 ⭐', duration: '30 hrs', tag: 'Security', url: 'https://tryhackme.com/' },
      { id: 'c6', title: 'System Design & Distributed Architectures', provider: 'Educative', price: 999, priceLabel: '₹999', rating: '4.9 ⭐', duration: '20 hrs', tag: 'Architecture', url: 'https://www.educative.io/' }
    ];

    this.init();
  }

  init() {
    this.renderCourses();
  }

  async saveToBuyList(course) {
    if (!window.db) return;
    try {
      const itemObj = {
        name: `🎓 Course: ${course.title} (${course.provider})`,
        price: course.price,
        saved: 0,
        status: course.price === 0 ? 'bought' : 'saving',
        createdAt: new Date().toISOString()
      };

      await window.db.put('buylist', itemObj);
      this.savedItems.add(course.id);
      this.renderCourses();

      if (window.buyListModule) {
        window.buyListModule.renderBuyList();
      }

      if (window.socialModule && window.socialModule.showToast) {
        window.socialModule.showToast(`Added "${course.title}" to Buy List 🛒!`, 'success');
      } else {
        alert(`Added "${course.title}" to Buy List 🛒!`);
      }
    } catch (err) {
      console.error('Error adding course to buy list:', err);
    }
  }

  renderCourses() {
    const container = document.getElementById('courses-grid-container');
    if (!container) return;

    container.innerHTML = this.courses.map(course => {
      const isSaved = this.savedItems.has(course.id);
      return `
        <div class="glass-panel" style="padding: 22px; border-radius: var(--radius-card); display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--border-subtle); transition: var(--transition-smooth);">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 11px; padding: 4px 12px; border-radius: 20px; background: rgba(255,255,255,0.08); color: var(--text-muted); font-weight: 600;">${course.tag}</span>
              <span style="font-size: 13px; font-weight: 800; color: ${course.price === 0 ? '#34d399' : '#ffffff'};">${course.priceLabel}</span>
            </div>
            <h3 style="font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 6px; line-height: 1.4;">${course.title}</h3>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px; display: flex; gap: 12px;">
              <span>🏛️ ${course.provider}</span>
              <span>⭐ ${course.rating}</span>
              <span>⏱️ ${course.duration}</span>
            </div>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 14px;">
            <a href="${course.url}" target="_blank" class="btn-ghost" style="flex: 1; text-align: center; text-decoration: none; padding: 10px 14px; font-size: 12px; font-weight: 600; border-radius: var(--radius-pill);">Explore</a>
            <button onclick="window.coursesModule.saveToBuyList(window.coursesModule.courses.find(c => c.id === '${course.id}'))" class="${isSaved ? 'btn-ghost' : 'btn-primary'}" style="flex: 1; padding: 10px 14px; font-size: 12px; justify-content: center; border-radius: var(--radius-pill); ${isSaved ? 'color:#34d399; border-color:rgba(52,211,153,0.4);' : ''}">
              ${isSaved ? '✅ Saved' : '🛒 Save to Buy List'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

window.CoursesModule = CoursesModule;
document.addEventListener('DOMContentLoaded', () => {
  window.coursesModule = new CoursesModule();
});
