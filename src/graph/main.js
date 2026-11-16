const SAMPLE = {
    nodes: [
        { id: "A", x: 120, y: 140 },
        { id: "B", x: 330, y: 70 },
        { id: "C", x: 320, y: 280 },
        { id: "D", x: 560, y: 120 },
        { id: "E", x: 560, y: 360 },
        { id: "F", x: 780, y: 230 },
    ],
    edges: [["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5], ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3]],
};

const $ = (id) => document.getElementById(id);
const els = {
    board: $("board"),
    svg: $("graph"),
    algorithm: $("algorithm"),
    sourceField: $("sourceField"),
    source: $("source"),
    addNode: $("addNode"),
    deleteSel: $("deleteSelected"),
    clear: $("clearGraph"),
    sample: $("loadSample"),
    connect: $("connectForm"),
    from: $("edgeFrom"),
    to: $("edgeTo"),
    weight: $("edgeWeight"),
    edgeList: $("edgeList"),
    message: $("message"),
    result: $("result"),
    error: $("error"),
    tableHost: $("tableHost"),
    playerHost: $("playerHost"),
};

function say(text) {
    els.message.textContent = text;
}

const player = createPlayer({
    onShow(step) {
        editor.setOverlay(step);
        els.tableHost.replaceChildren(step.table && step.table.rows.length ? ui.table(step.table.headers, step.table.rows) : "");
    },
});
els.playerHost.append(player.element);

const editor = createGraphEditor({
    svg: els.svg,
    board: els.board,
    onChange: onGraphChange,
});
els.board.addEventListener("graph-message", (event) => say(event.detail));

function resetOutput() {
    player.clear();
    els.result.hidden = true;
    els.result.textContent = "";
    els.tableHost.replaceChildren();
    editor.setOverlay(null);
}

function fillSelect(select, ids) {
    const previous = select.value;
    select.replaceChildren(...ids.map((id) => el("option", { value: id, text: id })));
    if (ids.includes(previous)) select.value = previous;
}

function onGraphChange(graph, structural = true) {
    if (!structural) return; // nodes only moved: the current run is still valid
    const ids = graph.nodes.map((n) => n.id);
    [els.from, els.to, els.source].forEach((select) => fillSelect(select, ids));
    if (ids.length > 1 && els.from.value === els.to.value) els.to.value = ids.find((id) => id !== els.from.value);

    els.edgeList.replaceChildren(
        ...(graph.edges.length
            ? graph.edges.map((e) =>
                  el(
                      "li",
                      {},
                      el("span", { text: `${e.a} — ${e.b}` }),
                      el("strong", { text: `weight ${e.w}` }),
                      el("button", { type: "button", class: "btn btn-secondary btn-tiny", "aria-label": `Remove edge ${e.a} to ${e.b}`, text: "Remove" })
                  )
              )
            : [el("li", { class: "edge-empty", text: "No edges yet." })])
    );
    // Wire the remove buttons (el() can't attach listeners).
    els.edgeList.querySelectorAll("button").forEach((button, i) => button.addEventListener("click", () => editor.removeEdge(graph.edges[i].id)));

    run(); // the visualization follows the graph; Play just animates it
}

function selectedAlgorithm() {
    return els.algorithm.value;
}

function syncSourceField() {
    els.sourceField.hidden = selectedAlgorithm() !== "dijkstra";
}

els.algorithm.addEventListener("change", () => {
    syncSourceField();
    run();
});

/** Run the chosen algorithm on the current graph and load its steps. */
function run() {
    resetOutput();
    const graph = { nodes: editor.graph.nodes.map((n) => n.id), edges: editor.graph.edges.map((e) => ({ ...e })) };
    try {
        const key = selectedAlgorithm();
        const output = key === "dijkstra" ? GRAPH_ALGORITHMS.dijkstra.run(graph, els.source.value) : GRAPH_ALGORITHMS[key].run(graph);
        els.error.textContent = "";
        setMath(els.result, output.result);
        els.result.hidden = false;
        player.load(output.steps);
    } catch (err) {
        els.error.textContent = err.message; // e.g. "Add at least 2 nodes first."
    }
}

els.source.addEventListener("change", run);

els.addNode.addEventListener("click", () => {
    const id = editor.addNode();
    if (id) say(`Added node ${id}.`);
});
els.deleteSel.addEventListener("click", () => {
    if (editor.hasSelection()) editor.removeSelected();
    else say("Select a node or an edge first.");
});
els.clear.addEventListener("click", () => {
    editor.clear();
    say("Board cleared.");
});
els.sample.addEventListener("click", () => {
    editor.load(SAMPLE);
    say("Loaded the sample graph.");
});

els.connect.addEventListener("submit", (event) => {
    event.preventDefault();
    const w = Number(els.weight.value);
    if (!els.from.value || !els.to.value) return say("Add at least two nodes first.");
    if (els.weight.value.trim() === "" || !Number.isInteger(w)) return say("The weight must be a whole number.");
    editor.addEdge(els.from.value, els.to.value, w);
});

syncSourceField();
editor.load(SAMPLE);
