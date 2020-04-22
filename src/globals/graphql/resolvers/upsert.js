/* eslint-disable no-param-reassign */
const { upsert } = require('../../operations');

const upsertResolver = (Model, config) => async (_, args, context) => {
  if (args.locale) context.locale = args.locale;
  if (args.fallbackLocale) context.fallbackLocale = args.fallbackLocale;

  const { slug } = config;

  const options = {
    config,
    Model,
    data: args.data,
    slug,
    depth: 0,
    req: context,
  };

  const result = await upsert(options);

  return result;
};

module.exports = upsertResolver;
