# ComplyFlow

Continuous compliance monitoring for software teams.

ComplyFlow works like Datadog for compliance. Your engineering team adds a few lines of code to their application. ComplyFlow automatically monitors data flows, verifies security controls, and detects compliance violations in real time across HIPAA, SOC 2, GDPR, and PCI-DSS.

## Contents

- [How It Works](how-it-works.md) — What happens when you use ComplyFlow
- [Compliance Frameworks](compliance-frameworks.md) — What we monitor and what we detect
- [FAQ](faq.md) — Common questions

## The Problem

Compliance today is manual, disconnected, and retrospective. Companies pay hundreds of thousands of dollars per year for auditors to manually trace data flows, interview engineers, and produce reports that are outdated the moment they are written.

Between audits, nobody knows if the system is actually compliant. A developer adds a new microservice that handles patient data without encryption. A data pipeline starts sending PII to an analytics system without audit logging. These gaps go undetected until the next audit cycle — or worse, until a breach.

## The Solution

ComplyFlow provides continuous, automated compliance verification at the application layer. Instead of checking compliance once a year, ComplyFlow checks it on every data access, every API call, every data flow — as they happen.

Your engineering team instruments their code with lightweight SDK calls (similar to adding logging or metrics). ComplyFlow receives this telemetry, builds a live map of how data moves through your system, and evaluates it against compliance policies in real time.

When a violation is detected — PHI accessed without encryption, a service handling patient data without audit logging, cardholder data transmitted in plaintext — you know immediately, not months later.
