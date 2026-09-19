/**
 * Apex Personal Dashboard - Competition Hub & Leaderboard Module
 * Allows students to link GitHub, LeetCode, and CodeChef profiles,
 * fetches public statistics, calculates Apex Score, and renders
 * Global vs College-Only Leaderboards strictly with REAL registered users.
 */

class CompetitionModule {
  constructor() {
    this.currentFilter = 'global'; // 'global' | 'college'
    this.leaderboardData = [];
    this.userProfiles = this.loadLocalProfile();

    this.init();
  }

  init() {
    this.wireEvents();
    this.loadLeaderboard();
  }

  loadLocalProfile() {
    try {
      const raw = localStorage.getItem('apex_competition_profile');
      return raw ? JSON.parse(raw) : {
        github: '',
        leetcode: '',
        codechef: '',
        solvedCount: 0,
        score: 0
      };
    } catch (e) {
      return { github: '', leetcode: '', codechef: '', solvedCount: 0, score: 0 };
    }
  }

  saveLocalProfile(profile) {
    this.userProfiles = profile;
    localStorage.setItem('apex_competition_profile', JSON.stringify(profile));
  }

  wireEvents() {
    // Filter tabs: Global vs My College
    const globalBtn = document.getElementById('tab-leaderboard-global');
    const collegeBtn = document.getElementById('tab-leaderboard-college');

    if (globalBtn) {
      globalBtn.addEventListener('click', () => {
        this.currentFilter = 'global';
        if (globalBtn) globalBtn.classList.add('active');
        if (collegeBtn) collegeBtn.classList.remove('active');
        this.renderLeaderboard();
      });
    }

    if (collegeBtn) {
      collegeBtn.addEventListener('click', () => {
        this.currentFilter = 'college';
        if (collegeBtn) collegeBtn.classList.add('active');
        if (globalBtn) globalBtn.classList.remove('active');
        this.renderLeaderboard();
      });
    }

    // Modal triggers & form submission
    const linkBtn = document.getElementById('btn-open-link-profiles');
    if (linkBtn) {
      linkBtn.addEventListener('click', () => this.openProfileModal());
    }

    const form = document.getElementById('form-link-profiles');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.syncAndSaveProfiles();
      });
    }

    document.querySelectorAll('[data-close="modal-link-profiles"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeProfileModal());
    });
  }

  openProfileModal() {
    const modal = document.getElementById('modal-link-profiles');
    const ghInput = document.getElementById('input-github-handle');
    const lcInput = document.getElementById('input-leetcode-handle');
    const ccInput = document.getElementById('input-codechef-handle');

    if (ghInput) ghInput.value = this.userProfiles.github || '';
    if (lcInput) lcInput.value = this.userProfiles.leetcode || '';
    if (ccInput) ccInput.value = this.userProfiles.codechef || '';

    if (modal) modal.classList.add('active');
  }

  closeProfileModal() {
    const modal = document.getElementById('modal-link-profiles');
    if (modal) modal.classList.remove('active');
  }

  // Extract clean username from raw link or handle
  cleanHandle(input) {
    if (!input) return '';
    let str = input.trim();
    if (str.endsWith('/')) str = str.slice(0, -1);
    const parts = str.split('/');
    return parts[parts.length - 1].replace('@', '');
  }

  async syncAndSaveProfiles() {
    const ghRaw = document.getElementById('input-github-handle')?.value || '';
    const lcRaw = document.getElementById('input-leetcode-handle')?.value || '';
    const ccRaw = document.getElementById('input-codechef-handle')?.value || '';

    const github = this.cleanHandle(ghRaw);
    const leetcode = this.cleanHandle(lcRaw);
    const codechef = this.cleanHandle(ccRaw);

    const btnSubmit = document.querySelector('#form-link-profiles button[type="submit"]');
    if (btnSubmit) btnSubmit.innerText = 'Syncing Stats... ⏳';

    let lcSolved = 0;
    let ghRepos = 0;

    // 1. Fetch LeetCode stats
    if (leetcode) {
      try {
        const res = await fetch(`https://leetcode-stats-api.herokuapp.com/${leetcode}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success') {
            lcSolved = data.totalSolved || 0;
          }
        }
      } catch (err) {
        console.warn('LeetCode API fetch error:', err);
      }
    }

    // 2. Fetch GitHub stats
    if (github) {
      try {
        const res = await fetch(`https://api.github.com/users/${github}`);
        if (res.ok) {
          const data = await res.json();
          ghRepos = data.public_repos || 0;
        }
      } catch (err) {
        console.warn('GitHub API fetch error:', err);
      }
    }

    // Get current streak days
    let streakDays = 0;
    if (window.streakModule && window.streakModule.currentStreak) {
      streakDays = window.streakModule.currentStreak;
    }

    // Calculate Apex Score
    const totalScore = (lcSolved * 10) + (ghRepos * 15) + (streakDays * 20);

    const profileData = {
      github,
      leetcode,
      codechef,
      solvedCount: lcSolved,
      repos: ghRepos,
      streakDays: streakDays,
      score: totalScore,
      updatedAt: new Date().toISOString()
    };

    this.saveLocalProfile(profileData);

    // Sync to Firestore leaderboards collection
    const currentUser = window.fbAuth ? window.fbAuth.currentUser : null;
    const userHandle = localStorage.getItem('apex_chat_handle') || (currentUser ? currentUser.displayName : 'Anonymous Student');
    const userEmail = currentUser ? currentUser.email : '';
    const userDomain = userEmail.includes('@') ? userEmail.split('@')[1] : '';

    if (window.fbDb && currentUser) {
      try {
        await window.fbDb.collection('leaderboards').doc(currentUser.uid).set({
          uid: currentUser.uid,
          displayName: userHandle,
          email: userEmail,
          collegeDomain: userDomain,
          github: github,
          leetcode: leetcode,
          codechef: codechef,
          solvedCount: lcSolved,
          repos: ghRepos,
          streakDays: streakDays,
          score: totalScore,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn('Firestore leaderboard update error:', e);
      }
    }

    if (btnSubmit) btnSubmit.innerText = 'Sync & Save Profiles';
    this.closeProfileModal();

    if (window.socialModule && window.socialModule.showToast) {
      window.socialModule.showToast(`Profiles Synced! Score: ${totalScore} pts 🏆`, 'success');
    } else {
      alert(`Profiles Synced! Score: ${totalScore} pts 🏆`);
    }

    await this.loadLeaderboard();
  }

  async loadLeaderboard() {
    if (window.fbDb) {
      try {
        const snapshot = await window.fbDb.collection('leaderboards')
          .orderBy('score', 'desc')
          .limit(50)
          .get();

        const items = [];
        snapshot.forEach(doc => items.push(doc.data()));
        this.leaderboardData = items;
      } catch (err) {
        console.warn('Firestore leaderboard query error:', err);
        this.leaderboardData = this.getRealLocalUserOnly();
      }
    } else {
      this.leaderboardData = this.getRealLocalUserOnly();
    }

    // If Firestore is empty, include local user profile if linked
    if (this.leaderboardData.length === 0 && (this.userProfiles.github || this.userProfiles.leetcode)) {
      this.leaderboardData = this.getRealLocalUserOnly();
    }

    this.renderLeaderboard();
  }

  getRealLocalUserOnly() {
    const myProfile = this.userProfiles;
    if (!myProfile.github && !myProfile.leetcode && !myProfile.score) return [];

    const currentUser = window.fbAuth ? window.fbAuth.currentUser : null;
    const userHandle = localStorage.getItem('apex_chat_handle') || (currentUser ? currentUser.displayName : 'You');
    const userEmail = currentUser ? currentUser.email : '';
    const userDomain = userEmail.includes('@') ? userEmail.split('@')[1] : '';

    return [
      {
        uid: currentUser ? currentUser.uid : 'user_me',
        displayName: userHandle,
        email: userEmail,
        collegeDomain: userDomain,
        solvedCount: myProfile.solvedCount || 0,
        repos: myProfile.repos || 0,
        streakDays: myProfile.streakDays || 0,
        score: myProfile.score || 0,
        github: myProfile.github,
        leetcode: myProfile.leetcode
      }
    ];
  }

  renderLeaderboard() {
    const container = document.getElementById('competition-leaderboard-list');
    if (!container) return;

    const currentUser = window.fbAuth ? window.fbAuth.currentUser : null;
    const myEmail = currentUser ? currentUser.email : '';
    const myDomain = myEmail.includes('@') ? myEmail.split('@')[1] : '';

    const list = this.leaderboardData.filter(item => {
      if (this.currentFilter === 'college') {
        if (!myDomain) return true;
        return (item.collegeDomain || '').toLowerCase() === myDomain.toLowerCase();
      }
      return true;
    });

    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:50px 20px; color:var(--text-muted); background:rgba(255,255,255,0.02); border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div style="font-size:36px; margin-bottom:10px;">🏆</div>
          <h4 style="font-size:16px; font-weight:700; color:#fff; margin-bottom:6px;">No Ranked Profiles Yet</h4>
          <p style="font-size:13px; max-width:400px; margin:0 auto 16px auto; line-height:1.5;">Be the first to join the Leaderboard! Click <strong>"Link Profiles"</strong> above to sync your GitHub and LeetCode stats.</p>
          <button class="btn-primary" onclick="window.competitionModule.openProfileModal()" style="width:auto; display:inline-block; padding:8px 20px;">🔗 Link Your Profiles</button>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map((item, index) => {
      const rank = index + 1;
      let badge = `#${rank}`;
      if (rank === 1) badge = '🥇 1st';
      if (rank === 2) badge = '🥈 2nd';
      if (rank === 3) badge = '🥉 3rd';

      const initial = (item.displayName || 'U').charAt(0).toUpperCase();
      const domain = item.collegeDomain || '';
      const isEdu = domain.includes('.edu') || domain.includes('.ac.');

      return `
        <div class="glass-panel" style="display:flex; align-items:center; gap:14px; padding:14px 18px; margin-bottom:10px; border-radius:var(--radius-md);">
          <div style="font-size:16px; font-weight:800; min-width:50px; color:${rank <= 3 ? '#ffffff' : 'var(--text-muted)'};">${badge}</div>
          <div style="width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.12); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:15px; color:#fff; border:1px solid rgba(255,255,255,0.2);">${initial}</div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:14px; font-weight:700; color:#fff;">${this.escapeHtml(item.displayName)}</span>
              ${isEdu ? `<span style="font-size:10px; padding:2px 6px; border-radius:10px; background:rgba(52,211,153,0.15); color:#34d399; border:1px solid rgba(52,211,153,0.3);">Verified ${this.escapeHtml(domain)}</span>` : ''}
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:3px; display:flex; gap:12px;">
              ${item.leetcode ? `<span>🧩 LeetCode: <strong>${item.solvedCount || 0}</strong> solved</span>` : ''}
              ${item.github ? `<span>🐙 GitHub: <strong>${item.repos || 0}</strong> repos</span>` : ''}
              <span>🔥 Streak: <strong>${item.streakDays || 0}d</strong></span>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:18px; font-weight:900; color:#fff;">${item.score || 0}</div>
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Apex Points</div>
          </div>
        </div>
      `;
    }).join('');
  }

  escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

window.CompetitionModule = CompetitionModule;
document.addEventListener('DOMContentLoaded', () => {
  window.competitionModule = new CompetitionModule();
});
