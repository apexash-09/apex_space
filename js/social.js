/**
 * Apex Personal Dashboard - Social Space & Cloud Collaboration Module
 * Realtime Firestore notes, comments, emoji reactions, shared music hub, and Admin moderation.
 */

class SocialModule {
  constructor() {
    this.currentUser = null;
    this.isAdmin = false;
    this.activeTab = 'notes'; // 'notes' | 'music' | 'admin_users'
    this.unsubscribeNotes = null;
    this.unsubscribeSongs = null;
    this.commentListeners = new Map(); // noteId -> unsubscribe function
    this.friendsList = [];

    // DOM Elements
    this.socialView = document.getElementById('view-social');
    this.notesFeed = document.getElementById('social-notes-feed');
    this.sharedSongsFeed = document.getElementById('social-songs-feed');
    this.adminUsersView = document.getElementById('social-admin-users-view');
    this.adminTabBtn = document.getElementById('btn-social-tab-admin');
    this.authNotice = document.getElementById('social-auth-notice');
    this.socialMainContent = document.getElementById('social-main-content');

    this.postModal = document.getElementById('modal-social-post');
    this.postForm = document.getElementById('form-social-post');
    this.postFileInput = document.getElementById('social-post-file');
    this.postAudienceSelect = document.getElementById('social-post-audience');
    this.postCustomEmailInput = document.getElementById('social-post-custom-email');

    this.init();
  }

  init() {
    // 1. Listen for Auth State Changes
    window.addEventListener('apex-auth-changed', (e) => {
      this.currentUser = e.detail.user;
      this.isAdmin = e.detail.isAdmin;
      this.handleAuthUpdate();
    });

    // 2. Tab Switchers (Shared Notes / Shared Music / Admin Users)
    document.querySelectorAll('.social-nav-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-social-tab');
        this.switchSocialTab(tab);
      });
    });

    // 3. Post Modal Triggers
    const btnOpenPostModal = document.getElementById('btn-open-social-post-modal');
    if (btnOpenPostModal) {
      btnOpenPostModal.addEventListener('click', () => this.openPostModal());
    }

    document.querySelectorAll('[data-close="modal-social-post"]').forEach((btn) => {
      btn.addEventListener('click', () => this.closePostModal());
    });

    // 4. Post Audience Dropdown Change
    if (this.postAudienceSelect && this.postCustomEmailInput) {
      this.postAudienceSelect.addEventListener('change', (e) => {
        this.postCustomEmailInput.style.display = e.target.value === 'custom' ? 'block' : 'none';
      });
    }

    // 5. Post Form Submit
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

    if (this.notesFeed) this.notesFeed.style.display = tab === 'notes' ? 'block' : 'none';
    if (this.sharedSongsFeed) this.sharedSongsFeed.style.display = tab === 'music' ? 'block' : 'none';
    if (this.adminUsersView) {
      this.adminUsersView.style.display = tab === 'admin_users' ? 'block' : 'none';
      if (tab === 'admin_users') this.renderAdminUsersList();
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
      this.updateAudienceDropdown();
    } catch (err) {
      console.warn('Could not fetch friends list:', err);
    }
  }

  updateAudienceDropdown() {
    if (!this.postAudienceSelect) return;
    const currentVal = this.postAudienceSelect.value;

    this.postAudienceSelect.innerHTML = `
      <option value="all">🌐 All Friends (Shared Space)</option>
      <option value="custom">✉️ Specific Friend by Email...</option>
    `;

    if (this.friendsList.length > 0) {
      const group = document.createElement('optgroup');
      group.label = 'Registered Friends';
      this.friendsList.forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.uid;
        opt.innerText = `👤 ${f.displayName || f.email} (${f.email})`;
        group.appendChild(opt);
      });
      this.postAudienceSelect.appendChild(group);
    }

    this.postAudienceSelect.value = currentVal || 'all';
  }

  // --- Realtime Firestore Notes Listener ---
  startNotesListener() {
    if (!window.fbDb || !this.currentUser) return;
    if (this.unsubscribeNotes) this.unsubscribeNotes();

    const collectionRef = window.fbDb.collection('shared_notes');

    // Admin can see everything, regular friends see public + their direct shares
    this.unsubscribeNotes = collectionRef.orderBy('createdAt', 'desc').onSnapshot(
      (snapshot) => {
        const notes = [];
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          // Client-side filter for fine-grained privacy if non-admin
          if (this.isAdmin || this.hasAccessToNote(data)) {
            notes.push(data);
          }
        });
        this.renderNotesFeed(notes);
      },
      (err) => {
        console.error('Realtime shared notes error:', err);
      }
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
          <div style="font-size: 40px; margin-bottom: 12px;">💬</div>
          <h4 style="font-size: 16px; font-weight: 600; color: #fff;">No Shared Notes Yet</h4>
          <p style="font-size: 13px; max-width: 400px; margin: 8px auto;">Be the first to share a note, photo, formula, or link with your friends!</p>
        </div>
      `;
      return;
    }

    notes.forEach((note) => {
      const card = this.createNoteCardElement(note);
      this.notesFeed.appendChild(card);
    });
  }

  createNoteCardElement(note) {
    const isAuthor = this.currentUser && note.authorId === this.currentUser.uid;
    const canDelete = isAuthor || this.isAdmin;
    const dateFormatted = note.createdAt && note.createdAt.toDate
      ? note.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const card = document.createElement('div');
    card.className = 'glass-card social-post-card';
    card.style.marginBottom = '20px';
    card.style.padding = '20px';
    card.setAttribute('data-note-id', note.id);

    // Calculate active user reactions
    const reactions = note.reactions || {};
    const userReaction = this.currentUser ? reactions[this.currentUser.uid] : null;

    // Reaction counts
    const reactionCounts = { '❤️': 0, '🔥': 0, '👏': 0, '💡': 0, '🚀': 0 };
    Object.values(reactions).forEach((emoji) => {
      if (reactionCounts[emoji] !== undefined) reactionCounts[emoji]++;
    });

    const isDirectShare = note.sharedWith && !note.sharedWith.includes('all');

    card.innerHTML = `
      <!-- Card Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">
            ${(note.authorName || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-size: 14px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 6px;">
              <span>${this.escapeHtml(note.authorName || 'Friend')}</span>
              ${note.authorEmail === window.ADMIN_EMAIL ? '<span class="badge badge-project" style="font-size: 9px; padding: 2px 6px; background: #fff; color: #000; font-weight: 800;">ADMIN</span>' : ''}
              ${isDirectShare ? '<span class="badge badge-misc" style="font-size: 9px; padding: 2px 6px;">🔒 Direct Share</span>' : '<span class="badge badge-college" style="font-size: 9px; padding: 2px 6px;">🌐 Shared</span>'}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${dateFormatted}</div>
          </div>
        </div>
        ${canDelete ? `<button class="btn-ghost btn-delete-note" style="padding: 4px 8px; font-size: 11px; color: var(--accent-red); border-color: rgba(255,77,77,0.25);" title="Delete Post">${this.isAdmin && !isAuthor ? '🛡️ Moderate Delete' : '✕ Delete'}</button>` : ''}
      </div>

      <!-- Card Title & Content -->
      ${note.title ? `<h3 style="font-size: 17px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">${this.escapeHtml(note.title)}</h3>` : ''}
      <div class="markdown-body" style="font-size: 14px; line-height: 1.6; margin-bottom: 14px; color: var(--text-main);">
        ${this.formatPostContent(note.content)}
      </div>

      <!-- Media Attachment if Image / URL -->
      ${note.mediaUrl ? `
        <div style="margin-bottom: 14px; border-radius: var(--radius-md); overflow: hidden; max-height: 400px; background: #000; border: 1px solid var(--border-subtle);">
          ${note.type === 'image' ? `<img src="${note.mediaUrl}" style="width: 100%; height: auto; max-height: 400px; object-fit: contain; display: block;" loading="lazy">` : `<a href="${note.mediaUrl}" target="_blank" rel="noopener" style="display: flex; align-items: center; gap: 8px; padding: 12px; color: #ffffff; text-decoration: underline;">🔗 ${this.escapeHtml(note.mediaUrl)}</a>`}
        </div>
      ` : ''}

      <!-- Reactions & Comments Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 10px;">
        
        <!-- Reaction Emojis -->
        <div class="reactions-picker" style="display: flex; gap: 6px; align-items: center;">
          ${['❤️', '🔥', '👏', '💡', '🚀'].map((emoji) => {
            const count = reactionCounts[emoji];
            const isSelected = userReaction === emoji;
            return `
              <button class="btn-ghost btn-reaction ${isSelected ? 'active' : ''}" data-emoji="${emoji}" style="padding: 4px 8px; font-size: 13px; border-radius: 16px; ${isSelected ? 'background: rgba(255,255,255,0.25); border-color: #fff; color: #fff;' : ''}">
                <span>${emoji}</span>
                ${count > 0 ? `<span style="font-size: 11px; margin-left: 4px; font-weight: 600;">${count}</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Comments Toggle Button -->
        <button class="btn-ghost btn-toggle-comments" style="padding: 4px 12px; font-size: 12px; border-radius: 16px;">
          💬 Comments
        </button>
      </div>

      <!-- Comments Thread Container (Expandable) -->
      <div class="comments-thread-wrapper" style="display: none; margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--border-subtle);">
        <div class="comments-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; max-height: 260px; overflow-y: auto;">
          <p style="font-size: 12px; color: var(--text-muted); text-align: center;">Loading comments...</p>
        </div>
        <form class="form-add-comment" style="display: flex; gap: 8px;">
          <input type="text" class="form-control comment-input" placeholder="Write a comment..." required style="padding: 8px 12px; font-size: 13px;">
          <button type="submit" class="btn-primary" style="width: auto; padding: 8px 16px; font-size: 13px;">Send</button>
        </form>
      </div>
    `;

    // Event: Delete Note
    const delBtn = card.querySelector('.btn-delete-note');
    if (delBtn) {
      delBtn.addEventListener('click', () => this.deleteSharedNote(note.id));
    }

    // Event: Reactions
    card.querySelectorAll('.btn-reaction').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const emoji = e.currentTarget.getAttribute('data-emoji');
        this.toggleReaction(note.id, emoji, userReaction);
      });
    });

    // Event: Comments Toggle
    const commentsToggleBtn = card.querySelector('.btn-toggle-comments');
    const commentsWrapper = card.querySelector('.comments-thread-wrapper');
    const commentsList = card.querySelector('.comments-list');
    const commentForm = card.querySelector('.form-add-comment');

    if (commentsToggleBtn && commentsWrapper) {
      commentsToggleBtn.addEventListener('click', () => {
        const isHidden = commentsWrapper.style.display === 'none';
        commentsWrapper.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          this.listenToComments(note.id, commentsList);
        }
      });
    }

    // Event: Submit Comment
    if (commentForm) {
      commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = commentForm.querySelector('.comment-input');
        const text = input.value.trim();
        if (!text || !this.currentUser) return;

        try {
          input.value = '';
          await window.fbDb.collection('shared_notes').doc(note.id).collection('comments').add({
            text: text,
            authorId: this.currentUser.uid,
            authorName: this.currentUser.displayName || this.currentUser.email.split('@')[0],
            authorEmail: this.currentUser.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch (err) {
          console.error('Error posting comment:', err);
          alert('Could not post comment.');
        }
      });
    }

    return card;
  }

  listenToComments(noteId, containerEl) {
    if (this.commentListeners.has(noteId)) return;

    const commentsRef = window.fbDb
      .collection('shared_notes')
      .doc(noteId)
      .collection('comments')
      .orderBy('createdAt', 'asc');

    const unsubscribe = commentsRef.onSnapshot((snapshot) => {
      containerEl.innerHTML = '';
      if (snapshot.empty) {
        containerEl.innerHTML = `<p style="font-size: 12px; color: var(--text-muted); text-align: center;">No comments yet. Start the conversation!</p>`;
        return;
      }

      snapshot.forEach((doc) => {
        const c = { id: doc.id, ...doc.data() };
        const isCommentAuthor = this.currentUser && c.authorId === this.currentUser.uid;
        const canDelete = isCommentAuthor || this.isAdmin;

        const commentDiv = document.createElement('div');
        commentDiv.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 13px;';
        commentDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 600; color: #fff; font-size: 12px;">${this.escapeHtml(c.authorName || 'Friend')} ${c.authorEmail === window.ADMIN_EMAIL ? '<span class="badge badge-project" style="font-size: 8px; padding: 1px 4px;">ADMIN</span>' : ''}</span>
            ${canDelete ? `<button class="btn-delete-comment btn-ghost" style="padding: 1px 4px; font-size: 10px; color: var(--accent-red);">✕</button>` : ''}
          </div>
          <p style="color: var(--text-main); margin: 0; line-height: 1.4;">${this.escapeHtml(c.text)}</p>
        `;

        const delBtn = commentDiv.querySelector('.btn-delete-comment');
        if (delBtn) {
          delBtn.addEventListener('click', async () => {
            if (!confirm('Delete comment?')) return;
            try {
              await window.fbDb.collection('shared_notes').doc(noteId).collection('comments').doc(c.id).delete();
            } catch (err) {
              console.error('Failed to delete comment:', err);
            }
          });
        }

        containerEl.appendChild(commentDiv);
      });
    });

    this.commentListeners.set(noteId, unsubscribe);
  }

  async toggleReaction(noteId, emoji, currentReaction) {
    if (!this.currentUser) {
      alert('Please connect your Apex Cloud account to react!');
      return;
    }

    try {
      const noteRef = window.fbDb.collection('shared_notes').doc(noteId);
      const updateObj = {};

      if (currentReaction === emoji) {
        // Remove reaction
        updateObj[`reactions.${this.currentUser.uid}`] = firebase.firestore.FieldValue.delete();
      } else {
        // Set new reaction
        updateObj[`reactions.${this.currentUser.uid}`] = emoji;
      }

      await noteRef.update(updateObj);
    } catch (err) {
      console.error('Failed to update reaction:', err);
    }
  }

  async createSharedPost() {
    if (!this.currentUser) {
      alert('Please sign in first.');
      return;
    }

    const title = document.getElementById('social-post-title').value.trim();
    const content = document.getElementById('social-post-content').value.trim();
    const audience = this.postAudienceSelect.value;
    const customEmail = this.postCustomEmailInput.value.trim().toLowerCase();
    const file = this.postFileInput.files[0];
    const submitBtn = this.postForm.querySelector('button[type="submit"]');

    if (!content && !file) {
      alert('Please add some text or attach an image.');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Sharing with Friends...';

      let mediaUrl = '';
      let type = 'text';

      // 1. Upload attached media if present
      if (file) {
        type = 'image';
        const fileExt = file.name.split('.').pop();
        const storagePath = `shared_media/${this.currentUser.uid}/${Date.now()}_media.${fileExt}`;
        const storageRef = window.fbStorage.ref(storagePath);
        const snapshot = await storageRef.put(file);
        mediaUrl = await snapshot.ref.getDownloadURL();
      }

      // 2. Audience array
      let sharedWith = ['all'];
      let sharedWithEmails = ['all'];

      if (audience === 'custom' && customEmail) {
        sharedWith = [];
        sharedWithEmails = [customEmail];
      } else if (audience !== 'all') {
        sharedWith = [audience];
        const targetFriend = this.friendsList.find((f) => f.uid === audience);
        if (targetFriend && targetFriend.email) {
          sharedWithEmails = [targetFriend.email.toLowerCase()];
        }
      }

      // 3. Save to Firestore
      const newPost = {
        title: title || '',
        content: content || '',
        type: type,
        mediaUrl: mediaUrl,
        authorId: this.currentUser.uid,
        authorName: this.currentUser.displayName || this.currentUser.email.split('@')[0],
        authorEmail: this.currentUser.email,
        sharedWith: sharedWith,
        sharedWithEmails: sharedWithEmails,
        reactions: {},
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      await window.fbDb.collection('shared_notes').add(newPost);

      this.closePostModal();
    } catch (err) {
      console.error('Failed to create shared post:', err);
      alert('Failed to post: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Share with Friends';
    }
  }

  async deleteSharedNote(noteId) {
    if (!confirm('Are you sure you want to delete this shared note?')) return;
    try {
      await window.fbDb.collection('shared_notes').doc(noteId).delete();
    } catch (err) {
      console.error('Failed to delete note:', err);
      alert('Could not delete note: ' + err.message);
    }
  }

  // --- Realtime Shared Songs Listener ---
  startSharedSongsListener() {
    if (!window.fbDb || !this.currentUser) return;
    if (this.unsubscribeSongs) this.unsubscribeSongs();

    const collectionRef = window.fbDb.collection('shared_songs');

    this.unsubscribeSongs = collectionRef.orderBy('createdAt', 'desc').onSnapshot(
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
      (err) => {
        console.error('Realtime shared songs error:', err);
      }
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
          <p style="font-size: 13px; max-width: 400px; margin: 8px auto;">Go to your local <strong>Songs & Audio</strong> tab and click <strong>📤 Share</strong> on any track to share music with friends!</p>
        </div>
      `;
      return;
    }

    songs.forEach((song) => {
      const isAuthor = this.currentUser && song.authorId === this.currentUser.uid;
      const canDelete = isAuthor || this.isAdmin;
      const dateFormatted = song.createdAt && song.createdAt.toDate
        ? song.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'Recently';

      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.marginBottom = '16px';
      card.style.padding = '18px';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #ffffff; color: #000; display: flex; align-items: center; justify-content: center; font-size: 18px;">
              🎵
            </div>
            <div>
              <div style="font-size: 15px; font-weight: 700; color: #fff;">${this.escapeHtml(song.title)}</div>
              <div style="font-size: 12px; color: var(--text-muted);">Shared by ${this.escapeHtml(song.authorName || 'Friend')} • ${dateFormatted}</div>
            </div>
          </div>
          ${canDelete ? `<button class="btn-ghost btn-delete-shared-song" style="padding: 4px 8px; font-size: 11px; color: var(--accent-red);">${this.isAdmin && !isAuthor ? '🛡️ Moderate Delete' : '✕ Delete'}</button>` : ''}
        </div>

        <!-- In-app Audio Player -->
        <audio controls src="${song.audioUrl}" style="width: 100%; margin-top: 8px; height: 36px; border-radius: var(--radius-sm);"></audio>
      `;

      const delBtn = card.querySelector('.btn-delete-shared-song');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          if (!confirm('Delete shared song?')) return;
          try {
            await window.fbDb.collection('shared_songs').doc(song.id).delete();
            if (song.storagePath) {
              const fileRef = window.fbStorage.ref(song.storagePath);
              await fileRef.delete().catch(() => {});
            }
          } catch (err) {
            console.error('Failed to delete shared song:', err);
          }
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
          <h3 style="font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">🛡️ Administrator Dashboard (${snap.size} Registered Users)</h3>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">As Administrator (${window.ADMIN_EMAIL}), you have full moderation privileges to view and manage shared social content across all friends.</p>
          
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
      this.adminUsersView.innerHTML = `<p style="color: var(--accent-red); padding: 20px;">Could not load users: ${err.message}</p>`;
    }
  }

  openPostModal() {
    if (!this.currentUser) {
      alert('Please connect your Apex Cloud account first!');
      if (window.authManager) window.authManager.openAuthModal();
      return;
    }
    this.updateAudienceDropdown();
    if (this.postModal) this.postModal.classList.add('active');
  }

  closePostModal() {
    if (this.postModal) {
      this.postModal.classList.remove('active');
      if (this.postForm) this.postForm.reset();
      if (this.postCustomEmailInput) this.postCustomEmailInput.style.display = 'none';
    }
  }

  stopListeners() {
    if (this.unsubscribeNotes) {
      this.unsubscribeNotes();
      this.unsubscribeNotes = null;
    }
    if (this.unsubscribeSongs) {
      this.unsubscribeSongs();
      this.unsubscribeSongs = null;
    }
    this.commentListeners.forEach((unsub) => unsub());
    this.commentListeners.clear();
  }

  formatPostContent(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);
    html = html.replace(/\n/g, '<br>');
    return `<p>${html}</p>`;
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

window.socialModule = new SocialModule();
