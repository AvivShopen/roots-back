import bodyParser from 'body-parser';
import { isCelebrateError } from 'celebrate';
import { ValidationError } from 'class-validator';
import cors from 'cors';
import { Application, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import apiRoutes from '../api/routes';
import config from '../config';
import { ErrorHandler, handleError } from '../helpers/ErrorHandler';
import Logger from '../logger';
import cookieParser from 'cookie-parser';
import { isUserAuthenticated } from '../api/middlewares/middlewares';

export default (app: Application): void => {
  // Health Check endpoints
  app.get('/status', (req, res) => {
    res.status(200).end();
  });
  app.head('/status', (req, res) => {
    res.status(200).end();
  });
  app.enable('trust proxy');

  // Use Helmet to secure the app by setting various HTTP headers
  app.use(helmet());

  // Middleware that transforms the raw string of req.body into json
  app.use(bodyParser.json());

  app.use(cookieParser());

  const whitelist = [
    'http://localhost',
    'http://127.0.0.1',
    'http://20.82.37.12',
    'http://bhd1roots.com',
  ];

  const corsOptions = {
    origin: function (origin, callback) {
      // If origin is undefined it means its a same-origin request
      if (origin === undefined || whitelist.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  };

  app.use(cors(corsOptions));

  app.use((req, res, next) => {
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
    );
    next();
  });

  app.use(isUserAuthenticated);

  /// Error handlers
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (isCelebrateError(err)) {
      Logger.error('Error: %o', err);
      res.status(400).json({ error: 'Invalid data' }).end();
    } else if (err instanceof Array && err[0] instanceof ValidationError) {
      const messageArr: Array<string> = [];
      let e: ValidationError;
      for (e of err) {
        Object.values(e.constraints).forEach((msg: string) => {
          messageArr.push(msg);
        });
      }
      Logger.error('Error: %o', messageArr);
      res.status(400).json({ errors: messageArr }).end();
    } else if (err.name === 'UnauthorizedError') {
      /**
       * Handle 401 thrown by express-jwt library
       */
      return res.status(401).json({ error: err.message });
    } else {
      next(err);
    }
  });

  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err: ErrorHandler, _req: Request, res: Response, _next: NextFunction) => {
      Logger.error('Error: %o', err.message);
      handleError(err, res);
    }
  );
  // Load API routes
  app.use(`/${config.endpointPrefix}`, apiRoutes);
};
