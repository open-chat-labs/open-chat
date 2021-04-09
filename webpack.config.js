const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");
const dfxJson = require("./dfx.json");

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
        ["dfx-generated/" + name]: path.join(outputRoot, name + ".js"),
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
    mode: "production",
    entry: {
      index: path.join(__dirname, info.frontend.entrypoint)
    },
    devtool: "source-map",
    optimization: {
      minimize: true,
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
      clean: true
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
      new webpack.ProvidePlugin({
        Buffer: [require.resolve('buffer/'), 'Buffer'],
        process: require.resolve('process/browser'),
      }),
    ],
  };
}

// If you have additional webpack configurations you want to build
//  as part of this configuration, add them to the section below.
module.exports = [
  ...Object.entries(dfxJson.canisters)
      .map(([name, info]) => {
        return generateWebpackConfigForCanister(name, info);
      })
      .filter((x) => !!x),
];
