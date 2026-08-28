/**
 * Apex Personal Dashboard - WhatsApp-style Realtime Social Hub & Group Chat Module
 * Includes Realtime Group Channels, Personal 1-on-1 Direct Messaging (DMs),
 * Shared Feed, Music Sharing, and Admin Moderation.
 */

class SocialModule {
  constructor() {
    this.currentUser = null;
    this.isAdmin = false;
    this.activeTab = 'chat'; // 'chat' | 'feed' | 'music' | 'admin_users'
    this.activeRoomId = null;
    this.activeRoomData = null;

    // Listeners
    this.unsubscribeRooms = null;
    this.unsubscribeMessages = null;
    this.unsubscribeNotes = null;
    this.unsubscribeSongs = null;
    this.friendsList = [];
    this.roomsList = [];

    // DOM Elements
    this.socialView = document.getElementById('view-social');
    this.authNotice = document.getElementById('social-auth-notice');
    this.socialMainContent = document.getElementById('social-main-content');

    // Chat Layout Elements
    this.chatSection = document.getElementById('social-chat-section');
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

    // Other Tabs
    this.notesFeed = document.getElementById('social-notes-feed');
    this.sharedSongsFeed = document.getElementById('social-songs-feed');
    this.adminUsersView = document.getElementById('social-admin-users-view');
    this.adminTabBtn = document.getElementById('btn-social-tab-admin');

    // Modals
    this.createGroupModal = document.getElementById('modal-create-group');
    this.createGroupForm = document.getElementById('form-create-group');
    this.startDmModal = document.getElementById('modal-start-dm');
    this.postModal = document.getElementById('modal-social-post');
    this.postForm = document.getElementById('form-social-post');

    this.init();
  }

  init() {
    // 1. Auth Listener
    window.addEventListener('apex-auth-changed', (e) => {
      this.currentUser = e.detail.user;
      this.isAdmin = e.detail.isAdmin;
      this.handleAuthUpdate();
    });

    // 2. Main Social Navigation Tabs
    document.querySelectorAll('.social-nav-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-social-tab');
        this.switchSocialTab(tab);
      });
    });

    // 3. Chat Send Form
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

    // 4. Create Group Triggers
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

    // 5. Start DM Triggers
    const btnOpenDmModal = document.getElementById('btn-open-dm-modal');
    if (btnOpenDmModal) {
      btnOpenDmModal.addEventListener('click', () => this.openStartDmModal());
    }

    document.querySelectorAll('[data-close="modal-start-dm"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeStartDmModal());
    });

    // 6. Post Modal Triggers
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
  }

  handleAuthUpdate() {
    if (!this.socialView) return;

    if (this.currentUser) {
      if (this.authNotice) this.authNotice.style.display = 'none';
      if (this.socialMainContent) this.socialMainContent.style.display = 'block';

      if (this.adminTabBtn) {
        this.adminTabBtn.style.display = this.isAdmin ? 'inline-flex' : 'none';
      }

      this.fetchRegisteredUsers();
      this.seedDefaultRoomsIfEmpty();
      this.startRoomsListener();
      this.startNotesListener();
      this.startSharedSongsListener();
    } else {
      if (this.authNotice) this.authNotice.style.display = 'block';
      if (this.socialMainContent) this.socialMainContent.style.display = 'none';
      if (this.adminTabBtn) this.adminTabBtn.style.display = 'none';

      this.stopListeners();
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

    if (this.chatSection) this.chatSection.style.display = tab === 'chat' ? 'grid' : 'none';
    if (this.notesFeed) this.notesFeed.style.display = tab === 'feed' ? 'block' : 'none';
    if (this.sharedSongsFeed) this.sharedSongsFeed.style.display = tab === 'music' ? 'block' : 'none';
    if (this.adminUsersView) {
      this.adminUsersView.style.display = tab === 'admin_users' ? 'block' : 'none';
      if (tab === 'admin_users') this.renderAdminUsersList();
    }
  }

  // --- Realtime Chat Rooms & Direct Messages ---
  async seedDefaultRoomsIfEmpty() {
    if (!window.fbDb || !this.currentUser) return;

    try {
      const snap = await window.fbDb.collection('chat_rooms').limit(1).get();
      if (snap.empty) {
        const defaultRooms = [
          {
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
          await window.fbDb.collection('chat_rooms').add(r);
        }
      }
    } catch (err) {
      console.warn('Could not seed default rooms:', err);
    }
  }

  startRoomsListener() {
    if (!window.fbDb || !this.currentUser) return;
    if (this.unsubscribeRooms) this.unsubscribeRooms();

    this.unsubscribeRooms = window.fbDb.collection('chat_rooms').orderBy('lastMessageTime', 'desc').onSnapshot(
      (snapshot) => {
        this.roomsList = [];
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          if (this.isAdmin || this.hasAccessToRoom(data)) {
            this.roomsList.push(data);
          }
        });
        this.renderRoomsList();
      },
      (err) => {
        console.error('Chat rooms listener error:', err);
      }
    );
  }

  hasAccessToRoom(room) {
    if (!this.currentUser) return false;
    const uid = this.currentUser.uid;
    const email = (this.currentUser.email || '').toLowerCase();

    if (room.members && room.members.includes('all')) return true;
    if (room.members && room.members.includes(uid)) return true;
    if (room.memberEmails && room.memberEmails.includes(email)) return true;
    if (room.createdBy === uid) return true;

    return false;
  }

  renderRoomsList() {
    if (!this.roomsListContainer || !this.directListContainer) return;

    this.roomsListContainer.innerHTML = '';
    this.directListContainer.innerHTML = '';

    const groups = this.roomsList.filter(r => r.type !== 'direct');
    const directChats = this.roomsList.filter(r => r.type === 'direct');

    // 1. Render Group Rooms
    if (groups.length === 0) {
      this.roomsListContainer.innerHTML = `<p style="font-size: 11px; color: var(--text-dim); text-align: center; padding: 12px 0;">No groups created yet.</p>`;
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

    // Auto-select first room if none selected
    if (!this.activeRoomId && groups.length > 0) {
      this.selectRoom(groups[0]);
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

    // Title / display for DM vs Group
    let roomTitle = room.name;
    let roomAvatar = room.icon || '💬';

    if (room.type === 'direct' && room.memberNames) {
      const otherName = room.memberNames.find(n => n !== (this.currentUser.displayName || this.currentUser.email.split('@')[0])) || 'Friend';
      roomTitle = otherName;
      roomAvatar = otherName.charAt(0).toUpperCase();
    }

    const lastMsg = room.lastMessage || 'No messages yet';

    div.innerHTML = `
      <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 50%; background: #ffffff; color: #000000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">
        ${roomAvatar}
      </div>
      <div style="overflow: hidden; flex: 1;">
        <div style="font-size: 13px; font-weight: 600; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
          ${this.escapeHtml(roomTitle)}
        </div>
        <div style="font-size: 11px; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-top: 2px;">
          ${this.escapeHtml(lastMsg)}
        </div>
      </div>
    `;

    div.addEventListener('click', () => this.selectRoom(room));
    return div;
  }

  selectRoom(room) {
    this.activeRoomId = room.id;
    this.activeRoomData = room;

    // Highlight room in list
    document.querySelectorAll('.chat-room-item').forEach((el) => {
      el.style.background = 'rgba(255,255,255,0.02)';
      el.style.borderColor = 'transparent';
    });
    const selectedEl = Array.from(document.querySelectorAll('.chat-room-item')).find(el => el.innerText.includes(room.name));
    if (selectedEl) {
      selectedEl.style.background = 'rgba(255,255,255,0.12)';
      selectedEl.style.borderColor = '#ffffff';
    }

    // Update Header
    let roomTitle = room.name;
    let roomAvatar = room.icon || '💬';
    let roomSubtitle = room.description || (room.type === 'direct' ? 'Direct 1-on-1 Conversation' : 'Group Channel');

    if (room.type === 'direct' && room.memberNames) {
      const otherName = room.memberNames.find(n => n !== (this.currentUser.displayName || this.currentUser.email.split('@')[0])) || 'Friend';
      roomTitle = otherName;
      roomAvatar = otherName.charAt(0).toUpperCase();
    }

    if (this.chatHeaderTitle) this.chatHeaderTitle.innerText = roomTitle;
    if (this.chatHeaderSubtitle) this.chatHeaderSubtitle.innerText = roomSubtitle;
    if (this.chatHeaderAvatar) this.chatHeaderAvatar.innerText = roomAvatar;

    if (this.chatEmptyState) this.chatEmptyState.style.display = 'none';
    if (this.chatActiveWindow) this.chatActiveWindow.style.display = 'flex';

    this.startMessagesListener(room.id);
  }

  startMessagesListener(roomId) {
    if (!window.fbDb) return;
    if (this.unsubscribeMessages) this.unsubscribeMessages();

    this.chatMessagesContainer.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-dim);">Loading messages...</div>`;

    const messagesRef = window.fbDb
      .collection('chat_rooms')
      .doc(roomId)
      .collection('messages')
      .orderBy('createdAt', 'asc');

    this.unsubscribeMessages = messagesRef.onSnapshot(
      (snapshot) => {
        this.chatMessagesContainer.innerHTML = '';

        if (snapshot.empty) {
          this.chatMessagesContainer.innerHTML = `
            <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
              <div style="font-size: 36px; margin-bottom: 10px;">💬</div>
              <h4 style="font-size: 15px; font-weight: 600; color: #fff;">No messages yet</h4>
              <p style="font-size: 12px; margin-top: 6px;">Send the first message to start interacting with your friends in realtime!</p>
            </div>
          `;
          return;
        }

        snapshot.forEach((doc) => {
          const msg = { id: doc.id, ...doc.data() };
          const msgEl = this.createMessageBubbleElement(msg);
          this.chatMessagesContainer.appendChild(msgEl);
        });

        this.scrollChatToBottom();
      },
      (err) => {
        console.error('Messages listener error:', err);
      }
    );
  }

  createMessageBubbleElement(msg) {
    const isMe = this.currentUser && msg.senderId === this.currentUser.uid;
    const canDelete = isMe || this.isAdmin;

    const timeFormatted = msg.createdAt && msg.createdAt.toDate
      ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const div = document.createElement('div');
    div.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: ${isMe ? 'flex-end' : 'flex-start'};
      margin-bottom: 12px;
      max-width: 80%;
      ${isMe ? 'margin-left: auto;' : 'margin-right: auto;'}
    `;

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
        ${this.formatPostContent(msg.text)}

        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: 4px; font-size: 10px; color: ${isMe ? 'rgba(0,0,0,0.6)' : 'var(--text-dim)'};">
          <span>${timeFormatted}</span>
          ${canDelete ? `<button class="btn-delete-chat-msg" style="background: transparent; border: none; cursor: pointer; color: ${isMe ? '#ff3b30' : 'var(--accent-red)'}; font-size: 10px;" title="Delete Message">✕</button>` : ''}
        </div>
      </div>
    `;

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

    return div;
  }

  async sendMessage() {
    if (!this.currentUser || !this.activeRoomId) return;
    const text = this.chatInput.value.trim();
    if (!text) return;

    this.chatInput.value = '';

    const newMsg = {
      text: text,
      senderId: this.currentUser.uid,
      senderName: this.currentUser.displayName || this.currentUser.email.split('@')[0],
      senderEmail: this.currentUser.email,
      senderPhoto: this.currentUser.photoURL || '',
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
      await window.fbDb
        .collection('chat_rooms')
        .doc(this.activeRoomId)
        .update({
          lastMessage: text.length > 50 ? text.substring(0, 50) + '...' : text,
          lastMessageSender: newMsg.senderName,
          lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
        });

      this.scrollChatToBottom();
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Could not send message: ' + err.message);
    }
  }

  scrollChatToBottom() {
    if (this.chatMessagesContainer) {
      setTimeout(() => {
        this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
      }, 50);
    }
  }

  // --- Group Creation & Personal DMs ---
  openCreateGroupModal() {
    if (!this.currentUser) {
      alert('Please connect your Apex Cloud account first!');
      return;
    }
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
    const typeSelect = document.getElementById('group-access-type');

    const name = nameInput.value.trim();
    if (!name || !this.currentUser) return;

    const newRoom = {
      name: name,
      description: descInput ? descInput.value.trim() : '',
      icon: iconInput ? iconInput.value.trim() || '👥' : '👥',
      type: 'group',
      createdBy: this.currentUser.uid,
      createdByName: this.currentUser.displayName || this.currentUser.email.split('@')[0],
      members: ['all'],
      memberEmails: ['all'],
      lastMessage: 'Group created',
      lastMessageSender: this.currentUser.displayName || 'Creator',
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      const docRef = await window.fbDb.collection('chat_rooms').add(newRoom);
      this.closeCreateGroupModal();
      newRoom.id = docRef.id;
      this.selectRoom(newRoom);
    } catch (err) {
      console.error('Failed to create group:', err);
      alert('Failed to create group: ' + err.message);
    }
  }

  openStartDmModal() {
    if (!this.currentUser) {
      alert('Please connect your Apex Cloud account first!');
      return;
    }
    this.renderDmFriendsPicker();
    if (this.startDmModal) this.startDmModal.classList.add('active');
  }

  closeStartDmModal() {
    if (this.startDmModal) this.startDmModal.classList.remove('active');
  }

  async renderDmFriendsPicker() {
    const container = document.getElementById('dm-friends-picker-list');
    if (!container) return;

    container.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); text-align: center;">Loading friends...</p>';

    try {
      await this.fetchRegisteredUsers();
      container.innerHTML = '';

      if (this.friendsList.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 20px 0; color: var(--text-muted);">
            <p style="font-size: 13px;">No other friends found yet.</p>
            <p style="font-size: 11px; margin-top: 4px;">Invite your friends to register on Apex Space!</p>
          </div>
        `;
        return;
      }

      this.friendsList.forEach((friend) => {
        const item = document.createElement('div');
        item.className = 'glass-card';
        item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; cursor: pointer; margin-bottom: 8px;';
        
        item.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 30px; height: 30px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">
              ${(friend.displayName || friend.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #fff;">${this.escapeHtml(friend.displayName || 'Friend')}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${this.escapeHtml(friend.email)}</div>
            </div>
          </div>
          <button class="btn-primary" style="width: auto; padding: 6px 12px; font-size: 11px;">Chat 💬</button>
        `;

        item.addEventListener('click', () => this.startDirectChatWithFriend(friend));
        container.appendChild(item);
      });
    } catch (err) {
      console.error('Error loading DM friends:', err);
    }
  }

  async startDirectChatWithFriend(friend) {
    if (!this.currentUser) return;

    try {
      // Check if DM room already exists between these 2 users
      const existing = this.roomsList.find(r => 
        r.type === 'direct' && 
        r.members && 
        r.members.includes(this.currentUser.uid) && 
        r.members.includes(friend.uid)
      );

      if (existing) {
        this.closeStartDmModal();
        this.selectRoom(existing);
        return;
      }

      const myName = this.currentUser.displayName || this.currentUser.email.split('@')[0];
      const friendName = friend.displayName || friend.email.split('@')[0];

      // Create new DM room
      const dmRoom = {
        name: `Chat with ${friendName}`,
        description: `Direct conversation between ${myName} and ${friendName}`,
        type: 'direct',
        icon: friendName.charAt(0).toUpperCase(),
        createdBy: this.currentUser.uid,
        createdByName: myName,
        members: [this.currentUser.uid, friend.uid],
        memberEmails: [this.currentUser.email.toLowerCase(), friend.email.toLowerCase()],
        memberNames: [myName, friendName],
        lastMessage: 'Direct conversation started',
        lastMessageSender: myName,
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await window.fbDb.collection('chat_rooms').add(dmRoom);
      this.closeStartDmModal();
      dmRoom.id = docRef.id;
      this.selectRoom(dmRoom);
    } catch (err) {
      console.error('Failed to start direct chat:', err);
      alert('Could not start direct chat: ' + err.message);
    }
  }

  async fetchRegisteredUsers() {
    if (!window.fbDb || !this.currentUser) return;
    try {
      const snap = await window.fbDb.collection('users').get();
      this.friendsList = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.uid !== this.currentUser.uid) {
          this.friendsList.push(data);
        }
      });
    } catch (err) {
      console.warn('Could not fetch friends list:', err);
    }
  }

  // --- Shared Feed & Notes (Preserved) ---
  startNotesListener() {
    if (!window.fbDb || !this.currentUser) return;
    if (this.unsubscribeNotes) this.unsubscribeNotes();

    const collectionRef = window.fbDb.collection('shared_notes');

    this.unsubscribeNotes = collectionRef.orderBy('createdAt', 'desc').onSnapshot(
      (snapshot) => {
        const notes = [];
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          if (this.isAdmin || this.hasAccessToNote(data)) {
            notes.push(data);
          }
        });
        this.renderNotesFeed(notes);
      },
      (err) => console.error('Shared notes listener error:', err)
    );
  }

  hasAccessToNote(note) {
    if (!this.currentUser) return false;
    const uid = this.currentUser.uid;
    const email = (this.currentUser.email || '').toLowerCase();

    if (note.authorId === uid) return true;
    if (note.sharedWith && note.sharedWith.includes('all')) return true;
    if (note.sharedWith && note.sharedWith.includes(uid)) return true;
    if (note.sharedWithEmails && note.sharedWithEmails.includes(email)) return true;

    return false;
  }

  renderNotesFeed(notes) {
    if (!this.notesFeed) return;
    this.notesFeed.innerHTML = '';

    if (notes.length === 0) {
      this.notesFeed.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <div style="font-size: 40px; margin-bottom: 12px;">📝</div>
          <h4 style="font-size: 16px; font-weight: 600; color: #fff;">No Shared Feed Posts Yet</h4>
          <p style="font-size: 13px; max-width: 400px; margin: 8px auto;">Share notes, photos, formulas, or links with your friends on the feed!</p>
        </div>
      `;
      return;
    }

    notes.forEach((note) => {
      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.marginBottom = '16px';
      card.style.padding = '18px';

      const isAuthor = this.currentUser && note.authorId === this.currentUser.uid;
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
    if (!window.fbDb || !this.currentUser) return;
    if (this.unsubscribeSongs) this.unsubscribeSongs();

    this.unsubscribeSongs = window.fbDb.collection('shared_songs').orderBy('createdAt', 'desc').onSnapshot(
      (snapshot) => {
        const songs = [];
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          if (this.isAdmin || this.hasAccessToNote(data)) {
            songs.push(data);
          }
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

    songs.forEach((song) => {
      const isAuthor = this.currentUser && song.authorId === this.currentUser.uid;
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
    if (!this.currentUser) {
      alert('Please connect your Apex Cloud account first!');
      return;
    }
    if (this.postModal) this.postModal.classList.add('active');
  }

  closePostModal() {
    if (this.postModal) {
      this.postModal.classList.remove('active');
      if (this.postForm) this.postForm.reset();
    }
  }

  async createSharedPost() {
    if (!this.currentUser) return;
    const title = document.getElementById('social-post-title').value.trim();
    const content = document.getElementById('social-post-content').value.trim();

    if (!content) return;

    try {
      await window.fbDb.collection('shared_notes').add({
        title,
        content,
        authorId: this.currentUser.uid,
        authorName: this.currentUser.displayName || this.currentUser.email.split('@')[0],
        authorEmail: this.currentUser.email,
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
