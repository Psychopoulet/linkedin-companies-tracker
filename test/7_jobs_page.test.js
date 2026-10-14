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

            _install(`<!doctype html><html><body>
                <li class="jobs-search-results__list-item">
                    <h4 id="known" class="base-search-card__subtitle">Acme</h4>
                </li>
                <li class="jobs-search-results__list-item">
                    <h4 id="unknown" class="base-search-card__subtitle">Other</h4>
                </li>
                <li id="empty" class="jobs-search-results__list-item">
                    <a href="/jobs/view/1">Engineer</a>
                </li>
            </body></html>`, viewUrl);
            await chrome.storage.local.set(_registry(banned));
            equal(_highlighted("known"), true);
            equal(_highlighted("unknown"), false);

            _install(`<!doctype html><html><body>
                <a href="/jobs/view/4"><p>Other · Lyon</p></a>
            </body></html>`, trackerUrl);
            await chrome.storage.local.set(_registry(banned));
            equal(document.querySelector(".li-tracker--highlighted"), null);

            _install(`<!doctype html><html><body>
                <div id="text-card" class="base-card">
                    <a href="/jobs/view/1">Engineer</a>
                    <span id="text-name">Acme</span>
                </div>
                <li id="list-card" class="scaffold-layout__list-item">
                    <a href="/jobs/view/2">Engineer</a>
                    <span id="list-name">Unknown Co</span>
                </li>
            </body></html>`, searchUrl);
            await chrome.storage.local.set(_registry(banned));
            equal(_highlighted("text-name"), true);
            equal(_highlighted("list-name"), false);

            _install("<!doctype html><html><body></body></html>", searchUrl);
            await chrome.storage.local.set(_registry(banned));
            equal(document.querySelector(".li-tracker--highlighted"), null);

            _install(`<!doctype html><html><body>
                <div class="job-details-jobs-unified-top-card">
                    <h4 id="subtitle" class="base-search-card__subtitle">Unknown Co</h4>
                </div>
            </body></html>`, viewUrl);
            await chrome.storage.local.set(_registry(banned));
            equal(_highlighted("subtitle"), false);

            _install(`<!doctype html><html><body>
                <div class="base-card"><a href="/jobs/view/8">Engineer</a></div>
            </body></html>`, searchUrl);
            await chrome.storage.local.set(_registry(banned));
            equal(document.querySelector(".li-tracker--highlighted"), null);

            _install(`<!doctype html><html><body>
                <div class="jobs-details__main-content"><div><p>Other</p></div></div>
            </body></html>`, viewUrl);
            await chrome.storage.local.set(_registry(banned));
            equal(document.querySelector(".li-tracker--highlighted"), null);

        }
        finally {

            _dom?.window.close();

        }

    });

});
