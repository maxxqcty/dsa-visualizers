/**
 * Pure AVL tree model: a self-balancing BST. Reuses TreeNode and the shared
 * helpers (findPath, treeDepth, toLayoutData) from tree.js.
 *
 * Operations return the new root and push a description of every rotation
 * they perform onto the `log` array.
 */

function nodeHeight(node) {
    return node ? node.height : 0;
}

function updateHeight(node) {
    node.height = 1 + Math.max(nodeHeight(node.left), nodeHeight(node.right));
}

function balanceFactor(node) {
    return node ? nodeHeight(node.left) - nodeHeight(node.right) : 0;
}

function rotateRight(node) {
    const pivot = node.left;
    node.left = pivot.right;
    pivot.right = node;
    updateHeight(node);
    updateHeight(pivot);
    return pivot;
}

function rotateLeft(node) {
    const pivot = node.right;
    node.right = pivot.left;
    pivot.left = node;
    updateHeight(node);
    updateHeight(pivot);
    return pivot;
}

/** Restore the AVL property at `node`; `label` prefixes log entries. */
function rebalance(node, label, log) {
    updateHeight(node);
    const balance = balanceFactor(node);

    if (balance > 1) {
        if (balanceFactor(node.left) < 0) {
            log.push(`${label}: left-right double rotation at ${node.value}`);
            node.left = rotateLeft(node.left);
        } else {
            log.push(`${label}: right rotation at ${node.value}`);
        }
        return rotateRight(node);
    }

    if (balance < -1) {
        if (balanceFactor(node.right) > 0) {
            log.push(`${label}: right-left double rotation at ${node.value}`);
            node.right = rotateRight(node.right);
        } else {
            log.push(`${label}: left rotation at ${node.value}`);
        }
        return rotateLeft(node);
    }

    return node;
}

/** Insert `value`; duplicates are ignored. */
function insertAvl(node, value, log = [], label = `Insert ${value}`) {
    if (!node) {
        const created = new TreeNode(value);
        created.height = 1;
        return created;
    }
    if (value === node.value) return node;

    if (value < node.value) {
        node.left = insertAvl(node.left, value, log, label);
    } else {
        node.right = insertAvl(node.right, value, log, label);
    }
    return rebalance(node, label, log);
}

/** Delete `value` if present, rebalancing on the way back up. */
function deleteAvl(node, value, log = [], label = `Delete ${value}`) {
    if (!node) return null;

    if (value < node.value) {
        node.left = deleteAvl(node.left, value, log, label);
    } else if (value > node.value) {
        node.right = deleteAvl(node.right, value, log, label);
    } else {
        if (!node.left) return node.right;
        if (!node.right) return node.left;

        // Two children: replace with the in-order successor.
        let successor = node.right;
        while (successor.left) successor = successor.left;
        node.value = successor.value;
        node.right = deleteAvl(node.right, successor.value, log, label);
    }
    return rebalance(node, label, log);
}
