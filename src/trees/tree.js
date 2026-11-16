/**
 * Pure binary-search-tree model and helpers shared with the AVL model.
 * No DOM access, so it can be tested in isolation.
 */

class TreeNode {
    constructor(value) {
        this.value = value;
        this.left = null;
        this.right = null;
    }
}

/** Parse free-form text into a list of unique numbers, preserving order. */
function parseInput(text) {
    const numbers = text
        .split(/\s+/)
        .filter((token) => token !== "" && Number.isFinite(Number(token)))
        .map(Number);
    return [...new Set(numbers)];
}

/** Insert `value` into a plain BST; duplicates are ignored. Returns the root. */
function insertBst(node, value) {
    if (!node) return new TreeNode(value);
    if (value < node.value) node.left = insertBst(node.left, value);
    else if (value > node.value) node.right = insertBst(node.right, value);
    return node;
}

/** Delete `value` from a plain BST if present. Returns the root. */
function deleteBst(node, value) {
    if (!node) return null;

    if (value < node.value) {
        node.left = deleteBst(node.left, value);
    } else if (value > node.value) {
        node.right = deleteBst(node.right, value);
    } else {
        if (!node.left) return node.right;
        if (!node.right) return node.left;

        // Two children: replace with the in-order successor.
        let successor = node.right;
        while (successor.left) successor = successor.left;
        node.value = successor.value;
        node.right = deleteBst(node.right, successor.value);
    }
    return node;
}

/**
 * Walk from the root towards `value`. Returns every node visited and whether
 * the value was found; when it wasn't, `path` ends where it would be inserted.
 */
function traverse(root, value) {
    const path = [];
    let direction = null;
    let current = root;

    while (current) {
        path.push({ value: current.value, direction });
        if (value === current.value) return { path, found: true };
        direction = value < current.value ? "Left" : "Right";
        current = value < current.value ? current.left : current.right;
    }
    return { path, found: false };
}

/** "Path: Root [50] >> Left [30]" */
function describePath(path) {
    const steps = path.map(({ value, direction }) => `${direction ?? "Root"} [${value}]`);
    return "Path: " + steps.join(" >> ");
}

/** Number of edges on the longest root-to-leaf path (0 for a lone root). */
function treeDepth(root) {
    if (!root) return 0;
    let depth = -1;
    let level = [root];
    while (level.length) {
        depth++;
        level = level.flatMap((n) => [n.left, n.right].filter(Boolean));
    }
    return depth;
}

/** Plain-language description of the tree, for screen readers. */
function describeTree(root, kind = "Binary tree") {
    if (!root) return "Empty tree.";

    const parts = [];
    const queue = [root];
    while (queue.length) {
        const node = queue.shift();
        const kids = [];
        if (node.left) kids.push(`left child ${node.left.value}`);
        if (node.right) kids.push(`right child ${node.right.value}`);
        parts.push(
            `${node.value}${node === root ? " (root)" : ""} has ${kids.length ? kids.join(" and ") : "no children"}`
        );
        queue.push(...[node.left, node.right].filter(Boolean));
    }
    return `${kind}, depth ${treeDepth(root)}. ${parts.join(". ")}.`;
}
