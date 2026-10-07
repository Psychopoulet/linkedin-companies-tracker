// deps

    // natives
    import { join } from "node:path";
    import { readFile, lstat } from "node:fs/promises";
    import { equal } from "node:assert";

// consts

    const MANIFEST_FILE = join(import.meta.dirname, "..", "lib", "src", "manifest.json");
    const PACKAGE_FILE = join(import.meta.dirname, "..", "package.json");

// tests

describe("check manifest", () => {

    it("should check files existence", async () => {

        const manifestStats = await lstat(MANIFEST_FILE);
        const packageStats = await lstat(PACKAGE_FILE);

        equal(packageStats.isFile(), true, "Package file does not exist");
        equal(manifestStats.isFile(), true, "Manifest file does not exist");

    });

    it("should match with package.json", async () => {

        const packageFile = JSON.parse(await readFile(PACKAGE_FILE, "utf-8"));
        const manifest = JSON.parse(await readFile(MANIFEST_FILE, "utf-8"));

        equal(manifest.version, packageFile.version, "Manifest version does not match with package.json version");
        equal(manifest.name, packageFile.name, "Manifest name does not match with package.json name");
        equal(manifest.description, packageFile.description, "Manifest description does not match with package.json description");

    });

});
