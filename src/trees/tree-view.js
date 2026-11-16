/**
 * Controller for one kind of tree (binary or AVL). It owns a persistent tree
 * and animates Insert / Search / Delete / Clear on it.
 *
 * `engine` supplies the tree logic:
 *   insert(root, value, log) -> root     remove(root, value, log) -> root
 * `onChange(root, rotationHistory)` fires after every change so the page can
 * refresh its depth and rotation readouts. Event wiring lives in main.js.
 */
function createTreeView({ els, engine, kind, onChange, isActive = () => true }) {
    const MAX_HISTORY = 30;
    const STEP_MS = 280;
    const MARK_CLASSES = ["gold", "green", "exist"];

    let root = null;
    let busy = false;
    let history = [];
    let errorTimer = null;
    let clearTimer = null;

    const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, reduceMotion() ? 0 : ms));

    // --- Feedback -----------------------------------------------------------

    function showError(message) {
        els.error.textContent = message;
        els.error.classList.remove("shake");
        void els.error.offsetWidth; // restart the shake animation
        els.error.classList.add("shake");
        clearTimeout(errorTimer);
        errorTimer = setTimeout(() => {
            els.error.textContent = "";
            els.error.classList.remove("shake");
        }, 2000);
    }

    function clearMarks() {
        clearTimeout(clearTimer);
        els.tree.querySelectorAll("circle").forEach((c) => c.classList.remove(...MARK_CLASSES));
        els.tree.querySelectorAll(".link").forEach((l) => l.classList.remove("active"));
    }

    function circleOf(value) {
        for (const node of els.tree.querySelectorAll(".node")) {
            if (node.dataset.value === String(value)) return node.querySelector("circle");
        }
        return null;
    }

    /** Light up each node on the path in turn; the last one gets `finalClass`. */
    async function walk(path, finalClass) {
        for (let i = 0; i < path.length; i++) {
            const isLast = i === path.length - 1;
            circleOf(path[i].value)?.classList.add(isLast ? finalClass : "gold");
            await sleep(STEP_MS);
        }
    }

    function render() {
        if (!isActive()) return; // an operation finishing after a mode switch
        drawTree(els.tree, root, describeTree(root, kind));
        onChange(root, history);
    }

    function record(entries) {
        history = history.concat(entries).slice(-MAX_HISTORY);
    }

    // --- Operations ---------------------------------------------------------

    /** Numbers typed in the value field, or null (after showing an error). */
    function readValues({ single }) {
        const raw = els.input.value.trim();
        if (raw === "") {
            showError("You must enter a value.");
            return null;
        }
        const values = parseInput(raw);
        if (values.length === 0) {
            showError("Enter a valid number.");
            return null;
        }
        if (single && values.length > 1) {
            showError("Enter a single value.");
            return null;
        }
        return values;
    }

    async function operate(options, task) {
        if (busy) return;
        const values = readValues(options);
        if (values === null) return;

        busy = true;
        clearMarks();
        els.pathDisplay.textContent = "";
        try {
            await task(values);
        } finally {
            busy = false;
            els.input.value = "";
            els.input.focus();
        }
    }

    // Insert accepts several space-separated values and adds them in order.
    const insert = () =>
        operate({ single: false }, async (values) => {
            for (const value of values) {
                const { path, found } = traverse(root, value);
                await walk(path, found ? "exist" : "gold");
                if (found) {
                    showError(`${value} already exists.`);
                    await sleep(400);
                    clearMarks();
                    continue;
                }
                const log = [];
                root = engine.insert(root, value, log);
                record(log);
                clearMarks();
                render();
                await sleep(550); // let the slide / pop-in finish
            }
            els.status.textContent = `Inserted ${values.join(", ")}.`;
        });

    const search = () =>
        operate({ single: true }, async ([value]) => {
            const { path, found } = traverse(root, value);
            els.pathDisplay.textContent = found ? describePath(path) : "";
            await walk(path, found ? "green" : "gold");
            if (found) {
                els.tree.querySelectorAll(".link").forEach((link) => {
                    const onPath = path.some((step) => String(step.value) === link.dataset.target);
                    link.classList.toggle("active", onPath);
                });
            } else {
                showError("Node not found :(");
            }
            clearTimer = setTimeout(() => {
                clearMarks();
                els.pathDisplay.textContent = "";
            }, 3000);
        });

    const remove = () =>
        operate({ single: true }, async ([value]) => {
            const { path, found } = traverse(root, value);
            await walk(path, found ? "exist" : "gold");
            if (!found) {
                showError("Node not found :(");
                clearTimer = setTimeout(clearMarks, 1000);
                return;
            }
            const log = [];
            root = engine.remove(root, value, log);
            record(log);
            clearMarks();
            render();
            els.status.textContent = `Deleted ${value}.`;
        });

    function clear() {
        if (busy) return;
        clearMarks();
        root = null;
        history = [];
        els.pathDisplay.textContent = "";
        render();
        els.status.textContent = "Tree cleared.";
        els.input.focus();
    }

    return {
        insert,
        search,
        remove,
        clear,
        show: render,
        hide() {
            clearMarks();
            clearTree(els.tree);
        },
    };
}
