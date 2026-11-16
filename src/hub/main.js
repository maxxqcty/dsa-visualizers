/** Home page: filter the topic cards by search text and category. */
(function () {
    const search = document.getElementById("search");
    const radios = document.querySelectorAll('input[name="category"]');
    const cards = [...document.querySelectorAll(".card")];
    const count = document.getElementById("resultCount");
    const none = document.getElementById("noMatch");

    const haystack = new Map(cards.map((card) => [card, card.textContent.toLowerCase().replace(/\s+/g, " ")]));

    function apply() {
        const query = search.value.trim().toLowerCase();
        const category = document.querySelector('input[name="category"]:checked').value;
        const words = query ? query.split(/\s+/) : [];
        let shown = 0;

        for (const card of cards) {
            const matches = (!category || card.dataset.category === category) && words.every((word) => haystack.get(card).includes(word));
            card.hidden = !matches;
            if (matches) shown++;
        }

        none.hidden = shown !== 0;
        count.textContent = `${shown} topic${shown === 1 ? "" : "s"} shown.`;
    }

    search.addEventListener("input", apply);
    radios.forEach((radio) => radio.addEventListener("change", apply));

    // Press "/" anywhere to jump to the search box.
    document.addEventListener("keydown", (event) => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
        if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            search.focus();
        }
    });

    apply();
})();
