import { defineNode, useMessage, useState } from 'graphreact';
import type { ComplianceViolation } from '@complyflow/shared';

/**
 * ViolationCollectorNode — aggregates violations emitted by policy nodes.
 *
 * The onViolation callback is passed via node props (per-tenant isolation).
 * Each tenant's ViolationCollectorNode gets its own callback closure.
 */

export type ViolationCallback = (violation: ComplianceViolation) => void;

export const ViolationCollectorNode = defineNode('ViolationCollectorNode', (ctx) => {
  const [violations, setViolations] = useState<ComplianceViolation[]>([]);
  const onViolation = ctx.props.onViolation as ViolationCallback | undefined;

  useMessage('violation', (msg) => {
    const violation = msg.payload as ComplianceViolation;
    setViolations(prev => [...prev, violation]);

    if (onViolation) {
      onViolation(violation);
    }
  });

  return {
    accepts: ['violation'],
    emits: [],
  };
});
