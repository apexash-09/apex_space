/**
 * Apex Personal Diary & Dashboard - IndexedDB Storage Helper
 * Wraps browser IndexedDB into clean promise-based Async/Await methods.
 * Stores 9 stores: diary, worklog, timetable, goals, buylist, songs, streak, settings, notes.
 */

const DB_NAME = 'ApexDashboardDB';
const DB_VERSION = 2; // Upgraded version for notes store

class ApexDB {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // 1. Diary Store (Key: date YYYY-MM-DD)
        if (!db.objectStoreNames.contains('diary')) {
          db.createObjectStore('diary', { keyPath: 'date' });
        }

        // 2. Work Log Store (Key: id autoIncrement)
        if (!db.objectStoreNames.contains('worklog')) {
          const workStore = db.createObjectStore('worklog', { keyPath: 'id', autoIncrement: true });
          workStore.createIndex('tag', 'tag', { unique: false });
          workStore.createIndex('date', 'date', { unique: false });
        }

        // 3. Timetable Store (Key: slotId e.g. "Mon-09:00")
        if (!db.objectStoreNames.contains('timetable')) {
          db.createObjectStore('timetable', { keyPath: 'slotId' });
        }

        // 4. Goals Store (Key: id autoIncrement)
        if (!db.objectStoreNames.contains('goals')) {
          db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
        }

        // 5. Buy List Store (Key: id autoIncrement)
        if (!db.objectStoreNames.contains('buylist')) {
          db.createObjectStore('buylist', { keyPath: 'id', autoIncrement: true });
        }

        // 6. Songs Store (Key: id autoIncrement, Blob audio data)
        if (!db.objectStoreNames.contains('songs')) {
          db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
        }

        // 7. Study Streak Store (Key: date YYYY-MM-DD)
        if (!db.objectStoreNames.contains('streak')) {
          db.createObjectStore('streak', { keyPath: 'date' });
        }

        // 8. Settings Store (Key: key)
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // 9. College Notes Store (Key: id autoIncrement, PDF/Text/Blob documents)
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
          notesStore.createIndex('subject', 'subject', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB init error:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  async get(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async clearStore(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Backup Data Export
  async exportAllData() {
    await this.init();
    const stores = ['diary', 'worklog', 'timetable', 'goals', 'buylist', 'streak', 'settings', 'notes'];
    const exportObj = {};

    for (const s of stores) {
      exportObj[s] = await this.getAll(s);
    }

    return exportObj;
  }
}

// Global Singleton Instance
window.db = new ApexDB();
