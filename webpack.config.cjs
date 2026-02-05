const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true,
    assetModuleFilename: 'assets/[hash][ext][query]'
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpe?g|gif|webp|svg)$/i,
        type: 'asset/resource'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      inject: 'body'
    }),
    new CopyPlugin({
      patterns: [
        { from: path.resolve(__dirname, 'src/assets'), to: 'assets' }
      ]
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },
    hot: true,
    port: 5173,
    historyApiFallback: true
  }
};
