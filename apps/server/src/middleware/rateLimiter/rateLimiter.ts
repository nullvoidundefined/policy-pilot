/**
 * Exports three pre-configured express-rate-limit instances - general, auth, and chat -
 * with tiered request windows so each route family has an appropriate abuse ceiling.
 */
import rateLimit from 'express-rate-limit';

const RATE_LIMITED_ERROR = 'RATE_LIMITED';

const RATE_LIMITED_MESSAGE = {
  error: RATE_LIMITED_ERROR,
  message: 'Too many requests, please try again later',
};

const AUTH_RATE_LIMITED_MESSAGE = {
  error: RATE_LIMITED_ERROR,
  message: 'Too many authentication attempts, please try again later',
};

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITED_MESSAGE,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: AUTH_RATE_LIMITED_MESSAGE,
});

export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMITED_MESSAGE,
});
