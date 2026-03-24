import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = "https://api.fundz.net/api/v1/watch";

function getApiKey(): string {
  const key = process.env.FUNDZWATCH_API_KEY;
  if (!key) {
    throw new Error(
      "FUNDZWATCH_API_KEY environment variable is required. " +
      "Get a free key at https://fundzwatch.ai/onboarding"
    );
  }
  return key;
}

async function apiRequest(
  method: string,
  path: string,
  params?: Record<string, any>
): Promise<any> {
  const apiKey = getApiKey();
  const url = new URL(`${API_BASE}${path}`);

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "fundzwatch-mcp/1.0.0",
    },
  };

  if (method === "GET" && params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  } else if (method !== "GET" && params) {
    options.body = JSON.stringify(params);
  }

  const response = await fetch(url.toString(), options);

  if (!response.ok) {
    const errBody: any = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`API error ${response.status}: ${errBody.message || errBody.error || response.statusText}`);
  }

  return response.json();
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// ─── Server Setup ───────────────────────────────────────────────────────

const server = new Server(
  { name: "fundzwatch", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─── List Tools ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_scored_leads",
      description:
        "Get AI-scored sales leads based on your ICP (Ideal Customer Profile). " +
        "Returns companies with recent business events scored by AI for buyer intent, " +
        "buying stage, and recommended outreach strategy.",
      inputSchema: {
        type: "object" as const,
        properties: {
          min_score: { type: "number", description: "Minimum buyer intent score (0-100). Default: 0" },
          max_results: { type: "number", description: "Max leads to return (1-50). Default: 25" },
          buying_stages: {
            type: "array",
            items: { type: "string" },
            description: "Filter by buying stage: 'Active Evaluation', 'Decision', 'Research', 'Awareness'",
          },
          industries: {
            type: "array",
            items: { type: "string" },
            description: "Filter by industry (e.g., ['SaaS', 'HealthTech', 'FinTech'])",
          },
        },
      },
    },
    {
      name: "get_events",
      description:
        "Get real-time business events: funding rounds, acquisitions, executive hires, " +
        "government contracts, and product launches. Filter by type, industry, and location.",
      inputSchema: {
        type: "object" as const,
        properties: {
          types: { type: "string", description: "Comma-separated: funding, acquisition, hiring, contract, product_launch. Default: all" },
          days: { type: "number", description: "Look back days (1-90). Default: 7" },
          limit: { type: "number", description: "Max events (1-200). Default: 50" },
          industries: { type: "string", description: "Comma-separated industries" },
          locations: { type: "string", description: "Comma-separated locations" },
        },
      },
    },
    {
      name: "get_market_pulse",
      description:
        "Get real-time market activity overview: funding totals, acquisition counts, " +
        "executive moves, contracts, and product launches for the past 7 and 30 days.",
      inputSchema: { type: "object" as const, properties: {} },
    },
    {
      name: "get_market_brief",
      description:
        "Get today's AI-generated strategic intelligence brief with narrative analysis " +
        "of the most important market movements, patterns, and opportunities.",
      inputSchema: { type: "object" as const, properties: {} },
    },
    {
      name: "manage_watchlist",
      description:
        "Add, remove, or list companies on your watchlist. Tracked companies generate " +
        "alerts when they have new events.",
      inputSchema: {
        type: "object" as const,
        properties: {
          action: {
            type: "string",
            enum: ["list", "add", "remove"],
            description: "Action: 'list' to view, 'add' to track, 'remove' to untrack",
          },
          domains: {
            type: "array",
            items: { type: "string" },
            description: "Company domains for add/remove (e.g., ['stripe.com', 'github.com'])",
          },
        },
        required: ["action"],
      },
    },
    {
      name: "get_watchlist_events",
      description:
        "Get recent events for companies on your watchlist: funding, acquisitions, " +
        "executive hires, contracts.",
      inputSchema: {
        type: "object" as const,
        properties: {
          days: { type: "number", description: "Look back days (1-90). Default: 7" },
          types: { type: "string", description: "Comma-separated event types" },
        },
      },
    },
    {
      name: "get_usage",
      description: "Check your FundzWatch API usage: calls made, limits, current tier.",
      inputSchema: { type: "object" as const, properties: {} },
    },
  ],
}));

// ─── Handle Tool Calls ──────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case "get_scored_leads": {
        const data = await apiRequest("POST", "/signals", {
          min_score: (args as any).min_score ?? 0,
          max_results: (args as any).max_results ?? 25,
          buying_stages: (args as any).buying_stages,
          industries: (args as any).industries,
        });
        const leads = data.signals || [];
        if (leads.length === 0) {
          return textResult("No scored leads found for your current ICP. Leads are generated daily by the AI scoring engine.");
        }
        const summary = leads
          .map(
            (lead: any, i: number) =>
              `${i + 1}. **${lead.company_name}** (Score: ${lead.score}/100)\n` +
              `   Stage: ${lead.buying_stage} | Priority: ${lead.priority}\n` +
              `   Pain Point: ${lead.pain_point}\n` +
              `   Outreach: ${lead.outreach_angle}\n` +
              `   Action: ${lead.recommended_action}\n` +
              (lead.domain ? `   Domain: ${lead.domain}\n` : "") +
              (lead.industries?.length ? `   Industries: ${lead.industries.join(", ")}\n` : "")
          )
          .join("\n");
        return textResult(`Found ${data.signals_found} scored leads (showing ${leads.length}):\n\n${summary}`);
      }

      case "get_events": {
        const data = await apiRequest("GET", "/events", {
          types: (args as any).types,
          days: (args as any).days,
          limit: (args as any).limit,
          industries: (args as any).industries,
          locations: (args as any).locations,
        });
        const events = data.events || [];
        if (events.length === 0) {
          return textResult("No events found matching your filters.");
        }
        const summary = events
          .map((e: any, i: number) => {
            let detail = `${i + 1}. [${e.type.toUpperCase()}] ${e.title}`;
            if (e.amount) detail += ` ($${(e.amount / 1_000_000).toFixed(1)}M)`;
            if (e.series) detail += ` - ${e.series}`;
            if (e.date) detail += ` | ${e.date}`;
            return detail;
          })
          .join("\n");
        return textResult(`${data.total} events found (showing ${events.length}):\n\n${summary}`);
      }

      case "get_market_pulse": {
        const data = await apiRequest("GET", "/market/pulse");
        const p = data.pulse;
        const text =
          `Market Pulse (as of ${p.generated_at}):\n\n` +
          `Funding: ${p.funding.count_7d} rounds this week (${p.funding.count_30d} this month), ` +
          `$${(p.funding.total_raised_7d / 1_000_000).toFixed(0)}M raised this week\n` +
          `Acquisitions: ${p.acquisitions.count_7d} this week (${p.acquisitions.count_30d} this month)\n` +
          `Executive Moves: ${p.executive_moves.count_7d} this week (${p.executive_moves.count_30d} this month)\n` +
          `Contracts: ${p.contracts.count_7d} this week (${p.contracts.count_30d} this month)\n` +
          `Product Launches: ${p.product_launches.count_7d} this week (${p.product_launches.count_30d} this month)\n\n` +
          `Largest Rounds This Week:\n` +
          (p.funding.largest_round || [])
            .map((r: any, i: number) => `  ${i + 1}. ${r.title} - $${(r.amount / 1_000_000).toFixed(1)}M`)
            .join("\n");
        return textResult(text);
      }

      case "get_market_brief": {
        const data = await apiRequest("GET", "/market/brief");
        const brief = data.brief;
        return textResult(
          `Strategic Intelligence Brief (${brief.date}):\n\n${brief.text}\n\n` +
          `Companies mentioned: ${(brief.companies || []).join(", ")}`
        );
      }

      case "manage_watchlist": {
        const action = (args as any).action;
        const domains = (args as any).domains;

        if (action === "list") {
          const data = await apiRequest("GET", "/watchlist");
          const companies = data.companies || [];
          if (companies.length === 0) {
            return textResult("Your watchlist is empty. Add companies with the 'add' action.");
          }
          const list = companies
            .map((c: any) => `- ${c.name || c.domain} (${c.domain})${c.matched ? "" : " [pending match]"}`)
            .join("\n");
          return textResult(`Watchlist (${data.total}/${data.limit} slots used):\n\n${list}`);
        }

        if (!domains || domains.length === 0) {
          return textResult("Please provide domains to add or remove.");
        }

        if (action === "add") {
          const data = await apiRequest("POST", "/watchlist", { domains });
          return textResult(
            `Added ${data.added} companies. Already tracked: ${data.already_tracked}. ` +
            `Not found: ${data.not_found}. Total tracked: ${data.total_tracked}.`
          );
        }

        if (action === "remove") {
          const data = await apiRequest("DELETE", "/watchlist", { domains });
          return textResult(`Removed ${data.removed} companies. Total tracked: ${data.total_tracked}.`);
        }

        return textResult("Invalid action. Use 'list', 'add', or 'remove'.");
      }

      case "get_watchlist_events": {
        const data = await apiRequest("GET", "/watchlist/events", {
          days: (args as any).days,
          types: (args as any).types,
        });
        const events = data.events || [];
        if (events.length === 0) {
          return textResult(
            `No events found for your ${data.tracked_companies} tracked companies in the last ${data.period_days} days.`
          );
        }
        const summary = events
          .map((e: any, i: number) => {
            let detail = `${i + 1}. [${e.type.toUpperCase()}] ${e.company_name}: ${e.title}`;
            if (e.amount) detail += ` ($${(e.amount / 1_000_000).toFixed(1)}M)`;
            if (e.date) detail += ` | ${e.date}`;
            return detail;
          })
          .join("\n");
        return textResult(`${data.total} events for ${data.tracked_companies} tracked companies:\n\n${summary}`);
      }

      case "get_usage": {
        const data = await apiRequest("GET", "/usage");
        const text =
          `FundzWatch Usage (${data.current_period}):\n\n` +
          `Tier: ${data.tier}\n` +
          `API Calls: ${data.api_calls_used} / ${data.limits.api_calls_monthly}\n` +
          `AI Score Calls: ${data.ai_score_calls_used} / ${data.limits.ai_score_calls_monthly}\n` +
          (data.last_api_call ? `Last API Call: ${data.last_api_call}` : "");
        return textResult(text);
      }

      default:
        return textResult(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return textResult(`Error: ${err.message}`);
  }
});

// ─── Start Server ───────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FundzWatch MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
