/** Huffman coding: build the tree by repeatedly merging the two least frequent nodes. */

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value !== null && value !== undefined && value !== false) node.setAttribute(key, value);
    }
    children.flat().forEach((child) => child && node.append(child));
    return node;
}

const NODE_R = 22;
const X_STEP = 58;
const Y_STEP = 70;

/** Draw a forest of Huffman subtrees; `marked` is a Set of node ids to highlight. */
function drawForest(trees, marked, showBits) {
    const parts = [];
    let column = 0;
    let maxDepth = 0;

    function place(node, depth) {
        if (!node) return null;
        const left = place(node.left, depth + 1);
        const x = column++ * X_STEP;
        const right = place(node.right, depth + 1);
        maxDepth = Math.max(maxDepth, depth);
        return { node, x, y: depth * Y_STEP, left, right };
    }

    const placed = trees.map((tree) => {
        const layout = place(tree, 0);
        column += 0.6; // gap between separate trees
        return layout;
    });

    function draw(p) {
        if (!p) return;
        for (const [child, bit] of [[p.left, "0"], [p.right, "1"]]) {
            if (!child) continue;
            parts.push(svgEl("line", { class: "huff-edge", x1: p.x, y1: p.y, x2: child.x, y2: child.y }));
            if (showBits) {
                parts.push(svgEl("text", { class: "huff-bit", x: (p.x + child.x) / 2 + (bit === "0" ? -9 : 9), y: (p.y + child.y) / 2, "text-anchor": "middle" }, document.createTextNode(bit)));
            }
        }
        draw(p.left);
        draw(p.right);
    }
    placed.forEach(draw);

    function nodes(p) {
        if (!p) return;
        nodes(p.left);
        nodes(p.right);
        const leaf = !p.node.left && !p.node.right;
        parts.push(
            svgEl(
                "g",
                { class: `huff-node ${leaf ? "leaf" : "internal"}${marked.has(p.node.id) ? " marked" : ""}`, transform: `translate(${p.x},${p.y})` },
                svgEl("circle", { r: NODE_R }),
                svgEl("text", { y: leaf ? -2 : 5, "text-anchor": "middle" }, document.createTextNode(leaf ? p.node.symbol : p.node.freq)),
                leaf ? svgEl("text", { class: "huff-freq", y: 12, "text-anchor": "middle" }, document.createTextNode(p.node.freq)) : null
            )
        );
    }
    placed.forEach(nodes);

    const width = Math.max(column * X_STEP, X_STEP) + NODE_R * 2;
    const height = maxDepth * Y_STEP + NODE_R * 2 + 14;
    return svgEl(
        "svg",
        { class: "huff-svg", viewBox: `${-NODE_R - 4} ${-NODE_R - 4} ${width} ${height}`, style: `width:${width}px;max-width:100%;height:auto`, role: "img", "aria-label": "Huffman tree" },
        parts
    );
}

function buildHuffman(symbols, freqs) {
    let nextId = 1;
    let forest = symbols.map((symbol, i) => ({ id: nextId++, symbol, freq: freqs[i], left: null, right: null }));
    const snapshots = [{ forest: forest.slice(), marked: new Set(), text: `Start with one node per symbol: ${forest.map((n) => `${n.symbol}(${n.freq})`).join(", ")}.` }];
    const order = (a, b) => a.freq - b.freq || a.id - b.id;

    while (forest.length > 1) {
        forest.sort(order);
        const [a, b] = forest;
        const parent = { id: nextId++, symbol: null, freq: a.freq + b.freq, left: a, right: b };
        forest = [parent, ...forest.slice(2)];
        forest.sort(order);
        snapshots.push({
            forest: forest.slice(),
            marked: new Set([parent.id]),
            text: `Merge the two smallest: ${label(a)} ($${a.freq}$) and ${label(b)} ($${b.freq}$) into a new node of weight $${a.freq} + ${b.freq} = ${parent.freq}$.`,
        });
    }
    const root = forest[0];

    const codes = {};
    (function walk(node, prefix) {
        if (!node.left && !node.right) {
            codes[node.symbol] = prefix || "0";
            return;
        }
        walk(node.left, prefix + "0");
        walk(node.right, prefix + "1");
    })(root, "");
    return { snapshots, root, codes };
}

function label(node) {
    return node.symbol ?? `[${node.freq}]`;
}

function huffmanSteps(symbols, freqs, extraFinal) {
    const { snapshots, root, codes } = buildHuffman(symbols, freqs);
    const steps = snapshots.map((snap) => ({
        text: snap.text,
        draw: (stage) => stage.append(drawForest(snap.forest, snap.marked, false)),
    }));

    const rows = symbols.map((s, i) => [s, freqs[i], codes[s], codes[s].length, codes[s].length * freqs[i]]);
    rows.sort((a, b) => a[3] - b[3] || b[1] - a[1]);
    const total = rows.reduce((sum, r) => sum + r[4], 0);
    const totalFreq = freqs.reduce((a, b) => a + b, 0);
    const fixedBits = Math.max(1, Math.ceil(Math.log2(symbols.length)));
    steps.push({
        text: `Label every left edge $0$ and every right edge $1$. Reading from the root to a leaf gives that symbol's code. Total: $\\sum f_i \\ell_i = ${total}$ bits, versus $${fixedBits * totalFreq}$ with fixed $${fixedBits}$-bit codes.`,
        draw: (stage) => {
            stage.append(drawForest([root], new Set(), true));
            stage.append(ui.table(["Symbol", "$f_i$", "Code", "$\\ell_i$", "$f_i \\cdot \\ell_i$"], rows));
            if (extraFinal) stage.append(extraFinal(codes));
        },
    });
    return { steps, total, codes, root };
}

const huffmanFrequencies = {
    id: "freq",
    name: "Symbols & frequencies",
    description: "Give each symbol a frequency $f_i$. Huffman coding gives frequent symbols short codes: repeatedly merge the two least frequent nodes until one tree remains. The total size is $\\sum_i f_i \\cdot \\ell_i$, where $\\ell_i$ is the code length.",
    fields: [
        {
            id: "pairs",
            label: "Symbols and frequencies",
            type: "rows",
            sep: ":",
            maxRows: 16,
            columns: [{ label: "Symbol", placeholder: "A" }, { label: "Frequency", type: "number" }],
            value: "A:5, B:9, C:12, D:13, E:16, F:45",
        },
    ],
    examples: [
        { name: "Textbook (6 symbols)", values: { pairs: "A:5, B:9, C:12, D:13, E:16, F:45" } },
        { name: "Equal frequencies", values: { pairs: "A:1, B:1, C:1, D:1" } },
        { name: "Skewed", values: { pairs: "A:50, B:20, C:10, D:5, E:3, F:2" } },
    ],
    random() {
        const count = randInt(4, 7);
        return { pairs: "ABCDEFGH".slice(0, count).split("").map((s) => `${s}:${randInt(1, 40)}`).join(", ") };
    },
    run({ pairs }) {
        const entries = pairs.split(/\s*,\s*/).filter(Boolean).map((item) => {
            const at = item.lastIndexOf(":");
            if (at < 1) throw new Error(`"${item}" needs a symbol and a frequency.`);
            return [item.slice(0, at).trim(), Number(item.slice(at + 1))];
        });
        const symbols = entries.map((e) => e[0]);
        const freqs = entries.map((e) => e[1]);
        freqs.forEach((f) => {
            if (!Number.isInteger(f)) throw new Error("Frequencies must be whole numbers.");
        });
        if (symbols.length < 2) throw new Error("Enter at least two symbols.");
        if (symbols.length > 16) throw new Error("Use at most 16 symbols.");
        if (new Set(symbols).size !== symbols.length) throw new Error("Each symbol must be different.");
        if (symbols.length !== freqs.length) throw new Error(`There are ${symbols.length} symbols but ${freqs.length} frequencies.`);
        if (freqs.some((f) => f <= 0)) throw new Error("Frequencies must be positive.");
        const { steps, total } = huffmanSteps(symbols, freqs);
        return { result: `Total encoded size: ${total} bits`, steps };
    },
};

const huffmanText = {
    id: "text",
    name: "From text",
    description: "Count how often each character appears in a message, build the Huffman tree, and encode the message.",
    fields: [{ id: "text", label: "Message", multiline: true, hint: "Up to 120 characters", value: "abracadabra alakazam" }],
    examples: [
        { name: "abracadabra alakazam", values: { text: "abracadabra alakazam" } },
        { name: "Mississippi", values: { text: "mississippi river" } },
        { name: "Repetitive text", values: { text: "aaaaaaaabbbbccd" } },
    ],
    run({ text }) {
        if (!text) throw new Error("Enter some text.");
        if (text.length > 120) throw new Error("Use at most 120 characters.");
        const counts = new Map();
        for (const ch of text) counts.set(ch, (counts.get(ch) || 0) + 1);
        if (counts.size < 2) throw new Error("Use at least two different characters.");
        if (counts.size > 16) throw new Error("Use at most 16 different characters.");
        const name = (ch) => (ch === " " ? "␣" : ch);
        const symbols = [...counts.keys()].map(name);
        const freqs = [...counts.values()];
        const { steps, total, codes } = huffmanSteps(symbols, freqs, (codeMap) => {
            const bits = [...text].map((ch) => codeMap[name(ch)]).join("");
            return ui.line(`Encoded (${bits.length} bits):`, bits.length > 160 ? bits.slice(0, 160) + "…" : bits);
        });
        const bits = [...text].map((ch) => codes[name(ch)]).join("");
        return { result: `${text.length} characters → ${bits.length} bits (was ${text.length * 8} in 8-bit ASCII)`, steps };
    },
};

createLab({ mount: document.getElementById("lab"), algorithms: [huffmanFrequencies, huffmanText] });
