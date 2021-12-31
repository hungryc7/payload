import find from './find';
import findByID from './findByID';
import create from './create';
import update from './update';
import localDelete from './delete';
import auth from '../../../auth/operations/local';
import findVersionByID from './findVersionByID';
import findVersions from './findVersions';
import publishVersion from './publishVersion';

export default {
  find,
  findByID,
  create,
  update,
  localDelete,
  auth,
  findVersionByID,
  findVersions,
  publishVersion,
};
