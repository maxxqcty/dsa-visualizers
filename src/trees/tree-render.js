/**
 * Animated D3 (v3) rendering for the tree view (binary and AVL). Nodes are
 * keyed by value and persist between calls, so when the tree changes they
 * slide to their new positions (rotations are visible), new nodes pop in and
 * removed nodes fade out.
 */

const TREE_LEVEL_HEIGHT = 90;
const TREE_NODE_SPACING = 64;
const TREE_RADIUS = 25;
const TREE_PADDING = 60;
const TREE_MOVE_MS = 500;

/**
 * Assign x/y to every node. x is the node's in-order position, so the tree
 * stays compact (width grows linearly with node count) and nothing overlaps.
 */
function layoutTree(root) {
    const nodes = [];
    const links = [];
    let column = 0;

    (function place(node, depth, parent) {
        if (!node) return 0;

        // Reserve this node's slot first so a parent and its links can refer
        // to it, but fill x in only after the left subtree is placed.
        const entry = {
            value: node.value,
            x: 0,
            y: depth * TREE_LEVEL_HEIGHT,
            balance: 0,
            leaf: !node.left && !node.right,
        };
        nodes.push(entry);
        if (parent) links.push({ key: node.value, source: parent, target: entry });

        const leftHeight = place(node.left, depth + 1, entry);
        entry.x = column++ * TREE_NODE_SPACING;
        const rightHeight = place(node.right, depth + 1, entry);

        entry.balance = leftHeight - rightHeight;
        return 1 + Math.max(leftHeight, rightHeight);
    })(root, 0, null);

    return { nodes, links };
}

function drawTree(container, root, label = "") {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const move = reduceMotion ? 0 : TREE_MOVE_MS;

    const { nodes, links } = layoutTree(root);

    // Size the canvas to the tree and keep it centred on its own bounds.
    const xs = nodes.map((n) => n.x);
    const minX = nodes.length ? Math.min(...xs) : 0;
    const maxX = nodes.length ? Math.max(...xs) : 0;
    const maxY = nodes.length ? Math.max(...nodes.map((n) => n.y)) : 0;
    const width = maxX - minX + TREE_PADDING * 2;
    const height = maxY + TREE_PADDING * 2;
    const offsetX = TREE_PADDING - minX;
    const offsetY = TREE_PADDING;

    let svg = d3.select(container).select("svg.tree-svg");
    if (svg.empty()) {
        container.querySelectorAll("svg").forEach((old) => old.remove());
        svg = d3.select(container).append("svg").attr("class", "tree-svg");
        svg.append("g").attr("class", "canvas");
    }
    // A viewBox lets the diagram scale down to fit the page instead of
    // overflowing or forcing a horizontal scroll.
    svg.attr("viewBox", `0 0 ${width} ${height}`)
        .style("width", `${width}px`)
        .style("max-width", "100%")
        .style("height", "auto")
        .attr("role", "img")
        .attr("aria-label", label);

    const canvas = svg.select("g.canvas");
    canvas
        .transition()
        .duration(move)
        .attr("transform", `translate(${offsetX},${offsetY})`);

    const diagonal = d3.svg.diagonal().projection((d) => [d.x, d.y]);

    // Links (keyed by child value) are inserted first so they sit under nodes.
    const linkSel = canvas.selectAll("path.link").data(links, (d) => d.key);
    linkSel
        .enter()
        .insert("path", ":first-child")
        .attr("class", "link")
        .attr("data-target", (d) => d.key)
        .attr("d", diagonal)
        .style("opacity", 0);
    linkSel
        .transition()
        .duration(move)
        .attr("d", diagonal)
        .style("opacity", 1);
    linkSel.exit().transition().duration(move / 2).style("opacity", 0).remove();

    // Nodes (keyed by value).
    const nodeSel = canvas.selectAll("g.node").data(nodes, (d) => d.value);

    const entering = nodeSel
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("aria-hidden", "true")
        .attr("transform", (d) => `translate(${d.x},${d.y})`);
    entering
        .append("circle")
        .attr("r", reduceMotion ? TREE_RADIUS : 0)
        .transition()
        .duration(reduceMotion ? 0 : 700)
        .ease("elastic")
        .attr("r", TREE_RADIUS);
    entering.append("text").attr("class", "value").attr("y", 5).attr("text-anchor", "middle");
    entering
        .append("text")
        .attr("class", "balance")
        .attr("x", TREE_RADIUS + 4)
        .attr("y", -TREE_RADIUS + 6);

    nodeSel.attr("data-value", (d) => d.value);
    nodeSel.select("text.value").text((d) => d.value);
    nodeSel.select("text.balance").text((d) => (d.balance > 0 ? `+${d.balance}` : d.balance));
    nodeSel.select("circle").each(function (d) {
        d3.select(this).classed("internal", !d.leaf).classed("leaf", d.leaf);
    });
    nodeSel
        .transition()
        .duration(move)
        .attr("transform", (d) => `translate(${d.x},${d.y})`);

    nodeSel.exit().transition().duration(move / 2).style("opacity", 0).remove();
}

/** Remove the drawn svg (used when switching trees). */
function clearTree(container) {
    container.querySelectorAll("svg").forEach((svg) => svg.remove());
}
