export function resolve (specifier, context, nextResolve) {

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
