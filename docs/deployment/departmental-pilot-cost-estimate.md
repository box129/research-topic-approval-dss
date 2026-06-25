# Departmental Pilot Cost Estimate

## Status

PR #120 prepares a paid departmental pilot estimate for the Research Topic Approval DSS. It does not procure infrastructure, deploy a VPS, register a domain, configure SMTP, or prove public production readiness.

All prices in this document are planning estimates only. Recheck current provider pricing, exchange rates, taxes, institutional procurement rules, and data-protection requirements before funding approval.

## Recommended Paid Pilot Architecture

For a real Public Health Department pilot, prefer a paid VPS/Docker deployment first:

| Component | Recommended pilot placement |
| --- | --- |
| Frontend | Nginx/static frontend container behind HTTPS |
| Backend | Express API container |
| PostgreSQL | Same VPS for low-cost pilot, or managed/private PostgreSQL for stronger reliability |
| SBERT | FastAPI SBERT container on the same VPS for baseline pilot |
| SMTP | Deployment-owned SMTP provider |
| Backups | Encrypted off-server backup storage |
| Monitoring/logging | Provider monitoring plus external uptime check/log retention |
| TLS/domain | Department-owned domain or approved subdomain with HTTPS |

The Docker Compose topology from PR #115 is the baseline because it already packages PostgreSQL, backend, frontend, and SBERT in a repeatable stack.

## Why 4 vCPU / 8 GB RAM Is A Reasonable Baseline

A departmental pilot is not just a static website. It runs:

- PostgreSQL for submissions, users, topics, audits, notifications, and reports
- Node/Express backend and Prisma queries
- Nginx/static frontend
- Python FastAPI SBERT service
- model loading and embedding operations
- backup and maintenance jobs
- operating system and Docker overhead

The SBERT service is the main reason to avoid a tiny 1 vCPU / 1 GB RAM server. A 4 vCPU / 8 GB RAM VPS gives enough headroom for a low-traffic pilot while keeping costs modest. If SBERT requests become frequent, or if PostgreSQL grows materially, split PostgreSQL and SBERT onto separate managed/dedicated resources.

## What The Department Would Pay For

| Cost area | What it covers | Typical planning range |
| --- | --- | --- |
| VPS/server | CPU, RAM, SSD, bandwidth for Docker stack | USD 10-80/month depending on provider and reliability |
| Domain name | Department domain or subdomain registration/renewal | USD 10-25/year if a new domain is needed |
| SSL/TLS | HTTPS certificate | Often USD 0 with Let's Encrypt; paid certificates optional |
| Backup storage | Off-server database dumps, retention, restore tests | USD 2-20/month for a small pilot |
| Email provider | Password reset and notification email transport | USD 0-25/month at low volume, depending on provider/plan |
| Monitoring/logging | Uptime checks, alerts, log retention | USD 0-30/month for basic pilot coverage |
| Maintenance/support | Updates, backups, incident response, security review | Institution-defined allowance; estimate separately from hosting |

These ranges are intentionally broad. They are not quotes.

## Budget Tiers

### Low-Cost Pilot

Estimated infrastructure: USD 15-35/month plus domain renewal.

Possible shape:

- low-cost 4 vCPU / 8 GB VPS where available
- Docker Compose stack on one server
- free TLS through Let's Encrypt
- low-cost object storage or provider snapshots
- email disabled or free/low-volume SMTP plan
- basic uptime monitoring

Tradeoffs:

- less redundancy
- manual operations burden
- limited monitoring/log retention
- backup/restore discipline must be handled carefully
- may need upgrade if SBERT or PostgreSQL load grows

### Recommended Departmental Pilot

Estimated infrastructure: USD 40-90/month plus support/maintenance allowance.

Possible shape:

- reputable 4 vCPU / 8 GB or stronger VPS
- off-server backup storage
- deployment-owned domain/subdomain and HTTPS
- real SMTP provider
- uptime monitoring and alerting
- scheduled backup verification
- basic security hardening and patch process

Tradeoffs:

- still not highly available
- one-server architecture may have downtime during maintenance
- departmental process must own credentials, backups, and incident response

### Higher-Reliability Pilot

Estimated infrastructure: USD 100-250+/month plus support/maintenance allowance.

Possible shape:

- larger VPS or two-node split
- managed PostgreSQL with backups
- separate SBERT host if model load is high
- stronger monitoring/log retention
- managed backup retention
- more formal incident-response coverage

Tradeoffs:

- higher monthly spend
- more vendor configuration
- more operational complexity
- still requires departmental ownership and evidence capture

## Provider Pricing Recheck Notes

Planning references checked on 2026-06-25:

- DigitalOcean advertises Droplets starting at low monthly prices, with larger plans billed by CPU/RAM/storage.
- Hetzner, Contabo, Akamai/Linode, and AWS Lightsail publish VPS plans that can be compared for 4 vCPU / 8 GB or nearby sizes.
- Vercel, Netlify, Render, Supabase, Hugging Face, and Brevo publish free or low-cost managed tiers useful for demo/staging planning.

Recheck these official pricing pages before procurement:

- `https://www.digitalocean.com/pricing/droplets`
- `https://www.hetzner.com/cloud/`
- `https://www.akamai.com/cloud/pricing`
- `https://aws.amazon.com/lightsail/pricing/`
- `https://www.brevo.com/pricing/`
- `https://vercel.com/pricing`
- `https://www.netlify.com/pricing/`
- `https://render.com/pricing`
- `https://supabase.com/pricing`
- `https://huggingface.co/pricing`

Before procurement, recheck:

- current monthly price
- region availability
- included transfer/bandwidth
- backup/snapshot charges
- IPv4 charges
- taxes/VAT
- support level
- data residency
- acceptable-use policy
- whether the plan permits departmental/educational production use

## FYP vs Departmental Use

| Use case | Recommended path |
| --- | --- |
| Final-year project demonstration | Free managed staging path, synthetic/demo data, honest limits |
| Lecturer validation demo | Free managed staging or local Docker Compose, with no real identifiers |
| Departmental pilot | Paid VPS/Docker baseline with backup, monitoring, SMTP, and owner approvals |
| Public production | Paid infrastructure plus completed staging proof, backups, monitoring, TLS/domain, incident response, and data-governance approval |

The FYP can use free hosting because demo downtime and cold starts are acceptable if documented. Real departmental use should use paid infrastructure because the department needs stronger reliability, backup ownership, secret control, and operational accountability.

## Evidence Required Before Funding Decision

Before the department funds a pilot, capture:

- expected user count and traffic pattern
- whether SBERT must be live for every check
- expected topic/submission record count
- data-retention policy
- backup frequency and retention target
- SMTP sender approval
- monitoring owner
- support/maintenance owner
- security/privacy approval
- price recheck date and provider pages reviewed

## Current Boundary

This document is a planning estimate only. It does not complete procurement, deployment, staging proof, public production proof, provider SMTP proof, backup drill proof, or departmental approval.
