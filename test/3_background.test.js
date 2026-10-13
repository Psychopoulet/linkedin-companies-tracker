// deps

    // natives
    import { deepEqual, equal, rejects } from "node:assert/strict";

    // locals
    import { installChromeMock } from "./chrome-mock.js";
    import { REGISTRY_UPDATED } from "../lib/src/messages.ts";
    import { REGISTRY_STORAGE_KEY } from "../lib/src/storage/constants.ts";
    import {
        addCompany,
        broadcastRegistryUpdate,
        deleteCompany,
        getRegistry,
        replaceRegistry,
        updateCompany
    } from "../lib/src/background/storage.ts";

// consts

    const mock = installChromeMock();
    const acme = {
        "linkedinCode": "acme",
        "names": [ "Acme" ],
        "indicators": [ "WANTED" ]
    };

// private

    // methods
    async function _flush () {

        await new Promise((resolve) => {

            setTimeout(resolve, 0);

        });

    }

    async function _send (message) {

        return chrome.runtime.sendMessage(message);

    }

    async function _withGet (get, run) {

        const original = chrome.storage.local.get;
        chrome.storage.local.get = get;

        try {

            return await run();

        }
        finally {

            chrome.storage.local.get = original;

        }

    }

// init

await import("../lib/src/background/service-worker.ts");

// tests

describe("storage", () => {

    beforeEach(() => {

        mock.reset();

    });

    it("returns an empty registry when nothing usable is stored", async () => {

        deepEqual(await getRegistry(), {});

        await chrome.storage.local.set({ [REGISTRY_STORAGE_KEY]: null });
        deepEqual(await getRegistry(), {});

        await chrome.storage.local.set({ [REGISTRY_STORAGE_KEY]: "nope" });
        deepEqual(await getRegistry(), {});

    });

    it("rewrites a legacy registry and leaves a normalized one in place", async () => {

        await chrome.storage.local.set({
            [REGISTRY_STORAGE_KEY]: {
                "acme": {
                    "linkedinCode": "Acme/",
                    "name": " Acme ",
                    "indicators": [ "WANTED", "WANTED" ]
                },
                "blank": {
                    "linkedinCode": "blank",
                    "name": " ",
                    "indicators": []
                }
            }
        });

        deepEqual(await getRegistry(), {
            "acme": {
                "linkedinCode": "acme",
                "names": [ "Acme" ],
                "indicators": [ "WANTED" ]
            }
        });
        deepEqual(mock.local[REGISTRY_STORAGE_KEY], {
            "acme": {
                "linkedinCode": "acme",
                "names": [ "Acme" ],
                "indicators": [ "WANTED" ]
            }
        });

        const stored = mock.local[REGISTRY_STORAGE_KEY];
        deepEqual(await getRegistry(), stored);
        equal(mock.local[REGISTRY_STORAGE_KEY], stored);

    });

    it("adds, updates, deletes, and replaces companies", async () => {

        deepEqual(await addCompany({
            "linkedinCode": "Acme/",
            "name": " Acme ",
            "indicators": [ "WANTED" ]
        }), {
            "acme": acme
        });

        deepEqual(await updateCompany({
            ...acme,
            "comment": "note"
        }), {
            "acme": {
                ...acme,
                "comment": "note"
            }
        });

        deepEqual(await deleteCompany("Acme/"), {});

        deepEqual(await replaceRegistry([
            {
                "linkedinCode": "Beta/",
                "name": "Beta",
                "indicators": []
            },
            acme
        ]), {
            "beta": {
                "linkedinCode": "beta",
                "names": [ "Beta" ],
                "indicators": []
            },
            "acme": acme
        });

    });

    it("rejects an invalid company and a missing update", async () => {

        const invalid = {
            "linkedinCode": " ",
            "names": [ " " ],
            "indicators": []
        };

        await rejects(addCompany(invalid), {
            "message": "Invalid data: name is required."
        });
        await rejects(updateCompany(invalid), {
            "message": "Invalid data: name is required."
        });
        await rejects(updateCompany(acme), {
            "message": "Company not found: acme"
        });

    });

    it("broadcasts to LinkedIn tabs and ignores a missing content script", async () => {

        mock.tabs.push(
            { "url": "https://www.linkedin.com/feed/" },
            { "id": 4, "url": "https://www.linkedin.com/company/acme/", "rejectSend": true },
            { "id": 8, "url": "https://www.linkedin.com/jobs/" },
            { "id": 9, "url": "https://example.com/" }
        );

        await broadcastRegistryUpdate();

        deepEqual(mock.sentTabMessages, [
            { "tabId": 4, "message": { "type": "REGISTRY_UPDATED" } },
            { "tabId": 8, "message": { "type": "REGISTRY_UPDATED" } }
        ]);

    });

});

describe("service worker", () => {

    beforeEach(() => {

        mock.reset();
        mock.tabs.push({ "id": 8, "url": "https://www.linkedin.com/jobs/" });

    });

    it("answers every message type", async () => {

        deepEqual(await _send({ "type": "GET_REGISTRY" }), {
            "ok": true,
            "registry": {}
        });
        equal(mock.sentTabMessages.length, 0);

        deepEqual(await _send({ "type": "ADD_COMPANY", "company": acme }), {
            "ok": true,
            "registry": { "acme": acme }
        });
        equal(mock.sentTabMessages.length, 2);

        deepEqual(await _send({
            "type": "UPDATE_COMPANY",
            "company": { ...acme, "comment": "note" }
        }), {
            "ok": true,
            "registry": {
                "acme": { ...acme, "comment": "note" }
            }
        });

        deepEqual(await _send({ "type": "DELETE_COMPANY", "linkedinCode": "acme" }), {
            "ok": true,
            "registry": {}
        });

        deepEqual(await _send({
            "type": "IMPORT_REGISTRY",
            "companies": [ acme ]
        }), {
            "ok": true,
            "registry": { "acme": acme }
        });
        equal(mock.sentTabMessages.length, 8);

    });

    it("rejects an invalid company, a missing company, and an unknown message", async () => {

        const invalid = {
            "linkedinCode": "acme",
            "indicators": []
        };

        deepEqual(await _send({ "type": "ADD_COMPANY", "company": invalid }), {
            "ok": false,
            "error": "Invalid data: name is required."
        });
        deepEqual(await _send({ "type": "UPDATE_COMPANY", "company": invalid }), {
            "ok": false,
            "error": "Invalid data: name is required."
        });
        deepEqual(await _send({ "type": "UPDATE_COMPANY", "company": acme }), {
            "ok": false,
            "error": "Company not found: acme"
        });
        deepEqual(await _send({ "type": "IMPORT_REGISTRY", "companies": null }), {
            "ok": false,
            "error": "Invalid data: one or more companies are incorrect."
        });
        deepEqual(await _send({ "type": "IMPORT_REGISTRY", "companies": [ invalid ] }), {
            "ok": false,
            "error": "Invalid data: one or more companies are incorrect."
        });
        deepEqual(await _send({ "type": "NOPE" }), {
            "ok": false,
            "error": "Unknown message"
        });
        equal(mock.sentTabMessages.length, 0);

    });

    it("reports a thrown storage error", async () => {

        deepEqual(await _withGet(async () => {

            throw new Error("storage down");

        }, () => {

            return _send({ "type": "GET_REGISTRY" });

        }), {
            "ok": false,
            "error": "storage down"
        });

        deepEqual(await _withGet(async () => {

            throw "boom";

        }, () => {

            return _send({ "type": "GET_REGISTRY" });

        }), {
            "ok": false,
            "error": "Unknown error"
        });

        deepEqual(await _withGet(async () => {

            throw "boom";

        }, () => {

            return _send({ "type": "UPDATE_COMPANY", "company": acme });

        }), {
            "ok": false,
            "error": "Unknown error"
        });

    });

    it("broadcasts when the registry changes and ignores other storage events", async () => {

        const listener = mock.storageListeners[0];

        listener({ "other": { "newValue": 1 } }, "local");
        listener({ [REGISTRY_STORAGE_KEY]: { "newValue": {} } }, "sync");
        equal(mock.sentTabMessages.length, 0);

        listener({ [REGISTRY_STORAGE_KEY]: { "newValue": {} } }, "local");
        await _flush();
        equal(mock.sentTabMessages.length, 1);

        const query = chrome.tabs.query.bind(chrome.tabs);
        chrome.tabs.query = async () => {

            throw new Error("tabs failed");

        };

        try {

            listener({ [REGISTRY_STORAGE_KEY]: { "newValue": {} } }, "local");
            await _flush();
            equal(mock.sentTabMessages.length, 1);

        }
        finally {

            chrome.tabs.query = query;

        }

    });

    it("logs when the extension is installed", () => {

        const messages = [];
        const info = console.info;
        console.info = (message) => {

            messages.push(message);

        };

        try {

            mock.installedListeners[0]();

        }
        finally {

            console.info = info;

        }

        deepEqual(messages, [ `[${REGISTRY_UPDATED}] Extension installed` ]);

    });

});
