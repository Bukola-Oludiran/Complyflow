import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock OTel before importing SDK
const mockSpan = {
  setAttribute: vi.fn(),
  end: vi.fn(),
};

const mockTracer = {
  startSpan: vi.fn(() => mockSpan),
};

vi.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: () => mockTracer,
  },
}));

vi.mock('@opentelemetry/sdk-trace-node', () => ({
  NodeTracerProvider: vi.fn().mockImplementation(() => ({
    addSpanProcessor: vi.fn(),
    register: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
  BatchSpanProcessor: vi.fn(),
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn(),
}));

vi.mock('@opentelemetry/resources', () => ({
  Resource: vi.fn(),
}));

vi.mock('@opentelemetry/semantic-conventions', () => ({
  ATTR_SERVICE_NAME: 'service.name',
}));

describe('@complyflow/sdk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state between tests
    vi.resetModules();
  });

  describe('comply.dataAccess()', () => {
    it('creates a span with comply.* attributes', async () => {
      // Re-import to get fresh module state after resetModules
      const { comply } = await import('../index.js');

      comply.init({
        apiKey: 'test-key',
        tenantId: 'tenant-123',
        endpoint: 'http://localhost:4318',
        serviceName: 'test-service',
      });

      comply.dataAccess({
        resource: 'postgres:patients.ssn',
        action: 'read',
        dataClassification: 'PHI',
        actor: { userId: 'user-1', role: 'nurse' },
        encrypted: true,
      });

      expect(mockTracer.startSpan).toHaveBeenCalledWith('comply.data-access');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.event_type', 'data-access');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.resource', 'postgres:patients.ssn');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.action', 'read');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.data_class', 'PHI');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.actor.user_id', 'user-1');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.actor.role', 'nurse');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.encryption_state', 'encrypted');
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('comply.accessControl()', () => {
    it('creates a span for access control decisions', async () => {
      const { comply } = await import('../index.js');

      comply.init({
        apiKey: 'test-key',
        tenantId: 'tenant-123',
        endpoint: 'http://localhost:4318',
      });

      comply.accessControl({
        resource: 'admin-panel',
        actor: { userId: 'user-2', role: 'admin' },
        granted: true,
        method: 'rbac',
        mfaVerified: true,
      });

      expect(mockTracer.startSpan).toHaveBeenCalledWith('comply.access-control');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.event_type', 'access-control');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.resource', 'admin-panel');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.access.granted', true);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.access.method', 'rbac');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.access.mfa_verified', true);
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('comply.dataFlow()', () => {
    it('creates a span for data flow events', async () => {
      const { comply } = await import('../index.js');

      comply.init({
        apiKey: 'test-key',
        tenantId: 'tenant-123',
        endpoint: 'http://localhost:4318',
      });

      comply.dataFlow({
        from: 'patient-api',
        to: 'analytics-pipeline',
        dataClassification: 'PHI',
        transformed: true,
        transformationType: 'k-anonymity',
        encrypted: false,
      });

      expect(mockTracer.startSpan).toHaveBeenCalledWith('comply.data-flow');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.event_type', 'data-flow');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.flow.from', 'patient-api');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.flow.to', 'analytics-pipeline');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.data_class', 'PHI');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.flow.transformed', true);
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.flow.transformation_type', 'k-anonymity');
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('comply.encryption_state', 'plaintext');
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });
});
