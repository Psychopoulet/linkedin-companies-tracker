// deps

    // natives
    import { readFileSync } from "node:fs";
    import { deepEqual, equal } from "node:assert/strict";

    // locals
    import { installDomMock } from "./dom-mock.js";
    import { REGISTRY_STORAGE_KEY } from "../lib/src/storage/constants.ts";

// consts

    const popupHtml = readFileSync(new URL("../lib/src/popup/index.html", import.meta.url), "utf8");
    const acme = {
        "linkedinCode": "acme",
        "names": [ "Acme" ],
        "indicators": [ "BANNED" ],
        "comment": "note"
    };

// private

    // attributes
    let _dom;
    let _allowDelete = false;

    // methods
    function _install () {

        _dom?.window.close();
        _dom = installDomMock(popupHtml);
        globalThis.confirm = () => {

            return _allowDelete;

        };

        return _dom;

    }

    function _names () {

        return [ ...document.querySelectorAll(".company-name-link") ].map((link) => {

            return link.textContent;

        });

    }

    function _item (name) {

        return [ ...document.querySelectorAll(".company-item") ].find((item) => {

            return item.querySelector(".company-name-link").textContent === name;

        });

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

    async function _submit () {

        document.getElementById("company-form").requestSubmit();

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

// tests

function _file (name, type, text) {

        return new File([ text ], name, { type });

    }

    async function _chooseFile (file) {

        const input = document.getElementById("import-file");
        Object.defineProperty(input, "files", {
            "configurable": true,
            "get": () => {

                return [ file ];

            }
        });
        input.dispatchEvent(new window.Event("change"));

    }

describe("popup list", () => {

    before(async () => {

        _install();
        const anchorClick = _dom.window.HTMLAnchorElement.prototype.click;
        _dom.window.HTMLAnchorElement.prototype.click = function click () {

            if ("" !== this.download) {
                return;
            }

            return anchorClick.call(this);

        };
        URL.createObjectURL = () => {

            return "blob:companies";

        };
        URL.revokeObjectURL = () => {};
        await chrome.storage.local.set({ [REGISTRY_STORAGE_KEY]: { "acme": acme } });
        await import("../lib/src/popup/popup.ts");
        await _until(() => {

            return _names().includes("Acme");

        });

    });

    after(() => {

        _dom?.window.close();

    });

    it("loads the list and edits a company", async () => {

        equal(document.getElementById("count").textContent, "1");
            equal(document.getElementById("empty-state").hidden, true);

            document.getElementById("linkedin-code").value = "beta";
            document.querySelector(".name-input").value = "   ";
            await _submit();
            equal(document.getElementById("form-error").hidden, false);
            equal(document.getElementById("form-error").textContent, "Name is required.");
            deepEqual(_names(), [ "Acme" ]);

            document.querySelector(".name-input").value = "Beta";
            document.querySelector("input[value=\"WANTED\"]").checked = true;
            await _submit();
            await _until(() => {

                return _names().includes("Beta");

            });
            equal(document.getElementById("count").textContent, "2");

            const search = document.getElementById("search");
            search.value = "beta";
            search.dispatchEvent(new window.Event("input"));
            deepEqual(_names(), [ "Beta" ]);
            equal(document.getElementById("count").textContent, "2");

            search.value = "";
            search.dispatchEvent(new window.Event("input"));
            equal(_names().includes("Acme"), true);
            equal(_names().includes("Beta"), true);

            const statusFilter = document.getElementById("status-filter");
            statusFilter.value = "BANNED";
            statusFilter.dispatchEvent(new window.Event("change"));
            deepEqual(_names(), [ "Acme" ]);

            statusFilter.value = "";
            statusFilter.dispatchEvent(new window.Event("change"));

            _item("Acme").querySelector("button").click();
            equal(document.getElementById("form-title").textContent, "Edit company");
            equal(document.getElementById("linkedin-code").disabled, true);
            equal(document.querySelector(".name-input").value, "Acme");
            equal(document.getElementById("cancel-edit").hidden, false);

            document.getElementById("cancel-edit").click();
            equal(document.getElementById("form-title").textContent, "Add a company");
            equal(document.getElementById("cancel-edit").hidden, true);
            equal(_names().includes("Acme"), true);

            _item("Acme").querySelector("button").click();
            document.querySelector(".name-input").value = "Acme Corp";
            await _submit();
            await _until(() => {

                return _names().includes("Acme Corp");

            });

            _allowDelete = false;
            _item("Beta").querySelector(".danger").click();
            await new Promise((resolve) => {

                setTimeout(resolve, 30);

            });
            equal(_names().includes("Beta"), true);

            _allowDelete = true;
            _item("Beta").querySelector(".danger").click();
            await _until(() => {

                return !_names().includes("Beta");

            });

            _item("Acme Corp").querySelector(".danger").click();
            await _until(() => {

                return 0 === _names().length;

            });
            equal(document.getElementById("count").textContent, "0");
            equal(document.getElementById("empty-state").hidden, false);

    });

    it("exports, imports, and drops a company that disappeared while editing", async () => {

        const blobs = [];
        const anchorClick = _dom.window.HTMLAnchorElement.prototype.click;
        _dom.window.HTMLAnchorElement.prototype.click = function click () {

            if ("" !== this.download) {
                return;
            }

            return anchorClick.call(this);

        };
        URL.createObjectURL = (blob) => {

            blobs.push(blob);
            return "blob:companies";

        };

        document.getElementById("export-btn").click();
        equal(document.getElementById("io-message").hidden, false);
        equal(document.getElementById("io-message").textContent, "Empty list exported.");
        equal((await blobs[0].text()).includes("\"version\": 3"), true);

        await _chooseFile(_file("notes.txt", "text/plain", "hello"));
        equal(document.getElementById("io-message").textContent, "Choose a JSON file.");
        equal(document.getElementById("io-message").classList.contains("error"), true);

        _allowDelete = true;
        await _chooseFile(_file(
            "companies.json",
            "application/json",
            JSON.stringify([ {
                "linkedinCode": "gamma",
                "names": [ "Gamma" ],
                "indicators": [ "WANTED" ]
            } ])
        ));
        await _until(() => {

            return _names().includes("Gamma");

        });
        equal(document.getElementById("io-message").textContent, "1 company imported.");

        document.getElementById("export-btn").click();
        equal(document.getElementById("io-message").textContent, "1 company exported.");

        const section = document.getElementById("io-section");
        document.dispatchEvent(new window.Event("dragover", { "cancelable": true }));
        equal(section.classList.contains("is-dragover"), true);

        const leave = new window.Event("dragleave", { "cancelable": true });
        Object.defineProperty(leave, "relatedTarget", { "value": null });
        document.dispatchEvent(leave);
        equal(section.classList.contains("is-dragover"), false);

        const drop = new window.Event("drop", { "cancelable": true });
        Object.defineProperty(drop, "dataTransfer", {
            "value": {
                "files": [ _file(
                    "delta.json",
                    "application/json",
                    JSON.stringify([ {
                        "linkedinCode": "delta",
                        "names": [ "Delta" ],
                        "indicators": [ "BANNED" ]
                    } ])
                ) ]
            }
        });
        document.dispatchEvent(drop);
        await _until(() => {

            return _names().includes("Delta");

        });
        equal(_names().includes("Gamma"), false);

        _item("Delta").querySelector("button").click();
        equal(document.getElementById("form-title").textContent, "Edit company");

        await chrome.storage.local.set({ [REGISTRY_STORAGE_KEY]: { "acme": acme } });
        await _until(() => {

            return "Add a company" === document.getElementById("form-title").textContent;

        });
        deepEqual(_names(), [ "Acme" ]);
        equal(document.getElementById("cancel-edit").hidden, true);
        _dom.window.HTMLAnchorElement.prototype.click = anchorClick;

    });

    it("covers import failures, extra names, and a rejected save", async () => {

        const errors = [];
        const report = console.error;
        console.error = (error) => {

            errors.push(error);

        };
        chrome.tabs.create = () => {

            return Promise.reject(new Error("no tab"));

        };
        document.querySelector(".company-name-link").dispatchEvent(
            new window.MouseEvent("click", { "bubbles": true, "cancelable": true })
        );
        await _until(() => {

            return 0 < errors.length;

        });
        console.error = report;
        equal(errors.length, 1);

        document.getElementById("add-name").click();
        equal(document.querySelectorAll(".name-row").length, 2);
        document.querySelector(".name-remove").click();
        equal(document.querySelectorAll(".name-row").length, 1);

        const input = document.getElementById("import-file");
        let opened = false;
        input.click = () => {

            opened = true;

        };
        document.getElementById("import-btn").click();
        equal(opened, true);

        Object.defineProperty(input, "files", {
            "configurable": true,
            "get": () => {

                return [];

            }
        });
        input.dispatchEvent(new window.Event("change"));

        const bareDrop = new window.Event("drop", { "cancelable": true });
        document.dispatchEvent(bareDrop);

        document.dispatchEvent(new window.Event("dragover", { "cancelable": true }));
        const stay = new window.Event("dragleave", { "cancelable": true });
        Object.defineProperty(stay, "relatedTarget", { "value": document.body });
        document.dispatchEvent(stay);
        equal(document.getElementById("io-section").classList.contains("is-dragover"), true);

        await chrome.storage.local.set({ "other": 1 });
        await chrome.storage.local.set({
            [REGISTRY_STORAGE_KEY]: {
                "aaa": {
                    "linkedinCode": "aaa",
                    "names": [ "Aaa", "Aaa Inc" ],
                    "indicators": [ "BANNED", "DONT_ANSWER" ]
                },
                "acme": acme,
                "pay": {
                    "linkedinCode": "pay",
                    "names": [ "Pay Co" ],
                    "indicators": [ "SALARY_AND_ADVANTAGES" ]
                },
                "reply": {
                    "linkedinCode": "reply",
                    "names": [ "Reply Co" ],
                    "indicators": [ "ANSWER" ]
                },
                "plain": {
                    "linkedinCode": "plain",
                    "names": [ "Plain Co" ],
                    "indicators": []
                }
            }
        });
        await _until(() => {

            return _names().includes("Plain Co");

        });
        deepEqual(_names(), [ "Pay Co", "Reply Co", "Acme", "Aaa", "Plain Co" ]);
        equal(_item("Aaa").querySelector(".company-aliases").textContent, "Aaa Inc");
        equal(_item("Aaa").querySelector(".badge").textContent.includes(","), true);
        equal(_item("Plain Co").querySelector(".company-icon"), null);
        equal(_item("Pay Co").querySelector(".company-name-link").style.color, "");
        equal(
            _item("Reply Co").querySelector(".company-icon span").style.getPropertyValue("-webkit-text-fill-color"),
            "rgb(22, 163, 74)"
        );
        equal(
            _item("Reply Co").querySelector(".company-icon span").style.getPropertyValue("font-variant-emoji"),
            "text"
        );
        equal(
            [ ..._item("Aaa").querySelectorAll(".company-icon span") ].every((glyph) => {
                return "" === glyph.style.getPropertyValue("-webkit-text-fill-color");
            }),
            true
        );
        equal(
            document.querySelector("input[value=\"ANSWER\"]").nextElementSibling.style.getPropertyValue("-webkit-text-fill-color"),
            "rgb(22, 163, 74)"
        );
        equal(
            document.querySelector("input[value=\"ANSWER\"]").nextElementSibling.style.getPropertyValue("font-variant-emoji"),
            "text"
        );
        equal(
            document.querySelector("input[value=\"WITHOUT_SALARY_NOR_ADVANTAGES\"]").nextElementSibling.classList.contains("li-tracker-icon-glyph--tint"),
            true
        );
        equal(
            document.querySelector("input[value=\"WITHOUT_SALARY_NOR_ADVANTAGES\"]").nextElementSibling.style.getPropertyValue("font-variant-emoji"),
            ""
        );
        equal(
            document.querySelector("input[value=\"SALARY_AND_ADVANTAGES\"]").nextElementSibling.style.getPropertyValue("font-variant-emoji"),
            ""
        );

        _item("Plain Co").querySelector("button").click();
        equal(document.getElementById("comment").value, "");

        const blobs = [];
        URL.createObjectURL = (blob) => {

            blobs.push(blob);
            return "blob:companies";

        };
        document.getElementById("export-btn").click();
        equal(document.getElementById("io-message").textContent, "5 companies exported.");

        await _chooseFile(_file("bad.json", "application/json", "{"));
        await _until(() => {

            return document.getElementById("io-message").classList.contains("error");

        });

        let asked = false;
        globalThis.confirm = () => {

            asked = true;
            return false;

        };
        await _chooseFile(_file(
            "two.json",
            "application/json",
            JSON.stringify([
                {
                    "linkedinCode": "gamma",
                    "names": [ "Gamma" ],
                    "indicators": [ "WANTED" ]
                },
                {
                    "linkedinCode": "delta",
                    "names": [ "Delta" ],
                    "indicators": [ "BANNED" ]
                }
            ])
        ));
        await _until(() => {

            return asked;

        });
        equal(_names().includes("Gamma"), false);
        globalThis.confirm = () => {

            return _allowDelete;

        };

        _allowDelete = true;
        await _chooseFile(_file(
            "two.json",
            "application/json",
            JSON.stringify([
                {
                    "linkedinCode": "gamma",
                    "names": [ "Gamma" ],
                    "indicators": [ "WANTED" ]
                },
                {
                    "linkedinCode": "delta",
                    "names": [ "Delta" ],
                    "indicators": [ "BANNED" ]
                }
            ])
        ));
        await _until(() => {

            return _names().includes("Gamma") && _names().includes("Delta");

        });
        equal(document.getElementById("io-message").textContent, "2 companies imported.");

        _item("Gamma").querySelector("button").click();
        document.getElementById("linkedin-code").value = "missing";
        await _submit();
        await _until(() => {

            return document.getElementById("form-error").textContent.includes("not found");

        });

        _item("Delta").querySelector(".danger").click();
        await _until(() => {

            return !_names().includes("Delta");

        });

        document.getElementById("linkedin-code").value = "gamma";
        _item("Gamma").querySelector(".danger").click();
        await _until(() => {

            return "Add a company" === document.getElementById("form-title").textContent;

        });

        await chrome.storage.local.set({ [REGISTRY_STORAGE_KEY]: null });
        await _until(() => {

            return 0 === _names().length;

        });

    });

});
