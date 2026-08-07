(() => {
  'use strict';

  const doc = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const qs = (selector, context = document) => context.querySelector(selector);
  const qsa = (selector, context = document) => [...context.querySelectorAll(selector)];

  doc.classList.add('js');

  function setCurrentYear() {
    const year = String(new Date().getFullYear());
    qsa('[data-current-year]').forEach((node) => {
      node.textContent = year;
    });
  }

  function initTheme() {
    const toggle = qs('#theme-toggle');
    const themeMeta = qs('meta[name="theme-color"]');
    let savedTheme = null;

    try {
      savedTheme = localStorage.getItem('sellery-theme');
    } catch {
      savedTheme = null;
    }

    const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const initial = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : preferred;

    const applyTheme = (theme, persist = true) => {
      doc.dataset.theme = theme;
      if (persist) {
        try {
          localStorage.setItem('sellery-theme', theme);
        } catch {
          // The visual theme still works when storage is unavailable.
        }
      }

      toggle?.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      themeMeta?.setAttribute('content', theme === 'dark' ? '#050706' : '#f5f7f5');
      window.dispatchEvent(new CustomEvent('sellery:theme', { detail: { theme } }));
    };

    applyTheme(initial, Boolean(savedTheme));
    toggle?.addEventListener('click', () => {
      applyTheme(doc.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }

  function initMobileMenu() {
    const toggle = qs('#menu-toggle');
    const nav = qs('#nav-links');
    if (!toggle || !nav) return;

    const close = () => {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      nav.classList.remove('is-open');
      body.classList.remove('menu-open');
    };

    toggle.addEventListener('click', () => {
      const nextOpen = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(nextOpen));
      toggle.setAttribute('aria-label', nextOpen ? 'Close menu' : 'Open menu');
      nav.classList.toggle('is-open', nextOpen);
      body.classList.toggle('menu-open', nextOpen);
    });

    qsa('a', nav).forEach((link) => link.addEventListener('click', close));

    document.addEventListener('click', (event) => {
      if (!nav.classList.contains('is-open')) return;
      if (!nav.contains(event.target) && !toggle.contains(event.target)) close();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1100) close();
    }, { passive: true });
  }

  function initHeaderAndProgress() {
    const header = qs('#site-header');
    const progress = qs('#scroll-progress');
    let previousY = window.scrollY;
    let frame = 0;

    const update = () => {
      const y = Math.max(0, window.scrollY);
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      if (progress) progress.style.width = `${Math.min(100, (y / max) * 100)}%`;

      if (header) {
        header.classList.toggle('is-scrolled', y > 20);
        const scrollingDown = y > previousY + 7;
        const scrollingUp = y < previousY - 7;
        if (y > 320 && scrollingDown && !body.classList.contains('menu-open')) {
          header.classList.add('is-hidden');
        }
        if (scrollingUp || y < 190) {
          header.classList.remove('is-hidden');
        }
      }

      previousY = y;
      frame = 0;
    };

    window.addEventListener('scroll', () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();

    const links = qsa('.nav-links a[href^="#"]');
    const map = new Map(links.map((link) => [link.getAttribute('href').slice(1), link]));
    const sections = [...map.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    if (!sections.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;

      links.forEach((link) => {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      });
      const active = map.get(visible.target.id);
      active?.classList.add('active');
      active?.setAttribute('aria-current', 'location');
    }, {
      rootMargin: '-29% 0px -58% 0px',
      threshold: [0.02, 0.08, 0.18, 0.32]
    });

    sections.forEach((section) => observer.observe(section));
  }

  function initReveal() {
    const elements = qsa('.reveal');
    if (!elements.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, instance) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        instance.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

    elements.forEach((element) => observer.observe(element));
  }

  function initCursorAura() {
    const aura = qs('#cursor-aura') || qs('#cursor-glow');
    if (!aura || !finePointer || reduceMotion) return;

    body.classList.add('has-pointer');
    let targetX = window.innerWidth * 0.5;
    let targetY = window.innerHeight * 0.35;
    let currentX = targetX;
    let currentY = targetY;
    let running = true;

    window.addEventListener('pointermove', (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) animate();
    });

    const animate = () => {
      if (!running) return;
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;
      aura.style.transform = `translate3d(${currentX - 280}px, ${currentY - 280}px, 0)`;
      window.requestAnimationFrame(animate);
    };

    animate();
  }

  function initDepthCards() {
    if (!finePointer || reduceMotion) return;

    qsa('[data-depth-card]').forEach((card) => {
      let frame = 0;
      const maxTilt = card.classList.contains('hero-visual') ? 2.2 : 1.65;

      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        const ry = (px - 0.5) * maxTilt * 2;
        const rx = (0.5 - py) * maxTilt * 2;

        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          card.classList.add('is-depth-active');
          card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
          card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
        });
      });

      card.addEventListener('pointerleave', () => {
        cancelAnimationFrame(frame);
        card.classList.remove('is-depth-active');
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  class Starfield {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.width = 0;
      this.height = 0;
      this.stars = [];
      this.shooting = [];
      this.pointer = { x: 0.5, y: 0.35 };
      this.running = true;
      this.raf = 0;
      this.resizeFrame = 0;
      this.time = 0;
      this.resize = this.resize.bind(this);
      this.draw = this.draw.bind(this);
      this.bind();
      this.resize();
      this.draw();
    }

    bind() {
      window.addEventListener('resize', () => {
        cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = requestAnimationFrame(this.resize);
      }, { passive: true });

      window.addEventListener('pointermove', (event) => {
        this.pointer.x = event.clientX / Math.max(1, window.innerWidth);
        this.pointer.y = event.clientY / Math.max(1, window.innerHeight);
      }, { passive: true });

      document.addEventListener('visibilitychange', () => {
        this.running = !document.hidden;
        if (this.running && !this.raf) this.draw();
      });
    }

    resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const density = reduceMotion ? 17000 : 10500;
      const count = Math.max(55, Math.min(190, Math.round((this.width * this.height) / density)));
      this.stars = Array.from({ length: count }, () => ({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        z: 0.25 + Math.random() * 0.75,
        r: 0.32 + Math.random() * 1.15,
        alpha: 0.15 + Math.random() * 0.62,
        phase: Math.random() * Math.PI * 2,
        speed: 0.012 + Math.random() * 0.045
      }));
    }

    maybeShoot() {
      if (reduceMotion || this.shooting.length || Math.random() > 0.0023) return;
      this.shooting.push({
        x: this.width * (0.05 + Math.random() * 0.55),
        y: -25,
        vx: 5.3 + Math.random() * 3,
        vy: 3.1 + Math.random() * 2.1,
        life: 1
      });
    }

    draw() {
      if (!this.running) {
        this.raf = 0;
        return;
      }

      const ctx = this.ctx;
      const isLight = doc.dataset.theme === 'light';
      const offsetX = (this.pointer.x - 0.5) * 15;
      const offsetY = (this.pointer.y - 0.5) * 10;
      this.time += 1;
      ctx.clearRect(0, 0, this.width, this.height);

      this.stars.forEach((star) => {
        if (!reduceMotion) {
          star.y += star.speed * star.z;
          star.phase += 0.008 + star.z * 0.006;
          if (star.y > this.height + 4) star.y = -4;
        }

        const x = star.x + offsetX * star.z;
        const y = star.y + offsetY * star.z;
        const twinkle = 0.72 + Math.sin(star.phase) * 0.28;
        const alpha = star.alpha * twinkle * (isLight ? 0.48 : 1);
        ctx.beginPath();
        ctx.arc(x, y, star.r * star.z, 0, Math.PI * 2);
        ctx.fillStyle = isLight
          ? `rgba(39, 101, 52, ${alpha})`
          : `rgba(226, 255, 232, ${alpha})`;
        ctx.fill();
      });

      this.maybeShoot();
      this.shooting = this.shooting.filter((shot) => {
        shot.x += shot.vx;
        shot.y += shot.vy;
        shot.life -= 0.019;
        const length = 95;
        const gradient = ctx.createLinearGradient(shot.x, shot.y, shot.x - length, shot.y - length * 0.58);
        gradient.addColorStop(0, `rgba(166,255,111,${Math.max(0, shot.life)})`);
        gradient.addColorStop(1, 'rgba(166,255,111,0)');
        ctx.beginPath();
        ctx.moveTo(shot.x, shot.y);
        ctx.lineTo(shot.x - length, shot.y - length * 0.58);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        return shot.life > 0 && shot.y < this.height + 90;
      });

      this.raf = requestAnimationFrame(this.draw);
    }
  }

  class NetworkGlobe {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: true });
      this.width = 0;
      this.height = 0;
      this.radius = 0;
      this.rotation = 0;
      this.points = this.createPoints(74);
      this.links = this.createLinks();
      this.packets = this.createPackets(7);
      this.running = true;
      this.visible = true;
      this.raf = 0;
      this.last = 0;
      this.resize = this.resize.bind(this);
      this.draw = this.draw.bind(this);
      this.bind();
      this.resize();
      this.draw();
    }

    bind() {
      window.addEventListener('resize', this.resize, { passive: true });
      document.addEventListener('visibilitychange', () => {
        this.running = !document.hidden;
        if (this.running && this.visible && !this.raf) this.draw(performance.now());
      });

      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(([entry]) => {
          this.visible = entry?.isIntersecting ?? true;
          if (this.visible && this.running && !this.raf) this.draw(performance.now());
        }, { rootMargin: '160px' });
        observer.observe(this.canvas);
      }
    }

    createPoints(count) {
      const points = [];
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < count; i += 1) {
        const y = 1 - (i / (count - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i;
        points.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r, pulse: Math.random() * Math.PI * 2 });
      }
      return points;
    }

    createLinks() {
      const links = [];
      this.points.forEach((point, index) => {
        const nearest = this.points
          .map((other, otherIndex) => {
            if (otherIndex === index) return null;
            const dx = point.x - other.x;
            const dy = point.y - other.y;
            const dz = point.z - other.z;
            return { otherIndex, distance: dx * dx + dy * dy + dz * dz };
          })
          .filter(Boolean)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 3);

        nearest.forEach(({ otherIndex }) => {
          const a = Math.min(index, otherIndex);
          const b = Math.max(index, otherIndex);
          if (!links.some(([x, y]) => x === a && y === b)) links.push([a, b]);
        });
      });
      return links;
    }

    createPackets(count) {
      return Array.from({ length: count }, () => ({
        link: Math.floor(Math.random() * this.links.length),
        progress: Math.random(),
        speed: 0.0025 + Math.random() * 0.003
      }));
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      this.radius = Math.min(this.width, this.height) * 0.34;
      this.canvas.width = Math.round(this.width * ratio);
      this.canvas.height = Math.round(this.height * ratio);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    project(point) {
      const cosY = Math.cos(this.rotation);
      const sinY = Math.sin(this.rotation);
      const cosX = Math.cos(-0.18);
      const sinX = Math.sin(-0.18);

      const x1 = point.x * cosY - point.z * sinY;
      const z1 = point.x * sinY + point.z * cosY;
      const y2 = point.y * cosX - z1 * sinX;
      const z2 = point.y * sinX + z1 * cosX;
      const perspective = 1 / (1.52 - z2 * 0.22);

      return {
        x: this.width * 0.5 + x1 * this.radius * perspective,
        y: this.height * 0.5 + y2 * this.radius * perspective,
        z: z2,
        scale: perspective
      };
    }

    drawSphereGuides(ctx, isLight) {
      const color = isLight ? 'rgba(33,91,46,0.07)' : 'rgba(205,255,218,0.065)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;

      [-0.58, -0.28, 0, 0.28, 0.58].forEach((latitude) => {
        const r = this.radius * Math.sqrt(1 - latitude * latitude);
        const y = this.height * 0.5 + latitude * this.radius * 0.72;
        ctx.beginPath();
        ctx.ellipse(this.width * 0.5, y, r * 0.72, r * 0.22, 0, 0, Math.PI * 2);
        ctx.stroke();
      });

      [-0.8, -0.4, 0, 0.4, 0.8].forEach((longitude) => {
        ctx.beginPath();
        ctx.ellipse(this.width * 0.5, this.height * 0.5, this.radius * Math.max(0.12, Math.abs(Math.cos(longitude * Math.PI / 2))), this.radius * 0.72, longitude * 0.18, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    draw(timestamp = 0) {
      if (!this.running || !this.visible) {
        this.raf = 0;
        return;
      }

      if (timestamp - this.last < 30 && !reduceMotion) {
        this.raf = requestAnimationFrame(this.draw);
        return;
      }
      this.last = timestamp;

      const ctx = this.ctx;
      const isLight = doc.dataset.theme === 'light';
      ctx.clearRect(0, 0, this.width, this.height);
      if (!reduceMotion) this.rotation += 0.0019;

      this.drawSphereGuides(ctx, isLight);
      const projected = this.points.map((point) => this.project(point));

      this.links.forEach(([a, b]) => {
        const p1 = projected[a];
        const p2 = projected[b];
        const depth = (p1.z + p2.z) * 0.5;
        if (depth < -0.75) return;
        const alpha = Math.max(0.02, 0.055 + depth * 0.08);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = isLight
          ? `rgba(36, 118, 55, ${alpha})`
          : `rgba(147, 255, 99, ${alpha})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      });

      projected.forEach((point, index) => {
        if (point.z < -0.85) return;
        const pulse = 0.72 + Math.sin(timestamp * 0.0016 + this.points[index].pulse) * 0.28;
        const alpha = Math.max(0.08, (0.25 + point.z * 0.3) * pulse);
        const radius = Math.max(0.65, 1.15 + point.z * 0.75);
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isLight
          ? `rgba(50, 145, 68, ${alpha})`
          : `rgba(171, 255, 126, ${alpha})`;
        ctx.fill();
      });

      this.packets.forEach((packet) => {
        if (!reduceMotion) packet.progress += packet.speed;
        if (packet.progress > 1) {
          packet.progress = 0;
          packet.link = Math.floor(Math.random() * this.links.length);
        }
        const [a, b] = this.links[packet.link];
        const p1 = projected[a];
        const p2 = projected[b];
        if (!p1 || !p2 || (p1.z + p2.z) * 0.5 < -0.6) return;
        const x = p1.x + (p2.x - p1.x) * packet.progress;
        const y = p1.y + (p2.y - p1.y) * packet.progress;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? 'rgba(45,190,30,.78)' : 'rgba(143,255,84,.9)';
        ctx.shadowColor = isLight ? 'rgba(45,190,30,.5)' : 'rgba(143,255,84,.75)';
        ctx.shadowBlur = 9;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      const gradient = ctx.createRadialGradient(this.width * 0.5, this.height * 0.5, this.radius * 0.8, this.width * 0.5, this.height * 0.5, this.radius * 1.25);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, isLight ? 'rgba(245,247,245,.6)' : 'rgba(5,7,6,.78)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);

      this.raf = requestAnimationFrame(this.draw);
    }
  }

  function initCanvases() {
    const starfield = qs('#starfield');
    if (starfield) new Starfield(starfield);
    const network = qs('#network-canvas');
    if (network) new NetworkGlobe(network);
  }

  function initPlatformTabs() {
    const tabs = qsa('.platform-tab');
    const panels = qsa('.platform-panel');
    const breadcrumb = qs('#platform-breadcrumb');
    const shell = qs('.platform-shell');
    if (!tabs.length || !panels.length) return;

    let activeIndex = Math.max(0, tabs.findIndex((tab) => tab.classList.contains('active')));
    let userInteracted = false;
    let visible = false;
    let timer = 0;

    const activate = (index, focus = false) => {
      activeIndex = (index + tabs.length) % tabs.length;
      const key = tabs[activeIndex].dataset.platform;

      tabs.forEach((tab, tabIndex) => {
        const active = tabIndex === activeIndex;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });

      panels.forEach((panel) => {
        const active = panel.dataset.panel === key;
        panel.hidden = !active;
        panel.classList.toggle('active', active);
      });

      if (breadcrumb) breadcrumb.textContent = tabs[activeIndex].querySelector('strong')?.textContent || key;
      if (focus) tabs[activeIndex].focus();
    };

    const stopTimer = () => {
      window.clearInterval(timer);
      timer = 0;
    };

    const maybeStartTimer = () => {
      if (reduceMotion || userInteracted || !visible || timer) return;
      timer = window.setInterval(() => activate(activeIndex + 1), 6200);
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        userInteracted = true;
        stopTimer();
        activate(index);
      });

      tab.addEventListener('keydown', (event) => {
        if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        userInteracted = true;
        stopTimer();
        if (event.key === 'Home') activate(0, true);
        else if (event.key === 'End') activate(tabs.length - 1, true);
        else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') activate(index + 1, true);
        else activate(index - 1, true);
      });
    });

    if (shell && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) maybeStartTimer();
        else stopTimer();
      }, { threshold: 0.28 });
      observer.observe(shell);
    } else {
      visible = true;
      maybeStartTimer();
    }

    shell?.addEventListener('mouseenter', stopTimer);
    shell?.addEventListener('mouseleave', maybeStartTimer);
    shell?.addEventListener('focusin', stopTimer);
    shell?.addEventListener('focusout', maybeStartTimer);
    activate(activeIndex);
  }

  function initModelSteps() {
    const steps = qsa('.model-step');
    const shell = qs('.model-shell');
    if (!steps.length) return;

    let activeIndex = 0;
    let visible = false;
    let timer = 0;

    const activate = (index) => {
      activeIndex = (index + steps.length) % steps.length;
      steps.forEach((step, stepIndex) => step.classList.toggle('active', stepIndex === activeIndex));
    };

    const stop = () => {
      clearInterval(timer);
      timer = 0;
    };

    const start = () => {
      if (reduceMotion || !visible || timer) return;
      timer = window.setInterval(() => activate(activeIndex + 1), 3200);
    };

    steps.forEach((step, index) => {
      step.tabIndex = 0;
      step.addEventListener('mouseenter', () => {
        stop();
        activate(index);
      });
      step.addEventListener('focus', () => {
        stop();
        activate(index);
      });
      step.addEventListener('mouseleave', start);
      step.addEventListener('blur', start);
    });

    if (shell && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) start();
        else stop();
      }, { threshold: 0.3 });
      observer.observe(shell);
    } else {
      visible = true;
      start();
    }
  }

  let toastTimer = 0;

  function showDemoToast(title, copy) {
    const toast = qs('#demo-toast');
    const titleNode = qs('#demo-toast-title');
    const copyNode = qs('#demo-toast-copy');
    if (!toast) return;

    if (titleNode) titleNode.textContent = title;
    if (copyNode) copyNode.textContent = copy;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4300);
  }

  function initIllustrativeControls() {
    const railMessages = [
      ['Portfolio graph selected', 'The illustrative control plane is showing the portfolio operating graph.'],
      ['Automation systems selected', 'The illustrative control plane is showing automation orchestration.'],
      ['Commerce systems selected', 'The illustrative control plane is showing commerce operating intelligence.'],
      ['Acquisition systems selected', 'The illustrative control plane is showing opportunity and capital systems.'],
      ['Control settings', 'System settings are represented here for interface demonstration.']
    ];

    qsa('.rail-button').forEach((button, index) => {
      button.addEventListener('click', () => {
        qsa('.rail-button').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        const message = railMessages[index] || railMessages[0];
        showDemoToast(message[0], message[1]);
      });
    });

    const malachMessages = [
      ['Malach command center', 'The command view coordinates intelligence, decisions, and account actions.'],
      ['Performance intelligence', 'The performance view connects advertising outcomes to business economics.'],
      ['Autonomous mode', 'Autonomous mode operates within defined guardrails and an auditable action history.'],
      ['Action history', 'Every illustrative decision and action is preserved for review.']
    ];

    qsa('.malach-nav button').forEach((button, index) => {
      button.addEventListener('click', () => {
        qsa('.malach-nav button').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        const message = malachMessages[index] || malachMessages[0];
        showDemoToast(message[0], message[1]);
      });
    });

    const demoMessages = {
      intelligence: ['Signal inspected', 'The illustrative intelligence layer has routed the opportunity for comparison.'],
      commerce: ['Operating view opened', 'The illustrative commerce layer connects demand, margin, retention, and execution.'],
      malach: ['Malach channel opened', 'This is an illustrative product interface. Use the contact channel to discuss the platform.']
    };

    qsa('[data-demo-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const message = demoMessages[button.dataset.demoAction] || ['System action', 'Illustrative interface action completed.'];
        showDemoToast(message[0], message[1]);
      });
    });

    qs('#demo-toast-close')?.addEventListener('click', () => {
      const toast = qs('#demo-toast');
      if (toast) toast.hidden = true;
      clearTimeout(toastTimer);
    });
  }

  function initActivityStream() {
    const feed = qs('#activity-feed');
    if (!feed || reduceMotion) return;

    const events = [
      ['09:50', 'Customer signal added to decision model'],
      ['09:52', 'Portfolio workflow completed successfully'],
      ['09:54', 'Competitive movement classified'],
      ['09:56', 'Operating hypothesis entered simulation'],
      ['09:58', 'Learning loop updated across systems'],
      ['10:00', 'New opportunity routed for operator review']
    ];
    let index = 0;

    window.setInterval(() => {
      if (document.hidden) return;
      const [time, text] = events[index % events.length];
      index += 1;
      const row = document.createElement('div');
      row.className = 'activity-row';
      row.innerHTML = `<time>${time}</time><span>${text}</span>`;
      feed.prepend(row);
      while (feed.children.length > 4) feed.lastElementChild?.remove();
      if (row.animate) {
        row.animate([
          { opacity: 0, transform: 'translateY(-6px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 450, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
    }, 4200);
  }

  const projectContent = {
    malach: {
      kicker: 'Flagship AI platform',
      title: 'Malach',
      lede: 'An autonomous advertising operating system designed to understand the business, monitor continuously, reason through tradeoffs, and execute within disciplined guardrails.',
      intent: 'Technology opportunity',
      details: [
        ['Purpose', 'Connect advertising decisions to contribution economics and the broader operating reality of the company.'],
        ['Operating model', 'Observe, diagnose, simulate, execute, measure, and learn through a continuous decision loop.'],
        ['Control', 'Auditable actions, defined guardrails, operator visibility, and a complete event history.'],
        ['Status', 'Active development inside Sellery’s proprietary technology portfolio.']
      ]
    },
    'commerce-os': {
      kicker: 'Internal commerce infrastructure',
      title: 'Sellery Commerce OS',
      lede: 'A unified operating layer that connects catalog, margin, attribution, customer economics, and execution across ecommerce companies.',
      intent: 'Technology opportunity',
      details: [
        ['Problem', 'Commerce data is often fragmented across platforms, channels, products, and teams.'],
        ['System', 'Normalize the operating picture and surface decisions against contribution rather than surface-level revenue.'],
        ['Use', 'Shared internal infrastructure that strengthens visibility, speed, and operating discipline.'],
        ['Model', 'Developed for Sellery companies and selectively extended to strategic use cases.']
      ]
    },
    'owned-commerce': {
      kicker: 'Owned ecommerce operations',
      title: 'Owned Ecommerce',
      lede: 'A portfolio of ecommerce companies improved through shared technology, procurement, customer intelligence, and hands-on operating systems.',
      intent: 'Investment or portfolio opportunity',
      details: [
        ['Approach', 'Preserve the category, product, and customer strengths that make each company distinct.'],
        ['Shared edge', 'Technology, data, finance, procurement, growth systems, and operating knowledge move across the portfolio.'],
        ['Ownership', 'Long-term, operator-led ownership rather than a forced short-duration exit cycle.'],
        ['Opportunity', 'Acquire and build companies where stronger systems can unlock meaningful operating leverage.']
      ]
    },
    'venture-studio': {
      kicker: 'AI-native venture creation',
      title: 'Sellery Venture Studio',
      lede: 'New products are built from real operating pain, validated against live commercial constraints, and expanded when the signal is strong.',
      intent: 'Technology opportunity',
      details: [
        ['Source', 'Recurring problems discovered inside software, ecommerce, advertising, and portfolio operations.'],
        ['Method', 'Build narrowly, validate in operation, measure value, then expand the product surface.'],
        ['Advantage', 'Direct access to users, data, workflows, and commercial feedback from the portfolio.'],
        ['Outcome', 'Internal tools can mature into independent software businesses when the market case is clear.']
      ]
    },
    'acquisition-platform': {
      kicker: 'Capital and transition infrastructure',
      title: 'Acquisition Platform',
      lede: 'A disciplined system for finding, understanding, acquiring, and integrating companies without flattening what made them valuable.',
      intent: 'Sell my business',
      details: [
        ['Focus', 'Software, ecommerce, and technology-enabled companies with durable customer demand.'],
        ['Process', 'Direct conversation, operating understanding, thoughtful structure, and a transition designed around the company.'],
        ['Integration', 'Preserve identity and customer trust while adding systems, visibility, and operating leverage.'],
        ['Horizon', 'A permanent-capital mindset built to improve and hold exceptional businesses.']
      ]
    },
    'signal-layer': {
      kicker: 'Algorithmic market intelligence',
      title: 'Signal Layer',
      lede: 'A structured intelligence layer that turns market, competitor, customer, and operating movement into decision-ready signals.',
      intent: 'Technology opportunity',
      details: [
        ['Inputs', 'Market activity, customer behavior, competitor movement, commercial performance, and operational events.'],
        ['Transformation', 'Normalize unstructured information into structured, comparable operating signals.'],
        ['Application', 'Opportunity discovery, risk detection, decision support, experimentation, and faster operator response.'],
        ['Status', 'Private internal systems under continuous development.']
      ]
    }
  };

  function escapeHTML(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function initPortfolioDialog() {
    const dialog = qs('#portfolio-dialog');
    if (!dialog) return;

    const title = qs('#dialog-title', dialog);
    const kicker = qs('#dialog-kicker', dialog);
    const lede = qs('#dialog-lede', dialog);
    const details = qs('#dialog-details', dialog);
    const cta = qs('#dialog-cta', dialog);
    let previousFocus = null;

    const closeDialog = () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      body.classList.remove('dialog-open');
      previousFocus?.focus?.();
    };

    const openDialog = (key, trigger) => {
      const project = projectContent[key];
      if (!project) return;
      previousFocus = trigger || document.activeElement;
      dialog.dataset.project = key;
      if (kicker) kicker.textContent = project.kicker;
      if (title) title.textContent = project.title;
      if (lede) lede.textContent = project.lede;
      if (details) {
        details.innerHTML = project.details.map(([label, value]) => `
          <div class="dialog-detail">
            <span>${escapeHTML(label)}</span>
            <p>${escapeHTML(value)}</p>
          </div>
        `).join('');
      }
      if (cta) cta.dataset.intent = project.intent;
      body.classList.add('dialog-open');
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      qs('.dialog-close', dialog)?.focus();
    };

    qsa('.project-open').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openDialog(button.dataset.project, button);
      });
    });

    qsa('[data-dialog-close]', dialog).forEach((element) => {
      element.addEventListener('click', closeDialog);
    });

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog();
    });

    dialog.addEventListener('close', () => {
      body.classList.remove('dialog-open');
    });
  }

  function initIntentRouting() {
    const intentField = qs('#intent');
    const pathButtons = qsa('[data-intent-button]');

    const selectIntent = (intent) => {
      if (!intentField) return;
      const exists = [...intentField.options].some((option) => option.value === intent);
      if (!exists) return;
      intentField.value = intent;
      intentField.dispatchEvent(new Event('change', { bubbles: true }));
      pathButtons.forEach((button) => button.classList.toggle('active', button.dataset.intentButton === intent));
    };

    qsa('[data-intent]').forEach((element) => {
      element.addEventListener('click', () => selectIntent(element.dataset.intent));
    });

    pathButtons.forEach((button) => {
      button.addEventListener('click', () => {
        selectIntent(button.dataset.intentButton);
        intentField?.focus({ preventScroll: true });
        qs('.contact-form')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      });
    });

    intentField?.addEventListener('change', () => {
      pathButtons.forEach((button) => button.classList.toggle('active', button.dataset.intentButton === intentField.value));
    });
  }

  function initContactForm() {
    const form = qs('#contact-form');
    if (!form) return;

    const submitButton = qs('#submit-button');
    const status = qs('#form-status');
    const message = qs('#message');
    const count = qs('#message-count');
    const startedAt = qs('#startedAt');
    const successOverlay = qs('#success-overlay');
    const successReference = qs('#success-reference');
    const successClose = qs('#success-close');
    const required = ['intent', 'name', 'email', 'message', 'consent'];

    if (startedAt) startedAt.value = String(Date.now());

    const updateCount = () => {
      if (message && count) count.textContent = `${message.value.length.toLocaleString()} / 5,000`;
    };
    message?.addEventListener('input', updateCount);
    updateCount();

    const website = qs('#website');
    website?.addEventListener('blur', () => {
      const value = website.value.trim();
      if (value && !/^https?:\/\//i.test(value)) website.value = `https://${value}`;
    });

    const fieldControl = (name) => form.elements.namedItem(name);

    const fieldWrapper = (field) => {
      if (!(field instanceof HTMLElement)) return null;
      return field.closest('.field') || field.closest('.consent')?.parentElement || null;
    };

    const setError = (name, errorMessage) => {
      const field = fieldControl(name);
      const error = qs(`[data-error-for="${name}"]`, form);
      if (field instanceof HTMLElement) {
        field.setAttribute('aria-invalid', errorMessage ? 'true' : 'false');
        fieldWrapper(field)?.classList.toggle('has-error', Boolean(errorMessage));
      }
      if (error) error.textContent = errorMessage || '';
    };

    const validateField = (name) => {
      const field = fieldControl(name);
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return true;

      const value = field.type === 'checkbox' ? field.checked : field.value.trim();
      let error = '';

      if (name === 'consent' && !field.checked) error = 'Consent is required to submit this form.';
      else if (field.required && !value) error = 'This field is required.';
      else if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value))) error = 'Enter a valid email address.';
      else if (name === 'message' && String(value).length < 20) error = 'Please provide at least 20 characters.';
      else if (name === 'website' && value) {
        try {
          const parsed = new URL(String(value));
          if (!['http:', 'https:'].includes(parsed.protocol)) error = 'Enter a valid website address.';
        } catch {
          error = 'Enter a valid website address.';
        }
      }

      setError(name, error);
      return !error;
    };

    [...form.elements].forEach((field) => {
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      field.addEventListener('blur', () => validateField(field.name));
      field.addEventListener('input', () => {
        if (field.getAttribute('aria-invalid') === 'true') validateField(field.name);
      });
      field.addEventListener('change', () => {
        if (field.getAttribute('aria-invalid') === 'true') validateField(field.name);
      });
    });

    const showSuccess = (reference) => {
      if (!successOverlay) return;
      if (successReference) successReference.textContent = reference || 'SELLERY-RECEIVED';
      successOverlay.hidden = false;
      body.classList.add('overlay-open');
      successClose?.focus();
    };

    const closeSuccess = () => {
      if (!successOverlay) return;
      successOverlay.hidden = true;
      body.classList.remove('overlay-open');
    };

    successClose?.addEventListener('click', closeSuccess);
    successOverlay?.addEventListener('click', (event) => {
      if (event.target === successOverlay) closeSuccess();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && successOverlay && !successOverlay.hidden) closeSuccess();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (status) {
        status.textContent = '';
        status.className = 'form-status';
      }

      const fieldsToValidate = [...new Set([...required, 'website'])];
      const valid = fieldsToValidate.map(validateField).every(Boolean);
      if (!valid) {
        if (status) {
          status.textContent = 'Review the highlighted fields before transmitting.';
          status.classList.add('is-error');
        }
        qs('[aria-invalid="true"]', form)?.focus();
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.classList.add('is-loading');
      }
      if (status) status.textContent = 'Creating the PDF and transmitting your inquiry…';

      const data = Object.fromEntries(new FormData(form).entries());
      data.consent = qs('#consent')?.checked === true;
      data.source = window.location.href;
      data.userAgent = navigator.userAgent;

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          const detail = Array.isArray(result.errors) ? result.errors.join(' ') : '';
          throw new Error(result.message || detail || 'The transmission could not be completed.');
        }

        if (status) {
          status.textContent = 'Transmission complete.';
          status.classList.add('is-success');
        }
        form.reset();
        qsa('[aria-invalid="true"]', form).forEach((field) => field.setAttribute('aria-invalid', 'false'));
        qsa('.has-error', form).forEach((wrapper) => wrapper.classList.remove('has-error'));
        qsa('.field-error', form).forEach((error) => { error.textContent = ''; });
        if (startedAt) startedAt.value = String(Date.now());
        updateCount();
        showSuccess(result.reference);
      } catch (error) {
        const localPreview = window.location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(window.location.hostname);
        if (status) {
          status.textContent = localPreview
            ? 'The visual site is working. PDF delivery activates after Vercel deployment and the Resend setup in README.md.'
            : (error instanceof Error ? error.message : 'The transmission could not be completed. Please email info@sellerydigital.com.');
          status.classList.add('is-error');
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.classList.remove('is-loading');
        }
      }
    });
  }

  function initLegalBackLink() {
    qsa('[data-back-home]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
          event.preventDefault();
          window.history.back();
        }
      });
    });
  }

  setCurrentYear();
  initTheme();
  initMobileMenu();
  initHeaderAndProgress();
  initReveal();
  initCursorAura();
  initDepthCards();
  initCanvases();
  initPlatformTabs();
  initModelSteps();
  initIllustrativeControls();
  initActivityStream();
  initPortfolioDialog();
  initIntentRouting();
  initContactForm();
  initLegalBackLink();
})();
