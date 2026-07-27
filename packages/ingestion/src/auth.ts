import type { IncomingMessage } from 'http';

export interface AuthResult {
  tenantId: string;
  apiKey: string;
}

/**
 * Extract and validate auth credentials from request headers.
 * Returns null if credentials are missing or invalid.
 */
export function authenticateRequest(
  req: IncomingMessage,
  validateApiKey?: (apiKey: string) => boolean,
): AuthResult | null {
  const apiKey = req.headers['x-complyflow-api-key'] as string | undefined;
  const tenantId = req.headers['x-complyflow-tenant-id'] as string | undefined;

  if (!apiKey || !tenantId) {
    return null;
  }

  if (validateApiKey && !validateApiKey(apiKey)) {
    return null;
  }

  return { tenantId, apiKey };
}
