// deps

    // externals
    const { defineConfig, globalIgnores } = require("eslint/config");
    const personnallinter = require("eslint-plugin-personnallinter");

// module

module.exports = defineConfig([
    {
        "files": [ "lib/src/**/*.ts" ],
        "languageOptions": {
            "globals": {
                "chrome": "readonly",
                "window": "readonly",
                "document": "readonly",
                "history": "readonly",
                "confirm": "readonly",
                "requestAnimationFrame": "readonly"
            }
        }
    },
    {
        "plugins": {
            personnallinter
        },
        "extends": [ personnallinter.configs["ts-back"] ]
    }
]);
