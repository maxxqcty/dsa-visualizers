/**
 * Input widgets for the algorithm labs. Each builder returns
 *   { node, get(), set(value), group }
 * where get() yields the same string format the algorithms already parse
 * (for example "1-4, 3-5" or "101101"), so widgets can be swapped freely.
 *
 * Field types: text, number (stepper + optional slider), select (dropdown or
 * segmented), list (chips), rows (editable table), bits (toggle boxes) and
 * expression (text with a keypad).
 */

function isPrimeNumber(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
}

/** Custom stepping rules for number fields (`stepFn` on a field). */
const STEP_FUNCS = {
    prime(value, direction) {
        let n = Math.round(value) + direction;
        while (n > 1 && !isPrimeNumber(n)) n += direction;
        return n < 2 ? 2 : n;
    },
};

/** Accessible name for a field: its label without any $math$ delimiters. */
const plainLabel = (field) => field.plain || String(field.label).replace(/\$/g, "");

const clampNumber = (n, field) => Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, n));

function createInput(field, id, onInput) {
    const builders = {
        text: textWidget,
        number: numberWidget,
        select: selectWidget,
        list: listWidget,
        rows: rowsWidget,
        bits: bitsWidget,
        expression: expressionWidget,
    };
    return builders[field.type || "text"](field, id, onInput);
}

// --- text ------------------------------------------------------------------------
function textWidget(field, id, onInput) {
    const multiline = field.multiline || String(field.value ?? "").length > 28;
    const control = multiline
        ? el("textarea", { id, rows: "3", spellcheck: "false", text: field.value ?? "" })
        : el("input", { id, type: "text", value: field.value ?? "", placeholder: field.placeholder || "", autocomplete: "off", spellcheck: "false" });
    control.addEventListener("input", onInput);
    return { node: control, get: () => control.value, set: (v) => (control.value = v), focus: () => control.focus() };
}

// --- number: − [value] + with an optional slider -------------------------------
function numberWidget(field, id, onInput) {
    const input = el("input", { id, type: "text", inputmode: "decimal", autocomplete: "off", class: "num-input", value: field.value ?? "" });
    const dec = el("button", { type: "button", class: "step-btn", "aria-label": `Decrease ${plainLabel(field)}`, text: "−" });
    const inc = el("button", { type: "button", class: "step-btn", "aria-label": `Increase ${plainLabel(field)}`, text: "+" });
    const stepper = el("div", { class: "stepper" }, dec, input, inc);

    const slider = field.slider
        ? el("input", { type: "range", class: "lab-slider", min: field.min, max: field.max, step: field.step || 1, value: field.value, "aria-label": `${plainLabel(field)} slider` })
        : null;

    const current = () => (Number.isFinite(Number(input.value)) && input.value.trim() !== "" ? Number(input.value) : field.min ?? 0);

    function syncSlider() {
        if (slider) slider.value = input.value;
    }

    function stepBy(direction, big) {
        const n = field.stepFn ? STEP_FUNCS[field.stepFn](current(), direction) : current() + direction * (field.step || 1) * (big ? 10 : 1);
        input.value = String(clampNumber(n, field));
        syncSlider();
        onInput();
    }

    dec.addEventListener("click", (e) => stepBy(-1, e.shiftKey));
    inc.addEventListener("click", (e) => stepBy(1, e.shiftKey));
    input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            stepBy(e.key === "ArrowUp" ? 1 : -1, e.shiftKey);
        }
    });
    input.addEventListener("input", () => {
        syncSlider();
        onInput();
    });
    slider?.addEventListener("input", () => {
        input.value = slider.value;
        onInput();
    });

    return {
        node: el("div", { class: "number-widget" }, stepper, slider),
        get: () => input.value,
        set(v) {
            input.value = String(v);
            syncSlider();
        },
        focus: () => input.focus(),
    };
}

// --- select: dropdown, or a segmented control with `segmented: true` -----------
function selectWidget(field, id, onInput) {
    const options = field.options.map((o) => (typeof o === "object" ? o : { value: o, label: o }));

    if (field.segmented) {
        const name = `seg-${id}`;
        const radios = options.map((o) =>
            el("input", { type: "radio", name, value: o.value, checked: String(o.value) === String(field.value) })
        );
        const node = el(
            "div",
            { class: "modes modes-sm", role: "radiogroup", "aria-label": plainLabel(field) },
            options.map((o, i) => el("label", { class: "mode" }, radios[i], el("span", { text: o.label })))
        );
        node.addEventListener("change", onInput);
        return {
            node,
            group: true,
            get: () => radios.find((r) => r.checked)?.value ?? "",
            set(v) {
                radios.forEach((r) => (r.checked = String(r.value) === String(v)));
            },
            focus: () => radios.find((r) => r.checked)?.focus(),
        };
    }

    const select = el(
        "select",
        { id },
        options.map((o) => el("option", { value: o.value, text: o.label, selected: String(o.value) === String(field.value) }))
    );
    select.addEventListener("change", onInput);
    return { node: select, get: () => select.value, set: (v) => (select.value = String(v)), focus: () => select.focus() };
}

// --- list: chips you add and remove ---------------------------------------------
function listWidget(field, id, onInput) {
    let items = [];
    const chips = el("ul", { class: "chip-list", "aria-label": `${plainLabel(field)} entered` });
    const input = el("input", { id, type: "text", inputmode: "numeric", class: "chip-input", placeholder: field.placeholder || "Add a number", autocomplete: "off", "aria-describedby": `${id}-help` });
    const help = el("span", { id: `${id}-help`, class: "sr-only", text: "Press Enter or comma to add. Backspace removes the last one." });
    const node = el("div", { class: "chips-field" }, chips, el("div", { class: "chip-entry" }, input, help));

    function draw() {
        chips.replaceChildren(
            ...items.map((value, i) =>
                el(
                    "li",
                    { class: "chip" },
                    el("span", { text: String(value) }),
                    el("button", { type: "button", "aria-label": `Remove ${value}`, text: "×" })
                )
            )
        );
        chips.querySelectorAll("button").forEach((button, i) =>
            button.addEventListener("click", () => {
                items.splice(i, 1);
                draw();
                onInput();
                input.focus();
            })
        );
    }

    function commit(text) {
        const parts = text.split(/[,\s]+/).filter(Boolean);
        let added = false;
        for (const part of parts) {
            const n = Number(part);
            if (!Number.isInteger(n) || (field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) {
                input.setCustomValidity(`Use whole numbers from ${field.min ?? "any"} to ${field.max ?? "any"}`);
                input.classList.add("is-invalid");
                continue;
            }
            if (items.length >= (field.maxItems || 12)) break;
            items.push(n);
            added = true;
        }
        input.value = "";
        if (added) {
            input.classList.remove("is-invalid");
            draw();
            onInput();
        }
    }

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (input.value.trim()) commit(input.value);
        } else if (e.key === "Backspace" && !input.value && items.length) {
            items.pop();
            draw();
            onInput();
        }
    });
    input.addEventListener("input", () => {
        input.classList.remove("is-invalid");
        if (/[,\s]$/.test(input.value) && input.value.trim()) commit(input.value);
    });
    input.addEventListener("blur", () => input.value.trim() && commit(input.value));
    node.addEventListener("click", (e) => e.target === node && input.focus());

    const widget = {
        node,
        get: () => items.join(", "),
        set(v) {
            items = String(v)
                .split(/[,\s]+/)
                .filter(Boolean)
                .map(Number)
                .filter(Number.isFinite);
            draw();
        },
        focus: () => input.focus(),
    };
    widget.set(field.value ?? "");
    return widget;
}

// --- rows: an editable table ---------------------------------------------------------
function rowsWidget(field, id, onInput) {
    const columns = field.columns;
    const sep = field.sep || ":";
    const maxRows = field.maxRows || 20;
    const body = el("div", { class: "rows-body" });
    const add = el("button", { type: "button", class: "btn btn-secondary btn-small", text: "Add row" });
    const node = el(
        "div",
        { class: "rows-field" },
        el("div", { class: "rows-head", style: `--cols:${columns.length}` }, columns.map((c) => el("span", { text: c.label })), el("span", { class: "sr-only", text: "Remove" })),
        body,
        add
    );

    function addRow(values = [], focus = false) {
        if (body.children.length >= maxRows) return;
        const index = body.children.length + 1;
        const cells = columns.map((c, i) =>
            el("input", {
                type: "text",
                inputmode: c.type === "number" ? "numeric" : "text",
                class: "cell-input",
                value: values[i] ?? "",
                placeholder: c.placeholder || "",
                autocomplete: "off",
                "aria-label": `${c.label}, row ${index}`,
            })
        );
        const remove = el("button", { type: "button", class: "row-remove", "aria-label": `Remove row ${index}`, text: "×" });
        const row = el("div", { class: "rows-row", style: `--cols:${columns.length}` }, cells, remove);

        cells.forEach((cell, i) => {
            cell.addEventListener("input", onInput);
            cell.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    if (i === cells.length - 1) {
                        addRow([], true);
                        onInput();
                    } else cells[i + 1].focus();
                }
            });
        });
        remove.addEventListener("click", () => {
            if (body.children.length > (field.minRows || 1)) {
                row.remove();
                relabel();
                onInput();
            }
        });
        body.append(row);
        if (focus) cells[0].focus();
        add.disabled = body.children.length >= maxRows;
    }

    /** Keep the accessible names of the remaining rows in order. */
    function relabel() {
        [...body.children].forEach((row, r) => {
            row.querySelectorAll(".cell-input").forEach((cell, i) => cell.setAttribute("aria-label", `${columns[i].label}, row ${r + 1}`));
            row.querySelector(".row-remove").setAttribute("aria-label", `Remove row ${r + 1}`);
        });
        add.disabled = body.children.length >= maxRows;
    }

    add.addEventListener("click", () => {
        addRow([], true);
        onInput();
    });

    const widget = {
        node,
        group: true,
        get: () =>
            [...body.children]
                .map((row) => [...row.querySelectorAll(".cell-input")].map((c) => c.value.trim()))
                .filter((cells) => cells.every((c) => c !== ""))
                .map((cells) => cells.join(sep))
                .join(", "),
        set(v) {
            body.replaceChildren();
            const items = String(v).split(/\s*,\s*/).filter(Boolean);
            items.forEach((item) => {
                const at = item.indexOf(sep, 1); // index 1 so a leading minus sign is not the separator
                addRow(at < 0 ? [item] : [item.slice(0, at), item.slice(at + 1)]);
            });
            if (!body.children.length) addRow();
            relabel();
        },
        focus: () => body.querySelector(".cell-input")?.focus(),
    };
    widget.set(field.value ?? "");
    return widget;
}

// --- bits: click boxes to flip bits ------------------------------------------------------
function bitsWidget(field, id, onInput) {
    let bits = String(field.value ?? "0").split("");
    const minBits = field.minBits ?? 1;
    const maxBits = field.maxBits ?? 16;
    const fixed = minBits === maxBits;
    const row = el("div", { class: "bit-boxes", role: "group", "aria-label": plainLabel(field) });
    const less = el("button", { type: "button", class: "step-btn", "aria-label": `Remove a bit from ${plainLabel(field)}`, text: "−" });
    const more = el("button", { type: "button", class: "step-btn", "aria-label": `Add a bit to ${plainLabel(field)}`, text: "+" });
    const node = el("div", { class: "bits-field" }, row, fixed ? null : el("div", { class: "bits-size" }, less, more));

    function draw(focusIndex) {
        row.replaceChildren(
            ...bits.map((bit, i) =>
                el("button", {
                    type: "button",
                    class: "bit" + (bit === "1" ? " is-on" : ""),
                    "aria-pressed": String(bit === "1"),
                    "aria-label": `Bit ${bits.length - i}, ${bit}`,
                    text: bit,
                })
            )
        );
        row.querySelectorAll(".bit").forEach((button, i) => {
            button.addEventListener("click", () => {
                bits[i] = bits[i] === "1" ? "0" : "1";
                draw(i);
                onInput();
            });
            button.addEventListener("keydown", (e) => {
                const target = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: bits.length - 1 }[e.key];
                if (target !== undefined && row.children[target]) {
                    e.preventDefault();
                    row.children[target].focus();
                }
            });
        });
        if (focusIndex !== undefined) row.children[focusIndex]?.focus();
        less.disabled = bits.length <= minBits;
        more.disabled = bits.length >= maxBits;
    }

    less.addEventListener("click", () => {
        bits.shift();
        draw();
        onInput();
    });
    more.addEventListener("click", () => {
        bits.unshift("0");
        draw(0);
        onInput();
    });

    draw();
    return {
        node,
        group: true,
        get: () => bits.join(""),
        set(v) {
            if (/^[01]+$/.test(String(v))) {
                bits = String(v).split("");
                draw();
            }
        },
        focus: () => row.querySelector(".bit")?.focus(),
    };
}

// --- expression: a text field with an on-screen keypad ---------------------------------------
function expressionWidget(field, id, onInput) {
    const input = el("input", { id, type: "text", value: field.value ?? "", autocomplete: "off", spellcheck: "false", placeholder: field.placeholder || "" });
    input.addEventListener("input", onInput);

    const keys = [
        ["7", "8", "9", "(", ")"],
        ["4", "5", "6", "+", "-"],
        ["1", "2", "3", "×", "^"],
        ["0", "=", "⌫", "C"],
    ];
    const insert = (text) => {
        const [start, end] = [input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length];
        input.value = input.value.slice(0, start) + text + input.value.slice(end);
        input.setSelectionRange(start + text.length, start + text.length);
        input.focus();
        onInput();
    };
    const press = (key) => {
        if (key === "C") {
            input.value = "";
            input.focus();
            onInput();
        } else if (key === "⌫") {
            const start = input.selectionStart ?? input.value.length;
            if (start > 0) {
                input.value = input.value.slice(0, start - 1) + input.value.slice(input.selectionEnd ?? start);
                input.setSelectionRange(start - 1, start - 1);
            }
            input.focus();
            onInput();
        } else insert(key === "×" ? "*" : key);
    };

    const pad = el(
        "div",
        { class: "keypad", role: "group", "aria-label": "Keypad" },
        keys.flat().map((key) => {
            const button = el("button", { type: "button", class: "key", text: key, "aria-label": { "×": "times", "⌫": "backspace", C: "clear", "^": "power", "-": "minus" }[key] || key });
            button.addEventListener("click", () => press(key));
            return button;
        })
    );
    return {
        node: el("div", { class: "expression-field" }, input, pad),
        get: () => input.value,
        set: (v) => (input.value = v),
        focus: () => input.focus(),
    };
}
