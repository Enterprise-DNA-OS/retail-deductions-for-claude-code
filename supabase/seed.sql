do $$ begin
 if exists(select 1 from retailers where id='10000000-0000-4000-8000-000000000001') then return;end if;
 perform set_config('app.actor','Fictional demo seed',true);
 insert into retailers(id,name,jurisdiction,security_ref,retention_review) values
 ('10000000-0000-4000-8000-000000000001','Harbour Grocery','NZ','local://access-review',current_date+90),
 ('10000000-0000-4000-8000-000000000002','Southern Distribution','AU',null,current_date-10);
 insert into deductions(id,retailer_id,reference,invoice,reason,currency,amount_cents,deducted_on,deadline,deadline_source,owner,state,reconciled_ref) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','HG-001','INV-100','shortage','NZD',125000,current_date-20,current_date+3,'local://demo-terms','Ari','review','local://remit-1'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','HG-002','INV-101','shortage','NZD',84000,current_date-15,current_date+8,'local://demo-terms','Ari','review','local://remit-2'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','SD-001','INV-102','pricing','AUD',200000,current_date-30,current_date+30,'local://demo-terms','Mo','disputed','local://remit-3'),
 ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','SD-002','INV-103','damage','AUD',40000,current_date-10,current_date-1,'local://demo-terms','Mo','review','local://remit-4'),
 ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','HG-003','INV-104','promotion','NZD',65000,current_date-4,null,null,'Ari','hold',null);
 insert into evidence(deduction_id,kind,reference,actor)
 select id,'invoice','local://demo-invoice-'||reference,'Fictional demo seed' from deductions where state<>'hold';
 insert into evidence(deduction_id,kind,reference,actor) values
 ('20000000-0000-4000-8000-000000000001','delivery','local://signed-pod','Fictional demo seed'),
 ('20000000-0000-4000-8000-000000000003','agreement','local://price-agreement','Fictional demo seed');
 insert into disputes(deduction_id,reference,submitted_on,follow_up,claimed_cents,actor) values
 ('20000000-0000-4000-8000-000000000003','DSP-100',current_date-12,current_date-2,200000,'Fictional demo seed');
 insert into recoveries(deduction_id,reference,received_on,amount_cents,actor) values
 ('20000000-0000-4000-8000-000000000003','REM-100',current_date-3,75000,'Fictional demo seed');
 insert into actions(deduction_id,title,owner,due_on) values
 ('20000000-0000-4000-8000-000000000001','Check pick accuracy on the Harbour route','Ari',current_date-2),
 ('20000000-0000-4000-8000-000000000003','Confirm price file effective dates','Mo',current_date+4);
 end $$;
