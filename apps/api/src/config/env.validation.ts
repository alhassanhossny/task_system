type Environment = Record<string, unknown>;

const REQUIRED_ENV_VARS = ["DATABASE_URL", "JWT_SECRET", "SMTP_ENCRYPTION_KEY"] as const;

function readString(config: Environment, key: string): string {
  const value = config[key];

  if (typeof value === "string") {
    return value.trim();
  }

  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function parseNonNegativeInteger(config: Environment, key: string, defaultValue: number, errors: string[]): number {
  const rawValue = readString(config, key);
  const value = rawValue.length > 0 ? rawValue : String(defaultValue);
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    errors.push(`${key} must be a non-negative integer`);
    return defaultValue;
  }

  return parsed;
}

function parsePositiveInteger(config: Environment, key: string, defaultValue: number, errors: string[]): number {
  const parsed = parseNonNegativeInteger(config, key, defaultValue, errors);

  if (parsed <= 0) {
    errors.push(`${key} must be a positive integer`);
    return defaultValue;
  }

  return parsed;
}

function validateDuration(config: Environment, key: string, defaultValue: string, errors: string[]): string {
  const rawValue = readString(config, key);
  const value = rawValue.length > 0 ? rawValue : defaultValue;

  if (!/^\d+(ms|s|m|h|d)$/.test(value)) {
    errors.push(`${key} must use a duration such as 15m, 7d, or 3600s`);
  }

  return value;
}

export function validateEnv(config: Environment): Environment {
  const errors: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    if (!readString(config, key)) {
      errors.push(`${key} is required`);
    }
  }

  const validated: Environment = {
    ...config,
    PORT: parsePositiveInteger(config, "PORT", 4000, errors),
    REDIS_PORT: parsePositiveInteger(config, "REDIS_PORT", 6379, errors),
    REDIS_DB: parseNonNegativeInteger(config, "REDIS_DB", 0, errors),
    JWT_EXPIRES_IN: validateDuration(config, "JWT_EXPIRES_IN", "15m", errors),
    JWT_REFRESH_EXPIRES_IN: validateDuration(config, "JWT_REFRESH_EXPIRES_IN", "7d", errors)
  };

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join("; ")}`);
  }

  return validated;
}
