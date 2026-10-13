// deps

    // natives
    import { deepEqual, equal, throws } from "node:assert/strict";

    // locals
    import {
        companyLinkedinUrl,
        companySortRank,
        normalizeCompanyName,
        formatCompanyPopupDetail,
        isValidCompany,
        normalizeCompany,
        normalizeCompanyIndicators,
        normalizeCompanyStatus,
        normalizeLinkedinCode,
        normalizeRegistry,
        readCompanyIndicators,
        STATUS_SORT_ORDER
    } from "../lib/src/types/company.ts";
    import { formatIndicatorLabel, getIndicatorByCode, getIndicatorColor, getIndicators, getIndicatorsColor, sortIndicatorsByCriticityDesc, stripLeadingIndicatorIcon } from "../lib/src/types/indicator.ts";
    import { parseCompaniesJson, serializeCompanies } from "../lib/src/storage/import-export.ts";
    import { debounce } from "../lib/src/content/shared/debounce.ts";
    import { extractLinkedinCodeFromHref, extractLinkedinCodeFromPathname } from "../lib/src/content/shared/linkedin-url.ts";

// tests

describe("company", () => {

    it("normalizes a LinkedIn code", () => {

        equal(normalizeLinkedinCode("  CapGemini/ "), "capgemini");

    });

    it("normalizes a company name for comparison", () => {

        equal(normalizeCompanyName("  Décathlon   Digital "), "decathlon digital");

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
        equal(normalizeCompanyStatus("ESN"), "IT_SERVICES_COMPANY");
        equal(normalizeCompanyStatus("wanted"), "WANTED");
        equal(normalizeCompanyStatus("unknown"), null);
        equal(normalizeCompanyStatus("  "), null);
        equal(normalizeCompanyStatus(1), null);

    });

    it("drops indicators that are not a list of known codes", () => {

        deepEqual(normalizeCompanyIndicators("WANTED"), []);
        deepEqual(normalizeCompanyIndicators([ "WANTED", "WANTED", "nope", null ]), [ "WANTED" ]);

    });

    it("reads a legacy status when indicators are absent", () => {

        deepEqual(readCompanyIndicators({ "status": "désiré" }), [ "WANTED" ]);
        deepEqual(readCompanyIndicators({ "status": "nope" }), []);
        deepEqual(readCompanyIndicators({
            "indicators": [ "BANNED" ],
            "status": "désiré"
        }), [ "BANNED" ]);

    });

    it("ranks an empty indicator list last and an unknown code first", () => {

        equal(companySortRank({ "indicators": [] }), 99);
        equal(companySortRank({ "indicators": [ "WANTED" ] }), STATUS_SORT_ORDER.WANTED);
        equal(
            companySortRank({ "indicators": [ "BANNED", "WANTED" ] }),
            STATUS_SORT_ORDER.WANTED
        );
        equal(companySortRank({ "indicators": [ "NOPE" ] }), 0);

    });

    it("normalizes indicators and the comment", () => {

        deepEqual(normalizeCompany({
            "linkedinCode": " Acme/ ",
            "name": " Acme ",
            "indicators": [ "WANTED", "WANTED", "esn" ],
            "reason": "  note  "
        }), {
            "linkedinCode": "acme",
            "names": [ "Acme" ],
            "indicators": [ "WANTED", "IT_SERVICES_COMPANY" ],
            "comment": "note"
        });

    });

    it("keeps several names and drops blanks and duplicates", () => {

        deepEqual(normalizeCompany({
            "linkedinCode": "decathlondigital",
            "names": [
                " Decathlon Digital ",
                "Decathlon Technology",
                "decathlon digital",
                " ",
                "Décathlon Digital"
            ],
            "indicators": []
        }).names, [ "Decathlon Digital", "Decathlon Technology" ]);

    });

    it("prefers a non-empty names array over the legacy name", () => {

        deepEqual(normalizeCompany({
            "linkedinCode": "decathlondigital",
            "name": "Ignored",
            "names": [ "Decathlon Digital" ],
            "indicators": []
        }).names, [ "Decathlon Digital" ]);

    });

    it("reads the legacy name when names is empty", () => {

        deepEqual(normalizeCompany({
            "linkedinCode": "acme",
            "name": " Acme ",
            "names": [ " ", "" ],
            "indicators": []
        }).names, [ "Acme" ]);

    });

    it("does not invent a name", () => {

        deepEqual(normalizeCompany({
            "linkedinCode": "acme",
            "names": [ " " ],
            "indicators": []
        }).names, []);

    });

    it("rejects a company without a name", () => {

        equal(isValidCompany({
            "linkedinCode": "acme",
            "names": [ " " ],
            "indicators": []
        }), false);
        equal(isValidCompany({
            "linkedinCode": "acme",
            "names": [],
            "indicators": []
        }), false);
        equal(isValidCompany({
            "linkedinCode": "acme",
            "indicators": []
        }), false);

    });

    it("rejects a company with a bad code, name, indicator, or comment", () => {

        equal(isValidCompany({
            "linkedinCode": "  ",
            "names": [ "Acme" ],
            "indicators": []
        }), false);
        equal(isValidCompany({
            "names": [ "Acme" ],
            "indicators": []
        }), false);
        equal(isValidCompany({
            "linkedinCode": "acme",
            "names": [ "Acme", 2 ],
            "indicators": []
        }), false);
        equal(isValidCompany({
            "linkedinCode": "acme",
            "names": [ "Acme" ],
            "indicators": [ "WANTED", "NOPE" ]
        }), false);
        equal(isValidCompany({
            "linkedinCode": "acme",
            "names": [ "Acme" ],
            "indicators": "WANTED"
        }), false);
        equal(isValidCompany({
            "linkedinCode": "acme",
            "names": [ "Acme" ],
            "indicators": [],
            "comment": 1
        }), false);
        equal(isValidCompany({
            "linkedinCode": "acme",
            "names": [ "Acme" ],
            "indicators": [ "WANTED" ],
            "comment": "note"
        }), true);

    });

    it("formats the popup detail from descriptions and the comment", () => {

        equal(formatCompanyPopupDetail({
            "linkedinCode": "acme",
            "names": [ "Acme" ],
            "indicators": [ "WANTED", "NOPE" ],
            "comment": "  note  "
        }), "Desired company\nNOPE\nnote: note");
        equal(formatCompanyPopupDetail({
            "linkedinCode": "acme",
            "names": [ "Acme" ],
            "indicators": [ "BANNED" ],
            "comment": "   "
        }), "Company to avoid");

    });

    it("rewrites a legacy name and drops a company with none", () => {

        const { registry, changed } = normalizeRegistry({
            "acme": {
                "linkedinCode": "acme",
                "name": " Acme ",
                "indicators": []
            },
            "blank": {
                "linkedinCode": "blank",
                "name": " ",
                "indicators": []
            }
        });

        equal(changed, true);
        deepEqual(registry, {
            "acme": {
                "linkedinCode": "acme",
                "names": [ "Acme" ],
                "indicators": []
            }
        });

    });

    it("leaves a normalized registry unchanged", () => {

        const stored = {
            "acme": {
                "linkedinCode": "acme",
                "names": [ "Acme" ],
                "indicators": [ "WANTED" ]
            }
        };
        const { registry, changed } = normalizeRegistry(stored);

        equal(changed, false);
        deepEqual(registry, stored);

    });

});

describe("indicators", () => {

    it("returns the criticity color of one indicator", () => {

        const banned = getIndicatorByCode("BANNED");
        const salary = getIndicatorByCode("SALARY_AND_ADVANTAGES");

        equal(banned === undefined ? undefined : getIndicatorColor(banned), "#dc2626");
        equal(salary === undefined ? undefined : getIndicatorColor(salary), undefined);

    });

    it("returns the color of the highest criticity", () => {

        equal(getIndicatorsColor([ "BANNED" ]), "#dc2626");
        equal(getIndicatorsColor([]), undefined);

    });

    it("keeps the last color when a criticity is same", () => {

        equal(getIndicatorsColor([ "BANNED", "SALARY_AND_ADVANTAGES" ]), "#dc2626");
        equal(getIndicatorsColor([ "SALARY_AND_ADVANTAGES", "IT_SERVICES_COMPANY" ]), "#009dcf");
        equal(getIndicatorsColor([ "WANTED", "WITHOUT_SALARY_NOR_ADVANTAGES" ]), "#16a34a");

    });

    it("applies no color when every criticity is same", () => {

        equal(getIndicatorsColor([ "SALARY_AND_ADVANTAGES" ]), undefined);
        equal(
            getIndicatorsColor([ "SALARY_AND_ADVANTAGES", "WITHOUT_SALARY_NOR_ADVANTAGES" ]),
            undefined
        );

    });

    it("strips a leading indicator icon", () => {

        equal(stripLeadingIndicatorIcon("✅ Acme"), "Acme");
        equal(stripLeadingIndicatorIcon("Acme"), "Acme");

    });

    it("lists indicators from the lowest criticity to the highest", () => {

        const indicators = getIndicators();

        equal(indicators[0].code, "SALARY_AND_ADVANTAGES");
        equal(indicators.at(-1).code, "WANTED");
        equal(indicators.length, 9);

    });

    it("sorts codes by descending criticity and drops unknown codes", () => {

        deepEqual(sortIndicatorsByCriticityDesc([
            "SALARY_AND_ADVANTAGES",
            "NOPE",
            "WANTED"
        ]).map((indicator) => {
            return indicator.code;
        }), [ "WANTED", "SALARY_AND_ADVANTAGES" ]);

    });

    it("formats a label with the description", () => {

        const banned = getIndicatorByCode("BANNED");

        equal(formatIndicatorLabel(banned), "BANNED — Company to avoid");
        equal(formatIndicatorLabel({
            "icon": "",
            "criticity": "INFO",
            "code": "PLAIN",
            "description": ""
        }), "PLAIN");

    });

    it("rejects an unknown criticity", () => {

        throws(() => {

            getIndicatorColor({
                "icon": "",
                "criticity": "NOPE",
                "code": "X"
            });

        }, { "message": "Unknown criticity: NOPE" });

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
                "names": [ "Acme" ],
                "indicators": [ "WANTED" ]
            }
        ]);

    });

    it("reads several names from an export file", () => {

        const companies = parseCompaniesJson(JSON.stringify({
            "version": 2,
            "companies": [
                {
                    "linkedinCode": "decathlondigital",
                    "name": "Ignored",
                    "names": [ " Decathlon Digital ", "Decathlon Technology", "decathlon digital" ],
                    "indicators": []
                }
            ]
        }));

        deepEqual(companies, [
            {
                "linkedinCode": "decathlondigital",
                "names": [ "Decathlon Digital", "Decathlon Technology" ],
                "indicators": []
            }
        ]);

    });

    it("rejects a company with no usable name", () => {

        const message = "Invalid JSON file: one or more companies are incorrect.";

        throws(() => {

            parseCompaniesJson(JSON.stringify({
                "companies": [
                    {
                        "linkedinCode": "acme",
                        "name": " ",
                        "indicators": []
                    }
                ]
            }));

        }, { message });

        throws(() => {

            parseCompaniesJson(JSON.stringify({
                "companies": [
                    {
                        "linkedinCode": "acme",
                        "names": [ " " ],
                        "indicators": []
                    }
                ]
            }));

        }, { message });

    });

    it("rejects invalid JSON", () => {

        throws(() => {

            parseCompaniesJson("{");

        }, { "message": "Invalid JSON file." });

    });

    it("reads a bare company array", () => {

        deepEqual(parseCompaniesJson(JSON.stringify([
            {
                "linkedinCode": "Acme/",
                "names": [ "Acme" ],
                "indicators": [ "WANTED" ],
                "comment": "  from comment  ",
                "reason": "from reason"
            }
        ])), [
            {
                "linkedinCode": "acme",
                "names": [ "Acme" ],
                "indicators": [ "WANTED" ],
                "comment": "from comment"
            }
        ]);

    });

    it("reads a registry-shaped object and a legacy status", () => {

        deepEqual(parseCompaniesJson(JSON.stringify({
            "acme": {
                "linkedinCode": "acme",
                "name": "Acme",
                "status": "désiré",
                "reason": "  from reason  "
            }
        })), [
            {
                "linkedinCode": "acme",
                "names": [ "Acme" ],
                "indicators": [ "WANTED" ],
                "comment": "from reason"
            }
        ]);

    });

    it("uses reason when comment is blank and ignores a non-string comment", () => {

        deepEqual(parseCompaniesJson(JSON.stringify([
            {
                "linkedinCode": "acme",
                "names": [ "Acme" ],
                "indicators": [],
                "comment": "   ",
                "reason": "from reason"
            }
        ])), [
            {
                "linkedinCode": "acme",
                "names": [ "Acme" ],
                "indicators": [],
                "comment": "from reason"
            }
        ]);

        deepEqual(parseCompaniesJson(JSON.stringify([
            {
                "linkedinCode": "acme",
                "names": [ 1 ],
                "name": "Legacy",
                "indicators": [],
                "comment": 1,
                "reason": 2
            }
        ])), [
            {
                "linkedinCode": "acme",
                "names": [ "Legacy" ],
                "indicators": []
            }
        ]);

    });

    it("rejects a company that is not an object or has no usable indicator", () => {

        const message = "Invalid JSON file: one or more companies are incorrect.";

        throws(() => {

            parseCompaniesJson(JSON.stringify([ null ]));

        }, { message });

        throws(() => {

            parseCompaniesJson(JSON.stringify([
                {
                    "linkedinCode": 1,
                    "names": [ "Acme" ],
                    "indicators": []
                }
            ]));

        }, { message });

        throws(() => {

            parseCompaniesJson(JSON.stringify([
                {
                    "linkedinCode": "acme",
                    "names": [ "Acme" ],
                    "indicators": [ "NOPE" ]
                }
            ]));

        }, { message });

        throws(() => {

            parseCompaniesJson(JSON.stringify([
                {
                    "linkedinCode": "acme",
                    "names": [ "Acme" ],
                    "status": "nope"
                }
            ]));

        }, { message });

        throws(() => {

            parseCompaniesJson(JSON.stringify([
                {
                    "linkedinCode": "acme",
                    "names": [ 1 ],
                    "indicators": []
                }
            ]));

        }, { message });

    });

    it("rejects a file that is not a company list", () => {

        const message = "Invalid JSON file: a company array was expected.";

        for (const text of [ "null", "1", "{}", JSON.stringify({ "version": 3 }) ]) {

            throws(() => {

                parseCompaniesJson(text);

            }, { message });

        }

        throws(() => {

            parseCompaniesJson(JSON.stringify({
                "acme": {
                    "linkedinCode": "acme",
                    "names": [ "Acme" ],
                    "indicators": []
                },
                "count": 2
            }));

        }, { message });

    });

    it("serializes a registry with version 3", () => {

        const payload = JSON.parse(serializeCompanies({
            "zeta": {
                "linkedinCode": "zeta",
                "names": [ "Zeta", "Zeta Alias" ],
                "indicators": [ "WANTED" ]
            },
            "acme": {
                "linkedinCode": "acme",
                "name": "Acme",
                "indicators": [ "WANTED" ]
            }
        }));

        equal(payload.version, 3);
        deepEqual(payload.companies.map((company) => {
            return company.linkedinCode;
        }), [ "acme", "zeta" ]);
        deepEqual(payload.companies[0].names, [ "Acme" ]);
        equal("name" in payload.companies[0], false);
        deepEqual(payload.companies[1].names, [ "Zeta", "Zeta Alias" ]);

    });

    it("sorts by status, then by French name", () => {

        const payload = JSON.parse(serializeCompanies({
            "zebra": {
                "linkedinCode": "zebra",
                "names": [ "Zèbre" ],
                "indicators": [ "WANTED" ]
            },
            "alpha": {
                "linkedinCode": "alpha",
                "names": [ "Alpha" ],
                "indicators": [ "WANTED" ]
            },
            "salary": {
                "linkedinCode": "salary",
                "names": [ "Salaire" ],
                "indicators": [ "SALARY_AND_ADVANTAGES" ]
            },
            "blank": {
                "linkedinCode": "blank",
                "names": [],
                "indicators": []
            },
            "alsoBlank": {
                "linkedinCode": "also-blank",
                "names": [],
                "indicators": []
            }
        }));
        const codes = payload.companies.map((company) => {
            return company.linkedinCode;
        });
        const wantedNames = payload.companies.filter((company) => {
            return company.indicators.includes("WANTED");
        }).map((company) => {
            return company.names[0];
        });

        equal(codes[0], "salary");
        deepEqual(codes.slice(-2), [ "blank", "also-blank" ]);
        deepEqual(wantedNames, [ ...wantedNames ].sort((left, right) => {
            return left.localeCompare(right, "fr");
        }));

    });

});

describe("linkedin url", () => {

    it("reads the company code from a pathname", () => {

        equal(extractLinkedinCodeFromPathname("/company/CapGemini/about"), "capgemini");
        equal(extractLinkedinCodeFromPathname("/company/%ZZ/about"), "%zz");
        equal(extractLinkedinCodeFromPathname("/jobs/view/1"), null);

    });

    it("reads the company code from an href", () => {

        const previousWindow = globalThis.window;
        globalThis.window = { "location": { "origin": "https://www.linkedin.com" } };

        try {

            equal(
                extractLinkedinCodeFromHref("https://www.linkedin.com/company/CapGemini/about"),
                "capgemini"
            );
            equal(extractLinkedinCodeFromHref("/jobs/view/1"), null);
            equal(extractLinkedinCodeFromHref("http://[/company/Acme"), "acme");

        }
        finally {

            if (undefined === previousWindow) {

                delete globalThis.window;

            }
            else {

                globalThis.window = previousWindow;

            }

        }

    });

});

describe("debounce", () => {

    it("runs only the last call after a short delay", async () => {

        const calls = [];
        const debounced = debounce((value) => {

            calls.push(value);

        }, 15);

        debounced("first");
        debounced("second");
        equal(calls.length, 0);

        await new Promise((resolve) => {

            setTimeout(resolve, 40);

        });

        deepEqual(calls, [ "second" ]);

    });

});
