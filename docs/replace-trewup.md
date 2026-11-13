# Replace the deduction review desk in TrewUp

TrewUp documents an Excel export for Kroger data at https://www.trewup.ai/blog/coming-soon-kroger-data-in-trewup (checked 13 November 2026). It does not publish a stable full set of column headings. No customer export was available for this build. The included fixture is synthetic and is not asserted to be a native TrewUp export.

1. Export the relevant deduction records to Excel from TrewUp. Keep the original workbook with its source date and filters.
2. Save the deduction worksheet as UTF-8 CSV, keeping deduction and invoice identifiers as text. Do not import totals, remittance summary rows or multiple rows for one deduction as separate deductions.
3. Copy tests/fixtures/map.json to your private import folder. Map each required semantic field to the exact heading in your export: retailer, reference, invoice, reason, currency, amount, deducted_on, owner. Normalise reason to shortage, pricing, damage, promotion or other; dates to YYYY-MM-DD; currency to an uppercase three-letter code; amounts to positive decimal values without currency symbols or grouping commas. Choose one owning operator per deduction. Get missing facts from the original records, never guess.
4. Test the import, then repeat without --dry-run:

```bash
node scripts/deductions.mjs import trewup --file=imports/deductions.csv --map=imports/map.json --actor="Your name" --dry-run
```

The mapped CSV is imported in one command. Mapping and reconciliation are real work before cutover. Every imported deduction starts on hold. Check counts and totals separately for each currency against TrewUp and the remittance. Use reconcile with the checked remittance reference, then set-deadline with the retailer terms. Source columns are preserved in source_data. A byte-equivalent parsed record imported again is unchanged; a changed existing record aborts the whole import instead of overwriting local work. Duplicate identifiers within one retailer are rejected; different retailers can reuse identifiers and must be selected by id when ambiguous.

What carries over: the mapped deduction facts and every original CSV column. What does not: document files, existing disputes and recoveries, comments, distributor connections, access permissions, depletion sales, promotion plans or attached PDFs. Keep TrewUp and original documents available while you reconcile these separately. Record actual dispute receipts and recoveries through their commands after checking their originals. Do not reconstruct a receipt from a dashboard status.

The free build has no distributor credentials or live data collection. Enterprise DNA can map the export and build agreed connections into the managed version. This is a replacement for investigation and recovery records, not a claim that the whole vendor network has been recreated.
