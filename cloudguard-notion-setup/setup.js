import { Client } from "@notionhq/client";
import * as dotenv from "dotenv";
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const PARENT_ID = process.env.NOTION_PARENT_PAGE_ID;

// ─── Helpers ────────────────────────────────────────────────

async function createPage(parentId, title, emoji) {
  console.log(`  Creating page: ${emoji} ${title}...`);
  const page = await notion.pages.create({
    parent: { type: "page_id", page_id: parentId },
    icon: { type: "emoji", emoji },
    properties: {
      title: { title: [{ text: { content: title } }] },
    },
  });
  console.log(`  ✅ Created: ${emoji} ${title}`);
  return page.id;
}

async function createDatabase(parentId, title, emoji, properties) {
  console.log(`  Creating database: ${emoji} ${title}...`);
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentId },
    icon: { type: "emoji", emoji },
    title: [{ type: "text", text: { content: title } }],
    properties,
  });
  console.log(`  ✅ Created database: ${emoji} ${title}`);
  return db.id;
}

async function addDatabaseRow(dbId, properties) {
  await notion.pages.create({
    parent: { type: "database_id", database_id: dbId },
    properties,
  });
}

async function addTextBlock(pageId, text, type = "paragraph") {
  await notion.blocks.children.append({
    block_id: pageId,
    children: [{
      type,
      [type]: {
        rich_text: [{ type: "text", text: { content: text } }],
      },
    }],
  });
}

async function addHeading(pageId, text, level = 2) {
  const type = `heading_${level}`;
  await notion.blocks.children.append({
    block_id: pageId,
    children: [{
      type,
      [type]: {
        rich_text: [{ type: "text", text: { content: text } }],
      },
    }],
  });
}

async function addCallout(pageId, text, emoji) {
  await notion.blocks.children.append({
    block_id: pageId,
    children: [{
      type: "callout",
      callout: {
        rich_text: [{ type: "text", text: { content: text } }],
        icon: { type: "emoji", emoji },
      },
    }],
  });
}

async function addToggle(pageId, title, items) {
  await notion.blocks.children.append({
    block_id: pageId,
    children: [{
      type: "toggle",
      toggle: {
        rich_text: [{ type: "text", text: { content: title } }],
        children: items.map(item => ({
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [{ type: "text", text: { content: item } }],
          },
        })),
      },
    }],
  });
}

async function addDivider(pageId) {
  await notion.blocks.children.append({
    block_id: pageId,
    children: [{ type: "divider", divider: {} }],
  });
}

// ─── Dashboard ───────────────────────────────────────────────

async function setupDashboard(parentId) {
  const pageId = await createPage(parentId, "Dashboard", "📊");
  await addHeading(pageId, "⚡ CloudGuard 360 — Command Centre", 1);
  await addTextBlock(pageId, "Your solo founder daily hub · March 2026");
  await addDivider(pageId);
  await addCallout(pageId, "MVP Phase: 1 of 3", "🚀");
  await addCallout(pageId, "Current Month: Month 1", "📅");
  await addCallout(pageId, "Pilot Customers: 0 / 3", "👥");
  await addCallout(pageId, "MRR: €0 → Target: €5,000/month", "💰");
  await addDivider(pageId);
  await addHeading(pageId, "This Week's Focus", 2);
  await addTextBlock(pageId, "→ Link your Sprint Board database here using /linked");
  return pageId;
}

// ─── Roadmap ─────────────────────────────────────────────────

async function setupRoadmap(parentId) {
  const dbId = await createDatabase(parentId, "Roadmap", "🗺️", {
    Name:     { title: {} },
    Status:   { select: { options: [
      { name: "Backlog",     color: "gray"   },
      { name: "In Progress", color: "blue"   },
      { name: "Done",        color: "green"  },
    ]}},
    Tag:      { select: { options: [
      { name: "MVP",      color: "blue"   },
      { name: "Infra",    color: "purple" },
      { name: "Phase 2",  color: "green"  },
      { name: "Phase 3",  color: "yellow" },
      { name: "GTM",      color: "red"    },
      { name: "Strategy", color: "gray"   },
    ]}},
    Priority: { select: { options: [
      { name: "High", color: "red"    },
      { name: "Med",  color: "yellow" },
      { name: "Low",  color: "gray"   },
    ]}},
    Month:    { select: { options: [
      { name: "Month 1" }, { name: "Month 2" },
      { name: "Month 3" }, { name: "Month 4" },
      { name: "Month 5" }, { name: "Month 6" },
    ]}},
  });

  const items = [
    // [Name, Status, Tag, Priority, Month]
    ["Azure Cost Management API connector", "In Progress", "MVP",      "High", "Month 2"],
    ["Multi-subscription support",          "In Progress", "MVP",      "High", "Month 2"],
    ["Next.js + Tailwind scaffold",         "In Progress", "MVP",      "High", "Month 1"],
    ["Clerk auth + multi-tenancy",          "In Progress", "MVP",      "High", "Month 1"],
    ["Terraform Azure infra setup",         "In Progress", "Infra",    "High", "Month 1"],
    ["TimescaleDB schema design",           "Backlog",     "Infra",    "High", "Month 1"],
    ["FinOps dashboard UI",                 "Backlog",     "MVP",      "High", "Month 3"],
    ["Budget alerts & anomaly detection",   "Backlog",     "MVP",      "Med",  "Month 4"],
    ["GDPR compliance module",              "Backlog",     "Phase 2",  "Med",  "Month 7"],
    ["AI Copilot (Claude API)",             "Backlog",     "Phase 3",  "Low",  "Month 10"],
    ["Stripe billing integration",          "Backlog",     "MVP",      "High", "Month 5"],
    ["Azure Marketplace listing",           "Backlog",     "GTM",      "Med",  "Month 6"],
    ["Market research & validation",        "Done",        "Strategy", "High", "Month 1"],
    ["Tech stack decision",                 "Done",        "Strategy", "High", "Month 1"],
    ["GitHub monorepo created",             "Done",        "Infra",    "High", "Month 1"],
  ];

  for (const [name, status, tag, priority, month] of items) {
    await addDatabaseRow(dbId, {
      Name:     { title:  [{ text: { content: name } }] },
      Status:   { select: { name: status   } },
      Tag:      { select: { name: tag      } },
      Priority: { select: { name: priority } },
      Month:    { select: { name: month    } },
    });
  }
  return dbId;
}

// ─── Sprint Board ─────────────────────────────────────────────

async function setupSprint(parentId) {
  const dbId = await createDatabase(parentId, "Sprint Board", "📋", {
    Name:     { title: {} },
    Status:   { select: { options: [
      { name: "To Do",       color: "gray"  },
      { name: "In Progress", color: "blue"  },
      { name: "Done",        color: "green" },
    ]}},
    Priority: { select: { options: [
      { name: "High", color: "red"    },
      { name: "Med",  color: "yellow" },
      { name: "Low",  color: "gray"   },
    ]}},
    Estimate: { rich_text: {} },
    Week:     { select: { options: [
      { name: "Week 1" }, { name: "Week 2" },
      { name: "Week 3" }, { name: "Week 4" },
    ]}},
  });

  const tasks = [
    ["Setup Docker Compose (PG + Redis + API)",  "To Do",       "High", "4h",  "Week 1"],
    ["Deploy skeleton to Azure Container Apps",   "To Do",       "High", "4h",  "Week 1"],
    ["Azure Cost Management API connector",       "To Do",       "High", "6h",  "Week 2"],
    ["Multi-subscription discovery",              "To Do",       "High", "3h",  "Week 2"],
    ["Next.js + Tailwind scaffold",               "In Progress", "High", "3h",  "Week 1"],
    ["Clerk auth flow implementation",            "In Progress", "High", "5h",  "Week 1"],
    ["Multi-tenant DB schema design",             "In Progress", "High", "2h",  "Week 1"],
    ["Terraform Azure infra modules",             "In Progress", "High", "4h",  "Week 2"],
    ["GitHub Actions CI/CD pipeline",             "Done",        "Med",  "3h",  "Week 1"],
    ["Domain + SSL setup",                        "Done",        "Med",  "1h",  "Week 1"],
    ["Tech stack decision documented",            "Done",        "Low",  "1h",  "Week 1"],
  ];

  for (const [name, status, priority, estimate, week] of tasks) {
    await addDatabaseRow(dbId, {
      Name:     { title:     [{ text: { content: name } }] },
      Status:   { select:    { name: status   } },
      Priority: { select:    { name: priority } },
      Estimate: { rich_text: [{ text: { content: estimate } }] },
      Week:     { select:    { name: week     } },
    });
  }
  return dbId;
}

// ─── CRM ─────────────────────────────────────────────────────

async function setupCRM(parentId) {
  const dbId = await createDatabase(parentId, "CRM", "👥", {
    Company:     { title: {} },
    Contact:     { rich_text: {} },
    Role:        { rich_text: {} },
    Sector:      { select: { options: [
      { name: "Finance" }, { name: "Retail" },
      { name: "Healthcare" }, { name: "Manufacturing" },
      { name: "Tech" }, { name: "Other" },
    ]}},
    Status:      { select: { options: [
      { name: "🔵 To Contact",    color: "blue"   },
      { name: "🟡 Interested",    color: "yellow" },
      { name: "🟠 In Discussion", color: "orange" },
      { name: "🟢 Pilot",         color: "green"  },
      { name: "⚫ Lost",           color: "gray"   },
    ]}},
    NextAction:  { rich_text: {} },
    LastContact: { date: {} },
    WarmLead:    { checkbox: {} },
  });

  const prospects = [
    ["Prospect A", "Jean Dupont",   "CTO",           "Finance",       "🔵 To Contact",    "Send one-pager",        false],
    ["Prospect B", "Marie Martin",  "Cloud Architect","Retail",        "🟡 Interested",    "Book demo call",        true ],
    ["Prospect C", "Ahmed Benali",  "IT Director",   "Healthcare",    "🟠 In Discussion", "Send DPA + pricing",    true ],
    ["Prospect D", "Sophie Lambert","CFO",            "Manufacturing", "🔵 To Contact",    "LinkedIn outreach",     false],
  ];

  for (const [company, contact, role, sector, status, next, warm] of prospects) {
    await addDatabaseRow(dbId, {
      Company:    { title:     [{ text: { content: company } }] },
      Contact:    { rich_text: [{ text: { content: contact } }] },
      Role:       { rich_text: [{ text: { content: role    } }] },
      Sector:     { select:    { name: sector } },
      Status:     { select:    { name: status } },
      NextAction: { rich_text: [{ text: { content: next   } }] },
      WarmLead:   { checkbox:  warm },
    });
  }
  return dbId;
}

// ─── Documents ───────────────────────────────────────────────

async function setupDocuments(parentId) {
  const dbId = await createDatabase(parentId, "Documents", "📝", {
    Title:   { title: {} },
    Type:    { select: { options: [
      { name: "Legal",   color: "red"    },
      { name: "Sales",   color: "blue"   },
      { name: "Tech",    color: "purple" },
      { name: "Finance", color: "green"  },
    ]}},
    Status:  { select: { options: [
      { name: "Draft",   color: "gray"   },
      { name: "Review",  color: "yellow" },
      { name: "Final",   color: "green"  },
    ]}},
    Updated: { date: {} },
  });

  const docs = [
    ["📜 Data Processing Agreement (DPA)", "Legal",   "Draft"],
    ["🔐 Privacy Policy",                  "Legal",   "Draft"],
    ["📋 Terms of Service",                "Legal",   "Draft"],
    ["🤝 Pilot Proposal Template",         "Sales",   "Draft"],
    ["⚡ One-Pager (CloudGuard 360)",      "Sales",   "Draft"],
    ["🏗️ Architecture Decision Records",   "Tech",    "Draft"],
    ["💰 Pricing Strategy",                "Finance", "Draft"],
  ];

  for (const [title, type, status] of docs) {
    await addDatabaseRow(dbId, {
      Title:  { title:  [{ text: { content: title  } }] },
      Type:   { select: { name: type   } },
      Status: { select: { name: status } },
    });
  }
  return dbId;
}

// ─── Architecture ─────────────────────────────────────────────

async function setupArchitecture(parentId) {
  const pageId = await createPage(parentId, "Architecture", "🏗️");
  await addHeading(pageId, "CloudGuard 360 — Azure Tech Stack", 1);
  await addTextBlock(pageId, "Azure-native · EU West Europe (Amsterdam) · GDPR-compliant");
  await addDivider(pageId);

  const stack = [
    ["Frontend",  "Next.js + Tailwind + shadcn/ui", "Vercel",               "✅ Decided"],
    ["Backend",   "FastAPI (Python)",                "Azure Container Apps", "✅ Decided"],
    ["Database",  "PostgreSQL + TimescaleDB",        "Azure DB Flex Server", "✅ Decided"],
    ["Cache",     "Redis",                           "Azure Cache for Redis","✅ Decided"],
    ["Secrets",   "Azure Key Vault",                 "Azure",                "✅ Decided"],
    ["Auth",      "Clerk + Entra SSO",               "Clerk Cloud",          "✅ Decided"],
    ["Jobs",      "Trigger.dev",                     "Trigger Cloud",        "✅ Decided"],
    ["Billing",   "Stripe + Stripe Tax",             "Stripe Cloud",         "⏳ Pending"],
    ["IaC",       "Terraform",                       "GitHub + Azure",       "✅ Decided"],
    ["CI/CD",     "GitHub Actions",                  "GitHub",               "✅ Decided"],
    ["Monitoring","Sentry + Grafana",                "Cloud",                "⏳ Pending"],
  ];

  for (const [layer, tech, hosting, status] of stack) {
    await addTextBlock(pageId, `${status}  ${layer.padEnd(12)} │ ${tech.padEnd(30)} │ ${hosting}`);
  }
  return pageId;
}

// ─── Meeting Notes ────────────────────────────────────────────

async function setupMeetings(parentId) {
  const dbId = await createDatabase(parentId, "Meeting Notes", "📅", {
    Title:      { title: {} },
    Date:       { date: {} },
    Type:       { select: { options: [
      { name: "Discovery", color: "blue"   },
      { name: "Demo",      color: "green"  },
      { name: "Follow-up", color: "yellow" },
      { name: "Internal",  color: "gray"   },
    ]}},
    NextSteps:  { rich_text: {} },
    FollowUp:   { date: {} },
  });

  // Add a sample template row
  await addDatabaseRow(dbId, {
    Title:     { title:     [{ text: { content: "📋 TEMPLATE — Copy for each meeting" } }] },
    Type:      { select:    { name: "Discovery" } },
    NextSteps: { rich_text: [{ text: { content: "Fill in after each call" } }] },
  });
  return dbId;
}

// ─── KPIs ─────────────────────────────────────────────────────

async function setupKPIs(parentId) {
  const pageId = await createPage(parentId, "KPIs & Metrics", "📊");
  await addHeading(pageId, "CloudGuard 360 — KPIs & Metrics", 1);
  await addTextBlock(pageId, "Updated every Sunday evening · Track progress honestly");
  await addDivider(pageId);

  await addHeading(pageId, "Business KPIs", 2);
  await addCallout(pageId, "MRR: €0  →  Target Month 12: €5,000/month", "💰");
  await addCallout(pageId, "Pilot Customers: 0 / 3", "👥");
  await addCallout(pageId, "Paying Customers: 0", "🎯");
  await addCallout(pageId, "Churn Rate: N/A", "📉");

  await addDivider(pageId);
  await addHeading(pageId, "Product KPIs", 2);
  await addCallout(pageId, "MVP Progress: Phase 1 of 3 (15%)", "🚀");
  await addCallout(pageId, "Azure Connector: In Progress", "☁️");
  await addCallout(pageId, "Features Shipped This Month: 0", "⚡");

  await addDivider(pageId);
  await addHeading(pageId, "Founder KPIs", 2);
  await addCallout(pageId, "Hours/week invested: 12h", "⏱️");
  await addCallout(pageId, "LinkedIn followers: 0 / 500", "🔗");
  await addCallout(pageId, "Prospects contacted: 0", "📧");

  await addDivider(pageId);
  await addHeading(pageId, "Weekly Log", 2);
  await addTextBlock(pageId, "Week | Date | Hours | MRR | Main Win");
  await addTextBlock(pageId, "W01  | Mar 2026 | 12h | €0 | Workspace setup complete");
  return pageId;
}

// ─── Ideas & Research ─────────────────────────────────────────

async function setupIdeas(parentId) {
  const pageId = await createPage(parentId, "Ideas & Research", "💡");
  await addHeading(pageId, "Ideas & Research", 1);
  await addDivider(pageId);

  await addToggle(pageId, "🔍 Competitor Analysis", [
    "Apptio Cloudability — expensive, complex, US-centric",
    "CloudHealth by VMware — enterprise but costly",
    "Azure Cost Management — clunky native Microsoft tool",
    "Spot.io — good but focused on savings only",
    "Gap: EU-focused, simpler UX, GDPR-native, affordable",
  ]);

  await addToggle(pageId, "💡 Feature Ideas (Post-MVP)", [
    "Slack/Teams daily cost digest bot",
    "Carbon footprint per Azure resource",
    "Chargeback / showback reporting per team",
    "Mobile app for cost alerts",
    "Reserved Instance marketplace comparison",
    "Multi-cloud expansion (AWS, GCP) — Phase 3",
  ]);

  await addToggle(pageId, "☁️ Azure APIs to Explore", [
    "Azure Reservations API — RI recommendations",
    "Azure Hybrid Benefit calculator",
    "Azure Policy compliance API",
    "Microsoft EA portal cost export",
    "Azure Carbon Optimization API (new 2024)",
    "Microsoft Cost Management exports (CSV/Parquet)",
  ]);

  await addToggle(pageId, "🤝 Potential Partnerships", [
    "Azure Partner Network (MPN) — become a Microsoft partner",
    "Azure Paris user group — meetup.com",
    "Station F startup ecosystem — Paris",
    "French Tech accelerators (BPI France)",
    "European FinOps Foundation community",
  ]);

  await addToggle(pageId, "📚 Resources & Learning", [
    "finops.org — FinOps Foundation certification",
    "azure.microsoft.com/en-us/products/cost-management",
    "learn.microsoft.com — Azure Cost Management docs",
    "stripe.com/docs — SaaS billing best practices",
    "notion.so/blog — startup workspace templates",
  ]);
  return pageId;
}

// ─── MAIN ─────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀 CloudGuard 360 — Notion Workspace Setup");
  console.log("==========================================\n");

  try {
    console.log("📊 Setting up Dashboard...");
    await setupDashboard(PARENT_ID);

    console.log("\n🗺️  Setting up Roadmap...");
    await setupRoadmap(PARENT_ID);

    console.log("\n📋 Setting up Sprint Board...");
    await setupSprint(PARENT_ID);

    console.log("\n👥 Setting up CRM...");
    await setupCRM(PARENT_ID);

    console.log("\n📝 Setting up Documents...");
    await setupDocuments(PARENT_ID);

    console.log("\n🏗️  Setting up Architecture...");
    await setupArchitecture(PARENT_ID);

    console.log("\n📅 Setting up Meeting Notes...");
    await setupMeetings(PARENT_ID);

    console.log("\n📊 Setting up KPIs & Metrics...");
    await setupKPIs(PARENT_ID);

    console.log("\n💡 Setting up Ideas & Research...");
    await setupIdeas(PARENT_ID);

    console.log("\n==========================================");
    console.log("✅ Workspace setup complete!");
    console.log("👉 Open Notion → your ⚡ CloudGuard 360 page");
    console.log("==========================================\n");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.code === "unauthorized") {
      console.error("→ Check your NOTION_TOKEN in .env");
    }
    if (error.code === "object_not_found") {
      console.error("→ Check your NOTION_PARENT_PAGE_ID in .env");
      console.error("→ Make sure you connected your integration to the page");
    }
  }
}

main();