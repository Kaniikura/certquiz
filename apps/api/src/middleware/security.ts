import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';

/**
 * Security middleware that applies CORS and security headers
 *
 * Configures:
 * - CORS for frontend access
 * - Security headers (CSP, X-Frame-Options, etc.)
 * - HSTS for production
 *
 * @example
 * ```typescript
 * app.use('*', useSecurity());
 * ```
 */
export const securityMiddleware = () =>
  createMiddleware(async (c, next) => {
    // Apply CORS first
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const isDevelopment = process.env.NODE_ENV === 'development';

    await cors({
      origin: isDevelopment
        ? [
            frontendUrl,
            'http://localhost:5173', // SvelteKit dev server
            'http://localhost:4173', // SvelteKit preview
          ]
        : [frontendUrl],
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['X-Request-ID'],
      maxAge: 86400, // 24 hours
    })(c, async () => {
      // Then apply security headers
      await secureHeaders({
        contentSecurityPolicy:
          process.env.NODE_ENV === 'production'
            ? {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for now
                styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
              }
            : undefined, // Disable CSP in development
        strictTransportSecurity:
          process.env.NODE_ENV === 'production'
            ? 'max-age=31536000; includeSubDomains; preload'
            : false,
        xContentTypeOptions: 'nosniff',
        xFrameOptions: 'DENY',
        xXssProtection: '0',
      })(c, next);
    });
  });
