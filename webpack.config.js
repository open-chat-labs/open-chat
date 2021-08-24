const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");
const dfxJson = require("./dfx.json");

const NOTIFICATIONS_CANISTER_ID = "qhbym-qaaaa-aaaaa-aaafq-cai";

const isDevelopment = process.env.NODE_ENV 
  ? (process.env.NODE_ENV !== "production") 
  : (process.env.DFX_NETWORK !== "ic");

const mode = isDevelopment ? "development" : "production";

function initCanisterIds() {
    let localCanisters, prodCanisters;

    try {
        localCanisters = require(path.resolve(".dfx", "local", "canister_ids.json"));
    } catch (error) {
        console.log("No local canister_ids.json found. Continuing production");
    }
    
    try {
        prodCanisters = require(path.resolve("canister_ids.json"));
    } catch (error) {
        console.log("No production canister_ids.json found. Continuing with local");
    }

    const network = process.env.DFX_NETWORK || (isDevelopment ? "local" : "ic");

    let canisters = network === "local" ? localCanisters : prodCanisters;

    let canisterIds = {};

    for (const canister in canisters) {
        canisterIds[canister] = canisters[canister][network];
    }  

    return canisterIds;
}

let canisterIds = initCanisterIds();

let IDP_URL = isDevelopment 
  ? "http://s55qq-oqaaa-aaaaa-aaakq-cai.localhost:8000"
  : "https://identity.ic0.app/";

// List of all aliases for canisters. This creates the module alias for
// the `import ... from "@dfinity/ic/canisters/xyz"` where xyz is the name of a
// canister.
const aliases = Object.entries(dfxJson.canisters).reduce(
    (acc, [name, _value]) => {
      // Get the network name, or `local` by default.
      const networkName = process.env["DFX_NETWORK"] || "local";
      const outputRoot = path.join(
          __dirname,
          ".dfx",
          networkName,
          "canisters",
          name
      );

      return {
        ...acc,
        ["dfx-generated/" + name]: path.join(outputRoot, "index.js"),
      };
    },
    {}
);

/**
 * Generate a webpack configuration for a canister.
 */
function generateWebpackConfigForCanister(name, info) {
  if (typeof info.frontend !== "object") {
    return;
  }

  const sourceDir = path.join(__dirname, info.frontend.sourceDir);

  return {
    mode,
    entry: {
      index: path.join(__dirname, info.frontend.entrypoint)
    },
    devtool: "source-map",
    optimization: {
      minimize: !isDevelopment,
      minimizer: [new TerserPlugin()],
      splitChunks: {
        chunks: "all"
      }
    },
    resolve: {
      alias: aliases,
      extensions: [".js", ".ts", ".jsx", ".tsx"],
      fallback: {
        "assert": require.resolve("assert/"),
        "buffer": require.resolve("buffer/"),
        "events": require.resolve("events/"),
        "stream": require.resolve("stream-browserify/"),
        "util": require.resolve("util/"),
      },
    },
    output: {
      filename: "[name].js",
      path: path.join(__dirname, "dist", name),
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx|jsx)$/,
          use: "ts-loader",
          include: sourceDir
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
          include: sourceDir
        },
        {
          test: /\.svg$/,
          use: "svg-react-loader",
          include: sourceDir
        },
        {
          test: /\.html$/i,
          use: "html-loader",
          include: sourceDir
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.join(__dirname, info.frontend.entrypoint).replace(/\.tsx$/, ".html"),
        filename: 'index.html',
        chunks: ['index'],
      }),
      new webpack.EnvironmentPlugin({
        NODE_ENV: mode,
        CHATS_CANISTER_ID: canisterIds["chats"],
        P2P_CANISTER_ID: canisterIds["p2p"],
        USER_MGMT_CANISTER_ID: canisterIds["user_mgmt"],
        NOTIFICATIONS_CANISTER_ID,
        IDP_URL,
      }),  
      new webpack.ProvidePlugin({
        Buffer: [require.resolve('buffer/'), 'Buffer'],
        process: require.resolve('process/browser'),
      }),
    ],
  };
}

function generateWebpackConfigForServiceWorker() {
  const sourceDir = path.join(__dirname, "src", "website");
  return {
    mode: "production",
    devtool: false,
    entry: path.join(sourceDir, "sw/index.ts"),
    resolve: {
      extensions: [".ts"],
    },
    output: {
      filename: "sw10.js",
      path: path.resolve(__dirname, "dist/website"),
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: "ts-loader",
          include: path.join(sourceDir, "sw"),
        },
        {
          test: /\.ts$/,
          use: "ts-loader",
          include: path.join(sourceDir, "services/notifications/candid"),
        },
        {
          test: /\.ts$/,
          use: "ts-loader",
          include: path.join(sourceDir, "utils/cycleFunctions"),
        },
      ]
    },
  };
}

// If you have additional webpack configurations you want to build
//  as part of this configuration, add them to the section below.
module.exports = [
  ...Object
      .entries(dfxJson.canisters)
      .map(([name, info]) => {
        return generateWebpackConfigForCanister(name, info);
      })
      .filter((x) => !!x),
  generateWebpackConfigForServiceWorker(),
];
