// deps

    // natives
    import { equal } from "node:assert/strict";

    // locals
    import { installDomMock } from "./dom-mock.js";

// consts

    const banned = {
        "linkedinCode": "acme",
        "names": [ "Acme" ],
        "indicators": [ "BANNED" ],
        "comment": "note"
    };
    const salary = {
        "linkedinCode": "acme",
        "names": [ "Acme" ],
        "indicators": [ "SALARY_AND_ADVANTAGES" ]
    };
    const plain = {
        "linkedinCode": "acme",
        "names": [ "Acme" ],
        "indicators": []
    };

// private

    // methods
    function _install (html = "<!doctype html><html><body></body></html>", url = "https://www.linkedin.com/") {

        const dom = installDomMock(html, url);
        globalThis.history = dom.window.history;
        globalThis.AbortController = dom.window.AbortController;
        globalThis.requestAnimationFrame = (callback) => {

            return dom.window.setTimeout(() => {

                callback(0);

            }, 0);

        };

        return dom;

    }

    function _wait (delayMs) {

        return new Promise((resolve) => {

            setTimeout(resolve, delayMs);

        });

    }

    function _tooltip () {

        return document.querySelector(".li-tracker-tooltip");

    }

// init

if ("undefined" === typeof chrome) {

    const { installChromeMock } = await import("./chrome-mock.js");
    installChromeMock();

}

_install();

const {
    applyCompanyHighlight,
    clearElementHighlight,
    clearHighlights,
    createAddButton
} = await import("../lib/src/content/shared/highlighter.ts");
const { isAddCompanyModalOpen, showAddCompanyModal } = await import("../lib/src/content/shared/modal.ts");

// tests

describe("highlighter", () => {

    before(() => {

        _install();

    });

    beforeEach(() => {

        for (const node of [ ...document.body.children ]) {

            if (!node.classList.contains("li-tracker-tooltip")) {
                node.remove();
            }

        }

    });

    it("highlights a company, skips the same apply, and clears one element", () => {

        const element = document.createElement("h1");
        element.textContent = "Acme";
        document.body.append(element);

        applyCompanyHighlight(element, banned, "acme");

        equal(element.getAttribute("data-li-tracker-highlighted"), "acme");
        equal(element.classList.contains("li-tracker--highlighted"), true);
        equal(element.classList.contains("li-tracker--colored"), true);
        equal(element.style.getPropertyValue("--li-tracker-color"), "#dc2626");
        equal(element.querySelector("[data-li-tracker-icon]").textContent, "❌");

        element.querySelector("[data-li-tracker-icon]").remove();
        applyCompanyHighlight(element, banned, "acme");
        equal(element.querySelector("[data-li-tracker-icon]"), null);

        applyCompanyHighlight(element, salary, "acme");
        equal(element.classList.contains("li-tracker--colored"), false);
        equal(element.style.getPropertyValue("--li-tracker-color"), "");
        equal(element.querySelector("[data-li-tracker-icon]").textContent, "💵");

        applyCompanyHighlight(element, plain, "acme");
        equal(element.querySelector("[data-li-tracker-icon]"), null);

        clearElementHighlight(element);
        equal(element.hasAttribute("data-li-tracker-highlighted"), false);
        equal(element.querySelector("[data-li-tracker-icon]"), null);

    });

    it("paints only the ANSWER telephone green", () => {

        const element = document.createElement("h1");
        element.textContent = "Acme";
        document.body.append(element);

        applyCompanyHighlight(element, {
            "linkedinCode": "acme",
            "names": [ "Acme" ],
            "indicators": [ "ANSWER", "DONT_ANSWER" ]
        }, "acme");

        const icon = element.querySelector("[data-li-tracker-icon]");
        const glyphs = [ ...icon.querySelectorAll(".li-tracker-icon-glyph") ];

        equal(icon.textContent, "📞📞");
        equal(glyphs.length, 2);
        equal(glyphs[0].classList.contains("li-tracker-icon-glyph--answer"), false);
        equal(glyphs[1].classList.contains("li-tracker-icon-glyph--answer"), true);
        equal(glyphs[1].style.getPropertyValue("--li-tracker-glyph-color"), "#16a34a");
        equal(glyphs[1].style.getPropertyValue("font-variant-emoji"), "text");
        equal(glyphs[0].style.getPropertyValue("font-variant-emoji"), "");

    });

    it("paints the missing-salary glyph red", () => {

        const element = document.createElement("h1");
        element.textContent = "Acme";
        document.body.append(element);

        applyCompanyHighlight(element, {
            "linkedinCode": "acme",
            "names": [ "Acme" ],
            "indicators": [ "WITHOUT_SALARY_NOR_ADVANTAGES" ]
        }, "acme");

        const glyph = element.querySelector(".li-tracker-icon-glyph");
        const glyphChar = glyph.querySelector(".li-tracker-icon-glyph-char");

        equal(element.classList.contains("li-tracker--colored"), false);
        equal(glyph.textContent, "💵");
        equal(glyph.classList.contains("li-tracker-icon-glyph--tint"), true);
        equal(glyph.classList.contains("li-tracker-icon-glyph--answer"), false);
        equal(glyph.style.getPropertyValue("font-variant-emoji"), "");
        equal(glyphChar.style.getPropertyValue("font-variant-emoji"), "");

    });

    it("shows and hides the tooltip", () => {

        const element = document.createElement("h1");
        element.textContent = "Acme";
        document.body.append(element);
        applyCompanyHighlight(element, banned, "acme");

        element.dispatchEvent(new window.MouseEvent("mouseenter"));
        equal(_tooltip().hidden, false);
        equal(_tooltip().textContent, "Company to avoid\nnote: note");
        equal(_tooltip().style.top, "8px");

        window.dispatchEvent(new window.Event("scroll"));
        window.dispatchEvent(new window.Event("resize"));
        equal(_tooltip().hidden, false);

        element.dispatchEvent(new window.MouseEvent("mouseleave"));
        equal(_tooltip().hidden, true);
        window.dispatchEvent(new window.Event("scroll"));

        element.dispatchEvent(new window.FocusEvent("focus"));
        equal(_tooltip().hidden, false);
        element.dispatchEvent(new window.FocusEvent("blur"));
        equal(_tooltip().hidden, true);

    });

    it("clears highlights and add buttons in a root", () => {

        const kept = document.createElement("h1");
        const cleared = document.createElement("h1");
        const scope = document.createElement("div");
        scope.append(cleared);
        document.body.append(kept, scope);
        applyCompanyHighlight(kept, plain, "acme");
        applyCompanyHighlight(cleared, banned, "beta");

        const controller = new AbortController();
        scope.append(createAddButton(() => {}, controller.signal));

        clearHighlights(scope);

        equal(cleared.hasAttribute("data-li-tracker-highlighted"), false);
        equal(scope.querySelector(".li-tracker-add-btn"), null);
        equal(kept.hasAttribute("data-li-tracker-highlighted"), true);

        clearHighlights();
        equal(kept.hasAttribute("data-li-tracker-highlighted"), false);

    });

    it("drops a highlight when the company is missing", () => {

        const element = document.createElement("h1");
        document.body.append(element);
        applyCompanyHighlight(element, banned, "acme");
        applyCompanyHighlight(element, undefined, "acme");

        equal(element.hasAttribute("data-li-tracker-highlighted"), false);
        element.setAttribute("data-li-tracker-applied", "none");
        element.classList.add("li-tracker--highlighted");
        applyCompanyHighlight(element, undefined, "acme");
        equal(element.classList.contains("li-tracker--highlighted"), true);

    });

    it("calls the add button handler once", () => {

        let clicks = 0;
        let parentClicks = 0;
        const parent = document.createElement("div");
        const controller = new AbortController();
        const button = createAddButton(() => {

            clicks += 1;

        }, controller.signal);

        parent.append(button);
        parent.addEventListener("click", () => {

            parentClicks += 1;

        });
        document.body.append(parent);

        button.click();
        equal(clicks, 1);
        equal(parentClicks, 0);

        controller.abort();
        button.click();
        equal(clicks, 1);

    });

});

describe("add company modal", () => {

    beforeEach(() => {

        _install();

    });

    it("opens, cancels, and ignores a click inside the dialog", async () => {

        equal(isAddCompanyModalOpen(), false);

        showAddCompanyModal({
            "linkedinCode": "acme",
            "name": "Acme",
            "onSaved": () => {}
        });
        equal(isAddCompanyModalOpen(), true);
        equal(document.querySelector("textarea").value, "");

        document.querySelector(".li-tracker-modal").dispatchEvent(new window.MouseEvent("click", { "bubbles": true }));
        equal(isAddCompanyModalOpen(), true);

        document.querySelector(".li-tracker-modal-overlay").dispatchEvent(new window.MouseEvent("click", { "bubbles": true }));
        equal(isAddCompanyModalOpen(), false);

        showAddCompanyModal({
            "linkedinCode": "acme",
            "name": "Acme",
            "comment": "note",
            "onSaved": () => {}
        });
        showAddCompanyModal({
            "linkedinCode": "beta",
            "name": "Beta",
            "onSaved": () => {}
        });
        equal(document.querySelectorAll(".li-tracker-modal-overlay").length, 1);
        equal(document.querySelector("textarea").value, "");

        document.querySelector(".li-tracker-modal-btn--secondary").click();
        equal(isAddCompanyModalOpen(), false);
        await _wait(60);

    });

    it("saves the selected indicators and reports a failed save", async () => {

        const saved = [];
        const original = chrome.runtime.sendMessage;

        showAddCompanyModal({
            "linkedinCode": " Acme/ ",
            "name": "  ",
            "onSaved": (company) => {

                saved.push(company);

            }
        });

        document.querySelector("form").requestSubmit();
        equal(document.querySelector(".li-tracker-modal-error").textContent, "Name is required.");
        equal(isAddCompanyModalOpen(), true);

        document.querySelector(".li-tracker-modal-btn--secondary").click();

        showAddCompanyModal({
            "linkedinCode": "acme",
            "name": "Acme",
            "comment": "  note  ",
            "onSaved": (company) => {

                saved.push(company);

            }
        });

        const salaryButton = [ ...document.querySelectorAll(".li-tracker-modal-indicator") ].find((button) => {

            return button.textContent.includes("SALARY_AND_ADVANTAGES");

        });
        const bannedButton = [ ...document.querySelectorAll(".li-tracker-modal-indicator") ].find((button) => {

            return button.textContent.includes("BANNED");

        });

        const answerButton = [ ...document.querySelectorAll(".li-tracker-modal-indicator") ].find((button) => {

            return button.textContent.includes("ANSWER — Replies");

        });
        const quietButton = [ ...document.querySelectorAll(".li-tracker-modal-indicator") ].find((button) => {

            return button.textContent.includes("DONT_ANSWER");

        });

        const unpaidButton = [ ...document.querySelectorAll(".li-tracker-modal-indicator") ].find((button) => {

            return button.textContent.includes("WITHOUT_SALARY_NOR_ADVANTAGES");

        });

        equal(salaryButton.style.color, "");
        equal(bannedButton.style.color.length > 0, true);
        equal(unpaidButton.style.color, "");
        equal(unpaidButton.querySelector("span").classList.contains("li-tracker-icon-glyph--tint"), true);
        equal(unpaidButton.querySelector("span").style.getPropertyValue("font-variant-emoji"), "");
        equal(answerButton.querySelector("span").style.getPropertyValue("-webkit-text-fill-color"), "rgb(22, 163, 74)");
        equal(answerButton.querySelector("span").style.getPropertyValue("font-variant-emoji"), "text");
        equal(quietButton.querySelector("span").style.getPropertyValue("-webkit-text-fill-color"), "");
        equal(quietButton.querySelector("span").style.getPropertyValue("font-variant-emoji"), "");

        bannedButton.click();
        equal(bannedButton.getAttribute("aria-pressed"), "true");
        bannedButton.click();
        equal(bannedButton.getAttribute("aria-pressed"), "false");
        bannedButton.click();

        const saveButton = document.querySelector("button[type=\"submit\"]");
        chrome.runtime.sendMessage = async (message) => {

            equal(saveButton.textContent, "Saving…");
            equal(saveButton.disabled, true);
            saved.push(message.company);

            return { "ok": true, "registry": {} };

        };

        try {

            document.querySelector("form").requestSubmit();
            await _wait(0);
            equal(isAddCompanyModalOpen(), false);
            equal(saved[0].linkedinCode, "acme");
            equal(saved[0].names[0], "Acme");
            equal(saved[0].indicators[0], "BANNED");
            equal(saved[0].comment, "note");

            showAddCompanyModal({
                "linkedinCode": "acme",
                "name": "Acme",
                "onSaved": () => {

                    saved.push("saved");

                }
            });
            chrome.runtime.sendMessage = async () => {

                return { "ok": false, "error": "nope" };

            };
            document.querySelector("form").requestSubmit();
            await _wait(0);

            const error = document.querySelector(".li-tracker-modal-error");
            equal(error.hidden, false);
            equal(error.textContent, "nope");
            equal(saveButton.textContent, "Save");
            equal(isAddCompanyModalOpen(), true);
            equal(saved.includes("saved"), false);

        }
        finally {

            chrome.runtime.sendMessage = original;

        }

        await _wait(60);

    });

    it("logs a send failure", async () => {

        const original = chrome.runtime.sendMessage;
        const errors = [];
        const error = console.error;
        chrome.runtime.sendMessage = async () => {

            throw new Error("boom");

        };
        console.error = (value) => {

            errors.push(value);

        };

        try {

            showAddCompanyModal({
                "linkedinCode": "acme",
                "name": "Acme",
                "onSaved": () => {}
            });
            document.querySelector("form").requestSubmit();
            await _wait(0);
            equal(errors[0].message, "boom");
            equal(isAddCompanyModalOpen(), true);

        }
        finally {

            console.error = error;
            chrome.runtime.sendMessage = original;

        }

    });

});
