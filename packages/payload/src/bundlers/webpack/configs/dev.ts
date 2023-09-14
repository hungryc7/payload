import type { Configuration } from 'webpack'

import md5 from 'md5'
import webpack from 'webpack'

import type { SanitizedConfig } from '../../../config/types'

import { getBaseConfig } from './base'

export const getDevConfig = (payloadConfig: SanitizedConfig): Configuration => {
  const baseConfig = getBaseConfig(payloadConfig) as any

  let webpackConfig: Configuration = {
    ...baseConfig,
    cache: {
      buildDependencies: {
        config: [__filename],
      },
      type: 'filesystem',
      // version cache when there are changes to aliases
      version: md5(Object.entries(baseConfig.resolve.alias).join()),
    },
    devtool: 'inline-source-map',
    entry: {
      ...baseConfig.entry,
      main: [
        `webpack-hot-middleware/client?path=${payloadConfig.routes.admin}/__webpack_hmr`,
        ...(baseConfig.entry.main as string[]),
      ],
    },
    mode: 'development',
    output: {
      filename: '[name].js',
      path: '/',
      publicPath: `${payloadConfig.routes.admin}/`,
    },
    plugins: [...baseConfig.plugins, new webpack.HotModuleReplacementPlugin()],
    stats: 'errors-warnings',
  }

  webpackConfig.module.rules.push({
    sideEffects: true,
    test: /\.(scss|css)$/,
    /*
     * The loaders here are run in reverse order. Here is how your loaders are being processed:
     * 1. sass-loader: This loader compiles your SCSS into CSS.
     * 2. postcss-loader: This loader applies postcss transformations (with preset-env plugin in your case).
     * 3. css-loader: This loader interprets @import and url() like import/require() and will resolve them.
     * 4. style-loader: This loader injects CSS into the DOM.
     */
    use: [
      require.resolve('style-loader'),
      {
        loader: require.resolve('css-loader'),
        options: {
          url: (url) => !url.startsWith('/'),
        },
      },
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
  })

  if (payloadConfig.admin.webpack && typeof payloadConfig.admin.webpack === 'function') {
    webpackConfig = payloadConfig.admin.webpack(webpackConfig)
  }

  return webpackConfig
}
