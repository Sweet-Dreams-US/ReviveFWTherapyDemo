const { rpc } = require('./_lead-sync');
const { addUnsubscribe } = require('./_pass-unsubscribe');
function template(job) {
  const lead={id:job.lead_id,activated_at:job.activated_at};
  const email=job.stage==='experience' ? require('./_experience-email').experienceEmail(job.email,require('./_feedback-link').feedbackLink(lead))
    : job.stage==='day5' ? require('./_day5-email').day5Email(job.email,job.activated_at)
    : job.stage==='day7' ? require('./_day7-email').day7Email(job.email,job.activated_at)
    : job.stage==='day10' ? require('./_later-offer-email').day10Email(job.email)
    : job.stage==='day13' ? require('./_pt-offer-email').ptBonusEmail(job.email,job.activated_at,'day13') : null;
  if(!email) throw new Error('Unknown stage');
  return addUnsubscribe(email,job.lead_id);
}
async function runFollowups() {
  const token=process.env.CRON_SECRET, summary={sent:0,failed:0,skipped:0};
  if(!process.env.RESEND_API_KEY) return {...summary,error:'Email is not configured'};
  const jobs=await rpc('revive_plan_followups',{p_token:token});
  const started=Date.now();
  for(const job of jobs) {
    if(Date.now()-started>35000) break;
    let prepared;
    try {
      prepared=await rpc('revive_prepare_followup',{p_token:token,p_id:job.id,p_payload:template(job)});
      if(prepared.status!=='ready') {summary.skipped++;continue;}
      const response=await fetch('https://api.resend.com/emails',{
        method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':'pass-followup-v1-'+job.id},
        body:JSON.stringify(prepared.payload),signal:AbortSignal.timeout(10000)
      });
      const sent=await response.json();
      if(!response.ok || !sent.id) throw new Error('Provider acceptance not confirmed');
      await rpc('revive_finish_followup',{p_token:token,p_id:job.id,p_lease:prepared.lease,p_provider_id:sent.id,p_error:null});
      summary.sent++;
    } catch(_) {
      summary.failed++;
      if(prepared && prepared.lease) await rpc('revive_finish_followup',{p_token:token,p_id:job.id,p_lease:prepared.lease,p_provider_id:null,p_error:'Send incomplete. Automatic retry retains the same message and idempotency key.'}).catch(()=>{});
    }
  }
  await rpc('revive_record_followup_run',{p_token:token,p_summary:summary});
  return summary;
}
module.exports={template,runFollowups};
