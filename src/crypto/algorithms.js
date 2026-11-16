/** Cryptography: Caesar cipher, Diffie-Hellman, RSA (plus AES and S-DES from their own files). */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function modPow(base, exp, mod) {
    let result = 1n;
    base %= mod;
    while (exp > 0n) {
        if (exp & 1n) result = (result * base) % mod;
        base = (base * base) % mod;
        exp >>= 1n;
    }
    return result;
}

function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
}

const caesar = {
    id: "caesar",
    name: "Caesar cipher",
    description: "Shift every letter along the alphabet by a fixed amount $k$: $E(x) = (x + k) \\bmod 26$. Decrypting shifts the other way: $D(x) = (x - k) \\bmod 26$.",
    fields: [
        { id: "mode", label: "Mode", type: "select", segmented: true, options: [{ value: "enc", label: "Encrypt" }, { value: "dec", label: "Decrypt" }], value: "enc" },
        { id: "text", label: "Text", hint: "Up to 40 characters", value: "Hello, World" },
        { id: "shift", label: "Shift $k$", type: "number", min: -25, max: 25, slider: true, value: "3" },
    ],
    examples: [
        { name: "Hello, World (shift 3)", values: { mode: "enc", text: "Hello, World", shift: "3" } },
        { name: "ROT13", values: { mode: "enc", text: "Attack at dawn", shift: "13" } },
        { name: "Decrypt Khoor", values: { mode: "dec", text: "Khoor, Zruog", shift: "3" } },
    ],
    run({ text, shift: shiftText, mode }) {
        if (!text) throw new Error("Enter some text.");
        if (text.length > 40) throw new Error("Use at most 40 characters.");
        const shift = parseInt1(shiftText, "The shift", -25, 25);
        const k = ((mode === "dec" ? -shift : shift) % 26 + 26) % 26;
        const shifted = [...ALPHABET].map((_, i) => ALPHABET[(i + k) % 26]);

        const alphabets = (focus) => (stage) =>
            stage.append(
                ui.cells([...ALPHABET], { title: "Plain alphabet", states: [...ALPHABET].map((c) => (c === focus ? "active" : "")) }),
                ui.cells(shifted, { title: `Shifted by ${k}`, states: shifted.map((_, i) => (ALPHABET[i] === focus ? "active" : "")) })
            );

        const steps = [{ text: `Shift the alphabet by ${k} (${mode === "dec" ? "decrypting" : "encrypting"}): A becomes ${shifted[0]}.`, draw: alphabets(null) }];
        let output = "";
        for (const ch of text) {
            const upper = ch.toUpperCase();
            const idx = ALPHABET.indexOf(upper);
            if (idx < 0) {
                output += ch;
                steps.push({ text: `"${ch}" is not a letter, so it stays the same.`, draw: (stage) => stage.append(ui.line("Output so far:", output)) });
                continue;
            }
            const mapped = shifted[idx];
            output += ch === upper ? mapped : mapped.toLowerCase();
            const so = output;
            steps.push({ text: `${ch} is position $${idx}$, and $(${idx} ${mode === "dec" ? "-" : "+"} ${Math.abs(shift)}) \\bmod 26 = ${(idx + k) % 26}$, which is the letter ${mapped}.`, draw: (stage) => (alphabets(upper)(stage), stage.append(ui.line("Output so far:", so))) });
        }
        return { result: `${mode === "dec" ? "Plaintext" : "Ciphertext"}: ${output}`, steps };
    },
};

const diffieHellman = {
    id: "dh",
    name: "Diffie-Hellman",
    description: "Two people agree on a shared secret over a public channel. Only the public values travel; the private numbers never do.",
    fields: [
        { id: "p", label: "Prime $p$ (public)", type: "number", min: 3, max: 100000, stepFn: "prime", hint: "The + and − buttons jump to the next prime", value: "23" },
        { id: "g", label: "Generator $g$ (public)", type: "number", min: 2, max: 100000, value: "5" },
        { id: "a", label: "Alice's private $a$", type: "number", min: 1, max: 100000, value: "6" },
        { id: "b", label: "Bob's private $b$", type: "number", min: 1, max: 100000, value: "15" },
    ],
    examples: [
        { name: "Textbook (23, 5)", values: { p: "23", g: "5", a: "6", b: "15" } },
        { name: "Larger prime (101)", values: { p: "101", g: "2", a: "27", b: "53" } },
    ],
    random() {
        const p = randomPrime(11, 200);
        return { p: String(p), g: String(randInt(2, Math.min(p - 1, 12))), a: String(randInt(2, p - 2)), b: String(randInt(2, p - 2)) };
    },
    run(v) {
        const p = parseInt1(v.p, "p", 3, 1e6);
        if (!isPrime(p)) throw new Error(`${p} is not prime. Choose a prime for p.`);
        const g = parseInt1(v.g, "g", 2, p - 1);
        const a = parseInt1(v.a, "Alice's private number", 1, p - 1);
        const b = parseInt1(v.b, "Bob's private number", 1, p - 1);
        const [P, G, A, B] = [BigInt(p), BigInt(g), BigInt(a), BigInt(b)];

        const pubA = modPow(G, A, P);
        const pubB = modPow(G, B, P);
        const secretA = modPow(pubB, A, P);
        const secretB = modPow(pubA, B, P);

        const show = (...lines) => (stage) => stage.append(...lines.map(([l, x]) => ui.line(l, x)));
        const steps = [
            { text: `Alice and Bob publicly agree on $p = ${p}$ and $g = ${g}$.`, draw: show(["Public:", `p = ${p}, g = ${g}`]) },
            { text: `Alice computes her public value $A = g^{a} \\bmod p = ${g}^{${a}} \\bmod ${p} = ${pubA}$.`, draw: show(["Alice private:", String(a)], ["Alice public A:", String(pubA)]) },
            { text: `Bob computes his public value $B = g^{b} \\bmod p = ${g}^{${b}} \\bmod ${p} = ${pubB}$.`, draw: show(["Bob private:", String(b)], ["Bob public B:", String(pubB)]) },
            { text: `They swap $A$ and $B$ over the open channel. An eavesdropper sees only $p$, $g$, $${pubA}$ and $${pubB}$.`, draw: show(["Alice sends:", String(pubA)], ["Bob sends:", String(pubB)]) },
            { text: `Alice computes $B^{a} \\bmod p = ${pubB}^{${a}} \\bmod ${p} = ${secretA}$.`, draw: show(["Alice's secret:", String(secretA)]) },
            { text: `Bob computes $A^{b} \\bmod p = ${pubA}^{${b}} \\bmod ${p} = ${secretB}$. Both arrive at the same secret, $g^{ab} \\bmod p$.`, draw: show(["Bob's secret:", String(secretB)], ["Match:", secretA === secretB ? "yes" : "no"]) },
        ];
        return { result: `Shared secret: $${secretA}$`, steps };
    },
};

function egcdRows(a, b) {
    const rows = [];
    let [oldR, r] = [a, b];
    let [oldS, s] = [1n, 0n];
    let [oldT, t] = [0n, 1n];
    while (r !== 0n) {
        const q = oldR / r;
        rows.push([q.toString(), r.toString(), s.toString(), t.toString()]);
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
        [oldT, t] = [t, oldT - q * t];
    }
    return { gcd: oldR, x: oldS, y: oldT, rows };
}

const rsa = {
    id: "rsa",
    name: "RSA",
    description: "Public-key encryption from two primes. The public key $(e, n)$ encrypts with $c = m^{e} \\bmod n$; only the private key $(d, n)$ decrypts with $m = c^{d} \\bmod n$.",
    fields: [
        { id: "p", label: "Prime $p$", type: "number", min: 2, max: 100000, stepFn: "prime", hint: "The + and − buttons jump to the next prime", value: "61" },
        { id: "q", label: "Prime $q$", type: "number", min: 2, max: 100000, stepFn: "prime", value: "53" },
        { id: "e", label: "Public exponent $e$", type: "number", min: 2, max: 10000000, hint: "Must share no factor with $(p-1)(q-1)$", value: "17" },
        { id: "m", label: "Message (a number)", type: "number", min: 0, max: 10000000000, hint: "Smaller than $n = p \\times q$", value: "65" },
    ],
    actions: [
        {
            label: "Pick valid e",
            title: "Choose the smallest public exponent that works for these primes",
            apply: (v) => {
                const phi = (Number(v.p) - 1) * (Number(v.q) - 1);
                const gcd = (a, b) => (b ? gcd(b, a % b) : a);
                for (const e of [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 65537]) if (e < phi && gcd(e, phi) === 1) return { e: String(e) };
                return {};
            },
        },
    ],
    examples: [
        { name: "Textbook (61, 53)", values: { p: "61", q: "53", e: "17", m: "65" } },
        { name: "Tiny (7, 11)", values: { p: "7", q: "11", e: "7", m: "5" } },
        { name: "Medium (101, 113)", values: { p: "101", q: "113", e: "3533", m: "9726" } },
    ],
    random() {
        const p = randomPrime(11, 90);
        let q = randomPrime(11, 90);
        while (q === p) q = randomPrime(11, 90);
        const phi = (p - 1) * (q - 1);
        const gcd = (a, b) => (b ? gcd(b, a % b) : a);
        const e = [5, 7, 11, 13, 17, 19, 23].find((c) => gcd(c, phi) === 1) || 3;
        return { p: String(p), q: String(q), e: String(e), m: String(randInt(2, p * q - 1)) };
    },
    run(v) {
        const p = parseInt1(v.p, "p", 2, 100000);
        const q = parseInt1(v.q, "q", 2, 100000);
        if (!isPrime(p)) throw new Error(`${p} is not prime.`);
        if (!isPrime(q)) throw new Error(`${q} is not prime.`);
        if (p === q) throw new Error("p and q must be different primes.");
        const n = p * q;
        const phi = (p - 1) * (q - 1);
        const e = parseInt1(v.e, "e", 2, phi - 1);
        const m = parseInt1(v.m, "The message", 0, n - 1);
        const { gcd, x, rows } = egcdRows(BigInt(phi), BigInt(e));
        if (gcd !== 1n) throw new Error(`e = ${e} shares a factor with φ(n) = ${phi}. Pick another e.`);

        // e⁻¹ mod φ: the Bézout coefficient of e, made positive.
        const d = (() => {
            let r0 = BigInt(phi), r1 = BigInt(e), t0 = 0n, t1 = 1n;
            while (r1 !== 0n) {
                const k = r0 / r1;
                [r0, r1] = [r1, r0 - k * r1];
                [t0, t1] = [t1, t0 - k * t1];
            }
            return ((t0 % BigInt(phi)) + BigInt(phi)) % BigInt(phi);
        })();
        const N = BigInt(n);
        const c = modPow(BigInt(m), BigInt(e), N);
        const back = modPow(c, d, N);

        const show = (...lines) => (stage) => stage.append(...lines.map(([l, val]) => ui.line(l, val)));
        const steps = [
            { text: `$n = p \\times q = ${p} \\times ${q} = ${n}$.`, draw: show(["n:", String(n)]) },
            { text: `$\\varphi(n) = (p-1)(q-1) = ${p - 1} \\times ${q - 1} = ${phi}$.`, draw: show(["φ(n):", String(phi)]) },
            { text: `$e = ${e}$ has no common factor with $${phi}$ ($\\gcd = 1$), so it is a valid public exponent. Public key: $(${e},\\ ${n})$.`, draw: show(["Public key:", `(e = ${e}, n = ${n})`]) },
            {
                text: `The private exponent $d$ is the inverse of $e$ modulo $\\varphi(n)$, so $d \\cdot e \\equiv 1 \\pmod{\\varphi(n)}$. The extended Euclidean algorithm gives $d = ${d}$.`,
                draw: (stage) => stage.append(ui.table(["Quotient", "Remainder", "s", "t"], rows), ui.line("Private key:", `$(d = ${d},\\ n = ${n})$`)),
            },
            { text: `Encrypt: $c = m^{e} \\bmod n = ${m}^{${e}} \\bmod ${n} = ${c}$.`, draw: show(["Message m:", String(m)], ["Ciphertext c:", String(c)]) },
            { text: `Decrypt: $m = c^{d} \\bmod n = ${c}^{${d}} \\bmod ${n} = ${back}$${back === BigInt(m) ? ", the original message." : "."}`, draw: show(["Ciphertext c:", String(c)], ["Decrypted:", String(back)]) },
        ];
        return { result: `Public $(${e},\\ ${n})$  ·  Private $(${d},\\ ${n})$  ·  $${m} \\to ${c} \\to ${back}$`, steps };
    },
};

createLab({
    mount: document.getElementById("lab"),
    algorithms: [caesar, diffieHellman, rsa, sdesAlgorithm, aesAlgorithm],
});
