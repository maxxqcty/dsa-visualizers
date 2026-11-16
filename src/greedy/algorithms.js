/** Greedy algorithms: activity selection, fractional knapsack, coin change, job sequencing, mice to holes. */

/** "1-4, 3-5" -> [[1,4],[3,5]] (also accepts "1:4" or "1 4"). */
function parsePairs(text, sep, what) {
    const items = text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) throw new Error(`Enter some ${what}.`);
    return items.map((item) => {
        const parts = item.split(/[\s:\-]+/).filter(Boolean);
        const nums = parts.map(Number);
        if (parts.length !== 2 || nums.some((n) => !Number.isFinite(n))) {
            throw new Error(`"${item}" should look like ${sep}.`);
        }
        return nums;
    });
}

const activitySelection = {
    id: "activity",
    name: "Activity selection",
    description:
        "Pick the most activities that don't overlap. Greedy rule: sort by finish time, then take every activity that starts after the last chosen one ends.",
    fields: [
        {
            id: "activities",
            label: "Activities",
            type: "rows",
            sep: "-",
            maxRows: 20,
            columns: [{ label: "Start", type: "number" }, { label: "End", type: "number" }],
            value: "1-4, 3-5, 0-6, 5-7, 3-9, 5-9, 6-10, 8-11, 8-12, 2-14, 12-16",
        },
    ],
    examples: [
        { name: "Classic (11 activities)", values: { activities: "1-4, 3-5, 0-6, 5-7, 3-9, 5-9, 6-10, 8-11, 8-12, 2-14, 12-16" } },
        { name: "All overlap", values: { activities: "1-5, 2-6, 3-7, 4-8" } },
        { name: "Back to back", values: { activities: "0-2, 2-4, 4-6, 6-8" } },
    ],
    random() {
        const count = randInt(5, 9);
        const rows = Array.from({ length: count }, () => {
            const start = randInt(0, 14);
            return `${start}-${start + randInt(1, 6)}`;
        });
        return { activities: rows.join(", ") };
    },
    run({ activities }) {
        const list = parsePairs(activities, "start-end", "activities");
        if (list.length > 30) throw new Error("Use at most 30 activities.");
        list.forEach(([s, e], i) => {
            if (e <= s) throw new Error(`Activity ${i + 1} must end after it starts.`);
        });

        const items = list.map(([start, end], i) => ({ id: i + 1, start, end })).sort((a, b) => a.end - b.end || a.start - b.start);
        const maxTime = Math.max(...items.map((a) => a.end));
        const minTime = Math.min(...items.map((a) => a.start), 0);
        const status = items.map(() => "pending");

        const draw = (focus, st) => (stage) => {
            const span = maxTime - minTime || 1;
            stage.append(
                el(
                    "div",
                    { class: "timeline", role: "img", "aria-label": "Activities on a timeline" },
                    items.map((a, i) =>
                        el(
                            "div",
                            { class: "timeline-row" },
                            el("span", { class: "timeline-label", text: `A${a.id}` }),
                            el(
                                "div",
                                { class: "timeline-track" },
                                el("div", {
                                    class: `timeline-bar is-${i === focus ? "active" : st[i]}`,
                                    style: `left:${((a.start - minTime) / span) * 100}%;width:${((a.end - a.start) / span) * 100}%`,
                                    text: `${a.start}–${a.end}`,
                                })
                            )
                        )
                    )
                ),
                el("p", { class: "lab-legend" }, "Green: selected · Amber: considering · Red: overlaps · Grey: not yet looked at")
            );
        };

        const steps = [{ text: `Sorted by finish time: ${items.map((a) => `A${a.id}(${a.start}–${a.end})`).join(", ")}.`, draw: draw(-1, status.slice()) }];
        const chosen = [];
        let lastEnd = -Infinity;
        items.forEach((a, i) => {
            const take = a.start >= lastEnd;
            steps.push({
                text: take
                    ? `A${a.id} starts at ${a.start}, which is at or after ${lastEnd === -Infinity ? "the beginning" : lastEnd}. Select it.`
                    : `A${a.id} starts at ${a.start}, before the last chosen activity ends at ${lastEnd}. Skip it.`,
                draw: draw(i, status.slice()),
            });
            status[i] = take ? "good" : "bad";
            if (take) {
                chosen.push(a);
                lastEnd = a.end;
            }
        });
        steps.push({ text: `Done: ${chosen.length} activities selected.`, draw: draw(-1, status.slice()) });
        return { result: `Selected ${chosen.length}: ${chosen.map((a) => `A${a.id}`).join(", ")}`, steps };
    },
};

const knapsack = {
    id: "knapsack",
    name: "Fractional knapsack",
    description:
        "Fill a bag of limited capacity for maximum profit, taking fractions of items. Greedy rule: take items in order of their ratio $\\dfrac{\\text{profit}}{\\text{weight}}$, best first.",
    fields: [
        { id: "capacity", label: "Bag capacity", type: "number", min: 1, max: 500, slider: true, value: "50" },
        {
            id: "items",
            label: "Items",
            type: "rows",
            sep: ":",
            maxRows: 12,
            columns: [{ label: "Profit", type: "number" }, { label: "Weight", type: "number" }],
            value: "60:10, 100:20, 120:30",
        },
    ],
    examples: [
        { name: "Textbook (3 items)", values: { capacity: "50", items: "60:10, 100:20, 120:30" } },
        { name: "Everything fits", values: { capacity: "100", items: "10:5, 20:10, 30:15" } },
        { name: "Tight bag", values: { capacity: "15", items: "24:6, 20:5, 18:9, 30:10, 9:3" } },
    ],
    random() {
        const count = randInt(3, 6);
        const items = Array.from({ length: count }, () => `${randInt(10, 120)}:${randInt(3, 30)}`);
        return { capacity: String(randInt(20, 80)), items: items.join(", ") };
    },
    run({ capacity, items: text }) {
        const cap = Number(capacity);
        if (!(cap > 0)) throw new Error("Capacity must be a positive number.");
        const list = parsePairs(text, "profit:weight", "items").map(([profit, weight], i) => {
            if (!(profit >= 0) || !(weight > 0)) throw new Error(`Item ${i + 1} needs profit ≥ 0 and weight > 0.`);
            return { id: i + 1, profit, weight, ratio: profit / weight, taken: 0 };
        });
        if (list.length > 20) throw new Error("Use at most 20 items.");
        const sorted = list.slice().sort((a, b) => b.ratio - a.ratio);

        const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
        const view = (remaining, profit, focus, taken) => (stage) => {
            stage.append(
                ui.table(
                    ["Item", "Profit", "Weight", "$p/w$", "Taken"],
                    sorted.map((it) => [it.id, it.profit, it.weight, it.ratio.toFixed(2), `${fmt(taken[it.id] ?? 0)}`]),
                    { state: (i) => (i === focus ? "active" : (taken[sorted[i].id] ?? 0) > 0 ? "good" : "") }
                ),
                ui.meter((cap - remaining) / cap, `Bag filled: ${fmt(cap - remaining)} of ${fmt(cap)}`),
                ui.line("Profit so far:", fmt(profit))
            );
        };

        let remaining = cap;
        let profit = 0;
        const taken = {};
        const steps = [
            {
                text: `Sort by the ratio $p/w$ (best first): ${sorted.map((i) => `#${i.id} (${i.ratio.toFixed(2)})`).join(", ")}.`,
                draw: view(remaining, profit, -1, { ...taken }),
            },
        ];
        sorted.forEach((it, i) => {
            if (remaining <= 0) return;
            const fraction = Math.min(1, remaining / it.weight);
            taken[it.id] = fraction;
            remaining -= fraction * it.weight;
            profit += fraction * it.profit;
            const snap = { ...taken };
            const r = remaining;
            const p = profit;
            steps.push({
                text:
                    fraction === 1
                        ? `Take all of item ${it.id} (weight $${it.weight}$, profit $${it.profit}$).`
                        : `Only $${fmt(fraction * it.weight)}$ of $${it.weight}$ fits, so take the fraction $${fmt(fraction)}$ of item ${it.id} (profit $${fmt(fraction * it.profit)}$). The bag is full.`,
                draw: view(r, p, i, snap),
            });
        });
        return { result: `Maximum profit: ${fmt(profit)}`, steps };
    },
};

const coinChange = {
    id: "coins",
    name: "Coin change",
    description:
        "Fewest coins that add up to an amount. This uses a dynamic-programming table (the plain greedy rule can fail for unusual coin sets): $\\mathrm{dp}[a] = \\min\\left(\\mathrm{dp}[a],\\ \\mathrm{dp}[a-c] + 1\\right)$ for each coin $c$.",
    fields: [
        { id: "coins", label: "Coin values", type: "list", min: 1, max: 500, maxItems: 8, placeholder: "Add a coin", hint: "Type a value, then press Enter", value: "1, 5, 10, 25" },
        { id: "amount", label: "Amount", type: "number", min: 0, max: 200, slider: true, value: "63" },
    ],
    examples: [
        { name: "US coins, 63", values: { coins: "1, 5, 10, 25", amount: "63" } },
        { name: "Greedy fails (1, 3, 4 → 6)", values: { coins: "1, 3, 4", amount: "6" } },
        { name: "Impossible amount", values: { coins: "5, 10", amount: "13" } },
    ],
    random() {
        const pool = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25];
        const coins = pool.filter(() => Math.random() < 0.35).slice(0, 4);
        return { coins: (coins.length ? coins : [1, 5]).join(", "), amount: String(randInt(10, 90)) };
    },
    run({ coins: coinText, amount: amountText }) {
        const coins = [...new Set(parseInts(coinText, "coin values"))].sort((a, b) => a - b);
        if (coins.some((c) => c <= 0)) throw new Error("Coin values must be positive.");
        const amount = parseInt1(amountText, "Amount", 0, 200);

        const dp = Array(amount + 1).fill(Infinity);
        const via = Array(amount + 1).fill(null);
        dp[0] = 0;
        const show = (n) => (n === Infinity ? "∞" : n);
        const draw = (changed, title) => (snapshot) => (stage) => {
            stage.append(
                ui.cells(snapshot.map(show), {
                    title,
                    states: snapshot.map((v, i) => (changed.has(i) ? "active" : v === Infinity ? "dim" : "")),
                    labels: snapshot.map((_, i) => i),
                })
            );
        };

        const steps = [{ text: "$\\mathrm{dp}[a]$ is the fewest coins to make amount $a$. Start with $\\mathrm{dp}[0] = 0$ and everything else unreachable ($\\infty$).", draw: draw(new Set(), "Fewest coins for each amount")(dp.slice()) }];
        for (const coin of coins) {
            const changed = new Set();
            for (let a = coin; a <= amount; a++) {
                if (dp[a - coin] + 1 < dp[a]) {
                    dp[a] = dp[a - coin] + 1;
                    via[a] = coin;
                    changed.add(a);
                }
            }
            steps.push({
                text: changed.size
                    ? `Allow coin $${coin}$: ${changed.size} amount${changed.size === 1 ? "" : "s"} improved (highlighted).`
                    : `Allow coin $${coin}$: no amount gets better.`,
                draw: draw(changed, `After allowing coin ${coin}`)(dp.slice()),
            });
        }

        if (dp[amount] === Infinity) {
            steps.push({ text: `${amount} cannot be made with these coins.`, draw: draw(new Set([amount]), "Final table")(dp.slice()) });
            return { result: `It is not possible to make ${amount}.`, steps };
        }
        const used = [];
        for (let a = amount; a > 0; a -= via[a]) used.push(via[a]);
        steps.push({
            text: `$\\mathrm{dp}[${amount}] = ${dp[amount]}$. Walking back through the table gives the coins: $${used.join(" + ")}$.`,
            draw: draw(new Set([amount]), "Final table")(dp.slice()),
        });
        return { result: `Minimum coins for ${amount}: ${dp[amount]} (${used.join(" + ") || "none"})`, steps };
    },
};

const jobSequencing = {
    id: "jobs",
    name: "Job sequencing",
    description:
        "Schedule unit-time jobs before their deadlines for maximum profit. Greedy rule: take jobs by highest profit and put each in the latest free slot at or before its deadline.",
    fields: [
        {
            id: "jobs",
            label: "Jobs",
            type: "rows",
            sep: ":",
            maxRows: 12,
            columns: [{ label: "Deadline", type: "number" }, { label: "Profit", type: "number" }],
            value: "2:100, 1:19, 2:27, 1:25, 3:15",
        },
    ],
    examples: [
        { name: "Textbook (5 jobs)", values: { jobs: "2:100, 1:19, 2:27, 1:25, 3:15" } },
        { name: "Competing deadlines", values: { jobs: "1:50, 1:40, 2:30, 2:20, 3:10" } },
    ],
    random() {
        const count = randInt(4, 7);
        return { jobs: Array.from({ length: count }, () => `${randInt(1, 4)}:${randInt(10, 100)}`).join(", ") };
    },
    run({ jobs: text }) {
        const jobs = parsePairs(text, "deadline:profit", "jobs").map(([deadline, profit], i) => {
            if (!Number.isInteger(deadline) || deadline < 1) throw new Error(`Job J${i + 1} needs a whole deadline of at least 1.`);
            return { name: `J${i + 1}`, deadline, profit };
        });
        if (jobs.length > 20) throw new Error("Use at most 20 jobs.");
        const slots = Math.min(Math.max(...jobs.map((j) => j.deadline)), jobs.length);
        const sorted = jobs.slice().sort((a, b) => b.profit - a.profit);

        const view = (schedule, focus, total) => (stage) => {
            stage.append(
                ui.cells(schedule.map((s) => s ?? "—"), {
                    title: "Time slots",
                    states: schedule.map((s) => (s ? "good" : "dim")),
                    labels: schedule.map((_, i) => `slot ${i + 1}`),
                }),
                ui.table(
                    ["Job", "Deadline", "Profit"],
                    sorted.map((j) => [j.name, j.deadline, j.profit]),
                    { state: (i) => (i === focus ? "active" : schedule.includes(sorted[i].name) ? "good" : "") }
                ),
                ui.line("Total profit:", String(total))
            );
        };

        const schedule = Array(slots).fill(null);
        let total = 0;
        const steps = [{ text: `Sort jobs by profit: ${sorted.map((j) => j.name).join(", ")}. There are ${slots} slot${slots === 1 ? "" : "s"}.`, draw: view(schedule.slice(), -1, 0) }];
        sorted.forEach((job, i) => {
            let slot = Math.min(slots, job.deadline) - 1;
            while (slot >= 0 && schedule[slot]) slot--;
            if (slot >= 0) {
                schedule[slot] = job.name;
                total += job.profit;
            }
            steps.push({
                text: slot >= 0
                    ? `${job.name} (deadline ${job.deadline}, profit ${job.profit}) goes in slot ${slot + 1}.`
                    : `${job.name} (deadline ${job.deadline}): every slot up to its deadline is taken. Skip it.`,
                draw: view(schedule.slice(), i, total),
            });
        });
        return { result: `Sequence: ${schedule.map((s) => s ?? "—").join(" → ")} · Maximum profit: ${total}`, steps };
    },
};

/**
 * Number line for "mice to holes": mice sit above the line, holes below, and
 * a segment joins each mouse to the hole it was paired with (distance on it).
 */
function miceNumberLine(mice, holes, upTo, focus) {
    const NS = "http://www.w3.org/2000/svg";
    const make = (tag, attrs = {}, ...kids) => {
        const node = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
        kids.flat().forEach((kid) => kid && node.append(kid));
        return node;
    };
    const text = (t) => document.createTextNode(String(t));

    const W = 640;
    const H = 190;
    const PAD = 40;
    const AXIS = 95;
    const all = [...mice, ...holes];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = max - min || 1;
    const x = (v) => PAD + ((v - min) / span) * (W - PAD * 2);
    const tickEvery = span <= 20 ? 1 : span <= 40 ? 2 : span <= 100 ? 5 : 10;

    const ticks = [];
    for (let v = Math.ceil(min / tickEvery) * tickEvery; v <= max; v += tickEvery) {
        ticks.push(make("line", { class: "mh-tick", x1: x(v), y1: AXIS - 4, x2: x(v), y2: AXIS + 4 }));
        ticks.push(make("text", { class: "mh-tick-label", x: x(v), y: AXIS + 20, "text-anchor": "middle" }, text(v)));
    }

    const pairs = mice.slice(0, upTo).map((m, i) => {
        const h = holes[i];
        const classes = "mh-pair" + (i === focus ? " is-current" : "");
        return make(
            "g",
            { class: classes },
            make("line", { x1: x(m), y1: 48, x2: x(h), y2: 142 }),
            make("text", { class: "mh-dist", x: (x(m) + x(h)) / 2 + 12, y: 99, "text-anchor": "start" }, text(Math.abs(m - h)))
        );
    });

    const mouse = (m, i) =>
        make("g", { class: "mh-mouse", transform: `translate(${x(m)},48)` }, make("circle", { r: 11 }), make("text", { y: 4, "text-anchor": "middle" }, text(m)));
    const hole = (h) =>
        make("g", { class: "mh-hole", transform: `translate(${x(h)},142)` }, make("circle", { r: 11 }), make("text", { y: 4, "text-anchor": "middle" }, text(h)));

    return make(
        "svg",
        { class: "mh-svg", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Mice above a number line and holes below it, joined by the pairs chosen so far" },
        make("line", { class: "mh-axis", x1: PAD - 10, y1: AXIS, x2: W - PAD + 10, y2: AXIS }),
        ticks,
        make("text", { class: "mh-legend", x: 4, y: 14 }, text("Mice")),
        make("text", { class: "mh-legend", x: 4, y: H - 8 }, text("Holes")),
        pairs,
        mice.map(mouse),
        holes.map(hole)
    );
}

const miceToHoles = {
    id: "mice",
    name: "Mice to holes",
    description:
        "Assign each mouse to a hole so the farthest any mouse travels, $\\max_i |m_i - h_i|$, is as small as possible. Greedy rule: sort both lists and pair them in order.",
    fields: [
        { id: "mice", label: "Mouse positions", type: "list", min: -100, max: 100, maxItems: 10, placeholder: "Add a position", value: "4, -4, 2" },
        { id: "holes", label: "Hole positions", type: "list", min: -100, max: 100, maxItems: 10, placeholder: "Add a position", hint: "Same count as mice", value: "4, 0, 5" },
    ],
    examples: [
        { name: "Three mice", values: { mice: "4, -4, 2", holes: "4, 0, 5" } },
        { name: "Already matched", values: { mice: "1, 5, 9", holes: "1, 5, 9" } },
    ],
    random() {
        const n = randInt(3, 6);
        const pick = () => Array.from({ length: n }, () => randInt(-10, 10)).join(", ");
        return { mice: pick(), holes: pick() };
    },
    run({ mice: miceText, holes: holesText }) {
        const mice = parseInts(miceText, "mouse positions").sort((a, b) => a - b);
        const holes = parseInts(holesText, "hole positions").sort((a, b) => a - b);
        if (mice.length !== holes.length) throw new Error("There must be the same number of mice and holes.");
        if (mice.length > 15) throw new Error("Use at most 15 mice.");

        const view = (upTo, focus) => (stage) => {
            stage.append(
                miceNumberLine(mice, holes, upTo, focus),
                ui.table(
                    ["Mouse", "Hole", "$|m - h|$"],
                    mice.slice(0, upTo).map((m, i) => [m, holes[i], Math.abs(m - holes[i])]),
                    { state: (i) => (i === focus ? "active" : "") }
                )
            );
        };

        const steps = [{ text: `Sorted mice: ${mice.join(", ")}. Sorted holes: ${holes.join(", ")}.`, draw: view(0, -1) }];
        let max = 0;
        mice.forEach((m, i) => {
            const d = Math.abs(m - holes[i]);
            max = Math.max(max, d);
            steps.push({ text: `Mouse at $${m}$ goes to the hole at $${holes[i]}$: distance $|${m} - ${holes[i]}| = ${d}$. Longest so far: $${max}$.`, draw: view(i + 1, i) });
        });
        return { result: `Smallest possible longest trip: ${max}`, steps };
    },
};

createLab({
    mount: document.getElementById("lab"),
    algorithms: [activitySelection, knapsack, coinChange, jobSequencing, miceToHoles],
});
