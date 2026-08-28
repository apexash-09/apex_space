/**
 * Apex Personal Dashboard - Firebase Authentication & Profile Manager
 * Handles Email/Password sign-in & sign-up, Google popup sign-in, session state,
 * Admin role assignment, and Firestore user profile synchronization.
 */

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.userProfile = null;
    this.isAdmin = false;

    this.authModal = document.getElementById('modal-auth');
    this.loginForm = document.getElementById('form-login');
    this.signupForm = document.getElementById('form-signup');
    this.googleSignInBtns = document.querySelectorAll('.btn-google-signin');

    this.headerUserContainer = document.getElementById('header-user-profile');
    this.sidebarUserContainer = document.getElementById('sidebar-user-card');

    this.init();
  }

  init() {
    // 1. Listen for Firebase Auth State Changes
    if (window.fbAuth) {
      window.fbAuth.onAuthStateChanged((user) => this.handleAuthStateChanged(user));
    }

    // 2. Auth Modal Form Switchers
    const btnToSignup = document.getElementById('btn-switch-to-signup');
    const btnToLogin = document.getElementById('btn-switch-to-login');
    const boxLogin = document.getElementById('auth-box-login');
    const boxSignup = document.getElementById('auth-box-signup');

    if (btnToSignup && boxLogin && boxSignup) {
      btnToSignup.addEventListener('click', (e) => {
        e.preventDefault();
        boxLogin.style.display = 'none';
        boxSignup.style.display = 'block';
      });
    }

    if (btnToLogin && boxLogin && boxSignup) {
      btnToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        boxSignup.style.display = 'none';
        boxLogin.style.display = 'block';
      });
    }

    // 3. Email/Password Sign-In
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error-msg');
        const submitBtn = this.loginForm.querySelector('button[type="submit"]');

        try {
          if (errorEl) errorEl.style.display = 'none';
          submitBtn.disabled = true;
          submitBtn.innerText = 'Signing In...';

          await window.fbAuth.signInWithEmailAndPassword(email, password);
          this.closeAuthModal();
        } catch (err) {
          console.error('Login error:', err);
          if (errorEl) {
            errorEl.innerText = this.formatAuthError(err.message);
            errorEl.style.display = 'block';
          } else {
            alert(this.formatAuthError(err.message));
          }
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Sign In';
        }
      });
    }

    // 4. Email/Password Sign-Up
    if (this.signupForm) {
      this.signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const errorEl = document.getElementById('signup-error-msg');
        const submitBtn = this.signupForm.querySelector('button[type="submit"]');

        try {
          if (errorEl) errorEl.style.display = 'none';
          submitBtn.disabled = true;
          submitBtn.innerText = 'Creating Account...';

          const userCredential = await window.fbAuth.createUserWithEmailAndPassword(email, password);
          if (name && userCredential.user) {
            await userCredential.user.updateProfile({ displayName: name });
          }
          this.closeAuthModal();
        } catch (err) {
          console.error('Signup error:', err);
          if (errorEl) {
            errorEl.innerText = this.formatAuthError(err.message);
            errorEl.style.display = 'block';
          } else {
            alert(this.formatAuthError(err.message));
          }
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerText = 'Create Account';
        }
      });
    }

    // 5. Google Sign-In Buttons
    this.googleSignInBtns.forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          await window.fbAuth.signInWithPopup(provider);
          this.closeAuthModal();
        } catch (err) {
          console.error('Google Sign-In error:', err);
          alert(this.formatAuthError(err.message));
        }
      });
    });

    // 6. Modal Close Buttons
    document.querySelectorAll('[data-close="modal-auth"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeAuthModal());
    });

    // 7. Open Auth Modal Triggers
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest('#btn-open-auth-modal')) {
        this.openAuthModal();
      }
    });
  }

  async handleAuthStateChanged(user) {
    this.currentUser = user;

    if (user) {
      const emailLower = (user.email || '').toLowerCase();
      this.isAdmin = emailLower === window.ADMIN_EMAIL.toLowerCase();

      // Sync user profile to Firestore
      try {
        const userRef = window.fbDb.collection('users').doc(user.uid);
        const profileData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL || '',
          role: this.isAdmin ? 'admin' : 'member',
          isAdmin: this.isAdmin,
          lastActive: firebase.firestore.FieldValue.serverTimestamp()
        };

        await userRef.set(profileData, { merge: true });
        this.userProfile = profileData;
      } catch (err) {
        console.warn('Could not sync user profile to Firestore:', err);
      }

      this.renderAuthenticatedUI(user);
    } else {
      this.userProfile = null;
      this.isAdmin = false;
      this.renderUnauthenticatedUI();
    }

    // Dispatch global event for Social and Song modules
    window.dispatchEvent(new CustomEvent('apex-auth-changed', {
      detail: {
        user: this.currentUser,
        profile: this.userProfile,
        isAdmin: this.isAdmin
      }
    }));
  }

  renderAuthenticatedUI(user) {
    const displayName = user.displayName || user.email.split('@')[0];
    const initial = (displayName.charAt(0) || 'U').toUpperCase();

    // Top Header User Widget (Clean, rounded, non-stretched pill)
    if (this.headerUserContainer) {
      this.headerUserContainer.innerHTML = `
        <div class="user-header-pill" style="display: flex; align-items: center; gap: 8px; padding: 4px 10px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); border-radius: 20px;">
          <div style="width: 26px; height: 26px; min-width: 26px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; overflow: hidden; flex-shrink: 0;">
            ${user.photoURL ? `<img src="${user.photoURL}" style="width: 100%; height: 100%; object-fit: cover;">` : initial}
          </div>
          <span style="font-size: 13px; font-weight: 600; color: #fff; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(displayName)}</span>
          ${this.isAdmin ? '<span class="badge badge-project" style="font-size: 8px; padding: 2px 5px; background: #ffffff; color: #000000; font-weight: 800;">ADMIN</span>' : ''}
          <button id="btn-header-signout" class="btn-ghost" style="padding: 3px 8px; font-size: 11px; border-radius: 12px; margin-left: 2px; line-height: 1; border: 1px solid rgba(255,255,255,0.25);" title="Sign Out">Sign out</button>
        </div>
      `;

      const signOutBtn = this.headerUserContainer.querySelector('#btn-header-signout');
      if (signOutBtn) {
        signOutBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.signOut();
        });
      }
    }

    // Sidebar footer user card
    if (this.sidebarUserContainer) {
      this.sidebarUserContainer.innerHTML = `
        <div style="padding: 10px 12px; border-radius: var(--radius-md); background: rgba(255,255,255,0.05); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
            <div style="width: 28px; height: 28px; min-width: 28px; border-radius: 50%; background: #fff; color: #000; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0;">
              ${initial}
            </div>
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <div style="font-size: 13px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(displayName)}</div>
              <div style="font-size: 10px; color: var(--text-muted);">${this.isAdmin ? '👑 Administrator' : '👤 Member'}</div>
            </div>
          </div>
          <button id="btn-sidebar-signout" class="btn-ghost" style="padding: 3px 8px; font-size: 11px; border-radius: 6px; flex-shrink: 0;" title="Sign Out">Sign out</button>
        </div>
      `;

      const sidebarSignOut = this.sidebarUserContainer.querySelector('#btn-sidebar-signout');
      if (sidebarSignOut) {
        sidebarSignOut.addEventListener('click', () => this.signOut());
      }
    }
  }

  renderUnauthenticatedUI() {
    if (this.headerUserContainer) {
      this.headerUserContainer.innerHTML = `
        <button id="btn-open-auth-modal" class="btn-primary" style="width: auto; padding: 6px 14px; font-size: 13px;">
          <span>☁️ Connect Cloud</span>
        </button>
      `;
    }

    if (this.sidebarUserContainer) {
      this.sidebarUserContainer.innerHTML = `
        <button id="btn-open-auth-sidebar" class="btn-ghost" style="width: 100%; font-size: 12px;">
          <span>☁️ Sign In / Join Cloud</span>
        </button>
      `;
      const btn = this.sidebarUserContainer.querySelector('#btn-open-auth-sidebar');
      if (btn) btn.addEventListener('click', () => this.openAuthModal());
    }
  }

  openAuthModal() {
    if (this.authModal) this.authModal.classList.add('active');
  }

  closeAuthModal() {
    if (this.authModal) {
      this.authModal.classList.remove('active');
      if (this.loginForm) this.loginForm.reset();
      if (this.signupForm) this.signupForm.reset();
    }
  }

  async signOut() {
    if (!confirm('Sign out of your Apex Cloud account? (Your local IndexedDB diary remains intact)')) return;
    try {
      await window.fbAuth.signOut();
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  }

  formatAuthError(msg) {
    if (!msg) return 'Authentication failed. Please try again.';
    if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
      return 'Invalid email or password.';
    }
    if (msg.includes('email-already-in-use')) {
      return 'An account already exists with this email address.';
    }
    if (msg.includes('weak-password')) {
      return 'Password should be at least 6 characters.';
    }
    if (msg.includes('popup-closed-by-user')) {
      return 'Google sign-in popup was closed.';
    }
    return msg;
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

window.authManager = new AuthManager();
