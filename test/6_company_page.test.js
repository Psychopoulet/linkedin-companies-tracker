// deps

    // natives
    import { equal } from "node:assert/strict";

    // locals
    import { installDomMock } from "./dom-mock.js";
    import { REGISTRY_STORAGE_KEY } from "../lib/src/storage/constants.ts";

// consts

    const page = "<!doctype html><html><body><main><h1 id=\"title\">Acme</h1></main></body></html>";
    const pageUrl = "https://www.linkedin.com/company/acme/";
    const banned = {
        "linkedinCode": "acme",
        "names": [ "Acme" ],
        "indicators": [ "BANNED" ],
        "comment": ""
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

            callback(0);
            return 0;

        };

        return dom;

    }

    function _registry (company) {

        return { [REGISTRY_STORAGE_KEY]: { [company.linkedinCode]: company } };

    }

    async function _closeModal () {

        if (!isAddCompanyModalOpen()) {
            return;
        }

        showAddCompanyModal({
            "linkedinCode": "acme",
            "name": "Acme",
            "onSaved": () => {}
        });
        document.querySelector(".li-tracker-modal-btn--secondary").click();

    }

    async function _until (predicate) {

        const start = Date.now();

        while (!predicate()) {

            if (1000 < Date.now() - start) {
                throw new Error("timed out");
            }

            await new Promise((resolve) => {

                setTimeout(resolve, 20);

            });

        }

    }

// init

if ("undefined" === typeof chrome) {

    const { installChromeMock } = await import("./chrome-mock.js");
    installChromeMock();

}

const probe = await chrome.runtime.sendMessage({ "type": "GET_REGISTRY" });
if ("undefined" === typeof probe) {

    await import("../lib/src/background/service-worker.ts");

}

const { isAddCompanyModalOpen, showAddCompanyModal } = await import("../lib/src/content/shared/modal.ts");

// tests

describe("company page", () => {

    it("highlights a known company, keeps one add button, and repaints", async () => {

        await _closeModal();
        const dom = _install(page, pageUrl);

        try {

            await chrome.storage.local.set(_registry(banned));
            globalThis.MutationObserver = class {

                observe () {}

                disconnect () {}

                takeRecords () {

                    return [];

                }

            };
            await import("../lib/src/content/linkedin-company.ts");

            const title = document.getElementById("title");
            await _until(() => {

                return title.classList.contains("li-tracker--highlighted");

            });
            equal(title.classList.contains("li-tracker--highlighted"), true);
            equal(title.classList.contains("li-tracker--colored"), true);
            equal(title.style.getPropertyValue("--li-tracker-color"), "#dc2626");
            equal(title.querySelector("[data-li-tracker-icon]").textContent, "❌");
            equal(title.querySelector(".li-tracker-add-btn"), null);

            await chrome.storage.local.set(_registry(plain));
            equal(title.classList.contains("li-tracker--highlighted"), false);
            equal(document.querySelectorAll(".li-tracker-add-btn").length, 1);

            document.querySelector(".li-tracker-add-btn").click();
            equal(isAddCompanyModalOpen(), true);
            document.querySelector(".li-tracker-modal-form").requestSubmit();
            await _until(() => {

                return !isAddCompanyModalOpen();

            });

            await chrome.storage.local.set(_registry(plain));
            equal(document.querySelectorAll(".li-tracker-add-btn").length, 1);

            await chrome.storage.local.set(_registry(banned));
            equal(title.classList.contains("li-tracker--highlighted"), true);
            equal(document.querySelectorAll(".li-tracker-add-btn").length, 0);

            history.pushState({}, "", "/company/%20");
            await chrome.storage.local.set(_registry(plain));
            equal(document.querySelector(".li-tracker-add-btn"), null);

            history.pushState({}, "", "/company/acme/");
            title.textContent = "";
            await chrome.storage.local.set(_registry(plain));
            equal(document.querySelector(".li-tracker-add-btn"), null);

        }
        finally {

            dom.window.close();

        }

    });

});
