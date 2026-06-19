import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { config } from './config/index.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
