# FundzWatch MCP Server

Real-time business event intelligence for AI agents via [Model Context Protocol](https://modelcontextprotocol.io).

Get AI-scored sales leads, funding rounds, acquisitions, executive hires, and market intelligence directly in Claude, Cursor, Windsurf, or any MCP-compatible client.

## Quick Start

### 1. Get a Free API Key

Sign up at [fundzwatch.ai/onboarding](https://fundzwatch.ai/onboarding) (no credit card required).

### 2. Add to Claude Desktop

Edit your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

### 3. Start Asking

- "Find me companies that just raised Series B in healthtech"
- "Show me the largest funding rounds this week"
- "Get my AI-scored leads with a score above 70"
- "What's happening in the market today?"
- "Track stripe.com and github.com on my watchlist"

## Available Tools

| Tool | Description |
|------|-------------|
| `get_scored_leads` | AI-scored leads matched to your ICP with buyer intent, buying stage, and outreach recommendations |
| `get_events` | Real-time business events: funding, acquisitions, hiring, contracts, product launches |
| `get_market_pulse` | Market activity overview with totals, trends, and largest rounds |
| `get_market_brief` | AI-generated strategic intelligence brief |
| `manage_watchlist` | Add, remove, or list tracked companies |
| `get_watchlist_events` | Events for your tracked companies |
| `get_usage` | Check API usage and limits |

## Use with Cursor / Windsurf

Add to your MCP settings:

```json
{
  "fundzwatch": {
    "command": "npx",
    "args": ["-y", "@fundzwatch/mcp-server"],
    "env": {
      "FUNDZWATCH_API_KEY": "fundz_test_your_key_here"
    }
  }
}
```

## Pricing

| Tier | Price | API Calls/mo | AI Score Calls/mo |
|------|-------|-------------|-------------------|
| Sandbox | Free | 500 | 50 |
| Growth | $199/mo | 10,000 | 500 |
| Scale | $599/mo | 100,000 | 5,000 |
| Enterprise | Custom | Unlimited | Unlimited |

## What is FundzWatch?

[FundzWatch.ai](https://fundzwatch.ai) provides real-time business event intelligence for AI agents and sales teams:

- **AI-Scored Leads**: Companies scored daily against your ICP using Claude AI, with buyer intent signals, buying stage analysis, and outreach recommendations
- **Event Feeds**: Real-time funding rounds, acquisitions, executive moves, government contracts, and product launches
- **Predictive Intelligence**: ML models predicting which companies are likely to make moves (82% accuracy)
- **Market Briefs**: AI-generated daily strategic intelligence briefings

Built by [Fundz](https://fundz.net), tracking 50M+ business events since 2017.

## License

MIT
