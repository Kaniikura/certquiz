// place files you want to import through the `$lib` alias in this folder.

export type { ApiResponse, HealthResponse } from './api/client';
// Re-export API client utilities for use throughout the app
export { ApiError, api, createAuthenticatedFetch, handleApiResponse } from './api/client';
