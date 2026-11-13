# Retail Deductions for Claude Code

A local deduction investigation and recovery desk for suppliers. The database holds the record. Read it before answering; all demo records are fictional.

Use node scripts/deductions.mjs help for the one CLI. Every mutation needs --actor with the actual operator name. This is attribution, not authentication. Shared deployment requires private database access, least privilege and tested backups. Never expose the owner connection.

Do not submit a dispute, send a message, initiate a payment or post accounting entries. Record a submission or recovery only when the operator supplies an actual receipt or remittance. Evidence references are not attachments and are never fetched automatically. Keep generated documents and export folders private.

Import records start on hold. Read docs/replace-trewup.md, map actual headings and reconcile against originals before clearing the hold. Use the exact retailer terms for deadline and proof. Local evidence rules are business policy, not law. Read docs/compliance.md before interpreting a check. Missing evidence is not a legal verdict.

Do not aggregate different currencies. Do not overwrite historical disputes, evidence, notes, recoveries or activity. Correct mistakes through an explicitly authorised forward migration with an audit record and a test, not a silent rewrite.

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
- /customise: Make an authorised field or rule change through a tested forward migration.
- /new-view: Add a read-only branded report.

## Locations

supabase/migrations holds the schema. scripts/deductions.mjs is the domain CLI. views.json and documents.json define read-only outputs. brand.json holds the business identity. drafts/ holds messages and reviews that have not been sent.
