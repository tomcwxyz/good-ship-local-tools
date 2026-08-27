# Attention agent pilot

A cloud-first experiment in one attention layer across **Tending**, **Swells** and **Glade**, with the same experiment still runnable as a local CLI.

> **What deserves attention — and what should happen next?**

The agent is the conversational front door, not a central database. Tending remains relationship memory; Swells remains sensing; Glade remains governance and decision memory. The working loop is **notice → understand → remember → decide → act**.

## Cloud test — recommended

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftomcwxyz%2Fgood-ship-local-tools%2Ftree%2Fbcd0d7529f82c170a056e1644cad7c8ba67da99d%2Fexperiments%2Fattention-agent&project-name=attention-agent-pilot&repository-name=attention-agent-pilot&env=AGENT_BASE_URL%2CAGENT_MODEL%2CAGENT_API_KEY%2CPILOT_ACCESS_KEY%2CAGENT_STATE_SECRET%2CTENDING_BASE_URL%2CTENDING_API_KEY%2CTENDING_VERCEL_BYPASS_SECRET%2CSWELLS_BASE_URL%2CSWELLS_AGENT_API_TOKEN%2CSWELLS_SPACE_ID%2CSWELLS_VERCEL_BYPASS_SECRET%2CGLADE_BASE_URL%2CGLADE_API_KEY&envDefaults=%7B%22AGENT_BASE_URL%22%3A%22https%3A%2F%2Fapi.openai.com%2Fv1%22%2C%22TENDING_BASE_URL%22%3A%22https%3A%2F%2Ftending-git-feat-google-context-pilot-toms-projects-822ccd4f.vercel.app%22%2C%22SWELLS_BASE_URL%22%3A%22https%3A%2F%2Fundercurrent-git-feat-context-eve-b5e0f4-toms-projects-822ccd4f.vercel.app%22%2C%22GLADE_BASE_URL%22%3A%22https%3A%2F%2Fourglade.app%22%7D&envDescription=Pilot%20credentials%20for%20the%20model%20plus%20scoped%20Tending%2C%20Swells%20and%20Glade%20access.%20Preview%20bypass%20secrets%20keep%20the%20product%20PR%20deployments%20protected.)

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

SWELLS_BASE_URL=https://<deployed-swells-pilot>
SWELLS_AGENT_API_TOKEN=<temporary-pilot-token>
SWELLS_SPACE_ID=<space-uuid>

GLADE_BASE_URL=https://<deployed-glade>
GLADE_API_KEY=<space-api-key>

# Only needed when calling Vercel-protected preview deployments:
TENDING_VERCEL_BYPASS_SECRET=
SWELLS_VERCEL_BYPASS_SECRET=
GLADE_VERCEL_BYPASS_SECRET=
```

The browser asks for the pilot access key. It is kept in session storage only. The server keeps no conversation database: model/tool history is encrypted with `AGENT_STATE_SECRET` and returned to the browser as an opaque state token between turns.

Tending and Swells can remain on protected Vercel PR previews. Generate a **Protection Bypass for Automation** secret on each preview project and give the agent the corresponding `*_VERCEL_BYPASS_SECRET`; it sends the `x-vercel-protection-bypass` header server-to-server. There is no need to make those previews public or merge their pilot PRs.

Read tools run without interruption. A proposed Tending Moment or Swells Observation pauses the agent and appears as an approval card. Approve to write it through the normal product API, or choose **Not now** and let the agent continue.

### Cloud transport

For the quickest test, cloud mode uses the existing product HTTPS APIs through a direct tool hub that mirrors the MCP tool contracts.

When all three product MCP URLs are configured:

```env
TENDING_MCP_URL=https://.../mcp
SWELLS_MCP_URL=https://.../mcp
GLADE_MCP_URL=https://.../mcp
```

the same web agent switches to Streamable HTTP MCP. No UI or reasoning rewrite is needed.

```text
now:   cloud agent → semantic tools → product HTTPS APIs
later: cloud agent → same tools     → product remote MCP
```

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

**Tending**
- `tending_search_connections`
- `tending_get_relationship_context`
- `tending_recent_moments`
- `tending_recent_observations`
- `tending_create_moment` — confirmed write

**Swells**
- `swells_list_spaces`
- `swells_recent_observations`
- `swells_signals`
- `swells_create_observation` — confirmed write

**Glade**
- `glade_list_decisions`
- `glade_get_decision`
- `glade_list_open_actions`
- `glade_list_meetings`
- `glade_list_documents`
- `glade_draft_decision_candidate` — reviewable draft only; does not write

Glade stays read/draft-only in this slice. Recording a governance decision is a stronger act than capturing a Moment or Observation.

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
- Product API credentials remain server-side.
- No persistent server-side conversation database.
- Browser agent state is encrypted and authenticated.
- A separate pilot key gates chat and status routes.
- Reads can execute automatically; writes fail safe to approval.
- No automatic Glade decisions.
- No background autonomy.
- Swells' agent API remains a temporary single-user bridge.
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

Once the cloud conversation is useful, the next experiment is to route Calendar ContextEvents into this agent rather than independently prompting each product.
