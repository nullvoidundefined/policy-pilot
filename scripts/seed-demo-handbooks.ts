import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

import { chunkText } from '../common/src/chunker/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../server/.env') });

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 100;

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  usage: { prompt_tokens: number; total_tokens: number };
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) throw new Error('OPEN_AI_API_KEY is not set');

  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: batch,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Embedding API error (${response.status}): ${errorBody}`);
    }

    const result = (await response.json()) as EmbeddingResponse;
    console.log(
      `  Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} texts, ${result.usage.total_tokens} tokens`,
    );
    allEmbeddings.push(...result.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}

// ---------------------------------------------------------------------------
// Handbook content — representative text based on publicly known policies
// ---------------------------------------------------------------------------

const HANDBOOKS: Array<{ filename: string; content: string }> = [
  {
    filename: 'Valve Employee Handbook.txt',
    content: `VALVE EMPLOYEE HANDBOOK
A Fearless Adventure in Knowing What to Do When No One's There Telling You What to Do

WELCOME TO FLATLAND

Valve is a flat company. There are no managers, no org charts, no job titles that dictate what you work on. Everyone at Valve is a designer, engineer, and business person all at once. This handbook is an attempt to document the culture, expectations, and practices of working here — a culture that has been evolving since 1996.

YOUR FIRST DAY

Your desk has wheels. This is the most important thing we can tell you about working at Valve. When you join a project, you physically move your desk to sit with that team. When you finish, you roll to the next project. Your desk is your home base, but it is not permanent.

We don't assign you to projects. There is no onboarding manager who tells you "go work on X." Instead, you look around, talk to people, and figure out where you can contribute the most value. This is simultaneously the most exciting and the most terrifying thing about working here.

CHOOSING WHAT TO WORK ON

How do you decide what to work on? Valve uses a simple heuristic: work on the thing that delivers the most value to customers. We trust every employee to make that judgment call.

Some guidelines for choosing projects:
- What is the most valuable thing I can work on right now?
- Which projects have the biggest impact on our customers?
- Am I the best person to do this particular task, or should someone else?
- Is there something nobody is working on that really should get done?

If you can't find a project that excites you, start one. If you see a problem nobody is solving, solve it. You have the authority to ship products, hire people, and spend company money.

NO MANAGERS, NO HIERARCHY

We have no management structure. Nobody "reports to" anyone else. We do have a founder (Gabe Newell), but he doesn't manage in the traditional sense. He works on projects like everyone else.

This means a few things in practice:
- Nobody can tell you what to do. But you are accountable to your peers.
- Teams form organically around projects. They dissolve when the project ships.
- Decisions are made by the people doing the work, not by someone in a corner office.
- If you need help, ask. If someone asks you for help, give it.

Peer reviews are how we evaluate each other. Every year, your colleagues rank your contributions. This isn't a popularity contest — it's a structured assessment of the value you've created.

HIRING

Hiring is the most important thing we do. A bad hire in a traditional company might cause some problems in one department. A bad hire at Valve can affect everyone because we have no management layer to contain the damage.

We look for "T-shaped" people: those with deep expertise in one area but broad knowledge across many. We value people who can collaborate, who are self-directed, and who can recognize value.

When you interview candidates, ask yourself: Is this person going to raise the average? Not just in technical skill, but in every dimension — collaboration, creativity, judgment, and raw intelligence.

SHIPPING PRODUCTS

At Valve, shipping is everyone's responsibility. There's no product manager who decides the release date. The team working on a product collectively decides when it's ready. We'd rather ship something great late than ship something mediocre on time.

We use an iterative process. Build something. Playtest it. Iterate. Ship it. Learn from it. The Steam platform itself is a giant feedback loop — we can see exactly what our customers are doing, and we use that data to make better products.

COMPENSATION AND BENEFITS

Valve pays well — in the top percentile for the games industry. We believe that great compensation attracts great people, and great people build great products. Your compensation is determined by your peer review rankings, not by a manager's subjective assessment.

Benefits include:
- Comprehensive health, dental, and vision insurance
- Flexible vacation (take what you need, no fixed limit)
- Fitness allowance and gym access
- Community involvement support
- Relocation assistance for new hires

WHAT IF I SCREW UP?

Everyone screws up. What matters at Valve is not whether you make mistakes, but whether you learn from them. We don't fire people for honest mistakes. We do, however, have honest conversations when something isn't working.

If you're struggling to find projects, talk to people. If you feel like you're not contributing, ask your peers for feedback. The worst thing you can do at Valve is sit quietly and do nothing — that's the one thing that will genuinely cause problems.

REMOTE WORK AND OFFICE CULTURE

Valve's headquarters is in Bellevue, Washington. While we are primarily an in-office company, we believe in results over face time. The office is designed to facilitate the spontaneous collaboration that drives innovation — kitchens stocked with food, game rooms, and open floor plans.

We don't track hours. We don't monitor your screen. We trust you to be an adult. If you produce great work from a beach in Thailand, nobody will complain. But most of us find that being physically present leads to better collaboration and faster iteration.

INTELLECTUAL PROPERTY

Everything you create at Valve belongs to Valve. This includes side projects done on company time or with company resources. If you have a side project you want to keep, talk to us before you start it. We're usually reasonable about this.

FINAL THOUGHTS

Working at Valve is not for everyone. The lack of structure can be paralyzing for people who need clear direction. But for self-motivated people who want to work on the hardest problems with the smartest colleagues, there's no better place.

Welcome aboard. Now go find something to work on.`,
  },
  {
    filename: 'GitLab Team Handbook.txt',
    content: `GITLAB TEAM HANDBOOK
Living Document — Company Culture and Operations

INTRODUCTION

GitLab is one of the world's largest all-remote companies with team members in more than 65 countries. This handbook is the central reference for how we run the company. Everything from our values to our expense policy lives here. If it's not in the handbook, it doesn't exist as policy.

This isn't a traditional employee handbook that sits in a drawer. It's a living document that anyone in the company can edit via merge request. Transparency is one of our core values, and this handbook is the embodiment of that value — it's publicly accessible to anyone, not just employees.

OUR VALUES: CREDIT

GitLab has six core values, summarized by the acronym CREDIT:

Collaboration: We believe everyone can contribute. We work across teams, across time zones, and across disciplines. Helping others is not a distraction from your work — it is your work.

Results: We care about what you achieve, not how many hours you work or where you sit. We measure output, not input. We focus on results because our customers depend on us to deliver.

Efficiency: We value getting things done with minimal waste. We write things down instead of having meetings. We default to async communication. We automate repetitive tasks.

Diversity, Inclusion & Belonging: We want everyone to feel they belong. We actively work to include people from all backgrounds, perspectives, and identities. Diversity is not a checkbox — it's a competitive advantage.

Iteration: We ship the smallest viable change. We'd rather make ten small improvements than wait for one perfect solution. This means things will sometimes feel incomplete — that's by design. Done is better than perfect.

Transparency: We make information public by default. Our handbook, our strategy, our OKRs, our direction pages — all public. We believe transparency leads to better decisions and higher trust.

HANDBOOK-FIRST APPROACH

At GitLab, we follow a handbook-first approach. This means:
- If you want to change a process, update the handbook first via merge request.
- If someone asks a question, answer it by linking to the handbook.
- If the answer isn't in the handbook, add it, then link to it.
- Meetings should produce handbook updates, not just meeting notes.

This approach scales. When you have 2,000+ employees across 65 countries, you can't rely on tribal knowledge. The handbook is the single source of truth.

REMOTE-FIRST CULTURE

We are not "remote-friendly" — we are remote-first. This is an important distinction:
- We don't have a headquarters. There is no "main office" that remote workers dial into.
- All meetings are conducted via video call, even if some participants are in the same building.
- All communication defaults to asynchronous. We don't expect instant replies.
- We document everything. If it happened in a conversation, it gets written down.

Working remotely requires discipline and intentionality. Here are our guidelines:

Workspace: Set up a dedicated workspace. Invest in a good chair, a good monitor, and good lighting. GitLab provides a home office stipend to help with this.

Working hours: Work when you're most productive. We don't mandate specific hours, but we do ask that you have at least a 4-hour overlap with your team for synchronous collaboration.

Communication: Default to async. Use issues and merge requests for technical discussions. Use Slack for quick questions, but don't expect instant replies. Use video calls sparingly and only when async won't work.

ASYNC COMMUNICATION

Asynchronous communication is the backbone of our culture. Here's how we practice it:

1. Write things down. Don't have a conversation when a written document will do.
2. Use issues and merge requests, not chat. Chat is ephemeral; issues are permanent.
3. Record meetings. If you must have a synchronous meeting, record it and share notes so those in other time zones can catch up.
4. Don't expect instant replies. Someone might be asleep, at lunch, or in deep focus mode. That's fine.
5. Front-load context. When you write a message, include all the context the reader needs. Don't make them ask follow-up questions.

MEETINGS

We are skeptical of meetings. Most meetings should be an async discussion in an issue or document. When a meeting is necessary:

- Every meeting must have an agenda, shared in advance.
- Every meeting must have a designated note-taker.
- Meeting notes go into the relevant issue or handbook page, not into a separate document.
- We start meetings on time and end them early if the agenda is complete.
- Camera on is encouraged but not required.

MANAGEMENT AND LEADERSHIP

Managers at GitLab are "servant leaders." Their job is to remove obstacles, provide context, and help their reports grow. They are not gatekeepers or taskmasters.

Key management practices:
- Weekly 1:1s with each direct report (25 minutes minimum).
- Skip-level meetings every quarter.
- Career development conversations at least twice a year.
- Public praise, private criticism.

We hire managers who are strong individual contributors first. We believe the best managers understand the work their teams do because they've done it themselves.

EXPENSE POLICY

We trust team members to spend company money wisely. Our expense policy is simple: spend it like it's your own money. No pre-approval is needed for expenses under $5,000, as long as they're reasonable and work-related.

We reimburse:
- Home office equipment (up to $1,500 initial setup)
- Co-working space memberships
- Internet costs
- Travel for company events and meetups
- Professional development and conferences

PAID TIME OFF

GitLab has a flexible PTO policy. There is no maximum number of days off. We trust you to take the time you need to rest and recharge. We do ask that you:

- Coordinate coverage with your team
- Enter your time off in PTO by Deel
- Take at least 25 days off per year (we track this to ensure people actually rest)

We also have company-wide "Family and Friends Days" — additional days off throughout the year when the entire company takes a break together.

SECURITY AND COMPLIANCE

Security is everyone's responsibility at GitLab. Key practices:
- Use 1Password for all credentials
- Enable 2FA on all work accounts
- Never share credentials via chat or email
- Report security incidents immediately via the #security-incident Slack channel
- Complete annual security awareness training

OFFBOARDING

When someone leaves GitLab — whether voluntarily or involuntarily — we follow a structured offboarding process. Access is revoked promptly, knowledge is transferred, and we conduct an exit interview to learn how we can improve.

CONTRIBUTING TO THIS HANDBOOK

Anyone at GitLab can propose changes to this handbook via merge request. Changes to policy require approval from the relevant department head. Typo fixes and clarifications can be merged by anyone.

This handbook belongs to all of us. Keep it accurate, keep it current, and keep it useful.`,
  },
  {
    filename: 'Basecamp Employee Handbook.txt',
    content: `BASECAMP EMPLOYEE HANDBOOK
How We Work and Why

INTRODUCTION

Basecamp is a calm company. That's not a marketing slogan — it's an operational philosophy. We believe great work doesn't require long hours, constant hustle, or the sacrifice of your personal life. We've been profitable every year since our founding in 1999, and we've done it by working 40-hour weeks.

This handbook describes how we operate, what we believe, and what you can expect from us as an employer. It's short because our policies are simple.

THE CALM COMPANY

The tech industry glorifies overwork. 80-hour weeks, sleeping under desks, "crushing it" — we reject all of that. At Basecamp:

- We work 40-hour weeks, 8 hours a day. In the summer (May through September), we work 32-hour weeks — four-day workweeks, Fridays off.
- We don't track hours. We trust you to manage your time.
- We don't have "all-hands" emergencies at 11pm. Nearly nothing is so urgent it can't wait until morning.
- We protect people's time. Interruptions are the enemy of productivity.

This isn't laziness. It's the belief that constraints breed creativity. When you only have 40 hours, you spend them wisely. You cut meetings, you reduce scope, you focus on what matters.

BENEFITS

Basecamp offers the following benefits to all employees:

Health insurance: We pay 100% of health insurance premiums for employees and 75% for dependents. This includes medical, dental, and vision coverage.

Retirement: We match 401(k) contributions dollar-for-dollar up to 6% of your salary.

Profit sharing: 25% of Basecamp's annual profits are distributed to employees. This has historically been a meaningful amount — typically $10,000-$20,000 per person per year.

Vacation: Three weeks of paid vacation per year, plus national holidays. In your first year, vacation is prorated. Sick days are separate and unlimited.

Sabbatical: After every three years of employment, you get a one-month paid sabbatical. This is in addition to your regular vacation.

Continuing education: We pay for books, courses, conferences, and other professional development. Up to $2,000 per year, no pre-approval required.

Fitness allowance: $100/month toward a gym membership or fitness activity of your choice.

Community contribution: $2,000/year to donate to the charity of your choice, matched by Basecamp.

Home office setup: $2,000 upon hiring for setting up your home office, plus $500/year for upgrades.

Coworking allowance: Up to $200/month for a coworking space if you prefer not to work from home.

REMOTE WORK

Basecamp has been a remote-first company since before it was fashionable. Our team is distributed across more than 30 cities around the world. Here's how we make it work:

Asynchronous by default: We don't expect instant replies. Most communication happens in Basecamp (our own product), where messages are organized by project and topic. Real-time chat is available but not the primary communication channel.

Writing is thinking: We believe that writing things out forces clarity of thought. Big decisions start with a writeup — a narrative document that describes the problem, the proposed solution, and the trade-offs. This replaces meetings where people ramble through half-formed ideas.

No open offices: Even in the rare cases where team members work in the same city, we don't have an open-plan office. Distractions are the enemy of quality work.

HOW WE WORK: SHAPE UP

Basecamp uses a product development methodology called Shape Up. Here's how it works:

Six-week cycles: We work in six-week cycles, not two-week sprints. Six weeks is long enough to build something meaningful but short enough to maintain urgency.

Shaping: Before a cycle begins, senior people "shape" the work — they define the problem, sketch a solution, and set boundaries. Shaping produces a "pitch" document that describes what to build and, critically, what NOT to build.

Betting table: At the start of each cycle, leadership reviews pitches and "bets" on which ones to pursue. Not everything gets built. Ideas that don't make the cut go back to the pile — there is no backlog.

Building: Small teams (usually 1-2 programmers and 1 designer) take the shaped work and build it. They have full autonomy over implementation details. There are no daily standups, no sprint reviews, no Jira tickets.

Cooldown: Between cycles, we have a two-week cooldown period. This is time for fixing bugs, exploring new ideas, and recovering from the intensity of a cycle.

NO GOALS

Basecamp doesn't set annual goals, quarterly goals, or OKRs. We don't have KPIs plastered on dashboards. Here's why:

Goals create artificial pressure. They encourage gaming the system, cutting corners, and optimizing for metrics rather than outcomes. When you set a goal of "grow revenue 20%," you're incentivizing short-term thinking at the expense of long-term quality.

Instead, we focus on doing our best work, treating our customers well, and building a product we're proud of. We've found that when you focus on quality, growth takes care of itself.

COMPENSATION

We pay at the top 10% of the San Francisco market, regardless of where you live. If you're a senior programmer in Des Moines, you're paid the same as a senior programmer in San Francisco. We don't adjust for local cost of living.

We publish our salary formula publicly. Compensation is based on role, level, and tenure. There is no negotiation. Everyone at the same level with the same tenure makes the same amount. This eliminates bias and ensures fairness.

Raises happen twice a year and are based on the market rate and your progression in level. They are not tied to performance reviews.

PERFORMANCE

We don't do traditional performance reviews. Instead, managers have ongoing conversations with their reports about how things are going. If there's a problem, we address it directly and promptly — we don't wait for an annual review.

We use a "manager, not a gatekeeper" philosophy. Your manager's job is to help you do your best work, remove obstacles, and provide honest feedback. They are not there to approve your time-off requests or monitor your output.

COMMUNICATION ETIQUETTE

A few principles that guide how we communicate:

- Real-time is overrated. Don't chat when a Basecamp message will do.
- Meetings are a last resort. Most decisions can be made asynchronously through written discussion.
- Respect people's time. Don't @-mention someone unless you actually need them.
- Sleep on it. If you're angry or frustrated, wait until tomorrow before responding.
- Keep it professional. We're friendly but we're at work.

DIVERSITY AND INCLUSION

We believe diverse teams make better products. We actively recruit from underrepresented groups and strive to create an environment where everyone feels welcome and valued.

We don't tolerate discrimination, harassment, or bullying of any kind. If you experience or witness such behavior, report it to your manager or to our head of people operations. We take these reports seriously and investigate them promptly.

LEAVING BASECAMP

If you decide to leave Basecamp, we ask for two weeks' notice (one month for managers). We'll conduct an exit interview to understand your reasons and learn how we can improve.

If Basecamp decides to end your employment, we provide a generous severance package based on your tenure. We believe in treating people well, even — especially — at the end of the relationship.

WHAT WE STAND FOR

Basecamp has opinions. Strong ones. We believe:
- Long hours are not a badge of honor.
- Profit is not a dirty word.
- Growing slowly and deliberately is better than growing fast and recklessly.
- Simple is better than complex.
- Privacy matters.
- Work should not be your whole life.

These beliefs guide every decision we make, from product features to hiring to how we spend our money. If these resonate with you, you'll love it here. If they don't, that's okay too — but this probably isn't the right place for you.

Welcome to Basecamp. Now close your laptop and go do something fun.`,
  },
];

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';
const DEMO_USER_EMAIL = 'demo@policypilot.internal';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function ensureDemoUser(): Promise<string> {
  const existing = await pool.query(`SELECT id FROM users WHERE id = $1`, [
    DEMO_USER_ID,
  ]);

  if (existing.rows[0]) {
    return DEMO_USER_ID;
  }

  await pool.query(
    `INSERT INTO users (id, email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [DEMO_USER_ID, DEMO_USER_EMAIL, 'nologin', 'Demo', 'User'],
  );

  console.log(`Created demo user: ${DEMO_USER_ID}`);
  return DEMO_USER_ID;
}

async function seed() {
  // 0. Ensure demo user exists (documents/chunks require a non-null user_id)
  const demoUserId = await ensureDemoUser();

  // 1. Get or create demo collection
  let collectionId: string;
  const existing = await pool.query(
    `SELECT id FROM collections WHERE is_demo = true LIMIT 1`,
  );

  if (existing.rows[0]) {
    collectionId = existing.rows[0].id;
    console.log(`Demo collection exists: ${collectionId}`);
  } else {
    const result = await pool.query(
      `INSERT INTO collections (name, description, is_demo, user_id)
             VALUES ($1, $2, true, NULL)
             RETURNING id`,
      [
        'Sample Company Handbooks',
        'Pre-loaded public company handbooks for demo purposes. Try asking questions about remote work policies, employee benefits, or company culture!',
      ],
    );
    collectionId = result.rows[0].id;
    console.log(`Created demo collection: ${collectionId}`);
  }

  // 2. Check if collection already has documents
  const docCount = await pool.query(
    `SELECT count(*)::int AS cnt FROM documents WHERE collection_id = $1`,
    [collectionId],
  );

  if (docCount.rows[0].cnt > 0) {
    console.log(
      `Demo collection already has ${docCount.rows[0].cnt} documents — skipping seed.`,
    );
    await pool.end();
    return;
  }

  // 3. Seed each handbook
  let totalChunks = 0;

  for (const handbook of HANDBOOKS) {
    console.log(`\nProcessing: ${handbook.filename}`);

    // Insert document record (demo user owns it, r2_key placeholder)
    const docResult = await pool.query(
      `INSERT INTO documents (user_id, filename, r2_key, mime_type, size_bytes, collection_id, status, total_chunks)
             VALUES ($1, $2, $3, $4, $5, $6, 'ready', 0)
             RETURNING id`,
      [
        demoUserId,
        handbook.filename,
        `demo/${handbook.filename.replace(/\s+/g, '-').toLowerCase()}`,
        'text/plain',
        Buffer.byteLength(handbook.content, 'utf8'),
        collectionId,
      ],
    );
    const documentId = docResult.rows[0].id;
    console.log(`  Created document: ${documentId}`);

    // Chunk the text
    const chunks = chunkText(handbook.content, {
      maxTokens: 500,
      overlapTokens: 50,
    });
    console.log(`  Chunked into ${chunks.length} chunks`);

    // Generate embeddings
    console.log(`  Generating embeddings...`);
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkTexts);

    // Insert chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = embeddings[i]!;
      const embeddingStr = `[${embedding.join(',')}]`;

      await pool.query(
        `INSERT INTO chunks (document_id, user_id, chunk_index, content, token_count, embedding)
                 VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [
          documentId,
          demoUserId,
          chunk.index,
          chunk.content,
          chunk.tokenCount,
          embeddingStr,
        ],
      );
    }

    // Update document with chunk count
    await pool.query(`UPDATE documents SET total_chunks = $1 WHERE id = $2`, [
      chunks.length,
      documentId,
    ]);

    totalChunks += chunks.length;
    console.log(`  Inserted ${chunks.length} chunks with embeddings`);
  }

  console.log(
    `\nDone! Seeded ${HANDBOOKS.length} documents with ${totalChunks} total chunks.`,
  );
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
