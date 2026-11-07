/**
 * Unified error hierarchy for GraphReact.
 */

/** Base error for all GraphReact errors */
export class GraphReactError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphReactError';
  }
}

/** Graph structure errors (missing nodes, edges, etc.) */
export class GraphError extends GraphReactError {
  constructor(message: string) {
    super(message);
    this.name = 'GraphError';
  }
}

/** Runtime errors (scheduling, message delivery, hooks) */
export class RuntimeError extends GraphReactError {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeError';
  }
}

/** Max processing depth exceeded — likely infinite message loop */
export class MaxProcessingDepthError extends RuntimeError {
  constructor(depth: number) {
    super(
      `Max processing depth (${depth}) reached. ` +
      'Possible infinite message loop. Check TTL settings and node logic.'
    );
    this.name = 'MaxProcessingDepthError';
  }
}

/** Permission violation — node tried to accept/emit unauthorized message */
export class PermissionError extends RuntimeError {
  nodeId: string;
  messageType: string;

  constructor(nodeId: string, messageType: string, direction: 'accept' | 'emit') {
    super(`Node '${nodeId}' is not permitted to ${direction} message type '${messageType}'`);
    this.name = 'PermissionError';
    this.nodeId = nodeId;
    this.messageType = messageType;
  }
}

/** Validation errors caught at graph build time */
export class ValidationError extends GraphReactError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
