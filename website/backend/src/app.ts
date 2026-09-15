import express from 'express';
import helmet from 'helmet';
import { config } from './lib/config.js';
import { AppError } from './lib/errors.js';
import { errorHandler } from './middleware/error-handler.js';
import { apiRoutes } from './routes/api-routes.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY === 'loopback' ? 'loopback' : false);
app.use(helmet());
app.use(express.json({ limit: '16kb' }));
app.use('/api', apiRoutes);
app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Không tìm thấy API.')));
app.use(errorHandler);
