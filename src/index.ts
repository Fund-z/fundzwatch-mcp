import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = "https://api.fundz.net/v1/watch";
// Answer-section feeds (Renewal Radar, Stacked Borrowers, Benefit Plans,
// Funded & Hiring, Lender Directory) are public teaser endpoints — no key
// needed. Anonymous callers get the top 5 of each scored cohort plus the
// full cohort size; the complete feeds live in the Fundz app (Strategic).
const PUBLIC_API_BASE = "https://api.fundz.net/v1";

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
      "User-Agent": "fundzwatch-mcp/1.1.0",
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

// Public (key-less) GET against the answer-section teaser endpoints.
async function publicRequest(path: string, params?: Record<string, any>): Promise<any> {
  const url = new URL(`${PUBLIC_API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
    });
  }
  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "fundzwatch-mcp/1.1.0" },
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

// Shared formatter for the section feeds: rows differ per section, so print
// whatever evidence fields are present, then the cohort size + upgrade path.
function formatSectionFeed(
  label: string,
  rows: any[],
  summary: any,
  limited: boolean,
  appUrl: string,
  lineFor: (r: any) => string
): string {
  if (!rows.length) return `No companies in ${label} right now. The cohort refreshes daily.`;
  const lines = rows.map((r: any, i: number) => {
    const org = r.organization || {};
    const loc = [org.city, org.state].filter(Boolean).join(", ");
    return `${i + 1}. **${org.name}**${loc ? ` (${loc})` : ""} — Score ${Math.round(r.score)}${r.is_new ? " · NEW this week" : ""}\n   ${lineFor(r)}`;
  });
  let text = `${label} — ${summary.total} companies, ${summary.new_this_week} new this week (refreshed ${summary.last_refreshed_on}):\n\n${lines.join("\n")}`;
  if (limited) {
    text += `\n\nThis is the free preview (top ${rows.length} of ${summary.total}). The full scored feed with filters, contacts, and daily alerts is in the Fundz app (Strategic plan): ${appUrl}`;
  }
  return text;
}

// ─── Server Setup ───────────────────────────────────────────────────────

const server = new Server(
  { name: "fundzwatch", version: "1.2.0" },
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
    {
      name: "get_funded_and_hiring",
      description:
        "Companies with a verified funding round in the last 12 months AND live hiring " +
        "evidence (open ATS roles, executive hires, hiring signals) — the strongest buying " +
        "window, score-ranked and refreshed daily. No API key required.",
      inputSchema: {
        type: "object" as const,
        properties: {
          q: { type: "string", description: "Company name search" },
          state: { type: "string", description: "2-letter US state filter (e.g. 'CA')" },
        },
      },
    },
    {
      name: "get_refinancing_windows",
      description:
        "Companies whose active UCC-1 liens lapse within 12 months (Renewal Radar). " +
        "UCC liens expire after 5 years — the incumbent lender must re-file or lose priority, " +
        "so each approaching lapse is a refinancing window with a date on it. For lenders, " +
        "MCA/ISO, and equipment finance. California coverage. No API key required.",
      inputSchema: {
        type: "object" as const,
        properties: {
          q: { type: "string", description: "Company name search" },
          state: { type: "string", description: "2-letter US state filter" },
        },
      },
    },
    {
      name: "get_stacked_borrowers",
      description:
        "Companies with active secured debt (UCC-1) from 2+ distinct lenders and a filing in " +
        "the last 24 months — proven appetite for layered financing; second-position and " +
        "refi/consolidation targets. California coverage. No API key required.",
      inputSchema: {
        type: "object" as const,
        properties: {
          q: { type: "string", description: "Company name search" },
          state: { type: "string", description: "2-letter US state filter" },
        },
      },
    },
    {
      name: "get_benefit_plans_in_play",
      description:
        "Recently funded companies (≤24 months) with a DOL Form 5500 benefit-plan filing on " +
        "record: plan renewal timing, participant count vs current headcount ('outgrowing " +
        "their plan'), and the incumbent insurance carrier from Schedule A. For benefits " +
        "brokers, retirement-plan advisors, PEOs, HR-tech sellers. No API key required.",
      inputSchema: {
        type: "object" as const,
        properties: {
          q: { type: "string", description: "Company name search" },
          state: { type: "string", description: "2-letter US state filter" },
        },
      },
    },
    {
      name: "get_lender_directory",
      description:
        "Who finances whom: directory of 8,600+ UCC secured parties (lenders) ranked by " +
        "filing volume, with active-lien counts and lapsing-soon exposure per lender. " +
        "California coverage. No API key required.",
      inputSchema: {
        type: "object" as const,
        properties: {
          q: { type: "string", description: "Lender name search (e.g. 'Wells Fargo')" },
          page: { type: "number", description: "Page (50/page). Default: 1" },
        },
      },
    },
    {
      name: "get_money_in_motion",
      description:
        "Companies with an executive-move announcement in the last 180 days AND a verified " +
        "funding round in the last 24 months — the wealth advisor's 'money in motion' moment: " +
        "a new comp package (often equity), an old 401(k) to roll over, benefits about to be " +
        "re-evaluated. Score-ranked, refreshed daily. For RIAs, wealth managers, retirement-plan " +
        "advisors, executive-benefits sellers. No API key required.",
      inputSchema: {
        type: "object" as const,
        properties: {
          q: { type: "string", description: "Company name search" },
          state: { type: "string", description: "2-letter US state filter (e.g. 'CA')" },
        },
      },
    },
    {
      name: "get_broker_directory",
      description:
        "Who broker-of-records whom: directory of 65,000+ benefits brokers from DOL Form 5500 " +
        "Schedule A Part 1, ranked by filings carried, with sponsor counts and commission " +
        "volume per broker. For carriers, broker M&A, benefits-tech sellers, and brokers " +
        "scouting competitors. No API key required.",
      inputSchema: {
        type: "object" as const,
        properties: {
          q: { type: "string", description: "Broker name search (e.g. 'Lockton')" },
          state: { type: "string", description: "2-letter US state filter" },
          page: { type: "number", description: "Page (50/page). Default: 1" },
        },
      },
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

      case "get_funded_and_hiring": {
        const data = await publicRequest("/funded_hiring", { q: (args as any).q, state: (args as any).state });
        return textResult(formatSectionFeed(
          "Funded & Hiring Now", data.funded_hiring || [], data.summary,
          !!data.meta?.free_tier_limited, "https://app.fundz.net/funded-and-hiring",
          (r) => {
            const f = r.latest_funding || {};
            const bits = [
              f.series ? `${f.series} (${f.event_date})` : `Funded ${f.event_date || ""}`,
              r.open_postings_90d ? `${r.open_postings_90d} open roles` : null,
              r.exec_hires_90d ? `${r.exec_hires_90d} exec hires` : null,
            ].filter(Boolean);
            return bits.join(" · ");
          }
        ));
      }

      case "get_refinancing_windows": {
        const data = await publicRequest("/renewal_radar", { q: (args as any).q, state: (args as any).state });
        return textResult(formatSectionFeed(
          "Renewal Radar (UCC refinancing windows)", data.renewal_radar || [], data.summary,
          !!data.meta?.free_tier_limited, "https://app.fundz.net/lender-intelligence",
          (r) => [
            r.soonest_lapse_date ? `Lien lapses ${r.soonest_lapse_date}` : null,
            r.top_lender ? `incumbent: ${r.top_lender}` : null,
            r.active_liens ? `${r.active_liens} active liens` : null,
            r.lender_count > 1 ? `${r.lender_count} lenders` : null,
          ].filter(Boolean).join(" · ")
        ));
      }

      case "get_stacked_borrowers": {
        const data = await publicRequest("/stacked_borrowers", { q: (args as any).q, state: (args as any).state });
        return textResult(formatSectionFeed(
          "Stacked Borrowers", data.stacked_borrowers || [], data.summary,
          !!data.meta?.free_tier_limited, "https://app.fundz.net/lender-intelligence",
          (r) => [
            r.lender_count ? `${r.lender_count} distinct lenders` : null,
            r.active_liens ? `${r.active_liens} active liens` : null,
            r.latest_lender ? `latest: ${r.latest_lender} (${r.latest_filing_date})` : null,
            r.soonest_lapse_date ? `soonest lapse ${r.soonest_lapse_date}` : null,
          ].filter(Boolean).join(" · ")
        ));
      }

      case "get_benefit_plans_in_play": {
        const data = await publicRequest("/benefit_plans", { q: (args as any).q, state: (args as any).state });
        return textResult(formatSectionFeed(
          "Benefit Plans in Play", data.benefit_plans || [], data.summary,
          !!data.meta?.free_tier_limited, "https://app.fundz.net/benefits-intelligence",
          (r) => [
            r.next_renewal_on ? `plan renewal ${r.next_renewal_on}` : null,
            r.top_carrier ? `incumbent: ${r.top_carrier}` : null,
            r.participant_count ? `${r.participant_count} plan participants` : null,
            r.employees ? `~${r.employees} employees now` : null,
            r.latest_funding?.event_date ? `funded ${r.latest_funding.event_date}` : null,
          ].filter(Boolean).join(" · ")
        ));
      }

      case "get_lender_directory": {
        const data = await publicRequest("/lenders", { q: (args as any).q, page: (args as any).page });
        const lenders = data.lenders || [];
        if (!lenders.length) return textResult("No lenders match that search.");
        const lines = lenders.slice(0, 25).map((l: any, i: number) =>
          `${i + 1}. **${l.name}** — ${l.filings} filings (${l.active_filings} active, ${l.lapsing_12mo} lapsing ≤12mo)` +
          (l.latest_filing_date ? ` · latest ${l.latest_filing_date}` : "")
        );
        return textResult(
          `Lender Directory — ${data.meta.total_count} secured parties (${data.meta.coverage}):\n\n${lines.join("\n")}\n\n` +
          `Borrower lists per lender live in the Fundz app: https://app.fundz.net/lender-intelligence`
        );
      }

      case "get_money_in_motion": {
        const data = await publicRequest("/money_in_motion", { q: (args as any).q, state: (args as any).state });
        return textResult(formatSectionFeed(
          "Money in Motion", data.money_in_motion || [], data.summary,
          !!data.meta?.free_tier_limited, "https://app.fundz.net/benefits-intelligence",
          (r) => [
            r.latest_move_headline ? `${r.latest_move_headline} (${r.latest_move_on})` : null,
            r.latest_funding?.event_date ? `funded ${r.latest_funding.event_date}` : null,
            r.move_count_180d > 1 ? `${r.move_count_180d} exec moves ≤180d` : null,
            r.has_pension_plan ? "retirement plan on record" : null,
          ].filter(Boolean).join(" · ")
        ));
      }

      case "get_broker_directory": {
        const data = await publicRequest("/brokers", { q: (args as any).q, state: (args as any).state, page: (args as any).page });
        const brokers = data.brokers || [];
        if (!brokers.length) return textResult("No brokers match that search.");
        const fmtUsd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`);
        const lines = brokers.slice(0, 25).map((b: any, i: number) =>
          `${i + 1}. **${b.name}**${b.city ? ` (${b.city}, ${b.state})` : ""} — ${b.filings} filings, ` +
          `${b.sponsors} sponsors` +
          (b.commission_usd ? ` · ${fmtUsd(b.commission_usd)} commissions` : "") +
          (b.latest_form_year ? ` · thru ${b.latest_form_year}` : "")
        );
        return textResult(
          `Broker Directory — ${data.meta.total_count} brokers of record (${data.meta.coverage}):\n\n${lines.join("\n")}\n\n` +
          `Client lists per broker live in the Fundz app: https://app.fundz.net/benefits-intelligence`
        );
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
