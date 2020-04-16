const executePolicy = require('../../users/executePolicy');

const create = async (args) => {
  try {
    // /////////////////////////////////////
    // 1. Retrieve and execute policy
    // /////////////////////////////////////

    const policy = args.config && args.config.policies && args.config.policies.create;

    await executePolicy(args.user, policy);

    // Await validation here

    let options = {
      Model: args.Model,
      config: args.config,
      locale: args.locale,
      fallbackLocale: args.fallbackLocale,
      user: args.user,
      api: args.api,
      data: args.data,
    };

    // /////////////////////////////////////
    // 2. Execute before collection hook
    // /////////////////////////////////////

    const beforeCreateHook = args.config && args.config.hooks && args.config.hooks.beforeCreate;

    if (typeof beforeCreateHook === 'function') {
      options = await beforeCreateHook(options);
    }

    // /////////////////////////////////////
    // 3. Perform database operation
    // /////////////////////////////////////

    const {
      Model,
      locale,
      fallbackLocale,
      data,
    } = options;

    let result = new Model();

    if (locale && result.setLocale) {
      result.setLocale(locale, fallbackLocale);
    }

    Object.assign(result, data);
    await result.save();

    result = result.toJSON({ virtuals: true });

    // /////////////////////////////////////
    // 4. Execute after collection hook
    // /////////////////////////////////////

    const afterCreateHook = args.config && args.config.hooks && args.config.hooks.afterCreate;

    if (typeof afterDeleteHook === 'function') {
      result = await afterCreateHook(options, result);
    }

    // /////////////////////////////////////
    // 5. Return results
    // /////////////////////////////////////

    return result;
  } catch (err) {
    throw err;
  }
};

module.exports = create;
