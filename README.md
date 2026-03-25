# Emergency Response & Dispatch Coordination Platform

**Course:** CPEN 421 — Mobile and Web Software Design
**Institution:** University of Ghana, School of Engineering Sciences
**Deadline:** March 31, 2026
**Stack:** Node.js / Express · PostgreSQL · RabbitMQ · WebSockets · Mapbox GL JS

---

## Project Overview

A distributed microservices-based platform that simulates a national emergency response
and dispatch coordination system for Ghana. It enables call-center operators to record
emergency incidents, automatically dispatch the nearest available responder (ambulance,
police, or fire truck), and track response vehicles in real time on a map.

### System Actors

| Actor | Role |
|-------|------|
| System Administrators | Call-center operators who receive citizen calls and record incidents |
| Hospital Administrators | Manage hospital capacity and ambulance availability |
| Ambulance Drivers | Transmit GPS location; receive dispatch assignments |
| Police Station Admins | Manage police officers and station information |
| Fire Service Admins | Manage firefighters and station information |
| Citizens | Report emergencies by phone — they do NOT log into the system |

---

## Architecture Summary

The system is composed of **4 independent microservices**, each with its own PostgreSQL
database. They communicate via **HTTP REST** for synchronous calls and **RabbitMQ** for
asynchronous event broadcasting.

| Service | Port | Database |
|---------|------|----------|
| Identity & Auth | 3001 | `auth_db` |
| Emergency Incident | 3002 | `incident_db` |
| Dispatch Tracking | 3003 | `tracking_db` |
| Analytics & Monitoring | 3004 | `analytics_db` |

---

## Repository Structure

```
Course_Project/
├── README.md                        ← You are here
├── DEPLOYMENT.md                    ← Deployment & Local Dev Guide
├── CPEN 421 FINAL COURSE PROJECT.pdf ← Original specification
└── design/                          ← Phase 1: All design documents
    ├── architecture/
    │   ├── system-overview.md       ← Narrative description of the full system
    │   ├── system-architecture.mmd  ← Mermaid diagram: services + external systems
    │   └── communication-matrix.md  ← Which service calls which, and how
    ├── database/
    │   ├── identity-auth-schema.sql
    │   ├── emergency-incident-schema.sql
    │   ├── dispatch-tracking-schema.sql
    │   ├── analytics-schema.sql
    │   └── er-diagrams/
    │       ├── identity-auth.mmd
    │       ├── emergency-incident.mmd
    │       ├── dispatch-tracking.mmd
    │       └── analytics.mmd
    ├── api/
    │   ├── identity-auth-api.yaml          ← OpenAPI 3.0
    │   ├── emergency-incident-api.yaml
    │   ├── dispatch-tracking-api.yaml
    │   └── analytics-api.yaml
    └── message-queue/
        ├── event-catalog.md         ← All events: producers, consumers, triggers
        └── event-schemas.json       ← JSON Schema for every event payload
```

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** — System Design | ✅ COMPLETE | Architecture, DB schemas, API specs, MQ events |
| **Phase 2** — Backend | ✅ COMPLETE | Implement all 4 microservices |
| **Phase 3** — Client UI | ✅ COMPLETE | Web interface: login, incidents, map tracking, analytics |
| **Phase 4** — Docs & Demo | ✅ COMPLETE | Swagger docs, deployment guide, Postman |

---

## How to Read the Design Documents

1. Start with [design/architecture/system-overview.md](design/architecture/system-overview.md)
   for a narrative understanding of the full system.
2. View [design/architecture/system-architecture.mmd](design/architecture/system-architecture.mmd)
   in a Mermaid renderer (VS Code extension or https://mermaid.live) for the visual diagram.
3. Review [design/architecture/communication-matrix.md](design/architecture/communication-matrix.md)
   for inter-service communication details.
4. Browse `design/database/` for SQL schemas and ER diagrams per service.
5. Open `design/api/*.yaml` files in [Swagger Editor](https://editor.swagger.io/) to explore
   the full API contracts.
6. Review `design/message-queue/` for the event-driven communication design.


$backendPath = Get-Location; @('auth-service', 'incident-service', 'tracking-service', 'analytics-service') | ForEach-Object { Start-Job -Name $_ -ScriptBlock { param($svc, $path) Set-Location "$path\$svc"; pnpm dev } -ArgumentList $_, $backendPath }; Get-Job