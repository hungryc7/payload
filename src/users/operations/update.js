
const { NotFound } = require('../../errors');

const update = async (args) => {
  try {
    // Await validation here

    let options = {
      Model: args.Model,
      config: args.config,
      api: args.api,
      data: args.data,
      id: args.id,
      locale: args.locale,
      fallbackLocale: args.fallbackLocale,
    };

    // /////////////////////////////////////
    // 1. Execute before update hook
    // /////////////////////////////////////

    const beforeUpdateHook = args.config.hooks && args.config.hooks.beforeUpdate;

    if (typeof beforeUpdateHook === 'function') {
      options = await beforeUpdateHook(options);
    }

    // /////////////////////////////////////
    // 2. Perform update
    // /////////////////////////////////////

    const {
      Model,
      data,
      id,
      locale,
      fallbackLocale,
    } = options;

    const dataToUpdate = { ...data };
    const { password } = dataToUpdate;

    let user = await Model.findOne({ _id: id });

    if (!user) throw new NotFound();

    if (locale && user.setLocale) {
      user.setLocale(locale, fallbackLocale);
    }

    if (password) {
      delete dataToUpdate.password;
      await user.setPassword(password);
    }

    Object.assign(user, dataToUpdate);

    await user.save();

    user = user.toJSON({ virtuals: true });

    // /////////////////////////////////////
    // 3. Execute after update hook
    // /////////////////////////////////////

    const afterUpdateHook = args.config.hooks && args.config.hooks.afterUpdate;

    if (typeof afterUpdateHook === 'function') {
      user = await afterUpdateHook(options, user);
    }

    // /////////////////////////////////////
    // 4. Return user
    // /////////////////////////////////////

    return user;
  } catch (error) {
    throw error;
  }
};

module.exports = update;
