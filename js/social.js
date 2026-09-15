/**
 * Apex Personal Dashboard - WhatsApp-style Realtime Social Hub & Group Chat Module
 * Supports:
 * - Realtime Group Channels & Direct 1-on-1 Messages (DMs)
 * - Music / Audio & Image file attachments directly in chat bubbles
 * - Custom & Anonymous Handles with in-app edit modal & randomizer
 * - Instant Auto-send on Enter key
 * - Deterministic General Lounge default room initialization
 * - Mobile responsive navigation with back-to-channels switcher
 */

class SocialModule {
  constructor() {
    this.currentUser = null;
    this.isAdmin = false;
    this.activeTab = 'chat'; // 'chat' | 'feed' | 'music' | 'admin_users'
    this.activeRoomId = 'general_lounge'; // default room
    this.activeRoomData = {
      id: 'general_lounge',
      name: '🌐 General Lounge',
      description: 'Public community group for all friends',
      icon: '🌐',
      type: 'group'
    };
    this.pendingAttachment = null;
    this.replyingTo = null;

    // Presence & Notifications
    this.presenceHeartbeatInterval = null;
    this.currentRoomPresenceUnsub = null;
    this._lastLoadedMessages = [];
    this._initialMessagesLoaded = false;

    // Listeners
    this.unsubscribeRooms = null;
    this.unsubscribeMessages = null;
    this.unsubscribeNotes = null;
    this.unsubscribeSongs = null;
    this.friendsList = [];
    this.roomsList = [];

    // DOM Elements
    this.socialView = document.getElementById('view-social');
    this.socialMainContent = document.getElementById('social-main-content');

    // Chat Layout Elements
    this.chatSection = document.getElementById('social-chat-section');
    this.chatSidebarPanel = document.getElementById('chat-sidebar-panel');
    this.chatMainWindow = document.getElementById('chat-main-window');
    this.roomsListContainer = document.getElementById('chat-rooms-list');
    this.directListContainer = document.getElementById('chat-direct-list');
    this.chatMessagesContainer = document.getElementById('active-chat-messages');
    this.chatHeaderTitle = document.getElementById('active-chat-title');
    this.chatHeaderSubtitle = document.getElementById('active-chat-subtitle');
    this.chatHeaderAvatar = document.getElementById('active-chat-avatar');
    this.activeChatStatus = document.getElementById('active-chat-status');
    this.chatInput = document.getElementById('chat-message-input');
    this.chatForm = document.getElementById('form-chat-send');
    this.chatEmptyState = document.getElementById('chat-empty-state');
    this.chatActiveWindow = document.getElementById('chat-active-window');
    this.mobileBackBtn = document.getElementById('btn-mobile-chat-back');
    this.anonBadge = document.getElementById('chat-anon-badge');

    // Quoted Reply Preview
    this.replyPreview = document.getElementById('chat-reply-preview');
    this.replyPreviewSender = document.getElementById('reply-preview-sender');
    this.replyPreviewText = document.getElementById('reply-preview-text');
    this.btnCancelReply = document.getElementById('btn-cancel-reply');

    // Attachment elements
    this.chatFileInput = document.getElementById('chat-file-input');
    this.chatAttachBtn = document.getElementById('btn-chat-attach');
    this.chatAttachmentPreview = document.getElementById('chat-attachment-preview');
    this.attachmentPreviewName = document.getElementById('attachment-preview-name');
    this.btnRemoveAttachment = document.getElementById('btn-remove-attachment');

    // Other Tabs
    this.notesFeed = document.getElementById('social-notes-feed');
    this.sharedSongsFeed = document.getElementById('social-songs-feed');
    this.adminUsersView = document.getElementById('social-admin-users-view');
    this.adminTabBtn = document.getElementById('btn-social-tab-admin');

    // Modals
    this.createGroupModal = document.getElementById('modal-create-group');
    this.createGroupForm = document.getElementById('form-create-group');
    this.startDmModal = document.getElementById('modal-start-dm');
    this.aliasModal = document.getElementById('modal-change-alias');
    this.profileModal = document.getElementById('modal-profile-photo');
    this.postModal = document.getElementById('modal-social-post');
    this.postForm = document.getElementById('form-social-post');
    this.createPollModal = document.getElementById('modal-create-poll');
    this.editMessageModal = document.getElementById('modal-edit-message');
    this.friendsModal = document.getElementById('modal-friend-requests');
    this.feedbackModal = document.getElementById('modal-feedback-bug');

    // Friend requests & Blocked users state
    this.friendRequestsList = [];
    this.unsubscribeFriendRequests = null;
    this.blockedUsersList = [];
    this.unsubscribeBlockedUsers = null;

    this.init();
  }

  init() {
    // 1. Initialize anonymous identity
    this.initAnonymousIdentity();

    // 2. Auth Listener
    window.addEventListener('apex-auth-changed', (e) => {
      this.currentUser = e.detail.user;
      this.isAdmin = e.detail.isAdmin;
      this.handleAuthUpdate();
    });

    // 3. Main Social Navigation Tabs
    document.querySelectorAll('.social-nav-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-social-tab');
        this.switchSocialTab(tab);
      });
    });

    // 4. Chat Send Form & Enter Listener
    if (this.chatForm) {
      this.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.sendMessage();
      });
    }

    if (this.chatInput) {
      this.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // 5. File & Music Attachment Handlers
    if (this.chatAttachBtn && this.chatFileInput) {
      this.chatAttachBtn.addEventListener('click', () => this.chatFileInput.click());
      this.chatFileInput.addEventListener('change', (e) => this.handleChatFileSelected(e));
    }

    if (this.btnRemoveAttachment) {
      this.btnRemoveAttachment.addEventListener('click', () => this.clearAttachment());
    }

    // 5b. Emoji & Sticker Picker Initialization
    this.initEmojiPicker();

    // 5c. Quoted Reply Cancel Handler
    if (this.btnCancelReply) {
      this.btnCancelReply.addEventListener('click', () => this.clearReply());
    }

    // 5d. Poll Creator Button
    const btnChatPoll = document.getElementById('btn-chat-poll');
    if (btnChatPoll) {
      btnChatPoll.addEventListener('click', () => this.openCreatePollModal());
    }

    // 5e. Notifications Toggle
    const btnNotifications = document.getElementById('btn-chat-notifications');
    if (btnNotifications) {
      this.updateNotificationsUI();
      btnNotifications.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleNotifications();
      });
    }

    // 5f. Close reaction docks on outer click
    document.addEventListener('click', () => {
      document.querySelectorAll('.chat-reaction-dock.active').forEach((dock) => {
        dock.classList.remove('active');
      });
    });

    // 6. Mobile Back to Channels
    if (this.mobileBackBtn) {
      this.mobileBackBtn.addEventListener('click', () => this.showMobileChannels());
    }

    // 7. Profile Photo & Alias Modal Triggers
    if (this.anonBadge) {
      this.anonBadge.addEventListener('click', () => this.openProfileModal());
    }

    const btnEditChatName = document.getElementById('btn-edit-chat-name');
    if (btnEditChatName) {
      btnEditChatName.addEventListener('click', (e) => {
        e.preventDefault();
        this.openProfileModal();
      });
    }

    const btnClearChat = document.getElementById('btn-clear-chat');
    if (btnClearChat) {
      btnClearChat.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearCurrentChat();
      });
    }

    // Modal initializers
    this.initProfileModal();
    this.initPollHandlers();
    this.initEditMessageHandlers();
    this.initFriendRequests();
    this.initFeedbackBugModal();

    // 8. Create Group Triggers
    const btnOpenGroupModal = document.getElementById('btn-open-create-group-modal');
    if (btnOpenGroupModal) {
      btnOpenGroupModal.addEventListener('click', () => this.openCreateGroupModal());
    }

    document.querySelectorAll('[data-close="modal-create-group"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeCreateGroupModal());
    });

    if (this.createGroupForm) {
      this.createGroupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.createGroup();
      });
    }

    // 9. Start DM Triggers & Privacy Search
    const btnOpenDmModal = document.getElementById('btn-open-dm-modal');
    if (btnOpenDmModal) {
      btnOpenDmModal.addEventListener('click', () => this.openStartDmModal());
    }

    const dmSearchInput = document.getElementById('dm-friend-search-input');
    if (dmSearchInput) {
      dmSearchInput.addEventListener('input', (e) => {
        this.renderDmFriendsPicker(e.target.value.trim());
      });
    }

    document.querySelectorAll('[data-close="modal-start-dm"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeStartDmModal());
    });

    // 10. Shared Post Form
    const btnOpenPost = document.getElementById('btn-open-social-post-modal');
    if (btnOpenPost) {
      btnOpenPost.addEventListener('click', () => this.openPostModal());
    }

    document.querySelectorAll('[data-close="modal-social-post"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closePostModal());
    });

    if (this.postForm) {
      this.postForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.createSharedPost();
      });
    }

    // Initial setup: start rooms listener, messages listener, presence system, & friend requests
    this.seedDefaultRoomsIfEmpty();
    this.startRoomsListener();
    this.startMessagesListener('general_lounge');
    this.startNotesListener();
    this.startSharedSongsListener();
    this.startPresenceSystem();
    this.startFriendRequestsListener();
    this.startBlockedUsersListener();
  }

  // --- Anonymous & Custom Alias Identity System with Admin Protection ---
  isReservedAdminName(name) {
    if (!name) return false;
    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const reserved = ['admin', 'ayush', 'ash', 'apex', 'palak'];
    return reserved.some(r => clean.includes(r));
  }

  isAdminUser() {
    if (this.isAdmin) return true;
    if (this.currentUser && this.currentUser.email && this.currentUser.email.toLowerCase() === window.ADMIN_EMAIL.toLowerCase()) return true;
    return false;
  }

  initAnonymousIdentity() {
    let anonUid = localStorage.getItem('apex_anon_uid');
    if (!anonUid) {
      anonUid = 'anon_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('apex_anon_uid', anonUid);
    }

    let savedHandle = localStorage.getItem('apex_chat_handle') || localStorage.getItem('apex_anon_handle');
    
    // Security check: if not admin, ensure saved handle is not spoofing admin names
    if (savedHandle && this.isReservedAdminName(savedHandle) && !this.isAdminUser()) {
      savedHandle = this.generateRandomAlias();
      localStorage.setItem('apex_chat_handle', savedHandle);
      localStorage.setItem('apex_anon_handle', savedHandle);
    }

    if (!savedHandle) {
      savedHandle = this.generateRandomAlias();
      localStorage.setItem('apex_chat_handle', savedHandle);
      localStorage.setItem('apex_anon_handle', savedHandle);
    }

    this.updateAnonBadge();
    this.updateAdminIncognitoUI();
  }

  // --- Helper: Client-Side Image Compression & Blob Conversion ---
  compressImage(file, maxWidth = 600, quality = 0.8) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No image file provided'));
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Invalid image file format'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      if (!blob) return resolve('');
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  generateRandomAlias() {
    const adjectives = ['Cyber', 'Neon', 'Shadow', 'Phantom', 'Cosmic', 'Solar', 'Quantum', 'Vortex', 'Astral', 'Hyper', 'Velox', 'Echo'];
    const nouns = ['Pilot', 'Hacker', 'Nomad', 'Scholar', 'Ninja', 'Rider', 'Voyager', 'Ghost', 'Architect', 'Spark', 'Titan', 'Drifter'];
    const num = Math.floor(100 + Math.random() * 900);
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}${noun}_${num}`;
  }

  // --- Profile Photo, Avatar & Identity Customization ---
  getPresetAvatars() {
    const rawSvgs = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#a855f7"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g1)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">🤖</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ec4899"/><stop offset="100%" stop-color="#f43f5e"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g2)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">🚀</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#06b6d4"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g3)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">🕶️</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#eab308"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g4)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">👑</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f97316"/><stop offset="100%" stop-color="#ef4444"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g5)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">🔥</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#818cf8"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g6)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">💎</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g7" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#d946ef"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g7)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">🐱</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g8" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g8)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">🎧</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g9" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a855f7"/><stop offset="100%" stop-color="#6366f1"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g9)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">✨</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g10" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#0284c7"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g10)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">👾</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g11" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#facc15"/><stop offset="100%" stop-color="#ea580c"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g11)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">⚡</text></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g12" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><rect width="100" height="100" rx="50" fill="url(#g12)"/><text x="50" y="66" font-size="52" text-anchor="middle" dominant-baseline="central">🐉</text></svg>'
    ];
    return rawSvgs.map(s => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`);
  }

  initProfileModal() {
    const fileInput = document.getElementById('profile-photo-file-input');
    const uploadBtn = document.getElementById('btn-upload-custom-avatar');
    const removeBtn = document.getElementById('btn-remove-avatar');
    const saveBtn = document.getElementById('btn-save-profile-modal');
    const randomBtn = document.getElementById('btn-profile-random-handle');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleCustomAvatarUpload(e));
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        this._tempAvatarUrl = '';
        this.updateProfileModalAvatarPreview('');
        const grid = document.getElementById('preset-avatars-grid');
        if (grid) grid.querySelectorAll('button').forEach(b => b.style.borderColor = 'transparent');
      });
    }

    if (randomBtn) {
      randomBtn.addEventListener('click', () => {
        const input = document.getElementById('profile-custom-handle-input');
        if (input) input.value = this.generateRandomAlias();
        
        // Pick random preset avatar and immediately preview
        const presets = this.getPresetAvatars();
        const randIdx = Math.floor(Math.random() * presets.length);
        const randAvatar = presets[randIdx];
        this._tempAvatarUrl = randAvatar;
        this.updateProfileModalAvatarPreview(randAvatar);

        const grid = document.getElementById('preset-avatars-grid');
        if (grid) {
          const buttons = grid.querySelectorAll('button');
          buttons.forEach((b, idx) => {
            b.style.borderColor = idx === randIdx ? '#ffffff' : 'transparent';
          });
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveProfileCustomization());
    }

    document.querySelectorAll('[data-close="modal-profile-photo"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeProfileModal());
    });

    if (this.profileModal) {
      this.profileModal.addEventListener('click', (e) => {
        if (e.target === this.profileModal) this.closeProfileModal();
      });
    }

    this.renderPresetAvatarsGrid();
  }

  renderPresetAvatarsGrid() {
    const grid = document.getElementById('preset-avatars-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const presets = this.getPresetAvatars();
    presets.forEach((url, idx) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.style.cssText = 'width: 44px; height: 44px; border-radius: 50%; background: rgba(255,255,255,0.08); border: 2px solid transparent; padding: 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; overflow: hidden;';
      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; pointer-events: none;';
      item.appendChild(img);
      item.addEventListener('click', () => {
        this._tempAvatarUrl = url;
        this.updateProfileModalAvatarPreview(url);
        grid.querySelectorAll('button').forEach(b => b.style.borderColor = 'transparent');
        item.style.borderColor = '#ffffff';
      });
      grid.appendChild(item);
    });
  }

  openProfileModal() {
    const identity = this.getSenderIdentity();
    this._tempAvatarUrl = identity.photoURL || '';

    const handleInput = document.getElementById('profile-custom-handle-input');
    if (handleInput) handleInput.value = identity.name;

    this.updateProfileModalAvatarPreview(this._tempAvatarUrl);

    // Admin Incognito Toggle
    const incognitoWrap = document.getElementById('profile-admin-incognito-wrapper');
    const chk = document.getElementById('chk-profile-admin-incognito');
    if (incognitoWrap) {
      if (this.isAdminUser()) {
        incognitoWrap.style.display = 'block';
        if (chk) chk.checked = localStorage.getItem('apex_admin_incognito') === 'true';
      } else {
        incognitoWrap.style.display = 'none';
      }
    }

    if (this.profileModal) this.profileModal.classList.add('active');
  }

  closeProfileModal() {
    if (this.profileModal) this.profileModal.classList.remove('active');
  }

  updateProfileModalAvatarPreview(url) {
    const preview = document.getElementById('profile-modal-avatar-preview');
    if (!preview) return;
    preview.innerHTML = '';
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;';
      preview.appendChild(img);
    } else {
      const name = this.getSenderIdentity().name || 'U';
      preview.innerHTML = `<span style="font-size: 28px; font-weight: 800;">${name.charAt(0).toUpperCase()}</span>`;
    }
  }

  async handleCustomAvatarUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const preview = document.getElementById('profile-modal-avatar-preview');
    if (preview) {
      preview.innerHTML = '<span style="font-size: 14px; font-weight: 600;">⌛...</span>';
    }

    try {
      // Compress avatar to clean base64 / JPEG
      const compressedDataUrl = await this.compressImage(file, 300, 0.85);
      this._tempAvatarUrl = compressedDataUrl;
      this.updateProfileModalAvatarPreview(this._tempAvatarUrl);
      
      const grid = document.getElementById('preset-avatars-grid');
      if (grid) grid.querySelectorAll('button').forEach(b => b.style.borderColor = 'transparent');
    } catch (err) {
      console.error('Avatar upload error:', err);
      alert('Could not process avatar image: ' + err.message);
      this.updateProfileModalAvatarPreview(this._tempAvatarUrl);
    }
  }

  async saveProfileCustomization() {
    const handleInput = document.getElementById('profile-custom-handle-input');
    const newHandle = handleInput ? handleInput.value.trim() : '';

    if (newHandle && this.isReservedAdminName(newHandle) && !this.isAdminUser()) {
      alert('🔒 Security Notice: The names "Admin", "Ayush", "Ash", "Apex", and "Palak" are reserved.');
      return;
    }

    if (newHandle) {
      localStorage.setItem('apex_chat_handle', newHandle);
      localStorage.setItem('apex_anon_handle', newHandle);
    }

    const newAvatar = this._tempAvatarUrl || '';
    localStorage.setItem('apex_user_avatar', newAvatar);

    // Update admin incognito
    const chk = document.getElementById('chk-profile-admin-incognito');
    if (chk && this.isAdminUser()) {
      this.setAdminIncognito(chk.checked);
    }

    // Sync with Firebase user profile and Firestore
    if (this.currentUser) {
      try {
        if (newHandle) {
          await this.currentUser.updateProfile({ displayName: newHandle, photoURL: newAvatar });
        } else if (newAvatar) {
          await this.currentUser.updateProfile({ photoURL: newAvatar });
        }
        if (window.fbDb) {
          await window.fbDb.collection('users').doc(this.currentUser.uid).set({
            displayName: newHandle || this.currentUser.displayName,
            photoURL: newAvatar,
            lastActive: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      } catch (err) {
        console.warn('Profile cloud sync warning:', err);
      }
    }

    this.updateAnonBadge();
    this.closeProfileModal();

    // Re-render auth UI widget in header & sidebar
    if (window.authManager && this.currentUser) {
      window.authManager.renderAuthenticatedUI(this.currentUser);
    }
  }

  openAliasModal() {
    this.openProfileModal();
  }

  closeAliasModal() {
    this.closeProfileModal();
  }

  toggleAdminIncognito() {
    if (!this.isAdminUser()) return;
    const currentState = localStorage.getItem('apex_admin_incognito') === 'true';
    this.setAdminIncognito(!currentState);
  }

  setAdminIncognito(enabled) {
    if (!this.isAdminUser()) return;
    localStorage.setItem('apex_admin_incognito', enabled ? 'true' : 'false');
    this.updateAdminIncognitoUI();
  }

  updateAdminIncognitoUI() {
    const isIncognito = this.isAdminUser() && localStorage.getItem('apex_admin_incognito') === 'true';
    const btn = document.getElementById('btn-admin-incognito');
    if (btn) {
      if (this.isAdminUser()) {
        btn.style.display = 'inline-flex';
        if (isIncognito) {
          btn.style.background = 'rgba(52, 199, 89, 0.2)';
          btn.style.borderColor = '#34c759';
          btn.style.color = '#34c759';
          btn.innerHTML = '🎭 Incognito: <strong>ON</strong>';
          btn.title = 'Incognito Mode Active: messages you send will NOT show the ADMIN badge';
        } else {
          btn.style.background = 'transparent';
          btn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
          btn.style.color = 'var(--text-muted)';
          btn.innerHTML = '🎭 Incognito: <strong>OFF</strong>';
          btn.title = 'Incognito Mode OFF: your messages will display the ADMIN badge';
        }
      } else {
        btn.style.display = 'none';
      }
    }

    const chk = document.getElementById('chk-profile-admin-incognito');
    if (chk) chk.checked = isIncognito;
  }

  setCustomHandle(name) {
    if (!name || !name.trim()) return;
    const cleanName = name.trim();

    // Security check: restrict admin reserved names (Admin, Ayush, Ash, Apex, Palak)
    if (this.isReservedAdminName(cleanName) && !this.isAdminUser()) {
      alert('🔒 Security Notice: The handles "Admin", "Ayush", "Ash", "Apex", and "Palak" are protected.');
      return;
    }

    localStorage.setItem('apex_chat_handle', cleanName);
    localStorage.setItem('apex_anon_handle', cleanName);
    this.updateAnonBadge();
  }

  promptChangeHandle() {
    this.openProfileModal();
  }

  updateAnonBadge() {
    const idObj = this.getSenderIdentity();
    const handleDisplay = document.getElementById('chat-handle-display');
    if (handleDisplay) {
      handleDisplay.innerText = idObj.name;
    }
    if (this.anonBadge && !handleDisplay) {
      this.anonBadge.innerHTML = `Chatting as: <strong style="color: #fff;">${this.escapeHtml(idObj.name)}</strong>`;
    }
  }

  getSenderIdentity() {
    const savedCustomHandle = localStorage.getItem('apex_chat_handle') || localStorage.getItem('apex_anon_handle');
    const isIncognito = this.isAdminUser() && localStorage.getItem('apex_admin_incognito') === 'true';
    const savedAvatar = localStorage.getItem('apex_user_avatar') || '';

    if (this.currentUser) {
      const defaultName = this.currentUser.displayName || this.currentUser.email.split('@')[0];
      return {
        uid: this.currentUser.uid,
        name: savedCustomHandle || defaultName,
        email: isIncognito ? '' : this.currentUser.email,
        photoURL: isIncognito ? '' : (savedAvatar || this.currentUser.photoURL || ''),
        isAnon: isIncognito ? true : false,
        isIncognito: isIncognito
      };
    } else {
      const anonUid = localStorage.getItem('apex_anon_uid') || 'anon_guest';
      const anonName = savedCustomHandle || 'AnonymousUser';
      return {
        uid: anonUid,
        name: anonName,
        email: '',
        photoURL: savedAvatar || '',
        isAnon: true,
        isIncognito: false
      };
    }
  }

  handleAuthUpdate() {
    this.updateAnonBadge();
    this.updateAdminIncognitoUI();

    if (this.adminTabBtn) {
      this.adminTabBtn.style.display = this.isAdmin ? 'inline-flex' : 'none';
    }

    if (this.currentUser) {
      this.fetchRegisteredUsers();
      this.startFriendRequestsListener();
      this.startBlockedUsersListener();
    }

    // Refresh active messages stream to update Pin/Delete admin controls
    if (this.activeRoomId && window.fbDb) {
      this.startMessagesListener(this.activeRoomId);
    }
  }

  switchSocialTab(tab) {
    this.activeTab = tab;

    document.querySelectorAll('.social-nav-tab').forEach((btn) => {
      if (btn.getAttribute('data-social-tab') === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // chat section uses display:flex (unified window), not grid
    if (this.chatSection) this.chatSection.style.display = tab === 'chat' ? 'flex' : 'none';
    if (this.notesFeed) this.notesFeed.style.display = tab === 'feed' ? 'block' : 'none';
    if (this.sharedSongsFeed) this.sharedSongsFeed.style.display = tab === 'music' ? 'block' : 'none';
    if (this.adminUsersView) {
      this.adminUsersView.style.display = tab === 'admin_users' ? 'block' : 'none';
      if (tab === 'admin_users') this.renderAdminUsersList();
    }
  }

  // --- Attachments Handling (Images, Audio, PDF & Word Documents) ---
  async handleChatFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|mpeg|mpg|opus|weba|amr)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg|avif)$/i.test(file.name);
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isWord = /msword|wordprocessingml/i.test(file.type) || /\.(doc|docx)$/i.test(file.name);
    const isExcel = /spreadsheet|excel/i.test(file.type) || /\.(xls|xlsx|csv)$/i.test(file.name);
    const isPpt = /presentation|powerpoint/i.test(file.type) || /\.(ppt|pptx)$/i.test(file.name);
    const isDocument = isPdf || isWord || isExcel || isPpt || /\.(txt|md|rtf|zip|rar|7z)$/i.test(file.name) || (!isAudio && !isImage);

    if (isImage) {
      if (this.chatAttachmentPreview && this.attachmentPreviewName) {
        this.attachmentPreviewName.innerText = `⏳ Preparing 🖼️ ${file.name}...`;
        this.chatAttachmentPreview.style.display = 'flex';
      }

      // 1. Try Firebase Cloud Storage first
      if (window.fbStorage) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storageRef = window.fbStorage.ref(`chat_images/${Date.now()}_${safeName}`);
          const uploadTask = storageRef.put(file);
          const uploadPromise = uploadTask.then(snapshot => snapshot.ref.getDownloadURL());
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 12000));
          const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
          if (downloadUrl) {
            this.pendingAttachment = {
              name: file.name,
              type: 'image',
              dataUrl: downloadUrl,
              size: file.size
            };
            if (this.chatAttachmentPreview && this.attachmentPreviewName) {
              this.attachmentPreviewName.innerText = `🖼️ Ready: ${file.name}`;
              this.chatAttachmentPreview.style.display = 'flex';
            }
            return;
          }
        } catch (storageErr) {
          console.warn('Firebase Storage not reachable for image, using client compression:', storageErr);
        }
      }

      // 2. Client-side Image compression fallback (guaranteed to fit under Firestore 1MB document limit)
      try {
        const compressedDataUrl = await this.compressImage(file, 900, 0.75);
        this.pendingAttachment = {
          name: file.name,
          type: 'image',
          dataUrl: compressedDataUrl,
          size: file.size
        };

        if (this.chatAttachmentPreview && this.attachmentPreviewName) {
          this.attachmentPreviewName.innerText = `🖼️ Ready: ${file.name}`;
          this.chatAttachmentPreview.style.display = 'flex';
        }
      } catch (err) {
        console.error('Image compression error:', err);
        this.clearAttachment();
        alert('Could not process image: ' + err.message);
      }
    } else if (isAudio) {
      if (this.chatAttachmentPreview && this.attachmentPreviewName) {
        this.attachmentPreviewName.innerText = `⏳ Optimizing 🎵 ${file.name}...`;
        this.chatAttachmentPreview.style.display = 'flex';
      }

      // 1. Try Firebase Cloud Storage first (preserves 100% original full audio)
      if (window.fbStorage) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storageRef = window.fbStorage.ref(`chat_audio/${Date.now()}_${safeName}`);
          const uploadTask = storageRef.put(file);
          const uploadPromise = uploadTask.then(snapshot => snapshot.ref.getDownloadURL());
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 10000));
          
          const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
          if (downloadUrl) {
            this.pendingAttachment = {
              name: file.name,
              type: 'audio',
              dataUrl: downloadUrl,
              size: file.size
            };

            if (this.chatAttachmentPreview && this.attachmentPreviewName) {
              this.attachmentPreviewName.innerText = `🎵 Ready: ${file.name}`;
              this.chatAttachmentPreview.style.display = 'flex';
            }
            return;
          }
        } catch (storageErr) {
          console.warn('Firebase Storage not reachable, using Web Audio compression:', storageErr);
        }
      }

      // 2. Safe Web Audio Compression Fallback (Guaranteed to be < 400KB Base64 for Firestore)
      try {
        const compressedAudioDataUrl = await this.compressAudio(file);
        this.pendingAttachment = {
          name: file.name,
          type: 'audio',
          dataUrl: compressedAudioDataUrl,
          size: file.size
        };

        if (this.chatAttachmentPreview && this.attachmentPreviewName) {
          this.attachmentPreviewName.innerText = `🎵 Ready: ${file.name}`;
          this.chatAttachmentPreview.style.display = 'flex';
        }
      } catch (err) {
        console.error('Audio processing error:', err);
        this.clearAttachment();
        alert('Could not process audio: ' + err.message);
      }
    } else if (isDocument) {
      let docIcon = '📄';
      let docType = 'Document';
      if (isPdf) { docIcon = '📕'; docType = 'PDF Document'; }
      else if (isWord) { docIcon = '📝'; docType = 'Word Document'; }
      else if (isExcel) { docIcon = '📊'; docType = 'Spreadsheet'; }
      else if (isPpt) { docIcon = '📑'; docType = 'Presentation'; }

      if (this.chatAttachmentPreview && this.attachmentPreviewName) {
        this.attachmentPreviewName.innerText = `⏳ Attaching ${docIcon} ${file.name}...`;
        this.chatAttachmentPreview.style.display = 'flex';
      }

      // 1. Try Firebase Cloud Storage first
      if (window.fbStorage) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storageRef = window.fbStorage.ref(`chat_documents/${Date.now()}_${safeName}`);
          const uploadTask = storageRef.put(file);
          const uploadPromise = uploadTask.then(snapshot => snapshot.ref.getDownloadURL());
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Storage timeout')), 12000));
          
          const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
          if (downloadUrl) {
            this.pendingAttachment = {
              name: file.name,
              type: 'document',
              docType: docType,
              docIcon: docIcon,
              dataUrl: downloadUrl,
              size: file.size
            };

            if (this.chatAttachmentPreview && this.attachmentPreviewName) {
              this.attachmentPreviewName.innerText = `${docIcon} Ready: ${file.name}`;
              this.chatAttachmentPreview.style.display = 'flex';
            }
            return;
          }
        } catch (storageErr) {
          console.warn('Firebase Storage not reachable for document, falling back to data URL:', storageErr);
        }
      }

      // 2. Safe Data URL fallback for documents <= 450KB
      if (file.size <= 450 * 1024) {
        try {
          const dataUrl = await this._blobToDataUrl(file);
          this.pendingAttachment = {
            name: file.name,
            type: 'document',
            docType: docType,
            docIcon: docIcon,
            dataUrl: dataUrl,
            size: file.size
          };

          if (this.chatAttachmentPreview && this.attachmentPreviewName) {
            this.attachmentPreviewName.innerText = `${docIcon} Ready: ${file.name} (${Math.round(file.size / 1024)} KB)`;
            this.chatAttachmentPreview.style.display = 'flex';
          }
        } catch (err) {
          console.error('Document read error:', err);
          this.clearAttachment();
          alert('Could not read document: ' + err.message);
        }
      } else {
        this.clearAttachment();
        alert(`⚠️ Document "${file.name}" is ${Math.round(file.size / 1024)} KB.\nWithout active cloud storage, attachments must be under 450 KB to fit Firestore limits. Please select a smaller file or connect Firebase Storage.`);
      }
    }
  }

  async compressAudio(file) {
    // 1. If file is very small (< 200KB), preserve original bytes
    if (file.size <= 200 * 1024) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          let dataUrl = reader.result;
          if (!dataUrl) { reject(new Error('Empty audio result')); return; }
          const mime = this._detectAudioMime(dataUrl, file.name);
          if (!dataUrl.startsWith(`data:${mime};`)) {
            dataUrl = dataUrl.replace(/^data:[^;]+;base64,/, `data:${mime};base64,`);
          }
          resolve(dataUrl);
        };
        reader.onerror = (e) => reject(new Error('FileReader error: ' + e));
        reader.readAsDataURL(file);
      });
    }

    // 2. Decode with Web Audio API and resample to clean 12,000 Hz Mono WAV (24 KB/s)
    // 15 seconds = 360 KB PCM -> ~480 KB Base64 (well under Firestore's 1MB document limit)
    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) throw new Error('Web Audio API not supported');

      const audioCtx = new AudioCtx();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const targetSampleRate = 12000;
      const maxSeconds = 15;
      const duration = Math.min(audioBuffer.duration, maxSeconds);
      const targetLength = Math.max(1, Math.floor(duration * targetSampleRate));

      const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const offlineCtx = new OfflineCtx(1, targetLength, targetSampleRate);

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();
      try { await audioCtx.close(); } catch (_) {}

      const wavBlob = this._audioBufferToWav(renderedBuffer);
      const dataUrl = await this._blobToDataUrl(wavBlob);
      console.log(`[Audio] Auto-compressed ${file.name} to 12kHz PCM WAV: ${Math.round(wavBlob.size / 1024)}KB`);
      return dataUrl;
    } catch (decodeErr) {
      console.warn('Web Audio decode fallback to 200KB safe slice:', decodeErr);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          let dataUrl = reader.result;
          const mime = this._detectAudioMime(dataUrl, file.name);
          if (!dataUrl.startsWith(`data:${mime};`)) {
            dataUrl = dataUrl.replace(/^data:[^;]+;base64,/, `data:${mime};base64,`);
          }
          resolve(dataUrl);
        };
        reader.onerror = (e) => reject(new Error('FileReader error: ' + e));
        reader.readAsDataURL(file.slice(0, 200 * 1024));
      });
    }
  }

  _audioBufferToWav(buffer) {
    const numChannels = 1;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.getChannelData(0);
    const dataSize = samples.length * 2;
    const bufferArray = new ArrayBuffer(44 + dataSize);
    const view = new DataView(bufferArray);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');

    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
    view.setUint16(32, numChannels * 2, true);              // BlockAlign
    view.setUint16(34, 16, true);                           // BitsPerSample

    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM 16-bit samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  _detectAudioMime(dataUrl, fileName) {
    if (!dataUrl) return 'audio/mpeg';

    const b64 = (dataUrl.split(',')[1] || '').substring(0, 16);
    if (b64.startsWith('GkXf') || b64.startsWith('Gk')) return 'audio/webm';
    if (b64.startsWith('UklGR')) return 'audio/wav';
    if (b64.startsWith('SUQz') || b64.startsWith('//M') || b64.startsWith('//+')) return 'audio/mpeg';
    if (b64.startsWith('T2dnU')) return 'audio/ogg';
    if (b64.startsWith('AAAA') || b64.includes('ZnR5cA')) return 'audio/mp4';

    const headerMatch = dataUrl.match(/^data:([^;]+);/);
    if (headerMatch && headerMatch[1].startsWith('audio/')) return headerMatch[1];

    const ext = (fileName || '').toLowerCase().split('.').pop();
    const extMap = {
      webm: 'audio/webm', weba: 'audio/webm',
      ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
      wav: 'audio/wav', wave: 'audio/wav',
      mp3: 'audio/mpeg', mpeg: 'audio/mpeg', mpg: 'audio/mpeg',
      m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', amr: 'audio/amr'
    };
    if (extMap[ext]) return extMap[ext];

    return 'audio/webm';
  }

  // Converts a data: URL to a Blob URL with correct MIME type, OR passes through https:// URLs
  resolveAudioSrc(raw) {
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (!raw.startsWith('data:')) return raw;

    try {
      const b64 = (raw.split(',')[1] || '').trim();
      if (!b64) return raw;

      // Detect actual binary audio format from base64 magic bytes
      let mime = 'audio/webm';
      if (b64.startsWith('GkXf') || b64.startsWith('Gk')) {
        mime = 'audio/webm';
      } else if (b64.startsWith('UklGR')) {
        mime = 'audio/wav';
      } else if (b64.startsWith('SUQz') || b64.startsWith('//M') || b64.startsWith('//+')) {
        mime = 'audio/mpeg';
      } else if (b64.startsWith('T2dnU')) {
        mime = 'audio/ogg';
      } else if (b64.startsWith('AAAA') || b64.includes('ZnR5cA')) {
        mime = 'audio/mp4';
      } else {
        const headerMatch = raw.match(/^data:([^;]+);/);
        if (headerMatch && headerMatch[1].startsWith('audio/')) mime = headerMatch[1];
      }

      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const blob = new Blob([bytes], { type: mime });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn('[Audio] resolveAudioSrc fallback:', e);
      return raw;
    }
  }

  toggleEmojiPicker(e) {
    if (e) e.stopPropagation();
    const picker = document.getElementById('chat-emoji-picker');
    if (!picker) return;
    const isVisible = picker.style.display === 'block';
    picker.style.display = isVisible ? 'none' : 'block';
  }

  initEmojiPicker() {
    const btnEmoji = document.getElementById('btn-chat-emoji');
    const picker = document.getElementById('chat-emoji-picker');
    const tabEmojis = document.getElementById('tab-picker-emojis');
    const tabStickers = document.getElementById('tab-picker-stickers');
    const viewEmojis = document.getElementById('picker-view-emojis');
    const viewStickers = document.getElementById('picker-view-stickers');
    const gridEmojis = document.getElementById('chat-emoji-grid');
    const btnAddSticker = document.getElementById('btn-add-custom-sticker');
    const stickerFileInput = document.getElementById('sticker-file-input');

    if (!btnEmoji || !picker) return;

    // Prevent clicks inside picker from closing it
    picker.addEventListener('click', (e) => e.stopPropagation());

    // 1. Emoji Tab Setup
    const emojis = [
      '😀','😂','🤣','😍','😎','🥳','🔥','💯','❤️','✨',
      '🎵','🎧','🚀','👏','👍','🙌','💡','🍕','☕','🎮',
      '🌟','👑','💎','🎉','⚡','💬','🤖','🦾','🧠','👀',
      '🙏','🤩','😴','🤯','😭','💀','💩','😺','🍿','🍻'
    ];

    if (gridEmojis) {
      gridEmojis.innerHTML = '';
      emojis.forEach((emoji) => {
        const span = document.createElement('span');
        span.innerText = emoji;
        span.style.cssText = 'cursor: pointer; padding: 4px; border-radius: 6px; transition: transform 0.15s; user-select: none; font-size: 20px;';
        span.onmouseover = () => span.style.transform = 'scale(1.25)';
        span.onmouseout = () => span.style.transform = 'scale(1)';
        span.onclick = (e) => {
          e.stopPropagation();
          if (this.chatInput) {
            this.chatInput.value += emoji;
            this.chatInput.focus();
          }
          picker.style.display = 'none';
        };
        gridEmojis.appendChild(span);
      });
    }

    // 2. Tab Switcher
    if (tabEmojis && tabStickers && viewEmojis && viewStickers) {
      tabEmojis.onclick = (e) => {
        e.stopPropagation();
        tabEmojis.style.background = 'rgba(255,255,255,0.15)';
        tabEmojis.style.color = '#fff';
        tabStickers.style.background = 'transparent';
        tabStickers.style.color = 'var(--text-muted)';
        viewEmojis.style.display = 'block';
        viewStickers.style.display = 'none';
      };

      tabStickers.onclick = (e) => {
        e.stopPropagation();
        tabStickers.style.background = 'rgba(255,255,255,0.15)';
        tabStickers.style.color = '#fff';
        tabEmojis.style.background = 'transparent';
        tabEmojis.style.color = 'var(--text-muted)';
        viewStickers.style.display = 'block';
        viewEmojis.style.display = 'none';
        this.renderStickersGrid();
      };
    }

    // 3. Custom Sticker File Upload
    if (btnAddSticker && stickerFileInput) {
      btnAddSticker.onclick = (e) => {
        e.stopPropagation();
        stickerFileInput.click();
      };
      stickerFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const stickerDataUrl = await this.compressImage(file, 160, 0.85);
          const customStickers = JSON.parse(localStorage.getItem('apex_custom_stickers') || '[]');
          customStickers.unshift(stickerDataUrl);
          localStorage.setItem('apex_custom_stickers', JSON.stringify(customStickers.slice(0, 30)));
          this.renderStickersGrid();
        } catch (err) {
          alert('Could not save sticker: ' + err.message);
        }
      });
    }

    // 4. Toggle Popover
    btnEmoji.addEventListener('click', (e) => {
      e.stopPropagation();
      picker.style.display = picker.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target) && e.target !== btnEmoji) {
        picker.style.display = 'none';
      }
    });

    this.renderStickersGrid();
  }

  renderStickersGrid() {
    const grid = document.getElementById('chat-stickers-grid');
    const picker = document.getElementById('chat-emoji-picker');
    if (!grid) return;

    // Rich built-in SVG and Web sticker icons
    const defaultStickers = [
      'https://api.iconify.design/fluent-emoji:cat-face.svg',
      'https://api.iconify.design/fluent-emoji:fire.svg',
      'https://api.iconify.design/fluent-emoji:rocket.svg',
      'https://api.iconify.design/fluent-emoji:party-popper.svg',
      'https://api.iconify.design/fluent-emoji:smiling-face-with-sunglasses.svg',
      'https://api.iconify.design/fluent-emoji:sparkles.svg',
      'https://api.iconify.design/fluent-emoji:alien-monster.svg',
      'https://api.iconify.design/fluent-emoji:glowing-star.svg',
      'https://api.iconify.design/fluent-emoji:crown.svg',
      'https://api.iconify.design/fluent-emoji:gem-stone.svg',
      'https://api.iconify.design/fluent-emoji:robot.svg',
      'https://api.iconify.design/fluent-emoji:headphone.svg'
    ];

    const customStickers = JSON.parse(localStorage.getItem('apex_custom_stickers') || '[]');
    const allStickers = [...customStickers, ...defaultStickers];

    grid.innerHTML = '';
    allStickers.forEach((stickerUrl) => {
      const img = document.createElement('img');
      img.src = stickerUrl;
      img.style.cssText = 'width: 60px; height: 60px; object-fit: contain; cursor: pointer; padding: 4px; border-radius: 8px; background: rgba(255,255,255,0.06); transition: transform 0.15s, background 0.15s; display: block;';
      img.onmouseover = () => {
        img.style.transform = 'scale(1.15)';
        img.style.background = 'rgba(255,255,255,0.18)';
      };
      img.onmouseout = () => {
        img.style.transform = 'scale(1)';
        img.style.background = 'rgba(255,255,255,0.06)';
      };
      img.onclick = (e) => {
        e.stopPropagation();
        this.sendSticker(stickerUrl);
        if (picker) picker.style.display = 'none';
      };
      grid.appendChild(img);
    });
  }

  async sendSticker(stickerUrl) {
    if (!this.activeRoomId) this.activeRoomId = 'general_lounge';
    const sender = this.getSenderIdentity();
    const isIncognito = Boolean(sender.isIncognito);
    const newMsg = {
      text: '',
      attachment: {
        name: 'Sticker',
        type: 'sticker',
        dataUrl: stickerUrl
      },
      senderId: String(sender.uid || 'anon'),
      senderName: String(sender.name || 'Anonymous'),
      senderEmail: isIncognito ? '' : String(sender.email || ''),
      isAnonymous: isIncognito ? true : Boolean(sender.isAnon),
      hideAdminBadge: isIncognito,
      readBy: [String(sender.uid || 'anon')],
      localTimestamp: Date.now(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (this.replyingTo) {
      newMsg.replyTo = this.replyingTo;
      this.clearReply();
    }

    try {
      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .collection('messages')
        .add(newMsg);

      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .set({
          lastMessage: '✨ Sticker',
          lastMessageSender: sender.name,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      this.scrollChatToBottom();
    } catch (err) {
      console.error('Failed to send sticker:', err);
    }
  }

  compressImage(file, maxDimension = 800, quality = 0.75) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = event.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  clearAttachment() {
    this.pendingAttachment = null;
    if (this.chatFileInput) this.chatFileInput.value = '';
    if (this.chatAttachmentPreview) this.chatAttachmentPreview.style.display = 'none';
    if (this.attachmentPreviewName) this.attachmentPreviewName.innerText = '📎 Attachment';
  }

  // --- Realtime Chat Rooms & Groups ---
  async seedDefaultRoomsIfEmpty() {
    if (!window.fbDb) return;

    try {
      const defaultRooms = [
        {
          id: 'general_lounge',
          name: '🌐 General Lounge',
          description: 'Public community hangout for all Apex Space friends',
          type: 'group',
          icon: '🌐',
          createdBy: 'system',
          createdByName: 'Apex Space',
          members: ['all'],
          memberEmails: ['all'],
          lastMessage: 'Welcome to Apex Space Social Hub!',
          lastMessageSender: 'Apex System',
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        {
          id: 'announcements',
          name: '📢 Official Announcements',
          description: 'Official announcements from Admin. Non-admin users can submit suggestions & bug reports.',
          type: 'group',
          icon: '📢',
          createdBy: 'system',
          createdByName: 'Apex Admin',
          members: ['all'],
          memberEmails: ['all'],
          lastMessage: 'Welcome to the Announcements channel! Submit suggestions or bug reports to Admin anytime.',
          lastMessageSender: 'Apex System',
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      ];

      // Clean up deleted groups for everyone across database
      try {
        await window.fbDb.collection('chat_rooms').doc('study_notes').delete();
        await window.fbDb.collection('chat_rooms').doc('projects_code').delete();
      } catch (_) {}

      // Reset active room if it was on a deleted room
      if (this.activeRoomId === 'study_notes' || this.activeRoomId === 'projects_code') {
        this.activeRoomId = 'general_lounge';
        localStorage.setItem('apex_active_room', 'general_lounge');
      }

      for (const r of defaultRooms) {
        await window.fbDb.collection('chat_rooms').doc(r.id).set(r, { merge: true });
      }
    } catch (err) {
      console.warn('Could not seed default rooms:', err);
    }
  }

  startRoomsListener() {
    if (!window.fbDb) return;
    if (this.unsubscribeRooms) this.unsubscribeRooms();

    this.unsubscribeRooms = window.fbDb.collection('chat_rooms').onSnapshot(
      (snapshot) => {
        this.roomsList = [];
        snapshot.forEach((doc) => {
          this.roomsList.push({ id: doc.id, ...doc.data() });
        });

        // Client-side sort by lastMessageTime descending
        this.roomsList.sort((a, b) => {
          const tA = a.lastMessageTime && a.lastMessageTime.toMillis ? a.lastMessageTime.toMillis() : 0;
          const tB = b.lastMessageTime && b.lastMessageTime.toMillis ? b.lastMessageTime.toMillis() : 0;
          return tB - tA;
        });

        this.renderRoomsList();
      },
      (err) => {
        console.error('Chat rooms listener error:', err);
      }
    );
  }

  renderRoomsList() {
    if (!this.roomsListContainer || !this.directListContainer) return;

    this.roomsListContainer.innerHTML = '';
    this.directListContainer.innerHTML = '';

    const groups = this.roomsList.filter(r => r.type !== 'direct');
    const directChats = this.roomsList.filter(r => r.type === 'direct');

    // 1. Render Group Rooms
    if (groups.length === 0) {
      this.roomsListContainer.innerHTML = `<p style="font-size: 11px; color: var(--text-dim); text-align: center; padding: 12px 0;">No groups available.</p>`;
    } else {
      groups.forEach((room) => {
        const item = this.createRoomListItem(room);
        this.roomsListContainer.appendChild(item);
      });
    }

    // 2. Render Direct Chats
    if (directChats.length === 0) {
      this.directListContainer.innerHTML = `<p style="font-size: 11px; color: var(--text-dim); text-align: center; padding: 12px 0;">No direct conversations yet.</p>`;
    } else {
      directChats.forEach((room) => {
        const item = this.createRoomListItem(room);
        this.directListContainer.appendChild(item);
      });
    }
  }

  createRoomListItem(room) {
    const isSelected = this.activeRoomId === room.id;
    const div = document.createElement('div');
    div.className = `chat-room-item ${isSelected ? 'active' : ''}`;
    div.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      cursor: pointer;
      margin-bottom: 6px;
      transition: all 0.2s ease;
      background: ${isSelected ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.02)'};
      border: 1px solid ${isSelected ? '#ffffff' : 'transparent'};
    `;

    let roomTitle = room.name;
    let roomAvatar = room.icon || '💬';
    const myId = this.getSenderIdentity();

    if (room.type === 'direct') {
      let otherName = 'Friend';
      if (room.memberNames && Array.isArray(room.memberNames)) {
        const found = room.memberNames.find(n => n && n !== myId.name && n !== myId.email);
        if (found) otherName = this.getCleanDisplayName(found);
      } else if (room.name) {
        otherName = this.getCleanDisplayName(room.name.replace(/^Chat with\s+/i, ''));
      }
      roomTitle = otherName;
      roomAvatar = otherName.charAt(0).toUpperCase();
    }

    const lastMsg = room.lastMessage || 'No messages yet';
    const canDeleteRoom = room.type === 'direct' || (room.id !== 'general_lounge' && room.id !== 'announcements' && (this.isAdminUser() || room.createdBy === myId.uid));

    div.innerHTML = `
      <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 50%; background: #ffffff; color: #000000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">
        ${roomAvatar}
      </div>
      <div style="overflow: hidden; flex: 1; min-width: 0;">
        <div style="font-size: 13px; font-weight: 600; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
          ${this.escapeHtml(roomTitle)}
        </div>
        <div style="font-size: 11px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-top: 2px;">
          ${this.escapeHtml(lastMsg)}
        </div>
      </div>
      ${canDeleteRoom ? `
        <button type="button" class="btn-delete-room-item" style="background: transparent; border: none; cursor: pointer; color: var(--text-dim); font-size: 12px; padding: 4px 6px; border-radius: 4px; opacity: 0.5; transition: opacity 0.2s, color 0.2s; flex-shrink: 0;" title="${room.type === 'direct' ? 'Delete this DM conversation' : 'Delete group'}">🗑️</button>
      ` : ''}
    `;

    const delRoomBtn = div.querySelector('.btn-delete-room-item');
    if (delRoomBtn) {
      delRoomBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteRoom(room, roomTitle);
      });
    }

    div.addEventListener('click', () => {
      this.selectRoom(room);
      this.showMobileChat();
    });
    return div;
  }

  async deleteRoom(room, roomTitle) {
    if (!room || !room.id || room.id === 'general_lounge' || room.id === 'announcements') return;
    if (!window.fbDb) {
      alert('Firebase connection not ready.');
      return;
    }

    const typeLabel = room.type === 'direct' ? 'direct conversation' : 'group channel';
    const confirmed = confirm(`🗑️ Delete Conversation\n\nAre you sure you want to delete your ${typeLabel} with "${roomTitle || room.name}"?\n\nThis will permanently delete this chat from your Direct Messages.`);
    if (!confirmed) return;

    try {
      // 1. Batch delete all messages inside this room
      const messagesRef = window.fbDb
        .collection('chat_rooms')
        .doc(room.id)
        .collection('messages');

      const snap = await messagesRef.get();
      if (!snap.empty) {
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = window.fbDb.batch();
          const chunk = docs.slice(i, i + 400);
          chunk.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      // 2. Delete the room doc
      await window.fbDb.collection('chat_rooms').doc(room.id).delete();

      // 3. If currently open, switch back to general lounge
      if (this.activeRoomId === room.id) {
        const genRoom = this.roomsList.find(r => r.id === 'general_lounge') || {
          id: 'general_lounge',
          name: '🌐 General Lounge',
          description: 'Public community group for all friends',
          icon: '🌐',
          type: 'group'
        };
        this.selectRoom(genRoom);
      }
    } catch (err) {
      console.error('Failed to delete room:', err);
      alert('Could not delete conversation: ' + err.message);
    }
  }

  getCleanDisplayName(raw) {
    if (!raw) return 'Friend';
    if (raw.includes('@')) {
      return raw.split('@')[0];
    }
    return raw;
  }

  selectRoom(room) {
    this.activeRoomId = room.id;
    this.activeRoomData = room;

    // Highlight room in list
    document.querySelectorAll('.chat-room-item').forEach((el) => {
      el.style.background = 'rgba(255,255,255,0.02)';
      el.style.borderColor = 'transparent';
    });

    // Update Header
    let roomTitle = room.name;
    let roomAvatar = room.icon || '💬';
    let roomSubtitle = room.description || (room.type === 'direct' ? '🔒 Private 1-on-1 Direct Chat' : 'Group Channel');

    if (room.type === 'direct') {
      const myId = this.getSenderIdentity();
      let otherName = 'Friend';
      if (room.memberNames && Array.isArray(room.memberNames)) {
        const found = room.memberNames.find(n => n && n !== myId.name && n !== myId.email);
        if (found) otherName = this.getCleanDisplayName(found);
      } else if (room.name) {
        otherName = this.getCleanDisplayName(room.name.replace(/^Chat with\s+/i, ''));
      }
      roomTitle = otherName;
      roomAvatar = otherName.charAt(0).toUpperCase();
      roomSubtitle = '🔒 Private 1-on-1 Direct Chat';
    }

    if (this.chatHeaderTitle) this.chatHeaderTitle.innerText = roomTitle;
    if (this.chatHeaderSubtitle) this.chatHeaderSubtitle.innerText = roomSubtitle;
    if (this.chatHeaderAvatar) this.chatHeaderAvatar.innerText = roomAvatar;

    if (this.chatEmptyState) this.chatEmptyState.style.display = 'none';
    if (this.chatActiveWindow) this.chatActiveWindow.style.display = 'flex';

    // Announcements Channel: Read-Only for non-admins
    const isAnnouncements = room.id === 'announcements';
    const noticeBar = document.getElementById('announcements-notice-bar');
    if (isAnnouncements && !this.isAdminUser()) {
      if (this.chatForm) this.chatForm.style.display = 'none';
      if (noticeBar) noticeBar.style.display = 'flex';
    } else {
      if (this.chatForm) this.chatForm.style.display = 'flex';
      if (noticeBar) noticeBar.style.display = 'none';
    }

    // Start presence status for this direct conversation
    this.listenToRoomPresence(room);

    this.startMessagesListener(room.id);
  }

  showMobileChat() {
    if (window.innerWidth <= 768) {
      if (this.chatSidebarPanel) this.chatSidebarPanel.style.display = 'none';
      if (this.chatMainWindow) this.chatMainWindow.style.display = 'flex';
      if (this.mobileBackBtn) this.mobileBackBtn.style.display = 'inline-flex';
    }
  }

  showMobileChannels() {
    if (window.innerWidth <= 768) {
      if (this.chatSidebarPanel) this.chatSidebarPanel.style.display = 'flex';
      if (this.chatMainWindow) this.chatMainWindow.style.display = 'none';
      if (this.mobileBackBtn) this.mobileBackBtn.style.display = 'none';
    }
  }

  toggleSidebar() {
    if (!this.chatSidebarPanel) return;

    if (window.innerWidth <= 768) {
      if (this.chatSidebarPanel.style.display === 'none') {
        this.showMobileChannels();
      } else {
        this.showMobileChat();
      }
      return;
    }

    const isCollapsed = this.chatSidebarPanel.classList.toggle('collapsed');
    const toggleIcon = document.getElementById('sidebar-toggle-icon');
    const toggleBtn = document.getElementById('btn-toggle-sidebar-desktop');

    if (toggleIcon) {
      toggleIcon.innerText = isCollapsed ? '▶' : '◀';
    }
    if (toggleBtn) {
      toggleBtn.title = isCollapsed ? 'Show Side Channels' : 'Hide Side Channels';
    }
  }

  startMessagesListener(roomId) {
    if (!window.fbDb) {
      if (this.chatMessagesContainer) {
        this.chatMessagesContainer.innerHTML = `<div style="text-align:center;padding:32px;color:#fff;"><div style="font-size:36px;margin-bottom:10px;">🔌</div><h4>Not connected to Firebase</h4><p style="font-size:12px;color:var(--text-muted);">Make sure Firebase is loaded and you are online.</p></div>`;
      }
      return;
    }

    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
      this.unsubscribeMessages = null;
    }

    this.activeRoomId = roomId;
    this._initialMessagesLoaded = false;

    if (this.chatMessagesContainer) {
      this.chatMessagesContainer.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-dim);">Loading messages...</div>`;
    }

    // Fetch without orderBy to avoid Firestore index errors, sort client-side
    const messagesRef = window.fbDb
      .collection('chat_rooms')
      .doc(roomId)
      .collection('messages')
      .limit(100);

    this.unsubscribeMessages = messagesRef.onSnapshot(
      (snapshot) => {
        if (!this.chatMessagesContainer) return;
        this.chatMessagesContainer.innerHTML = '';

        if (snapshot.empty) {
          this.chatMessagesContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
              <div style="font-size: 36px; margin-bottom: 10px;">💬</div>
              <h4 style="font-size: 15px; font-weight: 600; color: #fff;">No messages yet</h4>
              <p style="font-size: 12px; margin-top: 6px;">Type below and press <strong>Enter</strong> to send!</p>
            </div>
          `;
          return;
        }

        // Sort messages by createdAt client-side
        const docs = [];
        snapshot.forEach((doc) => docs.push({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => {
          const ta = (a.createdAt && a.createdAt.toMillis) ? a.createdAt.toMillis() : (a.localTimestamp || Date.now());
          const tb = (b.createdAt && b.createdAt.toMillis) ? b.createdAt.toMillis() : (b.localTimestamp || Date.now());
          return ta - tb;
        });

        this._lastLoadedMessages = docs;

        docs.forEach((msg) => {
          const msgEl = this.createMessageBubbleElement(msg);
          this.chatMessagesContainer.appendChild(msgEl);
        });

        // 👁️ Automatically mark unread messages as read
        this.markActiveRoomMessagesAsRead(docs);

        // 🔔 Push / Sound notification for newly added incoming messages ONLY
        if (this._initialMessagesLoaded) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const msgData = { id: change.doc.id, ...change.doc.data() };
              const myId = this.getSenderIdentity();
              if (msgData.senderId && msgData.senderId !== myId.uid) {
                this.notifyNewMessage(msgData);
              }
            }
          });
        }
        this._initialMessagesLoaded = true;

        this.scrollChatToBottom();
      },
      (err) => {
        console.error('Messages listener error:', err);
        if (this.chatMessagesContainer) {
          this.chatMessagesContainer.innerHTML = `
            <div style="text-align:center;padding:32px;color:#fff;">
              <div style="font-size:36px;margin-bottom:10px;">⚠️</div>
              <h4>Could not load messages</h4>
              <p style="font-size:12px;color:var(--text-muted);max-width:320px;margin:6px auto;">${this.escapeHtml(err.message)}</p>
              <button onclick="window.socialModule && window.socialModule.startMessagesListener('${roomId}')" style="margin-top:12px;padding:8px 18px;background:#fff;color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:700;">Retry</button>
            </div>
          `;
        }
      }
    );

    // Live pinned-message banner for this room
    this.listenToPinnedMessage(roomId);
  }

  listenToPinnedMessage(roomId) {
    if (!window.fbDb) return;
    if (this._unsubscribePinned) {
      this._unsubscribePinned();
      this._unsubscribePinned = null;
    }

    const banner   = document.getElementById('chat-pinned-banner');
    const textEl   = document.getElementById('chat-pinned-text');
    const unpinBtn = document.getElementById('btn-unpin-msg');

    this._unsubscribePinned = window.fbDb
      .collection('chat_rooms')
      .doc(roomId)
      .onSnapshot((snap) => {
        const data   = snap.data() || {};
        const pinned = data.pinnedMessage;

        if (pinned && pinned.text) {
          this._pinnedMessageId = pinned.msgId || null;
          const label = pinned.senderName ? `${pinned.senderName}: ${pinned.text}` : pinned.text;
          if (textEl)   textEl.textContent = label;
          if (banner)   banner.style.display = 'flex';
          if (unpinBtn) unpinBtn.style.display = this.isAdminUser() ? 'inline-flex' : 'none';
        } else {
          this._pinnedMessageId = null;
          if (banner)  banner.style.display = 'none';
          if (textEl)  textEl.textContent = '';
        }
      }, (err) => console.warn('Pinned listener error:', err));
  }

  async pinMessage(msgId, msgText, senderName) {
    if (!this.isAdminUser()) return;
    if (!window.fbDb) return;
    try {
      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .set({
          pinnedMessage: {
            msgId,
            text: msgText,
            senderName,
            pinnedAt: firebase.firestore.FieldValue.serverTimestamp()
          }
        }, { merge: true });
    } catch (e) {
      console.error('Pin message error:', e);
      alert('Could not pin message: ' + e.message);
    }
  }

  async unpinMessage() {
    if (!this.isAdminUser()) return;
    if (!window.fbDb) return;
    try {
      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .update({ pinnedMessage: firebase.firestore.FieldValue.delete() });
    } catch (e) {
      console.error('Unpin error:', e);
    }
  }

  scrollToPinnedMessage() {
    if (!this._pinnedMessageId) return;
    this.scrollToMessage(this._pinnedMessageId);
  }

  scrollToMessage(msgId) {
    if (!msgId) return;
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const bubble = el.querySelector('.chat-bubble-content') || el;
      bubble.style.transition = 'all 0.3s';
      bubble.style.boxShadow = '0 0 25px rgba(255, 255, 255, 0.9)';
      setTimeout(() => { bubble.style.boxShadow = ''; }, 1600);
    }
  }

  setReplyTarget(msg) {
    if (!msg) return;
    const preview = msg.text
      ? msg.text.slice(0, 90)
      : (msg.attachment ? `[${msg.attachment.type || 'Attachment'}: ${msg.attachment.name || ''}]` : 'Message');

    this.replyingTo = {
      id: msg.id || '',
      senderName: msg.senderName || 'Friend',
      text: preview
    };

    if (this.replyPreview && this.replyPreviewSender && this.replyPreviewText) {
      this.replyPreviewSender.innerText = this.replyingTo.senderName;
      this.replyPreviewText.innerText = this.replyingTo.text;
      this.replyPreview.style.display = 'flex';
    }

    if (this.chatInput) {
      this.chatInput.focus();
    }
  }

  clearReply() {
    this.replyingTo = null;
    if (this.replyPreview) {
      this.replyPreview.style.display = 'none';
    }
  }

  async toggleReaction(msgId, emoji) {
    if (!msgId || !emoji || !this.activeRoomId || !window.fbDb) return;
    const myUid = this.getSenderIdentity().uid;
    const msgRef = window.fbDb
      .collection('chat_rooms')
      .doc(this.activeRoomId)
      .collection('messages')
      .doc(msgId);

    try {
      const snap = await msgRef.get();
      if (!snap.exists) return;
      const data = snap.data() || {};
      const reactions = { ...(data.reactions || {}) };
      let currentUids = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];

      if (currentUids.includes(myUid)) {
        currentUids = currentUids.filter(id => id !== myUid);
      } else {
        currentUids.push(myUid);
      }

      if (currentUids.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = currentUids;
      }

      await msgRef.update({ reactions });
    } catch (err) {
      console.error('Toggle reaction error:', err);
    }
  }

  renderReactionsHtml(msg, myUid) {
    if (!msg.reactions || typeof msg.reactions !== 'object') return '';
    const emojis = Object.keys(msg.reactions).filter(e => Array.isArray(msg.reactions[e]) && msg.reactions[e].length > 0);
    if (emojis.length === 0) return '';

    return `
      <div class="chat-reactions-row">
        ${emojis.map(emoji => {
          const uids = msg.reactions[emoji];
          const hasReacted = uids.includes(myUid);
          return `
            <button type="button" class="chat-reaction-pill ${hasReacted ? 'reacted-by-me' : ''}" data-msg-id="${msg.id}" data-emoji="${emoji}" title="${uids.length} reaction${uids.length > 1 ? 's' : ''}">
              <span>${emoji}</span>
              <span>${uids.length}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  renderReadReceiptHtml(msg) {
    const isDirect = this.activeRoomData && this.activeRoomData.type === 'direct';
    const myUid = this.getSenderIdentity().uid;
    const readBy = msg.readBy || [];

    if (isDirect) {
      const isSeenByOther = readBy.some(id => id && id !== myUid);
      if (isSeenByOther) {
        return `<span style="color: #007aff; font-size: 11px; font-weight: 800; letter-spacing: -1px;" title="Read / Seen">✓✓</span>`;
      }
      return `<span style="color: rgba(0,0,0,0.35); font-size: 11px; font-weight: 700;" title="Delivered">✓</span>`;
    } else {
      const isReadByOthers = readBy.filter(id => id && id !== myUid).length > 0;
      if (isReadByOthers) {
        return `<span style="color: #34c759; font-size: 11px; font-weight: 800; letter-spacing: -1px;" title="Seen by members">✓✓</span>`;
      }
      return `<span style="color: rgba(0,0,0,0.35); font-size: 11px; font-weight: 700;" title="Sent">✓</span>`;
    }
  }

  createMessageBubbleElement(msg) {
    const myIdentity = this.getSenderIdentity();
    const isMe = msg.senderId === myIdentity.uid;
    const canDelete = isMe || this.isAdminUser();
    const canEdit = isMe && !msg.deletedForEveryone && !msg.poll && Boolean(msg.text);
    const canPin = this.isAdminUser() && !msg.deletedForEveryone;
    const showAdminBadge = !msg.hideAdminBadge && (msg.senderEmail === window.ADMIN_EMAIL);

    const timeFormatted = msg.createdAt && msg.createdAt.toDate
      ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const div = document.createElement('div');
    if (msg.id) div.id = `msg-${msg.id}`;
    div.className = `chat-msg-wrapper ${isMe ? 'is-me' : ''}`;
    div.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: ${isMe ? 'flex-end' : 'flex-start'};
      margin-bottom: 14px;
      max-width: 86%;
      ${isMe ? 'margin-left: auto;' : 'margin-right: auto;'}
    `;

    // 1. Deleted Message State (Unsend for Everyone)
    if (msg.deletedForEveryone) {
      div.innerHTML = `
        <div class="chat-bubble-content" style="
          background: ${isMe ? 'rgba(255,255,255,0.06)' : 'rgba(24, 24, 24, 0.6)'};
          color: var(--text-muted);
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 12px;
          border: 1px dashed rgba(255,255,255,0.15);
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span class="chat-msg-deleted">🚫 This message was deleted</span>
          <span style="font-size: 10px; color: var(--text-dim); margin-left: auto;">${timeFormatted}</span>
        </div>
      `;
      return div;
    }

    // Sender Avatar setup
    const senderPhoto = msg.senderPhotoURL || (msg.senderEmail === window.ADMIN_EMAIL && !msg.hideAdminBadge ? 'assets/apex-logo.png' : '');
    const senderInitial = (msg.senderName || 'F').charAt(0).toUpperCase();

    const isSticker = msg.attachment && msg.attachment.type === 'sticker';

    if (isSticker) {
      div.innerHTML = `
        <!-- Floating Hover Action Bar -->
        <div class="chat-msg-actions">
          <button type="button" class="chat-action-btn btn-trigger-react" title="React with emoji">😀+</button>
          <button type="button" class="chat-action-btn btn-trigger-reply" title="Reply to this message">↩️</button>
          ${canPin ? `<button type="button" class="chat-action-btn btn-pin-chat-msg" title="Pin message">📌</button>` : ''}
          ${canDelete ? `<button type="button" class="chat-action-btn btn-delete-chat-msg" style="color: #ff4d4d;" title="Delete for Everyone">🗑️</button>` : ''}
        </div>

        <!-- Floating Reaction Dock -->
        <div class="chat-reaction-dock" style="${isMe ? 'right: 0;' : 'left: 0;'}">
          <button type="button" class="reaction-emoji-btn" data-emoji="❤️">❤️</button>
          <button type="button" class="reaction-emoji-btn" data-emoji="😂">😂</button>
          <button type="button" class="reaction-emoji-btn" data-emoji="👍">👍</button>
          <button type="button" class="reaction-emoji-btn" data-emoji="🔥">🔥</button>
          <button type="button" class="reaction-emoji-btn" data-emoji="😮">😮</button>
          <button type="button" class="reaction-emoji-btn" data-emoji="😢">😢</button>
        </div>

        ${!isMe ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; margin-left: 2px;">
            <div class="chat-sender-avatar" style="width: 22px; height: 22px; min-width: 22px; font-size: 10px;">
              ${senderPhoto ? `<img src="${senderPhoto}">` : senderInitial}
            </div>
            <span style="font-size: 11px; font-weight: 700; color: #fff;">${this.escapeHtml(msg.senderName || 'Friend')}</span>
            ${showAdminBadge ? '<span class="badge badge-project" style="font-size: 8px; padding: 1px 4px; background: #fff; color: #000; font-weight: 800;">ADMIN</span>' : ''}
          </div>
        ` : ''}

        <!-- Quoted Reply Card if Present -->
        ${msg.replyTo ? `
          <div class="chat-bubble-reply-quote" onclick="if(window.socialModule) window.socialModule.scrollToMessage('${msg.replyTo.id}')" style="margin-bottom: 4px; padding: 5px 9px; background: rgba(255,255,255,0.08); border-left: 3px solid #ffffff; border-radius: 6px; font-size: 11px; cursor: pointer; max-width: 160px;">
            <div style="font-weight: 700; color: #ffffff; margin-bottom: 2px;">↩️ ${this.escapeHtml(msg.replyTo.senderName || 'Friend')}</div>
            <div style="color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(msg.replyTo.text || '[Attachment]')}</div>
          </div>
        ` : ''}

        <div class="chat-bubble-content" style="position: relative; padding: 4px;">
          <img src="${msg.attachment.dataUrl}" style="width: 120px; height: 120px; object-fit: contain; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.55)); display: block;" alt="Sticker">
          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 4px; font-size: 10px; color: var(--text-dim);">
            <span>${timeFormatted}</span>
            ${isMe ? this.renderReadReceiptHtml(msg) : ''}
          </div>
        </div>

        <!-- Reactions Row -->
        ${this.renderReactionsHtml(msg, myIdentity.uid)}
      `;
    } else {
      const audioSrc = msg.attachment && msg.attachment.type === 'audio' 
        ? this.resolveAudioSrc(msg.attachment.dataUrl)
        : '';

      div.innerHTML = `
        <!-- Floating Hover Action Bar -->
        <div class="chat-msg-actions">
          <button type="button" class="chat-action-btn btn-trigger-react" title="React with emoji">😀+</button>
          <button type="button" class="chat-action-btn btn-trigger-reply" title="Reply to this message">↩️</button>
          ${canEdit ? `<button type="button" class="chat-action-btn btn-edit-chat-msg" title="Edit message">✏️</button>` : ''}
          ${canPin ? `<button type="button" class="chat-action-btn btn-pin-chat-msg" title="Pin message">📌</button>` : ''}
          ${canDelete ? `<button type="button" class="chat-action-btn btn-delete-chat-msg" style="color: #ff4d4d;" title="Delete for Everyone">🗑️</button>` : ''}
        </div>

        <!-- Floating Reaction Dock -->
        <div class="chat-reaction-dock" style="${isMe ? 'right: 0;' : 'left: 0;'}">
          <button type="button" class="reaction-emoji-btn" data-emoji="❤️">❤️</button>
          <button type="button" class="reaction-emoji-btn" data-emoji="😂">😂</button>
          <button type="button" class="reaction-emoji-btn" data-emoji="👍">👍</button>
          <button type="button" class="reaction-emoji-btn" data-emoji="🔥">🔥</button>
          <button type="button" class="reaction-emoji-btn" data-emoji="😮">😮</button>
          <button type="button" class="reaction-emoji-btn" data-emoji="😢">😢</button>
        </div>

        ${!isMe ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; margin-left: 2px;">
            <div class="chat-sender-avatar" style="width: 22px; height: 22px; min-width: 22px; font-size: 10px;">
              ${senderPhoto ? `<img src="${senderPhoto}">` : senderInitial}
            </div>
            <span style="font-size: 11px; font-weight: 700; color: #fff;">${this.escapeHtml(msg.senderName || 'Friend')}</span>
            ${showAdminBadge ? '<span class="badge badge-project" style="font-size: 8px; padding: 1px 4px; background: #fff; color: #000; font-weight: 800;">ADMIN</span>' : ''}
          </div>
        ` : ''}

        <div class="chat-bubble-content" style="
          background: ${isMe ? '#ffffff' : 'rgba(24, 24, 24, 0.9)'};
          color: ${isMe ? '#000000' : '#f4f4f5'};
          padding: 10px 14px;
          border-radius: 16px;
          ${isMe ? 'border-top-right-radius: 4px;' : 'border-top-left-radius: 4px; border: 1px solid var(--border-subtle);'}
          font-size: 13px;
          line-height: 1.5;
          position: relative;
          word-break: break-word;
          box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        ">
          <!-- Quoted Reply Card inside Bubble -->
          ${msg.replyTo ? `
            <div class="chat-bubble-reply-quote" onclick="if(window.socialModule) window.socialModule.scrollToMessage('${msg.replyTo.id}')" style="margin-bottom: 6px; padding: 6px 10px; background: ${isMe ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}; border-left: 3px solid ${isMe ? '#000000' : '#ffffff'}; border-radius: 6px; font-size: 11px; cursor: pointer;">
              <div style="font-weight: 700; color: ${isMe ? '#000000' : '#ffffff'}; margin-bottom: 2px;">↩️ ${this.escapeHtml(msg.replyTo.senderName || 'Friend')}</div>
              <div style="color: ${isMe ? 'rgba(0,0,0,0.65)' : 'var(--text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;">${this.escapeHtml(msg.replyTo.text || '[Attachment]')}</div>
            </div>
          ` : ''}

          ${msg.text ? `<div>${this.formatPostContent(msg.text)}</div>` : ''}

          <!-- Group Poll Component -->
          ${msg.poll ? this.renderPollHtml(msg, myIdentity.uid) : ''}

          <!-- Custom Interactive Audio Player -->
          ${msg.attachment && msg.attachment.type === 'audio' ? `
            <div class="chat-custom-audio-player" style="margin-top: 8px; padding: 10px 14px; background: ${isMe ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.6)'}; border-radius: 12px; min-width: 250px; max-width: 320px; border: 1px solid rgba(255,255,255,0.1);">
              <div style="font-size: 11px; font-weight: 700; margin-bottom: 8px; color: ${isMe ? '#000' : '#fff'}; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${msg.attachment.name.startsWith('🎙️') ? msg.attachment.name : '🎵 ' + this.escapeHtml(msg.attachment.name)}</span>
                <a href="${audioSrc}" download="${this.escapeHtml(msg.attachment.name)}" style="font-size: 12px; color: ${isMe ? '#000' : '#fff'}; text-decoration: none;" title="Download audio track">⬇️</a>
              </div>
              
              <div style="display: flex; align-items: center; gap: 10px;">
                <button type="button" class="btn-play-pause-audio" style="width: 38px; height: 38px; min-width: 38px; border-radius: 50%; background: ${isMe ? '#000000' : '#ffffff'}; color: ${isMe ? '#ffffff' : '#000000'}; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: transform 0.15s;" title="Play / Pause Audio">
                  ▶
                </button>
                
                <div style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                  <div class="chat-audio-progress-bar" style="width: 100%; height: 6px; background: ${isMe ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)'}; border-radius: 3px; cursor: pointer; position: relative; overflow: hidden;">
                    <div class="chat-audio-progress-fill" style="width: 0%; height: 100%; background: ${isMe ? '#000000' : '#ffffff'}; border-radius: 3px;"></div>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 10px; color: ${isMe ? 'rgba(0,0,0,0.6)' : 'var(--text-dim)'}; font-variant-numeric: tabular-nums;">
                    <span class="chat-audio-current-time">0:00</span>
                    <span class="chat-audio-duration">--:--</span>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Image Attachment (Clean, properly bounded like WhatsApp) -->
          ${msg.attachment && msg.attachment.type === 'image' ? `
            <div style="margin-top: 8px; border-radius: 10px; overflow: hidden; max-width: 280px; max-height: 240px; border: 1px solid rgba(255,255,255,0.15);">
              <img src="${msg.attachment.dataUrl}" style="width: 100%; height: 100%; max-height: 240px; object-fit: cover; display: block; cursor: pointer;" onclick="window.open('${msg.attachment.dataUrl}', '_blank');" title="Click to view full image">
            </div>
          ` : ''}

          <!-- Document Attachment (PDF, Word, Excel, PPT, etc.) -->
          ${msg.attachment && (msg.attachment.type === 'document' || msg.attachment.type === 'file' || msg.attachment.type === 'pdf') ? `
            <div class="chat-custom-doc-attachment" style="margin-top: 8px; padding: 10px 14px; background: ${isMe ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'}; border-radius: 12px; border: 1px solid ${isMe ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)'}; display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 220px; max-width: 320px;">
              <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                <div style="width: 36px; height: 36px; min-width: 36px; border-radius: 8px; background: ${isMe ? '#000000' : '#ffffff'}; color: ${isMe ? '#ffffff' : '#000000'}; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800;">
                  ${msg.attachment.docIcon || (/\.pdf$/i.test(msg.attachment.name || '') ? '📕' : (/\.(doc|docx)$/i.test(msg.attachment.name || '') ? '📝' : (/\.(xls|xlsx|csv)$/i.test(msg.attachment.name || '') ? '📊' : '📄')))}
                </div>
                <div style="overflow: hidden;">
                  <div style="font-size: 12px; font-weight: 700; color: ${isMe ? '#000' : '#fff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${this.escapeHtml(msg.attachment.name || 'Document')}">
                    ${this.escapeHtml(msg.attachment.name || 'Document')}
                  </div>
                  <div style="font-size: 10px; color: ${isMe ? 'rgba(0,0,0,0.6)' : 'var(--text-dim)'}; margin-top: 2px;">
                    ${this.escapeHtml(msg.attachment.docType || (/\.pdf$/i.test(msg.attachment.name || '') ? 'PDF Document' : (/\.(doc|docx)$/i.test(msg.attachment.name || '') ? 'Word Document' : 'Document')))}
                  </div>
                </div>
              </div>
              <a href="${msg.attachment.dataUrl}" download="${this.escapeHtml(msg.attachment.name || 'document')}" target="_blank" rel="noopener noreferrer" style="padding: 6px 12px; background: ${isMe ? '#000000' : '#ffffff'}; color: ${isMe ? '#ffffff' : '#000000'}; border-radius: 8px; text-decoration: none; font-size: 11px; font-weight: 700; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);" title="Download or view document">
                <span>⬇️ Open</span>
              </a>
            </div>
          ` : ''}

          <!-- Footer with Timestamp, Edited Tag & Read Receipt Checkmarks -->
          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 4px; font-size: 10px; color: ${isMe ? 'rgba(0,0,0,0.6)' : 'var(--text-dim)'};">
            ${msg.isEdited ? '<span class="chat-edited-tag" title="Edited message">(edited)</span>' : ''}
            <span>${timeFormatted}</span>
            ${isMe ? this.renderReadReceiptHtml(msg) : ''}
          </div>
        </div>

        <!-- Reactions Row -->
        ${this.renderReactionsHtml(msg, myIdentity.uid)}
      `;
    }

    // Reaction pill clicks
    div.querySelectorAll('.chat-reaction-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const emoji = btn.getAttribute('data-emoji');
        const msgId = btn.getAttribute('data-msg-id') || msg.id;
        this.toggleReaction(msgId, emoji);
      });
    });

    // Reaction dock trigger
    const reactTrigger = div.querySelector('.btn-trigger-react');
    const reactionDock = div.querySelector('.chat-reaction-dock');
    if (reactTrigger && reactionDock) {
      reactTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.chat-reaction-dock.active').forEach(d => {
          if (d !== reactionDock) d.classList.remove('active');
        });
        reactionDock.classList.toggle('active');
      });

      reactionDock.querySelectorAll('.reaction-emoji-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const emoji = btn.getAttribute('data-emoji');
          this.toggleReaction(msg.id, emoji);
          reactionDock.classList.remove('active');
        });
      });
    }

    // Reply trigger
    const replyTrigger = div.querySelector('.btn-trigger-reply');
    if (replyTrigger) {
      replyTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setReplyTarget(msg);
      });
    }

    // ✏️ Edit Message trigger
    const editBtn = div.querySelector('.btn-edit-chat-msg');
    if (editBtn && msg.id) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditMessageModal(msg.id, msg.text || '');
      });
    }

    // 📊 Poll Option Vote click handlers
    div.querySelectorAll('.poll-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const optIdx = parseInt(btn.getAttribute('data-opt-idx'), 10);
        this.votePoll(msg.id, optIdx);
      });
    });

    // Interactive custom audio player controls
    const playBtn = div.querySelector('.btn-play-pause-audio');
    if (playBtn && msg.attachment && msg.attachment.type === 'audio') {
      const audioSrc = this.resolveAudioSrc(msg.attachment.dataUrl);
      const progressBar = div.querySelector('.chat-audio-progress-bar');
      const progressFill = div.querySelector('.chat-audio-progress-fill');
      const currentTimeEl = div.querySelector('.chat-audio-current-time');
      const durationEl = div.querySelector('.chat-audio-duration');

      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = audioSrc;

      const updateDuration = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          const mins = Math.floor(audio.duration / 60);
          const secs = Math.floor(audio.duration % 60).toString().padStart(2, '0');
          if (durationEl) durationEl.innerText = `${mins}:${secs}`;
        }
      };

      audio.addEventListener('loadedmetadata', updateDuration);
      audio.addEventListener('durationchange', updateDuration);

      audio.addEventListener('timeupdate', () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          const pct = (audio.currentTime / audio.duration) * 100;
          if (progressFill) progressFill.style.width = `${pct}%`;
          const mins = Math.floor(audio.currentTime / 60);
          const secs = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
          if (currentTimeEl) currentTimeEl.innerText = `${mins}:${secs}`;
          updateDuration();
        } else {
          const mins = Math.floor(audio.currentTime / 60);
          const secs = Math.floor(audio.currentTime % 60).toString().padStart(2, '0');
          if (currentTimeEl) currentTimeEl.innerText = `${mins}:${secs}`;
        }
      });

      audio.addEventListener('ended', () => {
        playBtn.innerText = '▶';
        if (progressFill) progressFill.style.width = '0%';
        if (currentTimeEl) currentTimeEl.innerText = '0:00';
      });

      audio.addEventListener('error', (e) => {
        console.warn('Audio element error with blob URL, falling back:', e);
        if (msg.attachment.dataUrl && audio.src !== msg.attachment.dataUrl) {
          audio.src = msg.attachment.dataUrl;
        }
      });

      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentActiveAudio && this.currentActiveAudio !== audio) {
          this.currentActiveAudio.pause();
          if (this.currentActiveAudioBtn) this.currentActiveAudioBtn.innerText = '▶';
        }

        if (audio.paused) {
          audio.play().then(() => {
            playBtn.innerText = '⏸';
            this.currentActiveAudio = audio;
            this.currentActiveAudioBtn = playBtn;
          }).catch(err => {
            console.warn('First play attempt failed, trying raw dataUrl:', err);
            if (msg.attachment.dataUrl && audio.src !== msg.attachment.dataUrl) {
              audio.src = msg.attachment.dataUrl;
              audio.play().then(() => {
                playBtn.innerText = '⏸';
                this.currentActiveAudio = audio;
                this.currentActiveAudioBtn = playBtn;
              }).catch(e2 => {
                playBtn.innerText = '▶';
                alert(`⚠️ Audio Playback Error: ${e2.message}`);
              });
            } else {
              playBtn.innerText = '▶';
              alert(`⚠️ Audio Playback Error: ${err.message}`);
            }
          });
        } else {
          audio.pause();
          playBtn.innerText = '▶';
        }
      });

      if (progressBar) {
        progressBar.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = progressBar.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const width = rect.width;
          if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
            audio.currentTime = (clickX / width) * audio.duration;
          }
        });
      }
    }

    // 🗑️ Delete (Unsend for Everyone)
    const delBtn = div.querySelector('.btn-delete-chat-msg');
    if (delBtn && msg.id) {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        this.deleteMessageForEveryone(msg.id);
      });
    }

    // 📌 Pin Button (admin only)
    const pinBtn = div.querySelector('.btn-pin-chat-msg');
    if (pinBtn && canPin && msg.id) {
      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const previewText = msg.text
          ? msg.text.slice(0, 120)
          : msg.attachment
            ? `[${msg.attachment.type}: ${msg.attachment.name || ''}]`
            : '(message)';
        this.pinMessage(msg.id, previewText, msg.senderName || 'Unknown');
      });
    }

    return div;
  }

  // --- 📊 Interactive Poll Rendering & Voting ---
  renderPollHtml(msg, myUid) {
    if (!msg.poll || !Array.isArray(msg.poll.options)) return '';
    const poll = msg.poll;
    const totalVotes = poll.options.reduce((sum, opt) => sum + (Array.isArray(opt.votes) ? opt.votes.length : 0), 0);

    const optionsHtml = poll.options.map((opt, idx) => {
      const votes = Array.isArray(opt.votes) ? opt.votes : [];
      const count = votes.length;
      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      const hasVoted = votes.includes(myUid);

      return `
        <button type="button" class="poll-option-btn ${hasVoted ? 'voted-by-me' : ''}" data-msg-id="${msg.id}" data-opt-idx="${idx}">
          <div class="poll-bar-fill" style="width: ${pct}%;"></div>
          <div class="poll-option-text">
            <span>${hasVoted ? '✓' : '○'}</span>
            <span>${this.escapeHtml(opt.text)}</span>
          </div>
          <div class="poll-option-stats">
            <span>${pct}%</span> (${count})
          </div>
        </button>
      `;
    }).join('');

    return `
      <div class="chat-poll-card">
        <div class="poll-question">
          <span>📊</span>
          <span>${this.escapeHtml(poll.question)}</span>
        </div>
        <div>
          ${optionsHtml}
        </div>
        <div style="font-size: 10px; opacity: 0.7; margin-top: 6px; text-align: right;">
          ${totalVotes} total vote${totalVotes === 1 ? '' : 's'}
        </div>
      </div>
    `;
  }

  initPollHandlers() {
    const addOptBtn = document.getElementById('btn-add-poll-option');
    const form = document.getElementById('form-create-poll');

    if (addOptBtn) {
      addOptBtn.addEventListener('click', () => this.addPollOptionInput());
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitCreatePoll();
      });
    }

    document.querySelectorAll('[data-close="modal-create-poll"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeCreatePollModal());
    });

    if (this.createPollModal) {
      this.createPollModal.addEventListener('click', (e) => {
        if (e.target === this.createPollModal) this.closeCreatePollModal();
      });
    }
  }

  openCreatePollModal() {
    if (this.createPollModal) this.createPollModal.classList.add('active');
    const qInput = document.getElementById('poll-question-input');
    if (qInput) setTimeout(() => qInput.focus(), 60);
  }

  closeCreatePollModal() {
    if (this.createPollModal) {
      this.createPollModal.classList.remove('active');
      const form = document.getElementById('form-create-poll');
      if (form) form.reset();
      const list = document.getElementById('poll-options-inputs-list');
      if (list) {
        list.innerHTML = `
          <input type="text" class="form-control poll-opt-input" required placeholder="Option 1 (e.g. Python)">
          <input type="text" class="form-control poll-opt-input" required placeholder="Option 2 (e.g. TypeScript)">
        `;
      }
    }
  }

  addPollOptionInput() {
    const list = document.getElementById('poll-options-inputs-list');
    if (!list) return;
    const currentCount = list.querySelectorAll('.poll-opt-input').length;
    if (currentCount >= 5) {
      alert('Maximum 5 options allowed per poll.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control poll-opt-input';
    input.required = true;
    input.placeholder = `Option ${currentCount + 1}`;
    list.appendChild(input);
  }

  async submitCreatePoll() {
    const qInput = document.getElementById('poll-question-input');
    const question = qInput ? qInput.value.trim() : '';
    if (!question) return;

    const optInputs = document.querySelectorAll('.poll-opt-input');
    const options = [];
    optInputs.forEach((inp) => {
      const val = inp.value.trim();
      if (val) {
        options.push({ text: val, votes: [] });
      }
    });

    if (options.length < 2) {
      alert('Please provide at least 2 options for the poll.');
      return;
    }

    const sender = this.getSenderIdentity();
    const isIncognito = Boolean(sender.isIncognito);

    const pollMsg = {
      text: '',
      attachment: null,
      poll: {
        question: question,
        options: options,
        createdBy: sender.uid
      },
      senderId: String(sender.uid || 'anon'),
      senderName: String(sender.name || 'Anonymous'),
      senderPhotoURL: String(sender.photoURL || ''),
      senderEmail: isIncognito ? '' : String(sender.email || ''),
      isAnonymous: isIncognito ? true : Boolean(sender.isAnon),
      hideAdminBadge: isIncognito,
      readBy: [String(sender.uid || 'anon')],
      localTimestamp: Date.now(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .collection('messages')
        .add(pollMsg);

      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .set({
          lastMessage: `📊 Poll: ${question}`,
          lastMessageSender: sender.name,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      this.closeCreatePollModal();
      this.scrollChatToBottom();
    } catch (err) {
      console.error('Create poll error:', err);
      alert('Failed to post poll: ' + err.message);
    }
  }

  async votePoll(msgId, optionIndex) {
    if (!msgId || optionIndex === undefined || !this.activeRoomId || !window.fbDb) return;
    const myUid = this.getSenderIdentity().uid;
    const msgRef = window.fbDb
      .collection('chat_rooms')
      .doc(this.activeRoomId)
      .collection('messages')
      .doc(msgId);

    try {
      const snap = await msgRef.get();
      if (!snap.exists) return;
      const data = snap.data() || {};
      if (!data.poll || !Array.isArray(data.poll.options)) return;

      const poll = { ...data.poll };
      const options = poll.options.map((opt, idx) => {
        let votes = Array.isArray(opt.votes) ? [...opt.votes] : [];
        if (idx === optionIndex) {
          if (votes.includes(myUid)) {
            votes = votes.filter(u => u !== myUid); // toggle off
          } else {
            votes.push(myUid);
          }
        } else {
          // Single vote mode: remove from other options
          votes = votes.filter(u => u !== myUid);
        }
        return { ...opt, votes };
      });

      poll.options = options;
      await msgRef.update({ poll });
    } catch (err) {
      console.error('Vote poll error:', err);
    }
  }

  // --- ✏️ Edit Message Handlers ---
  initEditMessageHandlers() {
    const form = document.getElementById('form-edit-message');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveMessageEdit();
      });
    }

    document.querySelectorAll('[data-close="modal-edit-message"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeEditMessageModal());
    });

    if (this.editMessageModal) {
      this.editMessageModal.addEventListener('click', (e) => {
        if (e.target === this.editMessageModal) this.closeEditMessageModal();
      });
    }
  }

  openEditMessageModal(msgId, currentText) {
    const idInput = document.getElementById('edit-message-id');
    const textInput = document.getElementById('edit-message-text-input');
    if (idInput) idInput.value = msgId;
    if (textInput) textInput.value = currentText;

    if (this.editMessageModal) this.editMessageModal.classList.add('active');
    if (textInput) setTimeout(() => textInput.focus(), 60);
  }

  closeEditMessageModal() {
    if (this.editMessageModal) this.editMessageModal.classList.remove('active');
  }

  async saveMessageEdit() {
    const idInput = document.getElementById('edit-message-id');
    const textInput = document.getElementById('edit-message-text-input');
    const msgId = idInput ? idInput.value : '';
    const newText = textInput ? textInput.value.trim() : '';

    if (!msgId || !newText || !this.activeRoomId || !window.fbDb) return;

    try {
      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .collection('messages')
        .doc(msgId)
        .update({
          text: newText,
          isEdited: true,
          editedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      this.closeEditMessageModal();
    } catch (err) {
      console.error('Save message edit error:', err);
      alert('Could not edit message: ' + err.message);
    }
  }

  // --- 🗑️ Unsend / Delete for Everyone ---
  async deleteMessageForEveryone(msgId) {
    if (!msgId || !this.activeRoomId || !window.fbDb) return;
    const confirmed = confirm('🗑️ Unsend Message for Everyone?\n\nThis will remove the message contents for everyone in this chat.');
    if (!confirmed) return;

    try {
      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .collection('messages')
        .doc(msgId)
        .update({
          deletedForEveryone: true,
          text: '🚫 This message was deleted',
          attachment: firebase.firestore.FieldValue.delete(),
          poll: firebase.firestore.FieldValue.delete(),
          reactions: firebase.firestore.FieldValue.delete()
        });
    } catch (err) {
      console.error('Unsend message error:', err);
      alert('Could not unsend message: ' + err.message);
    }
  }

  // --- 👥 Friend Requests & Member Discovery System ---
  initFriendRequests() {
    const triggerBtn = document.getElementById('btn-open-friend-requests-modal');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => this.openFriendRequestsModal());
    }

    const tabDiscover = document.getElementById('tab-friends-discover');
    const tabPending = document.getElementById('tab-friends-pending');
    const tabAll = document.getElementById('tab-friends-all');
    const viewDiscover = document.getElementById('view-friends-discover');
    const viewPending = document.getElementById('view-friends-pending');
    const viewAll = document.getElementById('view-friends-all');

    const switchTab = (activeTab, activeView) => {
      [tabDiscover, tabPending, tabAll].forEach(t => {
        if (t) {
          t.style.background = (t === activeTab) ? 'rgba(255,255,255,0.14)' : 'transparent';
          t.style.color = (t === activeTab) ? '#fff' : 'var(--text-muted)';
        }
      });
      [viewDiscover, viewPending, viewAll].forEach(v => {
        if (v) v.style.display = (v === activeView) ? 'block' : 'none';
      });
    };

    if (tabDiscover) {
      tabDiscover.addEventListener('click', () => {
        switchTab(tabDiscover, viewDiscover);
        this.renderDiscoverUsersList();
      });
    }

    if (tabPending) {
      tabPending.addEventListener('click', () => {
        switchTab(tabPending, viewPending);
        this.renderFriendRequestsUI();
      });
    }

    if (tabAll) {
      tabAll.addEventListener('click', () => {
        switchTab(tabAll, viewAll);
        this.renderConfirmedFriendsList();
      });
    }

    // Live search filter in Discover tab
    const filterInput = document.getElementById('discover-users-filter-input');
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        this.renderDiscoverUsersList(e.target.value.trim().toLowerCase());
      });
    }

    document.querySelectorAll('[data-close="modal-friend-requests"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeFriendRequestsModal());
    });

    if (this.friendsModal) {
      this.friendsModal.addEventListener('click', (e) => {
        if (e.target === this.friendsModal) this.closeFriendRequestsModal();
      });
    }
  }

  openFriendRequestsModal() {
    if (this.friendsModal) this.friendsModal.classList.add('active');
    this.renderDiscoverUsersList();
    this.renderFriendRequestsUI();
    this.renderConfirmedFriendsList();
  }

  closeFriendRequestsModal() {
    if (this.friendsModal) this.friendsModal.classList.remove('active');
  }

  startBlockedUsersListener() {
    if (!window.fbDb) return;
    if (this.unsubscribeBlockedUsers) this.unsubscribeBlockedUsers();

    const myId = this.getSenderIdentity();

    this.unsubscribeBlockedUsers = window.fbDb
      .collection('blocked_users')
      .onSnapshot((snap) => {
        this.blockedUsersList = [];
        snap.forEach((doc) => {
          this.blockedUsersList.push({ id: doc.id, ...doc.data() });
        });
        this.renderConfirmedFriendsList();
        this.renderDiscoverUsersList();
      }, err => console.warn('Blocked users listen error:', err));
  }

  isUserBlocked(targetUid) {
    const myUid = this.getSenderIdentity().uid;
    return this.blockedUsersList.some(b => b.blockerUid === myUid && b.blockedUid === targetUid);
  }

  hasUserBlockedMe(targetUid) {
    const myUid = this.getSenderIdentity().uid;
    return this.blockedUsersList.some(b => b.blockerUid === targetUid && b.blockedUid === myUid);
  }

  async blockUser(targetUser) {
    if (!targetUser || !window.fbDb) return;
    const targetUid = targetUser.id || targetUser.uid;
    const myId = this.getSenderIdentity();
    
    if (targetUid === myId.uid) {
      alert("You cannot block yourself.");
      return;
    }

    const targetEmail = (targetUser.email || '').toLowerCase();
    if (targetEmail === window.ADMIN_EMAIL.toLowerCase()) {
      alert("System Administrator cannot be blocked.");
      return;
    }

    const confirmed = confirm(`🚫 Block ${targetUser.displayName || targetUser.name || 'this user'}?\n\nThey will not be able to send you friend requests or DMs.`);
    if (!confirmed) return;

    try {
      await window.fbDb.collection('blocked_users').add({
        blockerUid: myId.uid,
        blockerEmail: (myId.email || '').toLowerCase(),
        blockedUid: targetUid,
        blockedEmail: targetEmail,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Remove any friend requests between the users
      const relatedReqs = this.friendRequestsList.filter(r => 
        (r.fromUid === myId.uid && r.toUid === targetUid) ||
        (r.fromUid === targetUid && r.toUid === myId.uid) ||
        (r.fromEmail && r.fromEmail.toLowerCase() === targetEmail && r.toUid === myId.uid) ||
        (r.toEmail && r.toEmail.toLowerCase() === targetEmail && r.fromUid === myId.uid)
      );
      for (const req of relatedReqs) {
        await window.fbDb.collection('friend_requests').doc(req.id).delete();
      }

      alert(`✓ User blocked.`);
      this.renderDiscoverUsersList();
      this.renderConfirmedFriendsList();
    } catch (err) {
      console.error('Block user error:', err);
      alert('Could not block user: ' + err.message);
    }
  }

  async unblockUser(targetUid) {
    if (!targetUid || !window.fbDb) return;
    const myUid = this.getSenderIdentity().uid;

    const blockDoc = this.blockedUsersList.find(b => b.blockerUid === myUid && b.blockedUid === targetUid);
    if (!blockDoc) return;

    try {
      await window.fbDb.collection('blocked_users').doc(blockDoc.id).delete();
      alert('✓ User unblocked.');
      this.renderDiscoverUsersList();
      this.renderConfirmedFriendsList();
    } catch (err) {
      console.error('Unblock user error:', err);
      alert('Could not unblock user: ' + err.message);
    }
  }

  async removeFriend(friendUser) {
    if (!friendUser || !window.fbDb) return;
    const targetUid = friendUser.id || friendUser.uid;
    const targetEmail = (friendUser.email || '').toLowerCase();
    const myId = this.getSenderIdentity();

    const confirmed = confirm(`❌ Remove ${friendUser.displayName || friendUser.name || 'friend'} from your friends list?`);
    if (!confirmed) return;

    try {
      const reqDoc = this.friendRequestsList.find(r => 
        r.status === 'accepted' && (
          (r.fromUid === myId.uid && (r.toUid === targetUid || (targetEmail && r.toEmail === targetEmail))) ||
          (r.toUid === myId.uid && (r.fromUid === targetUid || (targetEmail && r.fromEmail === targetEmail))) ||
          (myId.email && r.fromEmail && r.fromEmail.toLowerCase() === myId.email.toLowerCase() && r.toUid === targetUid) ||
          (myId.email && r.toEmail && r.toEmail.toLowerCase() === myId.email.toLowerCase() && r.fromUid === targetUid)
        )
      );

      if (reqDoc) {
        await window.fbDb.collection('friend_requests').doc(reqDoc.id).delete();
      }
      alert('✓ Friend removed.');
      this.renderConfirmedFriendsList();
      this.renderDiscoverUsersList();
    } catch (err) {
      console.error('Remove friend error:', err);
      alert('Could not remove friend: ' + err.message);
    }
  }

  async renderDiscoverUsersList(filterQuery = '') {
    const container = document.getElementById('discover-users-list');
    if (!container || !window.fbDb) return;

    try {
      const snap = await window.fbDb.collection('users').get();
      const myId = this.getSenderIdentity();
      const myUid = myId.uid;
      const myEmail = (myId.email || '').toLowerCase();

      // Find my sent pending requests
      const mySentReqs = this.friendRequestsList.filter(r => r.fromUid === myUid && r.status === 'pending');
      // Find my received pending requests
      const myRecvReqs = this.friendRequestsList.filter(r => 
        r.status === 'pending' &&
        (r.toUid === myUid || (myEmail && r.toEmail && r.toEmail.toLowerCase() === myEmail))
      );
      // Find accepted friendships
      const acceptedReqs = this.friendRequestsList.filter(r => r.status === 'accepted');

      const allUsers = [];
      snap.forEach(doc => {
        const u = { id: doc.id, ...doc.data() };
        if (u.id !== myUid && (!myEmail || (u.email || '').toLowerCase() !== myEmail)) {
          allUsers.push(u);
        }
      });

      // Apply client-side search filter
      const filteredUsers = filterQuery
        ? allUsers.filter(u => {
            const name = (u.displayName || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            return name.includes(filterQuery) || email.includes(filterQuery);
          })
        : allUsers;

      if (filteredUsers.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 24px 0; color: var(--text-muted);">
            <div style="font-size: 28px; margin-bottom: 6px;">🔍</div>
            <p style="font-size: 13px; color: #fff;">${filterQuery ? 'No matching members found' : 'No other registered members yet'}</p>
          </div>
        `;
        return;
      }

      container.innerHTML = '';
      filteredUsers.forEach(u => {
        const name = this.getCleanDisplayName(u.displayName || (u.email ? u.email.split('@')[0] : 'Member'));
        const uEmail = (u.email || '').toLowerCase();
        const uUid = u.id || u.uid;
        
        // Check if I blocked them
        const isBlocked = this.isUserBlocked(uUid);
        
        // Check if accepted friend
        const isFriend = acceptedReqs.some(r => 
          (r.fromUid === myUid && (r.toUid === uUid || r.toEmail === uEmail)) ||
          (r.toUid === myUid && (r.fromUid === uUid || r.fromEmail === uEmail)) ||
          (myEmail && r.fromEmail === myEmail && (r.toUid === uUid || r.toEmail === uEmail)) ||
          (myEmail && r.toEmail === myEmail && (r.fromUid === uUid || r.fromEmail === uEmail))
        );
        
        // Check if request sent
        const isSent = mySentReqs.some(r => r.toUid === uUid || (uEmail && r.toEmail && r.toEmail.toLowerCase() === uEmail));
        
        // Check if request incoming
        const incomingReq = myRecvReqs.find(r => r.fromUid === uUid || (r.fromEmail && r.fromEmail.toLowerCase() === uEmail));

        const item = document.createElement('div');
        item.className = 'glass-card';
        item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; margin-bottom: 8px; border-radius: 10px; border: 1px solid var(--border-subtle);';

        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; min-width: 36px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; overflow: hidden;">
              ${u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;">` : name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
                <span>${this.escapeHtml(name)}</span>
                ${u.role === 'admin' ? '<span class="badge badge-project" style="font-size: 8px; padding: 1px 4px;">ADMIN</span>' : ''}
              </div>
              <div style="font-size: 11px; color: var(--text-dim);">${this.escapeHtml(u.email || 'Apex Member')}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${isBlocked ? `
              <button type="button" class="btn-ghost btn-unblock-user" style="padding: 5px 10px; font-size: 11px; color: #f87171; border: 1px solid rgba(248,113,113,0.3); border-radius: 6px;">🚫 Blocked (Unblock)</button>
            ` : isFriend ? `
              <button type="button" class="btn-primary btn-dm-friend-direct" style="width: auto; padding: 5px 12px; font-size: 11px; border-radius: 6px;">💬 Chat</button>
              <button type="button" class="btn-ghost btn-remove-friend-action" title="Remove Friend" style="padding: 5px 8px; font-size: 11px; color: var(--text-muted); border-radius: 6px;">✕</button>
            ` : isSent ? `
              <span class="badge badge-personal" style="padding: 5px 10px; font-size: 11px;">⏳ Sent</span>
              <button type="button" class="btn-ghost btn-block-user-action" title="Block User" style="padding: 5px 8px; font-size: 11px; color: #ef4444; border-radius: 6px;">🚫</button>
            ` : incomingReq ? `
              <button type="button" class="btn-primary btn-accept-direct" style="width: auto; padding: 5px 12px; font-size: 11px; border-radius: 6px;">✓ Accept</button>
            ` : `
              <button type="button" class="btn-primary btn-add-friend-action" style="width: auto; padding: 5px 12px; font-size: 11px; border-radius: 6px;">➕ Add Friend</button>
              <button type="button" class="btn-ghost btn-block-user-action" title="Block User" style="padding: 5px 8px; font-size: 11px; color: #ef4444; border-radius: 6px;">🚫</button>
            `}
          </div>
        `;

        const unblockBtn = item.querySelector('.btn-unblock-user');
        if (unblockBtn) {
          unblockBtn.addEventListener('click', () => this.unblockUser(uUid));
        }

        const dmBtn = item.querySelector('.btn-dm-friend-direct');
        if (dmBtn) {
          dmBtn.addEventListener('click', () => {
            this.startDirectChatWithFriend(u);
            this.closeFriendRequestsModal();
          });
        }

        const rmBtn = item.querySelector('.btn-remove-friend-action');
        if (rmBtn) {
          rmBtn.addEventListener('click', () => this.removeFriend(u));
        }

        const acceptBtn = item.querySelector('.btn-accept-direct');
        if (acceptBtn && incomingReq) {
          acceptBtn.addEventListener('click', () => this.acceptFriendRequest(incomingReq));
        }

        const addBtn = item.querySelector('.btn-add-friend-action');
        if (addBtn) {
          addBtn.addEventListener('click', async () => {
            addBtn.disabled = true;
            addBtn.innerText = '⌛ Sending...';
            await this.sendFriendRequestToUser(u);
            this.renderDiscoverUsersList(filterQuery);
          });
        }

        const blockBtn = item.querySelector('.btn-block-user-action');
        if (blockBtn) {
          blockBtn.addEventListener('click', () => this.blockUser(u));
        }

        container.appendChild(item);
      });
    } catch (err) {
      console.error('Error rendering discover users:', err);
      container.innerHTML = '<p style="color: #ff4d4d; text-align: center; padding: 10px;">Could not load members.</p>';
    }
  }

  async sendFriendRequestToUser(targetUser) {
    if (!targetUser || !window.fbDb) return;
    const sender = this.getSenderIdentity();
    const targetUid = targetUser.id || targetUser.uid;

    if (this.isUserBlocked(targetUid) || this.hasUserBlockedMe(targetUid)) {
      alert("Cannot send friend request to this user.");
      return;
    }

    const alertEl = document.getElementById('discover-users-alert');

    try {
      await window.fbDb.collection('friend_requests').add({
        fromUid: sender.uid,
        fromName: sender.name,
        fromEmail: (sender.email || '').toLowerCase(),
        fromPhoto: sender.photoURL || '',
        toUid: targetUid,
        toEmail: (targetUser.email || '').toLowerCase(),
        toHandle: targetUser.displayName || targetUser.name || '',
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (alertEl) {
        alertEl.style.display = 'block';
        alertEl.style.background = 'rgba(52, 199, 89, 0.15)';
        alertEl.style.color = '#34c759';
        alertEl.style.border = '1px solid rgba(52, 199, 89, 0.3)';
        alertEl.innerText = `✓ Friend request sent to ${targetUser.displayName || targetUser.email}!`;
        setTimeout(() => { if (alertEl) alertEl.style.display = 'none'; }, 4000);
      }
    } catch (err) {
      console.error('Send friend request error:', err);
      if (alertEl) {
        alertEl.style.display = 'block';
        alertEl.style.background = 'rgba(239, 68, 68, 0.15)';
        alertEl.style.color = '#ef4444';
        alertEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        alertEl.innerText = `Could not send request: ${err.message}`;
      }
    }
  }

  startFriendRequestsListener() {
    if (!window.fbDb) return;
    if (this.unsubscribeFriendRequests) this.unsubscribeFriendRequests();

    const myId = this.getSenderIdentity();
    const myEmail = (myId.email || '').toLowerCase();
    const myUid = myId.uid;

    this.unsubscribeFriendRequests = window.fbDb
      .collection('friend_requests')
      .onSnapshot((snap) => {
        this.friendRequestsList = [];
        snap.forEach((doc) => {
          this.friendRequestsList.push({ id: doc.id, ...doc.data() });
        });

        // Filter pending incoming requests directed to current user
        const incoming = this.friendRequestsList.filter(r => 
          r.status === 'pending' &&
          (r.toUid === myUid || (myEmail && r.toEmail && r.toEmail.toLowerCase() === myEmail)) &&
          !this.isUserBlocked(r.fromUid)
        );

        // Update badge count
        const badge = document.getElementById('friend-requests-badge');
        const tabBadge = document.getElementById('tab-pending-count-badge');
        const count = incoming.length;

        if (badge) {
          badge.innerText = count;
          badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        if (tabBadge) {
          tabBadge.innerText = count;
          tabBadge.style.display = count > 0 ? 'inline-block' : 'none';
        }

        this.renderFriendRequestsUI();
        this.renderConfirmedFriendsList();
      }, err => console.warn('Friend requests listen error:', err));
  }

  renderFriendRequestsUI() {
    const container = document.getElementById('friends-pending-list');
    if (!container) return;
    container.innerHTML = '';

    const myId = this.getSenderIdentity();
    const myEmail = (myId.email || '').toLowerCase();
    const myUid = myId.uid;

    const incoming = this.friendRequestsList.filter(r => 
      r.status === 'pending' &&
      (r.toUid === myUid || (myEmail && r.toEmail && r.toEmail.toLowerCase() === myEmail)) &&
      !this.isUserBlocked(r.fromUid)
    );

    if (incoming.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px 0; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 6px;">📩</div>
          <p style="font-size: 13px; color: #fff;">No pending friend requests</p>
          <p style="font-size: 11px; margin-top: 4px;">Discover new members in the "Discover Members" tab!</p>
        </div>
      `;
      return;
    }

    incoming.forEach((req) => {
      const item = document.createElement('div');
      item.className = 'friend-request-item';
      item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; margin-bottom: 8px; border-radius: 10px; border: 1px solid var(--border-subtle);';
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; overflow: hidden;">
            ${req.fromPhoto ? `<img src="${req.fromPhoto}" style="width:100%;height:100%;object-fit:cover;">` : (req.fromName || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #fff;">${this.escapeHtml(req.fromName || 'Friend')}</div>
            <div style="font-size: 10px; color: var(--text-dim);">${this.escapeHtml(req.fromEmail || 'Member')}</div>
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn-primary btn-accept-req" style="width: auto; padding: 5px 12px; font-size: 11px; border-radius: 8px;">✓ Accept</button>
          <button type="button" class="btn-ghost btn-decline-req" style="padding: 5px 10px; font-size: 11px; border-radius: 8px; color: var(--accent-red); border: 1px solid rgba(255,80,80,0.3);">✕</button>
        </div>
      `;

      item.querySelector('.btn-accept-req').addEventListener('click', () => this.acceptFriendRequest(req));
      item.querySelector('.btn-decline-req').addEventListener('click', () => this.declineFriendRequest(req.id));
      container.appendChild(item);
    });
  }

  async sendFriendRequest(target) {
    if (!target || !window.fbDb) return;
    const sender = this.getSenderIdentity();

    try {
      if (sender.email && target.toLowerCase() === sender.email.toLowerCase()) {
        alert('You cannot send a friend request to yourself.');
        return;
      }

      await window.fbDb.collection('friend_requests').add({
        fromUid: sender.uid,
        fromName: sender.name,
        fromEmail: (sender.email || '').toLowerCase(),
        fromPhoto: sender.photoURL || '',
        toEmail: target.toLowerCase(),
        toHandle: target,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert(`✓ Friend request sent to "${target}"!`);
    } catch (err) {
      console.error('Send friend request error:', err);
      alert('Could not send request: ' + err.message);
    }
  }

  async acceptFriendRequest(req) {
    if (!req || !req.id || !window.fbDb) return;

    try {
      // Mark request accepted (adds friend to Friends list; does NOT auto-open DM)
      await window.fbDb.collection('friend_requests').doc(req.id).update({
        status: 'accepted',
        acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert(`✓ Friend request accepted! ${req.fromName || 'User'} is now in your Friends list. You can chat or block them anytime from the "My Friends" tab.`);
      this.renderFriendRequestsUI();
      this.renderConfirmedFriendsList();
      this.renderDiscoverUsersList();
    } catch (err) {
      console.error('Accept friend request error:', err);
      alert('Could not accept friend request: ' + err.message);
    }
  }

  async declineFriendRequest(reqId) {
    if (!reqId || !window.fbDb) return;
    try {
      await window.fbDb.collection('friend_requests').doc(reqId).delete();
    } catch (err) {
      console.error('Decline friend request error:', err);
    }
  }

  renderConfirmedFriendsList() {
    const container = document.getElementById('friends-all-list');
    if (!container) return;
    container.innerHTML = '';

    const myId = this.getSenderIdentity();
    const myUid = myId.uid;
    const myEmail = (myId.email || '').toLowerCase();

    // Get accepted friend requests involving current user
    const accepted = (this.friendRequestsList || []).filter(r => 
      r.status === 'accepted' && (
        r.fromUid === myUid || 
        r.toUid === myUid || 
        (myEmail && r.fromEmail && r.fromEmail.toLowerCase() === myEmail) ||
        (myEmail && r.toEmail && r.toEmail.toLowerCase() === myEmail)
      )
    );

    if (accepted.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px 0; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 6px;">👥</div>
          <p style="font-size: 13px; color: #fff;">No confirmed friends yet</p>
          <p style="font-size: 11px; margin-top: 4px;">Accept friend requests in the Requests tab or add friends in Discover Members.</p>
        </div>
      `;
      return;
    }

    accepted.forEach(req => {
      const isSender = req.fromUid === myUid || (myEmail && req.fromEmail && req.fromEmail.toLowerCase() === myEmail);
      const friendUid = isSender ? req.toUid : req.fromUid;
      const friendEmail = isSender ? req.toEmail : req.fromEmail;
      const friendNameRaw = isSender ? (req.toHandle || 'Friend') : (req.fromName || 'Friend');
      const friendPhoto = isSender ? '' : (req.fromPhoto || '');

      // Lookup in registered users list for photo/role if available
      const registeredFriend = (this.friendsList || []).find(u => u.id === friendUid || (friendEmail && (u.email || '').toLowerCase() === (friendEmail || '').toLowerCase()));
      const displayName = this.getCleanDisplayName(registeredFriend ? (registeredFriend.displayName || registeredFriend.name) : friendNameRaw);
      const photoURL = registeredFriend ? registeredFriend.photoURL : friendPhoto;
      const role = registeredFriend ? registeredFriend.role : 'member';

      const friendObj = registeredFriend || { uid: friendUid, id: friendUid, displayName: displayName, email: friendEmail, photoURL: photoURL };

      const item = document.createElement('div');
      item.className = 'glass-card';
      item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; margin-bottom: 8px; border-radius: 10px; border: 1px solid var(--border-subtle);';

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 34px; height: 34px; min-width: 34px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; overflow: hidden;">
            ${photoURL ? `<img src="${photoURL}" style="width:100%;height:100%;object-fit:cover;">` : displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>${this.escapeHtml(displayName)}</span>
              ${role === 'admin' ? '<span class="badge badge-project" style="font-size: 8px; padding: 1px 4px;">ADMIN</span>' : ''}
            </div>
            <div style="font-size: 10px; color: var(--text-dim);">${this.escapeHtml(friendEmail || 'Friend')}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button type="button" class="btn-primary btn-chat-friend" style="width: auto; padding: 5px 12px; font-size: 11px; border-radius: 6px;">💬 Chat</button>
          <button type="button" class="btn-ghost btn-block-friend" title="Block User" style="padding: 5px 8px; font-size: 11px; color: #f87171; border-radius: 6px;">🚫</button>
          <button type="button" class="btn-ghost btn-remove-friend" title="Remove Friend (Unfriend)" style="padding: 5px 8px; font-size: 11px; color: var(--text-muted); border-radius: 6px;">✕</button>
        </div>
      `;

      item.querySelector('.btn-chat-friend').addEventListener('click', () => {
        this.startDirectChatWithFriend(friendObj);
        this.closeFriendRequestsModal();
      });

      item.querySelector('.btn-block-friend').addEventListener('click', () => {
        this.blockUser(friendObj);
      });

      item.querySelector('.btn-remove-friend').addEventListener('click', () => {
        this.removeFriend(friendObj);
      });

      container.appendChild(item);
    });
  }

  // --- 💡 Direct Feedback & 🐞 Bug Reports System ---
  initFeedbackBugModal() {
    const triggerBtn = document.getElementById('btn-open-feedback-from-announcements');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => this.openFeedbackModal());
    }

    const form = document.getElementById('form-feedback-bug');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitFeedbackBug();
      });
    }

    document.querySelectorAll('[data-close="modal-feedback-bug"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeFeedbackModal());
    });

    if (this.feedbackModal) {
      this.feedbackModal.addEventListener('click', (e) => {
        if (e.target === this.feedbackModal) this.closeFeedbackModal();
      });
    }
  }

  openFeedbackModal() {
    if (this.feedbackModal) this.feedbackModal.classList.add('active');
    const titleInput = document.getElementById('feedback-title-input');
    if (titleInput) setTimeout(() => titleInput.focus(), 60);
  }

  closeFeedbackModal() {
    if (this.feedbackModal) {
      this.feedbackModal.classList.remove('active');
      const form = document.getElementById('form-feedback-bug');
      if (form) form.reset();
    }
  }

  async submitFeedbackBug() {
    const typeRadio = document.querySelector('input[name="feedback-type"]:checked');
    const type = typeRadio ? typeRadio.value : 'suggestion';
    const title = document.getElementById('feedback-title-input') ? document.getElementById('feedback-title-input').value.trim() : '';
    const desc = document.getElementById('feedback-desc-input') ? document.getElementById('feedback-desc-input').value.trim() : '';

    if (!title || !desc || !window.fbDb) return;

    const sender = this.getSenderIdentity();

    try {
      await window.fbDb.collection('feedback_reports').add({
        type: type, // 'suggestion' | 'bug'
        title: title,
        description: desc,
        senderId: sender.uid,
        senderName: sender.name,
        senderEmail: sender.email || '',
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert(`✅ Thank you, ${sender.name}!\n\nYour ${type === 'bug' ? 'bug report' : 'suggestion'} has been transmitted directly to the Administrator (${window.ADMIN_EMAIL}).`);
      this.closeFeedbackModal();
    } catch (err) {
      console.error('Submit feedback error:', err);
      alert('Could not submit report: ' + err.message);
    }
  }

  // 👁️ Read Receipts: Mark Active Room Messages as Read
  markActiveRoomMessagesAsRead(messages) {
    if (document.hidden || !window.fbDb || !this.activeRoomId || !Array.isArray(messages)) return;
    const myUid = this.getSenderIdentity().uid;
    const unreadDocs = messages.filter(m => m.id && (!m.readBy || !m.readBy.includes(myUid)));
    if (unreadDocs.length === 0) return;

    const batch = window.fbDb.batch();
    unreadDocs.slice(0, 400).forEach(m => {
      const ref = window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .collection('messages')
        .doc(m.id);
      batch.update(ref, {
        readBy: firebase.firestore.FieldValue.arrayUnion(myUid)
      });
    });

    batch.commit().catch(e => console.warn('Mark read batch error:', e));
  }

  // 🟢 Presence System: Online / Last Seen
  startPresenceSystem() {
    if (!window.fbDb) return;
    
    this.updatePresence(true);

    if (this.presenceHeartbeatInterval) clearInterval(this.presenceHeartbeatInterval);
    this.presenceHeartbeatInterval = setInterval(() => {
      if (!document.hidden) {
        this.updatePresence(true);
      }
    }, 30000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.updatePresence(true);
        if (this.activeRoomId && this._lastLoadedMessages) {
          this.markActiveRoomMessagesAsRead(this._lastLoadedMessages);
        }
      } else {
        this.updatePresence(false);
      }
    });

    window.addEventListener('focus', () => {
      this.updatePresence(true);
      if (this.activeRoomId && this._lastLoadedMessages) {
        this.markActiveRoomMessagesAsRead(this._lastLoadedMessages);
      }
    });

    window.addEventListener('blur', () => {
      this.updatePresence(false);
    });

    window.addEventListener('beforeunload', () => {
      this.updatePresence(false);
    });
  }

  updatePresence(isOnline) {
    if (!window.fbDb) return;
    const identity = this.getSenderIdentity();
    if (!identity.uid) return;

    try {
      window.fbDb.collection('presence').doc(identity.uid).set({
        uid: identity.uid,
        name: identity.name,
        isOnline: Boolean(isOnline),
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true }).catch(e => console.warn('Presence update error:', e));
    } catch (_) {}
  }

  listenToRoomPresence(room) {
    if (this.currentRoomPresenceUnsub) {
      this.currentRoomPresenceUnsub();
      this.currentRoomPresenceUnsub = null;
    }

    if (!this.activeChatStatus) return;

    if (!room || room.type !== 'direct' || !window.fbDb) {
      this.activeChatStatus.style.display = 'none';
      return;
    }

    const myUid = this.getSenderIdentity().uid;
    const otherUid = (room.members || []).find(uid => uid && uid !== myUid);
    if (!otherUid) {
      this.activeChatStatus.style.display = 'none';
      return;
    }

    this.currentRoomPresenceUnsub = window.fbDb
      .collection('presence')
      .doc(otherUid)
      .onSnapshot((snap) => {
        if (!snap.exists) {
          this.activeChatStatus.style.display = 'none';
          return;
        }
        const data = snap.data() || {};
        const now = Date.now();
        const lastSeenMs = data.lastSeen && data.lastSeen.toMillis ? data.lastSeen.toMillis() : 0;
        const isRecent = (now - lastSeenMs) < 65000;

        if (data.isOnline && isRecent) {
          this.activeChatStatus.innerHTML = `<span style="color: #34c759; font-weight: 700;">🟢 Online</span>`;
          this.activeChatStatus.style.display = 'inline-flex';
        } else if (lastSeenMs > 0) {
          this.activeChatStatus.innerHTML = `<span style="color: var(--text-dim);">⚪ Last seen ${this.formatTimeAgo(new Date(lastSeenMs))}</span>`;
          this.activeChatStatus.style.display = 'inline-flex';
        } else {
          this.activeChatStatus.style.display = 'none';
        }
      }, e => console.warn('Presence listen error:', e));
  }

  formatTimeAgo(date) {
    if (!date) return 'recently';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // 🔔 Push & Sound Notifications
  toggleNotifications() {
    const isGranted = ('Notification' in window) && Notification.permission === 'granted';

    // If permission not yet requested, ask browser permission
    if (!isGranted && ('Notification' in window) && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          localStorage.setItem('apex_chat_notifications', 'true');
          this.updateNotificationsUI();
          this.playNotificationSound();
          try {
            new Notification('🔔 Apex Notifications Enabled', {
              body: 'You will receive sound and desktop alerts for new messages.',
              icon: 'assets/apex-logo.png'
            });
          } catch (_) {}
        } else {
          localStorage.setItem('apex_chat_notifications', 'false');
          this.updateNotificationsUI();
          alert('Notification permission was blocked in browser settings. You can click the Notifications button anytime to Mute/Unmute in-app audio.');
        }
      });
      return;
    }

    // Toggle mute/unmute state in localStorage
    const current = localStorage.getItem('apex_chat_notifications') !== 'false';
    const newState = !current;
    localStorage.setItem('apex_chat_notifications', newState ? 'true' : 'false');
    this.updateNotificationsUI();

    if (newState) {
      this.playNotificationSound();
    }
  }

  updateNotificationsUI() {
    const btn = document.getElementById('btn-chat-notifications');
    if (!btn) return;
    const isEnabled = localStorage.getItem('apex_chat_notifications') !== 'false';

    if (isEnabled) {
      btn.style.background = 'rgba(52, 199, 89, 0.15)';
      btn.style.borderColor = 'rgba(52, 199, 89, 0.45)';
      btn.style.color = '#34c759';
      btn.innerHTML = '🔔 Notifications: <strong>ON</strong>';
      btn.title = 'Sound & alerts active. Click to MUTE / Turn OFF';
    } else {
      btn.style.background = 'rgba(255, 255, 255, 0.05)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      btn.style.color = 'var(--text-muted)';
      btn.innerHTML = '🔕 Sound: <strong>MUTED</strong>';
      btn.title = 'Sound & alerts muted. Click to UNMUTE / Turn ON';
    }
  }

  playNotificationSound() {
    try {
      const isMuted = localStorage.getItem('apex_chat_notifications') === 'false';
      if (isMuted) return;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880, now + 0.1); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(587.33, now);
      osc2.frequency.setValueAtTime(880, now + 0.1);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);

      setTimeout(() => { try { ctx.close(); } catch (_) {} }, 500);
    } catch (_) {}
  }

  notifyNewMessage(msg) {
    if (!msg) return;
    const msgId = msg.id || (msg.localTimestamp ? String(msg.localTimestamp) : null);
    if (msgId) {
      if (this._lastNotifiedMsgId === msgId) return;
      this._lastNotifiedMsgId = msgId;
    }

    const myUid = this.getSenderIdentity().uid;
    if (msg.senderId === myUid) return;

    const isEnabled = localStorage.getItem('apex_chat_notifications') !== 'false';
    if (!isEnabled) return;

    this.playNotificationSound();

    const isGranted = ('Notification' in window) && Notification.permission === 'granted';
    if (isGranted && document.hidden) {
      const title = msg.senderName ? `${msg.senderName}` : 'New Message';
      const body = msg.text || (msg.attachment ? `[${msg.attachment.type}]` : 'Sent an attachment');
      try {
        const n = new Notification(title, {
          body: body,
          icon: 'assets/apex-logo.png',
          tag: msg.id || 'apex_chat_msg'
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch (_) {}
    }
  }

  async sendMessage() {
    const text = this.chatInput ? this.chatInput.value.trim() : '';
    const attachment = this.pendingAttachment;

    if (!text && !attachment) return;

    if (!this.activeRoomId) {
      this.activeRoomId = 'general_lounge';
    }

    const sender = this.getSenderIdentity();

    if (this.chatInput) this.chatInput.value = '';
    this.clearAttachment();

    let cleanAttachment = null;
    if (attachment && typeof attachment === 'object') {
      cleanAttachment = {
        name: String(attachment.name || 'Attachment'),
        type: String(attachment.type || 'file'),
        docType: String(attachment.docType || ''),
        docIcon: String(attachment.docIcon || ''),
        dataUrl: String(attachment.dataUrl || '')
      };
    }

    const isIncognito = Boolean(sender.isIncognito);

    const newMsg = {
      text: text || '',
      attachment: cleanAttachment,
      senderId: String(sender.uid || 'anon'),
      senderName: String(sender.name || 'Anonymous'),
      senderEmail: isIncognito ? '' : String(sender.email || ''),
      isAnonymous: isIncognito ? true : Boolean(sender.isAnon),
      hideAdminBadge: isIncognito,
      readBy: [String(sender.uid || 'anon')],
      localTimestamp: Date.now(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (this.replyingTo) {
      newMsg.replyTo = this.replyingTo;
      this.clearReply();
    }

    try {
      // 1. Add to messages subcollection
      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .collection('messages')
        .add(newMsg);

      // 2. Update room's lastMessage
      const previewText = attachment
        ? (attachment.type === 'audio' ? (cleanAttachment.name.startsWith('🎙️') ? cleanAttachment.name : '🎵 Audio Track') : (attachment.type === 'image' ? '🖼️ Photo' : `${cleanAttachment.docIcon || '📄'} ${cleanAttachment.name || 'Document'}`))
        : text;
      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .set({
          lastMessage: previewText.length > 50 ? previewText.substring(0, 50) + '...' : previewText,
          lastMessageSender: sender.name,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

      this.scrollChatToBottom();
      if (this.chatInput) this.chatInput.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Could not send message: ' + err.message);
    }
  }

  scrollChatToBottom() {
    if (this.chatMessagesContainer) {
      setTimeout(() => {
        this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
      }, 60);
    }
  }

  // --- Clear Chat / Delete Conversation History ---
  async clearCurrentChat() {
    if (!this.activeRoomId) return;
    if (!window.fbDb) {
      alert('Firebase connection not ready.');
      return;
    }

    const roomData = this.activeRoomData || {};
    const roomName = roomData.name || 'this conversation';

    const confirmed = confirm(`🧹 Clear Chat Confirmation\n\nAre you sure you want to delete all messages in "${roomName}"?\n\nThis will permanently delete the message history for this chat.`);
    if (!confirmed) return;

    try {
      if (this.chatMessagesContainer) {
        this.chatMessagesContainer.innerHTML = `
          <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
            <div style="font-size: 32px; margin-bottom: 10px;">⏳</div>
            <h4 style="font-size: 15px; font-weight: 600; color: #fff;">Clearing conversation...</h4>
          </div>
        `;
      }

      const messagesRef = window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .collection('messages');

      const snapshot = await messagesRef.get();
      
      if (!snapshot.empty) {
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = window.fbDb.batch();
          const chunk = docs.slice(i, i + 400);
          chunk.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      // Reset room's last message and unpin any active pinned message
      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .set({
          lastMessage: 'Chat history cleared',
          lastMessageSender: 'System',
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          pinnedMessage: firebase.firestore.FieldValue.delete()
        }, { merge: true });

      if (this.chatMessagesContainer) {
        this.chatMessagesContainer.innerHTML = `
          <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
            <div style="font-size: 36px; margin-bottom: 10px;">✨</div>
            <h4 style="font-size: 15px; font-weight: 600; color: #fff;">Chat Cleared</h4>
            <p style="font-size: 12px; margin-top: 6px;">All messages in this chat have been removed.</p>
          </div>
        `;
      }
    } catch (err) {
      console.error('Failed to clear chat:', err);
      alert('Could not clear chat: ' + err.message);
      if (this.activeRoomId) {
        this.startMessagesListener(this.activeRoomId);
      }
    }
  }

  // --- Group Creation & Personal DMs ---
  openCreateGroupModal() {
    if (this.createGroupModal) this.createGroupModal.classList.add('active');
  }

  closeCreateGroupModal() {
    if (this.createGroupModal) {
      this.createGroupModal.classList.remove('active');
      if (this.createGroupForm) this.createGroupForm.reset();
    }
  }

  async createGroup() {
    const nameInput = document.getElementById('group-name-input');
    const descInput = document.getElementById('group-desc-input');
    const iconInput = document.getElementById('group-icon-input');

    const name = nameInput.value.trim();
    if (!name) return;

    const sender = this.getSenderIdentity();

    const newRoom = {
      name: name,
      description: descInput ? descInput.value.trim() : '',
      icon: iconInput ? iconInput.value.trim() || '👥' : '👥',
      type: 'group',
      createdBy: sender.uid,
      createdByName: sender.name,
      members: ['all'],
      memberEmails: ['all'],
      lastMessage: 'Group created',
      lastMessageSender: sender.name,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      const docRef = await window.fbDb.collection('chat_rooms').add(newRoom);
      this.closeCreateGroupModal();
      newRoom.id = docRef.id;
      this.selectRoom(newRoom);
      this.showMobileChat();
    } catch (err) {
      console.error('Failed to create group:', err);
      alert('Failed to create group: ' + err.message);
    }
  }

  openStartDmModal() {
    const searchInput = document.getElementById('dm-friend-search-input');
    if (searchInput) {
      searchInput.value = '';
    }
    this.renderDmFriendsPicker('');
    if (this.startDmModal) this.startDmModal.classList.add('active');
    if (searchInput) setTimeout(() => searchInput.focus(), 80);
  }

  closeStartDmModal() {
    if (this.startDmModal) this.startDmModal.classList.remove('active');
  }

  async renderDmFriendsPicker(searchQuery = '') {
    const container = document.getElementById('dm-friends-picker-list');
    if (!container) return;

    const myId = this.getSenderIdentity();
    const myUid = myId.uid;
    const myEmail = (myId.email || '').toLowerCase();

    // Get list of accepted friends
    const acceptedReqs = (this.friendRequestsList || []).filter(r => 
      r.status === 'accepted' && (
        r.fromUid === myUid || 
        r.toUid === myUid || 
        (myEmail && r.fromEmail && r.fromEmail.toLowerCase() === myEmail) ||
        (myEmail && r.toEmail && r.toEmail.toLowerCase() === myEmail)
      )
    );

    const confirmedFriends = [];
    acceptedReqs.forEach(req => {
      const isSender = req.fromUid === myUid || (myEmail && req.fromEmail && req.fromEmail.toLowerCase() === myEmail);
      const friendUid = isSender ? req.toUid : req.fromUid;
      const friendEmail = isSender ? req.toEmail : req.fromEmail;
      const friendNameRaw = isSender ? (req.toHandle || 'Friend') : (req.fromName || 'Friend');

      if (this.isUserBlocked(friendUid) || this.hasUserBlockedMe(friendUid)) return;

      const registered = (this.friendsList || []).find(u => u.id === friendUid || (friendEmail && (u.email || '').toLowerCase() === (friendEmail || '').toLowerCase()));
      confirmedFriends.push(registered || {
        uid: friendUid,
        id: friendUid,
        displayName: friendNameRaw,
        email: friendEmail,
        photoURL: ''
      });
    });

    container.innerHTML = '';

    if (confirmedFriends.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px 0; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 6px;">👥</div>
          <p style="font-size: 13px; color: #fff;">No confirmed friends to DM yet.</p>
          <p style="font-size: 11px; margin-top: 4px;">Send or accept friend requests in the Friends modal to start chatting!</p>
        </div>
      `;
      return;
    }

    // Filter by search query (name / handle / email)
    const query = (searchQuery || '').toLowerCase().trim();
    const filtered = confirmedFriends.filter((friend) => {
      const name = (friend.displayName || (friend.email ? friend.email.split('@')[0] : 'friend')).toLowerCase();
      const email = (friend.email || '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px 0; color: var(--text-muted);">
          <div style="font-size: 24px; margin-bottom: 6px;">🔍</div>
          <p style="font-size: 13px; color: #fff;">No friends found matching "<strong>${this.escapeHtml(searchQuery)}</strong>"</p>
        </div>
      `;
      return;
    }

    filtered.forEach((friend) => {
      const rawName = friend.displayName || (friend.email ? friend.email.split('@')[0] : 'Friend');
      const friendName = this.getCleanDisplayName(rawName);
      const isFriendAdmin = friend.isAdmin || friend.role === 'admin' || (friend.email && friend.email.toLowerCase() === window.ADMIN_EMAIL.toLowerCase());

      const item = document.createElement('div');
      item.className = 'glass-card';
      item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 11px 14px; cursor: pointer; margin-bottom: 8px; border-radius: 10px; border: 1px solid var(--border-subtle); transition: all 0.2s ease;';
      
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 34px; height: 34px; min-width: 34px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0; overflow: hidden;">
            ${friend.photoURL ? `<img src="${friend.photoURL}" style="width:100%;height:100%;object-fit:cover;">` : friendName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>${this.escapeHtml(friendName)}</span>
              ${isFriendAdmin ? '<span class="badge badge-project" style="font-size: 8px; padding: 1px 5px; background: #fff; color: #000; font-weight: 800;">ADMIN</span>' : ''}
            </div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">
              ${isFriendAdmin ? '👑 Verified Admin' : '👤 Confirmed Friend'}
            </div>
          </div>
        </div>
        <button type="button" class="btn-primary" style="width: auto; padding: 6px 14px; font-size: 11px; border-radius: 6px;">Chat 💬</button>
      `;

      item.addEventListener('click', () => this.startDirectChatWithFriend(friend));
      container.appendChild(item);
    });
  }

  async startDirectChatWithFriend(friend) {
    const sender = this.getSenderIdentity();
    const friendUid = friend.id || friend.uid;
    const friendEmail = (friend.email || '').toLowerCase();

    // 1. Block Check
    if (this.isUserBlocked(friendUid)) {
      alert("You have blocked this user. Unblock them first to start a chat.");
      return;
    }
    if (this.hasUserBlockedMe(friendUid)) {
      alert("Unable to start chat with this user.");
      return;
    }

    // 2. Strict Friendship Check (Must be an accepted friend)
    const isAcceptedFriend = (this.friendRequestsList || []).some(r => 
      r.status === 'accepted' && (
        (r.fromUid === sender.uid && (r.toUid === friendUid || (friendEmail && r.toEmail === friendEmail))) ||
        (r.toUid === sender.uid && (r.fromUid === friendUid || (friendEmail && r.fromEmail === friendEmail))) ||
        (sender.email && r.fromEmail && r.fromEmail.toLowerCase() === sender.email.toLowerCase() && (r.toUid === friendUid || r.toEmail === friendEmail)) ||
        (sender.email && r.toEmail && r.toEmail.toLowerCase() === sender.email.toLowerCase() && (r.fromUid === friendUid || r.fromEmail === friendEmail))
      )
    );

    if (!isAcceptedFriend) {
      alert("🔒 Private messaging is restricted to accepted friends only. Send a friend request first!");
      return;
    }

    try {
      const existing = this.roomsList.find(r => 
        r.type === 'direct' && 
        r.members && 
        r.members.includes(sender.uid) && 
        (r.members.includes(friendUid) || (friendEmail && r.memberEmails && r.memberEmails.includes(friendEmail)))
      );

      if (existing) {
        this.closeStartDmModal();
        this.selectRoom(existing);
        this.showMobileChat();
        return;
      }

      const rawName = friend.displayName || (friend.email ? friend.email.split('@')[0] : 'Friend');
      const friendName = this.getCleanDisplayName(rawName);

      const dmRoom = {
        name: friendName,
        description: '🔒 Private 1-on-1 Direct Chat',
        type: 'direct',
        icon: friendName.charAt(0).toUpperCase(),
        createdBy: sender.uid,
        createdByName: sender.name,
        members: [sender.uid, friendUid],
        memberEmails: [(sender.email || '').toLowerCase(), friendEmail],
        memberNames: [sender.name, friendName],
        lastMessage: 'Private conversation started',
        lastMessageSender: sender.name,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await window.fbDb.collection('chat_rooms').add(dmRoom);
      this.closeStartDmModal();
      dmRoom.id = docRef.id;
      this.selectRoom(dmRoom);
      this.showMobileChat();
    } catch (err) {
      console.error('Failed to start direct chat:', err);
      alert('Could not start direct chat: ' + err.message);
    }
  }

  async fetchRegisteredUsers() {
    if (!window.fbDb) return;
    try {
      const snap = await window.fbDb.collection('users').get();
      this.friendsList = [];
      const myId = this.getSenderIdentity();
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.uid !== myId.uid) {
          this.friendsList.push(data);
        }
      });
    } catch (err) {
      console.warn('Could not fetch friends list:', err);
    }
  }

  // --- Shared Feed & Notes ---
  startNotesListener() {
    if (!window.fbDb) return;
    if (this.unsubscribeNotes) this.unsubscribeNotes();

    this.unsubscribeNotes = window.fbDb.collection('shared_notes').orderBy('createdAt', 'desc').onSnapshot(
      (snapshot) => {
        const notes = [];
        snapshot.forEach((doc) => {
          notes.push({ id: doc.id, ...doc.data() });
        });
        this.renderNotesFeed(notes);
      },
      (err) => console.error('Shared notes listener error:', err)
    );
  }

  renderNotesFeed(notes) {
    if (!this.notesFeed) return;
    this.notesFeed.innerHTML = '';

    if (notes.length === 0) {
      this.notesFeed.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <div style="font-size: 40px; margin-bottom: 12px;">📝</div>
          <h4 style="font-size: 16px; font-weight: 600; color: #fff;">No Shared Feed Posts Yet</h4>
          <p style="font-size: 13px; max-width: 400px; margin: 8px auto;">Share notes, formulas, or study links with your friends on the shared feed!</p>
        </div>
      `;
      return;
    }

    const myId = this.getSenderIdentity();

    notes.forEach((note) => {
      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.marginBottom = '16px';
      card.style.padding = '18px';

      const isAuthor = (note.authorId && note.authorId === myId.uid) || (myId.email && note.authorEmail && note.authorEmail.toLowerCase() === myId.email.toLowerCase());
      const canDelete = isAuthor || this.isAdminUser() || this.isAdmin;
      const dateFormatted = note.createdAt && note.createdAt.toDate
        ? note.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Recently';

      const showAdmin = !note.hideAdminBadge && (note.authorEmail === window.ADMIN_EMAIL);

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 34px; height: 34px; min-width: 34px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; overflow: hidden;">
              ${note.authorPhotoURL ? `<img src="${note.authorPhotoURL}" style="width: 100%; height: 100%; object-fit: cover;">` : (note.authorName || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 13px; font-weight: 600; color: #fff;">${this.escapeHtml(note.authorName || 'Friend')}</span>
                ${showAdmin ? '<span class="badge badge-project" style="font-size: 8px; padding: 1px 4px; background: #fff; color: #000; font-weight: 800;">ADMIN</span>' : ''}
              </div>
              <div style="font-size: 11px; color: var(--text-muted);">${dateFormatted}</div>
            </div>
          </div>
          ${canDelete ? `<button class="btn-ghost btn-delete-post" style="padding: 2px 6px; font-size: 11px; color: var(--accent-red);">✕</button>` : ''}
        </div>
        ${note.title ? `<h4 style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 6px;">${this.escapeHtml(note.title)}</h4>` : ''}
        ${note.content ? `<div style="font-size: 13px; color: var(--text-main); line-height: 1.5; margin-bottom: 8px;">${this.formatPostContent(note.content)}</div>` : ''}
        ${note.attachment && note.attachment.type === 'image' ? `
          <div style="margin-top: 10px; border-radius: 10px; overflow: hidden; max-height: 320px; border: 1px solid rgba(255,255,255,0.15);">
            <img src="${note.attachment.dataUrl}" style="width: 100%; max-height: 320px; object-fit: cover; cursor: pointer; display: block;" onclick="window.open('${note.attachment.dataUrl}', '_blank');" title="Click to view full image">
          </div>
        ` : ''}
        ${note.attachment && note.attachment.type === 'audio' ? `
          <div style="margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.06); border-radius: 8px;">
            <audio controls src="${note.attachment.dataUrl}" style="width: 100%; height: 32px;"></audio>
          </div>
        ` : ''}
        ${note.attachment && note.attachment.type === 'document' ? `
          <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(255,255,255,0.06); border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);">
            <span style="font-size: 12px; font-weight: 600; color: #fff;">📄 ${this.escapeHtml(note.attachment.name || 'Document')}</span>
            <a href="${note.attachment.dataUrl}" download="${this.escapeHtml(note.attachment.name || 'document')}" target="_blank" class="btn-primary" style="padding: 4px 12px; font-size: 11px; text-decoration: none; border-radius: 6px;">⬇️ Open</a>
          </div>
        ` : ''}
      `;

      const delBtn = card.querySelector('.btn-delete-post');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          if (!confirm('Delete post?')) return;
          try {
            await window.fbDb.collection('shared_notes').doc(note.id).delete();
          } catch (e) {}
        });
      }

      this.notesFeed.appendChild(card);
    });
  }

  // --- Shared Music Feed ---
  startSharedSongsListener() {
    if (!window.fbDb) return;
    if (this.unsubscribeSongs) this.unsubscribeSongs();

    this.unsubscribeSongs = window.fbDb.collection('shared_songs').orderBy('createdAt', 'desc').onSnapshot(
      (snapshot) => {
        const songs = [];
        snapshot.forEach((doc) => {
          songs.push({ id: doc.id, ...doc.data() });
        });
        this.renderSharedSongsFeed(songs);
      },
      (err) => console.error('Shared songs listener error:', err)
    );
  }

  renderSharedSongsFeed(songs) {
    if (!this.sharedSongsFeed) return;
    this.sharedSongsFeed.innerHTML = '';

    if (songs.length === 0) {
      this.sharedSongsFeed.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <div style="font-size: 40px; margin-bottom: 12px;">🎵</div>
          <h4 style="font-size: 16px; font-weight: 600; color: #fff;">No Shared Songs Yet</h4>
          <p style="font-size: 13px; max-width: 400px; margin: 8px auto;">Go to your local <strong>Songs & Audio</strong> tab and click <strong>📤 Share</strong> to stream music with friends!</p>
        </div>
      `;
      return;
    }

    const myId = this.getSenderIdentity();

    songs.forEach((song) => {
      const isAuthor = song.authorId === myId.uid;
      const canDelete = isAuthor || this.isAdmin;

      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.marginBottom = '14px';
      card.style.padding = '16px';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-size: 16px;">
              🎵
            </div>
            <div>
              <div style="font-size: 14px; font-weight: 700; color: #fff;">${this.escapeHtml(song.title)}</div>
              <div style="font-size: 11px; color: var(--text-muted);">Shared by ${this.escapeHtml(song.authorName || 'Friend')}</div>
            </div>
          </div>
          ${canDelete ? `<button class="btn-ghost btn-delete-song" style="padding: 2px 6px; font-size: 11px; color: var(--accent-red);">✕</button>` : ''}
        </div>
        <audio controls src="${song.audioUrl}" style="width: 100%; height: 32px; border-radius: var(--radius-sm);"></audio>
      `;

      const delBtn = card.querySelector('.btn-delete-song');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          if (!confirm('Delete shared song?')) return;
          try {
            await window.fbDb.collection('shared_songs').doc(song.id).delete();
          } catch (e) {}
        });
      }

      this.sharedSongsFeed.appendChild(card);
    });
  }

  // --- Admin Moderation & Users Directory ---
  async renderAdminUsersList() {
    if (!this.adminUsersView || !this.isAdmin) return;
    this.adminUsersView.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-muted);">Loading admin dashboard...</p>';

    try {
      const usersSnap = await window.fbDb.collection('users').get();
      let feedbackSnap = { docs: [] };
      try {
        feedbackSnap = await window.fbDb.collection('feedback_reports').orderBy('createdAt', 'desc').limit(50).get();
      } catch (_) {
        try {
          feedbackSnap = await window.fbDb.collection('feedback_reports').get();
        } catch (fErr) {
          console.warn('Could not fetch feedback reports:', fErr);
        }
      }

      this.adminUsersView.innerHTML = `
        <!-- 💡 Direct Feedback & Bug Reports Section -->
        <div class="glass-panel" style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 18px; font-weight: 700; color: #ffffff;">💡 Suggestions & 🐞 Bug Reports (${feedbackSnap.docs.length})</h3>
            <span class="badge badge-personal">Direct User Feedback</span>
          </div>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Reports submitted by community members from the Announcements channel and Help modal.</p>
          
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${feedbackSnap.docs.length === 0 ? `
              <div style="padding: 20px; text-align: center; color: var(--text-dim); font-size: 13px;">No suggestions or bug reports yet.</div>
            ` : feedbackSnap.docs.map((doc) => {
              const rep = doc.data();
              const isBug = rep.type === 'bug';
              const isResolved = rep.status === 'resolved';
              return `
                <div class="glass-card" style="padding: 14px 16px; border-left: 4px solid ${isBug ? '#ef4444' : '#3b82f6'};">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 6px;">
                    <div>
                      <span class="badge ${isBug ? 'badge-college' : 'badge-project'}" style="margin-right: 6px;">${isBug ? '🐞 BUG' : '💡 SUGGESTION'}</span>
                      <strong style="color: #fff; font-size: 14px;">${this.escapeHtml(rep.title || 'Untitled')}</strong>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="badge ${isResolved ? 'badge-success' : 'badge-personal'}">${isResolved ? '✓ Resolved' : '⏳ Pending'}</span>
                      <button type="button" class="btn-ghost btn-admin-toggle-report" data-report-id="${doc.id}" data-current-status="${rep.status || 'pending'}" style="font-size: 11px; padding: 4px 8px;" title="Toggle Resolved Status">
                        ${isResolved ? 'Reopen' : 'Mark Resolved'}
                      </button>
                      <button type="button" class="btn-ghost btn-admin-del-report" data-report-id="${doc.id}" style="font-size: 11px; padding: 4px 8px; color: #ef4444;" title="Delete report">
                        🗑️
                      </button>
                    </div>
                  </div>
                  <p style="font-size: 13px; color: rgba(255,255,255,0.85); margin: 6px 0 10px 0; white-space: pre-wrap; line-height: 1.5;">${this.escapeHtml(rep.description || '')}</p>
                  <div style="font-size: 11px; color: var(--text-dim); display: flex; gap: 12px;">
                    <span>👤 ${this.escapeHtml(rep.senderName || 'Anonymous')} (${this.escapeHtml(rep.senderEmail || 'no email')})</span>
                    <span>🕒 ${rep.createdAt && rep.createdAt.toDate ? rep.createdAt.toDate().toLocaleString() : 'Recently'}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 👥 Administrator Directory -->
        <div class="glass-panel" style="margin-bottom: 24px;">
          <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">👑 Administrator Directory (${usersSnap.size} Registered Users)</h3>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">As Administrator (${window.ADMIN_EMAIL}), you have full moderation privileges across all group channels, direct chats, and social feeds.</p>
          
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${usersSnap.docs.map((doc) => {
              const u = doc.data();
              const isTargetAdmin = u.role === 'admin' || (u.email || '').toLowerCase() === window.ADMIN_EMAIL.toLowerCase();
              return `
                <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; overflow: hidden;">
                      ${u.photoURL ? `<img src="${u.photoURL}" style="width: 100%; height: 100%; object-fit: cover;">` : (u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style="font-size: 14px; font-weight: 600; color: #fff;">${this.escapeHtml(u.displayName || 'Unnamed User')}</div>
                      <div style="font-size: 12px; color: var(--text-muted);">${this.escapeHtml(u.email || '')}</div>
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="badge ${isTargetAdmin ? 'badge-project' : 'badge-college'}">${isTargetAdmin ? 'ADMIN' : 'MEMBER'}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      // Attach admin feedback action handlers
      this.adminUsersView.querySelectorAll('.btn-admin-toggle-report').forEach(btn => {
        btn.addEventListener('click', async () => {
          const reportId = btn.getAttribute('data-report-id');
          const currentStatus = btn.getAttribute('data-current-status');
          const newStatus = currentStatus === 'resolved' ? 'pending' : 'resolved';
          try {
            await window.fbDb.collection('feedback_reports').doc(reportId).update({ status: newStatus });
            this.renderAdminUsersList();
          } catch (err) {
            alert('Failed to update status: ' + err.message);
          }
        });
      });

      this.adminUsersView.querySelectorAll('.btn-admin-del-report').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this report?')) return;
          const reportId = btn.getAttribute('data-report-id');
          try {
            await window.fbDb.collection('feedback_reports').doc(reportId).delete();
            this.renderAdminUsersList();
          } catch (err) {
            alert('Failed to delete report: ' + err.message);
          }
        });
      });
    } catch (err) {
      console.error('Error rendering admin users list:', err);
    }
  }

  openPostModal() {
    if (this.postModal) this.postModal.classList.add('active');
  }

  closePostModal() {
    if (this.postModal) {
      this.postModal.classList.remove('active');
      if (this.postForm) this.postForm.reset();
    }
  }

  async createSharedPost() {
    if (this._isSubmittingPost) return;
    this._isSubmittingPost = true;

    const title = document.getElementById('social-post-title') ? document.getElementById('social-post-title').value.trim() : '';
    const content = document.getElementById('social-post-content') ? document.getElementById('social-post-content').value.trim() : '';
    const fileInput = document.getElementById('social-post-file');
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!content && !file && !title) {
      alert('Please enter some text or attach an image to post.');
      this._isSubmittingPost = false;
      return;
    }

    const submitBtn = this.postForm ? this.postForm.querySelector('button[type="submit"]') : null;
    const origBtnText = submitBtn ? submitBtn.innerHTML : 'Share with Friends';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = '⏳ Publishing post...';
    }

    const sender = this.getSenderIdentity();
    const isIncognito = Boolean(sender.isIncognito);

    let attachment = null;
    if (file) {
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);
      const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name);

      if (window.fbStorage) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const folder = isImage ? 'feed_images' : (isAudio ? 'feed_audio' : 'feed_documents');
          const storageRef = window.fbStorage.ref(`${folder}/${Date.now()}_${safeName}`);
          const uploadTask = await storageRef.put(file);
          const downloadUrl = await uploadTask.ref.getDownloadURL();
          attachment = {
            name: file.name,
            type: isImage ? 'image' : (isAudio ? 'audio' : 'document'),
            dataUrl: downloadUrl
          };
        } catch (storageErr) {
          console.warn('Storage upload error in post, falling back to compression:', storageErr);
        }
      }

      if (!attachment) {
        if (isImage) {
          try {
            const dataUrl = await this.compressImage(file, 800, 0.75);
            attachment = { name: file.name, type: 'image', dataUrl };
          } catch (cErr) {
            console.warn('Image compression error:', cErr);
          }
        } else if (file.size <= 450 * 1024) {
          try {
            const dataUrl = await this._blobToDataUrl(file);
            attachment = { name: file.name, type: isAudio ? 'audio' : 'document', dataUrl };
          } catch (_) {}
        }
      }
    }

    try {
      await window.fbDb.collection('shared_notes').add({
        title,
        content: content || '',
        attachment: attachment || null,
        authorId: sender.uid,
        authorName: sender.name,
        authorEmail: isIncognito ? '' : sender.email,
        authorPhotoURL: isIncognito ? '' : (sender.photoURL || ''),
        hideAdminBadge: isIncognito,
        sharedWith: ['all'],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      this.closePostModal();
      this.switchSocialTab('feed');
    } catch (err) {
      console.error('Failed to post:', err);
      alert('Could not publish post: ' + err.message);
    } finally {
      this._isSubmittingPost = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnText;
      }
    }
  }

  stopListeners() {
    if (this.unsubscribeRooms) {
      this.unsubscribeRooms();
      this.unsubscribeRooms = null;
    }
    if (this.unsubscribeMessages) {
      this.unsubscribeMessages();
      this.unsubscribeMessages = null;
    }
    if (this.unsubscribeNotes) {
      this.unsubscribeNotes();
      this.unsubscribeNotes = null;
    }
    if (this.unsubscribeSongs) {
      this.unsubscribeSongs();
      this.unsubscribeSongs = null;
    }
  }

  formatPostContent(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

window.socialModule = new SocialModule();
