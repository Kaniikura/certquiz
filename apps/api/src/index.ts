import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// TODO: Import routes after implementing features
// import { healthRoute } from './system/health/route';
// import { authRoutes } from './features/auth/routes';
// import { quizRoutes } from './features/quiz/routes';

const app = new Hono();

// Global middleware
app.use('*', cors());
app.use('*', logger());

// TODO: Mount routes
// app.route('/health', healthRoute);
// app.route('/api/auth', authRoutes);
// app.route('/api/quiz', quizRoutes);

// Temporary root route
app.get('/', (c) => {
  return c.json({ 
    message: 'CertQuiz API - VSA Architecture', 
    status: 'ready' 
  });
});

const port = process.env.API_PORT || 4000;

export default {
  port,
  fetch: app.fetch,
};

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Server starting on port ${port}...`);
}