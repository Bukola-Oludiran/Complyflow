/**
 * Typed attribute interfaces for nodes and edges in the CommunicationGraph.
 */

import type { NodeAttributes, EdgeAttributes } from '../types.js';

/** Node attributes specific to GraphReact (beyond arbitrary user data) */
export interface GraphReactNodeAttributes extends NodeAttributes {
  /** The component type name this node was created from */
  component?: string;
}

/** Edge attributes specific to GraphReact communication channels */
export interface GraphReactEdgeAttributes extends EdgeAttributes {
  /** Named channel for multi-edge disambiguation */
  channel?: string;
  /** Message type filter: only these types allowed on this edge */
  filter?: string[];
  /** TTL override for messages on this edge */
  ttl?: number;
  /** Numeric weight (used by transforms like multiply-weight) */
  weight?: number;
  /** Delivery priority (higher = delivered first) */
  priority?: number;
  /** Max messages per second on this edge */
  rateLimit?: number;
  /** Named transform to apply to messages in transit */
  transform?: string;
}
