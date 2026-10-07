import * as nodeModule from "node:module";

function resolve (specifier, context, nextResolve) {

    const parent = context.parentURL ?? "";
    const fromProject = parent.includes("/lib/src/") || parent.includes("/test/");
    const needsExtension = fromProject
        && specifier.startsWith(".")
        && !/\.[a-z0-9]+$/i.test(specifier);

    if (needsExtension) {
        return nextResolve(`${specifier}.ts`, context);
    }

    return nextResolve(specifier, context);

}

if ("function" === typeof nodeModule.registerHooks) {
    nodeModule.registerHooks({ resolve });
} else {
    nodeModule.register("./resolve-ts.js", import.meta.url);
}
