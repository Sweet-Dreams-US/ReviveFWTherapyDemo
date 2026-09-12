const { verify } = require('./_pass-unsubscribe');
const { rpc } = require('./_lead-sync');
module.exports = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  let body=req.body || {};
  if(typeof body==='string') { try {body=JSON.parse(body);} catch(_) {body=Object.fromEntries(new URLSearchParams(body));} }
  const token=(req.query || {}).token || body.token, id=verify(token);
  if(!id) return res.status(400).json({error:'This unsubscribe link is not valid. Contact info@revivefw.com for help.'});
  // Email scanners may GET links. Only an explicit POST changes a preference.
  if(req.method==='GET') {res.setHeader('Location','https://revivefw.com/pass-unsubscribe#token='+token);return res.status(303).end();}
  try {
    const ok=await rpc('revive_unsubscribe_pass',{p_token:process.env.CRON_SECRET,p_id:id});
    if(!ok) return res.status(404).json({error:'This pass record is no longer available.'});
    if(body['List-Unsubscribe']==='One-Click') return res.status(200).end();
    return res.status(200).json({ok:true});
  } catch(_) {return res.status(503).json({error:'Could not save your preference. Please try again or contact info@revivefw.com.'});}
};
