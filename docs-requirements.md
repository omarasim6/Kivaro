# Requirements Document

> Save as `.kiro/specs/ev-ecopilot/requirements.md`

## Introduction

EV EcoPilot AI is a mobile-first web app (installable as a PWA) that helps Pakistani EV owners keep a trustworthy battery history, understand their estimated climate impact, and earn rewards for verified sustainability actions. A background agent system processes uploaded battery documents, checks the battery timeline, updates a sustainability ledger and awards points. Every consequential action requires user approval and is recorded in an activity log.

**Hackathon track:** Climate & Sustainability.
**Scope:** a one-day MVP built on-site. A working end-to-end slice matters more than breadth. Integrations are mocked or read-only.

**AI approach:** all LLM calls go through a local Ollama server. The LLM is used only for (a) extracting structured fields from a service receipt and (b) writing plain-language explanations. All calculations, validation, duplicate detection, timeline checks and points logic are deterministic code.

## Glossary

- **App**: the EV EcoPilot AI web application.
- **Vehicle**: an EV owned by the user, with a comparison vehicle defined for emissions estimates.
- **Battery Passport**: the chronological timeline of battery-related records for a Vehicle.
- **Timeline Entry**: a single record (service, inspection, repair, recycling, charging) in the Battery Passport.
- **Receipt**: an uploaded image or PDF of a battery service document.
- **Document Agent**: the specialist agent that extracts fields from a Receipt using Ollama.
- **Battery-care Agent**: the agent that checks the timeline for conflicts and missing inspections.
- **Sustainability Agent**: the agent that updates the Impact Ledger and explains figures.
- **Coordinator**: the agent that breaks a request into jobs, calls the specialist agents in order, checks their results and reports what it did.
- **Job**: a unit of work in the task queue, with a status and a log.
- **Worker**: the background process that polls the task queue on a schedule.
- **Impact Ledger**: the record of emissions-related figures and actions over time.
- **Data Source Type**: one of `measured`, `user_entered` or `model_estimated`.
- **EcoPoints**: points awarded only for validated, evidence-backed actions.
- **Approval Gate**: a step where the user must approve before an action proceeds.
- **Activity Log**: the user-visible, append-only record of agent actions.
- **Ollama**: the local LLM server used for all AI calls.

---

## Requirements

### Requirement 1: Vehicle and Battery Passport

**User Story:** As an EV owner, I want a battery timeline for my vehicle, so that I have one trustworthy history of its battery care.

#### Acceptance Criteria

1. THE App SHALL let the user create a Vehicle with make, model, year, battery capacity (kWh), current odometer (km) and a comparison vehicle (label, fuel type and assumed km per litre).
2. THE App SHALL let the user add a Timeline Entry manually with type, date, odometer, workshop (optional), notes and an evidence file (optional).
3. THE App SHALL display Timeline Entries in chronological order, each showing its type, date, odometer, source and validation status.
4. WHEN a Timeline Entry was created from a Receipt, THE App SHALL link it to the original evidence file.
5. THE App SHALL ship with seeded demo data for one Vehicle so the demo does not start empty.

---

### Requirement 2: Receipt Upload and Extraction (Ollama)

**User Story:** As an EV owner, I want to upload a service receipt and have the details extracted, so that I don't retype everything.

#### Acceptance Criteria

1. WHEN the user uploads a Receipt (JPG, PNG or PDF), THE App SHALL store the file and create an extraction Job.
2. WHEN the Document Agent runs, THE System SHALL call Ollama with a vision-capable model and request output as JSON matching a defined schema: `service_date`, `odometer_km`, `workshop_name`, `service_type`, `battery_notes`, `total_amount` (optional) and a per-field `confidence`.
3. THE App SHALL read the Ollama base URL and model name from configuration, not hard-coded values.
4. THE App SHALL validate the model output against the schema; IF the output is invalid JSON or fails validation, THEN THE App SHALL retry once and then mark the Job `needs_review`.
5. THE App SHALL show the extracted fields on a review screen where the user can edit every field before saving.
6. THE App SHALL NOT create a Timeline Entry from extracted data until the user confirms it.
7. IF Ollama is unreachable, times out (configurable, default 60 s), or returns a low-confidence result, THEN THE App SHALL show a clear message and open the manual entry form pre-filled with any usable fields.
8. THE App SHALL provide a cached sample extraction for the demo Receipt, selectable with a config flag, so the demo works if the model is slow.
9. THE App SHALL show a health indicator for Ollama (reachable or not, model loaded or not).

---

### Requirement 3: Duplicate and Evidence Validation

**User Story:** As the app owner, I want duplicate or fake evidence caught, so that rewards stay trustworthy.

#### Acceptance Criteria

1. WHEN a file is uploaded, THE App SHALL compute its SHA-256 hash and reject or flag it IF the same hash already exists for the user.
2. WHEN a Timeline Entry is confirmed, THE App SHALL compute a fingerprint from service date, odometer and workshop name and flag the entry IF a matching fingerprint already exists.
3. THE App SHALL mark each Timeline Entry with a validation status of `validated`, `needs_review` or `rejected`, with a reason.
4. THE App SHALL NOT mark an entry `validated` unless it has evidence and required fields (date and odometer) present and consistent.

---

### Requirement 4: Timeline Consistency Checks (Battery-care Agent)

**User Story:** As an EV owner, I want the app to point out problems in my battery history, so that I can fix gaps before they matter.

#### Acceptance Criteria

1. WHEN a Timeline Entry is confirmed, THE Battery-care Agent SHALL check that its odometer is not lower than any earlier-dated entry and not higher than any later-dated entry.
2. IF an odometer conflict is found, THEN THE Battery-care Agent SHALL create an alert describing the conflicting entries.
3. THE Battery-care Agent SHALL raise a "missing inspection" alert IF no inspection or service entry exists within a configurable interval (default 12 months or 10,000 km).
4. THE Battery-care Agent SHALL raise an alert IF an extracted value is outside configured plausible ranges (for example odometer far above the Vehicle's current odometer).
5. THE App SHALL list active alerts on the dashboard and let the user dismiss or resolve each one.

---

### Requirement 5: Task Queue, Worker and Coordinator

**User Story:** As an EV owner, I want an always-on agent that works in the background, so that my records stay up to date without me watching.

#### Acceptance Criteria

1. THE App SHALL store Jobs in a task queue with type, payload, status (`queued`, `running`, `succeeded`, `failed`, `needs_review`, `cancelled`), timestamps and attempt count.
2. THE Worker SHALL poll the queue on a configurable interval (default 10 s) and process queued Jobs one at a time.
3. THE App SHALL provide a "Run agent now" control that triggers the Worker immediately.
4. WHEN a receipt-processing request is created, THE Coordinator SHALL break it into steps in this order: extract fields, run timeline checks, update the Impact Ledger, evaluate EcoPoints, and prepare a summary.
5. THE Coordinator SHALL check each specialist agent's result before continuing and stop with a clear status IF a step fails or needs review.
6. WHEN the Coordinator finishes, THE App SHALL show a plain-language report of what it did, with the steps and the sources used.
7. THE Worker SHALL cap retries per Job (default 2) and cap Jobs processed per minute (configurable).

---

### Requirement 6: Agent Controls and Permissions

**User Story:** As an EV owner, I want to control what the agent can do, so that "always-on" never means unlimited.

#### Acceptance Criteria

1. THE App SHALL provide a pause/resume control for the agent; WHILE paused, THE Worker SHALL NOT process new Jobs.
2. THE App SHALL let the user toggle which data the agent may access (uploaded documents, charging data, location), and agents SHALL only use data that is enabled.
3. THE agents SHALL have no capability to send external messages, make payments, make bookings or delete data; these actions SHALL only be available as proposals that pass through an Approval Gate.

---

### Requirement 7: Approval Gate

**User Story:** As an EV owner, I want to approve any consequential action, so that I stay in control.

#### Acceptance Criteria

1. WHEN an agent proposes a consequential action (sharing a report, any external message, deletion), THE App SHALL create an approval request showing what will happen and what data is involved.
2. THE App SHALL NOT perform the action until the user explicitly approves it.
3. IF the user rejects an approval request, THEN THE App SHALL cancel the action and record the decision.
4. THE App SHALL record every approval and rejection in the Activity Log.

---

### Requirement 8: Activity Log

**User Story:** As an EV owner, I want to see exactly what the agent did, so that I can trust it.

#### Acceptance Criteria

1. THE App SHALL record each agent step in an append-only Activity Log with timestamp, agent, action, inputs summary, outcome and the Job it belongs to.
2. THE App SHALL show the Activity Log in the UI, filterable by agent and by Job.
3. WHEN the LLM is used, THE Activity Log SHALL record the model name and whether the output was edited by the user.
4. THE App SHALL NOT allow the user-facing UI to edit or delete Activity Log entries.

---

### Requirement 9: EV Impact Ledger and Emissions Estimates

**User Story:** As an EV owner, I want to see my estimated climate impact with clear assumptions, so that I can trust the numbers.

#### Acceptance Criteria

1. THE App SHALL let the user log charging sessions with date, energy in kWh and optional cost.
2. THE Sustainability Agent SHALL compute estimated charging emissions as energy (kWh) multiplied by an electricity emission factor read from a configuration file.
3. THE configuration file SHALL store, for each emission factor, its value, unit, source, and data year; THE App SHALL display the factor, source and data year next to every estimate and SHALL NOT imply the figure is live.
4. THE Sustainability Agent SHALL compute estimated emissions avoided against the Vehicle's defined comparison vehicle, showing the comparison assumptions.
5. THE App SHALL tag every ledger figure with a Data Source Type of `measured`, `user_entered` or `model_estimated`, and SHALL display the three types separately.
6. THE App SHALL NOT label any figure as a certified carbon saving or carbon credit, and SHALL show the statement "Estimates only, not certified carbon savings" wherever totals appear.
7. THE App SHALL calculate all figures with deterministic code, not by asking the LLM.
8. THE App SHALL show monthly progress toward a user-set goal (for example "reduce estimated emissions per km" or "log N maintenance actions").

---

### Requirement 10: EcoPoints and Demo Rewards

**User Story:** As an EV owner, I want points for real, verified actions, so that rewards encourage useful behaviour rather than app use.

#### Acceptance Criteria

1. THE App SHALL award EcoPoints only for validated actions: a validated service record, a completed battery inspection, a charging session with usable energy data, and a verified recycling or community activity.
2. THE App SHALL NOT award points for opening the app, for driving distance, or for entries with status `needs_review` or `rejected`.
3. THE App SHALL award zero points for entries flagged as duplicates (Requirement 3).
4. THE App SHALL apply a cap per activity type per period (configurable) and show the user when a cap is reached.
5. THE App SHALL award a higher point value for entries with verified evidence than for user-entered entries without evidence.
6. THE App SHALL record every point award in a points ledger with reason, source entry and timestamp.
7. THE App SHALL provide a simulated rewards catalogue (badges and demo discounts) and SHALL label every redemption as "Demo reward — simulated".

---

### Requirement 11: Dashboard

**User Story:** As an EV owner, I want one screen that summarises my battery health records and impact, so that I can see where I stand.

#### Acceptance Criteria

1. THE App SHALL show on one dashboard: the latest timeline entries, active alerts, estimated emissions for the month with Data Source Types, goal progress, EcoPoints balance and agent status (running, paused, last run).
2. THE dashboard SHALL be usable on a phone-width screen (360 px and up) and on a laptop.

---

### Requirement 12: Report and Sharing

**User Story:** As an EV owner, I want a report I can share, so that I can show my battery history to a buyer or workshop.

#### Acceptance Criteria

1. THE App SHALL generate a report containing the Battery Passport timeline, evidence links, the Impact Ledger summary and the assumptions used.
2. THE report SHALL show Data Source Types and the emission factor source and data year, and SHALL include the "Estimates only" statement.
3. WHEN the user requests to share the report, THE App SHALL pass through an Approval Gate (Requirement 7) before generating a share link.
4. THE user SHALL be able to revoke a share link.

---

### Requirement 13: Non-Functional

#### Acceptance Criteria

1. THE App SHALL run entirely locally with Ollama and require no cloud AI service.
2. THE App SHALL complete the primary demo flow (upload, review, confirm, ledger update, points, report) in under two minutes using the cached sample if needed.
3. THE App SHALL keep secrets and configuration in environment variables.
4. THE App SHALL handle empty states and errors with clear user-facing messages, with no crashes in the primary demo flow.

---

## Out of Scope (MVP)

- Real connected-vehicle integrations, real payments, real bookings, real partner rewards.
- The Community Agent and charger route planning (show as a roadmap slide).
- Multiple vehicles, fleets, and the paid "EcoPilot Plus" tier.
- Carbon-credit certification of any kind.

## Demo Acceptance Path

1. Open the dashboard with seeded data and show the agent status.
2. Upload a service receipt; Ollama extracts the fields.
3. Review, edit and confirm the extraction.
4. The Coordinator runs the timeline check, updates the ledger and awards points; open the Activity Log.
5. Show the ledger with measured, user-entered and estimated figures and the emission factor's data year.
6. Re-upload the same receipt to show duplicate detection and zero points.
7. Request a report share and approve it at the Approval Gate.
