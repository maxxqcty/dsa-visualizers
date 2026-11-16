/** Number systems: base conversion, calculator in any base, and bitwise operations. */

const BASE_CHOICES = [
    { value: "2", label: "Bin" },
    { value: "8", label: "Oct" },
    { value: "10", label: "Dec" },
    { value: "16", label: "Hex" },
];
const BASES = [
    { value: "2", label: "Binary (2)" },
    { value: "8", label: "Octal (8)" },
    { value: "10", label: "Decimal (10)" },
    { value: "16", label: "Hexadecimal (16)" },
];
const DIGITS = "0123456789ABCDEF";
const baseName = (b) => ({ 2: "binary", 8: "octal", 10: "decimal", 16: "hexadecimal" })[b];

/** Validate and split "101.01" into digit arrays. */
function parseInBase(text, base) {
    const clean = text.trim().toUpperCase();
    if (!clean) throw new Error("Enter a number.");
    const match = clean.match(/^([0-9A-F]+)(?:\.([0-9A-F]+))?$/);
    if (!match) throw new Error("Use digits (and one point for a fraction).");
    const [, intPart, fracPart = ""] = match;
    for (const ch of intPart + fracPart) {
        if (DIGITS.indexOf(ch) >= base) throw new Error(`"${ch}" is not a valid ${baseName(base)} digit.`);
    }
    if (intPart.length > 40) throw new Error("That number is too long.");
    return { intPart, fracPart };
}

const texOp = (op) => (op === "*" ? "\\times" : op === "/" ? "\\div" : op);

function intToBase(n, base) {
    return n === 0n ? "0" : n.toString(base).toUpperCase();
}

const conversion = {
    id: "convert",
    name: "Base conversion",
    description: "Convert between binary, octal, decimal and hexadecimal. The number is first expanded into decimal using place values, then rebuilt in the target base by repeated division (whole part) and multiplication (fraction).",
    fields: [
        { id: "value", label: "Number", hint: "Digits of the chosen base; a point adds a fraction", value: "1011.101" },
        { id: "from", label: "From", type: "select", segmented: true, options: BASE_CHOICES, value: "2" },
        { id: "to", label: "To", type: "select", segmented: true, options: BASE_CHOICES, value: "10" },
    ],
    actions: [{ label: "Swap bases", title: "Swap From and To", apply: (v) => ({ from: v.to, to: v.from }) }],
    examples: [
        { name: "Binary 1011.101 → decimal", values: { value: "1011.101", from: "2", to: "10" } },
        { name: "Decimal 255 → hex", values: { value: "255", from: "10", to: "16" } },
        { name: "Hex FF → binary", values: { value: "FF", from: "16", to: "2" } },
        { name: "Decimal 0.1 → binary", values: { value: "0.1", from: "10", to: "2" } },
    ],
    run({ value, from: fromText, to: toText }) {
        const from = Number(fromText);
        const to = Number(toText);
        const { intPart, fracPart } = parseInBase(value, from);
        const intValue = [...intPart].reduce((acc, ch) => acc * BigInt(from) + BigInt(DIGITS.indexOf(ch)), 0n);
        let fracValue = 0;
        [...fracPart].forEach((ch, i) => {
            fracValue += DIGITS.indexOf(ch) / Math.pow(from, i + 1);
        });

        const steps = [];

        // 1. Expand to decimal.
        if (from === 10) {
            steps.push({ text: `The number is already decimal: ${value}.`, draw: (stage) => stage.append(ui.line("Decimal:", value)) });
        } else {
            const rows = [];
            [...intPart].forEach((ch, i) => {
                const pow = intPart.length - 1 - i;
                rows.push([ch, `$${from}^{${pow}}$`, (BigInt(DIGITS.indexOf(ch)) * BigInt(from) ** BigInt(pow)).toString()]);
            });
            [...fracPart].forEach((ch, i) => {
                rows.push([ch, `$${from}^{-${i + 1}}$`, (DIGITS.indexOf(ch) / Math.pow(from, i + 1)).toString()]);
            });
            const decimalText = fracPart ? String(Number(intValue) + fracValue) : intValue.toString();
            steps.push({
                text: `Multiply each digit by its place value $b^{k}$ and add: $(${value})_{${from}} = (${decimalText})_{10}$.`,
                draw: (stage) => stage.append(ui.table(["Digit", "Place value", "Digit × place"], rows), ui.line("Sum:", decimalText)),
            });
        }

        // 2. Rebuild in the target base.
        let output;
        if (to === 10) {
            output = fracPart ? String(Number(intValue) + fracValue) : intValue.toString();
            steps.push({ text: `The target is decimal, so the answer is ${output}.`, draw: (stage) => stage.append(ui.line("Decimal:", output)) });
        } else {
            const divRows = [];
            let q = intValue;
            if (q === 0n) divRows.push([0, 0, 0]);
            while (q > 0n) {
                divRows.push([q.toString(), (q / BigInt(to)).toString(), DIGITS[Number(q % BigInt(to))]]);
                q /= BigInt(to);
            }
            const intOut = intToBase(intValue, to);
            steps.push({
                text: `Divide the whole part $${intValue}$ by $${to}$ repeatedly. Reading the remainders from bottom to top gives $(${intOut})_{${to}}$.`,
                draw: (stage) => stage.append(ui.table(["Number", `$\\div ${to}$`, "Remainder"], divRows, { state: () => "" }), ui.line("Whole part:", intOut)),
            });

            let fracOut = "";
            if (fracPart) {
                const mulRows = [];
                let f = fracValue;
                for (let i = 0; i < 8 && f > 1e-12; i++) {
                    const product = f * to;
                    const digit = Math.floor(product + 1e-12);
                    mulRows.push([f.toFixed(6).replace(/\.?0+$/, ""), `× ${to} = ${product.toFixed(6).replace(/\.?0+$/, "")}`, DIGITS[digit]]);
                    fracOut += DIGITS[digit];
                    f = product - digit;
                }
                steps.push({
                    text: `Multiply the fraction by $${to}$ repeatedly, taking the whole part each time (up to 8 digits): $0.${fracOut}$.`,
                    draw: (stage) => stage.append(ui.table(["Fraction", "Multiply", "Digit"], mulRows), ui.line("Fraction part:", "." + fracOut)),
                });
            }
            output = intOut + (fracOut ? "." + fracOut : "");
        }
        return { result: `$(${value})_{${from}} = (${output})_{${to}}$`, steps };
    },
};

const calculator = {
    id: "calc",
    name: "Calculator",
    description: "Add, subtract, multiply or divide whole numbers written in any base: convert to decimal, calculate, then convert the answer back.",
    fields: [
        { id: "base", label: "Base", type: "select", segmented: true, options: BASE_CHOICES, value: "2" },
        { id: "a", label: "First number", value: "1011" },
        { id: "op", label: "Operation", type: "select", segmented: true, options: [{ value: "+", label: "+" }, { value: "-", label: "−" }, { value: "*", label: "×" }, { value: "/", label: "÷" }], value: "+" },
        { id: "b", label: "Second number", value: "110" },
    ],
    examples: [
        { name: "Binary addition", values: { base: "2", a: "1011", op: "+", b: "110" } },
        { name: "Hex multiplication", values: { base: "16", a: "1F", op: "*", b: "A" } },
        { name: "Octal division", values: { base: "8", a: "77", op: "/", b: "5" } },
    ],
    run({ a, op, b, base: baseText }) {
        const base = Number(baseText);
        const parse = (text) => {
            const { intPart, fracPart } = parseInBase(text, base);
            if (fracPart) throw new Error("This calculator works with whole numbers.");
            return [...intPart].reduce((acc, ch) => acc * BigInt(base) + BigInt(DIGITS.indexOf(ch)), 0n);
        };
        const x = parse(a);
        const y = parse(b);
        if (op === "/" && y === 0n) throw new Error("You can't divide by zero.");

        let value;
        let remainder = null;
        if (op === "+") value = x + y;
        else if (op === "-") value = x - y;
        else if (op === "*") value = x * y;
        else {
            value = x / y;
            remainder = x % y;
        }
        const fmt = (n) => (n < 0n ? "-" : "") + intToBase(n < 0n ? -n : n, base);

        const steps = [
            { text: `Convert both numbers to decimal: $(${a})_{${base}} = ${x}$ and $(${b})_{${base}} = ${y}$.`, draw: (stage) => stage.append(ui.line(`${a} (${baseName(base)}) =`, x.toString()), ui.line(`${b} (${baseName(base)}) =`, y.toString())) },
            {
                text: `Calculate in decimal: $${x} ${texOp(op)} ${y} = ${value}$${remainder !== null ? ` remainder $${remainder}$` : ""}.`,
                draw: (stage) => stage.append(ui.line("Decimal:", `${x} ${op} ${y} = ${value}${remainder !== null ? ` r ${remainder}` : ""}`)),
            },
            {
                text: `Convert $${value}$ back to ${baseName(base)}: $(${fmt(value)})_{${base}}$${remainder !== null ? ` remainder $(${fmt(remainder)})_{${base}}$` : ""}.`,
                draw: (stage) => stage.append(ui.line(`Answer (${baseName(base)}):`, fmt(value) + (remainder !== null ? ` r ${fmt(remainder)}` : ""))),
            },
        ];
        return { result: `$(${a})_{${base}} ${texOp(op)} (${b})_{${base}} = (${fmt(value)})_{${base}}$${remainder !== null ? ` remainder $(${fmt(remainder)})_{${base}}$` : ""}`, steps };
    },
};

const bitwise = {
    id: "bitwise",
    name: "Bitwise operations",
    description: "Line up two binary numbers and apply AND, OR, XOR, NOT and shifts bit by bit.",
    fields: [
        { id: "x", label: "Binary X", type: "bits", minBits: 1, maxBits: 16, hint: "Click a bit to flip it", value: "101101" },
        { id: "y", label: "Binary Y", type: "bits", minBits: 1, maxBits: 16, value: "110011" },
    ],
    examples: [
        { name: "Mixed bits", values: { x: "101101", y: "110011" } },
        { name: "One byte", values: { x: "11110000", y: "10101010" } },
        { name: "Masking", values: { x: "10110110", y: "00001111" } },
    ],
    random() {
        const width = randInt(4, 10);
        const bits = () => Array.from({ length: width }, () => (Math.random() < 0.5 ? "1" : "0")).join("");
        return { x: bits(), y: bits() };
    },
    run({ x: xText, y: yText }) {
        for (const [label, text] of [["X", xText], ["Y", yText]]) {
            if (!/^[01]{1,16}$/.test(text)) throw new Error(`${label} must be 1 to 16 binary digits (0 or 1).`);
        }
        const width = Math.max(xText.length, yText.length);
        const x = xText.padStart(width, "0");
        const y = yText.padStart(width, "0");
        const X = parseInt(x, 2);
        const Y = parseInt(y, 2);
        const mask = (1 << width) - 1;

        const bits = (s, state = "") => ui.cells([...s], { states: [...s].map((b) => (state === "bits" ? (b === "1" ? "good" : "dim") : state)) });
        const toBin = (n) => (n >>> 0).toString(2).padStart(width, "0").slice(-width);

        const row = (label, s) => el("div", { class: "bit-row" }, el("span", { class: "bit-label", text: label }), bits(s, "bits"));
        const operation = (name, symbol, value, explain) => ({
            text: explain,
            draw: (stage) =>
                stage.append(
                    row("X", x),
                    symbol === "~" || symbol === "<<" || symbol === ">>" ? null : row("Y", y),
                    row(name, toBin(value)),
                    ui.line("Decimal:", String(value & mask))
                ),
        });

        const steps = [
            { text: `X = ${x} (${X}) and Y = ${y} (${Y}), padded to ${width} bits.`, draw: (stage) => stage.append(row("X", x), row("Y", y)) },
            operation("$X \\land Y$", "&", X & Y, "AND ($\\land$): a bit is $1$ only where both $X$ and $Y$ have a $1$."),
            operation("$X \\lor Y$", "|", X | Y, "OR ($\\lor$): a bit is $1$ where either $X$ or $Y$ has a $1$."),
            operation("$X \\oplus Y$", "^", X ^ Y, "XOR ($\\oplus$): a bit is $1$ where $X$ and $Y$ differ."),
            operation("$\\lnot X$", "~", ~X & mask, "NOT ($\\lnot$): flip every bit of $X$."),
            operation("$X \\ll 1$", "<<", (X << 1) & mask, "Shift left by one ($\\ll 1$): bits move left and a $0$ enters on the right. This doubles the value, dropping the top bit if it overflows."),
            operation("$X \\gg 1$", ">>", X >> 1, "Shift right by one ($\\gg 1$): bits move right and a $0$ enters on the left. This halves the value, rounding down."),
        ];
        return { result: `AND ${toBin(X & Y)} · OR ${toBin(X | Y)} · XOR ${toBin(X ^ Y)} · NOT X ${toBin(~X & mask)}`, steps };
    },
};

createLab({
    mount: document.getElementById("lab"),
    algorithms: [conversion, calculator, bitwise],
});
