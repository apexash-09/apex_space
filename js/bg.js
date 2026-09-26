/**
 * Apex Personal Dashboard - Background Motion Engine
 * High-end Monochrome Space & Cosmic Dust Ray Canvas (Inspired by Comet UI reference).
 * Includes tab visibility pausing (document.visibilitychange) and battery-saver toggle.
 */

class MotionBackground {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.animationId = null;
    this.isRunning = true;
    this.isTabVisible = true;
    this.time = 0;

    // Star & Cosmic Dust Particles
    this.particles = [];
    this.numParticles = 90;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Create Star & Cosmic Ray Dust Particles
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: Math.random() * 1.6 + 0.4,
        alpha: Math.random() * 0.8 + 0.2,
        speedY: (Math.random() - 0.5) * 0.25,
        speedX: (Math.random() - 0.5) * 0.25,
        pulseSpeed: Math.random() * 0.02 + 0.005
      });
    }

    // Tab Visibility Performance Listener
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.isTabVisible = false;
        this.stop();
      } else {
        this.isTabVisible = true;
        if (this.isRunning) this.start();
      }
    });

    this.start();
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
    const loop = () => {
      if (!this.isRunning || !this.isTabVisible) return;
      this.render();
      this.time += 0.012;
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  toggleMotion() {
    this.isRunning = !this.isRunning;
    if (this.isRunning) {
      this.start();
    } else {
      this.stop();
    }
    return this.isRunning;
  }

  render() {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'obsidian';

    ctx.clearRect(0, 0, width, height);

    // Theme-specific Background & Lighting Colors
    let bgColors, beamColorStart, beamColorMid, waveAlphaMult, particleRgb, particleShadow;

    if (currentTheme === 'gold') {
      bgColors = ['rgba(45, 30, 10, 0.85)', 'rgba(18, 12, 4, 0.95)', '#070503'];
      beamColorStart = 'rgba(251, 191, 36, 0.16)';
      beamColorMid = 'rgba(251, 191, 36, 0.03)';
      waveAlphaMult = 1.4;
      particleRgb = '251, 191, 36';
      particleShadow = 'rgba(251, 191, 36, 0.8)';
    } else if (currentTheme === 'lavender') {
      bgColors = ['rgba(38, 28, 60, 0.85)', 'rgba(18, 14, 30, 0.95)', '#0c0a17'];
      beamColorStart = 'rgba(192, 132, 252, 0.15)';
      beamColorMid = 'rgba(192, 132, 252, 0.03)';
      waveAlphaMult = 1.4;
      particleRgb = '192, 132, 252';
      particleShadow = 'rgba(192, 132, 252, 0.8)';
    } else {
      // Obsidian (Default Monochrome)
      bgColors = ['rgba(24, 24, 28, 0.7)', 'rgba(10, 10, 12, 0.9)', '#030303'];
      beamColorStart = 'rgba(255, 255, 255, 0.08)';
      beamColorMid = 'rgba(255, 255, 255, 0.02)';
      waveAlphaMult = 1.0;
      particleRgb = '255, 255, 255';
      particleShadow = 'rgba(255, 255, 255, 0.7)';
    }

    // 1. Render Cosmic Radial Dark Space
    const bgGradient = ctx.createRadialGradient(
      width * 0.5, height * 0.3, 50,
      width * 0.5, height * 0.5, Math.max(width, height) * 0.9
    );
    bgGradient.addColorStop(0, bgColors[0]);
    bgGradient.addColorStop(0.5, bgColors[1]);
    bgGradient.addColorStop(1, bgColors[2]);

    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Render Shimmering Diagonal Cosmic Light Beam / Ray
    ctx.save();
    const beamAngle = Math.PI / 4;
    ctx.translate(width * 0.5, height * 0.3);
    ctx.rotate(beamAngle);

    const beamGradient = ctx.createLinearGradient(0, -300, 0, 600);
    beamGradient.addColorStop(0, beamColorStart);
    beamGradient.addColorStop(0.5, beamColorMid);
    beamGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = beamGradient;
    ctx.beginPath();
    ctx.moveTo(-60, -300);
    ctx.lineTo(60, -300);
    ctx.lineTo(240, 600);
    ctx.lineTo(-240, 600);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Render Fluid Topographic Wave Lines
    const numLines = 8;
    const stepY = height / (numLines + 1);

    for (let i = 1; i <= numLines; i++) {
      ctx.beginPath();
      const baseY = i * stepY;

      const alpha = (0.05 + Math.sin(this.time * 0.5 + i) * 0.025) * waveAlphaMult;
      ctx.strokeStyle = `rgba(${particleRgb}, ${alpha})`;
      ctx.lineWidth = 1.0;

      for (let x = 0; x <= width; x += 30) {
        const wave1 = Math.sin(x * 0.003 + this.time + i * 0.4) * 28;
        const wave2 = Math.cos(x * 0.005 - this.time * 0.6 + i) * 15;
        const y = baseY + wave1 + wave2;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // 4. Render Star Dust Particles
    for (const p of this.particles) {
      p.x += p.speedX;
      p.y += p.speedY;
      p.alpha += Math.sin(this.time * 4 + p.x) * p.pulseSpeed;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      const clampedAlpha = Math.max(0.1, Math.min(0.9, p.alpha));

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${particleRgb}, ${clampedAlpha})`;
      ctx.shadowBlur = 6;
      ctx.shadowColor = particleShadow;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

// Global Canvas Controller
window.bgMotion = new MotionBackground('bg-canvas');
