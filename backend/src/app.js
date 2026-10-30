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

// Token Bucket Rate Limiting (Token Bucket Algorithm protecting every single route)
const { createTokenBucketLimiter } = require('./middleware/tokenBucketRateLimiter');

// 1. Global Token Bucket: protects every single route across the application
// Capacity: 120 tokens (burst limit), Refill: 2 tokens/sec (120/min continuous replenishment)
const globalTokenBucket = createTokenBucketLimiter({
  bucketName: 'global',
  capacity: 120,
  refillRate: 2,
  cost: 1,
  message: 'Too many requests. Global token bucket capacity exceeded. Please retry in a few moments.',
});
app.use(globalTokenBucket);

// 2. Authentication Token Bucket: protects ALL auth endpoints (/api/v1/auth/*)
// Capacity: 20 tokens (well above 5 for user convenience), Refill: 1 token every 15 seconds (~4/min)
const authTokenBucket = createTokenBucketLimiter({
  bucketName: 'auth',
  capacity: 20,
  refillRate: 0.067, // 1 token per 15s
  cost: 1,
  message: 'Too many authentication attempts. Auth token bucket depleted. Please try again after a brief cooldown.',
});
app.use(['/api/v1/auth', '/api/auth'], authTokenBucket);

// 3. AI Exploration Token Bucket: protects /ai/* endpoints
// Capacity: 30 tokens, Refill: 1 token every 10 seconds (0.1/s)
const aiTokenBucket = createTokenBucketLimiter({
  bucketName: 'ai',
  capacity: 30,
  refillRate: 0.1,
  cost: 1,
  message: 'Too many AI requests. AI token bucket limit reached. Please wait before generating more summaries.',
});
app.use(['/api/v1/ai', '/api/ai'], aiTokenBucket);

// 4. Search Autocomplete Token Bucket: protects /search/autocomplete
// Capacity: 60 tokens, Refill: 1 token/sec (60/min)
const autocompleteTokenBucket = createTokenBucketLimiter({
  bucketName: 'search_autocomplete',
  capacity: 60,
  refillRate: 1,
  cost: 1,
  message: 'Search autocomplete token bucket exceeded. Please slow down keystroke queries.',
});
app.use(['/api/v1/search/autocomplete', '/api/search/autocomplete'], autocompleteTokenBucket);

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
