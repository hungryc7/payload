import merge from 'deepmerge';
import { isPlainObject } from 'is-plain-object';
import type { Config, LocalizationConfigWithLabels, LocalizationConfigWithNoLabels, SanitizedConfig, SanitizedLocalizationConfig } from './types';
import { defaultUserCollection } from '../auth/defaultUser';
import sanitizeCollection from '../collections/config/sanitize';
import { InvalidConfiguration } from '../errors';
import sanitizeGlobals from '../globals/config/sanitize';
import checkDuplicateCollections from '../utilities/checkDuplicateCollections';
import { defaults } from './defaults';
import getPreferencesCollection from '../preferences/preferencesCollection';
import { migrationsCollection } from '../database/migrations/migrationsCollection';
import getDefaultBundler from '../bundlers/webpack/bundler';

const sanitizeAdmin = (config: SanitizedConfig): SanitizedConfig['admin'] => {
  const adminConfig = config.admin;

  // add default user collection if none provided
  if (!adminConfig?.user) {
    const firstCollectionWithAuth = config.collections.find(({ auth }) => Boolean(auth));
    if (firstCollectionWithAuth) {
      adminConfig.user = firstCollectionWithAuth.slug;
    } else {
      adminConfig.user = 'users';
      const sanitizedDefaultUser = sanitizeCollection(config, defaultUserCollection);
      config.collections.push(sanitizedDefaultUser);
    }
  }

  if (!config.collections.find(({ slug }) => slug === adminConfig.user)) {
    throw new InvalidConfiguration(`${config.admin.user} is not a valid admin user collection`);
  }

  // add default bundler if none provided
  if (!adminConfig.bundler) {
    adminConfig.bundler = getDefaultBundler();
  }

  return adminConfig;
};

export const sanitizeConfig = (config: Config): SanitizedConfig => {
  const sanitizedConfig: Config = merge(defaults, config, {
    isMergeableObject: isPlainObject,
  }) as Config;

  sanitizedConfig.admin = sanitizeAdmin(sanitizedConfig as SanitizedConfig);

  if (sanitizedConfig.localization && sanitizedConfig.localization.locales?.length > 0) {
    // clone localization config so to not break everything
    const firstLocale = sanitizedConfig.localization.locales[0];
    if (typeof firstLocale === 'string') {
      (sanitizedConfig.localization as SanitizedLocalizationConfig).localeCodes = [...(sanitizedConfig.localization as LocalizationConfigWithNoLabels).locales];

      // is string[], so convert to Locale[]
      (sanitizedConfig.localization as SanitizedLocalizationConfig).locales = (sanitizedConfig.localization as LocalizationConfigWithNoLabels).locales.map((locale) => ({
        label: locale,
        code: locale,
        rtl: false,
        toString: () => locale,
      }));
    } else {
      // is Locale[], so convert to string[] for localeCodes
      (sanitizedConfig.localization as SanitizedLocalizationConfig).localeCodes = (sanitizedConfig.localization as SanitizedLocalizationConfig).locales.reduce((locales, locale) => {
        locales.push(locale.code);
        return locales;
      }, [] as string[]);

      (sanitizedConfig.localization as SanitizedLocalizationConfig).locales = (sanitizedConfig.localization as LocalizationConfigWithLabels).locales.map((locale) => ({
        ...locale,
        toString: () => locale.code,
      }));
    }
  }
  sanitizedConfig.collections.push(getPreferencesCollection(sanitizedConfig));

  sanitizedConfig.collections.push(migrationsCollection);

  sanitizedConfig.collections = sanitizedConfig.collections.map((collection) => sanitizeCollection(sanitizedConfig, collection));
  checkDuplicateCollections(sanitizedConfig.collections);

  if (sanitizedConfig.globals.length > 0) {
    sanitizedConfig.globals = sanitizeGlobals(sanitizedConfig.collections, sanitizedConfig.globals);
  }

  if (typeof sanitizedConfig.serverURL === 'undefined') {
    sanitizedConfig.serverURL = '';
  }

  if (sanitizedConfig.serverURL !== '') {
    sanitizedConfig.csrf.push(sanitizedConfig.serverURL);
  }

  return sanitizedConfig as SanitizedConfig;
};
