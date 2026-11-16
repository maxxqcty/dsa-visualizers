/**
 * Step player: Previous / Play / Next, a progress slider and a live
 * explanation line. Used by the algorithm labs and the graph visualizer.
 *
 *   const player = createPlayer({ onShow(step, index) { ... } });
 *   container.append(player.element);
 *   player.load([{ text: "...", ...anything onShow needs }]);
 */
const PLAYER_ICONS = {
    prev: { d: "M15 6l-6 6 6 6", fill: false },
    next: { d: "M9 6l6 6-6 6", fill: false },
    play: { d: "M8 5v14l11-7z", fill: true },
    pause: { d: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z", fill: true },
};

function playerIcon(name) {
    const { d, fill } = PLAYER_ICONS[name];
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "btn-icon");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    if (fill) {
        path.setAttribute("fill", "currentColor");
    } else {
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "2.2");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
    }
    svg.append(path);
    return svg;
}

function createPlayer({ onShow }) {
    let steps = [];
    let index = 0;
    let timer = null;

    const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const prev = el("button", { type: "button", class: "btn btn-secondary" }, playerIcon("prev"), "Previous");
    const play = el("button", { type: "button", class: "btn" });
    const next = el("button", { type: "button", class: "btn btn-secondary" }, "Next", playerIcon("next"));
    const setPlaying = (playing) => play.replaceChildren(playerIcon(playing ? "pause" : "play"), playing ? "Pause" : "Play");
    setPlaying(false);
    const slider = el("input", { type: "range", min: 0, max: 0, value: 0, class: "lab-slider", "aria-label": "Step" });
    const counter = el("span", { class: "lab-counter" });
    const explanation = el("p", { class: "lab-explanation", "aria-live": "polite" });

    const element = el(
        "div",
        { class: "lab-player", hidden: true },
        el("div", { class: "player-controls" }, el("div", { class: "btn-group" }, prev, play, next), counter),
        slider,
        explanation
    );

    function show(i) {
        index = Math.max(0, Math.min(steps.length - 1, i));
        const step = steps[index];
        setMath(explanation, step.text);
        onShow(step, index);
        slider.value = String(index);
        counter.textContent = `Step ${index + 1} of ${steps.length}`;
        prev.disabled = index === 0;
        next.disabled = index === steps.length - 1;
    }

    function stop() {
        clearInterval(timer);
        timer = null;
        setPlaying(false);
    }

    function toggle() {
        if (timer) return stop();
        if (index === steps.length - 1) show(0);
        setPlaying(true);
        timer = setInterval(() => {
            if (index >= steps.length - 1) return stop();
            show(index + 1);
        }, reduceMotion() ? 1500 : 900);
    }

    prev.addEventListener("click", () => (stop(), show(index - 1)));
    next.addEventListener("click", () => (stop(), show(index + 1)));
    play.addEventListener("click", toggle);
    slider.addEventListener("input", () => (stop(), show(Number(slider.value))));

    return {
        element,
        load(newSteps) {
            stop();
            steps = newSteps;
            element.hidden = steps.length === 0;
            slider.max = String(Math.max(steps.length - 1, 0));
            if (steps.length) show(0);
        },
        clear() {
            stop();
            steps = [];
            element.hidden = true;
        },
        stop,
        show,
    };
}
