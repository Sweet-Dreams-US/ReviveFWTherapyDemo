const test=require('node:test'),assert=require('node:assert/strict');
const {tokenFor,verify}=require('../api/_pass-unsubscribe');
const {template,runFollowups}=require('../api/_pass-followups');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(b){this.body=b;return this;},end(){this.ended=true;return this;}};}
function json(data,ok=true){return {ok,json:async()=>data};}
async function isolated(fn){const oldFetch=global.fetch,oldEnv={...process.env};Object.assign(process.env,{CRON_SECRET:'synthetic-secret-'.repeat(4),RESEND_API_KEY:'test',SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'test'});try{await fn();}finally{global.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in oldEnv))delete process.env[k];Object.assign(process.env,oldEnv);}}

test('Followup templates: scoped opt-out, private feedback, approved offer, no dashes in copy',()=>isolated(async()=>{
  const token=tokenFor(id);assert.equal(verify(token),id);assert.equal(verify(token+'x'),null);assert.equal(verify(token,'wrong-secret'.repeat(4)),null);
  assert.equal(verify(token.replace('aaaaaaaa','bbbbbbbb')),null);
  for(const stage of ['experience','day5','day7','day10','day13']){
    const mail=template({stage,lead_id:id,email:'guest@example.com',activated_at:'2026-09-12T16:00:00Z',offer:{essential:79,plus:119.5,elite:149}});
    assert.deepEqual(mail.to,['guest@example.com']);assert.match(mail.html,/Unsubscribe from pass emails/);
    assert.match(mail.headers['List-Unsubscribe'],/^<https:\/\/revivefw.com\/api\/pass-unsubscribe\?token=/);
    assert.equal(mail.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
    assert.doesNotMatch(mail.subject, /[-–—]/);
    const copy=mail.text.replace(/https?:\/\/\S+/g,'').replace(/[\w.+-]+@[\w.-]+/g,'');assert.doesNotMatch(copy,/[-–—]/);
    if(stage==='experience'){assert.match(mail.html,/pass-feedback#token=/);assert.doesNotMatch(mail.text,/help.*plan.*visit|just reply/i);}
    else if(stage==='day10'){assert.match(mail.text,/three more free days/);assert.match(mail.text,/start when you check in/);assert.doesNotMatch(mail.text,/Kings Nutrition|\$/);}
    else if(stage==='day13'){assert.match(mail.text,/Essential: \$79 per month \(normally \$89/);assert.match(mail.text,/Plus: \$119\.50 per month/);assert.match(mail.text,/Elite: \$149 per month/);assert.match(mail.text,/month to month with no contract/);}
    else{assert.match(mail.text,/Kings Nutrition/);assert.match(mail.text,/Elite/);}
  }
}));

test('Day 13 never sends without valid preferred rates below the published prices',()=>isolated(async()=>{
  const {validateSixMonthRates,STANDARD_RATES}=require('../api/_later-offer-email');
  const job={stage:'day13',lead_id:id,email:'guest@example.com',activated_at:'2026-09-12T16:00:00Z'};
  assert.throws(()=>template(job),/Essential rate/);
  assert.throws(()=>template({...job,offer:{essential:79,plus:119}}),/Elite rate/);
  assert.throws(()=>validateSixMonthRates({essential:89,plus:119,elite:149}),/below the standard \$89/);
  assert.throws(()=>validateSixMonthRates({essential:79.999,plus:119,elite:149}),/two decimal/);
  assert.deepEqual(validateSixMonthRates({essential:'79.99',plus:'119.10',elite:'149'}),{essential:79.99,plus:119.1,elite:149});
  // The "normally $X" line must match what the pricing page actually charges.
  const pricing=require('fs').readFileSync(require('path').join(__dirname,'../pricing.html'),'utf8');
  for(const [tier,price] of Object.entries({Essential:STANDARD_RATES.essential,Plus:STANDARD_RATES.plus,Elite:STANDARD_RATES.elite}))
    assert.match(pricing,new RegExp(tier+' \\$'+price+'/mo'));
}));

test('Unsubscribe GET never mutates; valid explicit and one-click POSTs do; tampering fails',()=>isolated(async()=>{
  let calls=0;global.fetch=async(url,opt)=>{calls++;assert.ok(url.endsWith('revive_unsubscribe_pass'));assert.equal(JSON.parse(opt.body).p_id,id);return json(true);};
  const handler=require('../api/pass-unsubscribe'),token=tokenFor(id);
  let r=res();await handler({method:'GET',query:{token}},r);assert.equal(r.code,303);assert.equal(calls,0);
  r=res();await handler({method:'POST',body:{token:token+'bad'}},r);assert.equal(r.code,400);assert.equal(calls,0);
  r=res();await handler({method:'POST',body:{token}},r);assert.equal(r.code,200);assert.equal(r.body.ok,true);
  r=res();await handler({method:'POST',query:{token},body:'List-Unsubscribe=One-Click'},r);assert.equal(r.code,200);assert.equal(r.ended,true);assert.equal(calls,2);
  global.fetch=async()=>json(false);r=res();await handler({method:'POST',body:{token}},r);assert.equal(r.code,404);
}));

test('Worker sends only leased jobs, frozen payload and stable key; failure records safe retry',()=>isolated(async()=>{
  const jobs=[{id:'job1',lead_id:id,email:'guest@example.com',stage:'experience',activated_at:'2026-09-12T16:00:00Z'}, {id:'job2',lead_id:id,email:'guest@example.com',stage:'day5',activated_at:'2026-09-12T16:00:00Z'}];
  let sends=0,fail=false;const finishes=[];
  global.fetch=async(url,opt)=>{const b=JSON.parse(opt.body);
    if(url.endsWith('revive_plan_followups'))return json(jobs);
    if(url.endsWith('revive_prepare_followup'))return json(b.p_id==='job1'?{status:'ready',lease:'lease1',payload:{subject:'Frozen approved message',to:['guest@example.com']}}:{status:'blocked'});
    if(url==='https://api.resend.com/emails'){sends++;assert.equal(b.subject,'Frozen approved message');assert.equal(opt.headers['Idempotency-Key'],'pass-followup-v1-job1');return json(fail?{}:{id:'provider-test'},!fail);}
    if(url.endsWith('revive_finish_followup')){assert.equal(b.p_lease,'lease1');finishes.push(b);return json(null);}
    if(url.endsWith('revive_record_followup_run'))return json(null);
    throw new Error('Unexpected network request');
  };
  assert.deepEqual(await runFollowups(),{sent:1,failed:0,skipped:1});assert.equal(finishes[0].p_provider_id,'provider-test');
  fail=true;assert.deepEqual(await runFollowups(),{sent:0,failed:1,skipped:1});assert.equal(finishes[1].p_provider_id,null);assert.equal(sends,2);
}));

test('Automation endpoint rejects unauthenticated callers before any send',()=>isolated(async()=>{
  global.fetch=async()=>{throw new Error('No network allowed');};const handler=require('../api/pass-automation');
  for(const req of [{method:'GET',headers:{}},{method:'POST',body:{}},{method:'DELETE'}]){const r=res();await handler(req,r);assert.ok([401,405].includes(r.code));}
}));
