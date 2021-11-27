import httpStatus from 'http-status';
import path from 'path';
import { UploadedFile } from 'express-fileupload';
import { enforceMaxRevisions } from '../../revisions/enforceMaxRevisions';
import { Payload } from '../..';
import { Where, Document } from '../../types';
import { Collection } from '../config/types';

import sanitizeInternalFields from '../../utilities/sanitizeInternalFields';
import executeAccess from '../../auth/executeAccess';
import { NotFound, Forbidden, APIError, FileUploadError, ValidationError } from '../../errors';
import isImage from '../../uploads/isImage';
import getImageSize from '../../uploads/getImageSize';
import getSafeFilename from '../../uploads/getSafeFilename';

import resizeAndSave from '../../uploads/imageResizer';
import { FileData } from '../../uploads/types';

import { PayloadRequest } from '../../express/types';
import { hasWhereAccessResult, UserDocument } from '../../auth/types';
import saveBufferToFile from '../../uploads/saveBufferToFile';

export type Arguments = {
  collection: Collection
  req: PayloadRequest
  id: string
  data: Record<string, unknown>
  depth?: number
  disableVerificationEmail?: boolean
  overrideAccess?: boolean
  showHiddenFields?: boolean
  overwriteExistingFiles?: boolean
}

async function update(this: Payload, incomingArgs: Arguments): Promise<Document> {
  const { config } = this;

  let args = incomingArgs;

  // /////////////////////////////////////
  // beforeOperation - Collection
  // /////////////////////////////////////

  await args.collection.config.hooks.beforeOperation.reduce(async (priorHook, hook) => {
    await priorHook;

    args = (await hook({
      args,
      operation: 'update',
    })) || args;
  }, Promise.resolve());

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
    },
    overrideAccess,
    showHiddenFields,
    overwriteExistingFiles = false,
  } = args;

  if (!id) {
    throw new APIError('Missing ID of document to update.', httpStatus.BAD_REQUEST);
  }

  // /////////////////////////////////////
  // Access
  // /////////////////////////////////////

  const accessResults = !overrideAccess ? await executeAccess({ req, id }, collectionConfig.access.update) : true;
  const hasWherePolicy = hasWhereAccessResult(accessResults);

  // /////////////////////////////////////
  // Retrieve document
  // /////////////////////////////////////

  const queryToBuild: { where: Where } = {
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

  if (hasWhereAccessResult(accessResults)) {
    (queryToBuild.where.and as Where[]).push(accessResults);
  }

  const query = await Model.buildQuery(queryToBuild, locale);

  const doc = await Model.findOne(query) as UserDocument;

  if (!doc && !hasWherePolicy) throw new NotFound();
  if (!doc && hasWherePolicy) throw new Forbidden();

  let docWithLocales: Document = doc.toJSON({ virtuals: true });
  docWithLocales = JSON.stringify(docWithLocales);
  docWithLocales = JSON.parse(docWithLocales);

  const originalDoc = await this.performFieldOperations(collectionConfig, {
    id,
    depth: 0,
    req,
    data: docWithLocales,
    hook: 'afterRead',
    operation: 'update',
    overrideAccess: true,
    flattenLocales: true,
    showHiddenFields,
  });

  let { data } = args;

  // /////////////////////////////////////
  // Upload and resize potential files
  // /////////////////////////////////////

  if (collectionConfig.upload) {
    const fileData: Partial<FileData> = {};

    const { staticDir, imageSizes, disableLocalStorage } = collectionConfig.upload;

    let staticPath = staticDir;

    if (staticDir.indexOf('/') !== 0) {
      staticPath = path.resolve(config.paths.configDir, staticDir);
    }

    const file = ((req.files && req.files.file) ? req.files.file : req.file) as UploadedFile;

    if (file) {
      const fsSafeName = !overwriteExistingFiles ? await getSafeFilename(Model, staticPath, file.name) : file.name;

      try {
        if (!disableLocalStorage) {
          await saveBufferToFile(file.data, `${staticPath}/${fsSafeName}`);
        }

        fileData.filename = fsSafeName;
        fileData.filesize = file.size;
        fileData.mimeType = file.mimetype;

        if (isImage(file.mimetype)) {
          const dimensions = await getImageSize(file);
          fileData.width = dimensions.width;
          fileData.height = dimensions.height;

          if (Array.isArray(imageSizes) && file.mimetype !== 'image/svg+xml') {
            req.payloadUploadSizes = {};
            fileData.sizes = await resizeAndSave({
              req,
              file: file.data,
              dimensions,
              staticPath,
              config: collectionConfig,
              savedFilename: fsSafeName,
              mimeType: fileData.mimeType,
            });
          }
        }
      } catch (err) {
        console.error(err);
        throw new FileUploadError();
      }

      data = {
        ...data,
        ...fileData,
      };
    } else if (data.file === null) {
      data = {
        ...data,
        filename: null,
        sizes: null,
      };
    }
  }

  // /////////////////////////////////////
  // beforeValidate - Fields
  // /////////////////////////////////////

  data = await this.performFieldOperations(collectionConfig, {
    data,
    req,
    id,
    originalDoc,
    hook: 'beforeValidate',
    operation: 'update',
    overrideAccess,
  });

  // // /////////////////////////////////////
  // // beforeValidate - Collection
  // // /////////////////////////////////////

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
  // beforeChange - Collection
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
  // beforeChange - Fields
  // /////////////////////////////////////

  let result = await this.performFieldOperations(collectionConfig, {
    data,
    req,
    id,
    originalDoc,
    hook: 'beforeChange',
    operation: 'update',
    overrideAccess,
    unflattenLocales: true,
    docWithLocales,
  });

  // /////////////////////////////////////
  // Handle potential password update
  // /////////////////////////////////////

  const { password } = data;

  if (password) {
    await doc.setPassword(password as string);
    await doc.save();
    delete data.password;
    delete result.password;
  }

  // /////////////////////////////////////
  // Update
  // /////////////////////////////////////

  try {
    result = await Model.findByIdAndUpdate(
      { _id: id },
      result,
      { new: true },
    );
  } catch (error) {
    // Handle uniqueness error from MongoDB
    throw error.code === 11000
      ? new ValidationError([{ message: 'Value must be unique', field: Object.keys(error.keyValue)[0] }])
      : error;
  }

  result = result.toJSON({ virtuals: true });

  // custom id type reset
  result.id = result._id;
  result = JSON.stringify(result);
  result = JSON.parse(result);
  result = sanitizeInternalFields(result);

  // /////////////////////////////////////
  // Create revision from existing doc
  // /////////////////////////////////////

  if (collectionConfig.revisions) {
    const RevisionsModel = this.revisions[collectionConfig.slug];

    const newRevisionData = { ...originalDoc };
    delete newRevisionData.id;

    let revisionCreationPromise;

    try {
      revisionCreationPromise = RevisionsModel.create({
        parent: originalDoc.id,
        revision: originalDoc,
      });
    } catch (err) {
      this.logger.error(`There was an error while saving a revision for the ${collectionConfig.labels.singular} with ID ${originalDoc.id}.`);
    }

    if (collectionConfig.revisions.maxPerDoc) {
      enforceMaxRevisions({
        payload: this,
        Model: RevisionsModel,
        label: collectionConfig.labels.plural,
        entityType: 'collection',
        maxPerDoc: collectionConfig.revisions.maxPerDoc,
        revisionCreationPromise,
      });
    }
  }

  // /////////////////////////////////////
  // afterRead - Fields
  // /////////////////////////////////////

  result = await this.performFieldOperations(collectionConfig, {
    id,
    depth,
    req,
    data: result,
    hook: 'afterRead',
    operation: 'update',
    overrideAccess,
    flattenLocales: true,
    showHiddenFields,
  });

  // /////////////////////////////////////
  // afterRead - Collection
  // /////////////////////////////////////

  await collectionConfig.hooks.afterRead.reduce(async (priorHook, hook) => {
    await priorHook;

    result = await hook({
      req,
      doc: result,
    }) || result;
  }, Promise.resolve());

  // /////////////////////////////////////
  // afterChange - Fields
  // /////////////////////////////////////

  result = await this.performFieldOperations(collectionConfig, {
    data: result,
    hook: 'afterChange',
    operation: 'update',
    req,
    id,
    depth,
    overrideAccess,
    showHiddenFields,
  });

  // /////////////////////////////////////
  // afterChange - Collection
  // /////////////////////////////////////

  await collectionConfig.hooks.afterChange.reduce(async (priorHook, hook) => {
    await priorHook;

    result = await hook({
      doc: result,
      req,
      operation: 'update',
    }) || result;
  }, Promise.resolve());

  // /////////////////////////////////////
  // Return results
  // /////////////////////////////////////

  return result;
}

export default update;
