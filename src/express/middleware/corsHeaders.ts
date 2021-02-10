import { Request, Response, NextFunction } from 'express';
import { Config } from '../../config/types';

export default (config: Config) => (
  (req: Request, res: Response, next: NextFunction) => {
    if (config.cors) {
      res.header('Access-Control-Allow-Methods', 'PUT, POST, GET, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Encoding');

      if (config.cors === '*') {
        res.setHeader('Access-Control-Allow-Origin', '*');
      } else if (Array.isArray(config.cors) && config.cors.indexOf(req.headers.origin) > -1) {
        res.header('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      }
    }

    next();
  });
