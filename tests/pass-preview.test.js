const test=require('node:test'),assert=require('node:assert/strict');
test('Pass preview resends once without creating a claim or changing activation',async()=>{
  const oldFetch=global.fetch,oldEnv={...process.env};
  Object.assign(process.env,{SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'test',RESEND_API_KEY:'test'});
  const lead={id:'test-id',email:'cole@sweetdreams.us',notes:'Keep notes',feedback:'Keep feedback',version:1,activated_at:'2026-09-11T20:09:05Z',automation_paused:true};
  let sends=0;
  global.fetch=async(url,opt)=>{
    const b=JSON.parse(opt.body);let data;
    if(url.endsWith('revive_check_admin'))data=true;
    else if(url.endsWith('revive_meta_list'))data={leads:[lead]};
    else if(url==='https://api.resend.com/emails'){sends++;assert.equal(opt.headers['Idempotency-Key'],'pass-preview-v1-test-id');assert.equal(b.subject,'Your FREE 7 Day Gym & Recovery Pass | REVIVE');data={id:'preview-provider'};}
    else if(url.endsWith('revive_meta_update')){assert.equal(b.p_action,'notes');assert.equal(b.p_feedback,'Keep feedback');lead.notes=b.p_notes;data=lead;}
    else throw new Error('Unexpected mutation');
    return {ok:true,json:async()=>data};
  };
  async function call(){const res={setHeader(){},status(n){this.code=n;return this;},json(b){this.body=b;}};await require('../api/meta-leads')({method:'POST',body:{password:'test',action:'send_pass_preview',id:lead.id,email:lead.email}},res);return res;}
  try {assert.equal((await call()).body.email_status,'sent');assert.equal((await call()).body.already_sent,true);assert.equal(sends,1);assert.equal(lead.automation_paused,true);assert.equal(lead.activated_at,'2026-09-11T20:09:05Z');}
  finally {global.fetch=oldFetch;for(const key of Object.keys(process.env))if(!(key in oldEnv))delete process.env[key];Object.assign(process.env,oldEnv);}
});
