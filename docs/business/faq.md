# Frequently Asked Questions

## General

**What is ComplyFlow?**

ComplyFlow is a continuous compliance monitoring platform. Your engineering team instruments their application with a lightweight SDK. ComplyFlow monitors data access patterns, builds a map of your system, and detects compliance violations in real time across HIPAA, SOC 2, GDPR, and PCI-DSS.

**How is this different from Vanta or Drata?**

Vanta and Drata check your infrastructure configuration — is encryption enabled on your S3 bucket? Is MFA turned on for your AWS account? ComplyFlow checks your application behavior — is your code actually encrypting patient data when it accesses it? Is every data access by an authenticated user? Is there a path in your system where sensitive data flows without encryption?

These are complementary. Vanta tells you your infrastructure is configured correctly. ComplyFlow tells you your application is behaving correctly.

**Do we need to replace our existing compliance tools?**

No. ComplyFlow works alongside your existing GRC platform. It fills the gap that infrastructure-level tools cannot cover — what's happening inside your application code.

**What compliance frameworks do you support?**

HIPAA, SOC 2, GDPR, and PCI-DSS. Each framework has specific policies mapped to actual regulatory requirements.

## Implementation

**How long does it take to integrate?**

The SDK can be installed and initialized in minutes. Instrumenting critical code paths (data access, access control, data flows) typically takes a few hours for a single service. Full coverage across multiple services happens over days to weeks as teams add instrumentation incrementally.

**Does the SDK impact application performance?**

No. The SDK is asynchronous and lightweight. It creates OpenTelemetry spans that are batched and sent in the background. There is no synchronous blocking on the hot path.

**Does ComplyFlow see our actual data?**

No. The SDK sends metadata about data access patterns — which service accessed which resource, what type of data, whether it was encrypted, who accessed it. It never sends the actual data content. ComplyFlow verifies compliance controls without touching sensitive data.

**What languages do you support?**

The SDK is currently available for TypeScript/Node.js. Additional language support (Python, Go, Java) is planned.

## Compliance

**Can we use ComplyFlow reports for our SOC 2 audit?**

ComplyFlow provides evidence and continuous monitoring that supports your SOC 2 audit. The actual SOC 2 report must be issued by a licensed CPA firm. ComplyFlow's violation data, compliance status, and system topology exports can serve as evidence for your auditor.

**What happens if we don't instrument everything?**

ComplyFlow can only monitor what your application tells it. Uninstrumented code paths are invisible. ComplyFlow's topology view shows which services and resources have been observed — gaps in coverage are themselves a finding. Over time, as more services are instrumented, coverage improves.

**Are the compliance checks accurate?**

HIPAA policies are mapped to the actual regulation text (45 CFR §164). Cross-framework mappings (SOC 2, GDPR, PCI-DSS) are sourced from the Secure Controls Framework (SCF), an established meta-framework that maps controls across 100+ standards. The detection logic checks what is verifiable from application telemetry — some compliance requirements (physical security, HR processes, documentation) are outside the scope of application-level monitoring.

**What does "Addressable" mean for HIPAA?**

HIPAA distinguishes between Required and Addressable implementation specifications. "Addressable" does not mean optional — it means the organization must either implement the control or document why it is not reasonable and implement an equivalent alternative. ComplyFlow flags Addressable findings at a lower severity than Required findings, and descriptions note the organization's option to document alternatives.

## Security

**How is our telemetry data secured?**

Telemetry is transmitted over HTTPS (TLS encryption in transit). API keys authenticate each request. Each tenant's data is isolated in a separate graph instance — there is no cross-tenant data access.

**Who can access our compliance data?**

Only authenticated requests with your organization's API key and tenant ID can access your data. The REST API requires the `x-complyflow-tenant-id` header on every request.

**Can a malicious developer fake compliance data?**

The SDK reports what the application tells it. A developer could instrument their code to report false data (e.g., `encrypted: true` when it isn't). This is the same limitation as any self-reported compliance tool. For organizations that need higher trust, ComplyFlow's topology analysis can cross-reference reported behavior against observed patterns, and future infrastructure verification features will validate reported state against actual configuration.
