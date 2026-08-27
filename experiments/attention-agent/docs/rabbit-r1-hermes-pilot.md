# Rabbit r1 + Hermes pilot

Attention remains the organisational reasoning layer. Hermes is the MCP host that Rabbit r1 can control by voice.

## Architecture

```
Rabbit r1
  ↓ voice
rabbit agent
  ↓
Hermes Agent
  ↓ remote MCP
Attention
  ├─ Calendar context
  ├─ Tending
  ├─ Swells
  └─ Glade
```

Do not configure Tending, Swells and Glade directly in the r1-facing Hermes session. Expose only Attention so the semantic routing and approval policy stay in one place.

## Prerequisites

Rabbit currently requires the third-party agent to be installed and running on a computer. Register that computer as a Rabbit node from rabbithole Settings → Nodes → Register node, then use Rabbit's agent manager to connect r1 to Hermes.

Hermes supports remote HTTP MCP servers and per-server tool allowlists.

## Attention MCP endpoint

```
https://attention-agent-pilot.vercel.app/mcp
```

The pilot accepts the existing Attention pilot key either as:

```
Authorization: Bearer <pilot-key>
```

or:

```
x-pilot-key: <pilot-key>
```

Do not put the key in this repository.

## Hermes configuration

Use an environment variable on the computer running Hermes:

```bash
export ATTENTION_PILOT_KEY="..."
```

Then add Attention to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  attention:
    url: "https://attention-agent-pilot.vercel.app/mcp"
    headers:
      Authorization: "Bearer ${ATTENTION_PILOT_KEY}"
    tools:
      include:
        - attention_ask
        - attention_resolve_approval
      resources: false
      prompts: false
```

Reload MCP in Hermes after changing the configuration.

## Exposed tools

### attention_ask

The normal entry point.

Example:

> Prepare me for my next important conversation.

It returns either:

- a final Attention response; or
- a pending approval with encrypted state, a tool-call ID, the proposed arguments, and a short prompt to ask the human.

### attention_resolve_approval

Use only after the user has explicitly answered the approval prompt.

The tool requires `confirmedByUser: true` as an explicit handoff marker.

One approval may lead to another. For example:

```
"I met Maya..."
  → Create Maya in Tending?
  → yes
  → Keep this relationship moment?
  → yes
  → Create this follow-up action in Glade?
  → yes
```

Each step must be confirmed separately.

## Voice behaviour

Hermes should keep voice responses short when an approval is pending.

Good:

> I found a new relationship with Maya. Create Maya in Tending?

Then:

> Keep today's conversation as a relationship moment?

Then:

> Create the follow-up action due Wednesday?

Avoid reading internal tool names, UUIDs, state tokens or raw JSON aloud.

## Useful r1 tests

### Attention scan

> What deserves attention today?

Expected: near-term Calendar + relevant Tending/Swells/Glade context.

### Meeting preparation

> Prepare me for my next important conversation.

Expected: Calendar identifies the actual event and participants; Tending provides durable relationship context; wider Swells/Glade context is used only if relevant.

### Capture after a conversation

> I just spoke to Sandra. She wants the outline by Wednesday and may introduce me to her programme director.

Expected: relationship memory and concrete commitment are distinguished, with sequential voice approvals.

### Action

> What have I committed to this week?

Expected: Glade actions, informed by Calendar where relevant.

## Security / scope

- Rabbit/Hermes does not receive product API keys.
- Attention retains the product credentials server-side.
- The MCP state token is encrypted with `AGENT_STATE_SECRET`.
- Every durable write remains approval gated.
- Calendar reads are transient context.
- The r1 bridge does not create a second organisational memory store.

## Later

Once this voice path is proven:

1. make approvals more conversational, including Swells space choices;
2. add email search/read;
3. add email drafting;
4. keep actual sending separately approval gated;
5. add calendar creation/update with separate write scope;
6. consider a dedicated OAuth identity for the remote MCP endpoint rather than the pilot key.
