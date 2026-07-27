import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import type { ComplyFlowConfig, DataAccessInput, AccessControlInput, DataFlowInput } from '@complyflow/shared';
import { COMPLY_TENANT_ID } from '@complyflow/shared';
import { setConfig, getConfig, isInitialized } from './config.js';
import { createExporter } from './exporter.js';
import { dataAccess } from './manual/data-access.js';
import { accessControl } from './manual/access-control.js';
import { dataFlow } from './manual/data-flow.js';

let provider: NodeTracerProvider | null = null;

export const comply = {
  /**
   * Initialize the ComplyFlow SDK. Configures OpenTelemetry with the
   * ComplyFlow exporter and sets up the tenant context.
   *
   * Must be called before any other comply.* methods.
   */
  init(config: ComplyFlowConfig): void {
    if (isInitialized()) {
      throw new Error('ComplyFlow SDK already initialized. Call comply.init() only once.');
    }

    setConfig(config);

    const resource = new Resource({
      [ATTR_SERVICE_NAME]: config.serviceName ?? 'unknown-service',
      [COMPLY_TENANT_ID]: config.tenantId,
    });

    provider = new NodeTracerProvider({ resource });
    const exporter = createExporter(config);
    provider.addSpanProcessor(new BatchSpanProcessor(exporter));
    provider.register();
  },

  /**
   * Record a data access event (read/write/delete to a resource).
   */
  dataAccess(input: DataAccessInput): void {
    getConfig(); // throws if not initialized
    dataAccess(input);
  },

  /**
   * Record an access control decision (granted/denied).
   */
  accessControl(input: AccessControlInput): void {
    getConfig();
    accessControl(input);
  },

  /**
   * Record a data flow between services or resources.
   */
  dataFlow(input: DataFlowInput): void {
    getConfig();
    dataFlow(input);
  },

  /**
   * Gracefully shut down the SDK, flushing any pending spans.
   */
  async shutdown(): Promise<void> {
    if (provider) {
      await provider.shutdown();
      provider = null;
    }
  },
};

export type { ComplyFlowConfig, DataAccessInput, AccessControlInput, DataFlowInput };
