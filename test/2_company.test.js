// deps

    // natives
    import { deepEqual, equal, throws } from "node:assert/strict";

    // locals
    import {
        companyLinkedinUrl,
        isValidCompany,
        normalizeCompany,
        normalizeCompanyStatus,
        normalizeLinkedinCode
    } from "../lib/src/types/company.ts";
    import { getIndicatorsColor, stripLeadingIndicatorIcon } from "../lib/src/types/indicator.ts";
    import { parseCompaniesJson, serializeCompanies } from "../lib/src/storage/import-export.ts";
    import { extractLinkedinCodeFromPathname } from "../lib/src/content/shared/linkedin-url.ts";

// tests

describe("company", () => {

    it("normalizes a LinkedIn code", () => {

        equal(normalizeLinkedinCode("  CapGemini/ "), "capgemini");

    });

    it("builds the company URL from the normalized code", () => {

        equal(
            companyLinkedinUrl("Cap Gemini"),
            "https://www.linkedin.com/company/cap%20gemini/"
        );

    });

    it("maps a legacy status", () => {

        equal(normalizeCompanyStatus("désiré"), "WANTED");
        equal(normalizeCompanyStatus("esn"), "IT_SERVICES_COMPANY");
        equal(normalizeCompanyStatus("unknown"), null);

    });

    it("normalizes indicators and the comment", () => {

        deepEqual(normalizeCompany({
            "linkedinCode": " Acme/ ",
            "name": " Acme ",
            "indicators": [ "WANTED", "WANTED", "esn" ],
            "reason": "  note  "
        }), {
            "linkedinCode": "acme",
            "name": "Acme",
            "indicators": [ "WANTED", "IT_SERVICES_COMPANY" ],
            "comment": "note"
        });

    });

    it("rejects a company without a name", () => {

        equal(isValidCompany({
            "linkedinCode": "acme",
            "name": " ",
            "indicators": []
        }), false);

    });

});

describe("indicators", () => {

    it("returns the color of the highest criticity", () => {

        equal(getIndicatorsColor([ "BANNED" ]), "#dc2626");
        equal(getIndicatorsColor([]), undefined);

    });

    it("strips a leading indicator icon", () => {

        equal(stripLeadingIndicatorIcon("✅ Acme"), "Acme");
        equal(stripLeadingIndicatorIcon("Acme"), "Acme");

    });

});

describe("import and export", () => {

    it("reads a company from an export file", () => {

        const companies = parseCompaniesJson(JSON.stringify({
            "version": 2,
            "companies": [
                {
                    "linkedinCode": "Acme/",
                    "name": "Acme",
                    "indicators": [ "WANTED" ]
                }
            ]
        }));

        deepEqual(companies, [
            {
                "linkedinCode": "acme",
                "name": "Acme",
                "indicators": [ "WANTED" ]
            }
        ]);

    });

    it("rejects invalid JSON", () => {

        throws(() => {

            parseCompaniesJson("{");

        }, { "message": "Invalid JSON file." });

    });

    it("serializes a registry with version 2", () => {

        const payload = JSON.parse(serializeCompanies({
            "acme": {
                "linkedinCode": "acme",
                "name": "Acme",
                "indicators": [ "WANTED" ]
            }
        }));

        equal(payload.version, 2);
        equal(payload.companies[0].linkedinCode, "acme");

    });

});

describe("linkedin url", () => {

    it("reads the company code from a pathname", () => {

        equal(extractLinkedinCodeFromPathname("/company/CapGemini/about"), "capgemini");
        equal(extractLinkedinCodeFromPathname("/jobs/view/1"), null);

    });

});
