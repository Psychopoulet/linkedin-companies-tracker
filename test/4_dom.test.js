// deps

    // natives
    import { deepEqual, equal } from "node:assert/strict";

    // locals
    import { installDomMock } from "./dom-mock.js";

// private

    // methods
    function _install (html, url) {

        const dom = installDomMock(html, url);
        globalThis.history = dom.window.history;

        return dom;

    }

    function _wait (delayMs) {

        return new Promise((resolve) => {

            setTimeout(resolve, delayMs);

        });

    }

// init

_install();

const { collectShadowRoots, queryAllDeep, queryDeep } = await import("../lib/src/content/shared/dom-query.ts");
const {
    findCompanyTitleElement,
    getCompanyNameFromElement,
    getLinkedinCodeFromUrl,
    isCompanyPage
} = await import("../lib/src/content/shared/dom-utils.ts");
const { initPageScanner } = await import("../lib/src/content/shared/page-scanner.ts");

// tests

describe("dom query", () => {

    it("finds elements in the light DOM and in one shadow root", () => {

        _install(`<!doctype html><html><body>
            <p class="hit">light</p>
            <div id="host"></div>
        </body></html>`);

        const host = document.getElementById("host");
        const shadow = host.attachShadow({ "mode": "open" });
        shadow.innerHTML = "<span class=\"hit\">shadow</span>";

        const found = queryAllDeep(document, ".hit");

        equal(found.length, 2);
        equal(found[0].textContent, "light");
        equal(found[1].textContent, "shadow");
        equal(queryDeep(document, ".hit"), found[0]);
        equal(queryDeep(document, ".missing"), null);
        deepEqual(collectShadowRoots(document), [ shadow ]);
        deepEqual(queryAllDeep({}, ".hit"), []);
        deepEqual(collectShadowRoots({}), []);

    });

});

describe("dom utils", () => {

    it("reads the company code from the page URL", () => {

        _install("<!doctype html><html><body></body></html>", "https://www.linkedin.com/company/CapGemini/about");

        equal(getLinkedinCodeFromUrl(), "capgemini");
        equal(getLinkedinCodeFromUrl("https://www.linkedin.com/company/Acme/"), "acme");
        equal(getLinkedinCodeFromUrl("https://www.linkedin.com/jobs/view/1"), null);
        equal(getLinkedinCodeFromUrl("http://["), null);
        equal(isCompanyPage(), true);

        _install("<!doctype html><html><body></body></html>", "https://www.linkedin.com/jobs/view/1");
        equal(isCompanyPage(), false);

    });

    it("finds the first company title that has text", () => {

        _install(`<!doctype html><html><body>
            <div id="pages.topCard"><h2>   </h2></div>
            <main><h1>Acme</h1></main>
        </body></html>`);

        equal(findCompanyTitleElement().textContent, "Acme");

        _install("<!doctype html><html><body><main><h1>   </h1></main></body></html>");
        equal(findCompanyTitleElement(), null);

    });

    it("reads the company name without the add button", () => {

        _install("<!doctype html><html><body></body></html>");

        const title = document.createElement("h1");
        title.innerHTML = "Acme <button class=\"li-tracker-add-btn\">+</button>";

        equal(getCompanyNameFromElement(title), "Acme");

    });

});

describe("page scanner", () => {

    it("runs the debounced callback after a mutation", async () => {

        _install("<!doctype html><html><body></body></html>");

        let calls = 0;
        initPageScanner(() => {

            calls += 1;

        }, 15);

        document.body.append(document.createElement("div"));
        document.body.append(document.createElement("span"));
        equal(calls, 0);

        await _wait(40);
        equal(calls, 1);

    });

    it("runs the debounced callback after navigation", async () => {

        _install("<!doctype html><html><body></body></html>");

        let calls = 0;
        initPageScanner(() => {

            calls += 1;

        }, 15);

        history.pushState({}, "", "/company/acme/");
        history.replaceState({}, "", "/company/beta/");
        window.dispatchEvent(new window.Event("popstate"));
        equal(calls, 0);

        await _wait(40);
        equal(calls, 1);

    });

    it("starts the observer once the document has a body", async () => {

        _install("<!doctype html><html><body></body></html>");
        document.body.remove();

        let calls = 0;
        initPageScanner(() => {

            calls += 1;

        }, 15);

        const body = document.createElement("body");
        document.documentElement.append(body);
        window.dispatchEvent(new window.Event("DOMContentLoaded"));
        body.append(document.createElement("div"));

        await _wait(40);
        equal(calls, 1);

    });

});
