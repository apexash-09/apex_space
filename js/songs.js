/**
 * Apex Personal Dashboard - Songs & Music Player Module
 * Implements circular vinyl album disc, SVG progress ring, waveform visualizer, seek bar,
 * shuffle/repeat, multi-file upload support, robust extension + MIME validation, and Blob IndexedDB storage.
 */

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB limit per track

class SongsModule {
  constructor() {
    this.fileInput = document.getElementById('audio-file-input');
    this.uploadBtn = document.getElementById('btn-upload-song');
    this.playlistContainer = document.getElementById('songs-playlist-container');
    this.countBadge = document.getElementById('songs-count-badge');

    // Music Player Controls & Art Elements
    this.audioPlayer = document.getElementById('main-audio-player');
    this.albumDisc = document.getElementById('album-disc');
    this.progressRing = document.getElementById('player-progress-ring');
    this.trackTitleLabel = document.getElementById('player-track-title');
    this.trackArtistLabel = document.getElementById('player-track-artist');
    this.currentTimeLabel = document.getElementById('player-current-time');
    this.totalDurationLabel = document.getElementById('player-total-duration');
    this.seekerInput = document.getElementById('player-seeker-input');

    this.playBtn = document.getElementById('player-play-btn');
    this.prevBtn = document.getElementById('player-prev-btn');
    this.nextBtn = document.getElementById('player-next-btn');
    this.shuffleBtn = document.getElementById('player-shuffle-btn');
    this.repeatBtn = document.getElementById('player-repeat-btn');
    this.waveformVisualizer = document.getElementById('waveform-visualizer');

    this.playlist = [];
    this.currentTrackIndex = -1;
    this.activeObjectUrl = null;
    this.isShuffle = false;
    this.isRepeat = false;

    this.init();
  }

  init() {
    if (!this.playlistContainer) return;

    // File Upload Listeners
    if (this.uploadBtn && this.fileInput) {
      this.uploadBtn.addEventListener('click', () => this.fileInput.click());
      this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // Audio Event Listeners
    if (this.audioPlayer) {
      this.audioPlayer.addEventListener('timeupdate', () => this.onTimeUpdate());
      this.audioPlayer.addEventListener('ended', () => this.onTrackEnded());
      this.audioPlayer.addEventListener('loadedmetadata', () => {
        if (this.totalDurationLabel && !isNaN(this.audioPlayer.duration)) {
          this.totalDurationLabel.innerText = this.formatTime(this.audioPlayer.duration);
        }
      });
    }

    // Controls Listeners
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlayPause());
    }

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.playPreviousTrack());
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.playNextTrack());
    }

    if (this.shuffleBtn) {
      this.shuffleBtn.addEventListener('click', () => {
        this.isShuffle = !this.isShuffle;
        this.shuffleBtn.style.color = this.isShuffle ? '#ffffff' : 'var(--text-muted)';
      });
    }

    if (this.repeatBtn) {
      this.repeatBtn.addEventListener('click', () => {
        this.isRepeat = !this.isRepeat;
        this.repeatBtn.style.color = this.isRepeat ? '#ffffff' : 'var(--text-muted)';
      });
    }

    if (this.seekerInput) {
      this.seekerInput.addEventListener('input', (e) => {
        if (this.audioPlayer && this.audioPlayer.duration) {
          const seekTime = (e.target.value / 100) * this.audioPlayer.duration;
          this.audioPlayer.currentTime = seekTime;
        }
      });
    }

    this.renderPlaylist();
  }

  async handleFileUpload(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const audioExtRegex = /\.(mp3|wav|ogg|m4a|aac|flac|wma|mpeg|opus)$/i;
    let addedCount = 0;
    let skippedSizeCount = 0;

    for (const file of files) {
      // 1. File Size Guard Check per track
      if (file.size > MAX_FILE_SIZE_BYTES) {
        skippedSizeCount++;
        continue;
      }

      // 2. Validate MIME Type OR Extension (handles Windows empty MIME type for local MP3s!)
      const isAudioMime = file.type && file.type.startsWith('audio/');
      const isAudioExt = audioExtRegex.test(file.name);

      if (!isAudioMime && !isAudioExt) {
        console.warn(`Skipping non-audio file: ${file.name}`);
        continue;
      }

      const title = file.name.replace(/\.[^/.]+$/, "");
      const artist = 'Local Track';

      const songObj = {
        title: title,
        artist: artist,
        audioBlob: file,
        mimeType: file.type || 'audio/mpeg',
        sizeBytes: file.size,
        addedAt: new Date().toISOString()
      };

      try {
        await window.db.put('songs', songObj);
        addedCount++;
      } catch (err) {
        console.error('Failed to store audio Blob:', err);
      }
    }

    this.fileInput.value = '';

    if (skippedSizeCount > 0) {
      alert(`⚠️ ${skippedSizeCount} file(s) were skipped because they exceed the 50MB per-track size limit.`);
    }

    if (addedCount > 0) {
      await this.renderPlaylist();
    }
  }

  async playTrackAtIndex(index) {
    if (index < 0 || index >= this.playlist.length) return;

    const song = this.playlist[index];
    this.currentTrackIndex = index;

    // Revoke previous URL to release memory
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }

    try {
      this.activeObjectUrl = URL.createObjectURL(song.audioBlob);
      this.audioPlayer.src = this.activeObjectUrl;

      this.trackTitleLabel.innerText = song.title;
      this.trackArtistLabel.innerText = `${song.artist} • ${(song.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;

      await this.audioPlayer.play();
      this.setPlayingState(true);
      this.renderPlaylistHighlight();
    } catch (err) {
      console.error('Error playing track:', err);
    }
  }

  togglePlayPause() {
    if (!this.audioPlayer.src) {
      if (this.playlist.length > 0) {
        this.playTrackAtIndex(0);
      }
      return;
    }

    if (this.audioPlayer.paused) {
      this.audioPlayer.play();
      this.setPlayingState(true);
    } else {
      this.audioPlayer.pause();
      this.setPlayingState(false);
    }
  }

  playNextTrack() {
    if (this.playlist.length === 0) return;
    let nextIdx = this.currentTrackIndex + 1;
    if (this.isShuffle) {
      nextIdx = Math.floor(Math.random() * this.playlist.length);
    } else if (nextIdx >= this.playlist.length) {
      nextIdx = 0;
    }
    this.playTrackAtIndex(nextIdx);
  }

  playPreviousTrack() {
    if (this.playlist.length === 0) return;
    let prevIdx = this.currentTrackIndex - 1;
    if (prevIdx < 0) prevIdx = this.playlist.length - 1;
    this.playTrackAtIndex(prevIdx);
  }

  onTrackEnded() {
    if (this.isRepeat) {
      this.audioPlayer.currentTime = 0;
      this.audioPlayer.play();
    } else {
      this.playNextTrack();
    }
  }

  setPlayingState(isPlaying) {
    if (this.playBtn) {
      this.playBtn.innerText = isPlaying ? '⏸' : '▶';
    }

    if (this.albumDisc) {
      if (isPlaying) {
        this.albumDisc.classList.add('spinning');
      } else {
        this.albumDisc.classList.remove('spinning');
      }
    }

    // Toggle Waveform Visualizer
    if (this.waveformVisualizer) {
      const bars = this.waveformVisualizer.querySelectorAll('.wave-bar');
      bars.forEach(b => {
        if (isPlaying) b.classList.add('active');
        else b.classList.remove('active');
      });
    }
  }

  onTimeUpdate() {
    if (!this.audioPlayer) return;

    const cur = this.audioPlayer.currentTime || 0;
    const dur = this.audioPlayer.duration || 1;

    if (this.currentTimeLabel) {
      this.currentTimeLabel.innerText = this.formatTime(cur);
    }

    if (this.seekerInput) {
      this.seekerInput.value = (cur / dur) * 100;
    }

    // Circular SVG Progress Ring (Radius 90 => Perimeter = 565.48)
    if (this.progressRing) {
      const circumference = 565.48;
      const progressFraction = cur / dur;
      const offset = circumference - (progressFraction * circumference);
      this.progressRing.style.strokeDashoffset = offset;
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async deleteTrack(id) {
    if (!confirm('Delete track from library?')) return;
    try {
      const deletedIdx = this.playlist.findIndex(s => s.id === id);
      if (deletedIdx === this.currentTrackIndex) {
        this.audioPlayer.pause();
        this.audioPlayer.src = '';
        this.setPlayingState(false);
        this.trackTitleLabel.innerText = 'No Track Playing';
        this.trackArtistLabel.innerText = 'Upload or select a track from library';
        this.currentTrackIndex = -1;
      }
      await window.db.delete('songs', id);
      await this.renderPlaylist();
    } catch (err) {
      console.error('Failed to delete track:', err);
    }
  }

  async renderPlaylist() {
    try {
      this.playlist = await window.db.getAll('songs');
      this.playlistContainer.innerHTML = '';

      if (this.countBadge) {
        this.countBadge.innerText = `${this.playlist.length} Track${this.playlist.length === 1 ? '' : 's'}`;
      }

      if (this.playlist.length === 0) {
        this.playlistContainer.innerHTML = `
          <div style="text-align: center; padding: 40px 0; color: var(--text-muted);">
            <p>No tracks uploaded yet.</p>
            <p style="font-size: 12px; margin-top: 6px;">Click <strong>🎵 Upload Track</strong> to select your local MP3/WAV audio files.</p>
          </div>
        `;
        return;
      }

      this.playlist.forEach((item, idx) => {
        const isPlaying = this.currentTrackIndex === idx && !this.audioPlayer.paused;
        const div = document.createElement('div');
        div.className = `song-card ${this.currentTrackIndex === idx ? 'playing' : ''}`;

        const sizeMB = (item.sizeBytes / (1024 * 1024)).toFixed(1);

        div.innerHTML = `
          <div style="display: flex; align-items: center; gap: 14px;">
            <button class="play-mini-btn play-track-btn">
              ${isPlaying ? '⏸' : '▶'}
            </button>
            <div>
              <div style="font-size: 14px; font-weight: 600; color: #fff;">${this.escapeHtml(item.title)}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${sizeMB} MB • ${item.artist}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn-ghost delete-track-btn" style="padding: 4px 8px; font-size: 12px; color: var(--accent-red); border-color: rgba(255,77,77,0.2);">Delete</button>
          </div>
        `;

        div.querySelector('.play-track-btn').addEventListener('click', () => {
          if (this.currentTrackIndex === idx && !this.audioPlayer.paused) {
            this.audioPlayer.pause();
            this.setPlayingState(false);
          } else {
            this.playTrackAtIndex(idx);
          }
        });

        div.querySelector('.delete-track-btn').addEventListener('click', () => {
          this.deleteTrack(item.id);
        });

        this.playlistContainer.appendChild(div);
      });
    } catch (err) {
      console.error('Error rendering playlist:', err);
    }
  }

  renderPlaylistHighlight() {
    this.renderPlaylist();
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

window.songsModule = new SongsModule();
