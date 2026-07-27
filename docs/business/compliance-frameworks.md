# Compliance Frameworks

ComplyFlow monitors four compliance frameworks. Each framework has specific policies that evaluate your application's behavior against regulatory requirements.

## HIPAA (Health Insurance Portability and Accountability Act)

**Relevant for:** Healthcare organizations, health tech companies, business associates handling Protected Health Information (PHI).

**What we monitor:**

| What we check | Regulation | Type |
|--------------|------------|------|
| Every PHI access has a unique user identifier | §164.312(a)(2)(i) | Required |
| PHI access is recorded in audit logs | §164.312(b) | Required |
| PHI is encrypted when stored | §164.312(a)(2)(iv) | Addressable |
| PHI is encrypted when transmitted between services | §164.312(e)(2)(ii) | Addressable |
| Users accessing PHI are verified (MFA) | §164.312(d) | Required |
| Failed login attempts to PHI resources are tracked | §164.308(a)(5)(ii)(C) | Addressable |
| No unencrypted paths exist in PHI data flows | §164.312(e)(2)(ii) | Addressable |
| Services accessing PHI have audit logging enabled | §164.312(b) | Required |
| PHI access follows minimum necessary principle | §164.502(b) | Privacy Rule |

9 policies total. "Required" means the control must be implemented. "Addressable" means the organization must implement it or document why an alternative is used.

## SOC 2 (Service Organization Control 2)

**Relevant for:** SaaS companies, cloud service providers, any organization handling customer data.

**What we monitor:**

| What we check | Trust Services Criteria |
|--------------|----------------------|
| Non-public data access requires user identification and encryption | CC6.1 — Logical Access Security |
| Data is encrypted during transmission between services | CC6.7 — Transmission Restriction |
| Data access is monitored and audit-logged | CC7.2 — System Monitoring |

3 policies. SOC 2 evaluates all non-public data (PHI, PII, PCI, and internal), not just specific regulated categories.

## GDPR (General Data Protection Regulation)

**Relevant for:** Any organization processing personal data of EU residents.

**What we monitor:**

| What we check | GDPR Article |
|--------------|-------------|
| Personal data is encrypted at rest and in transit | Article 32.1(a) — Encryption |
| Personal data access requires user identification | Article 32.1(b) — Confidentiality |
| Personal data access is encrypted during transmission | Article 32.1(a) — Encryption |
| Personal data processing is audit-logged | Article 5.1(f) — Integrity and Confidentiality |

2 policies. GDPR scope covers personal data (PHI and PII). "Personal data" under GDPR means any information relating to an identified or identifiable natural person.

## PCI-DSS (Payment Card Industry Data Security Standard)

**Relevant for:** Any organization that stores, processes, or transmits payment card data.

**What we monitor:**

| What we check | PCI Requirement |
|--------------|----------------|
| Cardholder data is encrypted when stored | Req 3.5 — Protect Stored Account Data |
| Cardholder data is encrypted during transmission | Req 4.2.1 — Strong Cryptography |
| Cardholder data access requires user identification | Req 8.2 — User Identification |
| Cardholder data access requires strong authentication (MFA) | Req 8.3 — Strong Authentication |
| Cardholder data access is audit-logged | Req 10.2 — Audit Logs |

4 policies. PCI-DSS evaluates only cardholder data (PCI classification).

## Cross-Framework Coverage

Many compliance controls overlap across frameworks. A single check in ComplyFlow can satisfy requirements in multiple frameworks simultaneously:

| Detection | HIPAA | SOC 2 | GDPR | PCI-DSS |
|-----------|-------|-------|------|---------|
| User identification on data access | §164.312(a)(2)(i) | CC6.1 | Art 32.1(b) | Req 8.2 |
| Audit logging | §164.312(b) | CC7.2 | Art 5.1(f) | Req 10.2 |
| Encryption at rest | §164.312(a)(2)(iv) | CC6.1 | Art 32.1(a) | Req 3.5 |
| Encryption in transit | §164.312(e)(2)(ii) | CC6.7 | Art 32.1(a) | Req 4.2.1 |
| Multi-factor authentication | §164.312(d) | — | — | Req 8.3 |

This means instrumenting your application once gives you coverage across all enabled frameworks.

## What We Cannot Monitor

Some compliance requirements are outside the scope of application-level telemetry:

- Physical security controls (locks, access badges, facility security)
- HR processes (background checks, security training records)
- Documentation requirements (written policies, risk assessments)
- Infrastructure-level controls (firewall rules, OS patching, network segmentation)
- Session management (automatic logoff, session timeout configuration)

For these, ComplyFlow complements — not replaces — tools like Vanta, Drata, or your existing GRC platform. ComplyFlow covers the application layer that those tools cannot see.
