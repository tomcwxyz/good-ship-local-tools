# Attention integrations: calendar, email and r1

## Working principle

Attention should not become the database for everything the user touches.

The shape is:

```
external tools
  ├─ calendar
  ├─ email
  ├─ documents / notes
  └─ other work systems
        ↓
capability + ContextEvent layer
        ↓
Attention
  ├─ notice → Swells
  ├─ remember → Tending
  ├─ decide / commit → Glade
  └─ act → external tools
```

Products keep their meanings. External systems remain the place where work happens.

## 1. Calendar

### Read

Initial tools:

- `calendar_list_events`
- `calendar_get_event`
- `calendar_find_next_meeting`

Use them for:
- preparation;
- finding upcoming commitments;
- relating people to scheduled conversations;
- understanding whether something is genuinely upcoming.

Calendar events are evidence, not Moments.

### Ambient context

Calendar is the best first ambient source because the privacy boundary can be narrow and understandable.

Use the existing `ContextEvent` contract:

```
Google Calendar event
  → normalise
  → ContextEvent
  → Attention judgement
  → nothing / Tending proposal / Swells proposal / Glade action or decision candidate
```

Only ended meetings should become retrospective sensing/relationship evidence by default.

Upcoming meetings remain transient context for preparation.

### Write

Add explicit, approval-gated tools later:

- `calendar_create_event`
- `calendar_update_event`

A Glade action is not the same thing as a calendar event. An action can optionally lead to a calendar write when a time block or meeting is actually needed.

## 2. Email

Email should start more conservatively than Calendar.

### Read

Initial tools:

- `email_search`
- `email_get_thread`
- `email_get_message`

Initial policy:
- user-invoked queries;
- optionally a user-selected label / mailbox;
- never ingest the whole inbox into organisational memory;
- preserve sender, recipients, date, subject and message/thread reference as provenance;
- minimise quoted body content.

### Ambient context

Later:

```
labelled / explicitly selected email
  → ContextEvent
  → Attention judgement
  → product proposal
```

Do not treat receipt of an email as evidence that it deserves durable memory.

### Write

Useful explicit action tools:

- `email_draft`
- `email_send_draft`

Drafting can happen automatically when requested. Sending should remain an approval-gated external action.

This extends the loop:

```
notice → understand → remember → decide → commit → act
```

## 3. Capability boundary

Attention should receive tools with semantic names, not Google/Microsoft-specific names.

For example:

```
calendar_find_events
calendar_create_event
email_search
email_draft
email_send_draft
```

Adapters can sit behind them:

```
semantic tool
  ├─ Google Calendar / Gmail
  ├─ Microsoft 365
  └─ future providers
```

This preserves the same architecture as Tending / Swells / Glade: one reasoning layer, replaceable adapters.

## 4. Provenance

Every durable record created from external context should be able to retain a small provenance reference:

```json
{
  "source": "attention",
  "contextEventId": "...",
  "origin": {
    "system": "calendar|email|tending|swells|glade",
    "recordId": "..."
  }
}
```

The durable product record should not duplicate the original message/event body.

For cross-product chains, provenance should make it possible to say:

```
Tending Moment
  ↳ led to Glade action
```

without making either product depend on the other.

## 5. Rabbit r1

### Recommended route

Keep Attention as the agent. Treat r1 as a voice client.

As of rabbitOS 2.3, r1 can voice-control third-party agents including OpenClaw, Hermes Agent and Claude Code through rabbit agent.

The cleanest pilot route is:

```
Rabbit r1
   ↓ voice
OpenClaw or Hermes
   ↓
Attention HTTP/MCP endpoint
   ↓
Tending / Swells / Glade / Calendar / Email
```

This avoids putting Good Ship semantics inside Rabbit-specific automation.

### Why OpenClaw/Hermes first

- r1 already supports them;
- Attention already has MCP as a target architecture;
- the same Attention server can support browser, CLI, r1 and later other clients;
- Rabbit becomes replaceable hardware rather than a platform dependency.

### r1 interaction model

Good voice flows are short:

- "What deserves attention today?"
- "Prepare me for my conversation with Sandra."
- "I just spoke to Sandra. She wants the outline Wednesday and may introduce me to her programme director."
- "What have I committed to this week?"
- "Draft the email to Sandra."

Approval needs special treatment on r1.

For low-friction review:

```
Attention: "I think this should become a relationship moment and an action due Wednesday. Keep both?"
User: "Yes."
```

For ambiguous routing:

```
Attention: "I can keep this observation in Strategy or Field Station. Which?"
```

The web UI remains the richer review surface; r1 gets voice-friendly confirmations.

### Do not

- use Rabbit Teach Mode as the canonical Attention implementation;
- automate the Attention web UI with LAM/DLAM as the primary integration;
- keep separate r1-specific organisational memory;
- bypass Attention's approval policy because the input came from voice.

Teach Mode / DLAM may still be useful as fallback bridges for unsupported applications.

## 6. Recommended sequence

1. Finish editable Glade action approval fields.
2. Add provenance support to Glade actions and Tending Moments.
3. Add direct Calendar read tools to Attention.
4. Route Calendar ContextEvents through Attention rather than independently into products.
5. Add explicit Calendar write tools.
6. Add user-invoked Email read tools.
7. Add email draft/send as approval-gated external actions.
8. Expose Attention through remote MCP.
9. Connect r1 through OpenClaw or Hermes.
10. Only then explore more ambient email sensing.

## Pilot principle

The success criterion is not "Attention can access lots of apps."

It is:

> Attention can move between evidence, memory, decisions, commitments and actions without flattening them into one system or acting without an understandable approval boundary.
