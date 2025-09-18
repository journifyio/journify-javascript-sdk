const path = require("path");
const webpack = require("webpack");
const { IgnorePlugin } = require("webpack");
const packageJson = require("./package.json");
const TerserPlugin = require("terser-webpack-plugin");
const { sentryWebpackPlugin } = require("@sentry/webpack-plugin");

const PATHS = {
  entryPoint: path.resolve(__dirname, "src/lib/index.ts"),
  bundles: path.resolve(__dirname, "dist/_bundles"),
};

const config = {
  mode: "production",
  devtool: "hidden-source-map",
  entry: {
    journifyio: [PATHS.entryPoint],
    "journifyio.min": [PATHS.entryPoint],
  },
  output: {
    path: PATHS.bundles,
    filename: "[name].js",
    library: {
      name: "journify",
      type: "window",
    },
  },
  // Add performance budgets
  performance: {
    maxEntrypointSize: 300 * 1024, // 300kb -> increasing to match current size
    maxAssetSize: 300 * 1024,
    hints: "error",
    assetFilter: function (assetFilename) {
      return assetFilename.endsWith(".min.js");
    },
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          sourceMap: false,
          format: {
            comments: false, // Disable comments in the output
            preamble: `// Journify.io JS SDK Version: ${packageJson.version}`,
          },
        },
        include: /\.min\.js$/,
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    sentryWebpackPlugin({
      org: "journify-frontend",
      project: "javascript-sdk",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: packageJson.version,
      },
    }),
    new webpack.DefinePlugin({
      VERSION: JSON.stringify(packageJson.version),
    }),
    new IgnorePlugin({
      resourceRegExp: /\.attrs$/,
    }),
  ],
};

module.exports = config;
