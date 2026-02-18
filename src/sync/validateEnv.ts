// validateEnv: fail-fast config/env validation
export interface RequiredEnv {
  NODE_ENV: string;
  // extend with API_KEY, other config as needed
}

export function validateEnv(env: NodeJS.ProcessEnv = process.env): RequiredEnv {
  const errors: string[] = [];
  if (!env.NODE_ENV) errors.push('Missing NODE_ENV');
  // Add other checks as project needs
  if (errors.length) {
    const msg = `Startup failed due to config errors:\n${errors.join('\n')}`;
    // Structure log (future: replace with logger)
    console.error(JSON.stringify({ type: 'config-error', errors, at: 'validateEnv' }));
    throw new Error(msg);
  }
  return {
    NODE_ENV: env.NODE_ENV!,
    // Add other env/config fields here
  };
}
