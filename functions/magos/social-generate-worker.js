import crypto from "node:crypto";
import { defineSecret } from "firebase-functions/params";

export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
export const GOOGLE_SERVICE_ACCOUNT_JSON = defineSecret("GOOGLE_SERVICE_ACCOUNT_JSON");
export const MAGOS_SOCIAL_WEBHOOK_SECRET = defineSecret("MAGOS_SOCIAL_WEBHOOK_SECRET");

export const GENERATE_WORKER_SECRETS = [
  OPENAI_API_KEY,
  GOOGLE_SERVICE_ACCOUNT_JSON,
  MAGOS_SOCIAL_WEBHOOK_SECRET
];

const AUTOMATION_ID = "MGOS-SOCIAL-GENERATE-01";
const MODEL = "gpt-5.6-luna";
const PROMPT_VERSION = "SOCIAL-V1.0.0";
const SEO_SHEET_ID = "1fsX82j4eZDoRcP_jHdbXSN0GDMfPHEdlHlO_Iq0fF-A";
const AUDIT_SHEET_ID = "1Y4iP2mVCIph8MrIL51mo-KpzgUkZbWW7ZUIlkH8lOTw";
const SOURCE_TAB = "Social Source Events";
const QUEUE_TAB = "Social Content Queue";
const CHANNEL_TAB = "Social Channel Config";
const RUN_TAB = "Automation_Run_Log";

function now(){ return new Date().toISOString(); }
function sha256(v){ return crypto.createHash("sha256").update(v).digest("hex"); }
function safeEq(a,b){
  const x=Buffer.from(String(a||"")), y=Buffer.from(String(b||""));
  return x.length===y.length && crypto.timingSafeEqual(x,y);
}
function b64url(v){
  return Buffer.from(v).toString("base64").replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}
function parseSa(raw){
  const sa=JSON.parse(raw);
  if(!sa.client_email||!sa.private_key) throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON");
  return sa;
}
async function token(raw){
  const sa=parseSa(raw), t=Math.floor(Date.now()/1000);
  const h=b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const c=b64url(JSON.stringify({
    iss:sa.client_email,
    scope:"https://www.googleapis.com/auth/spreadsheets",
    aud:"https://oauth2.googleapis.com/token",
    iat:t, exp:t+3600
  }));
  const unsigned=`${h}.${c}`;
  const signer=crypto.createSign("RSA-SHA256"); signer.update(unsigned); signer.end();
  const sig=signer.sign(sa.private_key).toString("base64").replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
  const r=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:`${unsigned}.${sig}`})
  });
  const j=await r.json();
  if(!r.ok||!j.access_token) throw new Error(`Google OAuth failed: ${j.error_description||j.error||r.statusText}`);
  return j.access_token;
}
function rangeUrl(id,range){
  return `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`;
}
async function getVals(id,range,accessToken){
  const r=await fetch(rangeUrl(id,range),{headers:{Authorization:`Bearer ${accessToken}`}});
  const j=await r.json(); if(!r.ok) throw new Error(`Sheets read failed: ${j?.error?.message||r.statusText}`);
  return j.values||[];
}
async function appendVals(id,range,values,accessToken){
  const r=await fetch(`${rangeUrl(id,range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&includeValuesInResponse=true`,{
    method:"POST",
    headers:{Authorization:`Bearer ${accessToken}`,"content-type":"application/json"},
    body:JSON.stringify({majorDimension:"ROWS",values})
  });
  const j=await r.json(); if(!r.ok) throw new Error(`Sheets append failed: ${j?.error?.message||r.statusText}`);
  return j;
}
async function sourceEvent(id,accessToken){
  const rows=await getVals(SEO_SHEET_ID,`'${SOURCE_TAB}'!A2:P1000`,accessToken);
  const row=rows.find(r=>r[0]===id);
  if(!row) throw new Error(`Source event not found: ${id}`);
  return {
    sourceEventId:row[0], sourceSystem:row[1], sourceProviderId:row[2],
    wpPostId:row[3], modifiedGmt:row[4], sourceHash:row[5], sourceUrl:row[6],
    sourceTitle:row[7], sourceStatus:row[8], featuredMediaRef:row[9]||"",
    receivedAt:row[11], isCurrent:row[12], idempotencyKey:row[14], processingState:row[15]
  };
}
async function channelConfig(accessToken){
  const rows=await getVals(SEO_SHEET_ID,`'${CHANNEL_TAB}'!A2:P100`,accessToken);
  const m=new Map();
  for(const r of rows){
    if(r[0]&&r[1]==="YES") m.set(r[0],{
      channel:r[0], variants:Math.max(1,Number(r[2]||1)),
      maxChars:Number(r[8]||1500), hashtagPolicy:r[9]||"",
      mediaPolicy:r[10]||"", ctaType:r[11]||"READ_MORE", autoPublish:r[4]||"NO"
    });
  }
  return m;
}
function variantNames(n){ return Array.from({length:n},(_,i)=>String.fromCharCode(65+i)); }
function idem(src,channel,variant){
  return `SOCIALGEN|${src.wpPostId}|${src.sourceHash}|${PROMPT_VERSION}|${channel}|${variant}`;
}
async function existingQueue(accessToken){
  const rows=await getVals(SEO_SHEET_ID,`'${QUEUE_TAB}'!A2:X2000`,accessToken);
  return new Set(rows.map(r=>r[21]).filter(Boolean));
}
function prompt(src,sourceText,targets){
  return [
    "Create Myriad Green social-media drafts from one verified canonical source revision.",
    "Use only facts in the source text. Never invent prices, guarantees, ratings, testimonials, certifications, savings, project outcomes, locations or technical claims.",
    "Tone: practical local expert, concise, useful, no hype/clickbait/generic AI filler.",
    "One primary CTA. Do not include the URL in draft_text; MAGOS stores it separately.",
    "Return strict JSON only: {\"posts\":[{\"channel\":\"FACEBOOK\",\"variant\":\"A\",\"draft_text\":\"...\"}]}",
    "Required targets:",
    ...targets.map(t=>`- ${t.channel} variant ${t.variant}; max ${t.maxChars} chars; hashtags: ${t.hashtagPolicy}; CTA: ${t.ctaType}`),
    `Source title: ${src.sourceTitle}`,
    `Canonical URL: ${src.sourceUrl}`,
    `Source hash: ${src.sourceHash}`,
    "Source text:",
    sourceText.slice(0,24000)
  ].join("\n");
}
function extractText(j){
  if(j.output_text) return j.output_text;
  for(const o of j.output||[]) for(const c of o.content||[]) if(c.text) return c.text;
  return "";
}
async function generate(src,sourceText,targets,apiKey){
  const r=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{Authorization:`Bearer ${apiKey}`,"content-type":"application/json"},
    body:JSON.stringify({
      model:MODEL,
      reasoning:{effort:"none"},
      instructions:"You are the MAGOS draft generator. Follow source-grounding and JSON output rules exactly.",
      input:prompt(src,sourceText,targets),
      max_output_tokens:6000
    })
  });
  const j=await r.json(); if(!r.ok) throw new Error(`OpenAI failed: ${j?.error?.message||r.statusText}`);
  let p; try{ p=JSON.parse(extractText(j).replace(/^\`\`\`(?:json)?\s*/i,"").replace(/\s*\`\`\`$/,"")); }
  catch(e){ throw new Error(`OpenAI output JSON parse failed: ${e.message}`); }
  const posts=p.posts||[];
  for(const t of targets){
    const x=posts.find(z=>z.channel===t.channel&&z.variant===t.variant);
    if(!x?.draft_text) throw new Error(`Missing generated ${t.channel}/${t.variant}`);
    if(x.draft_text.length>t.maxChars) throw new Error(`${t.channel}/${t.variant} exceeds max chars`);
  }
  return {posts,responseId:j.id||"",model:j.model||MODEL};
}
function utm(src,channel){
  const u=new URL(src.sourceUrl);
  u.searchParams.set("utm_source",channel.toLowerCase());
  u.searchParams.set("utm_medium","social");
  u.searchParams.set("utm_campaign",`blog_${src.wpPostId}`);
  return u.toString();
}
function queueRow(src,target,text,model){
  const key=idem(src,target.channel,target.variant);
  const socialId=`SOC-${src.wpPostId}-${target.channel}-${target.variant}-${src.sourceHash.slice(0,8)}`;
  return {key,values:[
    socialId,src.wpPostId,src.sourceUrl,src.sourceTitle,src.modifiedGmt,src.sourceHash,
    target.channel,target.variant,text,src.sourceUrl,utm(src,target.channel),src.featuredMediaRef,
    "REVIEW_REQUIRED","NOT_READY","","","",""+PROMPT_VERSION,model,"REVIEW","PASS",key,"",now()
  ]};
}
async function logRun(accessToken,{runId,state,started,ended,key,scope,ids=[],writes="",readback="",error="",evidence=""}){
  const row=[`ARL-${runId}`,AUTOMATION_ID,runId,state,"EVENT_DRIVEN",started,ended,key,scope,ids.join("; "),writes,readback,error,evidence,ended];
  const a=await appendVals(AUDIT_SHEET_ID,`'${RUN_TAB}'!A:O`,[row],accessToken);
  const rg=a?.updates?.updatedRange; if(!rg) throw new Error("Audit append missing range");
  const rb=await getVals(AUDIT_SHEET_ID,rg,accessToken);
  if(rb?.[0]?.[0]!==row[0]) throw new Error("Audit read-back failed");
  return rg;
}
export async function generateHandler(req,res){
  if(req.method==="GET"){
    res.status(200).json({ok:true,automation_id:AUTOMATION_ID,mode:"DRAFT_ONLY",auto_publish:false,model:MODEL,prompt_version:PROMPT_VERSION});
    return;
  }
  if(req.method!=="POST"){ res.status(405).json({ok:false,error:"Method not allowed"}); return; }
  if(!safeEq(req.get("x-magos-webhook-secret"),MAGOS_SOCIAL_WEBHOOK_SECRET.value())){
    res.status(401).json({ok:false,error:"Unauthorized"}); return;
  }
  const started=now(), runId=crypto.randomUUID(), payload=req.body||{};
  let accessToken,src,runKey=`${AUTOMATION_ID}|${runId}`;
  try{
    accessToken=await token(GOOGLE_SERVICE_ACCOUNT_JSON.value());
    src=await sourceEvent(String(payload.source_event_id||""),accessToken);
    if(src.sourceStatus!=="PUBLISHED"||src.isCurrent!=="YES") throw new Error("Source event is not current published evidence");
    if(!payload.source_text||String(payload.source_text).trim().length<100) throw new Error("source_text is required from authenticated source ingress");
    runKey=`${AUTOMATION_ID}|${src.sourceEventId}|${src.sourceHash}`;
    const configs=await channelConfig(accessToken);
    const requested=(Array.isArray(payload.channels)&&payload.channels.length?payload.channels:[...configs.keys()]).map(x=>String(x).toUpperCase());
    const targets=[];
    for(const channel of requested){
      const cfg=configs.get(channel); if(!cfg) throw new Error(`Channel disabled/unknown: ${channel}`);
      if(cfg.autoPublish!=="NO") throw new Error(`Auto-publish must remain NO for ${channel}`);
      for(const variant of variantNames(cfg.variants)) targets.push({...cfg,variant});
    }
    const existing=await existingQueue(accessToken);
    const pending=targets.filter(t=>!existing.has(idem(src,t.channel,t.variant)));
    if(!pending.length){
      const ended=now();
      await logRun(accessToken,{runId,state:"SUCCEEDED",started,ended,key:runKey,scope:src.sourceEventId,writes:"No queue writes; replay deduplicated before model call.",readback:"All generation idempotency keys already exist.",evidence:src.sourceUrl});
      res.status(200).json({ok:true,state:"NOOP_DUPLICATE",runId,sourceEventId:src.sourceEventId}); return;
    }
    const g=await generate(src,String(payload.source_text).trim(),pending,OPENAI_API_KEY.value());
    const rows=pending.map(t=>{
      const x=g.posts.find(z=>z.channel===t.channel&&z.variant===t.variant);
      return queueRow(src,t,x.draft_text,g.model);
    });
    const a=await appendVals(SEO_SHEET_ID,`'${QUEUE_TAB}'!A:X`,rows.map(r=>r.values),accessToken);
    const rg=a?.updates?.updatedRange; if(!rg) throw new Error("Queue append missing range");
    const rb=await getVals(SEO_SHEET_ID,rg,accessToken);
    if(rb.length!==rows.length) throw new Error("Queue read-back row-count mismatch");
    rb.forEach((r,i)=>{
      if(r[0]!==rows[i].values[0]||r[12]!=="REVIEW_REQUIRED"||r[13]!=="NOT_READY"||r[21]!==rows[i].key)
        throw new Error(`Queue read-back mismatch at offset ${i}`);
    });
    const ended=now(), ids=rows.map(r=>r.values[0]);
    const audit=await logRun(accessToken,{runId,state:"SUCCEEDED",started,ended,key:runKey,scope:src.sourceEventId,ids,writes:`Created ${rows.length} draft-only queue rows.`,readback:`Verified ${rg}; approval=REVIEW_REQUIRED; publish=NOT_READY.`,evidence:src.sourceUrl});
    res.status(200).json({ok:true,state:"DRAFTS_QUEUED",runId,sourceEventId:src.sourceEventId,queueRange:rg,socialContentIds:ids,approvalState:"REVIEW_REQUIRED",publishState:"NOT_READY",auditRange:audit,openAiResponseId:g.responseId,model:g.model});
  }catch(e){
    const ended=now();
    try{ if(accessToken) await logRun(accessToken,{runId,state:"FAILED",started,ended,key:runKey,scope:src?.sourceEventId||"source resolution/generation",writes:"No successful terminal generation transaction.",readback:"Failure retained; publishing remains blocked.",error:e.message,evidence:src?.sourceUrl||""}); }catch(ae){ console.error("audit failure",ae); }
    console.error("MAGOS social generate failed",{runId,error:e.message});
    res.status(500).json({ok:false,runId,error:e.message,auto_publish:false});
  }
}
