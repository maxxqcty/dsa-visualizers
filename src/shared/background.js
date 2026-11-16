/**
 * Decorative background: slowly drifting nodes joined by faint links, echoing
 * the tree theme. Purely visual (the canvas is aria-hidden), pauses when the
 * tab is hidden, and renders a single still frame under prefers-reduced-motion.
 */
(function () {
    const canvas = document.getElementById("bg");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const LINK_DISTANCE = 150;
    const SPEED = 0.12;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let particles = [];
    let colors = { dot: "#5eead4", line: "#6366f1" };
    let frame = null;

    function readColors() {
        const style = getComputedStyle(document.documentElement);
        colors = {
            dot: style.getPropertyValue("--accent").trim() || colors.dot,
            line: style.getPropertyValue("--node-internal").trim() || colors.line,
        };
    }

    function resize() {
        const ratio = window.devicePixelRatio || 1;
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

        const count = Math.min(40, Math.round((width * height) / 36000));
        particles = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * SPEED,
            vy: (Math.random() - 0.5) * SPEED,
            r: 1.5 + Math.random() * 1.5,
        }));
        draw();
    }

    function step() {
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;
        }
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);

        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const a = particles[i];
                const b = particles[j];
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                if (dist < LINK_DISTANCE) {
                    ctx.globalAlpha = (1 - dist / LINK_DISTANCE) * 0.28;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }

        ctx.fillStyle = colors.dot;
        ctx.globalAlpha = 0.35;
        for (const p of particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function loop() {
        step();
        draw();
        frame = requestAnimationFrame(loop);
    }

    function start() {
        if (frame === null && !reducedMotion.matches && !document.hidden) loop();
    }

    function stop() {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
    }

    function refresh() {
        stop();
        readColors();
        draw();
        start();
    }

    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    reducedMotion.addEventListener("change", refresh);
    window
        .matchMedia("(prefers-color-scheme: light)")
        .addEventListener("change", refresh);

    readColors();
    resize();
    start();
})();
