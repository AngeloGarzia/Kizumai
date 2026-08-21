import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { container } from './container/index.js';
import { createApiRouter } from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { csrfProtection } from './middleware/csrf.js';
import { sanitizeRequestObjects } from './middleware/sanitizeInput.js';
import { config } from './config/index.js';

const app = express();

app.disable('x-powered-by');

const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === 'false' || trustProxy === '0') {
  app.set('trust proxy', false);
} else if (trustProxy && /^\d+$/.test(trustProxy)) {
  app.set('trust proxy', Number(trustProxy));
} else if (trustProxy) {
  app.set('trust proxy', trustProxy);
} else {
  // Par défaut : 1 hop uniquement si un reverse-proxy est attendu.
  // Sans proxy qui réécrit X-Forwarded-For, spoofable — documenté dans security-ops.
  app.set('trust proxy', config.isProd ? 1 : false);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: config.isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  })
);

app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  next();
});

app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
    maxAge: 600,
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());
app.use(sanitizeRequestObjects);
app.use('/api', csrfProtection);

app.use('/api', createApiRouter(container));

app.use(notFound);
app.use(errorHandler);

export default app;
