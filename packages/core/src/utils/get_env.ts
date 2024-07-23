export function getEnv(key: string, required: boolean, default_value?: string) {
  const value = process.env[key] || default_value;

  if (!value && required) {
    throw new Error(`Environment variable '${key}' not found`);
  }

  return value;
}
