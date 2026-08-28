/**
 * Apex Personal Diary & Dashboard - Central App Router & Controller
 * Manages view routing, lock screen security unlock, data backup exports, and motion toggles.
 */

class AppRouter {
  constructor() {
    this.activeTab = 'diary';
    this.isUnlocked = false;

    this.unlockScreen = document.getElementById('unlock-screen');
    this.unlockForm = document.getElementById('unlock-form');
    this.pinGroup = document.getElementById('pin-group');
    this.pinInput = document.getElementById('unlock-pin');

    this.motionToggleBtn = document.getElementById('toggle-motion-btn');
    this.motionText = document.getElementById('motion-btn-text');

    this.btnExport = document.getElementById('btn-export-backup');
    this.btnLock = document.getElementById('btn-lock-app');

    this.init();
  }

  async init() {
    // 1. Check if PIN setting exists
    try {
      const pinSetting = await window.db.get('settings', 'security_pin');
      if (pinSetting && pinSetting.value) {
        this.pinGroup.style.display = 'block';
        this.pinInput.required = true;
      }
    } catch (e) {
      console.warn('Could not read PIN setting:', e);
    }

    // 2. Unlock Form Listener
    if (this.unlockForm) {
      this.unlockForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.attemptUnlock();
      });
    }

    // 3. Tab Navigation Listeners
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });

    // 4. Motion Toggle Listener
    if (this.motionToggleBtn) {
      this.motionToggleBtn.addEventListener('click', () => {
        if (window.bgMotion) {
          const isRunning = window.bgMotion.toggleMotion();
          this.motionText.innerText = isRunning ? 'Motion ON' : 'Motion OFF (Saved)';
          this.motionToggleBtn.style.color = isRunning ? '#ffffff' : 'var(--text-muted)';
        }
      });
    }

    // 5. Export Backup Listener
    if (this.btnExport) {
      this.btnExport.addEventListener('click', () => this.exportBackup());
    }

    // 6. Lock App Listener
    if (this.btnLock) {
      this.btnLock.addEventListener('click', () => this.lockApp());
    }

    // 7. Mobile Sidebar & Menu Toggle
    this.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    this.sidebar = document.getElementById('sidebar');
    this.sidebarOverlay = document.getElementById('sidebar-overlay');

    if (this.mobileMenuBtn) {
      this.mobileMenuBtn.addEventListener('click', () => this.toggleMobileSidebar());
    }
    if (this.sidebarOverlay) {
      this.sidebarOverlay.addEventListener('click', () => this.closeMobileSidebar());
    }
  }

  toggleMobileSidebar() {
    if (!this.sidebar) return;
    const isOpen = this.sidebar.classList.toggle('open');
    if (this.mobileMenuBtn) this.mobileMenuBtn.classList.toggle('active', isOpen);
    if (this.sidebarOverlay) this.sidebarOverlay.classList.toggle('active', isOpen);
  }

  closeMobileSidebar() {
    if (!this.sidebar) return;
    this.sidebar.classList.remove('open');
    if (this.mobileMenuBtn) this.mobileMenuBtn.classList.remove('active');
    if (this.sidebarOverlay) this.sidebarOverlay.classList.remove('active');
  }

  async attemptUnlock() {
    try {
      const pinSetting = await window.db.get('settings', 'security_pin');
      if (pinSetting && pinSetting.value) {
        if (this.pinInput.value !== pinSetting.value) {
          alert('Incorrect PIN. Please try again.');
          return;
        }
      }

      this.isUnlocked = true;
      this.unlockScreen.classList.add('hidden');
    } catch (err) {
      console.error('Unlock error:', err);
      this.unlockScreen.classList.add('hidden');
    }
  }

  lockApp() {
    this.isUnlocked = false;
    if (this.pinInput) this.pinInput.value = '';
    this.unlockScreen.classList.remove('hidden');
  }

  switchTab(targetTab) {
    if (this.activeTab === targetTab) return;

    const currentPanel = document.getElementById(`view-${this.activeTab}`);
    const targetPanel = document.getElementById(`view-${targetTab}`);

    if (!targetPanel) return;

    // Update Nav Links
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-tab') === targetTab) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Hide Current Panel
    if (currentPanel) {
      currentPanel.classList.remove('active');
    }

    // Show Target Panel with Slide FX
    targetPanel.classList.add('active');
    targetPanel.classList.remove('slide-in-right', 'slide-in-left');

    const navOrder = ['diary', 'notes', 'worklog', 'timetable', 'goals', 'buylist', 'songs', 'streak'];
    const prevIdx = navOrder.indexOf(this.activeTab);
    const newIdx = navOrder.indexOf(targetTab);

    if (newIdx > prevIdx) {
      targetPanel.classList.add('slide-in-right');
    } else {
      targetPanel.classList.add('slide-in-left');
    }

    this.activeTab = targetTab;
    this.closeMobileSidebar();

    // Refresh modules on tab switch
    if (targetTab === 'diary' && window.diaryModule) window.diaryModule.loadHistoryList();
    if (targetTab === 'notes' && window.notesModule) window.notesModule.renderNotesList();
    if (targetTab === 'worklog' && window.worklogModule) window.worklogModule.renderWorklogs();
    if (targetTab === 'timetable' && window.timetableModule) window.timetableModule.renderGrid();
    if (targetTab === 'goals' && window.goalsModule) window.goalsModule.renderGoals();
    if (targetTab === 'buylist' && window.buyListModule) window.buyListModule.renderBuyList();
    if (targetTab === 'songs' && window.songsModule) window.songsModule.renderPlaylist();
    if (targetTab === 'streak' && window.streakModule) window.streakModule.renderHeatmap();
  }

  async exportBackup() {
    try {
      const data = await window.db.exportAllData();
      const jsonStr = JSON.stringify(data, null, 2);

      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Apex_Dashboard_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export backup:', err);
      alert('Failed to generate backup JSON.');
    }
  }
}

// Global App Instance
document.addEventListener('DOMContentLoaded', () => {
  window.appRouter = new AppRouter();
});
