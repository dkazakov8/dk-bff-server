import fs from 'fs';

import {
  errorCodes,
  errorsNames,
  createMeasure,
  measuresServer,
  getAcceptedCompression,
} from '../../utils';
import { TypeMiddleware } from '../../types';

export const handlePageRoutes: TypeMiddleware = (app, params) => {
  const template = fs.readFileSync(params.templatePath, 'utf-8');

  app.get('*', (req, res) => {
    const reqExtended: typeof req & { measure: ReturnType<typeof createMeasure> } = req as any;

    /**
     * Create clear store for each request
     *
     */

    Promise.resolve()
      .then(reqExtended.measure.wrap(measuresServer.MIDDLEWARES))

      .then(reqExtended.measure.wrap(measuresServer.RENDER))
      .then(() => {
        if (!params.compressedFilesGenerated) return template;

        /**
         * Brotli is supported on HTTPS & localhost websites only
         *
         */

        const acceptedCompression = getAcceptedCompression(req);

        if (!acceptedCompression) return template;

        return template
          .replace(/(\.js)"/g, `$1.${acceptedCompression.extension}"`)
          .replace(/(\.css)"/g, `$1.${acceptedCompression.extension}"`);
      })
      .then((modTemplate) => params.templateModifier?.({ template: modTemplate }) || modTemplate)
      .then(reqExtended.measure.wrap(measuresServer.RENDER))

      .then(reqExtended.measure.wrap(measuresServer.FULL_TIME))
      .then(
        (modTemplate) =>
          params.injectMeasures?.({
            template: modTemplate,
            measures: reqExtended.measure.getMeasures(),
          }) || modTemplate
      )
      .then((modTemplate) => res.send(modTemplate))
      .catch((error) => {
        /**
         * SILENT & REDIRECT errors are predictable, no logging
         *
         */

        if (error.name === errorsNames.SILENT) {
          return Promise.resolve();
        } else if (error.name === errorsNames.REDIRECT) {
          // eslint-disable-next-line no-console
          console.log('redirect', error.message);

          return res.redirect(error.message);
        }

        /**
         * Errors here are destroying: they may come from creating new store
         * or rendering page to markup, so no chance to draw beautiful error page.
         *
         * TODO?: create static html page for this case
         *
         */

        console.error(error);

        res.status(errorCodes.INTERNAL_ERROR);
        res.send('Unpredictable error');

        return Promise.resolve();
      });
  });
};
