/**
 * Apex Personal Dashboard - Library Module
 * - Digital Textbooks (original)
 * - Notes & Papers Hub: upload notes/QPs to Cloudinary, metadata in Firestore, domain-scoped
 *
 * Uses Firebase Compat SDK (window.fbDb / window.fbAuth)
 */

const CLOUDINARY_CLOUD = 'w5awgbnp';
const CLOUDINARY_PRESET = 'apex_space';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`;

class LibraryModule {
  constructor() {
    this.savedBooks = new Set();
    this.books = [
      { id: 'b1', title: 'Clean Code: A Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin', category: 'Computer Science', price: 599, priceLabel: '₹599', isFreePdf: false, url: 'https://openlibrary.org/' },
      { id: 'b2', title: 'Introduction to Algorithms (CLRS 4th Ed)', author: 'Cormen, Leiserson, Rivest', category: 'Algorithms', price: 899, priceLabel: '₹899', isFreePdf: false, url: 'https://openlibrary.org/' },
      { id: 'b3', title: 'Operating System Concepts (Silberschatz)', author: 'Silberschatz, Galvin, Gagne', category: 'Computer Science', price: 0, priceLabel: 'FREE Open Access', isFreePdf: true, url: 'https://openlibrary.org/' },
      { id: 'b4', title: 'Design Patterns: Elements of Reusable Object-Oriented Software', author: 'Gang of Four (GoF)', category: 'Software Design', price: 650, priceLabel: '₹650', isFreePdf: false, url: 'https://openlibrary.org/' },
      { id: 'b5', title: 'Calculus & Analytical Geometry', author: 'George B. Thomas', category: 'Mathematics', price: 0, priceLabel: 'FREE Open Access', isFreePdf: true, url: 'https://openlibrary.org/' },
      { id: 'b6', title: 'University Physics with Modern Physics', author: 'Sears & Zemansky', category: 'Physics', price: 0, priceLabel: 'FREE Open Access', isFreePdf: true, url: 'https://openlibrary.org/' }
    ];

    // Hub state
    this.hubUploads = [];
    this.hubFilterType = 'all';
    this.hubFilterSem = 'all';
    this.hubUnsubscribe = null;

    this.init();
  }

  // ─────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────
  init() {
    this.renderLibrary();
    this.bindHubEvents();
  }

  // ─────────────────────────────────────────────
  // Sub-tab switching
  // ─────────────────────────────────────────────
  switchLibTab(tab) {
    const booksPanel = document.getElementById('lib-panel-books');
    const hubPanel = document.getElementById('lib-panel-hub');
    const booksBtn = document.getElementById('lib-tab-books');
    const hubBtn = document.getElementById('lib-tab-hub');

    if (tab === 'books') {
      if (booksPanel) booksPanel.style.display = 'block';
      if (hubPanel) hubPanel.style.display = 'none';
      booksBtn?.classList.add('active');
      hubBtn?.classList.remove('active');
    } else {
      if (booksPanel) booksPanel.style.display = 'none';
      if (hubPanel) hubPanel.style.display = 'block';
      booksBtn?.classList.remove('active');
      hubBtn?.classList.add('active');
      this.initHub();
    }
  }

  // ─────────────────────────────────────────────
  // Helper: verified college domain
  // ─────────────────────────────────────────────
  getVerifiedDomain() {
    const email = localStorage.getItem('apex_college_email');
    if (!email || !email.includes('@')) return null;
    return email.split('@')[1].toLowerCase();
  }

  // ─────────────────────────────────────────────
  // TEXTBOOK SECTION (original)
  // ─────────────────────────────────────────────
  async saveToBuyList(book) {
    if (!window.db) return;
    try {
      const itemObj = {
        name: `📖 Book: ${book.title} (${book.author})`,
        price: book.price,
        saved: 0,
        status: book.price === 0 ? 'bought' : 'saving',
        createdAt: new Date().toISOString()
      };
      await window.db.put('buylist', itemObj);
      this.savedBooks.add(book.id);
      this.renderLibrary();
      if (window.buyListModule) window.buyListModule.renderBuyList();
      this.toast(`Added "${book.title}" to Buy List 🛒!`, 'success');
    } catch (err) {
      console.error('Error adding book to buy list:', err);
    }
  }

  renderLibrary() {
    const container = document.getElementById('library-books-grid');
    if (!container) return;
    container.innerHTML = this.books.map(book => {
      const isSaved = this.savedBooks.has(book.id);
      return `
        <div class="glass-panel" style="padding: 20px; border-radius: var(--radius-card); display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--border-subtle); transition: var(--transition-smooth);">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 11px; padding: 4px 12px; border-radius: 20px; background: rgba(255,255,255,0.08); color: var(--text-muted); font-weight: 600;">${book.category}</span>
              <span style="font-size: 12px; font-weight: 800; color: ${book.isFreePdf ? '#34d399' : '#ffffff'};">${book.priceLabel}</span>
            </div>
            <div style="font-size: 32px; margin-bottom: 8px; text-align: center;">📖</div>
            <h3 style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 4px; line-height: 1.4; text-align: center;">${book.title}</h3>
            <p style="font-size: 12px; color: var(--text-muted); text-align: center; margin-bottom: 14px;">by ${book.author}</p>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 12px;">
            <a href="${book.url}" target="_blank" class="btn-ghost" style="flex: 1; text-align: center; text-decoration: none; padding: 10px 14px; font-size: 11px; font-weight: 600; border-radius: var(--radius-pill);">Open Book</a>
            <button onclick="window.libraryModule.saveToBuyList(window.libraryModule.books.find(b => b.id === '${book.id}'))" class="${isSaved ? 'btn-ghost' : 'btn-primary'}" style="flex: 1; padding: 10px 14px; font-size: 11px; justify-content: center; border-radius: var(--radius-pill); ${isSaved ? 'color:#34d399; border-color:rgba(52,211,153,0.4);' : ''}">
              ${isSaved ? '✅ Saved' : '🛒 Buy List'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ─────────────────────────────────────────────
  // HUB: Bind events
  // ─────────────────────────────────────────────
  bindHubEvents() {
    // Upload button
    document.getElementById('btn-hub-upload')?.addEventListener('click', () => {
      if (!this.getVerifiedDomain()) {
        this.toast('Please verify your college email first (Profile → College Email).', 'error');
        return;
      }
      document.getElementById('modal-hub-upload')?.classList.add('active');
    });

    // Close modal
    document.getElementById('btn-hub-upload-close')?.addEventListener('click', () => this.closeUploadModal());
    document.getElementById('modal-hub-upload')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-hub-upload') this.closeUploadModal();
    });

    // Type toggle in modal
    document.querySelectorAll('.hub-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.hub-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const yearRow = document.getElementById('hub-year-row');
        if (yearRow) yearRow.style.display = btn.dataset.type === 'qpaper' ? 'block' : 'none';
      });
    });

    // Drop zone
    const dropZone = document.getElementById('hub-drop-zone');
    const fileInput = document.getElementById('hub-file-input');
    if (dropZone && fileInput) {
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent-white)'; });
      dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border-subtle)'; });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-subtle)';
        if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; this.updateDropLabel(e.dataTransfer.files[0].name); }
      });
      fileInput.addEventListener('change', () => { if (fileInput.files[0]) this.updateDropLabel(fileInput.files[0].name); });
    }

    // Submit
    document.getElementById('form-hub-upload')?.addEventListener('submit', (e) => { e.preventDefault(); this.handleUpload(); });

    // Type filter chips
    document.querySelectorAll('.hub-filter-type').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.hub-filter-type').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.hubFilterType = btn.dataset.type;
        this.renderHubGrid();
      });
    });

    // Sem filter chips
    document.querySelectorAll('.hub-filter-sem').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.hub-filter-sem').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.hubFilterSem = btn.dataset.sem;
        this.renderHubGrid();
      });
    });
  }

  updateDropLabel(name) {
    const label = document.getElementById('hub-drop-label');
    if (label) label.innerHTML = `<span style="font-size:22px;">📎</span><br><strong style="color:var(--text-main);">${name}</strong>`;
  }

  closeUploadModal() {
    document.getElementById('modal-hub-upload')?.classList.remove('active');
    document.getElementById('form-hub-upload')?.reset();
    const label = document.getElementById('hub-drop-label');
    if (label) label.innerHTML = `<span style="font-size:28px;">📂</span><br>Click or drag &amp; drop your file here<br><span style="font-size:11px; color:var(--text-dim);">PDF, JPG, PNG — max 25MB</span>`;
    document.getElementById('hub-year-row')?.style && (document.getElementById('hub-year-row').style.display = 'none');
    document.querySelectorAll('.hub-type-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  }

  // ─────────────────────────────────────────────
  // HUB: Subscribe to Firestore (real-time)
  // ─────────────────────────────────────────────
  initHub() {
    const domain = this.getVerifiedDomain();
    const hubSection = document.getElementById('hub-section');
    const hubGate = document.getElementById('hub-gate');

    if (!domain) {
      if (hubSection) hubSection.style.display = 'none';
      if (hubGate) hubGate.style.display = 'flex';
      return;
    }

    if (hubSection) hubSection.style.display = 'block';
    if (hubGate) hubGate.style.display = 'none';

    const badge = document.getElementById('hub-domain-badge');
    if (badge) badge.textContent = `@${domain}`;

    if (!window.fbDb) return;
    if (this.hubUnsubscribe) this.hubUnsubscribe();

    this.hubUnsubscribe = window.fbDb
      .collection('library_uploads')
      .where('domain', '==', domain)
      .orderBy('uploadedAt', 'desc')
      .onSnapshot(
        (snap) => {
          this.hubUploads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          this.renderHubGrid();
        },
        (err) => console.error('Hub snapshot error:', err)
      );
  }

  // ─────────────────────────────────────────────
  // HUB: Render grid
  // ─────────────────────────────────────────────
  renderHubGrid() {
    const grid = document.getElementById('hub-uploads-grid');
    const empty = document.getElementById('hub-empty');
    if (!grid) return;

    let filtered = [...this.hubUploads];
    if (this.hubFilterType !== 'all') filtered = filtered.filter(u => u.type === this.hubFilterType);
    if (this.hubFilterSem !== 'all') filtered = filtered.filter(u => String(u.semester) === this.hubFilterSem);

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (empty) empty.style.display = 'none';

    const currentUid = window.fbAuth?.currentUser?.uid;

    grid.innerHTML = filtered.map(u => {
      const date = u.uploadedAt?.toDate
        ? u.uploadedAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Just now';
      const icon = u.type === 'qpaper' ? '📝' : '📄';
      const typeLabel = u.type === 'qpaper' ? 'Question Paper' : 'Notes';
      const typeBg = u.type === 'qpaper' ? 'rgba(251,191,36,0.12)' : 'rgba(99,179,237,0.12)';
      const typeColor = u.type === 'qpaper' ? '#fbbf24' : '#63b3ed';
      const isOwner = currentUid && u.uploaderUid === currentUid;
      const ext = (u.fileName || 'FILE').split('.').pop().toUpperCase().slice(0, 5);

      return `
        <div class="glass-panel" style="padding:0; overflow:hidden; display:flex; flex-direction:column; transition:var(--transition-smooth);">
          <div style="padding:16px 18px 12px; flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; gap:6px;">
              <span style="font-size:10px; font-weight:700; padding:3px 10px; border-radius:20px; background:${typeBg}; color:${typeColor}; letter-spacing:0.4px; white-space:nowrap;">${typeLabel.toUpperCase()}</span>
              <span style="font-size:10px; color:var(--text-muted); background:rgba(255,255,255,0.06); padding:3px 8px; border-radius:8px; font-weight:600; white-space:nowrap;">SEM ${u.semester}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
              <span style="font-size:26px; flex-shrink:0;">${icon}</span>
              <div style="flex:1; min-width:0;">
                <h4 style="font-size:13px; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px;" title="${u.title}">${u.title}</h4>
                <p style="font-size:11px; color:var(--text-muted);">${u.subject}${u.year ? ' · ' + u.year : ''}</p>
              </div>
              <span style="font-size:9px; font-weight:800; color:var(--text-dim); background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:5px; flex-shrink:0;">${ext}</span>
            </div>
            <p style="font-size:11px; color:var(--text-dim);">by <span style="color:var(--text-muted); font-weight:600;">${u.uploaderName || 'Anonymous'}</span> · ${date}</p>
          </div>
          <div style="display:flex; border-top:1px solid var(--border-subtle);">
            <a href="${u.downloadUrl}" target="_blank" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:11px; font-size:12px; font-weight:700; color:var(--accent-white); text-decoration:none; cursor:pointer; transition:background 0.2s; border-radius:0 0 0 var(--radius-lg);" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='none'">
              ⬇ Download
            </a>
            ${isOwner ? `<button onclick="window.libraryModule.deleteUpload('${u.id}')" style="border:none; background:none; border-left:1px solid var(--border-subtle); padding:11px 16px; color:#ff6b6b; font-size:13px; cursor:pointer; transition:background 0.2s; border-radius:0 0 var(--radius-lg) 0;" onmouseover="this.style.background='rgba(239,68,68,0.08)'" onmouseout="this.style.background='none'" title="Delete">🗑</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ─────────────────────────────────────────────
  // HUB: Upload
  // ─────────────────────────────────────────────
  async handleUpload() {
    const domain = this.getVerifiedDomain();
    if (!domain) { this.toast('Verify your college email first.', 'error'); return; }

    const user = window.fbAuth?.currentUser;
    if (!user) { this.toast('You must be signed in to upload.', 'error'); return; }

    const title = document.getElementById('hub-title')?.value.trim();
    const subject = document.getElementById('hub-subject')?.value.trim();
    const semester = document.getElementById('hub-semester')?.value;
    const type = document.querySelector('.hub-type-btn.active')?.dataset.type || 'notes';
    const year = type === 'qpaper' ? (document.getElementById('hub-year')?.value.trim() || '') : '';
    const file = document.getElementById('hub-file-input')?.files[0];

    if (!title || !subject || !semester || !file) {
      this.toast('Please fill all fields and choose a file.', 'error');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      this.toast('File exceeds 25MB limit.', 'error');
      return;
    }

    const btn = document.getElementById('btn-hub-submit');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Uploading…'; }

    try {
      // 1. Upload to Cloudinary (use 'image' endpoint for photos, 'raw' endpoint for PDFs & docs)
      const isImage = file.type && file.type.startsWith('image/');
      const resourceType = isImage ? 'image' : 'raw';
      const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`;

      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', CLOUDINARY_PRESET);
      fd.append('folder', `apex_space/${domain}`);

      const res = await fetch(uploadUrl, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Cloudinary error ${res.status}`);
      const data = await res.json();

      // 2. Save to Firestore (compat)
      const uploaderName = user.displayName ||
        localStorage.getItem('apex_display_name') ||
        user.email.split('@')[0];

      await window.fbDb.collection('library_uploads').add({
        title,
        subject,
        semester: parseInt(semester),
        type,
        year,
        uploaderName,
        uploaderUid: user.uid,
        uploaderEmail: localStorage.getItem('apex_college_email') || user.email,
        domain,
        downloadUrl: data.secure_url,
        storagePath: data.public_id,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      this.toast(`✅ "${title}" uploaded successfully!`, 'success');
      this.closeUploadModal();
    } catch (err) {
      console.error('Upload error:', err);
      this.toast('Upload failed: ' + err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📤 Upload'; }
    }
  }

  // ─────────────────────────────────────────────
  // HUB: Delete
  // ─────────────────────────────────────────────
  async deleteUpload(docId) {
    if (!confirm('Delete this upload? This cannot be undone.')) return;
    try {
      await window.fbDb.collection('library_uploads').doc(docId).delete();
      this.toast('Deleted.', 'success');
    } catch (err) {
      console.error('Delete error:', err);
      this.toast('Delete failed: ' + err.message, 'error');
    }
  }

  // ─────────────────────────────────────────────
  // Toast
  // ─────────────────────────────────────────────
  toast(msg, type = 'info') {
    if (window.socialModule?.showToast) window.socialModule.showToast(msg, type);
    else alert(msg);
  }
}

window.LibraryModule = LibraryModule;
document.addEventListener('DOMContentLoaded', () => {
  window.libraryModule = new LibraryModule();
});
