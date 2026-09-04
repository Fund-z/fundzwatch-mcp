# FundzWatch MCP Server

[![npm version](https://img.shields.io/npm/v/@fundzwatch/mcp-server.svg)](https://www.npmjs.com/package/@fundzwatch/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/node/v/@fundzwatch/mcp-server.svg)](https://www.npmjs.com/package/@fundzwatch/mcp-server)

### Listed on

[![npm](https://img.shields.io/badge/npm-@fundzwatch/mcp--server-red?logo=npm)](https://www.npmjs.com/package/@fundzwatch/mcp-server)
[![Smithery](https://img.shields.io/badge/Smithery-live-brightgreen)](https://smithery.ai/servers/fundzwatch/fundzwatch-mcp)
[![Cline Marketplace](https://img.shields.io/badge/Cline_Marketplace-submitted-yellow)](https://cline.bot)
[![awesome-mcp-servers](https://img.shields.io/badge/awesome--mcp--servers-listed-brightgreen)](https://github.com/punkpeye/awesome-mcp-servers)
[![Glama](https://img.shields.io/badge/Glama-claimed-brightgreen)](https://glama.ai/mcp/servers/Fund-z/fundzwatch-mcp)

The key-less AI-agent gateway to **[FundzWatch](https://fundzwatch.ai)** answer sections — real-time business-event intelligence via the [Model Context Protocol](https://modelcontextprotocol.io).

Give Claude, Cursor, Windsurf, Cline, or any MCP client live access to verified funding rounds, executive moves, UCC refinancing windows, Form 5500 benefit-plan signals, and AI-scored leads matched to your ICP.

**7 of the 14 tools work with no API key, no signup, and no account** — point your agent at the server and it returns live, daily-rescored "answer section" data on the first run, each row carrying the Fundz page that supports it. The other 7 (AI-scored leads, watchlists, full event feeds) need a Fundz Pro or Strategic seat.

## Quick Start

### Option A — `npx` (Claude Desktop, Cursor, Windsurf, Cline)

No install needed. Add this to your client's MCP config:

```json
{
  "mcpServers": {
    "fundzwatch": {
      "command": "npx",
      "args": ["-y", "@fundzwatch/mcp-server"],
      "env": {
        "FUNDZWATCH_API_KEY": "fundz_test_your_key_here"
      }
    }
  }
}
```

Config file locations for Claude Desktop:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

> The `env` block is **optional**. Omit it entirely and the 7 key-less tools still return live data. The keyed tools (AI-scored leads, watchlists, full event feeds) require a Fundz **Pro or Strategic** seat — see **[fundz.net/pricing](https://www.fundz.net/pricing)**.

For Cursor / Windsurf / Cline, use the same block under their MCP settings (the inner `"fundzwatch": { ... }` object).

### Option B — Smithery (hosted, one-click)

FundzWatch is live on Smithery: **[smithery.ai/servers/fundzwatch/fundzwatch-mcp](https://smithery.ai/servers/fundzwatch/fundzwatch-mcp)**

```bash
npx -y @smithery/cli install @fundzwatch/mcp-server --client claude
```

### Then just ask

- "Which companies raised in the last year **and** are hiring right now?" *(no key)*
- "Show me UCC liens lapsing in the next 12 months in California." *(no key)*
- "Find recently funded companies with a Form 5500 plan and a named carrier." *(no key)*
- "Get my AI-scored leads with buyer-intent above 70." *(key)*
- "Track stripe.com and github.com and alert me on new events." *(key)*

## Tools (14)

### Key-less — no API key required

Live teasers off the Fundz answer sections (top results + cohort size, re-scored daily). California + Colorado UCC coverage.

| Tool | What it answers |
|------|-----------------|
| `get_funded_and_hiring` | Companies funded in the last 12 months **and** actively hiring — the strongest buying window, scored daily. |
| `get_refinancing_windows` | Companies whose UCC-1 liens lapse within 12 months (Renewal Radar) — dated refinancing windows. |
| `get_stacked_borrowers` | Companies with active secured debt from 2+ distinct lenders — second-position / consolidation targets. |
| `get_benefit_plans_in_play` | Recently funded companies with a DOL Form 5500 plan: renewal timing, headcount-vs-plan gap, incumbent carrier. |
| `get_money_in_motion` | Companies with a recent exec move **and** recent funding — the wealth-advisor "money in motion" moment. |
| `get_lender_directory` | Directory of 8,600+ UCC secured parties ranked by filing volume, with lapsing-soon exposure. |
| `get_broker_directory` | Directory of 65,000+ benefits brokers (Form 5500 Schedule A), ranked by filings carried, with commission volume. |

### Keyed — require `FUNDZWATCH_API_KEY`

| Tool | What it answers |
|------|-----------------|
| `get_scored_leads` | AI-scored sales leads matched to your ICP, with buyer intent, buying stage, and recommended outreach. |
| `get_events` | Real-time business events: funding, acquisitions, exec hires, government contracts, product launches. |
| `get_market_pulse` | Market activity overview: funding totals, acquisitions, exec moves, contracts, launches (7d / 30d). |
| `get_market_brief` | Today's AI-generated strategic intelligence brief on the most important market movements. |
| `manage_watchlist` | Add, remove, or list tracked companies; tracked companies generate new-event alerts. |
| `get_watchlist_events` | Recent events for the companies on your watchlist. |
| `get_usage` | Check your API usage, limits, and current tier. |

## What is FundzWatch?

[FundzWatch.ai](https://fundzwatch.ai) is the AI-agent front door to Fundz's verified business-event intelligence — funding rounds, acquisitions, executive moves, government contracts, hiring signals, UCC liens, and DOL Form 5500 benefit-plan filings, fused into cross-dataset "answer sections" that no single-source lookup reproduces. Everything is re-scored daily.

- **Key-less answer sections** — point an agent at the server and get live data on day one, no signup.
- **AI-scored leads** — companies scored against your ICP with buyer-intent and outreach guidance (Pro or Strategic seat).
- **Cross-dataset cohorts** — funded-and-hiring, money-in-motion, refinancing windows, benefit-plans-in-play.
- **Who-finances-whom** — lender (8,600+) and broker (65,000+) directories from UCC and Form 5500.

The 7 key-less tools need nothing at all. Keyed tools require a Pro or Strategic seat: **[fundz.net/pricing](https://www.fundz.net/pricing)**.

The full scored feeds, ICP filters, contact data, and daily alerts live in the Fundz app — **[app.fundz.net](https://app.fundz.net)**, Strategic plan ($149/mo).

Built by [Fundz](https://fundz.net) — millions of business events analyzed since 2017.

## Tutorials

- [Build an AI SDR Agent with CrewAI + FundzWatch](https://github.com/Fund-z/fundzwatch-python/blob/main/tutorials/build-ai-sdr-crewai.md)
- [Real-Time Funding Alerts with LangChain + FundzWatch](https://github.com/Fund-z/fundzwatch-python/blob/main/tutorials/langchain-funding-alerts.md)
- [Turn Claude into Your Business Intelligence Analyst with MCP](https://github.com/Fund-z/fundzwatch-python/blob/main/tutorials/mcp-claude-business-intelligence.md)

## License

MIT
