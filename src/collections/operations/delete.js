const fs = require('fs');
const { NotFound } = require('../../errors');
const executePolicy = require('../../users/executePolicy');

const deleteQuery = async (args) => {
  try {
    // /////////////////////////////////////
    // 1. Retrieve and execute policy
    // /////////////////////////////////////

    await executePolicy(args, args.config.policies.delete);

    let options = { ...args };

    // /////////////////////////////////////
    // 2. Execute before collection hook
    // /////////////////////////////////////

    const { beforeDelete } = args.config.hooks;

    if (typeof beforeDelete === 'function') {
      options = await beforeDelete(options);
    }

    // /////////////////////////////////////
    // 3. Get existing document
    // /////////////////////////////////////

    const {
      Model,
      id,
      req: {
        locale,
        fallbackLocale,
      },
    } = options;

    let resultToDelete = await Model.findOne({ _id: id });

    if (!resultToDelete) throw new NotFound();

    resultToDelete = resultToDelete.toJSON({ virtuals: true });

    if (locale && resultToDelete.setLocale) {
      resultToDelete.setLocale(locale, fallbackLocale);
    }

    // /////////////////////////////////////
    // 4. Delete any associated files
    // /////////////////////////////////////

    const { staticDir } = options.req.collection.config.upload;

    fs.unlink(`${staticDir}/${resultToDelete.filename}`, (err) => {
      console.log('Error deleting file:', err);
    });

    if (resultToDelete.sizes) {
      Object.values(resultToDelete.sizes).forEach((size) => {
        fs.unlink(`${staticDir}/${size.filename}`, (err) => {
          console.log('Error deleting file:', err);
        });
      });
    }

    // /////////////////////////////////////
    // 5. Delete database document
    // /////////////////////////////////////

    let result = await Model.findOneAndDelete({ _id: id });

    result = result.toJSON({ virtuals: true });

    if (locale && result.setLocale) {
      result.setLocale(locale, fallbackLocale);
    }

    // /////////////////////////////////////
    // 4. Execute after collection hook
    // /////////////////////////////////////

    const { afterDelete } = args.config.hooks;

    if (typeof afterDelete === 'function') {
      result = await afterDelete(options, result) || result;
    }

    // /////////////////////////////////////
    // 5. Return results
    // /////////////////////////////////////

    return result;
  } catch (err) {
    throw err;
  }
};

module.exports = deleteQuery;
