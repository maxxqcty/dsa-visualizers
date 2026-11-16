/** AES-128 (one block), shown round by round. Pure logic first, then the visualizer definition. */

const AES = (() => {
    function gmul(a, b) {
        let product = 0;
        for (let i = 0; i < 8; i++) {
            if (b & 1) product ^= a;
            const hi = a & 0x80;
            a = (a << 1) & 0xff;
            if (hi) a ^= 0x1b;
            b >>= 1;
        }
        return product;
    }

    // S-box: multiplicative inverse in GF(2^8), then an affine transform.
    const SBOX = (() => {
        const box = new Array(256);
        for (let x = 0; x < 256; x++) {
            let inv = 0;
            if (x) for (let y = 1; y < 256; y++) if (gmul(x, y) === 1) inv = y;
            let s = inv;
            let r = inv;
            for (let i = 0; i < 4; i++) {
                r = ((r << 1) | (r >> 7)) & 0xff;
                s ^= r;
            }
            box[x] = s ^ 0x63;
        }
        return box;
    })();

    const hex = (n) => n.toString(16).padStart(2, "0").toUpperCase();

    function expandKey(key) {
        const w = [];
        for (let i = 0; i < 4; i++) w.push(key.slice(4 * i, 4 * i + 4));
        let rcon = 1;
        for (let i = 4; i < 44; i++) {
            let temp = w[i - 1].slice();
            if (i % 4 === 0) {
                temp = [SBOX[temp[1]] ^ rcon, SBOX[temp[2]], SBOX[temp[3]], SBOX[temp[0]]];
                rcon = gmul(rcon, 2);
            }
            w.push(w[i - 4].map((b, j) => b ^ temp[j]));
        }
        const roundKeys = [];
        for (let r = 0; r < 11; r++) roundKeys.push(w.slice(4 * r, 4 * r + 4).flat());
        return roundKeys;
    }

    const subBytes = (s) => s.map((b) => SBOX[b]);
    const addRoundKey = (s, k) => s.map((b, i) => b ^ k[i]);
    function shiftRows(s) {
        const out = new Array(16);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[r + 4 * c] = s[r + 4 * ((c + r) % 4)];
        return out;
    }
    function mixColumns(s) {
        const out = new Array(16);
        for (let c = 0; c < 4; c++) {
            const [a0, a1, a2, a3] = s.slice(4 * c, 4 * c + 4);
            out[4 * c] = gmul(a0, 2) ^ gmul(a1, 3) ^ a2 ^ a3;
            out[4 * c + 1] = a0 ^ gmul(a1, 2) ^ gmul(a2, 3) ^ a3;
            out[4 * c + 2] = a0 ^ a1 ^ gmul(a2, 2) ^ gmul(a3, 3);
            out[4 * c + 3] = gmul(a0, 3) ^ a1 ^ a2 ^ gmul(a3, 2);
        }
        return out;
    }

    /** Encrypt one block; returns the state after every named stage. */
    function encrypt(block, key) {
        const keys = expandKey(key);
        const stages = [];
        let state = addRoundKey(block, keys[0]);
        stages.push({ name: "Initial AddRoundKey", state });
        for (let round = 1; round <= 10; round++) {
            state = subBytes(state);
            stages.push({ name: `Round ${round}: SubBytes`, state });
            state = shiftRows(state);
            stages.push({ name: `Round ${round}: ShiftRows`, state });
            if (round < 10) {
                state = mixColumns(state);
                stages.push({ name: `Round ${round}: MixColumns`, state });
            }
            state = addRoundKey(state, keys[round]);
            stages.push({ name: `Round ${round}: AddRoundKey`, state });
        }
        return { keys, stages, cipher: state };
    }

    return { encrypt, hex, expandKey };
})();

/** Text of 16 chars, or 32 hex digits, to 16 bytes. */
function parseBlock(text, label) {
    const clean = text.replace(/\s+/g, "");
    if (/^[0-9a-fA-F]{32}$/.test(clean)) return clean.match(/../g).map((h) => parseInt(h, 16));
    const bytes = [...new TextEncoder().encode(text)];
    if (bytes.length !== 16) throw new Error(`${label} must be exactly 16 characters, or 32 hex digits (it has ${bytes.length} bytes).`);
    return bytes;
}

const aesAlgorithm = {
    id: "aes",
    name: "AES-128",
    description: "Encrypt one 16-byte block. Each round substitutes bytes (SubBytes), rotates rows (ShiftRows), mixes columns (MixColumns) and XORs a round key. Bytes that changed in a step are highlighted.",
    fields: [
        { id: "plain", label: "Plaintext", hint: "Exactly 16 characters, or 32 hex digits", value: "Two One Nine Two" },
        { id: "key", label: "Key", hint: "Exactly 16 characters, or 32 hex digits", value: "Thats my Kung Fu" },
    ],
    actions: [
        {
            label: "Random key",
            title: "Generate a random 128-bit key (as hex)",
            apply: () => ({ key: Array.from({ length: 32 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("") }),
        },
    ],
    examples: [
        { name: "Rijndael walkthrough", values: { plain: "Two One Nine Two", key: "Thats my Kung Fu" } },
        { name: "FIPS-197 test vector", values: { plain: "00112233445566778899aabbccddeeff", key: "000102030405060708090a0b0c0d0e0f" } },
    ],
    run({ plain, key }) {
        const block = parseBlock(plain, "The plaintext");
        const keyBytes = parseBlock(key, "The key");
        const { keys, stages, cipher } = AES.encrypt(block, keyBytes);

        const grid = (state, previous, title) => (stage) => {
            const cells = [];
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    const i = r + 4 * c;
                    cells.push(el("div", { class: "lab-cell " + (previous && previous[i] !== state[i] ? "is-active" : ""), text: AES.hex(state[i]) }));
                }
            }
            stage.append(el("p", { class: "lab-caption", text: title }), el("div", { class: "aes-grid", role: "img", "aria-label": title }, cells));
        };

        const explain = (name) =>
            name.includes("SubBytes")
                ? "Every byte is replaced using the S-box lookup table."
                : name.includes("ShiftRows")
                ? "Row 0 stays; rows 1, 2 and 3 rotate left by 1, 2 and 3 positions."
                : name.includes("MixColumns")
                ? "Each column is multiplied by a fixed matrix over $\\mathrm{GF}(2^{8})$."
                : name.includes("Initial")
                ? "The plaintext block is XORed with the original key."
                : "The state is XORed with this round's key.";

        const steps = [
            { text: "The 16 plaintext bytes fill a 4×4 grid, column by column.", draw: grid(block, null, "Plaintext state") },
            {
                text: "The key is expanded into 11 round keys (one per round plus the initial one).",
                draw: (stage) => stage.append(ui.table(["Round", "Round key"], keys.map((k, i) => [i, k.map(AES.hex).join(" ")]))),
            },
        ];
        let before = block;
        for (const stage of stages) {
            steps.push({ text: `${stage.name}. ${explain(stage.name)}`, draw: grid(stage.state, before, stage.name) });
            before = stage.state;
        }
        return { result: `Ciphertext (hex): ${cipher.map(AES.hex).join("")}`, steps };
    },
};
