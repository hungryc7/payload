import { toWords } from '../../utilities/formatLabels';
import { CollectionConfig } from '../../collections/config/types';
import sanitizeFields from '../../fields/config/sanitize';
import { GlobalConfig, SanitizedGlobalConfig } from './types';
import defaultAccess from '../../auth/defaultAccess';

const sanitizeGlobals = (collections: CollectionConfig[], globals: GlobalConfig[]): SanitizedGlobalConfig[] => {
  const sanitizedGlobals = globals.map((global) => {
    const sanitizedGlobal = { ...global };

    sanitizedGlobal.label = sanitizedGlobal.label || toWords(sanitizedGlobal.slug);

    // /////////////////////////////////
    // Ensure that collection has required object structure
    // /////////////////////////////////

    if (!sanitizedGlobal.hooks) sanitizedGlobal.hooks = {};
    if (!sanitizedGlobal.access) sanitizedGlobal.access = {};
    if (!sanitizedGlobal.admin) sanitizedGlobal.admin = {};

    if (!sanitizedGlobal.access.read) sanitizedGlobal.access.read = defaultAccess;
    if (!sanitizedGlobal.access.update) sanitizedGlobal.access.update = defaultAccess;

    if (!sanitizedGlobal.hooks.beforeValidate) sanitizedGlobal.hooks.beforeValidate = [];
    if (!sanitizedGlobal.hooks.beforeChange) sanitizedGlobal.hooks.beforeChange = [];
    if (!sanitizedGlobal.hooks.afterChange) sanitizedGlobal.hooks.afterChange = [];
    if (!sanitizedGlobal.hooks.beforeRead) sanitizedGlobal.hooks.beforeRead = [];
    if (!sanitizedGlobal.hooks.afterRead) sanitizedGlobal.hooks.afterRead = [];

    // /////////////////////////////////
    // Sanitize fields
    // /////////////////////////////////

    const validRelationships = collections.map((c) => c.slug);
    sanitizedGlobal.fields = sanitizeFields(global.fields, validRelationships);

    return sanitizedGlobal as SanitizedGlobalConfig;
  });

  return sanitizedGlobals;
};

export default sanitizeGlobals;
