import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import webpack, { Configuration } from 'webpack';
import babelConfig from '../babel.config';
import { PayloadConfig } from '../config/types';

const mockModulePath = path.resolve(__dirname, './mocks/emptyModule.js');

export default (config: PayloadConfig): Configuration => {
  let webpackConfig: Configuration = {
    entry: {
      main: [
        require.resolve('webpack-hot-middleware/client'),
        path.resolve(__dirname, '../admin'),
      ],
    },
    output: {
      path: '/',
      publicPath: config.routes.admin,
      filename: '[name].js',
    },
    devtool: 'inline-source-map',
    mode: 'development',
    stats: 'errors-warnings',
    resolveLoader: {
      modules: ['node_modules', path.join(__dirname, '../../node_modules')],
    },
    module: {
      rules: [
        {
          test: /\.(t|j)sx?$/,
          exclude: /node_modules[\\/](?!(@payloadcms[\\/]payload)[\\/]).*/,
          use: [
            {
              loader: require.resolve('babel-loader'),
              options: babelConfig({ env: () => false }),
            },
          ],
        },
        {
          test: /\.(scss|css)$/,
          sideEffects: true,
          use: [
            require.resolve('style-loader'),
            require.resolve('css-loader'),
            {
              loader: require.resolve('postcss-loader'),
              options: {
                postcssOptions: {
                  plugins: [require.resolve('postcss-preset-env')],
                },
              },
            },
            require.resolve('sass-loader'),
          ],
        },
        {
          oneOf: [
            {
              test: /\.(?:ico|gif|png|jpg|jpeg)$/i,
              type: 'asset/resource',
            },
            {
              test: /\.(woff(2)?|eot|ttf|otf|svg|)$/,
              type: 'asset/inline',
            },
          ],
        },
      ],
    },
    resolve: {
      fallback: {
        path: require.resolve('path-browserify'),
        crypto: false,
        https: false,
        http: false,
        assert: false,
      },
      modules: ['node_modules', path.resolve(__dirname, '../../node_modules')],
      alias: {
        'payload/config': config.paths.config,
        '@payloadcms/payload$': mockModulePath,
      },
      extensions: ['.ts', '.tsx', '.js', '.json'],
    },
    plugins: [
      new webpack.ProvidePlugin(
        { process: 'process/browser' },
      ),
      new webpack.DefinePlugin(
        Object.entries(config.publicENV).reduce(
          (values, [key, val]) => ({
            ...values,
            [`process.env.${key}`]: `'${val}'`,
          }),
          {},
        ),
      ),
      new HtmlWebpackPlugin({
        template:
          config.admin && config.admin.indexHTML
            ? path.join(config.paths.configDir, config.admin.indexHTML)
            : path.resolve(__dirname, '../admin/index.html'),
        filename: path.normalize('./index.html'),
      }),
      new webpack.HotModuleReplacementPlugin(),
    ],
  };

  if (Array.isArray(config.serverModules)) {
    config.serverModules.forEach((mod) => {
      webpackConfig.resolve.alias[mod] = mockModulePath;
    });
  }

  if (config.paths.scss) {
    const overridePath = path.join(config.paths.configDir, config.paths.scss);
    webpackConfig.resolve.alias['payload-scss-overrides'] = overridePath;
  } else {
    webpackConfig.resolve.alias['payload-scss-overrides'] = path.resolve(__dirname, '../admin/scss/overrides.scss');
  }

  if (config.webpack && typeof config.webpack === 'function') {
    webpackConfig = config.webpack(webpackConfig);
  }

  return webpackConfig;
};
