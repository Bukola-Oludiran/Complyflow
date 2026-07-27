# Topology (Layer 2)

## Overview

Layer 2 builds a living map of the customer's system from observed telemetry. As compliance events arrive, the IngressNode creates service and resource nodes in the GraphReact graph with edges representing data flows and access patterns.

## How Auto-Discovery Works

When the IngressNode receives events:

**data-access events:**
1. Creates `svc:{serviceName}` node if missing (passive, with ServiceNodeAttrs)
2. Creates `res:{resourceName}` node if missing (passive, with ResourceNodeAttrs)
3. Creates/updates edge between service and resource (type: `accesses`)

**data-flow events:**
1. Creates `svc:{fromService}` node if missing
2. Creates `svc:{toService}` node if missing
3. Creates/updates edge between services (type: `flows-to`)

## Node ID Conventions

- `svc:patient-api` — service node
- `res:postgres:patients` — resource node
- Infrastructure nodes: `ingress-router`, `violation-collector`, `edge-aging-scanner`, policy node IDs

Helper functions in `graph-builder/src/node-definitions/`:
- `makeServiceId(name)` → `svc:${name}`
- `makeResourceId(name)` → `res:${name}`
- `isServiceNode(id)` → checks `svc:` prefix
- `isResourceNode(id)` → checks `res:` prefix

## Node Attributes

**ServiceNodeAttrs:**
```typescript
{
  nodeType: 'service',
  serviceName: string,
  dataClassifications: DataClassification[],  // accumulated from events
  hasAuditLogging: boolean,                   // true if any event had auditLogged
  lastSeen: number,                           // timestamp of last event
  eventCount: number,                         // total events from this service
}
```

**ResourceNodeAttrs:**
```typescript
{
  nodeType: 'resource',
  resourceName: string,
  dataClassifications: DataClassification[],
  encryptionStates: EncryptionState[],        // all observed states
  lastSeen: number,
  accessCount: number,
}
```

## Edge Attributes

**TopologyEdgeAttrs:**
```typescript
{
  edgeType: 'accesses' | 'flows-to',
  dataClassification?: DataClassification,
  encryptionState?: EncryptionState,
  lastSeen: number,
  firstSeen: number,
  accessCount: number,
}
```

## Topology vs Infrastructure Nodes

Topology nodes (`svc:*`, `res:*`) are **passive** — they are plain graph nodes with attributes, not active GraphReact components. They don't have component functions, message handlers, or hooks. They exist so pathfinding algorithms can traverse the topology.

Infrastructure nodes (`ingress-router`, policy nodes, `violation-collector`) are **active** — they are `defineNode()` components that process messages.

## Topology-Aware Policies

Topology-aware policy nodes use:

1. `useTopology()` — react when the graph structure changes (new edges, updated attributes)
2. `useState()` — track a topology version counter to trigger re-queries
3. `useGraphQuery()` — query the graph with pathfinding algorithms

Example: detecting unencrypted PHI paths:

```typescript
useTopology(() => {
  setTopologyVersion(v => v + 1);
}, { types: ['edge-added', 'edge-updated'] });

const violations = useGraphQuery((graph) => {
  // Find PHI resource nodes
  // For each, find all service paths using allPaths()
  // Check edges along each path for plaintext encryption
}, [topologyVersion]);
```

## Edge Aging

The `EdgeAgingScanner` node uses `timerSource(60_000)` to tick every 60 seconds. On each tick, it scans topology edges and flags any where `lastSeen` is older than the staleness threshold (default: 30 minutes).

## GraphReact Features Used

- `graph.addNode()` / `graph.addEdge()` — create topology nodes and edges
- `graph.updateEdge()` — update edge attributes (accessCount, lastSeen)
- `graph.hasNode()` / `graph.hasEdge()` — check existence before creating
- `allPaths(graph, src, tgt, { edgeFilter })` — find paths with attribute filtering
- `useTopology(handler, { types, neighbors })` — react to topology changes
- `SubgraphView` — filter graph to topology-only nodes for API export
- `timerSource()` — periodic edge aging scans

## API Endpoints

- `GET /api/v1/graph` — full graph including infrastructure and topology nodes
- `GET /api/v1/topology` — topology-only (svc:* and res:* nodes with their edges)
