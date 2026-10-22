// deps

    // natives
    import { deepEqual, equal } from "node:assert/strict";

    // locals
    import { installDomMock } from "./dom-mock.js";

// consts

    const registry = {
        "acme": {
            "linkedinCode": "acme",
            "names": [ "Acme" ],
            "indicators": []
        },
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
    findCompanyElementInCardByTextMatch,
    findCompanyInJobDetailPanel,
    findCompanyInJobsTrackerCard,
    findCompanyInSduiCard,
    findCompanyInSearchResultsDetail,
    findCompanyNameElement,
    findCompanyNameElementInListCard,
    findJobCards,
    findJobViewContainer,
    isJobsPage,
    isJobsSearchResultsPage,
    isJobsTrackerPage,
    resolveCompanyFromContainer,
    wrapCompanyNamePrefix
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

describe("company name element", () => {

    it("reads the company line and falls back to a heading", () => {

        _install(`<!doctype html><html><body>
            <div id="primary"><h4 class="base-search-card__subtitle"><a href="/company/acme">Acme</a></h4></div>
            <div id="fallback"><h4 id="heading">Beta</h4></div>
            <div id="empty"></div>
        </body></html>`);

        equal(findCompanyNameElement(document.getElementById("primary")).textContent, "Acme");
        equal(findCompanyNameElement(document.getElementById("fallback")).id, "heading");
        equal(findCompanyNameElement(document.getElementById("empty")), null);

    });

    it("keeps the company line and ignores the location", () => {

        _install(`<!doctype html><html><body>
            <div id="card">
                <a class="job-card-list__title--link" href="/jobs/view/1">Engineer</a>
                <div id="name" class="job-card-container__company-name">Acme</div>
                <div class="artdeco-entity-lockup__subtitle">Paris, France</div>
            </div>
        </body></html>`);

        equal(findCompanyNameElementInListCard(document.getElementById("card")).id, "name");

        _install(`<!doctype html><html><body>
            <div id="card">
                <a class="job-card-list__title--link" href="/jobs/view/1">Engineer</a>
                <span id="name">Acme</span>
                <span>2 days ago</span>
            </div>
        </body></html>`);

        equal(findCompanyNameElementInListCard(document.getElementById("card")).id, "name");

    });

});

describe("company resolved from a card", () => {

    it("uses the company code, then the link text", () => {

        _install(`<!doctype html><html><body>
            <div id="by-code"><a href="https://www.linkedin.com/company/acme/">Label</a></div>
            <div id="by-name"><a href="https://www.linkedin.com/company/unknown/">Société Générale</a></div>
            <div id="miss"><span>Other</span></div>
        </body></html>`);

        equal(resolveCompanyFromContainer(document.getElementById("by-code"), registry).linkedinCode, "acme");
        equal(resolveCompanyFromContainer(document.getElementById("by-name"), registry).linkedinCode, "societe-generale");
        equal(resolveCompanyFromContainer(document.getElementById("miss"), registry), undefined);

    });

    it("reads an SDUI card and ignores a location line", () => {

        _install(`<!doctype html><html><body>
            <div id="card" componentkey="job-card-component-ref-1">
                <div><p id="name">Acme</p></div>
                <div><p>Paris, France</p></div>
            </div>
        </body></html>`);

        const card = document.getElementById("card");
        equal(findCompanyNameElementInListCard(card).id, "name");
        equal(findCompanyInSduiCard(card, registry).element.id, "name");
        equal(findCompanyInSduiCard(card, registry).company.linkedinCode, "acme");

        _install(`<!doctype html><html><body>
            <div id="card" componentkey="job-card-component-ref-1"><div><p>Paris, France</p></div></div>
        </body></html>`);
        equal(findCompanyInSduiCard(document.getElementById("card"), registry), null);

        _install(`<!doctype html><html><body>
            <div id="card" componentkey="job-card-component-ref-9">
                <div>
                    <div><p>Tech Lead Front-end (H/F)</p></div>
                    <div><p id="name">Acme</p></div>
                    <p>Ville de Paris (Hybride)</p>
                </div>
            </div>
        </body></html>`);
        equal(findCompanyNameElementInListCard(document.getElementById("card")).id, "name");
        equal(findCompanyInSduiCard(document.getElementById("card"), registry).company.linkedinCode, "acme");

        _install(`<!doctype html><html><body>
            <div id="card" componentkey="job-card-component-ref-10">
                <div>
                    <div><p>Forward Deployed Engineer - Paris</p></div>
                    <div><p id="name">Acme</p></div>
                    <p>Paris</p>
                </div>
            </div>
        </body></html>`);
        equal(findCompanyNameElementInListCard(document.getElementById("card")).id, "name");
        equal(findCompanyInSduiCard(document.getElementById("card"), registry).element.id, "name");

        for (const location of [ "", "A".repeat(61), "Senior Engineer", "@@" ]) {

            _install(`<!doctype html><html><body>
                <div id="card" componentkey="job-card-component-ref-11">
                    <div><p id="name">Acme</p></div>
                    <p>${location}</p>
                </div>
            </body></html>`);
            equal(findCompanyInSduiCard(document.getElementById("card"), registry).element.id, "name");

        }

    });

    it("matches the company text and skips the job title", () => {

        _install(`<!doctype html><html><body>
            <div id="card">
                <a class="job-card-list__title--link" href="/jobs/view/1">Engineer at Acme</a>
                <span>Paris, France</span>
                <span id="name">Acme</span>
            </div>
        </body></html>`);

        const found = findCompanyElementInCardByTextMatch(document.getElementById("card"), registry);
        equal(found.element.id, "name");
        equal(found.company.linkedinCode, "acme");

        _install(`<!doctype html><html><body><div id="card"><span>Other</span></div></body></html>`);
        equal(findCompanyElementInCardByTextMatch(document.getElementById("card"), registry), null);

    });

});

describe("search detail and job panel", () => {

    it("reads the detail company and ignores a list card and a location", () => {

        _install(`<!doctype html><html><body>
            <div componentkey="job-card-component-ref-1">
                <a href="/company/acme" aria-label="Entreprise, Acme">Acme</a>
            </div>
            <a id="detail" href="/company/acme" aria-label="Entreprise, Acme.">Acme</a>
        </body></html>`, "https://www.linkedin.com/jobs/search-results/");

        equal(findCompanyInSearchResultsDetail(registry).element.id, "detail");

        _install(`<!doctype html><html><body>
            <a href="/company/place">Paris, France</a>
            <a id="detail" href="/company/acme">Acme</a>
            <a href="/jobs/view/9">Software Engineer</a>
        </body></html>`, "https://www.linkedin.com/jobs/search-results/");

        equal(findCompanyInSearchResultsDetail(registry).element.id, "detail");

        _install(`<!doctype html><html><body>
            <a id="detail" href="/company/acme" aria-label="Entreprise, Unknown Corp"></a>
        </body></html>`, "https://www.linkedin.com/jobs/search-results/");

        equal(findCompanyInSearchResultsDetail(registry).element.id, "detail");
        equal(findCompanyInSearchResultsDetail(registry).company.linkedinCode, "acme");

    });

    it("reads the panel company from a link and from the subtitle", () => {

        _install(`<!doctype html><html><body>
            <div id="panel">
                <a href="/company/place">Remote</a>
                <a id="name" href="/company/acme">Acme</a>
            </div>
        </body></html>`, "https://www.linkedin.com/jobs/view/10");

        equal(findCompanyInJobDetailPanel(document.getElementById("panel"), registry).element.id, "name");

        _install(`<!doctype html><html><body>
            <div id="panel">
                <h4 id="name" class="base-search-card__subtitle">Acme</h4>
                <p>Paris, France</p>
            </div>
        </body></html>`, "https://www.linkedin.com/jobs/view/10");

        equal(findCompanyInJobDetailPanel(document.getElementById("panel"), registry).element.id, "name");

    });

});

describe("tracker card and name prefix", () => {

    it("reads the company before the location and misses the rest", () => {

        _install(`<!doctype html><html><body>
            <div id="known"><p id="line">❌ Société Générale · Paris</p></div>
            <div id="unknown"><p>Other · Lyon</p></div>
            <div id="plain"><p>Société Générale</p></div>
        </body></html>`, "https://www.linkedin.com/jobs-tracker");

        const found = findCompanyInJobsTrackerCard(document.getElementById("known"), registry);
        equal(found.element.id, "line");
        equal(found.company.linkedinCode, "societe-generale");
        equal(found.displayName, "Société Générale");
        equal(findCompanyInJobsTrackerCard(document.getElementById("unknown"), registry), null);
        equal(findCompanyInJobsTrackerCard(document.getElementById("plain"), registry), null);

    });

    it("wraps the company name and leaves the surrounding text", () => {

        _install();
        const line = document.createElement("p");
        line.textContent = "Role at Acme, Paris";
        document.body.append(line);

        const wrapped = wrapCompanyNamePrefix(line, "Acme");
        equal(wrapped.getAttribute("data-li-tracker-company-wrap"), "true");
        equal(wrapped.textContent, "Acme");
        equal(line.textContent, "Role at Acme, Paris");
        equal(wrapCompanyNamePrefix(line, "Acme"), wrapped);

        const exact = document.createElement("p");
        exact.textContent = "Acme";
        const exactWrap = wrapCompanyNamePrefix(exact, "Acme");
        equal(exactWrap.textContent, "Acme");
        equal(exact.childNodes.length, 1);

        const missing = document.createElement("p");
        missing.textContent = "Other";
        equal(wrapCompanyNamePrefix(missing, "Acme"), missing);

    });

});
