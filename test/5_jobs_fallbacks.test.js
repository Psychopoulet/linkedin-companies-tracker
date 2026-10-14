// deps

    // natives
    import { equal } from "node:assert/strict";

    // locals
    import { installDomMock } from "./dom-mock.js";

// consts

    const registry = {
        "acme": {
            "linkedinCode": "acme",
            "names": [ "Acme" ],
            "indicators": []
        }
    };
    const searchUrl = "https://www.linkedin.com/jobs/search-results/";
    const viewUrl = "https://www.linkedin.com/jobs/view/10";

// private

    // methods
    function _install (html, url = "https://www.linkedin.com/jobs/view/10") {

        return installDomMock(`<!doctype html><html><body>${html}</body></html>`, url);

    }

    function _card (html) {

        _install(`<div id="card">${html}</div>`);
        return document.getElementById("card");

    }

// init

const {
    findCompanyElementInCardByTextMatch,
    findCompanyInJobDetailPanel,
    findCompanyInJobsTrackerCard,
    findCompanyInSduiCard,
    findCompanyInSearchResultsDetail,
    findCompanyNameElement,
    findCompanyNameElementInListCard,
    findJobCards,
    findJobViewContainer,
    resolveCompanyFromContainer
} = await import("../lib/src/content/shared/job-dom-utils.ts");

// tests

describe("job page fallbacks", () => {

    it("ignores location lines and reads the company beside the title", () => {

        for (const text of [ "Remote", "(hybrid)", "Be an early applicant", "3 days ago", "Paris · Lyon" ]) {

            const card = _card(`
                <a class="job-card-list__title--link" href="/jobs/view/1">Engineer</a>
                <span>${text}</span>
            `);
            equal(findCompanyNameElementInListCard(card), null);

        }

        const linked = _card(`
            <a href="/company/x">Paris, France</a>
            <div>
                <a class="job-card-list__title--link" href="/jobs/view/1">Engineer</a>
                <span><a id="hit" href="/company/acme">Acme</a></span>
            </div>
        `);
        equal(findCompanyNameElementInListCard(linked).id, "hit");

        const plain = _card(`
            <a href="/company/x">Paris, France</a>
            <div>
                <a class="job-card-list__title--link" href="/jobs/view/1">Engineer</a>
                <span id="hit">Acme</span>
            </div>
        `);
        equal(findCompanyNameElementInListCard(plain).id, "hit");

        const heading = _card(`
            <a href="/company/x">Paris, France</a>
            <h3 class="base-search-card__title"><a href="/jobs/view/1">Engineer</a></h3>
            <h4 id="hit">Acme</h4>
        `);
        equal(findCompanyNameElementInListCard(heading).id, "hit");

    });

    it("reads the company from the line after the title", () => {

        const paragraph = _card(`
            <a href="/company/x">Paris, France</a>
            <div><a href="/jobs/view/1">Engineer</a></div>
            <p id="hit">Acme</p>
        `);
        equal(findCompanyNameElementInListCard(paragraph).id, "hit");

        const link = _card(`
            <a href="/company/x">Paris, France</a>
            <div><a href="/jobs/view/1">Engineer</a></div>
            <div><a id="hit" href="/company/acme">Acme</a><span>extra</span></div>
        `);
        equal(findCompanyNameElementInListCard(link).id, "hit");

        const single = _card(`
            <a href="/company/x">Paris, France</a>
            <div><a href="/jobs/view/1">Engineer</a></div>
            <div id="hit"><strong>Acme</strong></div>
        `);
        equal(findCompanyNameElementInListCard(single).id, "hit");

        const span = _card(`
            <a href="/company/x">Paris, France</a>
            <div><a href="/jobs/view/1">Engineer</a></div>
            <div><strong>${"Nope ".repeat(20)}</strong><em>Also</em></div>
            <span id="hit">Acme</span>
        `);
        equal(findCompanyNameElementInListCard(span).id, "hit");

        const stopped = _card(`
            <a id="loc" href="/company/x">Paris, France</a>
            <div><a href="/jobs/view/1">Engineer</a></div>
            <p>Remote</p>
        `);
        equal(findCompanyNameElementInListCard(stopped).id, "loc");

    });

    it("reads an SDUI name, a nested link, and a document name", () => {

        const several = _card(`
            <div><p id="name">Acme</p></div>
            <div><p>Paris, France</p></div>
            <div><p>Beta</p></div>
        `);
        several.setAttribute("componentkey", "job-card-component-ref-1");
        equal(findCompanyInSduiCard(several, registry).element.id, "name");

        const loose = _card(`<section><p id="name">Acme</p></section>`);
        loose.setAttribute("componentkey", "job-card-component-ref-2");
        equal(findCompanyInSduiCard(loose, registry).element.id, "name");

        const longName = "A".repeat(81);
        const rejected = _card(`<div><p>${longName}</p><p>consultant</p><p></p></div>`);
        rejected.setAttribute("componentkey", "job-card-component-ref-3");
        equal(findCompanyInSduiCard(rejected, registry), null);

        _install(`<h4 class="base-search-card__subtitle"><a id="hit" href="/in/someone">Acme</a></h4>`);
        equal(findCompanyNameElement(document.body).id, "hit");

        _install(`<div><h4><a id="hit" href="/in/someone">Acme</a></h4></div>`);
        equal(findCompanyNameElement(document.body).id, "hit");

        _install(`<h4 class="base-search-card__subtitle">Acme</h4>`);
        equal(resolveCompanyFromContainer(document, registry).linkedinCode, "acme");

        const bySdui = _card(`<div><p>Acme</p></div>`);
        bySdui.setAttribute("componentkey", "job-card-component-ref-4");
        equal(resolveCompanyFromContainer(bySdui, registry).linkedinCode, "acme");

        const byList = _card(`
            <a class="job-card-list__title--link" href="/jobs/view/1">Engineer</a>
            <span>Acme</span>
        `);
        equal(resolveCompanyFromContainer(byList, registry).linkedinCode, "acme");

    });

    it("finds search-results cards, the detail code, and a panel name", () => {

        _install(`
            <div class="jobs-search__job-details">
                <div componentkey="job-card-component-ref-1"></div>
            </div>
            <div id="panel" class="jobs-unified-top-card"></div>
            <div id="item" role="listitem"><a href="/jobs/view/3">Role</a></div>
            <div data-display-contents="true">
                <div id="wrapped" role="button" componentkey="job-card-component-ref-9"></div>
            </div>
            <span id="shared">
                <a href="/jobs/view/1">One</a>
                <a href="/jobs/view/2">Two</a>
            </span>
        `, searchUrl);

        const ids = findJobCards().map((card) => {

            return card.id;

        });
        equal(ids.includes("item"), true);
        equal(ids.includes("wrapped"), true);
        equal(ids.includes("shared"), true);
        equal(findJobViewContainer().id, "panel");

        _install(`<div>empty</div>`, searchUrl);
        equal(findJobCards().length, 0);
        equal(findJobViewContainer(), null);

        _install(`<a id="detail" href="/company/acme" aria-label="Entreprise"></a>`, searchUrl);
        equal(findCompanyInSearchResultsDetail(registry).company.linkedinCode, "acme");

        _install(`
            <a href="https://www.linkedin.com/company/acme/insights/">Acme</a>
            <a id="detail" href="/company/acme">Unknown Label</a>
        `, searchUrl);
        equal(findCompanyInSearchResultsDetail(registry).element.id, "detail");

        _install(`
            <div id="panel">
                <div componentkey="job-card-component-ref-1"><div><p>Beta</p></div></div>
                <div><p id="name">Acme</p></div>
            </div>
        `, viewUrl);
        equal(findCompanyInJobDetailPanel(document.getElementById("panel"), registry).element.id, "name");

        _install(`
            <div id="panel">
                <p>Software Engineer</p>
                <span id="name">Acme</span>
            </div>
        `, viewUrl);
        equal(findCompanyInJobDetailPanel(document.getElementById("panel"), registry).element.id, "name");

        _install(`
            <div id="panel">
                <h1>Software Engineer</h1>
                <p>Remote</p>
                <div id="name">Acme</div>
            </div>
        `, viewUrl);
        equal(findCompanyInJobDetailPanel(document.getElementById("panel"), registry).element.id, "name");

        _install(`
            <div id="card">
                <a class="job-card-list__title--link" href="/jobs/view/1">Engineer at Acme</a>
                <a href="/jobs/view/2">Also Acme</a>
            </div>
        `, viewUrl);
        equal(findCompanyElementInCardByTextMatch(document.getElementById("card"), registry), null);

        _install(`
            <div id="long"><p>${"A".repeat(81)} · Paris</p></div>
            <div id="meta"><p>consulté · Paris</p></div>
            <div id="dot"><p>· Paris</p></div>
        `, "https://www.linkedin.com/jobs-tracker");
        equal(findCompanyInJobsTrackerCard(document.getElementById("long"), registry), null);
        equal(findCompanyInJobsTrackerCard(document.getElementById("meta"), registry), null);
        equal(findCompanyInJobsTrackerCard(document.getElementById("dot"), registry), null);

    });

});
