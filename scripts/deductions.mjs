#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv} from './lib/csv.mjs';
import {table} from './lib/format.mjs';
export const reads={
 retailers:'select * from retailers order by name',
 deductions:'select reference,retailer,invoice,reason,currency,amount_cents,recovered_cents,outstanding_cents,state,owner from deduction_position order by retailer,reference',
 attention:'select * from deduction_attention order by days_left nulls first,reference',
 'dispute-ready':"select reference,retailer,currency,outstanding_cents,days_left,owner from deduction_position where state='review' and reconciled_ref is not null and deadline>=current_date and nullif(deadline_source,'') is not null and invoice_evidence and supporting_evidence order by days_left,reference",
 'deadlines-due':"select reference,retailer,deadline,days_left,state,owner from deduction_position where state in ('review','hold') and (deadline<=current_date+14 or deadline is null) order by deadline nulls first,reference",
 'evidence-gaps':"select reference,retailer,reason,invoice_evidence,supporting_evidence from deduction_position where state not in ('closed','accepted') and (not invoice_evidence or not supporting_evidence) order by reference",
 'follow-ups':"select reference,retailer,dispute_reference,follow_up,currency,outstanding_cents from deduction_position where state='disputed' and follow_up<=current_date order by follow_up,reference",
 recoveries:'select r.reference recovery,d.reference deduction,d.currency,r.amount_cents,r.received_on from recoveries r join deductions d on d.id=r.deduction_id order by r.received_on,r.reference',
 'root-causes':'select * from deduction_patterns order by retailer,reason,currency',
 'owner-workload':"select owner,currency,count(*) open_deductions,sum(outstanding_cents)::bigint outstanding_cents,count(*) filter(where state='hold') holds from deduction_position where state not in ('closed','accepted') group by owner,currency order by owner,currency",
 'month-close':"select retailer,currency,sum(amount_cents)::bigint deductions_cents,sum(recovered_cents)::bigint recovered_cents,sum(case when state='accepted' then outstanding_cents else 0 end)::bigint accepted_cents,sum(case when state not in ('closed','accepted') then outstanding_cents else 0 end)::bigint open_cents from deduction_position group by retailer,currency order by retailer,currency",
 actions:'select * from action_workload order by due_on,title',
 audit:'select entity,record_id,operation,actor,created_at from activity order by created_at desc,id limit 100',
 compliance:`select reference record,'DEADLINE_EVIDENCE' rule,'Confirm retailer terms and recorded deadline' finding,'docs/compliance.md#retailer-rules' source from deductions where state not in ('closed','accepted') and (deadline is null or nullif(deadline_source,'') is null)
 union all select name,'SECURITY_EVIDENCE','Record review of access to supporting documents',case when jurisdiction='AU' then 'https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information' else 'https://www.privacy.org.nz/privacy-principles/5/' end from retailers where jurisdiction in ('NZ','AU') and nullif(security_ref,'') is null
 union all select name,'RETENTION_REVIEW','Review necessity of retained personal information',case when jurisdiction='AU' then 'https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information' else 'https://www.privacy.org.nz/privacy-principles/9/' end from retailers where jurisdiction in ('NZ','AU') and (retention_review is null or retention_review<current_date) order by record,rule`
};
export const syntax={
 ...Object.fromEntries(Object.keys(reads).map(k=>[k,k])),
 card:'card <deduction reference or id>',
 'follow-up':'follow-up <deduction> --date=YYYY-MM-DD --proof=<contact note reference> --actor=<name>',
 'weekly-review':'weekly-review',
 add:'add retailer|deduction --data=<JSON> --actor=<name>',
 reconcile:'reconcile <deduction> --proof=<remittance reference> --actor=<name>',
 'set-deadline':'set-deadline <deduction> --date=YYYY-MM-DD --proof=<retailer terms reference> --actor=<name>',
 evidence:'evidence <deduction> --kind=invoice|delivery|agreement|inspection|other --proof=<reference> --actor=<name>',
 'record-dispute':'record-dispute <deduction> --reference=<portal receipt> --date=YYYY-MM-DD --follow-up=YYYY-MM-DD --amount=<decimal> --actor=<name>',
 'record-recovery':'record-recovery <deduction> --reference=<remittance line> --date=YYYY-MM-DD --amount=<decimal> --actor=<name>',
 close:'close <deduction> --proof=<resolution reference> --actor=<name>',
 accept:'accept <deduction> --proof=<approved write-off> --actor=<name>',
 action:'action <deduction> --title=<root cause task> --owner=<name> --date=YYYY-MM-DD --actor=<name>',
 'close-action':'close-action <action id or title> --proof=<completion evidence> --actor=<name>',
 log:'log <deduction> --note=<text> --actor=<name>',
 'review-privacy':'review-privacy <retailer> --proof=<access review> --date=<retention review date> --actor=<name>',
 import:'import trewup --file=<CSV saved from Excel> --map=<JSON headings map> --actor=<name> [--dry-run]',
 export:'export --out=<new directory>',
 'draft-dispute':'draft-dispute <deduction>',
 'draft-weekly-review':'draft-weekly-review'
};
const allTables=['retailers','deductions','evidence','disputes','recoveries','actions','notes','activity'];
const today=()=>new Date().toISOString().slice(0,10);
const need=(v,key)=>{if(typeof v!=='string'||!v.trim())throw Error(`Required ${key}`);return v.trim();};
export function date(v){need(v,'date');if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Invalid calendar date');return v;}
export function cents(v){const s=String(v??'');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Amount must be a positive decimal with at most two places');const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<=0||n>1e12)throw Error('Amount out of range');return n;}
function args(argv){const pos=[],opt={};for(const a of argv){if(a.startsWith('--')){const i=a.indexOf('=');const k=a.slice(2,i<0?undefined:i);if(k in opt)throw Error(`Duplicate option ${k}`);opt[k]=i<0?true:a.slice(i+1);}else pos.push(a);}const known=['json','actor','data','proof','date','kind','reference','follow-up','amount','title','owner','note','file','map','dry-run','out'];for(const k of Object.keys(opt))if(!known.includes(k))throw Error(`Unknown option ${k}`);return {pos,opt};}
async function resolve(db,t,ref){need(ref,'record');const label=t==='retailers'?'name':t==='actions'?'title':'reference';const rows=await db.query(`select * from ${t} where id::text ilike $1 or ${label} ilike $2 order by ${label}`, [ref+'%', '%'+ref+'%']);const exact=rows.filter(x=>x.id===ref||x[label].toLowerCase()===ref.toLowerCase());if(exact.length===1)return exact[0];if(rows.length!==1)throw Error(rows.length?`Ambiguous ${t}: ${rows.map(x=>x[label]+' ('+x.id+')').join(', ')}`:`No matching ${t}`);return rows[0];}
async function insert(db,t,data){const keys=Object.keys(data);return (await db.query(`insert into ${t} (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(data)))[0];}
const validateKeys=(o,allowed)=>{if(!o||typeof o!=='object'||Array.isArray(o))throw Error('Data must be an object');for(const k of Object.keys(o))if(!allowed.includes(k))throw Error(`Unsupported field ${k}`);};
async function card(db,ref){const d=await resolve(db,'deductions',ref);return {deduction:(await db.query('select * from deduction_position where id=$1',[d.id]))[0],...Object.fromEntries(await Promise.all(['evidence','disputes','recoveries','actions','notes'].map(async t=>[t,await db.query(`select * from ${t} where deduction_id=$1 order by created_at,id`,[d.id])])))};}
export function pretty(data){if(Array.isArray(data)){if(!data.length)return '(none)';return table(data,Object.keys(data[0]).map(key=>({key,label:key.replace(/_cents$/,' amount').replaceAll('_',' '),format:v=>v===null?'unknown':key.endsWith('_cents')?(Number(v)/100).toFixed(2):typeof v==='object'?JSON.stringify(v):String(v)})));}return JSON.stringify(data,null,2);}
function draft(name,body){const dir=path.join(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,name+'-'+randomUUID()+'.md');fs.writeFileSync(file,body+'\n\nDraft only. Nothing sent.\n',{mode:0o600});return {file};}
function csv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);const q=v=>'"'+String(v===null?'':typeof v==='object'?JSON.stringify(v):v).replaceAll('"','""')+'"';return keys.map(q).join(',')+'\n'+rows.map(r=>keys.map(k=>q(r[k])).join(',')).join('\n')+'\n';}
export async function execute(db,argv){const {pos,opt:o}=args(argv);const [cmd='help',ref]=pos;
 if(cmd==='help')return syntax;
 if(reads[cmd])return db.query(reads[cmd]);
 if(cmd==='card')return card(db,ref);
 if(cmd==='weekly-review'){const out={};for(const c of ['attention','dispute-ready','follow-ups','actions','month-close'])out[c]=await execute(db,[c]);return out;}
 if(cmd==='draft-weekly-review')return draft('weekly-review','# Monday deduction review\n\n'+pretty(await execute(db,['weekly-review'])));
 if(cmd==='draft-dispute'){const c=await card(db,ref);return draft('dispute','# Dispute review draft\n\n'+pretty(c)+'\n\nCheck the retailer deadline and attached originals before submitting through the retailer portal. Evidence references are recorded locations, not downloaded attachments.');}
 if(cmd==='export'){const dest=path.resolve(need(o.out,'out'));await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{const records={};for(const t of allTables)records[t]=await db.query(`select * from ${t} order by id`);fs.mkdirSync(dest,{mode:0o700});fs.writeFileSync(path.join(dest,'snapshot.json'),JSON.stringify({at:new Date().toISOString(),records},null,2),{mode:0o600});for(const [t,rows] of Object.entries(records))fs.writeFileSync(path.join(dest,t+'.csv'),csv(rows),{mode:0o600});return {directory:dest,counts:Object.fromEntries(Object.entries(records).map(([t,r])=>[t,r.length]))};}finally{await db.exec('ROLLBACK');}}
 if(!syntax[cmd])throw Error('Unknown command: '+cmd);
 need(o.actor,'actor');await db.exec('BEGIN');try{await db.query("select set_config('app.actor',$1,true)",[o.actor]);let result;
 if(cmd==='add'){
 const data=JSON.parse(need(o.data,'data'));
 if(ref==='retailer'){validateKeys(data,['name','jurisdiction']);result=await insert(db,'retailers',{name:need(data.name,'name'),jurisdiction:data.jurisdiction||'OTHER'});}
 else if(ref==='deduction'){validateKeys(data,['retailer','reference','invoice','reason','currency','amount','deducted_on','owner']);const r=await resolve(db,'retailers',data.retailer);date(data.deducted_on);if(data.deducted_on>today())throw Error('Deduction date is in the future');result=await insert(db,'deductions',{retailer_id:r.id,reference:need(data.reference,'reference'),invoice:need(data.invoice,'invoice'),reason:need(data.reason,'reason'),currency:need(data.currency,'currency'),amount_cents:cents(data.amount),deducted_on:data.deducted_on,owner:need(data.owner,'owner'),state:'hold'});}
 else throw Error('add retailer|deduction');
 }else if(cmd==='import'){
 if(ref!=='trewup')throw Error('Supported import: trewup');
 const rows=parseCsv(fs.readFileSync(need(o.file,'file'),'utf8'));const map=JSON.parse(fs.readFileSync(need(o.map,'map'),'utf8'));
 const fields=['retailer','reference','invoice','reason','currency','amount','deducted_on','owner'];validateKeys(map,fields);for(const k of fields)need(map[k],`mapping for ${k}`);
 const seen=new Set();let imported=0,unchanged=0;
 for(const row of rows){for(const col of Object.values(map))if(!(col in row))throw Error('Missing mapped column '+col);const d=Object.fromEntries(fields.map(k=>[k,need(row[map[k]],k)]));const key=d.retailer.toLowerCase()+'|'+d.reference;if(seen.has(key))throw Error('Duplicate deduction in file');seen.add(key);date(d.deducted_on);if(d.deducted_on>today())throw Error('Future deduction date');const amount=cents(d.amount);
 if(!['shortage','pricing','damage','promotion','other'].includes(d.reason))throw Error('Map reason to shortage|pricing|damage|promotion|other before import');
 let r=(await db.query('select * from retailers where lower(name)=lower($1)',[d.retailer]))[0];if(!r)r=await insert(db,'retailers',{name:d.retailer,jurisdiction:'OTHER'});
 const old=(await db.query('select * from deductions where retailer_id=$1 and reference=$2',[r.id,d.reference]))[0];
 if(old){if(JSON.stringify(old.source_data)!==JSON.stringify(row)&&JSON.stringify(Object.entries(old.source_data).sort())!==JSON.stringify(Object.entries(row).sort()))throw Error('Changed existing deduction: '+d.reference);unchanged++;continue;}
 await insert(db,'deductions',{retailer_id:r.id,reference:d.reference,invoice:d.invoice,reason:d.reason,currency:d.currency,amount_cents:amount,deducted_on:d.deducted_on,owner:d.owner,state:'hold',source_data:JSON.stringify(row)});imported++;
 }result={imported,unchanged,held_for_reconciliation:imported,dry_run:!!o['dry-run']};
 }else if(cmd==='review-privacy'){const r=await resolve(db,'retailers',ref);result=(await db.query('update retailers set security_ref=$1,retention_review=$2 where id=$3 returning *',[need(o.proof,'proof'),date(o.date),r.id]))[0];
 }else if(cmd==='close-action'){const a=await resolve(db,'actions',ref);if(a.closed_on)throw Error('Action already closed');result=(await db.query('update actions set closed_on=current_date,proof=$1 where id=$2 returning *',[need(o.proof,'proof'),a.id]))[0];
 }else{
 const found=await resolve(db,'deductions',ref);const d=(await db.query('select * from deductions where id=$1 for update',[found.id]))[0];
 if(['closed','accepted'].includes(d.state)&&!['log','action'].includes(cmd))throw Error('Deduction is closed');
 if(cmd==='reconcile'){if(d.state!=='hold')throw Error('Only held deductions need reconciliation');result=(await db.query("update deductions set state='review',reconciled_ref=$1 where id=$2 returning *",[need(o.proof,'proof'),d.id]))[0];}
 else if(cmd==='set-deadline'){if(!['hold','review'].includes(d.state))throw Error('Deadline is frozen after dispute');const dt=date(o.date);if(dt<d.deducted_on)throw Error('Deadline predates deduction');result=(await db.query('update deductions set deadline=$1,deadline_source=$2 where id=$3 returning *',[dt,need(o.proof,'proof'),d.id]))[0];}
 else if(cmd==='follow-up'){if(d.state!=='disputed')throw Error('Follow-up needs an open dispute');const dt=date(o.date);if(dt<today())throw Error('Next follow-up cannot be in the past');result=(await db.query('update deductions set next_follow_up=$1,follow_up_ref=$2 where id=$3 returning *',[dt,need(o.proof,'proof'),d.id]))[0];}
 else if(cmd==='evidence')result=await insert(db,'evidence',{deduction_id:d.id,kind:need(o.kind,'kind'),reference:need(o.proof,'proof'),actor:o.actor});
 else if(cmd==='record-dispute'){
 const p=(await db.query('select * from deduction_position where id=$1',[d.id]))[0];const dt=date(o.date),follow=date(o['follow-up']),amount=cents(o.amount);
 if(d.state!=='review'||!d.reconciled_ref)throw Error('Reconciled review required');
 if(!d.deadline||!d.deadline_source||dt>d.deadline||dt<d.deducted_on||dt>today())throw Error('Invalid or unsupported dispute date/deadline');
 if(follow<dt)throw Error('Follow-up predates submission');if(!p.invoice_evidence||!p.supporting_evidence)throw Error('Invoice and supporting evidence required');if(amount>d.amount_cents)throw Error('Claim exceeds deduction');
 result=await insert(db,'disputes',{deduction_id:d.id,reference:need(o.reference,'reference'),submitted_on:dt,follow_up:follow,claimed_cents:amount,actor:o.actor});await db.query("update deductions set state='disputed' where id=$1",[d.id]);
 }else if(cmd==='record-recovery')result=await insert(db,'recoveries',{deduction_id:d.id,reference:need(o.reference,'reference'),received_on:date(o.date),amount_cents:cents(o.amount),actor:o.actor});
 else if(cmd==='close'||cmd==='accept'){
 const p=(await db.query('select * from deduction_position where id=$1',[d.id]))[0];if(d.state==='hold')throw Error('Reconcile before resolution');if(cmd==='close'&&p.outstanding_cents!==0)throw Error('Outstanding deduction remains; use accept with authorised write-off evidence');result=(await db.query('update deductions set state=$1,resolution_ref=$2 where id=$3 returning *',[cmd==='close'?'closed':'accepted',need(o.proof,'proof'),d.id]))[0];
 }else if(cmd==='action')result=await insert(db,'actions',{deduction_id:d.id,title:need(o.title,'title'),owner:need(o.owner,'owner'),due_on:date(o.date)});
 else if(cmd==='log')result=await insert(db,'notes',{deduction_id:d.id,body:need(o.note,'note'),actor:o.actor});
 else throw Error('Unsupported operation');
 }
 await db.exec(o['dry-run']?'ROLLBACK':'COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const out=await execute(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(out,null,2):pretty(out));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}
