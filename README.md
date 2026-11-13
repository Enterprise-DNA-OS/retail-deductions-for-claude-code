# Retail Deductions for Claude Code

Know which short payment needs evidence, which dispute is due, and which recovery only paid part of the balance. Free software under the MIT licence for Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Install the free desk below. | Your retailer rules, export mapping and reporting. [Book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_campaign=trewup&utm_medium=readme). | Installed, connected and operated through Omni by Enterprise DNA. One setup fee, then a retainer. [See the offer](https://enterprisedna.co/omni/instead-of/trewup). |

Built for deduction investigation, evidence indexes, external dispute receipts, partial recoveries and corrective actions. It does not recreate TrewUp's distributor data collection, depletion analytics or portal connections. [Scope](docs/why-no-front-end.md).

TrewUp publishes Emerging from $699/month, or $8,388 for twelve monthly payments. This is a starting-price benchmark, not an ANZ customer invoice. SMB and Enterprise prices are quoted privately. [Sources and selection](docs/research.md).

## Quick start

Node 20 or 22:

```bash
git clone https://github.com/Enterprise-DNA-OS/retail-deductions-for-claude-code.git
cd retail-deductions-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
```

Ask /attention, /dispute-ready or /weekly-review. The demo has five fictional deductions with missing evidence, an import hold, an expired deadline, a partial recovery and an overdue root cause action. Dates are relative to the seed date; seeding again preserves your work.

The local PGlite database lives in .data/db. For shared deployment use a private PostgreSQL DATABASE_URL and npm run migrate. Never seed a working database; the shared demo seed requires --demo-database. Access controls, authenticated operators and tested backups are deployment work. --actor is attribution, not authentication.

## Your first hour: ten things to ask for

1. Which ready deductions expire before we finish gathering the rest of the evidence? (/dispute-ready)
2. Which short payments repeat at the same retailer, and how much is still open? (/root-causes)
3. Which operator has the most held imports alongside their open balance? (/owner-workload)
4. Which disputes need chasing after only part of the money came back? (/follow-ups)
5. Which deductions have no evidenced deadline at all? (/compliance)
6. Which shortage claims have an invoice but no delivery proof? (/evidence-gaps)
7. Which root cause actions are already overdue? (/actions)
8. Which accepted balances explain the gap between deducted and recovered? (/month-close)
9. Who added the evidence and what original reference supports the record? (/card)
10. What needs a decision at Monday's deductions meeting? (/weekly-review)

These questions are answered by shipped commands. They are not a claim that TrewUp cannot answer them in any configuration. Ask /customise to add your fields or change the evidence policy, and /new-view to make a new report.

## Commands

- /retailers: retailers
- /deductions: deductions
- /attention: Review held deductions, evidence gaps, approaching deadlines and late responses.
- /dispute-ready: List reconciled deductions with the evidence and dates needed to prepare a dispute.
- /deadlines-due: Review unknown, expired and approaching dispute deadlines.
- /evidence-gaps: Find which invoice or supporting record is missing.
- /follow-ups: Chase a response on an externally submitted dispute.
- /recoveries: recoveries
- /root-causes: Review recurring deductions by retailer, reason and currency.
- /owner-workload: Review each operator's open balance and reconciliation holds.
- /month-close: Reconcile deductions, recoveries, accepted balances and open amounts by currency.
- /actions: actions
- /audit: audit
- /compliance: compliance
- /card: card <deduction reference or id>
- /follow-up: follow-up <deduction> --date=YYYY-MM-DD --proof=<contact note reference> --actor=<name>
- /weekly-review: Read attention, readiness, follow-ups, root cause actions and month-close together.
- /add: add retailer|deduction --data=<JSON> --actor=<name>
- /reconcile: reconcile <deduction> --proof=<remittance reference> --actor=<name>
- /set-deadline: set-deadline <deduction> --date=YYYY-MM-DD --proof=<retailer terms reference> --actor=<name>
- /evidence: evidence <deduction> --kind=invoice|delivery|agreement|inspection|other --proof=<reference> --actor=<name>
- /record-dispute: record-dispute <deduction> --reference=<portal receipt> --date=YYYY-MM-DD --follow-up=YYYY-MM-DD --amount=<decimal> --actor=<name>
- /record-recovery: record-recovery <deduction> --reference=<remittance line> --date=YYYY-MM-DD --amount=<decimal> --actor=<name>
- /close: close <deduction> --proof=<resolution reference> --actor=<name>
- /accept: accept <deduction> --proof=<approved write-off> --actor=<name>
- /action: action <deduction> --title=<root cause task> --owner=<name> --date=YYYY-MM-DD --actor=<name>
- /close-action: close-action <action id or title> --proof=<completion evidence> --actor=<name>
- /log: log <deduction> --note=<text> --actor=<name>
- /review-privacy: review-privacy <retailer> --proof=<access review> --date=<retention review date> --actor=<name>
- /import: import trewup --file=<CSV saved from Excel> --map=<JSON headings map> --actor=<name> [--dry-run]
- /export: export --out=<new directory>
- /draft-dispute: draft-dispute <deduction>
- /draft-weekly-review: draft-weekly-review
- /customise: Add fields or change rules through a tested forward migration.
- /new-view: Add a branded read-only view.

Human output is the default; add --json for structured results. Matching is case-insensitive by name or reference and supports id prefixes. Ambiguous results list candidates and exit with an error.

## Switch the review desk

Export TrewUp to Excel, save the deduction worksheet as CSV, map its headings and import in one command. The public export documentation does not establish a native fixed column schema; the included example is synthetic. New imports stay held until checked against remittance records. [Exact mapping and scope](docs/replace-trewup.md).

## Paperwork and controls

Edit brand.json with your business name, colours and logo. npm run docs renders dispute review packs, recovery statements and root cause reviews. npm run view renders the week, recurring patterns and recovery reconciliation. Documents are evidence indexes, not automatic file attachments. Nothing sends.

Dispute recording requires a reconciled deduction, an evidenced deadline, invoice and reason-specific supporting evidence. Recovery recording requires an open dispute, rejects duplicate remittance references and cannot exceed the disputed amount. Closing requires a zero balance; accepting a residual requires a recorded approval. The privacy checks cite NZ principles 5 and 9 and AU APP 11. [Checks and limits](docs/compliance.md).

## Validation

npm test exercises every command, actual partial recovery totals, evidence and deadline gates, import rollback, currency separation, immutable history, JSON output and escaped report rendering. GitHub Actions runs Node 20 and 22 on Windows and Linux plus PostgreSQL 16.

## Licence

MIT. Copyright 2026 Enterprise DNA. Independent software, not affiliated with or endorsed by TrewUp. Hosting, agent subscriptions and managed service work have their own costs.
