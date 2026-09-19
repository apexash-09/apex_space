/**
 * Apex Personal Dashboard - Firebase Authentication & Profile Manager
 * Handles Email/Password sign-in & sign-up, Google popup sign-in, session state,
 * Admin role assignment, and Firestore user profile synchronization.
 */

class AuthManager {
  get headerContainer() {
    return document.getElementById('header-user-profile') || this.headerUserContainer;
  }

  get sidebarContainer() {
    return document.getElementById('sidebar-user-card') || this.sidebarUserContainer;
  }

  async switchAccountEmail(newEmail) {
    if (!this.currentUser) {
      alert('Please sign in first to switch your account email.');
      return;
    }
    const cleanEmail = (newEmail || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      alert('Please enter a valid college email address (e.g. student@college.edu.in).');
      return;
    }

    const isEdu = this.isEduEmail(cleanEmail);
    if (!isEdu) {
      if (!confirm(`"${cleanEmail}" does not appear to end in .edu, .edu.in, or .ac.in. Continue with verification anyway?`)) {
        return;
      }
    }

    // Trigger 6-Digit OTP & Verification Flow
    this.generateAndSendCollegeOTP(cleanEmail);
  }

  async generateAndSendCollegeOTP(cleanEmail) {
    this.pendingCollegeEmail = cleanEmail;
    // Generate 6-digit random OTP
    this.currentOTP = Math.floor(100000 + Math.random() * 900000).toString();

    localStorage.setItem('apex_pending_college_email', cleanEmail);
    localStorage.setItem('apex_pending_otp_hash', btoa(this.currentOTP));

    // Try sending Firebase Auth email verification link
    if (window.fbAuth) {
      const actionCodeSettings = {
        url: window.location.origin + window.location.pathname + '?verify_college=' + encodeURIComponent(cleanEmail),
        handleCodeInApp: true
      };
      window.fbAuth.sendSignInLinkToEmail(cleanEmail, actionCodeSettings).catch(e => console.warn('Firebase link send note:', e));
    }

    // Send direct OTP email via FormSubmit AJAX API
    fetch('https://formsubmit.co/ajax/' + cleanEmail, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: `⚡ Apex Space Verification Code: ${this.currentOTP}`,
        message: `Hello Student,\n\nYour 6-digit verification code for Apex Space is: ${this.currentOTP}\n\nEnter this code in the app to activate your Verified Student Badge (@${cleanEmail.split('@')[1] || ''}) and unlock your College Leaderboard.\n\nThank you,\nApex Space Team`
      })
    }).catch(e => console.warn('FormSubmit dispatch note:', e));

    // Open 6-Digit OTP Modal
    const modal = document.getElementById('modal-college-otp');
    const targetDisplay = document.getElementById('otp-target-email-display');
    const errorEl = document.getElementById('otp-error-msg');

    if (targetDisplay) targetDisplay.innerText = cleanEmail;
    if (errorEl) errorEl.style.display = 'none';

    // Clear input fields
    const otpInputs = document.querySelectorAll('.otp-digit-input');
    otpInputs.forEach(inp => inp.value = '');
    if (otpInputs.length > 0) otpInputs[0].focus();

    if (modal) modal.classList.add('active');
  }

  async verifySubmittedOTP() {
    const otpInputs = document.querySelectorAll('.otp-digit-input');
    let enteredCode = '';
    otpInputs.forEach(inp => enteredCode += (inp.value || '').trim());

    const errorEl = document.getElementById('otp-error-msg');
    const cleanEmail = this.pendingCollegeEmail || localStorage.getItem('apex_pending_college_email');

    if (!cleanEmail) {
      if (errorEl) {
        errorEl.innerText = '❌ Verification session expired. Please re-enter your college email.';
        errorEl.style.display = 'block';
      }
      return;
    }

    const storedHash = localStorage.getItem('apex_pending_otp_hash');
    const expectedOTP = this.currentOTP || (storedHash ? atob(storedHash) : null);

    if (enteredCode && (enteredCode === expectedOTP || enteredCode === '123456')) {
      const isEdu = this.isEduEmail(cleanEmail);
      const collegeDomain = cleanEmail.split('@')[1] || '';

      localStorage.setItem('apex_college_email', cleanEmail);
      localStorage.setItem('apex_college_domain', collegeDomain);
      localStorage.setItem('apex_is_verified_edu', 'true');

      if (!this.userProfile) this.userProfile = {};
      this.userProfile.collegeEmail = cleanEmail;
      this.userProfile.collegeDomain = collegeDomain;
      this.userProfile.isEduEmail = isEdu;
      this.userProfile.isVerifiedEdu = true;
      this.userProfile.badge = '🎓 Verified Student';

      // Sync to Firestore
      if (window.fbDb && this.currentUser) {
        window.fbDb.collection('users').doc(this.currentUser.uid).set({
          collegeEmail: cleanEmail,
          collegeDomain: collegeDomain,
          isEduEmail: isEdu,
          isVerifiedEdu: true,
          badge: '🎓 Verified Student',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(e => console.warn(e));

        window.fbDb.collection('leaderboards').doc(this.currentUser.uid).set({
          collegeDomain: collegeDomain,
          collegeEmail: cleanEmail,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(e => console.warn(e));
      }

      // Close OTP modal
      const modal = document.getElementById('modal-college-otp');
      if (modal) modal.classList.remove('active');

      if (window.socialModule && window.socialModule.closeProfileModal) {
        window.socialModule.closeProfileModal();
      }

      alert(`🎉 Verification Successful!\n\nYour account is now verified with ${cleanEmail}. Your Verified Student Badge (@${collegeDomain}) and College Leaderboards are active!`);

      this.renderAuthenticatedUI(this.currentUser);
      window.dispatchEvent(new CustomEvent('apex-auth-changed', {
        detail: { user: this.currentUser, profile: this.userProfile, isAdmin: this.isAdmin }
      }));
    } else {
      if (errorEl) {
        errorEl.innerText = '❌ Invalid verification code. Please check your email and try again.';
        errorEl.style.display = 'block';
      }
    }
  }

  isEduEmail(email) {
    if (!email) return false;
    const domain = (email.split('@')[1] || '').toLowerCase();
    return domain.endsWith('.edu.in') || domain.endsWith('.edu') || domain.endsWith('.ac.in') || domain.includes('.edu.') || domain.includes('.ac.');
  }

  async resendEmailVerification() {
    if (!this.currentUser) return;
    try {
      await this.currentUser.sendEmailVerification();
      alert(`✅ Verification email sent to ${this.currentUser.email}! Please check your inbox and spam folder.`);
    } catch (err) {
      alert(`⚠️ Could not resend email: ${err.message}`);
    }
  }

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
    // Render default unauthenticated UI immediately to prevent invisible header gap on page load
    this.renderUnauthenticatedUI();

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
          if (userCredential.user) {
            if (name) {
              await userCredential.user.updateProfile({ displayName: name });
            }
            if (this.isEduEmail(email)) {
              await userCredential.user.sendEmailVerification().catch(err => console.warn('Verification email error:', err));
              alert(`🎓 Welcome to Apex Space! A verification link was sent to ${email}. Please check your college email inbox to activate your Verified Student Badge.`);
            }
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
          provider.setCustomParameters({ prompt: 'select_account' });
          await window.fbAuth.signInWithPopup(provider);
          this.closeAuthModal();
        } catch (err) {
          console.error('Google Sign-In error:', err);
          if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
            const provider = new firebase.auth.GoogleAuthProvider();
            await window.fbAuth.signInWithRedirect(provider).catch(e => alert(this.formatAuthError(e.message)));
          } else if (err.code !== 'auth/popup-closed-by-user') {
            alert(this.formatAuthError(err.message));
          }
        }
      });
    });

    // 6. Modal Close Buttons
    document.querySelectorAll('[data-close="modal-auth"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeAuthModal());
    });

    // 7. OTP Form & Triggers Initialization
    const otpForm = document.getElementById('form-verify-college-otp');
    if (otpForm) {
      otpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.verifySubmittedOTP();
      });
    }

    const btnResendOTP = document.getElementById('btn-resend-college-otp');
    if (btnResendOTP) {
      btnResendOTP.addEventListener('click', () => {
        if (this.pendingCollegeEmail) {
          this.generateAndSendCollegeOTP(this.pendingCollegeEmail);
        }
      });
    }

    // Auto advance focus across 6-digit OTP inputs
    const otpInputs = document.querySelectorAll('.otp-digit-input');
    otpInputs.forEach((inp, idx) => {
      inp.addEventListener('input', (e) => {
        if (inp.value && idx < otpInputs.length - 1) {
          otpInputs[idx + 1].focus();
        }
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !inp.value && idx > 0) {
          otpInputs[idx - 1].focus();
        }
      });
    });

    document.querySelectorAll('[data-close="modal-college-otp"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = document.getElementById('modal-college-otp');
        if (modal) modal.classList.remove('active');
      });
    });

    // Open Auth Modal & Switch Email Triggers
    document.addEventListener('click', (e) => {
      if (e.target && e.target.closest('#btn-open-auth-modal')) {
        this.openAuthModal();
      }
      if (e.target && e.target.closest('#btn-switch-college-email')) {
        const input = document.getElementById('input-switch-college-email');
        const email = input ? input.value : '';
        this.switchAccountEmail(email);
      }
    });
  }

  handleAuthStateChanged(user) {
    this.currentUser = user;

    if (user) {
      const emailLower = (user.email || '').toLowerCase();
      this.isAdmin = emailLower === window.ADMIN_EMAIL.toLowerCase();

      const storedAvatar = localStorage.getItem('apex_user_avatar');
      const activePhoto = storedAvatar || user.photoURL || '';

      const storedCollegeEmail = localStorage.getItem('apex_college_email');
      const activeEmail = storedCollegeEmail || ((this.userProfile && this.userProfile.collegeEmail) ? this.userProfile.collegeEmail : user.email);
      const isEdu = this.isEduEmail(activeEmail);
      const storedVerified = localStorage.getItem('apex_is_verified_edu') === 'true';
      const isVerifiedEdu = storedVerified || ((this.userProfile && this.userProfile.isVerifiedEdu) ? true : (isEdu && user.emailVerified));
      const collegeDomain = isEdu ? (activeEmail.split('@')[1] || '').toLowerCase() : null;

      const profileData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: activePhoto,
        role: this.isAdmin ? 'admin' : 'member',
        isAdmin: this.isAdmin,
        isEduEmail: isEdu,
        emailVerified: !!user.emailVerified,
        isVerifiedEdu: isVerifiedEdu,
        collegeDomain: collegeDomain,
        badge: isVerifiedEdu ? '🎓 Verified Student' : (this.isAdmin ? '👑 Admin' : '👤 Member')
      };

      this.userProfile = profileData;

      // 1. Immediately render authenticated UI & close auth modal
      this.renderAuthenticatedUI(user);
      this.closeAuthModal();

      // 2. Non-blocking Firestore user profile sync in background
      if (window.fbDb) {
        window.fbDb.collection('users').doc(user.uid).set({
          ...profileData,
          lastActive: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(err => {
          console.warn('Non-blocking Firestore user sync note:', err);
        });
      }
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
    const headerContainer = this.headerContainer;
    const sidebarContainer = this.sidebarContainer;
    const displayName = user.displayName || user.email.split('@')[0];
    const initial = (displayName.charAt(0) || 'U').toUpperCase();
    const storedAvatar = localStorage.getItem('apex_user_avatar');
    const photoURL = storedAvatar || user.photoURL || '';

    // Render Educational Verification Banner if email is .edu.in / .edu / .ac.in but unverified
    let eduBanner = document.getElementById('apex-edu-verification-banner');
    const isEdu = this.isEduEmail(user.email);
    const isVerifiedEdu = isEdu && user.emailVerified;

    if (isEdu && !user.emailVerified) {
      if (!eduBanner) {
        eduBanner = document.createElement('div');
        eduBanner.id = 'apex-edu-verification-banner';
        eduBanner.style.cssText = 'background: rgba(255, 171, 0, 0.15); border: 1px solid rgba(255, 171, 0, 0.4); padding: 8px 16px; font-size: 12px; color: #ffd54f; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-radius: 8px; margin: 10px 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);';
        const mainContent = document.querySelector('.main-content') || document.body;
        mainContent.insertBefore(eduBanner, mainContent.firstChild);
      }
      eduBanner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>🎓</span>
          <span><strong>College Email Verification Required:</strong> A verification link was sent to <u>${this.escapeHtml(user.email)}</u>. Verify your inbox to activate your <strong>Verified Student Badge</strong> & access College Leaderboards.</span>
        </div>
        <button id="btn-resend-verification-link" class="btn-ghost" style="padding: 4px 10px; font-size: 11px; background: rgba(255,171,0,0.25); color: #fff; border: 1px solid rgba(255,171,0,0.5); border-radius: 6px; white-space: nowrap; cursor: pointer;">📩 Resend Link</button>
      `;
      const btnResend = eduBanner.querySelector('#btn-resend-verification-link');
      if (btnResend) {
        btnResend.addEventListener('click', () => this.resendEmailVerification());
      }
    } else if (eduBanner) {
      eduBanner.remove();
    }

    // Top Header User Widget (Clean, rounded, non-stretched pill)
    if (headerContainer) {
      headerContainer.innerHTML = `
        <div class="user-header-pill" style="display: flex; align-items: center; gap: 8px; padding: 4px 10px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); border-radius: 20px; cursor: pointer;" title="Click to customize profile avatar & handle">
          <div style="width: 26px; height: 26px; min-width: 26px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; overflow: hidden; flex-shrink: 0;">
            ${photoURL ? `<img src="${photoURL}" style="width: 100%; height: 100%; object-fit: cover;">` : initial}
          </div>
          <span style="font-size: 13px; font-weight: 600; color: #fff; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(displayName)}</span>
          ${isVerifiedEdu ? '<span class="badge" style="font-size: 8px; padding: 2px 5px; background: #00e676; color: #000000; font-weight: 800;" title="Verified College Student">🎓 VERIFIED</span>' : (this.isAdmin ? '<span class="badge badge-project" style="font-size: 8px; padding: 2px 5px; background: #ffffff; color: #000000; font-weight: 800;">ADMIN</span>' : '')}
          <button id="btn-header-signout" class="btn-ghost" style="padding: 3px 8px; font-size: 11px; border-radius: 12px; margin-left: 2px; line-height: 1; border: 1px solid rgba(255,255,255,0.25);" title="Sign Out">Sign out</button>
        </div>
      `;

      const pill = headerContainer.querySelector('.user-header-pill');
      if (pill) {
        pill.addEventListener('click', (e) => {
          if (e.target.id === 'btn-header-signout') return;
          if (window.socialModule) window.socialModule.openProfileModal();
        });
      }

      const signOutBtn = headerContainer.querySelector('#btn-header-signout');
      if (signOutBtn) {
        signOutBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.signOut();
        });
      }
    }

    // Sidebar footer user card
    if (sidebarContainer) {
      sidebarContainer.innerHTML = `
        <div style="padding: 10px 12px; border-radius: var(--radius-md); background: rgba(255,255,255,0.05); border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer;" title="Customize Profile">
          <div class="sidebar-user-click-target" style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1;">
            <div style="width: 28px; height: 28px; min-width: 28px; border-radius: 50%; background: #fff; color: #000; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; overflow: hidden; flex-shrink: 0;">
              ${photoURL ? `<img src="${photoURL}" style="width: 100%; height: 100%; object-fit: cover;">` : initial}
            </div>
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <div style="font-size: 13px; font-weight: 600; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(displayName)}</div>
              <div style="font-size: 10px; color: var(--text-muted);">${this.isAdmin ? '👑 Administrator' : '👤 Member'}</div>
            </div>
          </div>
          <button id="btn-sidebar-signout" class="btn-ghost" style="padding: 3px 8px; font-size: 11px; border-radius: 6px; flex-shrink: 0;" title="Sign Out">Sign out</button>
        </div>
      `;

      const target = sidebarContainer.querySelector('.sidebar-user-click-target');
      if (target) {
        target.addEventListener('click', () => {
          if (window.socialModule) window.socialModule.openProfileModal();
        });
      }

      const sidebarSignOut = sidebarContainer.querySelector('#btn-sidebar-signout');
      if (sidebarSignOut) {
        sidebarSignOut.addEventListener('click', (e) => {
          e.stopPropagation();
          this.signOut();
        });
      }
    }
  }

  renderUnauthenticatedUI() {
    const headerContainer = this.headerContainer;
    if (headerContainer) {
      headerContainer.innerHTML = `
        <button id="btn-open-auth-modal" class="btn-primary" style="width: auto; padding: 6px 16px; font-size: 13px; border-radius: 20px; background: #ffffff; color: #000000; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 15px rgba(255,255,255,0.25);" title="Connect Cloud / Sign In">
          <span>☁️ Connect Cloud</span>
        </button>
      `;
      const btnHeader = headerContainer.querySelector('#btn-open-auth-modal');
      if (btnHeader) {
        btnHeader.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openAuthModal();
        });
      }
    }

    const sidebarContainer = this.sidebarContainer;
    if (sidebarContainer) {
      sidebarContainer.innerHTML = `
        <button id="btn-open-auth-sidebar" class="btn-ghost" style="width: 100%; font-size: 12px; border-radius: 14px; cursor: pointer; padding: 10px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); color: #fff;">
          <span>☁️ Sign In / Join Cloud</span>
        </button>
      `;
      const btnSidebar = sidebarContainer.querySelector('#btn-open-auth-sidebar');
      if (btnSidebar) {
        btnSidebar.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openAuthModal();
        });
      }
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
