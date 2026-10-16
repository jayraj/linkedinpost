/** Central env access — throws early and clearly when a required var is missing. */
export function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${name} (see .env.example)`);
  }
  return v;
}

/** Safety gate: dry-run is ON unless DRY_RUN is explicitly "false". */
export function isDryRun(): boolean {
  return process.env.DRY_RUN !== 'false';
}

export function baseUrl(): string {
  return env('BASE_URL', 'http://localhost:3000').replace(/\/$/, '');
}
