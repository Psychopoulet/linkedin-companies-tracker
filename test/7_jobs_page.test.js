// deps

    // natives
    import { equal } from "node:assert/strict";

    // locals
    import { installDomMock } from "./dom-mock.js";
    import { REGISTRY_STORAGE_KEY } from "../lib/src/storage/constants.ts";

// consts

    const searchUrl = "https://www.linkedin.com/jobs/search-results/";
    const viewUrl = "https://www.linkedin.com/jobs/view/10";
    const trackerUrl = "https://www.linkedin.com/jobs-tracker";
    const searchPage = `<!doctype html><html><body>
        <div class="jobs-search__job-details"><a href="/jobs/view/9">Engineer</a></div>
        <div role="button" componentkey="job-card-component-ref-1"><div><p id="card-name">Acme</p></div></div>
        <a id="detail-name" href="/company/acme" aria-label="Entreprise, Acme.">Acme</a>
    </body></html>`;
    const panelPage = `<!doctype html><html><body>
        <div class="job-details-jobs-unified-top-card"><a id="panel-name" href="/company/acme">Acme</a></div>
    </body></html>`;
    const trackerPage = `<!doctype html><html><body>
        <a id="tracked" href="/jobs/view/3"><p>Acme · Paris</p></a>
        <a id="detail-name" href="/company/acme">Acme</a>
    </body></html>`;
    const banned = {
        "linkedinCode": "acme",
        "names": [ "Acme" ],
        "indicators": [ "BANNED" ],
        "comment": ""
    };

// private

    // attributes
    let _dom;

    // methods
    function _install (html, url) {

        _dom?.window.close();

        const dom = installDomMock(html, url);
        _dom = dom;
        globalThis.history = dom.window.history;
        globalThis.AbortController = dom.window.AbortController;
        globalThis.requestAnimationFrame = (callback) => {

            callback(0);
            return 0;

        };

        return dom;

    }

    function _registry (company) {

        return { [REGISTRY_STORAGE_KEY]: null === company ? {} : { [company.linkedinCode]: company } };

    }

    function _highlighted (id) {

        return document.getElementById(id).classList.contains("li-tracker--highlighted");

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

    function _silenceObserver () {

        globalThis.MutationObserver = class {

            observe () {}

            disconnect () {}

            takeRecords () {

                return [];

            }

        };

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

describe("jobs page", () => {

    it("highlights cards, the detail, and the panel, and skips a closed scan", async () => {

        if (isAddCompanyModalOpen()) {

            showAddCompanyModal({
                "linkedinCode": "acme",
                "name": "Acme",
                "onSaved": () => {}
            });
            document.querySelector(".li-tracker-modal-btn--secondary").click();

        }

        try {

            _install(searchPage, searchUrl);
            _silenceObserver();
            await chrome.storage.local.set(_registry(banned));
            await import("../lib/src/content/linkedin-jobs.ts");
            await _until(() => {

                return _highlighted("card-name") && _highlighted("detail-name");

            });

            _install(panelPage, viewUrl);
            await chrome.storage.local.set(_registry(banned));
            equal(_highlighted("panel-name"), true);

            _install(trackerPage, trackerUrl);
            await chrome.storage.local.set(_registry(banned));
            const wrap = document.querySelector("[data-li-tracker-company-wrap]");
            equal(wrap.textContent.endsWith("Acme"), true);
            equal(wrap.classList.contains("li-tracker--highlighted"), true);
            equal(_highlighted("detail-name"), false);

            _install(panelPage, viewUrl);
            await chrome.storage.local.set(_registry(null));
            equal(_highlighted("panel-name"), false);

            showAddCompanyModal({
                "linkedinCode": "acme",
                "name": "Acme",
                "onSaved": () => {}
            });
            await chrome.storage.local.set(_registry(banned));
            equal(isAddCompanyModalOpen(), true);
            equal(_highlighted("panel-name"), false);

            document.querySelector(".li-tracker-modal-btn--secondary").click();
            await chrome.storage.local.set(_registry(banned));
            equal(_highlighted("panel-name"), true);

        }
        finally {

            _dom?.window.close();

        }

    });

});
