const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/claim-pass');
const { passEmail, claimAndEmail } = require('../api/_pass-email');
function response() { return { setHeader() {}, status(n) { this.code=n; return this; }, json(body) { this.body=body; return this; } }; }
const input = { fullName:'Test Guest', email:'TEST@example.com', phone:'', turnstileToken:'test-token' };
function json(data, status=200) { return { ok:status===200, status, json:async()=>data }; }

test('claim form: validation, fail-closed Turnstile, saved-only success, email idempotency', async () => {
  const oldFetch=global.fetch, oldEnv={...process.env};
  Object.assign(process.env,{TURNSTILE_SECRET_KEY:'test',CRON_SECRET:'test',SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'test',RESEND_API_KEY:'test'});
  try {
    for (const verification of [{success:false},{success:true,hostname:'attacker.test',action:'claim_pass'},{success:true,hostname:'revivefw.com',action:'wrong'}]) {
      let calls=0;global.fetch=async()=>{calls++;return json(verification);};
      const res=response();await handler({method:'POST',body:input},res);assert.equal(res.code,400);assert.equal(calls,1);
    }
    global.fetch=async()=>{throw new Error('outage');};
    let res=response();await handler({method:'POST',body:input},res);assert.equal(res.code,503);
    global.fetch=async()=>{throw new Error('No request expected');};
    res=response();await handler({method:'POST',body:{...input,turnstileToken:''}},res);assert.equal(res.code,400);
    res=response();await handler({method:'POST',body:{...input,email:'invalid'}},res);assert.equal(res.code,400);
    delete process.env.TURNSTILE_SECRET_KEY;
    res=response();await handler({method:'POST',body:input},res);assert.equal(res.code,503);
    process.env.TURNSTILE_SECRET_KEY='test';
    const calls=[];
    global.fetch=async(url,options)=>{
      calls.push(String(url));
      if(String(url).includes('siteverify'))return json({success:true,hostname:'revivefw.com',action:'claim_pass'});
      if(String(url).endsWith('revive_claim_website_pass')){const p=JSON.parse(options.body);assert.equal(p.p_email,'test@example.com');assert.equal(p.p_phone,'');return json(true);}
      if(String(url).endsWith('revive_prepare_pass_email'))return json({status:'ready',lead_id:'test-lead',payload:passEmail('test@example.com')});
      if(String(url)==='https://api.resend.com/emails'){assert.equal(options.headers['Idempotency-Key'],'pass-confirmation-test-lead');return json({id:'test-provider'});}
      if(String(url).endsWith('revive_finish_pass_email')){assert.equal(JSON.parse(options.body).p_provider_id,'test-provider');return json(null);}
      throw new Error('Unexpected request');
    };
    res=response();await handler({method:'POST',body:input},res);
    assert.equal(res.code,200);assert.equal(res.body.email_status,'sent');assert.equal(calls.length,5);
    global.fetch=async(url)=>{if(String(url).endsWith('revive_claim_website_pass'))return json(true);if(String(url).endsWith('revive_prepare_pass_email'))return json({status:'sent'});throw new Error('Duplicate email attempted');};
    assert.equal((await claimAndEmail({name:'Test',email:'test@example.com'})).email_status,'sent');
    global.fetch=async()=>json({message:'storage unavailable'},502);
    res=response();await handler({method:'POST',body:input},res);assert.notEqual(res.code,200);
  } finally {global.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);}
});

test('email contains a readable text alternative, redemption link, privacy, and escaped recipient',()=>{
  const email=passEmail('<guest>@example.com');
  assert.match(email.html,/&lt;guest&gt;/);assert.doesNotMatch(email.html,/<guest>/);
  assert.match(email.text,/have NOT started/);assert.match(email.html,/https:\/\/revivefw.com\/free-pass#redeem/);
  assert.match(email.text,/Privacy:/);assert.match(email.html,/role="presentation"/);
});
