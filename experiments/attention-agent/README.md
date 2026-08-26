# Attention agent pilot

An experimental local-first agent that treats Tending, Swells and Glade as distinct organisational capabilities exposed through MCP.

The organising question is:

> **What deserves attention — and what should happen next?**

The agent is the conversational front door. It is not the database and it does not merge the products.

- **Tending** — relationships and how they change.
- **Swells** — observations, patterns and signals of change.
- **Glade** — decisions, governance and commitments.

The working loop is: **notice → understand → remember → decide → act**.

## What this pilot proves

1. One agent can reason across three existing products without copying all their data into a new central store.
2. Each product can expose a small, semantically meaningful MCP surface rather than generic database CRUD.
3. Read tools can be used freely, while durable writes require explicit human confirmation.
4. The same agent-side code can connect to local stdio MCP servers today or remote Streamable HTTP MCP endpoints later.
5. A local agent process can use either a local OpenAI-compatible model server or a cloud model; where the model runs is independent of where the MCP tools run.

## Tool surface

### Tending

- `tending_search_connections`
- `tending_recent_moments`
- `tending_recent_observations`
- `tending_create_moment` **(confirmed write)**

### Swells

- `swells_list_spaces`
- `swells_recent_observations`
- `swells_signals`
- `swells_create_observation` **(confirmed write)**

### Glade

- `glade_list_decisions`
- `glade_get_decision`
- `glade_list_open_actions`
- `glade_list_meetings`
- `glade_list_documents`
- `glade_draft_decision_candidate` **(reviewable draft only; does not write)**

Glade is intentionally read/draft-only in this first slice. Recording a governance decision is a stronger act than capturing a Moment or Observation, so the pilot surfaces a candidate rather than manufacturing a decision from ambient activity.

## Run locally

This experiment is isolated from the main `good-ship-local-tools` application.

```bash
cd experiments/attention-agent
npm install
cp .env.example .env
```

Configure `.env` with:

- a Tending API key for the pilot organisation;
- the temporary Swells agent API token and optional default space ID;
- a Glade API key for the pilot space;
- a tool-capable model.

Then run Tending, Swells and Glade locally (or point the base URLs at deployed pilot environments) and start:

```bash
npm run check
npm run agent
```

The agent starts the three MCP adapters itself. Do **not** separately run the `mcp:*` scripts unless debugging an individual server.

### Local model

Any OpenAI-compatible endpoint with function/tool calling can be used. For example, point `AGENT_BASE_URL` at an Ollama or LM Studio OpenAI-compatible endpoint and set `AGENT_MODEL` to a locally installed tool-capable model. `AGENT_API_KEY` can be blank if that local endpoint does not require one.

### Cloud model

Set:

```env
AGENT_BASE_URL=https://api.openai.com/v1
AGENT_MODEL=<tool-capable-model>
AGENT_API_KEY=<key>
```

The agent process still runs locally; only model inference is remote.

## Suggested pilot conversations

Try questions that genuinely cross product boundaries:

```text
Prepare me for my next conversation with Amina. What should I remember and what wider changes might be relevant?
```

```text
What seems to deserve attention across relationships, current signals and open decisions?
```

```text
I just spoke to Amina. She is going to introduce us to Northbank, and she said three councils are hesitating because funding feels uncertain. The partnership proposal may need changing.
```

For the last example the useful behaviour is not to duplicate the paragraph everywhere. The agent should distinguish:

- a relationship development that may deserve a Tending Moment;
- a wider pattern that may deserve a Swells Observation;
- a possible governance question that should become a Glade decision candidate for review.

If it tries to create a Tending Moment or Swells Observation, the CLI shows the exact proposed content and waits for `y`/`yes` before calling the write tool.

## Cloud-agent path

There is deliberately no second “cloud agent architecture”. The same agent/tool contracts should move between environments.

By default each product adapter is a local stdio MCP process. If any of these are set:

```env
TENDING_MCP_URL=https://.../mcp
SWELLS_MCP_URL=https://.../mcp
GLADE_MCP_URL=https://.../mcp
```

the agent connects to that product over Streamable HTTP instead. Optional bearer tokens use the corresponding `*_MCP_BEARER_TOKEN` variables.

That allows a later always-on agent or realtime voice shell to use the same tools. The work needed before that is primarily authentication, user/organisation routing, permission policy, audit/retention and deployment — not a rewrite of the product semantics.

## Pilot boundaries

- No central mega-database.
- No automatic promotion of Calendar/email/document activity into product records.
- No automatic Glade decisions.
- No fuzzy cross-product identity matching yet.
- No background autonomy beyond what each host explicitly invokes.
- No voice UI yet; voice is a later shell over the same agent/tool loop.
- The Swells agent API is a temporary single-user pilot bridge and should be replaced by first-class API-key/OAuth auth before broader use.

## Where ContextEvent fits

The Calendar pilot remains useful. `ContextEvent` is the attention/event feed — “what just happened?”. MCP answers “what can I read or do?”. The agent interprets the event against durable product context and decides what, if anything, to propose.

```text
Calendar / mail / docs / other tools
             │
        ContextEvent
             │
             ▼
       attention agent
       /      |       \
 Tending    Swells    Glade
 relationship sensing governance
   memory     memory    memory
```

That separation is intentional: eventing, reasoning and durable memory remain different concerns.
