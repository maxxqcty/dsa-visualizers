/**
 * Interactive graph board (SVG + pointer events).
 *
 *  - click empty space: add a node
 *  - drag a node: move it (arrow keys move the focused node)
 *  - drag from a node's dashed ring onto another node: connect them
 *  - click a weight: edit it; select a node/edge and press Delete to remove it
 *
 * The board owns the graph data; `onChange` fires whenever it changes.
 */
function createGraphEditor({ svg, board, onChange }) {
    const NS = "http://www.w3.org/2000/svg";
    const WIDTH = 900;
    const HEIGHT = 520;
    const NODE_R = 24;
    const MIN_GAP = 64;
    const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    const graph = { nodes: [], edges: [] }; // nodes: { id, x, y }, edges: { id, a, b, w }
    let selected = null; // { type: "node" | "edge", id }
    let drag = null;
    let view = { edges: {}, nodes: {}, badges: {} }; // algorithm overlay
    let focusId = null;

    svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);

    const svgEl = (tag, attrs = {}, ...kids) => {
        const node = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v);
        kids.flat().forEach((kid) => kid && node.append(kid));
        return node;
    };
    const text = (s) => document.createTextNode(String(s));

    // --- Geometry -------------------------------------------------------------
    function toBoard(event) {
        const pt = svg.createSVGPoint();
        pt.x = event.clientX;
        pt.y = event.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        return { x: Math.max(NODE_R, Math.min(WIDTH - NODE_R, p.x)), y: Math.max(NODE_R, Math.min(HEIGHT - NODE_R, p.y)) };
    }
    const nodeById = (id) => graph.nodes.find((n) => n.id === id);
    const edgeId = (a, b) => [a, b].sort().join("-");
    const edgeBetween = (a, b) => graph.edges.find((e) => e.id === edgeId(a, b));

    // --- Rendering --------------------------------------------------------------
    function render() {
        const parts = [];

        for (const e of graph.edges) {
            const a = nodeById(e.a);
            const b = nodeById(e.b);
            const state = view.edges[e.id] || "";
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const nx = (-(b.y - a.y) / len) * 14;
            const ny = ((b.x - a.x) / len) * 14;
            const isSel = selected && selected.type === "edge" && selected.id === e.id;
            parts.push(
                svgEl(
                    "g",
                    { class: `g-edge ${state ? "is-" + state : ""}${isSel ? " is-selected" : ""}`, "data-edge": e.id },
                    svgEl("line", { class: "g-edge-hit", x1: a.x, y1: a.y, x2: b.x, y2: b.y }),
                    svgEl("line", { class: "g-edge-line", x1: a.x, y1: a.y, x2: b.x, y2: b.y }),
                    svgEl("g", { class: "g-weight", "data-weight": e.id, transform: `translate(${mx + nx},${my + ny})` }, svgEl("rect", { x: -16, y: -12, width: 32, height: 24, rx: 6 }), svgEl("text", { y: 5, "text-anchor": "middle" }, text(e.w)))
                )
            );
        }

        if (drag && drag.type === "link") {
            const from = nodeById(drag.from);
            parts.push(svgEl("line", { class: "g-preview", x1: from.x, y1: from.y, x2: drag.x, y2: drag.y }));
        }

        for (const n of graph.nodes) {
            const state = view.nodes[n.id] || "";
            const isSel = selected && selected.type === "node" && selected.id === n.id;
            const target = drag && drag.type === "link" && drag.target === n.id;
            const degree = graph.edges.filter((e) => e.a === n.id || e.b === n.id).length;
            parts.push(
                svgEl(
                    "g",
                    {
                        class: `g-node ${state ? "is-" + state : ""}${isSel ? " is-selected" : ""}${target ? " is-target" : ""}`,
                        "data-node": n.id,
                        transform: `translate(${n.x},${n.y})`,
                        tabindex: "0",
                        role: "button",
                        "aria-label": `Node ${n.id}, ${degree} connection${degree === 1 ? "" : "s"}. Arrow keys move it, Delete removes it.`,
                    },
                    svgEl("circle", { class: "g-port-ring", r: NODE_R + 11 }),
                    svgEl("circle", { class: "g-port", r: NODE_R + 11, "data-port": n.id }),
                    svgEl("circle", { class: "g-body", r: NODE_R }),
                    svgEl("text", { class: "g-label", y: 6, "text-anchor": "middle" }, text(n.id)),
                    view.badges[n.id] !== undefined ? svgEl("text", { class: "g-badge", y: -NODE_R - 8, "text-anchor": "middle" }, text(view.badges[n.id])) : null
                )
            );
        }

        svg.replaceChildren(...parts);
        if (focusId) svg.querySelector(`[data-node="${focusId}"]`)?.focus({ preventScroll: true });
    }

    /** `structural` is false when nodes only moved (the algorithm output stays valid). */
    function changed(structural = true) {
        render();
        onChange(graph, structural);
    }

    // --- Mutations ----------------------------------------------------------------
    function addNode(x, y) {
        const id = LABELS.split("").find((l) => !nodeById(l));
        if (!id) return notify("A graph can have at most 26 nodes.");
        if (x === undefined) {
            // Find a free spot for the "Add node" button.
            for (let i = 0; i < 60; i++) {
                const cand = { x: 80 + Math.random() * (WIDTH - 160), y: 70 + Math.random() * (HEIGHT - 140) };
                if (graph.nodes.every((n) => Math.hypot(n.x - cand.x, n.y - cand.y) > MIN_GAP)) {
                    x = cand.x;
                    y = cand.y;
                    break;
                }
            }
            if (x === undefined) return notify("There's no free space left on the board.");
        }
        graph.nodes.push({ id, x, y });
        focusId = null;
        changed();
        return id;
    }

    function addEdge(a, b, w) {
        if (a === b) return notify("Pick two different nodes.");
        if (edgeBetween(a, b)) {
            edgeBetween(a, b).w = w;
            notify(`Updated the weight of ${a}–${b} to ${w}.`);
        } else {
            graph.edges.push({ id: edgeId(a, b), a: [a, b].sort()[0], b: [a, b].sort()[1], w });
            notify(`Connected ${a} and ${b} with weight ${w}.`);
        }
        changed();
    }

    function removeSelected() {
        if (!selected) return;
        if (selected.type === "node") {
            graph.nodes = graph.nodes.filter((n) => n.id !== selected.id);
            graph.edges = graph.edges.filter((e) => e.a !== selected.id && e.b !== selected.id);
        } else {
            graph.edges = graph.edges.filter((e) => e.id !== selected.id);
        }
        selected = null;
        focusId = null;
        changed();
    }

    function removeEdge(id) {
        graph.edges = graph.edges.filter((e) => e.id !== id);
        if (selected && selected.id === id) selected = null;
        changed();
    }

    function clear() {
        graph.nodes = [];
        graph.edges = [];
        selected = null;
        focusId = null;
        changed();
    }

    function load(sample) {
        graph.nodes = sample.nodes.map((n) => ({ ...n }));
        graph.edges = sample.edges.map(([a, b, w]) => ({ id: edgeId(a, b), a: [a, b].sort()[0], b: [a, b].sort()[1], w }));
        selected = null;
        focusId = null;
        changed();
    }

    function setOverlay(next) {
        view = { edges: next?.edges || {}, nodes: next?.nodes || {}, badges: next?.badges || {} };
        render();
    }

    // --- Weight popover -----------------------------------------------------------
    let popover = null;
    function askWeight(point, initial, title) {
        closePopover();
        return new Promise((resolve) => {
            const input = Object.assign(document.createElement("input"), { type: "text", value: String(initial), inputMode: "decimal", className: "weight-input" });
            input.setAttribute("aria-label", title);
            const ok = Object.assign(document.createElement("button"), { type: "submit", className: "btn weight-ok", textContent: "OK" });
            const form = Object.assign(document.createElement("form"), { className: "weight-pop" });
            const label = Object.assign(document.createElement("span"), { textContent: title });
            form.append(label, input, ok);

            const box = svg.getBoundingClientRect();
            const host = board.getBoundingClientRect();
            form.style.left = `${(point.x / WIDTH) * box.width + (box.left - host.left)}px`;
            form.style.top = `${(point.y / HEIGHT) * box.height + (box.top - host.top)}px`;

            const finish = (value) => {
                closePopover();
                resolve(value);
            };
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                const n = Number(input.value);
                if (input.value.trim() === "" || !Number.isFinite(n) || !Number.isInteger(n)) {
                    input.setCustomValidity("Enter a whole number");
                    input.reportValidity();
                    return;
                }
                finish(n);
            });
            form.addEventListener("keydown", (e) => {
                if (e.key === "Escape") finish(null);
            });
            popover = form;
            board.append(form);
            input.focus();
            input.select();
        });
    }
    function closePopover() {
        popover?.remove();
        popover = null;
    }

    // --- Messages (announced by the page) -----------------------------------------
    function notify(message) {
        board.dispatchEvent(new CustomEvent("graph-message", { detail: message }));
    }

    // --- Pointer interaction ------------------------------------------------------
    svg.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        closePopover();
        const port = event.target.closest("[data-port]");
        const nodeEl = event.target.closest("[data-node]");
        const weightEl = event.target.closest("[data-weight]");
        const edgeEl = event.target.closest("[data-edge]");
        const p = toBoard(event);

        if (port) {
            drag = { type: "link", from: port.dataset.port, x: p.x, y: p.y, target: null, moved: false };
        } else if (nodeEl) {
            const node = nodeById(nodeEl.dataset.node);
            drag = { type: "move", id: node.id, dx: node.x - p.x, dy: node.y - p.y, moved: false };
            selected = { type: "node", id: node.id };
            focusId = node.id;
        } else if (weightEl) {
            drag = { type: "weight", id: weightEl.dataset.weight, moved: false };
        } else if (edgeEl) {
            selected = { type: "edge", id: edgeEl.dataset.edge };
            focusId = null;
            drag = null;
            render();
            return;
        } else {
            drag = { type: "background", x: p.x, y: p.y, moved: false };
            selected = null;
            focusId = null;
        }
        try {
            svg.setPointerCapture(event.pointerId);
        } catch {
            // synthetic or already-released pointer: dragging still works through svg listeners
        }
        event.preventDefault();
        render();
    });

    svg.addEventListener("pointermove", (event) => {
        if (!drag) return;
        const p = toBoard(event);
        drag.moved = drag.moved || Math.hypot(p.x - (drag.x ?? p.x), p.y - (drag.y ?? p.y)) > 3 || drag.type === "move";

        if (drag.type === "move") {
            const node = nodeById(drag.id);
            const nx = Math.max(NODE_R, Math.min(WIDTH - NODE_R, p.x + drag.dx));
            const ny = Math.max(NODE_R, Math.min(HEIGHT - NODE_R, p.y + drag.dy));
            if (nx !== node.x || ny !== node.y) {
                node.x = nx;
                node.y = ny;
                drag.didMove = true;
            }
        } else if (drag.type === "link") {
            drag.x = p.x;
            drag.y = p.y;
            const under = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-node]");
            drag.target = under && under.dataset.node !== drag.from ? under.dataset.node : null;
        }
        render();
    });

    svg.addEventListener("pointerup", async (event) => {
        if (!drag) return;
        const finished = drag;
        drag = null;
        const p = toBoard(event);

        if (finished.type === "link") {
            if (finished.target) {
                const existing = edgeBetween(finished.from, finished.target);
                const a = nodeById(finished.from);
                const b = nodeById(finished.target);
                const w = await askWeight({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, existing ? existing.w : 1, `Weight of ${finished.from}–${finished.target}`);
                if (w !== null) addEdge(finished.from, finished.target, w);
                else render();
            } else render();
        } else if (finished.type === "weight") {
            const edge = graph.edges.find((e) => e.id === finished.id);
            const a = nodeById(edge.a);
            const b = nodeById(edge.b);
            selected = { type: "edge", id: edge.id };
            const w = await askWeight({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, edge.w, `Weight of ${edge.a}–${edge.b}`);
            if (w !== null) addEdge(edge.a, edge.b, w);
            else render();
        } else if (finished.type === "background" && !finished.moved) {
            if (graph.nodes.every((n) => Math.hypot(n.x - p.x, n.y - p.y) > MIN_GAP)) addNode(p.x, p.y);
            else notify("Too close to another node.");
        } else if (finished.type === "move" && finished.didMove) {
            changed(false);
        } else {
            render();
        }
    });

    svg.addEventListener("pointercancel", () => {
        drag = null;
        render();
    });

    // --- Keyboard -------------------------------------------------------------------
    svg.addEventListener("keydown", (event) => {
        const nodeEl = event.target.closest?.("[data-node]");
        if (!nodeEl) return;
        const node = nodeById(nodeEl.dataset.node);
        const step = event.shiftKey ? 30 : 10;
        const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (moves[event.key]) {
            event.preventDefault();
            node.x = Math.max(NODE_R, Math.min(WIDTH - NODE_R, node.x + moves[event.key][0]));
            node.y = Math.max(NODE_R, Math.min(HEIGHT - NODE_R, node.y + moves[event.key][1]));
            focusId = node.id;
            changed(false);
        } else if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            selected = { type: "node", id: node.id };
            removeSelected();
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selected = { type: "node", id: node.id };
            focusId = node.id;
            render();
        }
    });

    document.addEventListener("keydown", (event) => {
        if ((event.key === "Delete" || event.key === "Backspace") && selected && selected.type === "edge" && !popover && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName)) {
            event.preventDefault();
            removeSelected();
        }
    });

    render();
    return {
        graph,
        addNode,
        addEdge,
        removeEdge,
        removeSelected,
        clear,
        load,
        setOverlay,
        hasSelection: () => !!selected,
    };
}
