// deps

    // natives
    import { deepEqual, equal } from "node:assert/strict";

    // locals
    import { installDomMock } from "./dom-mock.js";

// consts

    const registry = {
        "societe-generale": {
            "linkedinCode": "societe-generale",
            "names": [ "Société Générale" ],
            "indicators": []
        }
    };

// private

    // methods
    function _install (html = "<!doctype html><html><body></body></html>", url = "https://www.linkedin.com/") {

        return installDomMock(html, url);

    }

    function _cardIds () {

        return findJobCards().map((card) => {

            return card.id;

        });

    }

// init

_install();

const {
    findCompanyByName,
    findJobCards,
    findJobViewContainer,
    isJobsPage,
    isJobsSearchResultsPage,
    isJobsTrackerPage
} = await import("../lib/src/content/shared/job-dom-utils.ts");

// tests

describe("job page detectors", () => {

    it("recognizes search, view, tracker, and other pages", () => {

        _install("<!doctype html><html><body></body></html>", "https://www.linkedin.com/jobs/search");
        equal(isJobsPage(), true);
        equal(isJobsSearchResultsPage(), false);
        equal(isJobsTrackerPage(), false);

        _install("<!doctype html><html><body></body></html>", "https://www.linkedin.com/jobs/search-results/");
        equal(isJobsSearchResultsPage(), true);
        equal(isJobsPage(), true);

        _install("<!doctype html><html><body></body></html>", "https://www.linkedin.com/JOBS/VIEW/1");
        equal(isJobsPage(), true);
        equal(isJobsSearchResultsPage(), false);
        equal(isJobsTrackerPage(), false);

        _install("<!doctype html><html><body></body></html>", "https://www.linkedin.com/jobs-tracker/applied");
        equal(isJobsTrackerPage(), true);
        equal(isJobsPage(), true);

        _install("<!doctype html><html><body></body></html>", "https://www.linkedin.com/feed/");
        equal(isJobsPage(), false);
        equal(isJobsSearchResultsPage(), false);
        equal(isJobsTrackerPage(), false);

    });

});

describe("find company by name", () => {

    it("matches a stored name without accents and misses the rest", () => {

        equal(findCompanyByName(registry, "societe generale")?.linkedinCode, "societe-generale");
        equal(findCompanyByName(registry, "❌ Société Générale")?.linkedinCode, "societe-generale");
        equal(findCompanyByName(registry, "Other"), undefined);
        equal(findCompanyByName(registry, "   "), undefined);

    });

});

describe("job cards", () => {

    it("finds a primary card and a fallback card", () => {

        _install(`<!doctype html><html><body>
            <li id="primary" class="jobs-search-results__list-item">
                <a class="job-card-list__title--link" href="/jobs/view/1">Engineer</a>
            </li>
            <div id="fallback" class="base-card">
                <a href="/jobs/view/2">Designer</a>
            </div>
        </body></html>`, "https://www.linkedin.com/jobs/view/10");

        deepEqual(_cardIds(), [ "primary", "fallback" ]);
        deepEqual(findJobCards(document.getElementById("fallback")).map((card) => {

            return card.id;

        }), [ "fallback" ]);

    });

    it("finds list cards on a search-results page and skips the detail panel", () => {

        _install(`<!doctype html><html><body>
            <div id="detail" class="jobs-search__job-details">
                <a href="/jobs/view/9">Engineer</a>
            </div>
            <div id="primary" role="button" componentkey="job-card-component-ref-1">
                <p>Acme</p>
            </div>
            <li id="fallback" class="scaffold-layout__list-item">
                <a href="/jobs/view/2">Analyst</a>
            </li>
        </body></html>`, "https://www.linkedin.com/jobs/search-results/");

        deepEqual(_cardIds(), [ "primary", "fallback" ]);
        equal(findJobCards().some((card) => {

            return card.contains(document.querySelector("#detail a"));

        }), false);

    });

    it("finds a tracker card that has a company line", () => {

        _install(`<!doctype html><html><body>
            <a id="tracked" href="/jobs/view/3"><p>Société Générale · Paris</p></a>
            <a id="plain" href="/jobs/view/4">Role only</a>
        </body></html>`, "https://www.linkedin.com/jobs-tracker");

        deepEqual(_cardIds(), [ "tracked" ]);

    });

});

describe("job view container", () => {

    it("finds the top card and falls back to main", () => {

        _install(`<!doctype html><html><body>
            <div id="view" class="job-details-jobs-unified-top-card">
                <a href="/company/acme">Acme</a>
            </div>
        </body></html>`, "https://www.linkedin.com/jobs/view/10");
        equal(findJobViewContainer().id, "view");

        _install(`<!doctype html><html><body>
            <main id="view"><a href="/company/acme">Acme</a></main>
        </body></html>`, "https://www.linkedin.com/jobs/view/10");
        equal(findJobViewContainer().id, "view");

        _install("<!doctype html><html><body><div>empty</div></body></html>", "https://www.linkedin.com/jobs/view/10");
        equal(findJobViewContainer(), null);

    });

    it("finds the search-results panel and walks up when it is missing", () => {

        _install(`<!doctype html><html><body>
            <div id="view" class="jobs-search__job-details--container"></div>
        </body></html>`, "https://www.linkedin.com/jobs/search-results/");
        equal(findJobViewContainer().id, "view");

        _install(`<!doctype html><html><body>
            <div id="view">
                <a href="/jobs/view/9">Software Engineer</a>
                <a href="/company/acme">Acme</a>
            </div>
        </body></html>`, "https://www.linkedin.com/jobs/search-results/");
        equal(findJobViewContainer().id, "view");

    });

});
