const executePolicy = require('../../users/executePolicy');

const update = async (args) => {
  try {
    // /////////////////////////////////////
    // 1. Retrieve and execute policy
    // /////////////////////////////////////

    const policy = args.config && args.config.policies && args.config.policies.update;
    await executePolicy(args.user, policy);

    // Await validation here

    let options = {
      Model: args.Model,
      locale: args.locale,
      fallbackLocale: args.fallbackLocale,
      id: args.id,
      data: args.data,
    };

    // /////////////////////////////////////
    // 2. Execute before collection hook
    // /////////////////////////////////////

    const beforeUpdateHook = args.config && args.config.hooks && args.config.hooks.beforeUpdate;

    if (typeof beforeUpdateHook === 'function') {
      options = await beforeUpdateHook(options);
    }

    // /////////////////////////////////////
    // 3. Perform database operation
    // /////////////////////////////////////

    const {
      Model,
      id,
      locale,
      fallbackLocale,
      data,
    } = options;

    let result = await Model.findOne({ _id: id });

    if (locale && result.setLocale) {
      result.setLocale(locale, fallbackLocale);
    }

    Object.assign(result, data);
    await result.save();

    result = result.toJSON({ virtuals: true });

    // /////////////////////////////////////
    // 4. Execute after collection hook
    // /////////////////////////////////////

    const afterUpdateHook = args.config && args.config.hooks && args.config.hooks.afterUpdate;

    if (typeof afterUpdateHook === 'function') {
      result = await afterUpdateHook(options, result);
    }

    // /////////////////////////////////////
    // 5. Return results
    // /////////////////////////////////////

    return result;
  } catch (err) {
    throw err;
  }
};

module.exports = update;
