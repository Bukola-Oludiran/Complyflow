# Complyflow

Complyflow is an experimental compliance-observability platform that turns application telemetry
into an inspectable graph of data access, service relationships, policy decisions, and risk.

Instead of treating compliance as a periodic questionnaire, Complyflow instruments application
behavior through OpenTelemetry, evaluates events against policy modules, and exposes the resulting
topology and violations through an API and operator dashboard.

## What it demonstrates

- OTLP/HTTP ingestion and semantic span transformation
- Isolated per-tenant compliance graphs
- Topology discovery from live application behavior
- Policy modules for HIPAA, SOC 2, GDPR, and PCI DSS
- REST endpoints for violations, status, graph export, and topology
- A React/Cytoscape dashboard for system state and data-flow inspection

## Architecture

```text
Customer application
       |
       | OpenTelemetry spans
       v
OTLP ingestion -----> normalized compliance events
       |
       v
Tenant graph -----> policy nodes -----> violation store
       |                                      |
       +------------ topology ----------------+
                                              |
                                              v
                                     API + React dashboard
```

The repository is organized as a TypeScript workspace:

- `packages/sdk` — customer-facing instrumentation helpers
- `packages/ingestion` — OTLP receiver, authentication, transformation, and rate limiting
- `packages/graph-builder` — tenant isolation and topology construction
- `packages/policy-engine` — compliance detections and framework-specific policies
- `packages/api` — HTTP API and graph export
- `packages/shared` — shared events, contracts, and semantic conventions
- `dashboard` — React operator interface
- `docs` — business, SDK, and internal architecture documentation

## Development

Requirements:

- Node.js 20 or newer
- npm
- A compatible GraphReact checkout for the packages that currently use the private runtime

Install and validate the workspace:

```bash
npm install
npm test
npm run build
```

Run the API:

```bash
npm run dev
```

Run the dashboard in another terminal:

```bash
npm install --prefix dashboard
npm run dev --prefix dashboard
```

Copy the example environment files before configuring local services. Real credentials and
production configuration are intentionally excluded from this repository.

## Status

Active development. The ingestion, graph construction, policy, API, SDK, test, and dashboard layers
are present, but this repository should be evaluated as a product-engineering work in progress—not
as production compliance certification or legal guidance.

## Author

Built by [Bukola Oludiran](https://github.com/UnknownCeaser).
