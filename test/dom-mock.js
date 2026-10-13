// deps

    // externals
    import { JSDOM } from "jsdom";

// module

export function installDomMock (html = "<!doctype html><html><body></body></html>", url = "https://www.linkedin.com/") {

    const dom = new JSDOM(html, { url });
    const { window } = dom;

    globalThis.window = window;
    globalThis.document = window.document;
    globalThis.HTMLElement = window.HTMLElement;
    globalThis.Node = window.Node;
    globalThis.MutationObserver = window.MutationObserver;

    return dom;

}
