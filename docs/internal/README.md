# ComplyFlow Internal Documentation

Technical documentation for engineers working on the ComplyFlow platform.

## Contents

- [Architecture](architecture.md) — System design, data flow, package responsibilities
- [Policy Engine](policy-engine.md) — How to add policies, framework mapping, shared detections
- [Topology](topology.md) — Layer 2 auto-discovery, graph structure, topology-aware policies
- [Testing](testing.md) — Test structure, how to run, how to add tests

## Quick Start (Development)

```bash
# Install dependencies
cd ComplyFlow && npm install

# Build the shared types package
cd packages/shared && npx tsc

# Run all tests
npx vitest run

# Run tests in watch mode
npx vitest
```

## Prerequisites

- Node.js 22+
- GraphReact built at `../GraphReact/graphreact/` (`npm run build` in that directory)

## Monorepo Structure

```
ComplyFlow/
  packages/
    shared/          # Types, semantic conventions (no runtime code)
    sdk/             # Customer-installed SDK (wraps OpenTelemetry)
    ingestion/       # OTLP HTTP receiver + span transformer
    graph-builder/   # Tenant management, topology auto-discovery
    policy-engine/   # Compliance policy nodes (HIPAA, SOC 2, GDPR, PCI-DSS)
    api/             # REST API server
```

GraphReact is an external dependency linked via `file:../../../GraphReact/graphreact` in packages that use it (graph-builder, policy-engine, api). It runs server-side only.
