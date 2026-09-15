/**
 * Apex Personal Dashboard - College Notes & Document Reader Module
 * Allows uploading PDFs, Text files, Images, and Markdown notes organized by Subject.
 * Provides an in-app Document Reader (iframe/markdown viewer) with full screen mode support and Enter key save shortcuts.
 */

class NotesModule {
  constructor() {
    this.currentSubjectFilter = 'all';
    this.activeNoteId = null;
    this.activeBlobUrl = null;
    this.isFullscreen = false;

    this.modal = document.getElementById('modal-note');
    this.form = document.getElementById('form-note');
    this.fileInput = document.getElementById('note-file-input');
    this.notesListContainer = document.getElementById('notes-list-container');
    this.readerViewer = document.getElementById('note-reader-viewer');
    this.readerTitle = document.getElementById('note-reader-title');
    this.readerMeta = document.getElementById('note-reader-meta');
    this.readerPlaceholder = document.getElementById('note-reader-placeholder');
    this.fullscreenBtn = document.getElementById('btn-fullscreen-note');
    this.fullscreenIcon = document.getElementById('fullscreen-btn-icon');
    this.fullscreenText = document.getElementById('fullscreen-btn-text');
    this.closeReaderBtn = document.getElementById('btn-close-note-reader');
    this.shrinkBtn = document.getElementById('btn-shrink-fullscreen');

    this.titleInput = document.getElementById('note-title');
    this.subjectInput = document.getElementById('note-subject');
    this.textInput = document.getElementById('note-text-content');

    this.init();
  }

  init() {
    if (!this.notesListContainer) return;

    // Filter Tab Buttons
    document.querySelectorAll('.note-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.note-filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentSubjectFilter = e.target.getAttribute('data-subject');
        this.renderNotesList();
      });
    });

    // Open Modal Trigger
    const openBtn = document.getElementById('btn-open-note-modal');
    if (openBtn) {
      openBtn.addEventListener('click', () => this.openModal());
    }

    document.querySelectorAll('[data-close="modal-note"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    if (this.closeReaderBtn) {
      this.closeReaderBtn.addEventListener('click', () => this.closeReader());
    }

    if (this.shrinkBtn) {
      this.shrinkBtn.addEventListener('click', () => this.toggleFullscreen(false));
    }

    // Escape Key Listener to exit full screen or close reader
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isFullscreen) {
          this.toggleFullscreen(false);
        } else if (this.activeNoteId) {
          this.closeReader();
        }
      }
    });

    // Keyboard Shortcut: Ctrl+Enter / Cmd+Enter inside text area to save note
    if (this.textInput) {
      this.textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.saveNote();
        }
      });
    }

    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveNote();
      });
    }

    this.renderNotesList();
  }

  toggleFullscreen(forceState) {
    const readerCard = document.getElementById('note-reader-card') || (this.readerViewer ? this.readerViewer.closest('.glass-panel') : null);
    if (!readerCard) return;

    this.isFullscreen = typeof forceState === 'boolean' ? forceState : !this.isFullscreen;

    if (this.isFullscreen) {
      readerCard.classList.add('note-reader-fullscreen');
      if (this.fullscreenText) this.fullscreenText.innerText = '🗗 Minimize';
      if (this.fullscreenIcon) this.fullscreenIcon.innerText = '🗗';
      if (this.fullscreenBtn) {
        this.fullscreenBtn.style.background = 'rgba(139,92,246,0.45)';
        this.fullscreenBtn.style.borderColor = '#a78bfa';
        this.fullscreenBtn.style.color = '#ffffff';
        this.fullscreenBtn.title = 'Minimize / Exit Full Screen Mode';
      }
    } else {
      readerCard.classList.remove('note-reader-fullscreen');
      if (this.fullscreenText) this.fullscreenText.innerText = 'Full Screen';
      if (this.fullscreenIcon) this.fullscreenIcon.innerText = '⛶';
      if (this.fullscreenBtn) {
        this.fullscreenBtn.style.background = 'rgba(139,92,246,0.22)';
        this.fullscreenBtn.style.borderColor = 'rgba(139,92,246,0.6)';
        this.fullscreenBtn.style.color = '#c4b5fd';
        this.fullscreenBtn.title = 'Toggle Full Screen View';
      }
    }
  }

  closeReader() {
    this.activeNoteId = null;
    if (this.activeBlobUrl) {
      URL.revokeObjectURL(this.activeBlobUrl);
      this.activeBlobUrl = null;
    }
    if (this.isFullscreen) {
      this.toggleFullscreen(false);
    }
    if (this.readerViewer) {
      this.readerViewer.style.display = 'none';
      this.readerViewer.innerHTML = '';
    }
    if (this.readerPlaceholder) {
      this.readerPlaceholder.style.display = 'flex';
    }
    if (this.readerTitle) {
      this.readerTitle.innerText = 'Select a Note to Read';
    }
    if (this.readerMeta) {
      this.readerMeta.innerText = 'Click any note from your college library on the left';
    }
    if (this.closeReaderBtn) {
      this.closeReaderBtn.style.display = 'none';
    }
  }

  openModal() {
    if (this.modal) this.modal.classList.add('active');
  }

  closeModal() {
    if (this.modal) this.modal.classList.remove('active');
    if (this.form) this.form.reset();
  }

  async saveNote() {
    const title = this.titleInput.value.trim();
    const subject = this.subjectInput.value.trim() || 'General';
    const textContent = this.textInput.value.trim();
    const file = this.fileInput.files[0];

    if (!title) return;

    const noteObj = {
      title,
      subject,
      textContent: textContent || '',
      fileBlob: file || null,
      fileName: file ? file.name : null,
      fileType: file ? file.type : (textContent ? 'text/plain' : 'text/plain'),
      sizeBytes: file ? file.size : (textContent ? textContent.length : 0),
      createdAt: new Date().toISOString()
    };

    try {
      const newId = await window.db.put('notes', noteObj);
      this.closeModal();
      await this.renderNotesList();
      this.viewNote(newId);
    } catch (err) {
      console.error('Failed to save college note:', err);
      alert('Failed to save note to IndexedDB.');
    }
  }

  async viewNote(id) {
    try {
      const note = await window.db.get('notes', id);
      if (!note) return;

      this.activeNoteId = id;

      // Clean up previous blob URL
      if (this.activeBlobUrl) {
        URL.revokeObjectURL(this.activeBlobUrl);
        this.activeBlobUrl = null;
      }

      this.readerTitle.innerText = note.title;
      const formattedDate = new Date(note.createdAt).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric'
      });
      this.readerMeta.innerText = `${note.subject} • ${formattedDate} ${note.fileName ? `• ${note.fileName}` : ''}`;

      this.readerPlaceholder.style.display = 'none';
      this.readerViewer.style.display = 'block';
      this.readerViewer.innerHTML = '';
      if (this.closeReaderBtn) this.closeReaderBtn.style.display = 'inline-flex';

      if (note.fileBlob) {
        this.activeBlobUrl = URL.createObjectURL(note.fileBlob);

        const isPdf = (note.fileType && note.fileType.includes('pdf')) || (note.fileName && /\.pdf$/i.test(note.fileName));
        const isImage = (note.fileType && note.fileType.startsWith('image/')) || (note.fileName && /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(note.fileName));
        const isWord = (note.fileType && (note.fileType.includes('word') || note.fileType.includes('officedocument'))) || (note.fileName && /\.(doc|docx)$/i.test(note.fileName));

        if (isPdf) {
          // Render PDF in iframe
          this.readerViewer.innerHTML = `
            <iframe src="${this.activeBlobUrl}" style="width: 100%; height: 100%; border: none; border-radius: var(--radius-md); background: #ffffff;"></iframe>
          `;
        } else if (isImage) {
          // Render Image Note
          this.readerViewer.innerHTML = `
            <div style="width: 100%; height: 100%; overflow: auto; display: flex; justify-content: center; align-items: center; background: #080808;">
              <img src="${this.activeBlobUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: var(--radius-md);">
            </div>
          `;
        } else if (isWord) {
          // Render Word Document Card
          this.readerViewer.innerHTML = `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px; background: rgba(255,255,255,0.02); border-radius: var(--radius-md);">
              <div style="font-size: 54px; margin-bottom: 16px;">📝</div>
              <h3 style="font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 8px;">${this.escapeHtml(note.fileName || 'Word Document')}</h3>
              <p style="font-size: 13px; color: var(--text-muted); max-width: 400px; margin-bottom: 20px; line-height: 1.5;">
                Microsoft Word document. Download to view in Microsoft Word, WPS Office, or Google Docs.
              </p>
              <a href="${this.activeBlobUrl}" download="${this.escapeHtml(note.fileName || 'document.docx')}" class="btn-primary" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none; padding: 12px 24px; font-weight: 700; border-radius: var(--radius-md);">
                <span>⬇️ Download Word Document</span>
              </a>
            </div>
          `;
        } else {
          // Read File as Text
          try {
            const text = await note.fileBlob.text();
            this.readerViewer.innerHTML = `
              <div class="markdown-body" style="padding: 20px; overflow-y: auto; height: 100%;">
                <pre><code>${this.escapeHtml(text)}</code></pre>
              </div>
            `;
          } catch (readErr) {
            this.readerViewer.innerHTML = `
              <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <div style="font-size: 40px; margin-bottom: 12px;">📁</div>
                <h4>${this.escapeHtml(note.fileName || 'Document')}</h4>
                <a href="${this.activeBlobUrl}" download="${this.escapeHtml(note.fileName || 'file')}" class="btn-primary" style="display: inline-block; margin-top: 14px; text-decoration: none; padding: 10px 20px;">⬇️ Download File</a>
              </div>
            `;
          }
        }
      } else if (note.textContent) {
        // Render Text / Markdown content directly
        this.readerViewer.innerHTML = `
          <div class="markdown-body" style="padding: 20px; overflow-y: auto; height: 100%;">
            ${this.parseSimpleMarkdown(note.textContent)}
          </div>
        `;
      } else {
        this.readerViewer.innerHTML = `<p style="padding: 20px; color: var(--text-muted);">No document content found.</p>`;
      }

      this.renderNotesListHighlight();
    } catch (err) {
      console.error('Error viewing note:', err);
    }
  }

  async deleteNote(id, e) {
    if (e) e.stopPropagation();
    if (!confirm('Delete this college note?')) return;

    try {
      if (this.activeNoteId === id) {
        this.readerViewer.style.display = 'none';
        this.readerPlaceholder.style.display = 'flex';
        this.readerTitle.innerText = 'Select a Note to Read';
        this.readerMeta.innerText = 'Click any note from your college library on the left';
        this.activeNoteId = null;
      }
      await window.db.delete('notes', id);
      this.renderNotesList();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }

  async renderNotesList() {
    try {
      const notes = await window.db.getAll('notes');
      notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const filtered = this.currentSubjectFilter === 'all'
        ? notes
        : notes.filter(n => (n.subject || '').toLowerCase() === this.currentSubjectFilter.toLowerCase());

      this.notesListContainer.innerHTML = '';

      if (filtered.length === 0) {
        this.notesListContainer.innerHTML = `
          <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
            <p>No college notes uploaded yet.</p>
            <p style="font-size: 12px; margin-top: 6px;">Click <strong>+ Upload / Add Note</strong> to build your subjects library!</p>
          </div>
        `;
        return;
      }

      for (const item of filtered) {
        const isSelected = item.id === this.activeNoteId;
        const div = document.createElement('div');
        div.className = `glass-card ${isSelected ? 'active' : ''}`;
        div.style.cursor = 'pointer';
        div.style.marginBottom = '10px';
        if (isSelected) {
          div.style.borderColor = '#ffffff';
          div.style.background = 'rgba(40, 40, 40, 0.85)';
        }

        const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
          month: 'short', day: 'numeric'
        });

        const icon = item.fileName && item.fileName.endsWith('.pdf') ? '📄' : '📝';

        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div style="font-weight: 600; font-size: 14px; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
              ${icon} ${this.escapeHtml(item.title)}
            </div>
            <button class="btn-ghost delete-note-btn" style="padding: 2px 6px; font-size: 10px; color: var(--accent-red); border-color: rgba(255,77,77,0.2);">✕</button>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted);">
            <span class="badge badge-college" style="font-size: 9px; padding: 2px 6px;">${this.escapeHtml(item.subject)}</span>
            <span>📅 ${formattedDate}</span>
          </div>
        `;

        div.addEventListener('click', () => this.viewNote(item.id));

        const delBtn = div.querySelector('.delete-note-btn');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => this.deleteNote(item.id, e));
        }

        this.notesListContainer.appendChild(div);
      }
    } catch (err) {
      console.error('Error rendering notes list:', err);
    }
  }

  renderNotesListHighlight() {
    this.renderNotesList();
  }

  parseSimpleMarkdown(text) {
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

window.notesModule = new NotesModule();
