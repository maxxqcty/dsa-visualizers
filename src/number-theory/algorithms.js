/** Number theory: Euclid's GCD/LCM, primes (sieve), Fibonacci, Egyptian fractions, modular arithmetic. */

function primeFactors(n) {
    const factors = [];
    for (let p = 2; p * p <= n; p++) {
        while (n % p === 0) {
            factors.push(p);
            n /= p;
        }
    }
    if (n > 1) factors.push(n);
    return factors;
}

/** [2,2,3] -> "$2^{2} \\times 3$" */
function formatFactors(factors) {
    if (factors.length === 0) return "$1$";
    const counts = new Map();
    factors.forEach((f) => counts.set(f, (counts.get(f) || 0) + 1));
    return "$" + [...counts].map(([p, c]) => (c > 1 ? `${p}^{${c}}` : String(p))).join(" \\times ") + "$";
}

/** TeX for a fraction n/d (no $ delimiters). */
const frac = (n, d) => `\\frac{${n}}{${d}}`;

const euclid = {
    id: "euclid",
    name: "GCD & LCM",
    description:
        "Euclid's algorithm: repeatedly replace the pair $(a, b)$ with $(b,\\ a \\bmod b)$ until the remainder is $0$. The last non-zero value is the GCD, and $\\operatorname{lcm}(a,b) = \\dfrac{a \\cdot b}{\\gcd(a,b)}$.",
    fields: [
        { id: "a", label: "First number", type: "number", min: 1, max: 1000000000, value: "1071" },
        { id: "b", label: "Second number", type: "number", min: 1, max: 1000000000, value: "462" },
    ],
    examples: [
        { name: "1071 and 462", values: { a: "1071", b: "462" } },
        { name: "Coprime (17, 5)", values: { a: "17", b: "5" } },
        { name: "One divides the other", values: { a: "84", b: "21" } },
    ],
    random() {
        return { a: String(randInt(20, 999)), b: String(randInt(20, 999)) };
    },
    run({ a: aText, b: bText }) {
        const a0 = parseInt1(aText, "The first number", 1, 1e9);
        const b0 = parseInt1(bText, "The second number", 1, 1e9);

        const rows = [];
        let a = Math.max(a0, b0);
        let b = Math.min(a0, b0);
        const steps = [{ text: `Start with the larger number first: $(${a},\\ ${b})$.`, draw: (stage) => stage.append(ui.table(["$a$", "", "$q \\times b$", "$+\\ r$"], [])) }];
        while (b !== 0) {
            const q = Math.floor(a / b);
            const r = a % b;
            rows.push([a, "=", `$${q} \\times ${b}$`, `+ ${r}`]);
            const snapshot = rows.map((row) => row.slice());
            steps.push({
                text: `$${a} = ${q} \\times ${b} + ${r}$.${r === 0 ? ` The remainder is $0$, so the GCD is $${b}$.` : ` Continue with $(${b},\\ ${r})$.`}`,
                draw: (stage) => stage.append(ui.table(["$a$", "", "$q \\times b$", "$+\\ r$"], snapshot, { state: (i) => (i === snapshot.length - 1 ? "active" : "") })),
            });
            [a, b] = [b, r];
        }
        const gcd = a;
        const lcm = (a0 / gcd) * b0;
        const fa = primeFactors(a0);
        const fb = primeFactors(b0);
        steps.push({
            text: `$\\gcd = ${gcd}$. $\\operatorname{lcm} = \\dfrac{${a0} \\times ${b0}}{${gcd}} = ${lcm}$.`,
            draw: (stage) =>
                stage.append(
                    ui.line("GCD:", `$${gcd}$`),
                    ui.line("LCM:", `$${lcm}$`),
                    ui.line(`$${a0} =$`, formatFactors(fa)),
                    ui.line(`$${b0} =$`, formatFactors(fb))
                ),
        });
        return { result: `$\\gcd(${a0},\\ ${b0}) = ${gcd}$  ·  $\\operatorname{lcm} = ${lcm}$`, steps };
    },
};

const primes = {
    id: "primes",
    name: "Primes (sieve)",
    description:
        "The Sieve of Eratosthenes: for each prime $p$, cross out its multiples starting at $p^{2}$. Only primes up to $\\sqrt{n}$ are needed. What is never crossed out is prime.",
    fields: [
        { id: "start", label: "Range start", type: "number", min: 0, max: 400, value: "2" },
        { id: "end", label: "Range end", type: "number", min: 2, max: 400, slider: true, value: "100" },
    ],
    examples: [
        { name: "Primes up to 100", values: { start: "2", end: "100" } },
        { name: "Primes from 50 to 100", values: { start: "50", end: "100" } },
        { name: "Primes up to 400", values: { start: "2", end: "400" } },
    ],
    run({ start: sText, end: eText }) {
        const start = parseInt1(sText, "Range start", 0, 400);
        const end = parseInt1(eText, "Range end", 2, 400);
        if (start > end) throw new Error("The start must not be larger than the end.");

        const composite = Array(end + 1).fill(false);
        const grid = (marks, focus) => (stage) => {
            const nums = [];
            for (let n = 2; n <= end; n++) nums.push(n);
            stage.append(
                el(
                    "div",
                    { class: "sieve", role: "img", "aria-label": "Number grid" },
                    nums.map((n) =>
                        el("span", {
                            class: `sieve-cell ${n === focus ? "is-active" : marks[n] === "x" ? "is-bad" : marks[n] === "p" ? "is-good" : ""}${n < start ? " is-dim" : ""}`,
                            text: n,
                        })
                    )
                )
            );
        };

        const marks = Array(end + 1).fill("");
        const steps = [{ text: `Write down every number from 2 to ${end}.`, draw: grid(marks.slice(), -1) }];
        for (let p = 2; p * p <= end; p++) {
            if (composite[p]) continue;
            const crossed = [];
            for (let m = p * p; m <= end; m += p) {
                if (!composite[m]) crossed.push(m);
                composite[m] = true;
                marks[m] = "x";
            }
            marks[p] = "p";
            steps.push({
                text: crossed.length ? `$${p}$ is prime. Cross out its multiples starting at $${p}^{2} = ${p * p}$: ${crossed.slice(0, 8).join(", ")}${crossed.length > 8 ? "…" : ""}.` : `${p} is prime; all its multiples are already crossed out.`,
                draw: grid(marks.slice(), p),
            });
        }
        const found = [];
        for (let n = 2; n <= end; n++) {
            if (!composite[n]) {
                marks[n] = "p";
                if (n >= start) found.push(n);
            }
        }
        steps.push({ text: `Everything left is prime. ${found.length} prime${found.length === 1 ? "" : "s"} between ${start} and ${end}.`, draw: grid(marks.slice(), -1) });
        return { result: found.length ? `Primes in ${start}–${end}: ${found.join(", ")}` : `No primes between ${start} and ${end}.`, steps };
    },
};

const fibonacci = {
    id: "fibonacci",
    name: "Fibonacci",
    description: "Each term is the sum of the two before it: $F_{n} = F_{n-1} + F_{n-2}$ with $F_{0}=0$ and $F_{1}=1$. Building the sequence up (memoization) avoids the huge number of repeated calls the plain recursive version makes.",
    fields: [{ id: "n", label: "Term $n$", type: "number", min: 0, max: 40, slider: true, value: "12" }],
    run({ n: nText }) {
        const n = parseInt1(nText, "n", 0, 40);
        const f = [0, 1];
        for (let i = 2; i <= n; i++) f[i] = f[i - 1] + f[i - 2];
        const terms = f.slice(0, n + 1);

        const view = (count, focus) => (stage) =>
            stage.append(
                ui.cells(terms.slice(0, count), {
                    states: terms.slice(0, count).map((_, i) => (i === focus ? "active" : "good")),
                    labels: terms.slice(0, count).map((_, i) => `$F_{${i}}$`),
                    title: "Sequence",
                })
            );

        const steps = [{ text: "$F_{0} = 0$ and $F_{1} = 1$.", draw: view(Math.min(2, terms.length), -1) }];
        for (let i = 2; i <= n; i++) steps.push({ text: `$F_{${i}} = F_{${i - 1}} + F_{${i - 2}} = ${f[i - 1]} + ${f[i - 2]} = ${f[i]}$.`, draw: view(i + 1, i) });
        const naiveCalls = 2 * (n === 0 ? 1 : f[n + 1]) - 1;
        steps.push({
            text: `$F_{${n}} = ${f[n]}$. Computing it with plain recursion would take ${naiveCalls.toLocaleString()} calls; building it up takes ${Math.max(n - 1, 0)} additions.`,
            draw: view(terms.length, -1),
        });
        return { result: `$F_{${n}} = ${f[n]}$`, steps };
    },
};

const egyptian = {
    id: "egyptian",
    name: "Egyptian fraction",
    description:
        "Write a fraction as a sum of distinct unit fractions $\\frac{1}{n}$. Greedy rule: subtract the largest unit fraction that fits, $\\frac{1}{\\lceil d/n \\rceil}$, then repeat on what is left.",
    fields: [
        { id: "num", label: "Numerator", type: "number", min: 1, max: 1000, value: "6" },
        { id: "den", label: "Denominator", type: "number", min: 1, max: 1000, value: "14" },
    ],
    examples: [
        { name: "6/14", values: { num: "6", den: "14" } },
        { name: "4/13", values: { num: "4", den: "13" } },
        { name: "5/121 (long)", values: { num: "5", den: "121" } },
    ],
    random() {
        const den = randInt(5, 60);
        return { num: String(randInt(1, den - 1)), den: String(den) };
    },
    run({ num: nText, den: dText }) {
        let n = BigInt(parseInt1(nText, "Numerator", 1, 1e6));
        let d = BigInt(parseInt1(dText, "Denominator", 1, 1e6));
        const original = `$${frac(n, d)}$`;
        const asTex = (num, den) => `$${frac(num, den)}$`;

        const terms = [];
        const rows = [];
        const steps = [{ text: `Start with ${original}.`, draw: (stage) => stage.append(ui.line("Remaining:", original)) }];
        let guard = 0;
        if (n >= d) {
            const whole = n / d;
            terms.push(String(whole));
            n -= whole * d;
            rows.push([asTex(n + whole * d, d), `${whole}`, n === 0n ? "0" : asTex(n, d)]);
            steps.push({ text: `${original} is at least $1$: take the whole part $${whole}$.`, draw: (stage) => stage.append(ui.table(["Remaining", "Take", "Left"], rows.map((r) => r.slice()))) });
        }
        while (n > 0n && guard++ < 25) {
            const x = (d + n - 1n) / n; // ceil(d / n)
            const before = asTex(n, d);
            n = n * x - d;
            d = d * x;
            terms.push(frac(1, x));
            if (n > 0n) {
                const g = gcdBig(n, d);
                n /= g;
                d /= g;
            }
            rows.push([before, `$${frac(1, x)}$`, n === 0n ? "0" : asTex(n, d)]);
            const snap = rows.map((r) => r.slice());
            steps.push({
                text: `Largest unit fraction not above ${before} is $${frac(1, x)}$. ${n === 0n ? "Nothing is left." : `What remains is ${asTex(n, d)}.`}`,
                draw: (stage) => stage.append(ui.table(["Remaining", "Take", "Left"], snap, { state: (i) => (i === snap.length - 1 ? "active" : "") })),
            });
        }
        if (n > 0n) throw new Error("This fraction needs too many terms to show.");
        const equation = `$${frac(BigInt(nText), BigInt(dText))} = ${terms.join(" + ")}$`;
        steps.push({ text: `${equation}.`, draw: (stage) => stage.append(ui.line("Result:", equation)) });
        return { result: equation, steps };
    },
};

function gcdBig(a, b) {
    while (b) [a, b] = [b, a % b];
    return a;
}

// --- Modular arithmetic ------------------------------------------------------

const modular = {
    id: "mod",
    name: "Modular arithmetic",
    description:
        "Evaluate an expression with $+$, $-$, $*$, $\\wedge$ (power) and parentheses, reducing every result modulo $m$. Put $=$ between two expressions to test whether they are congruent: $a \\equiv b \\pmod{m}$.",
    fields: [
        { id: "mod", label: "Modulus $m$", type: "number", min: 2, max: 1000000, value: "7" },
        { id: "expr", label: "Expression", type: "expression", hint: "Use the keypad, or type. Put = between two expressions to compare them.", value: "3^5 + 4 * 6" },
    ],
    examples: [
        { name: "3^5 + 4×6 mod 7", values: { mod: "7", expr: "3^5 + 4 * 6" } },
        { name: "Congruence: 10 = 3", values: { mod: "7", expr: "10 = 3" } },
        { name: "Fermat: 2^12 mod 13", values: { mod: "13", expr: "2^12" } },
        { name: "With parentheses", values: { mod: "11", expr: "(5 + 8) * (3 + 9)" } },
    ],
    run({ mod: mText, expr }) {
        const m = BigInt(parseInt1(mText, "The modulus", 2, 1e9));
        if (!expr) throw new Error("Enter an expression.");
        const norm = (x) => ((x % m) + m) % m;

        const steps = [];
        const note = (text, draw) => steps.push({ text, draw });

        function powMod(base, exp) {
            const rows = [];
            let result = 1n;
            let b = norm(base);
            let e = exp;
            while (e > 0n) {
                const bit = e & 1n;
                if (bit) result = norm(result * b);
                rows.push([e.toString(2).slice(-1) === "1" ? "yes" : "no", b, result]);
                e >>= 1n;
                if (e > 0n) b = norm(b * b);
            }
            return { result, rows };
        }

        // Recursive-descent parser that evaluates as it goes and records steps.
        const tokens = expr.replace(/\s+/g, "").match(/\d+|[-+*^()=]/g);
        if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) throw new Error("Use only whole numbers and + - * ^ ( ) =.");
        let pos = 0;
        const peek = () => tokens[pos];

        function atom() {
            const t = tokens[pos++];
            if (t === undefined) throw new Error("The expression ended unexpectedly.");
            if (t === "(") {
                const v = sum();
                if (tokens[pos++] !== ")") throw new Error("Missing closing parenthesis.");
                return v;
            }
            if (t === "-") return norm(-atom());
            if (!/^\d+$/.test(t)) throw new Error(`Unexpected "${t}".`);
            return BigInt(t);
        }
        function power() {
            const base = atom();
            if (peek() === "^") {
                pos++;
                const exp = power();
                if (exp < 0n) throw new Error("Negative exponents are not supported.");
                const { result, rows } = powMod(base, exp);
                note(`$${base}^{${exp}} \\bmod ${m} = ${result}$ (square and multiply).`, (stage) =>
                    stage.append(ui.table(["Bit set?", "$b^{2^i} \\bmod m$", "Running result"], rows.map((r) => r.map(String)), { caption: `$${base}^{${exp}} \\bmod ${m}$` }))
                );
                return result;
            }
            return norm(base);
        }
        function product() {
            let v = power();
            while (peek() === "*") {
                pos++;
                const rhs = power();
                const r = norm(v * rhs);
                note(`$${v} \\times ${rhs} = ${v * rhs}$, and $${v * rhs} \\bmod ${m} = ${r}$.`, (stage) => stage.append(ui.line("Result:", `$${v} \\times ${rhs} \\equiv ${r} \\pmod{${m}}$`)));
                v = r;
            }
            return v;
        }
        function sum() {
            let v = product();
            while (peek() === "+" || peek() === "-") {
                const op = tokens[pos++];
                const rhs = product();
                const raw = op === "+" ? v + rhs : v - rhs;
                const r = norm(raw);
                note(`$${v} ${op} ${rhs} = ${raw}$, and $${raw} \\bmod ${m} = ${r}$.`, (stage) => stage.append(ui.line("Result:", `$${v} ${op} ${rhs} \\equiv ${r} \\pmod{${m}}$`)));
                v = r;
            }
            return v;
        }

        const left = sum();
        const texExpr = (text) => text.replace(/\s+/g, "").replace(/\^(\d+|\([^)]*\))/g, "^{$1}").replace(/\*/g, " \\times ");
        let resultText = `$${texExpr(expr)} \\equiv ${left} \\pmod{${m}}$`;
        if (peek() === "=") {
            pos++;
            const right = sum();
            const same = left === right;
            note(`Both sides reduce to $${left}$ and $${right}$, so they are ${same ? "" : "not "}congruent mod $${m}$.`, (stage) =>
                stage.append(ui.line("Left side:", `${left}`), ui.line("Right side:", `${right}`))
            );
            resultText = `${same ? "Congruent" : "Not congruent"}: $${left} ${same ? "\\equiv" : "\\not\\equiv"} ${right} \\pmod{${m}}$`;
        }
        if (pos < tokens.length) throw new Error(`Unexpected "${tokens[pos]}".`);
        if (steps.length === 0) note(`There is nothing to compute; $${texExpr(expr)} \\bmod ${m} = ${left}$.`, (stage) => stage.append(ui.line("Result:", String(left))));
        return { result: resultText, steps };
    },
};

createLab({
    mount: document.getElementById("lab"),
    algorithms: [euclid, primes, fibonacci, egyptian, modular],
});
