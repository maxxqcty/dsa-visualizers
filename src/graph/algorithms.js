/**
 * Graph algorithms for the spanning tree / shortest path visualizer. Pure logic.
 *
 * A graph is { nodes: ["A", ...], edges: [{ id, a, b, w }] } (undirected).
 * Each algorithm returns { result, steps } where a step is
 *   { text, edges: { [edgeId]: "candidate"|"chosen"|"rejected"|"current" },
 *           nodes: { [nodeId]: "visited"|"current" }, badges: { [nodeId]: "text" },
 *           table: { headers, rows } | null }
 * The renderer maps those states to colours, so this file never touches the DOM.
 */

const edgeName = (e) => `${e.a}–${e.b}`;
const byWeight = (x, y) => x.w - y.w || (x.id < y.id ? -1 : 1);

function snapshot(text, chosen, rejected, current, extra = {}) {
    const edges = {};
    rejected.forEach((id) => (edges[id] = "rejected"));
    chosen.forEach((id) => (edges[id] = "chosen"));
    (extra.candidates || []).forEach((id) => (edges[id] = edges[id] || "candidate"));
    if (current) edges[current] = extra.currentState || "current";
    return { text, edges, nodes: extra.nodes || {}, badges: extra.badges || {}, table: extra.table || null };
}

function chosenTable(graph, chosenIds) {
    const byId = new Map(graph.edges.map((e) => [e.id, e]));
    const rows = chosenIds.map((id) => [edgeName(byId.get(id)), byId.get(id).w]);
    return { headers: ["Edge", "Weight"], rows };
}

function treeResult(graph, chosenIds, label) {
    const byId = new Map(graph.edges.map((e) => [e.id, e]));
    const total = chosenIds.reduce((sum, id) => sum + byId.get(id).w, 0);
    const parts = new DisjointSet(graph.nodes);
    chosenIds.forEach((id) => parts.union(byId.get(id).a, byId.get(id).b));
    const components = new Set(graph.nodes.map((n) => parts.find(n))).size;
    return `${label}: ${chosenIds.length} edge${chosenIds.length === 1 ? "" : "s"}, total weight ${total}${components > 1 ? ` (graph has ${components} separate parts, so this is a spanning forest)` : ""}`;
}

class DisjointSet {
    constructor(items) {
        this.parent = new Map(items.map((i) => [i, i]));
    }
    find(x) {
        while (this.parent.get(x) !== x) {
            this.parent.set(x, this.parent.get(this.parent.get(x)));
            x = this.parent.get(x);
        }
        return x;
    }
    union(a, b) {
        const ra = this.find(a);
        const rb = this.find(b);
        if (ra === rb) return false;
        this.parent.set(ra, rb);
        return true;
    }
}

function checkGraph(graph, minNodes = 2) {
    if (graph.nodes.length < minNodes) throw new Error(`Add at least ${minNodes} nodes first.`);
    if (graph.edges.length === 0) throw new Error("Connect some nodes with edges first.");
}

function kruskal(graph) {
    checkGraph(graph);
    const sorted = graph.edges.slice().sort(byWeight);
    const sets = new DisjointSet(graph.nodes);
    const chosen = [];
    const rejected = [];
    const steps = [snapshot(`Sort all edges by weight: ${sorted.map((e) => `${edgeName(e)}(${e.w})`).join(", ")}.`, [], [], null, { candidates: sorted.map((e) => e.id) })];

    for (const e of sorted) {
        if (sets.union(e.a, e.b)) {
            chosen.push(e.id);
            steps.push(snapshot(`Take ${edgeName(e)} (weight ${e.w}): it connects two separate groups.`, chosen, rejected, e.id, { currentState: "chosen", table: chosenTable(graph, chosen) }));
        } else {
            rejected.push(e.id);
            steps.push(snapshot(`Skip ${edgeName(e)} (weight ${e.w}): ${e.a} and ${e.b} are already connected, so it would form a cycle.`, chosen, rejected, e.id, { currentState: "rejected", table: chosenTable(graph, chosen) }));
        }
    }
    steps.push(snapshot("Done. The chosen edges form the minimum spanning tree.", chosen, rejected, null, { table: chosenTable(graph, chosen) }));
    return { result: treeResult(graph, chosen, "Kruskal"), steps };
}

function prim(graph) {
    checkGraph(graph);
    const visited = new Set();
    const chosen = [];
    const steps = [];
    const nodeStates = () => Object.fromEntries([...visited].map((n) => [n, "visited"]));

    for (const start of graph.nodes) {
        if (visited.has(start)) continue;
        visited.add(start);
        steps.push(snapshot(steps.length ? `The graph is not connected. Start a new tree from ${start}.` : `Start from node ${start}.`, chosen, [], null, { nodes: { ...nodeStates(), [start]: "current" }, table: chosenTable(graph, chosen) }));

        for (;;) {
            const crossing = graph.edges.filter((e) => visited.has(e.a) !== visited.has(e.b));
            if (crossing.length === 0) break;
            crossing.sort(byWeight);
            const best = crossing[0];
            const added = visited.has(best.a) ? best.b : best.a;
            steps.push(snapshot(`Edges leaving the tree: ${crossing.map((e) => `${edgeName(e)}(${e.w})`).join(", ")}. The cheapest is ${edgeName(best)}.`, chosen, [], best.id, { candidates: crossing.map((e) => e.id), nodes: nodeStates(), table: chosenTable(graph, chosen) }));
            chosen.push(best.id);
            visited.add(added);
            steps.push(snapshot(`Add ${edgeName(best)} (weight ${best.w}) and bring in node ${added}.`, chosen, [], null, { nodes: { ...nodeStates(), [added]: "current" }, table: chosenTable(graph, chosen) }));
        }
    }
    steps.push(snapshot("Done. Every node is reached.", chosen, [], null, { nodes: nodeStates(), table: chosenTable(graph, chosen) }));
    return { result: treeResult(graph, chosen, "Prim"), steps };
}

function boruvka(graph) {
    checkGraph(graph);
    const sets = new DisjointSet(graph.nodes);
    const chosen = [];
    const steps = [snapshot("Every node starts as its own group. Each round, every group picks its cheapest edge to another group.", [], [], null)];

    for (let round = 1; ; round++) {
        const cheapest = new Map();
        for (const e of graph.edges.slice().sort(byWeight)) {
            const ra = sets.find(e.a);
            const rb = sets.find(e.b);
            if (ra === rb) continue;
            if (!cheapest.has(ra)) cheapest.set(ra, e);
            if (!cheapest.has(rb)) cheapest.set(rb, e);
        }
        if (cheapest.size === 0) break;

        const picked = [...new Set([...cheapest.values()].map((e) => e.id))];
        const byId = new Map(graph.edges.map((e) => [e.id, e]));
        steps.push(snapshot(`Round ${round}: each group picks its cheapest outgoing edge: ${picked.map((id) => `${edgeName(byId.get(id))}(${byId.get(id).w})`).join(", ")}.`, chosen, [], null, { candidates: picked, table: chosenTable(graph, chosen) }));
        for (const id of picked) {
            const e = byId.get(id);
            if (sets.union(e.a, e.b)) chosen.push(id);
        }
        steps.push(snapshot(`Round ${round}: merge the groups along those edges.`, chosen, [], null, { table: chosenTable(graph, chosen) }));
    }
    steps.push(snapshot("No group has an outgoing edge left. Done.", chosen, [], null, { table: chosenTable(graph, chosen) }));
    return { result: treeResult(graph, chosen, "Borůvka"), steps };
}

function dijkstra(graph, source) {
    checkGraph(graph);
    if (!graph.nodes.includes(source)) throw new Error("Choose a start node.");
    if (graph.edges.some((e) => e.w < 0)) throw new Error("Dijkstra's algorithm needs non-negative weights.");

    const dist = Object.fromEntries(graph.nodes.map((n) => [n, Infinity]));
    const via = {};
    const done = new Set();
    dist[source] = 0;
    const show = (d) => (d === Infinity ? "∞" : d);
    const badges = () => Object.fromEntries(graph.nodes.map((n) => [n, show(dist[n])]));
    const treeEdges = () => Object.values(via);
    const nodeStates = (current) => ({ ...Object.fromEntries([...done].map((n) => [n, "visited"])), ...(current ? { [current]: "current" } : {}) });
    const table = () => ({ headers: ["Node", "Distance", "Via"], rows: graph.nodes.map((n) => [n, show(dist[n]), n === source ? "start" : via[n] ? via[n].replace(/.*:/, "") : "–"]) });
    const viaLabel = {};

    const steps = [snapshot(`Distance to ${source} is 0; every other node is unreachable (∞) for now.`, [], [], null, { nodes: { [source]: "current" }, badges: badges(), table: table() })];

    for (;;) {
        let current = null;
        for (const n of graph.nodes) if (!done.has(n) && dist[n] < Infinity && (current === null || dist[n] < dist[current])) current = n;
        if (current === null) break;
        done.add(current);

        const touched = [];
        const notes = [];
        for (const e of graph.edges) {
            const other = e.a === current ? e.b : e.b === current ? e.a : null;
            if (other === null || done.has(other)) continue;
            touched.push(e.id);
            if (dist[current] + e.w < dist[other]) {
                dist[other] = dist[current] + e.w;
                via[other] = e.id + ":" + current;
                viaLabel[other] = current;
                notes.push(`${other} = ${dist[other]}`);
            }
        }
        steps.push(
            snapshot(
                `Settle ${current} (distance $${dist[current]}$).${touched.length ? ` Relax its edges, $d(v) = \\min\\left(d(v),\\ d(u) + w\\right)$${notes.length ? `: improved ${notes.join(", ")}` : ": no improvements"}.` : " It has no unsettled neighbours."}`,
                treeEdges().map((v) => v.split(":")[0]),
                [],
                null,
                { candidates: touched, nodes: nodeStates(current), badges: badges(), table: table() }
            )
        );
    }
    steps.push(snapshot("Done. Highlighted edges form the shortest-path tree from the start node.", treeEdges().map((v) => v.split(":")[0]), [], null, { nodes: nodeStates(), badges: badges(), table: table() }));
    const reachable = graph.nodes.filter((n) => dist[n] < Infinity).length;
    return { result: `From ${source}: ${graph.nodes.map((n) => `${n}=${show(dist[n])}`).join(", ")}${reachable < graph.nodes.length ? " (some nodes are unreachable)" : ""}`, steps };
}

const GRAPH_ALGORITHMS = {
    kruskal: { name: "Kruskal", run: kruskal },
    prim: { name: "Prim", run: prim },
    boruvka: { name: "Borůvka", run: boruvka },
    dijkstra: { name: "Dijkstra", run: dijkstra },
};
