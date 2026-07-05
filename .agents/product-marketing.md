# Product Marketing Context

*Last updated: 2026-06-25*

## Product Overview
**One-liner:** MediCoord AI routes patients to the right facility — faster — by combining symptom triage, live wait queues, and real-time road routing.
**What it does:** Users describe symptoms in plain language. An AI agent classifies severity, queries live facility wait times, and routes them to the nearest appropriate facility — not the nearest facility. Results appear on a live map with travel directions.
**Product category:** Health navigation / patient routing platform
**Product type:** SaaS — consumer-facing with a B2B org tier (sandbox mode)
**Business model:** Freemium consumer access; org licensing for city health systems and operators

## Target Audience
**Target companies:** Municipal health systems, urgent care networks, hospital groups, public health operators (Toronto-first)
**Decision-makers:** Chief Medical Officers, VP Operations (health systems), Municipal Health Directors, Digital Health Investors
**Primary use case:** Route individual patients or multi-patient queues to the correct level of care in real time
**Jobs to be done:**
- "Get me to the right care without guessing urgent care vs ER"
- "Reduce unnecessary ER visits by routing moderate cases to urgent care"
- "Show our health network's coordination capacity to city partners"
**Use cases:**
- Individual: symptom input → severity → map routing
- Organizational: multi-patient load simulation with priority queue (sandbox mode)

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Patient (consumer) | Speed, correctness, privacy | Doesn't know if ER or clinic is right | Right facility, right now — no guessing |
| Health System Operator | Network efficiency, ER deflection | Patients crowd wrong facilities | Intelligent load distribution across the city |
| Municipal Health Investor | Scalability, defensibility, data | Coordination at city scale is unsolved | Priority queue routing across all facilities simultaneously |
| Engineer/Evaluator | Technical depth, defensibility | RAG hallucinations, naive geo-routing | Graph RAG + composite ETA scoring |

## Problems & Pain Points
**Core problem:** People don't know whether to go to the ER, urgent care, or their family doctor — so they default to the ER.
**Why alternatives fall short:**
- Google Maps shows nearest clinic, not best available clinic
- 811 phone line is slow and doesn't show live wait data
- Hospital websites don't surface wait times in actionable form
**What it costs them:** Wasted hours in ER waiting rooms for cases that didn't need emergency care; missed critical cases that self-routed to under-equipped clinics
**Emotional tension:** Fear of making the wrong call. Guilt about "wasting" the ER. Uncertainty about severity.

## Competitive Landscape
**Direct:** None at city-scale in Toronto with composite routing
**Secondary:** Google Maps (nearest, not best) — ignores wait times and clinical fit; 811 (advisory only) — no live data, no map
**Indirect:** Self-diagnosis (WebMD/Reddit) — no routing; Family doctor referral — too slow for urgent cases

## Differentiation
**Key differentiators:**
- Composite ETA: travel time + live wait queue (not just proximity)
- Graph RAG: symptom-to-clinical-entity grounding prevents hallucinated routing
- Priority queue: multi-patient routing with severity-weighted dispatch
- Real Canadian public health data (Toronto facilities, OHIP-aligned)
**How we do it differently:** We treat routing as a real-time optimization problem, not a search problem.
**Why that's better:** The closest clinic with a 60-min queue is worse than the 4km hospital with a 15-min queue.
**Why customers choose us:** Only platform combining AI symptom triage + composite routing + live city-wide coordination.

## Brand Voice
**Tone:** Confident, precise, patient-first — never alarmist, never vague
**Style:** Direct; no hedging; clinical accuracy without medical jargon for patients; peer-level technical for engineers
**Personality:** Reliable, intelligent, calm under pressure

## Goals
**Business goal:** Establish MediCoord AI as the reference patient routing platform for Toronto; attract org pilots
**Conversion action:** Try the app (consumer) / Launch Sandbox Mode (org/investor)
**Current metrics:** Phase 1 — traction and validation
