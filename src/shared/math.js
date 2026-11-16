/**
 * Inline math. Wrap LaTeX in $...$ inside any text and it is typeset with
 * KaTeX (vendored in vendor/katex): "Compute $g^{a} \bmod p$." If KaTeX is not
 * loaded the formulas fall back to readable plain text.
 */

const TEX_PLAIN = [
    [/\\operatorname\{([^}]*)\}/g, "$1"],
    [/\\mathrm\{([^}]*)\}/g, "$1"],
    [/\\text\{([^}]*)\}/g, "$1"],
    [/\\pmod\{([^}]*)\}/g, "(mod $1)"],
    [/\\bmod/g, " mod "],
    [/\\times/g, "×"],
    [/\\cdot/g, "·"],
    [/\\equiv/g, "≡"],
    [/\\ne\b/g, "≠"],
    [/\\le\b/g, "≤"],
    [/\\to\b/g, "→"],
    [/\\infty/g, "∞"],
    [/\\oplus/g, "⊕"],
    [/\\land/g, "∧"],
    [/\\lor/g, "∨"],
    [/\\lnot/g, "¬"],
    [/\\ll/g, "<<"],
    [/\\gg/g, ">>"],
    [/\\varphi|\\phi/g, "φ"],
    [/\\lceil/g, "⌈"],
    [/\\rceil/g, "⌉"],
    [/\\[dt]?frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2"],
    [/\\[,;! ]/g, " "],
    [/[_^]\{([^}]*)\}/g, (m, inner) => (m[0] === "^" ? "^" : "_") + inner],
    [/[{}]/g, ""],
];

function texToPlain(tex) {
    return TEX_PLAIN.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), tex);
}

/** A DocumentFragment with `$...$` segments typeset as math. */
function mathFragment(text) {
    const fragment = document.createDocumentFragment();
    for (const part of String(text).split(/(\$[^$]+\$)/)) {
        if (!part) continue;
        if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) {
            const tex = part.slice(1, -1);
            const span = document.createElement("span");
            span.className = "math";
            if (typeof katex !== "undefined") {
                try {
                    katex.render(tex, span, { throwOnError: false, displayMode: false });
                } catch {
                    span.textContent = texToPlain(tex);
                }
            } else {
                span.textContent = texToPlain(tex);
            }
            fragment.append(span);
        } else {
            fragment.append(document.createTextNode(part));
        }
    }
    return fragment;
}

/** Replace a node's content with `text`, typesetting any math in it. */
function setMath(node, text) {
    node.replaceChildren(mathFragment(text));
}

/** Typeset `$...$` in every element marked data-math (static page text). */
function typesetPage() {
    document.querySelectorAll("[data-math]").forEach((node) => setMath(node, node.textContent));
}
