// deps

    // natives
    const { join } = require("node:path");

    // externals
    const TerserPlugin = require("terser-webpack-plugin");

// consts

    const SRC = join(__dirname, "lib", "src");

// module

module.exports = {

    "mode": "production",

    "entry": {
        "background/service-worker": join(SRC, "background", "service-worker.ts"),
        "popup/popup": join(SRC, "popup", "popup.ts"),
        "content/linkedin-company": join(SRC, "content", "linkedin-company.ts"),
        "content/linkedin-jobs": join(SRC, "content", "linkedin-jobs.ts")
    },

    "output": {
        "filename": "[name].js",
        "path": join(__dirname, "lib", "dist"),
        "chunkLoading": false
    },

    "devtool": false,

    "module": {
        "rules": [
            {
                "test": /\.ts$/,
                "exclude": [ /node_modules/ ],
                "use": [
                    {
                        "loader": "ts-loader",
                        "options": {
                            "transpileOnly": true,
                            "configFile": join(__dirname, "tsconfig.json")
                        }
                    }
                ]
            }
        ]
    },

    "optimization": {
        "splitChunks": false,
        "runtimeChunk": false,
        "minimize": true,
        "minimizer": [
            new TerserPlugin({
                "parallel": true,
                "terserOptions": {
                    "format": {
                        "comments": false
                    }
                },
                "extractComments": false
            })
        ]
    },

    "resolve": {
        "extensions": [ ".ts", ".js" ]
    }

};
