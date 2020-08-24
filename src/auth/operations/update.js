const httpStatus = require('http-status');
const deepmerge = require('deepmerge');
const overwriteMerge = require('../../utilities/overwriteMerge');
const { NotFound, Forbidden, APIError } = require('../../errors');
const executeAccess = require('../executeAccess');

async function update(args) {
  const {
    depth,
    collection: {
      Model,
      config: collectionConfig,
    },
    id,
    req,
    req: {
      locale,
      fallbackLocale,
    },
    overrideAccess,
  } = args;

  if (!id) {
    throw new APIError('Missing ID of document to update.', httpStatus.BAD_REQUEST);
  }

  // /////////////////////////////////////
  // 1. Execute access
  // /////////////////////////////////////

  const accessResults = !overrideAccess ? await executeAccess({ req, id }, collectionConfig.access.update) : true;
  const hasWhereAccess = typeof accessResults === 'object';

  // /////////////////////////////////////
  // 2. Retrieve document
  // /////////////////////////////////////

  const queryToBuild = {
    where: {
      and: [
        {
          id: {
            equals: id,
          },
        },
      ],
    },
  };

  if (hasWhereAccess) {
    queryToBuild.where.and.push(hasWhereAccess);
  }

  const query = await Model.buildQuery(queryToBuild, locale);

  let user = await Model.findOne(query);

  if (!user && !hasWhereAccess) throw new NotFound();
  if (!user && hasWhereAccess) throw new Forbidden();

  if (locale && user.setLocale) {
    user.setLocale(locale, fallbackLocale);
  }

  let originalDoc = user.toJSON({ virtuals: true });

  originalDoc = JSON.stringify(originalDoc);
  originalDoc = JSON.parse(originalDoc);

  let { data } = args;

  // /////////////////////////////////////
  // 3. Execute before validate collection hooks
  // /////////////////////////////////////

  await collectionConfig.hooks.beforeValidate.reduce(async (priorHook, hook) => {
    await priorHook;

    data = (await hook({
      data,
      req,
      operation: 'update',
      originalDoc,
    })) || data;
  }, Promise.resolve());

  // /////////////////////////////////////
  // 4. Execute field-level hooks, access, and validation
  // /////////////////////////////////////

  data = await this.performFieldOperations(collectionConfig, {
    data,
    req,
    id,
    hook: 'beforeChange',
    operation: 'update',
    originalDoc,
    overrideAccess,
  });

  // /////////////////////////////////////
  // 5. Execute before update hook
  // /////////////////////////////////////

  await collectionConfig.hooks.beforeChange.reduce(async (priorHook, hook) => {
    await priorHook;

    data = (await hook({
      data,
      req,
      originalDoc,
      operation: 'update',
    })) || data;
  }, Promise.resolve());

  // /////////////////////////////////////
  // 6. Merge updates into existing data
  // /////////////////////////////////////

  data = deepmerge(originalDoc, data, { arrayMerge: overwriteMerge });

  // /////////////////////////////////////
  // 7. Handle password update
  // /////////////////////////////////////

  const dataToUpdate = { ...data };
  const { password } = dataToUpdate;

  if (password) {
    await user.setPassword(password);
    delete dataToUpdate.password;
  }

  // /////////////////////////////////////
  // 8. Perform database operation
  // /////////////////////////////////////

  Object.assign(user, dataToUpdate);

  await user.save();

  user = user.toJSON({ virtuals: true });

  // /////////////////////////////////////
  // 9. Execute field-level hooks and access
  // /////////////////////////////////////

  user = await this.performFieldOperations(collectionConfig, {
    data: user,
    hook: 'afterRead',
    operation: 'read',
    req,
    id,
    depth,
    overrideAccess,
  });

  // /////////////////////////////////////
  // 10. Execute after update hook
  // /////////////////////////////////////

  await collectionConfig.hooks.afterChange.reduce(async (priorHook, hook) => {
    await priorHook;

    user = await hook({
      doc: user,
      req,
      operation: 'update',
    }) || user;
  }, Promise.resolve());

  // /////////////////////////////////////
  // 11. Return user
  // /////////////////////////////////////
  user = JSON.stringify(user);
  user = JSON.parse(user);

  return user;
}

module.exports = update;
