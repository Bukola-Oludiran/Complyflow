# Architecture

## Data Flow

```
Customer App + SDK
  │
  │  OTel spans with comply.* attributes
  │  via OTLP/HTTP POST to /v1/traces
  ▼
Ingestion Layer (@complyflow/ingestion)
  │
  │  OtlpReceiver parses OTLP JSON
  │  spanToComplianceEvent() transforms spans → ComplianceEvent
  │  authenticateRequest() validates API key + tenant ID
  ▼
Tenant Manager (@complyflow/graph-builder)
  │
  │  Routes events to the correct tenant's GraphReact scheduler
  │  scheduler.send('ingress-router', eventType, event)
  ▼
IngressNode
  │
  ├─► Forwards events to policy nodes (Layer 1)
  │   via emit() → edge filters route to correct policies
  │
  └─► Builds topology graph (Layer 2)
      Creates svc:* and res:* nodes with edges
      graph.addNode(), graph.addEdge(), graph.updateEdge()
  │
  ▼
Policy Nodes
  │
  ├─ Layer 1 (stateless): evaluate individual events
  │  useMessage('data-access', handler)
  │
  └─ Layer 2 (topology-aware): evaluate graph structure
     useTopology() + useGraphQuery() + allPaths()
  │
  │  emit('violation', {...})
  ▼
ViolationCollectorNode
  │
  │  Aggregates violations, fires per-tenant callback
  │  Callback passed via ctx.props.onViolation
  ▼
ViolationStore (@complyflow/api)
  │
  │  In-memory storage (production: Postgres/SQLite)
  ▼
API Server
  GET /api/v1/violations    — query violations with filters
  GET /api/v1/status        — compliance summary per tenant
  GET /api/v1/graph         — full graph export (Cytoscape.js format)
  GET /api/v1/topology      — service/resource topology only
```

## Package Responsibilities

### @complyflow/shared
Types and constants shared across all packages. No runtime code. Defines:
- `ComplianceEvent` — normalized event flowing through the platform
- `ComplianceViolation` — emitted by policy nodes
- `ServiceNodeAttrs`, `ResourceNodeAttrs`, `TopologyEdgeAttrs` — topology types
- OTel semantic conventions (`comply.*` attribute keys)
- SDK input types (`DataAccessInput`, `AccessControlInput`, `DataFlowInput`)

### @complyflow/sdk
Customer-installed. Thin wrapper around OpenTelemetry. Does NOT depend on GraphReact.
- `comply.init()` — configures OTel provider + OTLP exporter
- `comply.dataAccess()` — creates OTel span with comply.* attributes
- `comply.accessControl()` — records access control decisions
- `comply.dataFlow()` — records service-to-service data flows
- `comply.shutdown()` — flushes pending spans

### @complyflow/ingestion
Receives OTLP/HTTP exports from customer SDKs and transforms them into ComplianceEvents.
- `OtlpReceiver` — HTTP server on `/v1/traces`
- `spanToComplianceEvent()` — extracts comply.* attributes from OTel spans
- `authenticateRequest()` — validates x-complyflow-api-key and x-complyflow-tenant-id headers

### @complyflow/graph-builder
Manages per-tenant GraphReact graph instances. Handles topology auto-discovery.
- `TenantManager` — creates/manages isolated Graph + Scheduler per tenant
- `IngressNode` — entry point: forwards events + builds topology
- `ViolationCollectorNode` — aggregates violations via per-tenant callback
- `EdgeAgingScanner` — periodic scan for stale topology edges
- Service/Resource node helpers — ID conventions, attribute factories

### @complyflow/policy-engine
Compliance policy nodes for 4 frameworks. Each policy is a GraphReact `defineNode()` component.
- `detections/` — shared detection functions used across frameworks
- `frameworks/hipaa/` — 9 policies (6 Layer 1, 3 Layer 2)
- `frameworks/soc2/` — 3 policies
- `frameworks/gdpr/` — 2 policies
- `frameworks/pci-dss/` — 4 policies
- `ALL_POLICIES` — combined array of all 18 policies

### @complyflow/api
REST API server for querying compliance state.
- `ApiServer` — HTTP server with violation, status, graph, and topology endpoints
- `ViolationStore` — in-memory violation storage with query/filter support
- `graphToCytoscapeElements()` — full graph export
- `topologyToCytoscapeElements()` — filtered topology-only export via SubgraphView

## Per-Tenant Graph Topology

Each tenant gets an isolated GraphReact graph:

```
Infrastructure nodes (created at tenant init):
  ingress-router → [policy-nodes] → violation-collector
  edge-aging-scanner (self-driven via timerSource)

Topology nodes (created dynamically from telemetry):
  svc:patient-api ──[accesses]──→ res:postgres:patients
  svc:patient-api ──[flows-to]──→ svc:analytics-pipeline
```

Infrastructure nodes are active GraphReact components with hooks. Topology nodes (svc:*, res:*) are passive graph nodes with attributes — they exist for pathfinding algorithms to traverse.

## Multi-Tenancy Constraint

GraphReact uses module-level hook callbacks (inherited from Preact's architecture). Multiple schedulers in the same thread overwrite each other's callbacks. For MVP, tenants are processed sequentially. For production scale, each tenant's scheduler should run in a separate worker thread, or GraphReact's hooks module should be refactored to use AsyncLocalStorage.

## GraphReact Dependency

GraphReact is consumed as a file: dependency from `../GraphReact/graphreact`. It provides:
- `CommunicationGraph` — multigraph data structure
- `Scheduler` — message queue + processing loop
- `defineNode`, `createGraph`, `addNodeAtRuntime` — graph construction
- `useState`, `useMessage`, `useEmit`, `useTopology`, `useGraphQuery`, `useSource` — hooks
- `allPaths`, `shortestPath` — pathfinding with edge filtering
- `SubgraphView` — filtered graph views
- `toJSON` — graph serialization for API export
