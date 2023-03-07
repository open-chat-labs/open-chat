const path = require("path");
const webpack = require("webpack");
const package = require("./package.json");

module.exports = {
    entry: {
        sw: path.join(__dirname, "src/sw/sw.ts"),
    },
    mode: "production",
    target: "web",
    devtool: "source-map",
    output: {
        path: path.join(__dirname, "build"),
        filename: "[name].js",
        publicPath: "/",
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "ts-loader",
                    },
                ],
            },
        ],
    },
    resolve: {
        alias: {
            process: "process/browser",
        },
        extensions: [".tsx", ".ts", ".js"],
        fallback: {
            assert: require.resolve("assert/"),
            events: require.resolve("events/"),
            stream: require.resolve("stream-browserify/"),
            util: require.resolve("util/"),
        },
    },
    plugins: [
        new webpack.ProvidePlugin({
            process: require.resolve("process/browser"),
        }),
        new webpack.EnvironmentPlugin({
            FORCE_FETCH_ROOT_KEY: false,
            VERSION: package.version,
            LANDING_PAGE_MODE: true,
        }),
    ],
};
