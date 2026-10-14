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

describe("popup list", () => {

    it("loads the list and edits a company", async () => {

        _install();

        try {

            await chrome.storage.local.set({ [REGISTRY_STORAGE_KEY]: { "acme": acme } });
            await import("../lib/src/popup/popup.ts");
            await _until(() => {

                return _names().includes("Acme");

            });
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

        }
        finally {

            _dom?.window.close();

        }

    });

});
