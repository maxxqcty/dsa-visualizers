/**
 * Shared framework for step-by-step algorithm visualizers.
 *
 * An algorithm is a plain object:
 *   {
 *     id, name, description,
 *     fields: [{ id, label, type: "text" | "number" | "select", value, hint, options }],
 *     run(values) -> { result: string, steps: [{ text, draw(stage) }] }
 *   }
 * `run` is pure: it validates input (throw an Error with a friendly message
 * to reject it) and returns the steps. Each step's `draw` builds that step's
 * picture lazily into the stage element, so steps can be replayed or skipped.
 */

/** Tiny DOM builder: el("div", { class: "x", "aria-label": "y" }, child, "text"). */
function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
        if (value === false || value === null || value === undefined) continue;
        if (key === "class") node.className = value;
        else if (key === "text") setChildText(node, value);
        else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
        if (child === null || child === undefined || child === false) continue;
        if (child.nodeType) node.append(child);
        else setChildText(node, child, true);
    }
    return node;
}

/** Set (or append) text, typesetting $...$ as math. */
function setChildText(node, value, append = false) {
    const text = String(value);
    if (text.includes("$")) {
        if (!append) node.replaceChildren();
        node.append(mathFragment(text));
    } else if (append) {
        node.append(document.createTextNode(text));
    } else {
        node.textContent = text;
    }
}

/** Reusable pieces for drawing a step. */
const ui = {
    /** A table. `state(rowIndex)` may return "good" | "bad" | "active" | "dim". */
    table(headers, rows, { state = () => "", caption = "" } = {}) {
        return el(
            "table",
            { class: "lab-table" },
            caption ? el("caption", { text: caption }) : null,
            el("thead", {}, el("tr", {}, headers.map((h) => el("th", { scope: "col", text: h })))),
            el(
                "tbody",
                {},
                rows.map((row, i) =>
                    el("tr", { class: stateClass(state(i)) }, row.map((cell) => el("td", { text: cell })))
                )
            )
        );
    },

    /** A row of boxes; `states[i]` colours box i; `labels[i]` is a small caption. */
    cells(values, { states = [], labels = [], title = "" } = {}) {
        return el(
            "div",
            { class: "lab-cells-wrap" },
            title ? el("p", { class: "lab-caption", text: title }) : null,
            el(
                "div",
                { class: "lab-cells" },
                values.map((value, i) =>
                    el(
                        "div",
                        { class: "lab-cell-col" },
                        el("div", { class: "lab-cell " + stateClass(states[i]), text: value }),
                        labels[i] !== undefined ? el("small", { text: labels[i] }) : null
                    )
                )
            )
        );
    },

    /** A labelled line of monospace text. */
    line(label, value) {
        return el("p", { class: "lab-line" }, el("span", { class: "lab-label", text: label }), " ", el("code", { text: value }));
    },

    /** A horizontal progress bar. */
    meter(fraction, label) {
        const pct = Math.max(0, Math.min(1, fraction)) * 100;
        return el(
            "div",
            { class: "lab-meter", role: "img", "aria-label": label },
            el("div", { class: "lab-meter-fill", style: `width:${pct}%` }),
            el("span", { class: "lab-meter-text", text: label })
        );
    },
};

function stateClass(state) {
    return state ? `is-${state}` : "";
}

function createLab({ mount, algorithms }) {
    let current = algorithms[0];

    // --- Layout ---------------------------------------------------------------
    const tabs = el(
        "fieldset",
        { class: "modes" },
        el("legend", { class: "sr-only", text: "Algorithm" }),
        algorithms.map((algo, i) =>
            el(
                "label",
                { class: "mode" },
                el("input", { type: "radio", name: "algorithm", value: algo.id, checked: i === 0 }),
                el("span", { text: algo.name })
            )
        )
    );

    const description = el("p", { class: "lab-description" });
    const form = el("form", { class: "lab-form", novalidate: true });
    const error = el("p", { class: "error-message", "aria-live": "polite" });
    const result = el("p", { class: "readout lab-result", role: "status" });

    const stage = el("div", { class: "lab-stage", tabindex: "0", "aria-label": "Visualization" });
    const player = createPlayer({
        onShow(step) {
            stage.replaceChildren();
            step.draw?.(stage);
        },
    });

    const empty = el("p", { class: "lab-empty", text: "Enter values on the left and the steps appear here." });
    const output = el("div", { class: "lab-output hud" }, empty, result, player.element, stage);

    mount.replaceChildren(
        tabs,
        el(
            "div",
            { class: "split" },
            el("section", { class: "panel lab-input", "aria-label": "Inputs" }, description, form, error),
            output
        )
    );

    // --- Algorithm selection and form ----------------------------------------
    let widgets = {};

    function currentValues() {
        const values = {};
        for (const field of current.fields) values[field.id] = widgets[field.id].get().trim();
        return values;
    }

    function setValues(values) {
        for (const [key, value] of Object.entries(values)) widgets[key]?.set(String(value));
    }

    function defaults() {
        return Object.fromEntries(current.fields.map((field) => [field.id, String(field.value ?? "")]));
    }

    function toolbar() {
        const buttons = [];
        if (current.examples?.length) {
            const select = el(
                "select",
                { class: "mini-select", "aria-label": "Load an example" },
                el("option", { value: "", text: "Examples" }),
                current.examples.map((example, i) => el("option", { value: String(i), text: example.name }))
            );
            select.addEventListener("change", () => {
                const example = current.examples[Number(select.value)];
                select.value = "";
                if (example) {
                    setValues(example.values);
                    run();
                }
            });
            buttons.push(select);
        }
        const action = (label, title, apply) => {
            const button = el("button", { type: "button", class: "btn btn-secondary btn-small", text: label, title });
            button.addEventListener("click", () => {
                setValues(apply(currentValues()));
                run();
            });
            buttons.push(button);
        };
        if (current.random) action("Randomize", "Fill the inputs with a random example", () => current.random());
        for (const extra of current.actions || []) action(extra.label, extra.title || extra.label, (values) => extra.apply(values));
        action("Reset", "Restore the default inputs", defaults);
        return el("div", { class: "lab-toolbar" }, buttons);
    }

    function buildForm() {
        setMath(description, current.description || "");
        widgets = {};
        const fields = current.fields.map((field) => {
            const id = `field-${current.id}-${field.id}`;
            const widget = createInput(field, id, runSoon);
            widgets[field.id] = widget;

            const labelContent = [field.label, field.hint ? el("span", { class: "hint", text: field.hint }) : null];
            if (widget.group) {
                widget.node.setAttribute("role", widget.node.getAttribute("role") || "group");
                widget.node.setAttribute("aria-labelledby", `${id}-label`);
                return el("div", { class: "lab-field" }, el("div", { class: "field-title", id: `${id}-label` }, labelContent), widget.node);
            }
            return el("div", { class: "lab-field" }, el("label", { for: id }, labelContent), widget.node);
        });
        form.replaceChildren(toolbar(), ...fields);
        clearOutput();
    }

    function clearOutput() {
        player.clear();
        empty.hidden = false;
        error.textContent = "";
        result.textContent = "";
        result.hidden = true;
        stage.replaceChildren();
    }

    function run() {
        clearOutput();
        try {
            const output = current.run(currentValues());
            setMath(result, output.result);
            result.hidden = !output.result;
            empty.hidden = true;
            player.load(output.steps);
        } catch (err) {
            error.textContent = err.message;
        }
    }

    // The visualization updates as you type; Play only animates the steps.
    let pending = null;
    function runSoon() {
        clearTimeout(pending);
        pending = setTimeout(run, 350);
    }

    // --- Events ---------------------------------------------------------------
    tabs.addEventListener("change", (event) => {
        current = algorithms.find((algo) => algo.id === event.target.value) || current;
        buildForm();
        run();
    });
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        clearTimeout(pending);
        run();
    });
    form.addEventListener("input", runSoon);
    form.addEventListener("change", (event) => {
        if (event.target.tagName === "SELECT") {
            clearTimeout(pending);
            run();
        }
    });
    buildForm();
    run();
}

/** Parse a comma/space separated list of integers; throws a friendly error. */
function parseInts(text, what = "numbers") {
    const parts = text.split(/[\s,]+/).filter(Boolean);
    if (parts.length === 0) throw new Error(`Enter some ${what}.`);
    return parts.map((part) => {
        const n = Number(part);
        if (!Number.isInteger(n)) throw new Error(`"${part}" is not a whole number.`);
        return n;
    });
}

/** Parse a whole number within [min, max]. */
function parseInt1(text, label, min = -Infinity, max = Infinity) {
    const n = Number(text);
    if (text === "" || !Number.isInteger(n)) throw new Error(`${label} must be a whole number.`);
    if (n < min || n > max) throw new Error(`${label} must be between ${min} and ${max}.`);
    return n;
}

/** Random whole number from min to max, inclusive. */
function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

/** A random prime between min and max (inclusive). */
function randomPrime(min, max) {
    for (let tries = 0; tries < 500; tries++) {
        const n = randInt(min, max);
        if (isPrimeNumber(n)) return n;
    }
    return 11;
}
