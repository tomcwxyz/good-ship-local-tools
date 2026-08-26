# Architecture notes

## One agent, several lenses

The pilot deliberately presents one agent to the person using it. Tending, Swells and Glade are not sub-agents with personalities; they are durable capabilities with different meanings.

```text
                           person
                             │
                       text / voice
                             │
                             ▼
                     ATTENTION AGENT
                what deserves attention?
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
       Tending             Swells             Glade
    relationships          sensing          governance
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                  email · calendar · docs
                   tasks · CRM · other tools
```

## Layers

| Layer | Question | Pilot implementation |
| --- | --- | --- |
| Context/eventing | What just happened? | `ContextEvent` Calendar pilot |
| Tool protocol | What can I read or do? | MCP |
| Identity | Who/what is this? | Existing product identities; exact matches only |
| Policy | Am I allowed to do it? | Product auth + agent confirmation for durable writes |
| Reasoning | What might this mean? | Attention agent model loop |
| Durable meaning | What should be kept? | Tending Moment, Swells Observation, Glade decision/governance records |

## Local pilot

```text
local CLI agent
    │
    ├─ stdio ─ Tending MCP adapter ─ HTTPS/API ─ Tending
    ├─ stdio ─ Swells MCP adapter  ─ HTTPS/API ─ Swells
    └─ stdio ─ Glade MCP adapter   ─ HTTPS/API ─ Glade

model: local OpenAI-compatible endpoint OR cloud model
```

Product credentials remain environment variables in the local process. The adapters translate product APIs into semantically meaningful MCP tools.

## Cloud-compatible evolution

The client already accepts remote Streamable HTTP MCP URLs. A cloud/realtime host should therefore preserve the same logical tools:

```text
cloud / realtime agent host
    │
    ├─ HTTP MCP ─ Tending
    ├─ HTTP MCP ─ Swells
    └─ HTTP MCP ─ Glade
```

Before exposing those endpoints broadly, add proper per-user OAuth/API-key authorisation, scope discovery, tenant routing, audit logs and revocation. Do not copy the pilot's shared Swells secret into a multi-user service.

## Autonomy policy for the pilot

Three levels are useful:

1. **Read** — may run without confirmation when relevant to the user's request.
2. **Propose** — agent may create an in-conversation candidate/draft without changing a product.
3. **Write** — requires explicit confirmation at the moment of the write.

Future low-risk actions might be user-configurable, but the first pilot should collect evidence about which actions people trust before adding standing permissions.

## What not to centralise

Do not make the agent store canonical copies of Moments, Observations or Decisions. At most it needs short-lived conversation/tool state and an audit trail of what it called. Product records remain authoritative in their product.

Likewise, MCP tool names should describe domain actions rather than database tables. `tending_create_moment` says more about meaning and policy than `insert_record` ever could.
