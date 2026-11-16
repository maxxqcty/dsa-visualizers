const els = {
    title: document.getElementById("title"),
    subtitle: document.getElementById("subtitle"),
    modeInputs: document.querySelectorAll('input[name="mode"]'),
    input: document.getElementById("valueInput"),
    error: document.getElementById("error"),
    insertButton: document.getElementById("insertBtn"),
    searchButton: document.getElementById("searchBtn"),
    deleteButton: document.getElementById("deleteBtn"),
    clearButton: document.getElementById("clearBtn"),
    tree: document.getElementById("tree"),
    pathDisplay: document.getElementById("pathDisplay"),
    status: document.getElementById("status"),
    depthDisplay: document.getElementById("treeDepthDisplay"),
    balanceToggle: document.getElementById("balanceToggle"),
    rotationLog: document.getElementById("rotationLog"),
    rotationList: document.getElementById("rotationList"),
};

const MODES = {
    bst: {
        title: "Binary Tree",
        subtitle: "A data structure for hierarchical relationships",
        kind: "Binary tree",
        showRotations: false,
        engine: {
            insert: (root, value) => insertBst(root, value),
            remove: (root, value) => deleteBst(root, value),
        },
    },
    avl: {
        title: "AVL Tree",
        subtitle: "A self-balancing binary search tree",
        kind: "AVL tree",
        showRotations: true,
        engine: {
            insert: (root, value, log) => insertAvl(root, value, log),
            remove: (root, value, log) => deleteAvl(root, value, log),
        },
    },
};

let mode = "bst";

// Each mode keeps its own tree, so switching back and forth doesn't lose work.
const views = {};
for (const [name, config] of Object.entries(MODES)) {
    views[name] = createTreeView({
        els,
        engine: config.engine,
        kind: config.kind,
        isActive: () => name === mode,
        onChange: (root, rotations) => {
            if (name === mode) updateReadouts(root, rotations);
        },
    });
}

// --- Readouts -----------------------------------------------------------------

function updateReadouts(root, rotations) {
    const depth = treeDepth(root);
    els.depthDisplay.textContent = depth > 0 ? `Tree Depth: ${depth}` : "";
    els.depthDisplay.hidden = depth === 0;

    const entries = rotations.length ? rotations : ["No rotations yet."];
    els.rotationList.replaceChildren(
        ...entries.map((text) => {
            const item = document.createElement("li");
            item.textContent = text;
            return item;
        })
    );
}

function setMode(next) {
    if (!MODES[next] || next === mode) return;

    views[mode].hide();
    mode = next;

    els.title.textContent = MODES[mode].title;
    els.subtitle.textContent = MODES[mode].subtitle;
    document.title = `${MODES[mode].title} Generator`;
    els.rotationLog.hidden = !MODES[mode].showRotations;
    els.pathDisplay.textContent = "";
    els.error.textContent = "";

    views[mode].show();
    els.status.textContent = `${MODES[mode].title} mode.`;
    els.input.focus();
}

// --- Events -------------------------------------------------------------------

const active = () => views[mode];

els.modeInputs.forEach((radio) =>
    radio.addEventListener("change", () => radio.checked && setMode(radio.value))
);
els.insertButton.addEventListener("click", () => active().insert());
els.searchButton.addEventListener("click", () => active().search());
els.deleteButton.addEventListener("click", () => active().remove());
els.clearButton.addEventListener("click", () => active().clear());

// Shortcuts only apply while the value field has focus, so they never hijack
// typing elsewhere on the page.
els.input.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const actions = {
        enter: () => active().insert(),
        i: () => active().insert(),
        s: () => active().search(),
        d: () => active().remove(),
    };
    const action = actions[event.key.toLowerCase()];
    if (action) {
        event.preventDefault();
        action();
    }
});

els.balanceToggle.addEventListener("change", () =>
    els.tree.classList.toggle("show-balance", els.balanceToggle.checked)
);
els.tree.classList.toggle("show-balance", els.balanceToggle.checked);

views[mode].show();
