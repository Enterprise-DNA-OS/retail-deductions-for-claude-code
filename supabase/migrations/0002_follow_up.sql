alter table deductions add column next_follow_up date, add column follow_up_ref text;
create or replace view deduction_position as
select d.id,d.retailer_id,d.reference,d.invoice,d.reason,d.currency,d.amount_cents,d.deducted_on,d.deadline,d.deadline_source,d.owner,d.state,d.reconciled_ref,d.resolution_ref,d.source_data,d.created_at,d.updated_at,r.name retailer, coalesce(x.recovered_cents,0) recovered_cents,d.amount_cents-coalesce(x.recovered_cents,0) outstanding_cents,
 p.reference dispute_reference,coalesce(d.next_follow_up,p.follow_up) follow_up,p.claimed_cents,
 exists(select 1 from evidence e where e.deduction_id=d.id and e.kind='invoice') invoice_evidence,
 exists(select 1 from evidence e where e.deduction_id=d.id and e.kind=case d.reason when 'shortage' then 'delivery' when 'damage' then 'inspection' else 'agreement' end) supporting_evidence,
 d.deadline-current_date days_left
from deductions d join retailers r on r.id=d.retailer_id
left join (select deduction_id,sum(amount_cents)::bigint recovered_cents from recoveries group by deduction_id) x on x.deduction_id=d.id
left join disputes p on p.deduction_id=d.id;
