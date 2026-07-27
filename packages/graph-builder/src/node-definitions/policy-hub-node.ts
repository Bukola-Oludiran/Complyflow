import { defineNode, useMessage, useEmit } from 'graphreact';

/**
 * PolicyHubNode — fan-out node that distributes compliance events
 * to all connected policy evaluator nodes.
 *
 * Connected to the ingress node (receives events) and to each
 * policy node (forwards events via edge filters).
 */
export const PolicyHubNode = defineNode('PolicyHubNode', () => {
  const emit = useEmit();

  useMessage('data-access', (msg) => {
    emit('data-access', msg.payload);
  });

  useMessage('access-control', (msg) => {
    emit('access-control', msg.payload);
  });

  useMessage('data-flow', (msg) => {
    emit('data-flow', msg.payload);
  });

  useMessage('encryption', (msg) => {
    emit('encryption', msg.payload);
  });

  useMessage('audit-log', (msg) => {
    emit('audit-log', msg.payload);
  });

  return {
    accepts: ['data-access', 'access-control', 'data-flow', 'encryption', 'audit-log'],
    emits: ['data-access', 'access-control', 'data-flow', 'encryption', 'audit-log'],
  };
});
