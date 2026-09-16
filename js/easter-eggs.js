// ============================================
// Modak Easter Eggs & Sensory Delights
// Handcrafted with care — Zero AI slop
// ============================================

let modakClickCount = 0;
const MODAK_GOAL = 21; // Sacred 21 Modaks of Lord Ganesha
let typingBuffer = '';
let celebrationActive = false;

/**
 * Initialize all Modak Easter Eggs
 */
export function initEasterEggs() {
    printConsoleEasterEgg();
    setupLogoClicks();
    setupKeyboardTriggers();
}

/**
 * Console ASCII Art & Welcome Message
 */
function printConsoleEasterEgg() {
    const bannerStyle = `
        color: #0f5948;
        font-weight: 700;
        font-size: 13px;
        line-height: 1.4;
        font-family: monospace;
    `;
    const subStyle = `
        color: #d97706;
        font-weight: 600;
        font-size: 11px;
        font-family: sans-serif;
    `;
    const tipStyle = `
        color: #64748b;
        font-style: italic;
        font-size: 10px;
    `;

    console.log(
        `%c
       /\\
      /  \\       MODAK • Garden Estate
     / || \\      Expense & Festival Transparency Tracker
    / /||\\ \\     Handcrafted with Pine, Slate & Zero AI Slop.
   (________)    Ganpati Bappa Morya! 🙏
%c✨ Secret hint: Click the Modak logo 21 times or type "modak" on your keyboard!
%cDesigned with devotion for transparency, trust & community celebration.`,
        bannerStyle,
        subStyle,
        tipStyle
    );
}

/**
 * Logo click wobbles & 21 Modaks Offering Counter
 */
function setupLogoClicks() {
    document.addEventListener('click', (e) => {
        const logoTarget = e.target.closest('.logo-icon, .public-logo, #modak-logo-public');
        if (!logoTarget) return;

        modakClickCount++;
        playWobbleAnimation(logoTarget);
        spawnFloatingModak(e.clientX, e.clientY, modakClickCount);

        if (modakClickCount === MODAK_GOAL) {
            triggerModakCelebration('🎉 Bappa Morya! You completed the 21 Modaks offering! May your society prosper with zero deficit and absolute harmony!');
            modakClickCount = 0; // Reset for next time
        }
    });
}

/**
 * Tactile squash & stretch wobble animation
 */
function playWobbleAnimation(element) {
    element.style.transition = 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)';
    const rot = (Math.random() - 0.5) * 16;
    element.style.transform = `scale(0.88, 1.15) rotate(${rot}deg)`;
    setTimeout(() => {
        element.style.transform = `scale(1.12, 0.92) rotate(${-rot * 0.5}deg)`;
        setTimeout(() => {
            element.style.transform = 'scale(1) rotate(0deg)';
        }, 150);
    }, 120);
}

/**
 * Floating "+1 🥟" particle effect at click coordinates
 */
function spawnFloatingModak(x, y, count) {
    const el = document.createElement('div');
    el.className = 'floating-modak-particle';
    el.innerHTML = count === MODAK_GOAL 
        ? `🌟 <strong>21/21!</strong>` 
        : `🥟 <span>+${count}</span>`;
    
    // Add particle styling
    Object.assign(el.style, {
        position: 'fixed',
        left: `${x - 15}px`,
        top: `${y - 15}px`,
        pointerEvents: 'none',
        zIndex: '99999',
        fontSize: '0.85rem',
        fontWeight: '700',
        color: '#b45309',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(254, 243, 199, 0.95)',
        border: '1px solid #f59e0b',
        borderRadius: '9999px',
        padding: '2px 8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transform: 'translateY(0) scale(0.8)',
        opacity: '1',
        transition: 'all 0.85s cubic-bezier(0.22, 1, 0.36, 1)'
    });

    document.body.appendChild(el);

    // Animate upward float
    requestAnimationFrame(() => {
        el.style.transform = `translateY(-48px) scale(1.05)`;
        el.style.opacity = '0';
    });

    setTimeout(() => {
        el.remove();
    }, 900);
}

/**
 * Keyboard secret word triggers: "modak" or "bappa" or Konami Code
 */
function setupKeyboardTriggers() {
    const konamiCode = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let konamiIndex = 0;

    window.addEventListener('keydown', (e) => {
        // Ignore typing inside inputs/textareas
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
            return;
        }

        // Konami code check
        if (e.key === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                konamiIndex = 0;
                triggerModakCelebration('🕹️ Retro Modak Code Unlocked! Maximum festive prosperity activated!');
            }
        } else {
            konamiIndex = 0;
        }

        // Keyword check ("modak" or "bappa")
        if (/^[a-zA-Z]$/.test(e.key)) {
            typingBuffer = (typingBuffer + e.key.toLowerCase()).slice(-8);
            if (typingBuffer.endsWith('modak')) {
                typingBuffer = '';
                triggerModakCelebration('🥟 Sweet Modak Blessing! May your festive accounts be sweet and transparent!');
            } else if (typingBuffer.endsWith('bappa')) {
                typingBuffer = '';
                triggerModakCelebration('🙏 Ganpati Bappa Morya! Mangal Murti Morya!');
            }
        }
    });
}

/**
 * Play a soothing, harmonious celebration chime via Web Audio API (Zero external assets)
 */
function playCelebrationChime() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        // Pentatonic celebration notes (C5, D5, E5, G5, A5, C6)
        const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

            gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.08 + 0.55);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(ctx.currentTime + idx * 0.08);
            osc.stop(ctx.currentTime + idx * 0.08 + 0.6);
        });
    } catch (e) {
        // Autoplay policy or unsupported audio
    }
}

/**
 * Full Festive Celebration (Golden modaks & flower confetti)
 */
export function triggerModakCelebration(message = '🥟 Ganpati Bappa Morya!') {
    if (celebrationActive) return;
    celebrationActive = true;

    playCelebrationChime();

    // Show festive celebration modal toast
    const toast = document.createElement('div');
    toast.className = 'modak-celebration-toast';
    toast.innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 0.35rem; animation: pulse 1s infinite alternate;">🥟</div>
        <div style="font-weight: 700; font-size: 1rem; color: #78350f; margin-bottom: 0.25rem;">Festival Blessing</div>
        <div style="font-size: 0.825rem; color: #92400e; line-height: 1.4;">${message}</div>
    `;

    Object.assign(toast.style, {
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%) translateY(-20px) scale(0.95)',
        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
        border: '2px solid #f59e0b',
        borderRadius: '16px',
        padding: '1rem 1.5rem',
        textAlign: 'center',
        zIndex: '100000',
        boxShadow: '0 20px 40px -10px rgba(180, 83, 9, 0.4), 0 0 0 1px rgba(245, 158, 11, 0.3)',
        opacity: '0',
        transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0) scale(1)';
    });

    // Canvas Confetti Shower
    createConfettiShower();

    // Dismiss toast after 4.5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px) scale(0.95)';
        setTimeout(() => {
            toast.remove();
            celebrationActive = false;
        }, 400);
    }, 4500);
}

/**
 * Lightweight Canvas Confetti Shower (Zero dependencies)
 */
function createConfettiShower() {
    // Respect user's motion preferences
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99998';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // 60 confetti particles: golden amber, warm saffron, emerald pine, and flower petals
    const colors = ['#f59e0b', '#d97706', '#fbbf24', '#0f5948', '#14725c', '#ef4444', '#fef08a'];
    const particles = Array.from({ length: 65 }, () => ({
        x: Math.random() * width,
        y: Math.random() * -height * 0.8,
        w: Math.random() * 8 + 5,
        h: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 2.5,
        vy: Math.random() * 3 + 2.5,
        angle: Math.random() * 360,
        va: (Math.random() - 0.5) * 4,
        isModak: Math.random() < 0.25 // 25% of particles are mini golden modaks!
    }));

    let startTime = performance.now();
    const DURATION = 3800; // 3.8 seconds

    function draw(time) {
        const elapsed = time - startTime;
        if (elapsed > DURATION) {
            window.removeEventListener('resize', onResize);
            canvas.remove();
            return;
        }

        ctx.clearRect(0, 0, width, height);

        const fade = elapsed > DURATION - 800 ? (DURATION - elapsed) / 800 : 1;
        ctx.globalAlpha = Math.max(0, Math.min(1, fade));

        particles.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.angle += p.va;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.angle * Math.PI) / 180);

            if (p.isModak) {
                // Draw a mini golden modak dumpling shape
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.moveTo(0, -6);
                ctx.bezierCurveTo(-2, -3, -5, 2, -4, 5);
                ctx.bezierCurveTo(-3, 6.5, 3, 6.5, 4, 5);
                ctx.bezierCurveTo(5, 2, 2, -3, 0, -6);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#b45309';
                ctx.lineWidth = 0.8;
                ctx.stroke();
            } else {
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            }

            ctx.restore();
        });

        requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
}
