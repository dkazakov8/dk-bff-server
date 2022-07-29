import serveStatic from 'serve-static';
import express from 'express';

import { TypeMiddleware } from '../../types';
import { errorCodes, compressions, getAcceptedCompression } from '../../utils';

function setContentTypeAndEncoding(params: {
  encoding: typeof compressions[number]['encoding'];
  contentType: 'application/javascript' | 'text/css';
}): express.Handler {
  const { encoding, contentType } = params;

  return (req, res, next) => {
    res.set('Content-Type', contentType);
    res.set('Content-Encoding', encoding);

    return next();
  };
}

const redirectToCompressed: TypeMiddleware = (app) => {
  app.use((req, res, next) => {
    if (req.url.endsWith('.js') || req.url.endsWith('.css')) {
      const acceptedCompression = getAcceptedCompression(req);

      if (acceptedCompression) req.url = `${req.url}.${acceptedCompression!.extension}`;
    }

    next();
  });
};

const setEncodingsForCompressedFiles: TypeMiddleware = (app) => {
  compressions.forEach(({ encoding, extension }) => {
    app.get(
      `*.js.${extension}`,
      setContentTypeAndEncoding({ encoding, contentType: 'application/javascript' })
    );
    app.get(`*.css.${extension}`, setContentTypeAndEncoding({ encoding, contentType: 'text/css' }));
  });
};

export const handleFileRoutes: TypeMiddleware = (app, params) => {
  app.disable('x-powered-by');

  if (params.compressedFilesGenerated) {
    redirectToCompressed(app, params);
    setEncodingsForCompressedFiles(app, params);
  }

  app.use(serveStatic(params.staticFilesPath));

  // Send 404 for all not found files
  app.get('*', (req, res, next) =>
    req.originalUrl.includes('.') ? res.sendStatus(errorCodes.NOT_FOUND) : next()
  );
};
