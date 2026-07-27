import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import type { ComplianceEvent } from '@complyflow/shared';
import type { OtlpExportTraceServiceRequest } from './otlp-types.js';
import { spanToComplianceEvent } from './span-transformer.js';
import { authenticateRequest } from './auth.js';
import { TokenBucketRateLimiter, type RateLimiterOptions } from './rate-limiter.js';

export interface OtlpReceiverOptions {
  port: number;
  host?: string;
  validateApiKey?: (apiKey: string) => boolean;
  onEvents: (tenantId: string, events: ComplianceEvent[]) => void;
  /**
   * Per-tenant rate limiting. Defaults to 1000 events/second with a burst of
   * 2000. Pass `null` to disable rate limiting entirely.
   */
  rateLimitPerTenant?: RateLimiterOptions | null;
}

const DEFAULT_RATE_LIMIT: RateLimiterOptions = {
  tokensPerSecond: 1000,
  burst: 2000,
};

/**
 * HTTP server that receives OTLP/HTTP JSON trace exports and transforms
 * them into ComplianceEvents.
 */
export class OtlpReceiver {
  private server: Server | null = null;
  private options: OtlpReceiverOptions;
  private rateLimiter: TokenBucketRateLimiter | null;

  constructor(options: OtlpReceiverOptions) {
    this.options = options;
    // rateLimitPerTenant === null explicitly disables; undefined uses default
    const rateConfig = options.rateLimitPerTenant === null
      ? null
      : (options.rateLimitPerTenant ?? DEFAULT_RATE_LIMIT);
    this.rateLimiter = rateConfig ? new TokenBucketRateLimiter(rateConfig) : null;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.on('error', reject);
      this.server.listen(this.options.port, this.options.host ?? '0.0.0.0', () => {
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST' || req.url !== '/v1/traces') {
      res.writeHead(404);
      res.end();
      return;
    }

    const auth = authenticateRequest(req, this.options.validateApiKey);
    if (!auth) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing or invalid credentials' }));
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString('utf-8');
        const request: OtlpExportTraceServiceRequest = JSON.parse(body);
        const events = this.extractEvents(request, auth.tenantId);

        if (events.length > 0) {
          // Rate limit: charge one token per event
          if (this.rateLimiter) {
            const result = this.rateLimiter.tryConsume(auth.tenantId, events.length);
            if (!result.allowed) {
              const retrySec = Math.max(1, Math.ceil((result.retryAfterMs ?? 1000) / 1000));
              res.writeHead(429, {
                'Content-Type': 'application/json',
                'Retry-After': String(retrySec),
              });
              res.end(JSON.stringify({ error: 'Rate limit exceeded', retryAfterMs: result.retryAfterMs }));
              return;
            }
          }

          this.options.onEvents(auth.tenantId, events);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ partialSuccess: {} }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid OTLP JSON' }));
      }
    });
  }

  private extractEvents(request: OtlpExportTraceServiceRequest, tenantId: string): ComplianceEvent[] {
    const events: ComplianceEvent[] = [];

    for (const resourceSpans of request.resourceSpans ?? []) {
      for (const scopeSpans of resourceSpans.scopeSpans ?? []) {
        for (const span of scopeSpans.spans ?? []) {
          const event = spanToComplianceEvent(span, resourceSpans.resource, tenantId);
          if (event) {
            events.push(event);
          }
        }
      }
    }

    return events;
  }
}
