(function(){
  'use strict';
  var button=document.getElementById('unsubscribe'),status=document.getElementById('status');
  var token=new URLSearchParams(location.hash.slice(1)).get('token');
  if(!token){button.disabled=true;status.textContent='Please use the unsubscribe link in your pass email.';return;}
  button.addEventListener('click',async function(){
    button.disabled=true;status.textContent='Saving your preference…';
    try{
      var response=await fetch('/api/pass-unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:token}),signal:AbortSignal.timeout(15000)});
      var data=await response.json();if(!response.ok || !data.ok)throw new Error(data.error||'Please try again.');
      status.textContent='You are unsubscribed from future pass followup and offer emails. Your pass is unchanged. A message already being sent may still arrive.';button.hidden=true;
    }catch(error){status.textContent=error.message;button.disabled=false;}
  });
})();
