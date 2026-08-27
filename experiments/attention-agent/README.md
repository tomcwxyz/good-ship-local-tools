# Attention agent pilot

A cloud-first experiment in one attention layer across **Tending**, **Swells** and **Glade**, with the same experiment still runnable as a local CLI.

> **What deserves attention — and what should happen next?**

The agent is the conversational front door, not a central database. Tending remains relationship memory; Swells remains sensing; Glade remains governance and decision memory. The working loop is **notice → understand → remember → decide → act**.

## Cloud test — recommended

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftomcwxyz%2Fgood-ship-local-tools%2Ftree%2Fbcd0d7529f82c170a056e1644cad7c8ba67da99d%2Fexperiments%2Fattention-agent&project-name=attention-agent-pilot&repository-name=attention-agent-pilot&env=AGENT_BASE_URL%2CAGENT_MODEL%2CAGENT_API_KEY%2CPILOT_ACCESS_KEY%2CAGENT_STATE_SECRET%2CTENDING_BASE_URL%2CTENDING_API_KEY%2CTENDING_VERCEL_BYPASS_SECRET%2CSWELLS_BASE_URL%2CSWELLS_API_KEY%2CSWELLS_SPACE_ID%2CGLADE_BASE_URL%2CGLADE_API_KEY&envDefaults=%7B%22AGENT_BASE_URL%22%3A%22https%3A%2F%2Fapi.openai.com%2Fv1%22%2C%22TENDING_BASE_URL%22%3A%22https%3A%2F%2Ftending-git-feat-google-context-pilot-toms-projects-822ccd4f.vercel.app%22%2C%22SWELLS_BASE_URL%22%3A%22https%3A%2F%2Fswells.app%22%2C%22GLADE_BASE_URL%22%3A%22https%3A%2F%2Fourglade.app%22%7D&envDescription=Pilot%20credentials%20for%20the%20model%20plus%20scoped%20Tending%2C%20Swells%20and%20Glade%20access.%20Preview%20bypass%20secrets%20keep%20the%20product%20PR%20deployments%20protected.)

The button above uses an immutable commit of the pilot subdirectory, so the cloud test does **not** require merging this PR. Vercel's clone flow will make a small standalone `attention-agent-pilot` repository/project from this experiment and ask for the required secrets. That is the fastest disposable cloud test. If the experiment becomes a product, decide separately whether to keep it standalone or return it to a monorepo.

Deploy `experiments/attention-agent` as the Vercel project root.

Configure:

```env
PILOT_ACCESS_KEY=<long-random-pilot-passphrase>
AGENT_STATE_SECRET=<long-random-secret-at-least-32-characters>

AGENT_BASE_URL=https://api.openai.com/v1
AGENT_MODEL=<tool-capable-model>
AGENT_API_KEY=<model-key>

TENDING_BASE_URL=https://<deployed-tending-pilot>
TENDING_API_KEY=<pilot-org-api-key>

SWELLS_BASE_URL=https://swells.app
SWELLS_API_KEY=<swl_v1 scoped API key>
SWELLS_SPACE_ID=<optional default space uuid>

GLADE_BASE_URL=https://<deployed-glade>
GLADE_API_KEY=<space-api-key>

# Only needed when calling Vercel-protected preview deployments:
TENDING_VERCEL_BYPASS_SECRET=
GLADE_VERCEL_BYPASS_SECRET=
```

The browser asks for the pilot access key. It is kept in session storage only. The server keeps no conversation database: model/tool history is encrypted with `AGENT_STATE_SECRET` and returned to the browser as an opaque state token between turns.

Tending can remain on its protected Vercel PR preview, using `TENDING_VERCEL_BYPASS_SECRET`. Swells now uses the first-class API v1 on `https://swells.app`, so it no longer needs a preview deployment, a Swells bypass secret, or the temporary single-user agent bridge.

Read tools run without interruption. A proposed Tending connection, Tending Moment or Swells Observation pauses the agent and appears as an approval card. Swells approval cards expose the destination space before writing. Glade decision candidates also pause as structured review cards, but do not persist anything. Approve to continue or write through the normal product API, or choose **Not now**.

The web pilot also exposes a collapsible evaluation trace for the current encrypted conversation. It records which semantic tools were used and whether each step was read, awaiting approval/review, written, reviewed, declined or failed. It does not copy raw product records into a new analytics store.

### Cloud transport

Cloud mode now uses **product-native remote MCP by default**.

The existing product base URLs and API keys are enough:

```text
Attention
  ├── Streamable HTTP MCP → Tending
  ├── Streamable HTTP MCP → Swells
  └── Streamable HTTP MCP → Glade
```

The MCP endpoints are derived as `<product-base-url>/mcp`, and each product's existing scoped API key is reused as the bearer credential. Tending's protected preview also receives the existing Vercel bypass header.

Explicit `*_MCP_URL` / `*_MCP_BEARER_TOKEN` variables remain available as overrides.

For diagnostics or rollback, set:

```env
ATTENTION_TOOL_MODE=direct-api
```

That restores the previous direct HTTPS API tool hub without changing the UI or reasoning layer.

The Attention service itself is also a remote MCP server at `/mcp`, exposing only `attention_ask` and `attention_resolve_approval` for clients such as Hermes / Rabbit r1.

## Local option

```bash
cd experiments/attention-agent
npm install
cp .env.example .env
npm run check
npm run agent
```

The local CLI starts the three stdio MCP adapters itself unless remote `*_MCP_URL` values are present. Product base URLs can point at local apps or deployed cloud apps.

A local OpenAI-compatible model can be used via Ollama, LM Studio or llama.cpp; a hosted OpenAI-compatible endpoint works too.

## Tool surface

**Tending / Calendar**
- `tending_search_connections`
- `tending_create_connection` — confirmed write
- `tending_get_relationship_context`
- `tending_recent_moments`
- `tending_recent_observations`
- `tending_create_moment` — confirmed write
- `calendar_find_events` — transient external context

**Swells**
- `swells_list_spaces`
- `swells_recent_observations`
- `swells_signals`
- `swells_create_observation` — confirmed write

**Glade**
- `glade_list_decisions`
- `glade_get_decision`
- `glade_list_open_actions`
- `glade_create_action` — confirmed write; private by default
- `glade_update_action` — confirmed write
- `glade_list_meetings`
- `glade_list_documents`
- `glade_draft_decision_candidate` — reviewable draft only; does not write

Attention can create and maintain concrete commitments in Glade, but it still cannot silently create governance decisions. Decision candidates remain review-only.

## Suggested tests

```text
What seems to deserve attention across relationships, current signals and open decisions?
```

```text
Prepare me for my next conversation with Amina. What should I remember and what wider changes might be relevant?
```

For a named relationship the agent should resolve the connection in Tending and then use relationship-specific context.

```text
I just spoke to Amina. She is going to introduce us to Northbank, and she said three councils are hesitating because funding feels uncertain. The partnership proposal may need changing.
```

A good result distinguishes:
- a relationship development that may deserve a Tending Moment;
- a wider pattern that may deserve a Swells Observation;
- a governance question that should remain a Glade decision candidate until reviewed.

## Pilot boundaries

- No central copy of product data.
- Product credentials remain server-side and are reused as scoped MCP bearer credentials.
- No persistent server-side conversation database.
- Browser agent state is encrypted and authenticated.
- A separate pilot key gates chat and status routes.
- Reads can execute automatically; writes fail safe to approval.
- New Tending relationships can be proposed when no existing connection resolves, but creation still requires approval.
- Swells writes always use an explicit reviewable destination space.
- Glade decision candidates are structured review objects; there are still no automatic Glade decisions.
- The evaluation trace is derived from encrypted conversation state rather than stored in a separate database.
- No background autonomy.
- Tending, Swells and Glade expose product-native remote MCP endpoints over their existing scoped APIs.
- External content is treated as context, not as instructions.

## ContextEvent

`ContextEvent` remains the attention/event feed — **what just happened?** Tool/MCP access answers **what can I read or do?**

```text
Calendar / mail / docs
        │
   ContextEvent
        │
        ▼
 attention agent
   /    |    \
Tending Swells Glade
```

Calendar can now be read by Attention through Tending's MCP as transient ContextEvent-shaped evidence. The next integration tranche is email: explicit/user-invoked reads first, then drafting, with sending separately approval-gated.
