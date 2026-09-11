const test = require('node:test');
const assert = require('node:assert/strict');
const { passEmail } = require('../api/_pass-email');
const { experienceEmail } = require('../api/_experience-email');
const feedbackUrl = 'https://revivefw.com/pass-feedback#token=private-test-link';
const clean = value => value.replace(/https?:\/\/\S+/g, '').replace(/<[^>]*>/g, '').replace(/&(?:ndash|mdash|hyphen);|&#(?:45|8211|8212);/g, '-');
test('authored email subjects and rendered copy have no dashes', () => {
  for (const template of [passEmail, experienceEmail]) {
    const email = template('cole@sweetdreams.us', feedbackUrl);
    assert.doesNotMatch(email.subject, /[-\u2010-\u2015]/);
    assert.doesNotMatch(clean(email.text), /[-\u2010-\u2015]/);
    assert.doesNotMatch(clean(email.html.replace(/<[^>]*>/g, '')), /[-\u2010-\u2015]/);
  }
  const email=experienceEmail('cole@sweetdreams.us', feedbackUrl);
  assert.match(email.html,/How did/);assert.match(email.html,/No email reply needed/);
  assert.ok(email.html.includes('href="' + feedbackUrl + '"'));
  assert.doesNotMatch(email.html,/Just reply|mailto:info@revivefw.com\?subject/);
  assert.doesNotMatch(email.html,/YOUR FREE PASS IS READY|Your seven days have not started/);
  assert.match(email.text,/What did you try/);
});
test('experience preview records a test without changing redemption and rejects duplicate test sends', async () => {
  const oldFetch=global.fetch,oldEnv={...process.env};
  Object.assign(process.env,{SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'test',RESEND_API_KEY:'test',CRON_SECRET:'s'.repeat(64)});
  const lead={id:'00000000-0000-4000-8000-000000000001',activated_at:new Date().toISOString(),email:'cole@sweetdreams.us',notes:'Existing notes',feedback:'Recovery',version:4,do_not_contact:false};
  let sends=0;
  global.fetch=async(url,options)=>{
    const body=JSON.parse(options.body);let data;
    if(url.endsWith('revive_check_admin'))data=true;
    else if(url.endsWith('revive_meta_list'))data={leads:[lead]};
    else if(url==='https://api.resend.com/emails'){sends++;assert.equal(options.headers['Idempotency-Key'],'experience-preview-v2-' + lead.id);assert.match(body.html,/pass-feedback#token=/);data={id:'provider-test'};}
    else if(url.endsWith('revive_meta_update')){assert.equal(body.p_action,'notes');assert.equal(body.p_feedback,'Recovery');assert.match(body.p_notes,/^Existing notes/);lead.notes=body.p_notes;data=lead;}
    else throw new Error('Unexpected request');
    return {ok:true,json:async()=>data};
  };
  try {
    for(let i=0;i<2;i++){
      const res={setHeader(){},status(n){this.code=n;return this;},json(data){this.body=data;return this;}};
      await require('../api/meta-leads')({method:'POST',body:{password:'test',action:'send_experience_preview',id:lead.id,email:lead.email}},res);
      assert.equal(res.code,200);assert.equal(res.body.ok,true);
      if(i===1)assert.equal(res.body.already_sent,true);
    }
    assert.equal(sends,1);
  } finally {global.fetch=oldFetch;for(const k of Object.keys(process.env))if(!(k in oldEnv))delete process.env[k];Object.assign(process.env,oldEnv);}
});
