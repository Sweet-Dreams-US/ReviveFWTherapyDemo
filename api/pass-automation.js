const { timingSafeEqual }=require('node:crypto');
const { requireAdmin }=require('./_lead-sync');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try {
    if(!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
    if(!process.env.CRON_SECRET) return res.status(503).json({error:'Automation is not configured'});
    if(req.method==='GET') {
      const a=Buffer.from(String((req.headers||{}).authorization||'')),b=Buffer.from('Bearer '+process.env.CRON_SECRET);
      if(a.length!==b.length || !timingSafeEqual(a,b)) return res.status(401).json({error:'Unauthorized'});
    } else {
      let body=req.body; if(typeof body==='string') {try{body=JSON.parse(body);}catch(_){return res.status(400).json({error:'Invalid JSON'});}}
      await requireAdmin(body && body.password);
    }
    const result=await require('./_pass-followups').runFollowups();
    return res.status(result.error || result.failed ? 502 : 200).json(result);
  } catch(error) {console.error('Pass automation failed',error.status||502);return res.status(error.status||502).json({error:error.status===401?'Unauthorized':'Pass automation needs review'});}
};
