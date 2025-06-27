import { z } from 'zod';

// Environment variable schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  
  // Authentication
  KEYCLOAK_URL: z.string().url(),
  KEYCLOAK_REALM: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  
  // External services
  BMAC_WEBHOOK_SECRET: z.string().min(1),
  
  // Server configuration
  API_PORT: z.string().default('4000').transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val < 65536, {
      message: 'API_PORT must be a valid port number',
    }),
  
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Frontend URL (optional)
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
});

export type EnvConfig = z.infer<typeof envSchema> & {
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
};

// Result type for validation
type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: Error };

/**
 * Validates environment variables against the schema
 * @returns Validation result with parsed config or error
 */
export function validateEnv(): ValidationResult<z.infer<typeof envSchema>> {
  try {
    const parsed = envSchema.parse(process.env);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = `Invalid environment variables:\n${error.errors
        .map((err) => `  ${err.path.join('.')}: ${err.message}`)
        .join('\n')}`;
      return { success: false, error: new Error(errorMessage) };
    }
    return { success: false, error: error as Error };
  }
}

/**
 * Loads and validates environment configuration
 * @throws Error if validation fails
 * @returns Validated environment configuration with helper flags
 */
export function loadEnv(): EnvConfig {
  const result = validateEnv();
  
  if (!result.success) {
    throw result.error;
  }
  
  const { NODE_ENV } = result.data;
  
  return {
    ...result.data,
    isDevelopment: NODE_ENV === 'development',
    isProduction: NODE_ENV === 'production',
    isTest: NODE_ENV === 'test',
  };
}

// Export a singleton instance of the configuration
let cachedConfig: EnvConfig | null = null;

/**
 * Gets the cached environment configuration
 * @returns Cached or newly loaded configuration
 */
export function getEnv(): EnvConfig {
  if (!cachedConfig) {
    cachedConfig = loadEnv();
  }
  return cachedConfig;
}

// Type-safe environment variable access
export const env = new Proxy({} as EnvConfig, {
  get(_, prop) {
    const config = getEnv();
    return config[prop as keyof EnvConfig];
  },
});