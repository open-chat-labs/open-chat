const path = require("path");
const webpack = require("webpack");

module.exports = {
    entry: {
        ww: path.join(__dirname, "src/worker.ts"),
    },
    mode: "production",
    target: "web",
    devtool: "source-map",
    output: {
        path: path.join(__dirname, "../app/build"),
        filename: "worker.js",
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
    ],
};
