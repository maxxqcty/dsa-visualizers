/** Simplified DES (S-DES): 10-bit key, 8-bit block, two Feistel rounds. */

const SDES = {
    P10: [3, 5, 2, 7, 4, 10, 1, 9, 8, 6],
    P8: [6, 3, 7, 4, 8, 5, 10, 9],
    IP: [2, 6, 3, 1, 4, 8, 5, 7],
    IPINV: [4, 1, 3, 5, 7, 2, 8, 6],
    EP: [4, 1, 2, 3, 2, 3, 4, 1],
    P4: [2, 4, 3, 1],
    S0: [
        [1, 0, 3, 2],
        [3, 2, 0, 1],
        [0, 2, 1, 3],
        [2, 1, 0, 3],
    ],
    S1: [
        [0, 1, 2, 3],
        [2, 0, 1, 3],
        [3, 0, 1, 2],
        [2, 1, 0, 3],
    ],
};

const permute = (bits, table) => table.map((i) => bits[i - 1]);
const rotl = (bits, n) => bits.slice(n).concat(bits.slice(0, n));
const xor = (a, b) => a.map((bit, i) => bit ^ b[i]);
const str = (bits) => bits.join("");
const toBits = (s) => [...s].map(Number);

function sdesKeys(key) {
    const p10 = permute(key, SDES.P10);
    const left1 = rotl(p10.slice(0, 5), 1);
    const right1 = rotl(p10.slice(5), 1);
    const k1 = permute([...left1, ...right1], SDES.P8);
    const left2 = rotl(left1, 2);
    const right2 = rotl(right1, 2);
    const k2 = permute([...left2, ...right2], SDES.P8);
    return { p10, shifted1: [...left1, ...right1], k1, shifted2: [...left2, ...right2], k2 };
}

/** The f function on a 4-bit half; returns every intermediate value. */
function fFunction(right, subkey) {
    const expanded = permute(right, SDES.EP);
    const mixed = xor(expanded, subkey);
    const lookup = (half, table) => table[parseInt(`${half[0]}${half[3]}`, 2)][parseInt(`${half[1]}${half[2]}`, 2)];
    const s0 = lookup(mixed.slice(0, 4), SDES.S0);
    const s1 = lookup(mixed.slice(4), SDES.S1);
    const sOut = toBits(s0.toString(2).padStart(2, "0") + s1.toString(2).padStart(2, "0"));
    return { expanded, mixed, s0, s1, sOut, out: permute(sOut, SDES.P4) };
}

const sdesAlgorithm = {
    id: "sdes",
    name: "Simplified DES",
    description: "A tiny teaching version of DES: a 10-bit key makes two 8-bit subkeys, and the 8-bit block goes through an initial permutation, two Feistel rounds with a swap between them, and the inverse permutation.",
    fields: [
        { id: "mode", label: "Mode", type: "select", segmented: true, options: [{ value: "enc", label: "Encrypt" }, { value: "dec", label: "Decrypt" }], value: "enc" },
        { id: "key", label: "10-bit key", type: "bits", minBits: 10, maxBits: 10, hint: "Click a bit to flip it", value: "1010000010" },
        { id: "text", label: "8-bit block", type: "bits", minBits: 8, maxBits: 8, value: "01110010" },
    ],
    examples: [
        { name: "Textbook example", values: { mode: "enc", key: "1010000010", text: "01110010" } },
        { name: "Decrypt it back", values: { mode: "dec", key: "1010000010", text: "01110111" } },
    ],
    random() {
        const bits = (n) => Array.from({ length: n }, () => (Math.random() < 0.5 ? "1" : "0")).join("");
        return { key: bits(10), text: bits(8) };
    },
    run({ key, text, mode }) {
        if (!/^[01]{10}$/.test(key)) throw new Error("The key must be exactly 10 bits (0s and 1s).");
        if (!/^[01]{8}$/.test(text)) throw new Error("The block must be exactly 8 bits (0s and 1s).");
        const keys = sdesKeys(toBits(key));
        const decrypt = mode === "dec";
        const [first, second] = decrypt ? [keys.k2, keys.k1] : [keys.k1, keys.k2];
        const input = toBits(text);

        const kv = (...pairs) => (stage) => stage.append(...pairs.map(([label, value]) => ui.line(label, value)));
        const steps = [
            {
                text: "Key schedule: permute the key with P10, split into two 5-bit halves, rotate each left by 1 and compress with P8 to get K1.",
                draw: kv(["Key:", key], ["After P10:", str(keys.p10)], ["After left shift 1:", str(keys.shifted1)], ["K1 (P8):", str(keys.k1)]),
            },
            {
                text: "Rotate each half left by 2 more and compress with P8 again to get K2.",
                draw: kv(["After left shift 2:", str(keys.shifted2)], ["K2 (P8):", str(keys.k2)]),
            },
        ];

        const ip = permute(input, SDES.IP);
        steps.push({ text: `Initial permutation (IP) of ${text}.`, draw: kv(["Input:", text], ["After IP:", str(ip)], ["Left / right halves:", `${str(ip.slice(0, 4))} / ${str(ip.slice(4))}`]) });

        let left = ip.slice(0, 4);
        let right = ip.slice(4);
        [first, second].forEach((subkey, round) => {
            const f = fFunction(right, subkey);
            const newLeft = xor(left, f.out);
            steps.push({
                text: `Round ${round + 1} (${decrypt ? "K" + (2 - round) : "K" + (round + 1)} = ${str(subkey)}): expand the right half, XOR with the subkey, look up the S-boxes, permute with P4, and XOR into the left half.`,
                draw: kv(
                    ["Right half:", str(right)],
                    ["Expanded (EP):", str(f.expanded)],
                    ["XOR subkey:", str(f.mixed)],
                    ["S0 / S1 outputs:", `${f.s0} / ${f.s1} → ${str(f.sOut)}`],
                    ["After P4:", str(f.out)],
                    ["Left XOR P4:", str(newLeft)]
                ),
            });
            if (round === 0) {
                steps.push({ text: "Swap the two halves between the rounds.", draw: kv(["Before swap:", `${str(newLeft)} ${str(right)}`], ["After swap:", `${str(right)} ${str(newLeft)}`]) });
                left = right;
                right = newLeft;
            } else {
                left = newLeft;
            }
        });

        const out = permute([...left, ...right], SDES.IPINV);
        steps.push({ text: "The inverse initial permutation $\\mathrm{IP}^{-1}$ gives the final block.", draw: kv(["Before $\\mathrm{IP}^{-1}$:", str([...left, ...right])], ["Result:", str(out)]) });
        return { result: `${decrypt ? "Plaintext" : "Ciphertext"}: ${str(out)}`, steps };
    },
};
