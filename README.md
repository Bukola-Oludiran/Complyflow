# ComplyFlow

**Continuous compliance monitoring from application telemetry.** Your application reports how it handles sensitive data through OpenTelemetry. ComplyFlow checks each event against HIPAA, SOC 2, GDPR, and PCI DSS rules, maps how your services and data stores connect, and reports violations with their regulatory citations.

Compliance reviews usually happen once a year, from questionnaires and screenshots. ComplyFlow watches what the code actually does, so a service that reads patient records without a user ID shows up the moment it happens.

> [!NOTE]
> ComplyFlow is experimental software and is not compliance certification or legal advice. It produces evidence for your compliance team and auditors to evaluate.

## How it works

```mermaid
flowchart LR
    app[Your application + SDK] -- OpenTelemetry spans --> ingest[OTLP ingestion]
    ingest --> graph[Tenant graph]
    graph --> event[Event checks]
    graph --> topo[Topology checks]
    event --> store[Violation store]
    topo --> store
    store --> api[REST API]
    graph --> api
    api --> dash[Dashboard]
```

Each tenant gets its own isolated graph. Incoming events update a map of which services touch which data stores, and two kinds of policy run against it:

- **Event checks** look at a single action. *Was this read of patient data tied to a user? Was it encrypted? Was it logged?*
- **Topology checks** look at the map as a whole. *Does any service reach patient data without audit logging? Does patient data flow anywhere unencrypted?*

ComplyFlow sees metadata about data access, such as the resource, data class, actor, and encryption state. It never receives the data itself.

## Features

- **18 policies:** 9 for HIPAA, 4 for PCI DSS, 3 for SOC 2, and 2 for GDPR, each citing its rule (for example, HIPAA §164.312(b)).
- **OpenTelemetry ingestion:** accepts standard OTLP/HTTP JSON trace exports, with per-tenant rate limiting.
- **Topology discovery:** builds a live map of services, data stores, and data flows from the events themselves.
- **Tenant isolation:** keeps each tenant's graph, policies, and violations separate.
- **REST API:** query violations by framework, severity, service, or resource, and export the graph.
- **Dashboard:** shows the live topology and violations in a React and Cytoscape.js interface.
- **SDK:** adds compliance events to a Node.js application with calls like `comply.dataAccess()`.

## Quick start

This walkthrough starts ComplyFlow locally, sends it a non-compliant event, and shows the violations it finds.

### Prerequisites

- [Node.js](https://nodejs.org) (tested with version 26) and npm
- [`jq`](https://jqlang.org) (optional, to shorten API output)

### Install and test

```sh
git clone https://github.com/Bukola-Oludiran/Complyflow.git
cd Complyflow
npm install
npm test
```

```text
 Test Files  35 passed (35)
      Tests  300 passed (300)
```

### Start the server

```sh
npm run dev
```

```text
ComplyFlow Dev Server
  OTLP ingestion: http://127.0.0.1:4318/v1/traces
  REST API:       http://127.0.0.1:3000/api/v1/
  Policies:       18 (HIPAA, SOC 2, GDPR, PCI-DSS)
  Auto-provisioning tenants on first request
```

### Send an event

In a second terminal, report a read of patient records that has no user attached, isn't encrypted, and isn't logged:

```sh
curl -s http://127.0.0.1:4318/v1/traces \
  -H 'content-type: application/json' \
  -H 'x-complyflow-api-key: local-dev-key' \
  -H 'x-complyflow-tenant-id: demo' \
  --data @- <<'EOF'
{"resourceSpans": [{
  "resource": {"attributes": [
    {"key": "service.name", "value": {"stringValue": "patient-portal"}}]},
  "scopeSpans": [{"spans": [{
    "traceId": "demo-trace-1", "spanId": "demo-span-1", "name": "comply.data-access",
    "startTimeUnixNano": "1700000000000000000", "endTimeUnixNano": "1700000001000000000",
    "attributes": [
      {"key": "comply.event_type", "value": {"stringValue": "data-access"}},
      {"key": "comply.resource", "value": {"stringValue": "postgres:patients.medical_records"}},
      {"key": "comply.action", "value": {"stringValue": "read"}},
      {"key": "comply.data_class", "value": {"stringValue": "PHI"}},
      {"key": "comply.encryption_state", "value": {"stringValue": "plaintext"}}
    ]}]}]}]}
EOF
```

The server accepts it with `{"partialSuccess":{}}`, the standard OTLP success response.

### See the violations

Get the tenant's summary:

```sh
curl -s http://127.0.0.1:3000/api/v1/status -H 'x-complyflow-tenant-id: demo' | jq .violations
```

```json
{
  "total": 11,
  "byFramework": {
    "HIPAA": 5,
    "SOC2": 3,
    "GDPR": 3
  },
  "bySeverity": {
    "critical": 2,
    "high": 9
  }
}
```

Then list the HIPAA findings:

```sh
curl -s 'http://127.0.0.1:3000/api/v1/violations?framework=HIPAA' \
  -H 'x-complyflow-tenant-id: demo' |
  jq -r '.violations[] | "\(.severity)\t\(.ruleId)\t\(.title)"'
```

```text
critical	164.312.e.1.topology	Unencrypted ePHI transmission path detected
high	164.312(b)	Service accesses PHI without audit logging
critical	164.312(a)(2)(i)	ePHI accessed without unique user identification
high	164.312(b)	ePHI access not audit-logged
high	164.312(a)(2)(iv)	ePHI accessed without encryption
```

The first two come from topology checks on the map. The other three come from event checks on this single read.

### Open the dashboard

With the server still running, start the dashboard in another terminal:

```sh
npm install --prefix dashboard
VITE_DEFAULT_TENANT_ID=demo npm run dev --prefix dashboard
```

Open http://localhost:5173 to see the topology and the same 11 violations. The dashboard's development server forwards `/api` requests to the API on port 3000.

## Instrument an application

The SDK in [`packages/sdk`](packages/sdk) wraps OpenTelemetry. Initialize it once, then report each sensitive operation:

```ts
import { comply } from '@complyflow/sdk';

comply.init({
  apiKey: 'local-dev-key',
  tenantId: 'demo',
  endpoint: 'http://127.0.0.1:4318',
  serviceName: 'billing-api',
});

comply.dataAccess({
  resource: 'postgres:payments.cards',
  action: 'read',
  dataClassification: 'PCI',
  actor: { userId: 'u-42', role: 'support' },
  encrypted: false,
});

await comply.shutdown(); // flushes pending events
```

This read is tied to a user but unencrypted and not logged, so it raises PCI DSS Req 3.5 and Req 10.2 and two SOC 2 findings. The SDK also provides `comply.accessControl()` and `comply.dataFlow()`. See the [SDK guide](docs/sdk/getting-started.md) and [API reference](docs/sdk/api-reference.md).

The SDK isn't published to npm yet, so use it from within this workspace.

## API reference

Every request needs an `x-complyflow-tenant-id` header. Ingestion also needs an `x-complyflow-api-key` header.

| Endpoint | Purpose |
|---|---|
| `POST :4318/v1/traces` | Ingest an OTLP/HTTP JSON trace export |
| `GET :3000/api/v1/status` | Get violation totals by framework and severity |
| `GET :3000/api/v1/violations` | List violations. Filter with `framework` (`HIPAA`, `SOC2`, `GDPR`, `PCI-DSS`), `severity`, `service`, or `resource`, and page with `limit` (default 100) and `offset`. |
| `GET :3000/api/v1/topology` | Get the discovered services, data stores, and flows as Cytoscape.js elements |
| `GET :3000/api/v1/graph` | Get the tenant's full graph, including policy nodes |

## Configuration

The server reads these environment variables. It doesn't load `.env` files, so set them in your shell.

| Variable | Default | Purpose |
|---|---|---|
| `COMPLYFLOW_OTLP_PORT` | `4318` | Ingestion port |
| `COMPLYFLOW_API_PORT` | `3000` | REST API port |
| `COMPLYFLOW_HOST` | `127.0.0.1` | Bind address for both servers |

For the dashboard:

| Variable | Purpose |
|---|---|
| `VITE_COMPLYFLOW_API_URL` | API URL for a deployed dashboard. If unset, the dashboard calls `/api` on its own origin. |
| `COMPLYFLOW_API_URL` | Where the development and preview servers forward `/api` (default `http://127.0.0.1:3000`) |
| `VITE_DEFAULT_TENANT_ID` | The tenant shown when the dashboard opens |

## Project layout

| Path | Contents |
|---|---|
| [`packages/sdk`](packages/sdk) | Instrumentation SDK for applications |
| [`packages/ingestion`](packages/ingestion) | OTLP receiver, authentication, span transformation, and rate limiting |
| [`packages/graph-builder`](packages/graph-builder) | Tenant isolation and topology construction |
| [`packages/policy-engine`](packages/policy-engine) | HIPAA, SOC 2, GDPR, and PCI DSS policies |
| [`packages/api`](packages/api) | REST API and the server entry point |
| [`packages/shared`](packages/shared) | Shared event types and semantic conventions |
| [`packages/graphreact`](packages/graphreact) | The graph runtime that hosts each tenant's policies |
| [`dashboard`](dashboard) | React operator dashboard |
| [`docs`](docs) | [Product](docs/business/README.md), [SDK](docs/sdk/README.md), and [internal architecture](docs/internal/README.md) documentation |

`packages/graphreact` is the TypeScript prototype of [GraphReact](https://github.com/Bukola-Oludiran/GraphReact), bundled here so the repository builds on its own. It is separate from the Rust implementation in that repository.

## Known limitations

- **Authentication:** ingestion accepts any non-empty API key, and the API trusts the tenant header. Keep both servers on `127.0.0.1` or a private network.
- **Storage:** violations and topology live in memory and are lost on restart.
- **Repeated findings:** topology checks re-evaluate the whole map whenever it changes, so an existing finding can appear again in the violation list.
- **SDK distribution:** the SDK isn't on npm, and the hosted endpoint mentioned in the [SDK guide](docs/sdk/getting-started.md) isn't available.
- **Linear algebra module:** `packages/graphreact` includes a prebuilt WebAssembly binary. Its Rust source isn't in this repository.

## Development

```sh
npm test           # run all tests
npm run test:watch # rerun tests on change
npm run build      # compile every package in dependency order
```

## Author

Built by [Bukola Oludiran](https://github.com/Bukola-Oludiran).
