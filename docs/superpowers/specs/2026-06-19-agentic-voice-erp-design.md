# OM INDUSTRIES ERP — Agentic + Voice Upgrade Design

**Date:** 2026-06-19
**Author:** Ravi Jariwala (owner) + Claude
**Status:** Design — pending review
**Target level:** B (read + guarded write; voice fills form, human taps confirm)

---

## 1. Goal

Turn the existing form-driven ERP into a voice-first, agent-assisted system without removing the existing UI. Two distinct users, served by one shared voice pipeline:

- **Floor workers** (hanks / coning / dyeing) — phones, factory noise, Gujarati + Hindi + English code-mixed, low literacy. Replace form-tapping with spoken logging: *"batch baar kilo done"* → logged.
- **Owner (Ravi)** — ask the business in natural language and act on the answer: *"how much grey stock pending dyeing?"*, *"client X balance?"*, *"make challan for Patel 50kg"*.

**Autonomy level = B.** Every write (stock/money/status mutation) shows a confirm card before commit. No silent autonomous mutations (level C rejected — audit + noisy-STT risk too high for an ERP touching stock and money).

**Non-goals (v1):** WhatsApp channel, native app, offline queue, autonomous reordering, voice for the customer portal.

---

## 2. Decisions Locked

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| Q1 | Primary users | Both worker + owner, phased | Both have real, distinct value |
| Q2 | Autonomy | **B** — guarded write | Confirm card gates every mutation; safe + auditable |
| Q3 | Language | **Gujarati + Hindi + English** code-mixed | True Surat floor coverage |
| Q4 | Channel | **PWA mic** (existing app) | Zero install; reuses Next.js PWA; Android floor phones |
| Q5 | Brain | **Split**: worker = intent-parse (Haiku), owner = tool-calling agent (Sonnet) | Bounded vs open-ended; cost + audit + jailbreak surface |

### Model / service choices

- **STT:** Sarvam AI (primary) — best Gujarati/Hindi/code-mix, India-hosted, cheap. Google Chirp as fallback.
- **Worker intent-parse:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — fast, cheap, deterministic for a fixed action set.
- **Owner agent:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) — tool-calling + multilingual reasoning.
- **TTS (optional, owner replies):** deferred to later; v1 is text-first.

Claude has no audio input → STT always a separate first stage.

---

## 3. Decomposition (build order)

Three sub-projects. Each gets its own implementation plan. Ship **SP1 + SP2 first** (proves pipeline + real floor value), then **SP3**.

### SP1 — Voice pipeline (foundation)
Mic capture → STT → text. Shared by both user paths.
- Browser `MediaRecorder` in existing `/worker` and `/admin` shells, behind a mic button.
- `POST /api/voice/transcribe` → Sarvam STT → `{ text, lang, confidence }`.
- Handles: push-to-talk UX, audio blob upload, language auto-detect, low-confidence reprompt.

### SP2 — Worker voice-logging (intent-parse)
Bounded write actions with confirm card.
- `POST /api/voice/intent` → Haiku → `{ action, params, confidence }` against a **closed action schema**.
- Validate params against schema + DB (batch exists, qty sane) → render confirm card → on confirm, call the **existing** API route (e.g. `/api/production/hanks`). No new business logic — voice is only a new front-end to routes already audited.
- Action set (v1): `log_hanks`, `log_coning`, `log_dyeing`, `approve_hanks` (if worker is approver), `check_my_pending`.

### SP3 — Owner agent (tool-calling)
Query + guarded write with reasoning.
- `POST /api/agent` → Sonnet 4.6 with tool definitions.
- **Read tools** (no confirm): `query_stock`, `client_balance`, `pending_by_stage`, `dispatch_summary`, `low_chemicals`, `order_status`.
- **Write tools** (confirm card before commit): `make_challan`, `approve_production`, `record_payment`. Each write tool returns a *proposed* action; the UI renders a confirm card; commit only on tap.
- Multi-step reasoning allowed for reads; writes always single, explicit, confirmed.

---

## 4. Data Flow

```
PWA mic (MediaRecorder, push-to-talk)
   │ audio blob (webm/opus)
   ▼
POST /api/voice/transcribe ──► Sarvam AI STT ──► { text, lang, confidence }
   │                                              (if confidence < threshold → reprompt)
   │
   ├─ WORKER ──► POST /api/voice/intent ──► Claude Haiku 4.5
   │               → { action, params, confidence }
   │               → schema validate + DB sanity check
   │               → CONFIRM CARD ──(tap)──► existing API route ──► audit_log
   │
   └─ OWNER ───► POST /api/agent ──► Claude Sonnet 4.6 (tool-calling loop)
                   ├─ read tool  → DB → answer (text)
                   └─ write tool → proposed action → CONFIRM CARD ──(tap)──► API route ──► audit_log
```

### Confirm-card contract (shared)
Every mutation path produces the same shape so one UI component renders both worker and owner confirmations:

```ts
type ConfirmCard = {
  action: string;            // e.g. "log_hanks"
  summary: string;           // human-readable, in user's language
  params: Record<string, unknown>;
  targetRoute: string;       // existing API route to call on confirm
  method: "POST" | "PUT";
  transcript: string;        // raw STT text, for audit
  confidence: number;
};
```

On confirm: call `targetRoute`, then write an `audit_log` row tagged `source: "voice"` with the transcript + parsed params. This makes every voice-originated mutation fully traceable (who said what, what got parsed, what committed).

---

## 5. Security & Safety

- **No new mutation logic.** Voice calls only existing, already-audited API routes. The agent cannot bypass `requireAuth` / `requireStrictAdmin` / RLS — every tool call runs through the same route handlers with the caller's JWT.
- **Role scoping.** Worker intent-parse can only emit actions allowed for that worker's role (`hanks_worker` cannot emit `make_challan`). Owner agent write tools are admin-gated server-side regardless of what the LLM proposes.
- **Confirm gate on every write.** LLM proposes; human commits. STT mis-hears ("baar"=12 vs "char"=4) are caught at the card.
- **Audit everything.** `source: "voice"` + raw transcript + parsed params + confidence on every committed mutation.
- **Prompt-injection containment.** Worker path uses a closed action schema (LLM output validated against an enum — free-text injection can't invent a new action). Owner agent tools are a fixed allow-list; the model cannot call arbitrary routes.
- **Low-confidence reprompt.** STT or intent confidence below threshold → ask user to repeat, never auto-commit a guess.
- **Cost guard.** Haiku for the high-volume worker path; Sonnet only for owner queries. Rate-limit per user.

---

## 6. New Surfaces

### API routes
- `POST /api/voice/transcribe` — audio → text (Sarvam).
- `POST /api/voice/intent` — text → bounded action (Haiku).
- `POST /api/agent` — text → tool-calling agent turn (Sonnet).

### Frontend
- `components/voice/MicButton.tsx` — push-to-talk, records, uploads, shows live state.
- `components/voice/ConfirmCard.tsx` — renders the `ConfirmCard` contract; one component for both paths.
- `components/agent/ChatPanel.tsx` — owner chat/voice surface (admin shell), threaded.
- Mic button dropped into existing `/worker` logging screens + admin topbar.

### Libs
- `lib/stt.ts` — Sarvam client + fallback.
- `lib/intent.ts` — Haiku call + closed-schema validation.
- `lib/agentTools.ts` — tool definitions (read + write), each mapping to an existing route.

### Env (new)
```
SARVAM_API_KEY=...
ANTHROPIC_API_KEY=...
VOICE_CONFIDENCE_THRESHOLD=0.6   # tunable
```

---

## 7. Error Handling

| Failure | Behavior |
|---|---|
| STT low confidence | Reprompt "didn't catch that, repeat?" — no commit |
| Intent unknown action | "I can't do that yet" + list supported actions |
| Param missing (no batch #) | Ask the one missing slot, keep rest |
| DB sanity fail (batch doesn't exist) | Reject card, show why |
| API route error on commit | Surface route error verbatim; nothing logged as success |
| Sarvam/Anthropic down | Fall back to typed text input (forms still exist) |
| Wrong-role action | Server rejects (defense in depth), card never shown |

The existing forms remain fully functional — voice is strictly additive. If any service is down, the ERP works exactly as today.

---

## 8. Testing

- **Intent-parse unit tests** (extend `npm test`): fixture transcripts (gu/hi/en code-mix) → expected `{action, params}`. Cover mis-hear numbers, missing slots, role violations.
- **Tool-call tests**: mocked agent turns → assert correct tool + params, assert write tools never auto-commit.
- **STT integration**: small recorded clip set, assert confidence + transcript shape (run manually / CI-optional, needs API key).
- **E2E** (extend `scripts/e2e.mjs`): voice intent → confirm → existing route → DB state, for `log_hanks` happy path.
- **Security tests**: prompt-injection attempts on worker path must not escape the action enum; worker JWT cannot trigger admin write tools.

---

## 9. Rollout

1. **Phase 1 — SP1 + SP2.** Voice logging for one worker role (hanks) behind a feature flag. Dogfood on floor, tune STT threshold + intent prompts on real accents.
2. **Phase 2 — extend SP2.** Coning + dyeing actions once hanks is solid.
3. **Phase 3 — SP3.** Owner agent: read tools first (zero risk), then guarded write tools one at a time (challan → payment → approval).
4. **Phase 4 (later, out of scope now).** Optional TTS replies, WhatsApp channel, offline queue.

Feature-flagged throughout so the existing ERP is never blocked by voice maturity.

---

## 10. Open Questions / Risks

- **Sarvam Gujarati accuracy on real factory noise** — unknown until dogfooded; mitigated by confirm card + reprompt. May need a noise-gate or push-to-talk discipline.
- **Number disambiguation** (baar/char/etc.) — confirm card is the safety net; consider always echoing the number back in words on the card.
- **Anthropic + Sarvam cost at floor volume** — Haiku keeps worker path cheap; monitor + rate-limit.
- **iOS Safari mic quirks** — floor is Android, owner may use iPhone; test owner path on iOS.
- **Per-request session revocation** still pending from earlier audit — relevant since voice expands what a stolen token can do. Track alongside.

---

## Appendix — Worker action schema (v1 draft)

```ts
type WorkerAction =
  | { action: "log_hanks";   params: { batch_no: number; kg: number } }
  | { action: "log_coning";  params: { batch_no: number; kg: number } }
  | { action: "log_dyeing";  params: { batch_no: number; kg: number; shade?: string } }
  | { action: "approve_hanks"; params: { id: number } }
  | { action: "check_my_pending"; params: {} };
```

Closed union — Haiku output validated against this; anything else → "not supported".
