/**
 * sets request locale
 *
 * @param localization
 * @returns {Function}
 */
module.exports = function localizationMiddleware(localization) {
  const middleware = (req, res, next) => {
    const validLocales = [...localization.locales, 'all'];
    const validFallbackLocales = [...localization.locales, 'null'];

    let requestedLocale = req.query.locale;
    let requestedFallbackLocale = req.query['fallback-locale'];

    if (req.body) {
      if (req.body.locale) requestedLocale = req.body.locale;
      if (req.body['fallback-locale']) requestedFallbackLocale = req.body['fallback-locale'];
    }

    if (requestedFallbackLocale === 'none') requestedFallbackLocale = 'null';
    if (requestedLocale === '*' || requestedLocale === 'all') requestedLocale = 'all';

    if (validLocales.find(locale => locale === requestedLocale)) {
      req.locale = requestedLocale;
    }

    if (validFallbackLocales.find(locale => locale === requestedFallbackLocale)) {
      req.fallbackLocale = requestedFallbackLocale;
    }

    return next();
  };

  return middleware;
};
