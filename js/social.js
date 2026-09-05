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
    this.chatInput = document.getElementById('chat-message-input');
    this.chatForm = document.getElementById('form-chat-send');
    this.chatEmptyState = document.getElementById('chat-empty-state');
    this.chatActiveWindow = document.getElementById('chat-active-window');
    this.mobileBackBtn = document.getElementById('btn-mobile-chat-back');
    this.anonBadge = document.getElementById('chat-anon-badge');

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
    this.postModal = document.getElementById('modal-social-post');
    this.postForm = document.getElementById('form-social-post');

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

    // 5b. Emoji Picker Initialization
    this.initEmojiPicker();

    // 6. Mobile Back to Channels
    if (this.mobileBackBtn) {
      this.mobileBackBtn.addEventListener('click', () => this.showMobileChannels());
    }

    // 7. Change Alias Modal
    if (this.anonBadge) {
      this.anonBadge.addEventListener('click', () => this.openAliasModal());
    }

    const btnEditChatName = document.getElementById('btn-edit-chat-name');
    if (btnEditChatName) {
      btnEditChatName.addEventListener('click', (e) => {
        e.preventDefault();
        this.openAliasModal();
      });
    }

    const btnClearChat = document.getElementById('btn-clear-chat');
    if (btnClearChat) {
      btnClearChat.addEventListener('click', (e) => {
        e.preventDefault();
        this.clearCurrentChat();
      });
    }

    if (this.aliasModal) {
      this.aliasModal.addEventListener('click', (e) => {
        if (e.target === this.aliasModal) this.closeAliasModal();
      });
    }

    document.querySelectorAll('[data-close="modal-change-alias"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeAliasModal());
    });

    const btnSaveAlias = document.getElementById('btn-save-alias');
    if (btnSaveAlias) {
      btnSaveAlias.addEventListener('click', () => {
        const input = document.getElementById('custom-alias-input');
        if (input && input.value.trim()) {
          this.setCustomHandle(input.value.trim());
          this.closeAliasModal();
        }
      });
    }

    const btnRandomizeAlias = document.getElementById('btn-randomize-alias');
    if (btnRandomizeAlias) {
      btnRandomizeAlias.addEventListener('click', () => {
        const input = document.getElementById('custom-alias-input');
        if (input) input.value = this.generateRandomAlias();
      });
    }

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

    // Initial setup: start rooms listener & messages listener on general lounge
    this.seedDefaultRoomsIfEmpty();
    this.startRoomsListener();
    this.startMessagesListener('general_lounge');
    this.startNotesListener();
    this.startSharedSongsListener();
  }

  // --- Anonymous & Custom Alias Identity System with Admin Protection ---
  isReservedAdminName(name) {
    if (!name) return false;
    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const reserved = ['admin', 'ayush', 'ash', 'apex'];
    return reserved.some(r => clean.includes(r));
  }

  isAdminUser() {
    if (this.isAdmin) return true;
    if (this.currentUser && this.currentUser.email && this.currentUser.email.toLowerCase() === window.ADMIN_EMAIL.toLowerCase()) return true;
    const storedEmail = localStorage.getItem('apex_user_email');
    if (storedEmail && storedEmail.toLowerCase() === window.ADMIN_EMAIL.toLowerCase()) return true;
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
  }

  generateRandomAlias() {
    const adjectives = ['Cyber', 'Neon', 'Shadow', 'Phantom', 'Cosmic', 'Solar', 'Quantum', 'Vortex', 'Astral', 'Hyper', 'Velox', 'Echo'];
    const nouns = ['Pilot', 'Hacker', 'Nomad', 'Scholar', 'Ninja', 'Rider', 'Voyager', 'Ghost', 'Architect', 'Spark', 'Titan', 'Drifter'];
    const num = Math.floor(100 + Math.random() * 900);
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}${noun}_${num}`;
  }

  openAliasModal() {
    const input = document.getElementById('custom-alias-input');
    if (input) input.value = this.getSenderIdentity().name;
    const modal = this.aliasModal || document.getElementById('modal-change-alias');
    if (modal) {
      this.aliasModal = modal;
      modal.classList.add('active');
      if (input) setTimeout(() => input.focus(), 60);
    }
  }

  closeAliasModal() {
    const modal = this.aliasModal || document.getElementById('modal-change-alias');
    if (modal) modal.classList.remove('active');
  }

  setCustomHandle(name) {
    if (!name || !name.trim()) return;
    const cleanName = name.trim();

    // Security check: restrict admin reserved names (Admin, Ayush, Ash, Apex) to verified admin email only
    if (this.isReservedAdminName(cleanName) && !this.isAdminUser()) {
      alert('🔒 Security Notice: The handles "Admin", "Ayush", "Ash", and "Apex" are protected and reserved exclusively for the system owner.');
      return;
    }

    localStorage.setItem('apex_chat_handle', cleanName);
    localStorage.setItem('apex_anon_handle', cleanName);
    this.updateAnonBadge();
  }

  promptChangeHandle() {
    this.openAliasModal();
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

    if (this.currentUser) {
      const defaultName = this.currentUser.displayName || this.currentUser.email.split('@')[0];
      return {
        uid: this.currentUser.uid,
        name: savedCustomHandle || defaultName,
        email: this.currentUser.email,
        isAnon: false
      };
    } else {
      const anonUid = localStorage.getItem('apex_anon_uid') || 'anon_guest';
      const anonName = savedCustomHandle || 'AnonymousUser';
      return {
        uid: anonUid,
        name: anonName,
        email: 'anonymous@apex',
        isAnon: true
      };
    }
  }

  handleAuthUpdate() {
    this.updateAnonBadge();

    if (this.adminTabBtn) {
      this.adminTabBtn.style.display = this.isAdmin ? 'inline-flex' : 'none';
    }

    if (this.currentUser) {
      this.fetchRegisteredUsers();
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

  // --- Attachments Handling (Auto-Compressed Images & Audio Tracks) ---
  async handleChatFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|mpeg|mpg|opus|weba|amr)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name);

    if (isImage) {
      // Auto-compress image to fit comfortably under Firestore 1MB document limit
      try {
        const compressedDataUrl = await this.compressImage(file, 800, 0.75);
        this.pendingAttachment = {
          name: file.name,
          type: 'image',
          dataUrl: compressedDataUrl
        };

        if (this.chatAttachmentPreview && this.attachmentPreviewName) {
          this.attachmentPreviewName.innerText = `🖼️ ${file.name}`;
          this.chatAttachmentPreview.style.display = 'flex';
        }
      } catch (err) {
        console.error('Image compression error:', err);
        alert('Could not process image: ' + err.message);
      }
    } else if (isAudio) {
      if (this.chatAttachmentPreview && this.attachmentPreviewName) {
        this.attachmentPreviewName.innerText = `⏳ Optimizing 🎵 ${file.name}...`;
        this.chatAttachmentPreview.style.display = 'flex';
      }

      // If Firebase Storage is initialized and responding, upload original file
      if (window.fbStorage && file.size > 700 * 1024) {
        try {
          const uploadPromise = (async () => {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storageRef = window.fbStorage.ref(`chat_audio/${Date.now()}_${safeName}`);
            const snapshot = await storageRef.put(file);
            return await snapshot.ref.getDownloadURL();
          })();

          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
          const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);

          this.pendingAttachment = {
            name: file.name,
            type: 'audio',
            dataUrl: downloadUrl
          };

          if (this.chatAttachmentPreview && this.attachmentPreviewName) {
            this.attachmentPreviewName.innerText = `🎵 Ready: ${file.name}`;
            this.chatAttachmentPreview.style.display = 'flex';
          }
          return;
        } catch (storageErr) {
          console.warn('Storage unavailable, auto-compressing audio for direct chat sending:', storageErr);
        }
      }

      // Auto-compress audio track using Web Audio API to fit comfortably in Firestore
      try {
        const compressedAudioDataUrl = await this.compressAudio(file);
        this.pendingAttachment = {
          name: file.name,
          type: 'audio',
          dataUrl: compressedAudioDataUrl
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
    }
  }

  async compressAudio(file) {
    // Read file as-is. Preserve original bytes. We'll fix the MIME when creating a blob URL.
    const MAX_BYTES = 850 * 1024;
    const source = file.size <= MAX_BYTES ? file : file.slice(0, MAX_BYTES);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        let dataUrl = reader.result;
        if (!dataUrl) { reject(new Error('FileReader returned empty result')); return; }

        // Normalise MIME: WhatsApp audio often comes in as video/mpeg or application/octet-stream
        const mime = this._detectAudioMime(dataUrl, file.name);
        if (!dataUrl.startsWith(`data:${mime};`)) {
          dataUrl = dataUrl.replace(/^data:[^;]+;base64,/, `data:${mime};base64,`);
        }

        console.log(`[Audio] Prepared: ${file.name} → MIME: ${mime}, size: ${Math.round(source.size/1024)}KB`);
        resolve(dataUrl);
      };
      reader.onerror = (e) => reject(new Error('FileReader error: ' + e));
      reader.readAsDataURL(source);
    });
  }

  _detectAudioMime(dataUrl, fileName) {
    // Try to detect MIME from data URL header first
    const headerMatch = dataUrl.match(/^data:([^;]+);/);
    const declared = headerMatch ? headerMatch[1] : '';

    // If browser correctly detected an audio MIME, trust it
    if (declared.startsWith('audio/')) return declared;

    // Detect from file extension
    const ext = (fileName || '').toLowerCase().split('.').pop();
    const extMap = {
      mp3: 'audio/mpeg', mpeg: 'audio/mpeg', mpg: 'audio/mpeg',
      ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
      wav: 'audio/wav', wave: 'audio/wav',
      m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
      webm: 'audio/webm', weba: 'audio/webm', amr: 'audio/amr',
    };
    if (extMap[ext]) return extMap[ext];

    // Detect from magic bytes in base64
    const b64 = (dataUrl.split(',')[1] || '').substring(0, 12);
    if (b64.startsWith('UklGR')) return 'audio/wav';       // RIFF → WAV
    if (b64.startsWith('SUQz') || b64.startsWith('//M')) return 'audio/mpeg'; // ID3 or MP3 sync
    if (b64.startsWith('T2dnU')) return 'audio/ogg';       // OggS
    if (b64.startsWith('AAAA') || b64.startsWith('AAAAF')) return 'audio/mp4'; // M4A/AAC

    // Default fallback
    return 'audio/mpeg';
  }

  // Converts a data: URL to a Blob URL with correct MIME type, OR passes through https:// URLs
  resolveAudioSrc(raw) {
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (!raw.startsWith('data:')) return raw;

    try {
      const headerMatch = raw.match(/^data:([^;]+);base64,/);
      const mime = headerMatch ? headerMatch[1] : 'audio/mpeg';
      const b64 = raw.split(',')[1];
      if (!b64) return raw;

      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const blob = new Blob([bytes], { type: mime });
      const url = URL.createObjectURL(blob);
      console.log(`[Audio] Blob URL created: ${mime}, ${Math.round(binary.length/1024)}KB → ${url.substring(0, 60)}`);
      return url;
    } catch (e) {
      console.warn('[Audio] resolveAudioSrc blob conversion failed, using raw dataUrl:', e);
      return raw;
    }
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
    const newMsg = {
      text: '',
      attachment: {
        name: 'Sticker',
        type: 'sticker',
        dataUrl: stickerUrl
      },
      senderId: sender.uid,
      senderName: sender.name,
      senderEmail: sender.email,
      isAnonymous: sender.isAnon,
      localTimestamp: Date.now(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

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
          id: 'study_notes',
          name: '📚 Study & College Notes',
          description: 'Collaborate on subjects, exam tips, and study materials',
          type: 'group',
          icon: '📚',
          createdBy: 'system',
          createdByName: 'Apex Space',
          members: ['all'],
          memberEmails: ['all'],
          lastMessage: 'Share your college notes, formulas, and study sessions here.',
          lastMessageSender: 'Apex System',
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        {
          id: 'projects_code',
          name: '💻 Projects & Code Hub',
          description: 'Discuss software projects, web apps, tools & ideas',
          type: 'group',
          icon: '💻',
          createdBy: 'system',
          createdByName: 'Apex Space',
          members: ['all'],
          memberEmails: ['all'],
          lastMessage: 'Discuss your development progress and technical questions.',
          lastMessageSender: 'Apex System',
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      ];

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
    const canDeleteRoom = room.type === 'direct' || (room.id !== 'general_lounge' && (this.isAdminUser() || room.createdBy === myId.uid));

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
    if (!room || !room.id || room.id === 'general_lounge') return;
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

        docs.forEach((msg) => {
          const msgEl = this.createMessageBubbleElement(msg);
          this.chatMessagesContainer.appendChild(msgEl);
        });

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
    const el = document.getElementById(`msg-${this._pinnedMessageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background 0.3s';
      el.style.background = 'rgba(255,200,0,0.18)';
      setTimeout(() => { el.style.background = ''; }, 1800);
    }
  }

  createMessageBubbleElement(msg) {
    const myIdentity = this.getSenderIdentity();
    const isMe = msg.senderId === myIdentity.uid;
    const canDelete = isMe || this.isAdmin;
    const canPin = this.isAdminUser();

    const timeFormatted = msg.createdAt && msg.createdAt.toDate
      ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const div = document.createElement('div');
    if (msg.id) div.id = `msg-${msg.id}`;
    div.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: ${isMe ? 'flex-end' : 'flex-start'};
      margin-bottom: 14px;
      max-width: 86%;
      ${isMe ? 'margin-left: auto;' : 'margin-right: auto;'}
    `;

    const isSticker = msg.attachment && msg.attachment.type === 'sticker';

    if (isSticker) {
      div.innerHTML = `
        ${!isMe ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; margin-left: 2px;">
            <span style="font-size: 11px; font-weight: 700; color: #fff;">${this.escapeHtml(msg.senderName || 'Friend')}</span>
            ${msg.senderEmail === window.ADMIN_EMAIL ? '<span class="badge badge-project" style="font-size: 8px; padding: 1px 4px; background: #fff; color: #000; font-weight: 800;">ADMIN</span>' : ''}
          </div>
        ` : ''}

        <div style="position: relative; padding: 4px;">
          <img src="${msg.attachment.dataUrl}" style="width: 120px; height: 120px; object-fit: contain; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.55)); display: block;" alt="Sticker">
          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 4px; font-size: 10px; color: var(--text-dim);">
            <span>${timeFormatted}</span>
            ${canDelete ? `<button class="btn-delete-chat-msg" style="background: transparent; border: none; cursor: pointer; color: var(--text-dim); font-size: 11px; opacity: 0.7;" title="${isMe ? 'Delete my sticker' : 'Delete as Admin'}">🗑️</button>` : ''}
          </div>
        </div>
      `;
    } else {
      const audioSrc = msg.attachment && msg.attachment.type === 'audio' 
        ? this.resolveAudioSrc(msg.attachment.dataUrl)
        : '';

      div.innerHTML = `
        ${!isMe ? `
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; margin-left: 2px;">
            <span style="font-size: 11px; font-weight: 700; color: #fff;">${this.escapeHtml(msg.senderName || 'Friend')}</span>
            ${msg.senderEmail === window.ADMIN_EMAIL ? '<span class="badge badge-project" style="font-size: 8px; padding: 1px 4px; background: #fff; color: #000; font-weight: 800;">ADMIN</span>' : ''}
          </div>
        ` : ''}

        <div style="
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
          ${msg.text ? `<div>${this.formatPostContent(msg.text)}</div>` : ''}

          <!-- Custom Interactive Audio Player -->
          ${msg.attachment && msg.attachment.type === 'audio' ? `
            <div class="chat-custom-audio-player" style="margin-top: 8px; padding: 10px 14px; background: ${isMe ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.6)'}; border-radius: 12px; min-width: 250px; max-width: 320px; border: 1px solid rgba(255,255,255,0.1);">
              <div style="font-size: 11px; font-weight: 700; margin-bottom: 8px; color: ${isMe ? '#000' : '#fff'}; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">🎵 ${this.escapeHtml(msg.attachment.name)}</span>
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
            <div style="margin-top: 8px; border-radius: 10px; overflow: hidden; max-width: 260px; max-height: 200px; border: 1px solid rgba(255,255,255,0.15);">
              <img src="${msg.attachment.dataUrl}" style="width: 100%; height: 100%; max-height: 200px; object-fit: cover; display: block; cursor: pointer;" onclick="window.open('${msg.attachment.dataUrl}', '_blank');" title="Click to view full image">
            </div>
          ` : ''}

          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 4px; font-size: 10px; color: ${isMe ? 'rgba(0,0,0,0.6)' : 'var(--text-dim)'};">
            <span>${timeFormatted}</span>
            ${canPin ? `<button class="btn-pin-chat-msg" style="background: transparent; border: none; cursor: pointer; color: ${isMe ? 'rgba(0,0,0,0.5)' : 'rgba(255,200,0,0.6)'}; font-size: 11px; opacity: 0.7; transition: opacity 0.2s;" title="📌 Pin this message (Admin only)">📌</button>` : ''}
            ${canDelete ? `<button class="btn-delete-chat-msg" style="background: transparent; border: none; cursor: pointer; color: ${isMe ? '#ff3b30' : 'var(--text-dim)'}; font-size: 11px; opacity: 0.7; transition: opacity 0.2s;" title="${isMe ? 'Delete my message' : 'Delete as Admin'}">🗑️</button>` : ''}
          </div>
        </div>
      `;
    }

    // Interactive custom audio player controls
    const playBtn = div.querySelector('.btn-play-pause-audio');
    if (playBtn && msg.attachment && msg.attachment.type === 'audio') {
      const audioSrc = this.resolveAudioSrc(msg.attachment.dataUrl);
      const progressBar = div.querySelector('.chat-audio-progress-bar');
      const progressFill = div.querySelector('.chat-audio-progress-fill');
      const currentTimeEl = div.querySelector('.chat-audio-current-time');
      const durationEl = div.querySelector('.chat-audio-duration');

      const audio = new Audio(audioSrc);

      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && !isNaN(audio.duration)) {
          const mins = Math.floor(audio.duration / 60);
          const secs = Math.floor(audio.duration % 60).toString().padStart(2, '0');
          if (durationEl) durationEl.innerText = `${mins}:${secs}`;
        }
      });

      audio.addEventListener('timeupdate', () => {
        if (audio.duration && !isNaN(audio.duration)) {
          const pct = (audio.currentTime / audio.duration) * 100;
          if (progressFill) progressFill.style.width = `${pct}%`;
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
            console.error('Audio play error:', err);
            playBtn.innerText = '▶';
            alert(`⚠️ Audio Playback Error:\n${err.name}: ${err.message}\n\nThe audio src starts with: "${audioSrc ? audioSrc.substring(0, 80) : 'EMPTY'}"`);
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
          if (audio.duration && !isNaN(audio.duration)) {
            audio.currentTime = (clickX / width) * audio.duration;
          }
        });
      }
    }

    const delBtn = div.querySelector('.btn-delete-chat-msg');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this message?')) return;
        try {
          await window.fbDb
            .collection('chat_rooms')
            .doc(this.activeRoomId)
            .collection('messages')
            .doc(msg.id)
            .delete();
        } catch (err) {
          console.error('Failed to delete message:', err);
        }
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

    const newMsg = {
      text: text || '',
      attachment: attachment || null,
      senderId: sender.uid,
      senderName: sender.name,
      senderEmail: sender.email,
      isAnonymous: sender.isAnon,
      localTimestamp: Date.now(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      // 1. Add to messages subcollection
      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .collection('messages')
        .add(newMsg);

      // 2. Update room's lastMessage
      const previewText = attachment ? (attachment.type === 'audio' ? '🎵 Audio Track' : '🖼️ Image') : text;
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

    if (!this.friendsList || this.friendsList.length === 0) {
      container.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 16px 0;">Loading registered friends...</p>';
      try {
        await this.fetchRegisteredUsers();
      } catch (err) {
        console.error('Error loading DM friends:', err);
      }
    }

    container.innerHTML = '';

    if (!this.friendsList || this.friendsList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px 0; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 6px;">👥</div>
          <p style="font-size: 13px; color: #fff;">No other users found online yet.</p>
          <p style="font-size: 11px; margin-top: 4px;">Share your app link with friends so they can join!</p>
        </div>
      `;
      return;
    }

    // Filter by search query (name / handle / alias)
    const query = (searchQuery || '').toLowerCase().trim();
    const filtered = this.friendsList.filter((friend) => {
      const name = (friend.displayName || (friend.email ? friend.email.split('@')[0] : 'friend')).toLowerCase();
      return name.includes(query);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px 0; color: var(--text-muted);">
          <div style="font-size: 24px; margin-bottom: 6px;">🔍</div>
          <p style="font-size: 13px; color: #fff;">No friends found matching "<strong>${this.escapeHtml(searchQuery)}</strong>"</p>
          <p style="font-size: 11px; margin-top: 4px;">Try searching by another name or nickname.</p>
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
          <div style="width: 34px; height: 34px; min-width: 34px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; flex-shrink: 0;">
            ${friendName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>${this.escapeHtml(friendName)}</span>
              ${isFriendAdmin ? '<span class="badge badge-project" style="font-size: 8px; padding: 1px 5px; background: #fff; color: #000; font-weight: 800;">ADMIN</span>' : ''}
            </div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">
              ${isFriendAdmin ? '👑 Verified Admin' : '👤 Apex Member • Active'}
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

    try {
      const existing = this.roomsList.find(r => 
        r.type === 'direct' && 
        r.members && 
        r.members.includes(sender.uid) && 
        r.members.includes(friend.uid)
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
        members: [sender.uid, friend.uid],
        memberEmails: [sender.email.toLowerCase(), (friend.email || '').toLowerCase()],
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

      const isAuthor = note.authorId === myId.uid;
      const canDelete = isAuthor || this.isAdmin;
      const dateFormatted = note.createdAt && note.createdAt.toDate
        ? note.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Recently';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">
              ${(note.authorName || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #fff;">${this.escapeHtml(note.authorName || 'Friend')}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${dateFormatted}</div>
            </div>
          </div>
          ${canDelete ? `<button class="btn-ghost btn-delete-post" style="padding: 2px 6px; font-size: 11px; color: var(--accent-red);">✕</button>` : ''}
        </div>
        ${note.title ? `<h4 style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 6px;">${this.escapeHtml(note.title)}</h4>` : ''}
        <div style="font-size: 13px; color: var(--text-main); line-height: 1.5;">${this.formatPostContent(note.content)}</div>
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
    this.adminUsersView.innerHTML = '<p style="padding: 20px; text-align: center; color: var(--text-muted);">Loading registered users...</p>';

    try {
      const snap = await window.fbDb.collection('users').get();
      this.adminUsersView.innerHTML = `
        <div class="glass-panel" style="margin-bottom: 24px;">
          <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">👑 Administrator Directory (${snap.size} Registered Users)</h3>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">As Administrator (${window.ADMIN_EMAIL}), you have full moderation privileges across all group channels, direct chats, and social feeds.</p>
          
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${snap.docs.map((doc) => {
              const u = doc.data();
              const isTargetAdmin = u.role === 'admin' || (u.email || '').toLowerCase() === window.ADMIN_EMAIL.toLowerCase();
              return `
                <div class="glass-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">
                      ${(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
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
    const title = document.getElementById('social-post-title').value.trim();
    const content = document.getElementById('social-post-content').value.trim();

    if (!content) return;

    const sender = this.getSenderIdentity();

    try {
      await window.fbDb.collection('shared_notes').add({
        title,
        content,
        authorId: sender.uid,
        authorName: sender.name,
        authorEmail: sender.email,
        sharedWith: ['all'],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      this.closePostModal();
    } catch (err) {
      console.error('Failed to post:', err);
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
