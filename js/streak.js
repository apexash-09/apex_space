/**
 * Personal Study Streak Module
 * GitHub-style 52-week SVG contribution heatmap grid with consecutive streak calculation.
 */

class StreakModule {
  constructor() {
    this.svg = document.getElementById('streak-heatmap-svg');
    this.totalActiveLabel = document.getElementById('streak-total-active-days');
    this.headerStreakLabel = document.getElementById('header-streak-count');
    this.btnStudiedToday = document.getElementById('btn-check-studied-today');

    this.init();
  }

  init() {
    if (!this.svg) return;

    if (this.btnStudiedToday) {
      this.btnStudiedToday.addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        this.recordActivity(today, 'studied');
      });
    }

    this.renderHeatmap();
  }

  async recordActivity(dateStr, activityType) {
    try {
      let record = await window.db.get('streak', dateStr);
      if (!record) {
        record = { date: dateStr, activities: [activityType] };
      } else {
        if (!record.activities.includes(activityType)) {
          record.activities.push(activityType);
        }
      }

      await window.db.put('streak', record);
      
      if (this.btnStudiedToday && activityType === 'studied') {
        const orig = this.btnStudiedToday.innerText;
        this.btnStudiedToday.innerText = 'Recorded! 🔥';
        this.btnStudiedToday.style.background = 'linear-gradient(135deg, #ff9100, #ff5252)';
        setTimeout(() => {
          this.btnStudiedToday.innerText = orig;
          this.btnStudiedToday.style.background = '';
        }, 1800);
      }

      this.renderHeatmap();
    } catch (err) {
      console.error('Failed to record streak activity:', err);
    }
  }

  async renderHeatmap() {
    try {
      const records = await window.db.getAll('streak');
      const recordsMap = {};
      records.forEach(r => recordsMap[r.date] = r.activities ? r.activities.length : 1);

      // Generate 365 days dates ending today
      const today = new Date();
      const startDate = new Date();
      startDate.setDate(today.getDate() - 364);

      let totalActiveDays = 0;
      let currentConsecutiveStreak = 0;
      let countingStreak = true;

      // Check streak working backwards from today
      const checkDate = new Date();
      while (countingStreak) {
        const dateKey = checkDate.toISOString().split('T')[0];
        if (recordsMap[dateKey] && recordsMap[dateKey] > 0) {
          currentConsecutiveStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          countingStreak = false;
        }
      }

      if (this.headerStreakLabel) {
        this.headerStreakLabel.innerText = `${currentConsecutiveStreak} Day${currentConsecutiveStreak === 1 ? '' : 's'} Streak`;
      }

      // Render 52 Weeks SVG Grid
      this.svg.innerHTML = '';
      const cellSize = 12;
      const cellGap = 3;
      const step = cellSize + cellGap;

      let col = 0;
      let curDate = new Date(startDate);

      for (let dayCount = 0; dayCount < 365; dayCount++) {
        const dateKey = curDate.toISOString().split('T')[0];
        const dayOfWeek = curDate.getDay(); // 0 is Sun, 6 is Sat

        const count = recordsMap[dateKey] || 0;
        if (count > 0) totalActiveDays++;

        let levelClass = 'heatmap-level-0';
        if (count === 1) levelClass = 'heatmap-level-1';
        else if (count === 2) levelClass = 'heatmap-level-2';
        else if (count >= 3) levelClass = 'heatmap-level-3';

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', col * step);
        rect.setAttribute('y', dayOfWeek * step);
        rect.setAttribute('width', cellSize);
        rect.setAttribute('height', cellSize);
        rect.setAttribute('class', `heatmap-cell ${levelClass}`);

        const dateFormatted = curDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        rect.innerHTML = `<title>${dateFormatted}: ${count} activity(ies)</title>`;

        this.svg.appendChild(rect);

        // Advance date
        curDate.setDate(curDate.getDate() + 1);
        if (curDate.getDay() === 0) col++;
      }

      if (this.totalActiveLabel) {
        this.totalActiveLabel.innerText = `${totalActiveDays} Total Active Days`;
      }
    } catch (err) {
      console.error('Error rendering heatmap:', err);
    }
  }
}

window.streakModule = new StreakModule();
