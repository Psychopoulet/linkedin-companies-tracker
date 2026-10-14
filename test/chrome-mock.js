// module

function _matchChromeUrl (pattern, url) {

    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");

    return new RegExp(`^${escaped}$`).test(url);

}

export function installChromeMock () {

    const local = {};
    const messageListeners = [];
    const storageListeners = [];
    const installedListeners = [];
    const tabs = [];
    const sentTabMessages = [];

    const chrome = {
        "storage": {
            "local": {
                async get (key) {

                    if (!Object.hasOwn(local, key)) {
                        return {};
                    }

                    return { [key]: structuredClone(local[key]) };

                },
                async set (items) {

                    const changes = {};

                    for (const [ key, value ] of Object.entries(items)) {

                        const stored = structuredClone(value);
                        const change = { "newValue": stored };

                        if (Object.hasOwn(local, key)) {
                            change.oldValue = local[key];
                        }

                        local[key] = stored;
                        changes[key] = change;

                    }

                    for (const listener of [ ...storageListeners ]) {
                        listener(changes, "local");
                    }

                }
            },
            "onChanged": {
                addListener (listener) {
                    storageListeners.push(listener);
                }
            }
        },
        "runtime": {
            "onMessage": {
                addListener (listener) {
                    messageListeners.push(listener);
                }
            },
            "onInstalled": {
                addListener (listener) {
                    installedListeners.push(listener);
                }
            },
            async sendMessage (message) {

                let response;

                for (const listener of [ ...messageListeners ]) {

                    await new Promise((resolve) => {

                        let settled = false;
                        const pending = listener(message, {}, (value) => {

                            if (settled) {
                                return;
                            }

                            settled = true;
                            response = value;
                            resolve();

                        });

                        if (settled || true === pending) {
                            return;
                        }

                        settled = true;
                        resolve();

                    });

                }

                return response;

            }
        },
        "tabs": {
            async query (queryInfo = {}) {

                if ("string" !== typeof queryInfo.url) {
                    return [ ...tabs ];
                }

                return tabs.filter((tab) => {
                    return "string" === typeof tab.url && _matchChromeUrl(queryInfo.url, tab.url);
                });

            },
            sendMessage (tabId, message) {

                sentTabMessages.push({ tabId, message });
                const tab = tabs.find((item) => {
                    return item.id === tabId;
                });

                if (true === tab?.rejectSend) {
                    return Promise.reject(new Error("Could not establish connection."));
                }

                return Promise.resolve();

            }
        }
    };

    globalThis.chrome = chrome;

    return {
        local,
        messageListeners,
        storageListeners,
        installedListeners,
        tabs,
        sentTabMessages,
        reset () {

            for (const key of Object.keys(local)) {
                delete local[key];
            }

            tabs.length = 0;
            sentTabMessages.length = 0;

        }
    };

}
