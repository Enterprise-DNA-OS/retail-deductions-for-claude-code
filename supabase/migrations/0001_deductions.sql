create table retailers (
 id uuid primary key default gen_random_uuid(), name text not null unique, jurisdiction text not null default 'NZ' check(jurisdiction in ('NZ','AU','OTHER')),
 security_ref text, retention_review date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table deductions (
 id uuid primary key default gen_random_uuid(), retailer_id uuid not null references retailers, reference text not null,
 invoice text not null, reason text not null check(reason in ('shortage','pricing','damage','promotion','other')),
 currency text not null check(currency ~ '^[A-Z]{3}$'), amount_cents bigint not null check(amount_cents>0 and amount_cents<=1000000000000),
 deducted_on date not null, deadline date, deadline_source text, owner text not null,
 state text not null default 'review' check(state in ('hold','review','disputed','closed','accepted')),
 reconciled_ref text, resolution_ref text, source_data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(retailer_id,reference),
 check(deadline is null or deadline>=deducted_on), check(state not in ('closed','accepted') or resolution_ref is not null)
);
create table evidence (
 id uuid primary key default gen_random_uuid(), deduction_id uuid not null references deductions, kind text not null check(kind in ('invoice','delivery','agreement','inspection','other')),
 reference text not null, actor text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(deduction_id,kind,reference)
);
create table disputes (
 id uuid primary key default gen_random_uuid(), deduction_id uuid not null unique references deductions, reference text not null unique,
 submitted_on date not null, follow_up date not null, claimed_cents bigint not null check(claimed_cents>0), actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(follow_up>=submitted_on)
);
create table recoveries (
 id uuid primary key default gen_random_uuid(), deduction_id uuid not null references deductions, reference text not null unique,
 received_on date not null, amount_cents bigint not null check(amount_cents>0), actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table actions (
 id uuid primary key default gen_random_uuid(), deduction_id uuid not null references deductions, title text not null, owner text not null, due_on date not null,
 closed_on date, proof text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(closed_on is null or proof is not null)
);
create table notes (
 id uuid primary key default gen_random_uuid(), deduction_id uuid not null references deductions, body text not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table activity (
 id uuid primary key default gen_random_uuid(), entity text not null, record_id uuid not null, operation text not null, actor text not null,
 before_data jsonb, after_data jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function touch_record() returns trigger language plpgsql as $$ begin
 if nullif(current_setting('app.actor',true),'') is null then raise exception 'A named actor is required'; end if;
 if TG_OP='UPDATE' then NEW.updated_at=now(); end if; return NEW; end $$;
create function audit_record() returns trigger language plpgsql as $$ begin
 insert into activity(entity,record_id,operation,actor,before_data,after_data) values(TG_TABLE_NAME,NEW.id,TG_OP,current_setting('app.actor'),case when TG_OP='UPDATE' then to_jsonb(OLD) else null end,to_jsonb(NEW)); return NEW; end $$;
create function immutable_record() returns trigger language plpgsql as $$ begin raise exception 'History is append-only'; end $$;
do $$ declare t text; begin
 foreach t in array array['retailers','deductions','evidence','disputes','recoveries','actions','notes'] loop
 execute format('create trigger touch before insert or update on %I for each row execute function touch_record()',t);
 execute format('create trigger audit after insert or update on %I for each row execute function audit_record()',t);
 execute format('create trigger no_delete before delete on %I for each row execute function immutable_record()',t);
 end loop;
 foreach t in array array['evidence','disputes','recoveries','notes','activity'] loop
 execute format('create trigger immutable before update on %I for each row execute function immutable_record()',t);
 end loop;
 create trigger no_delete before delete on activity for each row execute function immutable_record();
 foreach t in array array['retailers','deductions','evidence','disputes','recoveries','actions','notes','activity'] loop
 execute format('alter table %I enable row level security',t);execute format('revoke all on %I from public',t);
 end loop;
end $$;
create function validate_recovery() returns trigger language plpgsql as $$ declare c deductions; d disputes; total bigint; begin
 select * into c from deductions where id=NEW.deduction_id for update;
 select * into d from disputes where deduction_id=c.id;
 if c.state<>'disputed' or d.id is null then raise exception 'Recovery needs an open dispute'; end if;
 select coalesce(sum(amount_cents),0) into total from recoveries where deduction_id=c.id;
 if total+NEW.amount_cents>d.claimed_cents then raise exception 'Recovery exceeds remaining disputed amount'; end if;
 if NEW.received_on<d.submitted_on or NEW.received_on>current_date then raise exception 'Invalid recovery date'; end if; return NEW; end $$;
create trigger validate_recovery before insert on recoveries for each row execute function validate_recovery();
create view deduction_position as
select d.*,r.name retailer, coalesce(x.recovered_cents,0) recovered_cents,d.amount_cents-coalesce(x.recovered_cents,0) outstanding_cents,
 p.reference dispute_reference,p.follow_up,p.claimed_cents,
 exists(select 1 from evidence e where e.deduction_id=d.id and e.kind='invoice') invoice_evidence,
 exists(select 1 from evidence e where e.deduction_id=d.id and e.kind=case d.reason when 'shortage' then 'delivery' when 'damage' then 'inspection' else 'agreement' end) supporting_evidence,
 d.deadline-current_date days_left
from deductions d join retailers r on r.id=d.retailer_id
left join (select deduction_id,sum(amount_cents)::bigint recovered_cents from recoveries group by deduction_id) x on x.deduction_id=d.id
left join disputes p on p.deduction_id=d.id;
create view deduction_attention as
select reference,retailer,owner,currency,outstanding_cents,days_left,
 case when state='hold' then 'Reconcile import' when deadline is null or nullif(deadline_source,'') is null then 'Confirm deadline'
 when deadline<current_date and state='review' then 'Deadline passed'
 when not invoice_evidence or not supporting_evidence then 'Gather evidence'
 when state='disputed' and follow_up<=current_date then 'Chase response'
 else 'Dispute due' end issue
from deduction_position where state not in ('closed','accepted') and
(state='hold' or deadline is null or nullif(deadline_source,'') is null or not invoice_evidence or not supporting_evidence or
(state='review' and deadline<=current_date+14) or (state='disputed' and follow_up<=current_date));
create view deduction_patterns as
select retailer,reason,currency,count(*) deductions,sum(amount_cents)::bigint deducted_cents,sum(recovered_cents)::bigint recovered_cents,
 sum(case when state not in ('closed','accepted') then outstanding_cents else 0 end)::bigint open_cents,
 count(*) filter(where state='accepted') accepted_count
from deduction_position group by retailer,reason,currency;
create view action_workload as select a.id,a.title,a.owner,a.due_on,current_date-a.due_on overdue_days,d.reference,r.name retailer
from actions a join deductions d on d.id=a.deduction_id join retailers r on r.id=d.retailer_id where a.closed_on is null;
