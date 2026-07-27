# How It Works

## Three Steps

### 1. Instrument

Your engineering team adds a lightweight SDK to your application. It takes minutes, not months. The SDK records when your application accesses sensitive data, makes access control decisions, or sends data between services.

The SDK is built on OpenTelemetry, the industry standard for application observability. If your team already uses Datadog, New Relic, or Honeycomb, this will feel familiar.

### 2. Monitor

ComplyFlow receives the telemetry from your application and does two things:

**Real-time policy evaluation:** Each event is immediately checked against compliance rules. If a developer's code accesses patient health information without a user identifier, ComplyFlow flags it instantly.

**System topology mapping:** Over time, ComplyFlow builds a live map of your system — which services exist, which databases they access, how data flows between them, and what security controls are in place at each point. This map is built automatically from observed behavior, not from documentation that may be outdated.

### 3. Detect

ComplyFlow evaluates your system against compliance frameworks:

**Event-level checks:** "Did this specific data access have a user identifier? Was it encrypted? Was it audit-logged?"

**Topology-level checks:** "Is there any path in the system where patient health information can flow through a service that doesn't encrypt it? Are there services accessing PHI databases without audit logging enabled?"

Violations appear in your dashboard with the specific regulatory citation, severity level, the service and resource involved, and the evidence (the actual event that triggered it).

## What ComplyFlow Sees

ComplyFlow sees what your application tells it through the SDK:
- Which services access which data resources
- What type of data is involved (health data, personal data, payment card data)
- Whether that data is encrypted
- Who is accessing it (user identity, role)
- Whether access was authorized and how (role-based access, MFA)
- Whether the access was logged for audit purposes
- How data flows between services

ComplyFlow does NOT see the actual data content. It sees metadata about data access patterns — enough to verify compliance controls without touching the sensitive data itself.

## What ComplyFlow Does Not Do

ComplyFlow is a compliance monitoring tool, not an audit firm. It does not:
- Issue SOC 2 reports (those come from licensed CPA firms)
- Certify HIPAA compliance (that requires a qualified assessor)
- Replace your security team or compliance officer
- Access your infrastructure directly (it only receives telemetry from your SDK)

ComplyFlow provides the evidence, monitoring, and real-time visibility that supports your compliance program. Your auditors, assessors, and compliance team use this evidence to make compliance determinations.
