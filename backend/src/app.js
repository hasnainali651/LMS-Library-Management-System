const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes');

const app = express();

// Security headers with CSP, HSTS, noSniff, referrerPolicy
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'covers.openlibrary.org', 'books.google.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    referrerPolicy: { policy: 'same-origin' },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Request logging
const logFormat = ':method :url :status :res[content-length] - :response-time ms :remote-addr';
if (process.env.NODE_ENV === 'production') {
  const logDirectory = path.resolve(__dirname, '../logs');
  fs.mkdirSync(logDirectory, { recursive: true });
  const accessLogStream = fs.createWriteStream(path.join(logDirectory, 'access.log'), { flags: 'a' });
  accessLogStream.on('error', () => console.error('Unable to write HTTP access log'));
  app.use(morgan(logFormat, { stream: accessLogStream }));
} else {
  app.use(morgan(logFormat));
}

// Response compression
app.use(compression());

// Body parsers with 10mb limit and cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Sanitize middleware: strips HTML/null bytes & blocks NoSQL operator injection
const sanitize = require('./middleware/sanitize');
app.use(sanitize);

// Static directory for uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Global rate limiter: 100 requests per 15 minutes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || req.path === '/api/v1/health' || req.path === '/',
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
    errors: [],
  },
});
app.use(globalLimiter);

// Specific Rate Limiters:
// 1. /auth/login: 10 requests / 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    errors: [],
  },
});
app.use(['/api/v1/auth/login', '/api/auth/login'], loginLimiter);

// 2. /auth/register: 5 requests / hour
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Too many account registrations. Please try again after 1 hour.',
    errors: [],
  },
});
app.use(['/api/v1/auth/register', '/api/auth/register'], registerLimiter);

// 3. /ai/*: 20 requests / hour
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Too many AI requests. Please try again after 1 hour.',
    errors: [],
  },
});
app.use(['/api/v1/ai', '/api/ai'], aiLimiter);

// 4. /search/autocomplete: 60 requests / minute
const autocompleteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Search autocomplete rate limit exceeded. Please wait a moment.',
    errors: [],
  },
});
app.use(['/api/v1/search/autocomplete', '/api/search/autocomplete'], autocompleteLimiter);

// Mount all routes at /api/v1
app.use('/api/v1', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Library Management System API is running',
    version: 'v1',
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    errors: [],
  });
});

// Global error handler: { success: false, message, errors, stack(dev only) }
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const response = {
    success: false,
    message: err.message || 'Internal Server Error',
    errors: err.errors || [],
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

module.exports = app;
