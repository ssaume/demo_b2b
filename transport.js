/* Origin-checked GAS messaging; health endpoint is read-only and carries no credentials. */
var PortalTransport=(function(){
'use strict';
function validUrl(url){if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))throw new Error('請使用 GAS 正式部署的 /exec 網址');}
// Browser timer APIs require Window as their receiver. Never store them unbound on GasBridge.
function timerApi(w,options){return {delay:(options.setTimeout||w.setTimeout).bind(w),cancel:(options.clearTimeout||w.clearTimeout).bind(w)};}
function healthCheck(url,options={}){
 validUrl(url);const w=options.window||window,d=options.document||document,origin=options.origin||location.origin,{delay,cancel}=timerApi(w,options);
 return new Promise((resolve,reject)=>{
  const key='demoB2BHealth_'+(options.crypto||crypto).randomUUID().replace(/-/g,''),script=d.createElement('script');let timer,finished=false;
  function finish(err,data){if(finished)return;finished=true;cancel(timer);script.remove();delete w[key];err?reject(err):resolve(data);}
  w[key]=data=>{if(!data||data.service!=='demo-b2b')return finish(new Error('GAS 回傳內容不符，請部署 v1.0.3.3 或更新版本'));if(data.version!=='1.0.3.3')return finish(new Error('GAS 目前版本為 '+String(data.version||'未知')+'；本版需要 v1.0.3.3，請更新目前 /exec 的部署版本'));finish(null,data);};
  const u=new URL(url);u.searchParams.set('mode','health');u.searchParams.set('origin',origin);u.searchParams.set('callback',key);u.searchParams.set('_',Date.now());script.src=u.toString();
  script.onerror=()=>finish(new Error('瀏覽器未能載入 GAS 檢測。請試「以新視窗連線」；此訊息尚無法判定部署權限是否正確'));
  script.onload=()=>{if(!finished)finish(new Error('GAS 未回傳新版檢測結果。請在「管理部署作業」部署新版本'));};
  timer=delay(()=>finish(new Error('GAS 檢測逾時。請確認 /exec 網址、網路與部署存取設定')),options.healthTimeoutMs||12000);
  (d.head||d.body).append(script);
 });
}
class GasBridge{
 constructor(url,options={}){
  validUrl(url);this.url=url;this.options=options;this.w=options.window||window;this.d=options.document||document;this.siteOrigin=options.origin||location.origin;this.crypto=options.crypto||crypto;const timers=timerApi(this.w,options);this.delay=timers.delay;this.cancel=timers.cancel;this.pending=new Map();this.ready=null;this.peer=null;this.mode=null;this.attempt=0;
 }
 sourceBelongs(source){const root=this.mode==='popup'?this.popup:this.frame?.contentWindow;if(!source||!root)return false;try{for(let i=0;i<12&&source;i++){if(source===root)return true;const parent=source.parent;if(!parent||parent===source)break;source=parent;}}catch{}return false;}
 destroy(message='連線已重設'){
  ++this.attempt;this.rejectConnect?.(new Error(message));this.rejectConnect=null;if(this.listener)this.w.removeEventListener('message',this.listener);this.cancel(this.timer);this.frame?.remove();if(this.popup&&!this.popup.closed)this.popup.close();this.frame=null;this.popup=null;this.peer=null;this.ready=null;
  for(const p of this.pending.values()){this.cancel(p.timer);p.reject(new Error(message));}this.pending.clear();
 }
 connect(mode='iframe'){
  if(this.siteOrigin==='null')return Promise.reject(new Error('請從 GitHub Pages 網站連線，不能由本機 HTML 檔連接 GAS'));
  if(this.ready&&this.mode===mode)return this.ready;
  if(this.ready||this.peer)this.destroy();this.mode=mode;this.nonce=this.crypto.randomUUID();const attempt=++this.attempt;
  const u=new URL(this.url);u.searchParams.set('_',Date.now());u.searchParams.set('origin',this.siteOrigin);u.searchParams.set('nonce',this.nonce);
  this.ready=new Promise((resolve,reject)=>{
   let settled=false;this.rejectConnect=reject;
   const fail=err=>{if(settled||attempt!==this.attempt)return;settled=true;this.rejectConnect=null;this.cancel(this.timer);this.w.removeEventListener('message',this.listener);this.frame?.remove();this.frame=null;this.peer=null;this.ready=null;reject(err);};
   this.listener=event=>{
    const m=event.data;if(!m||m.channel!=='demo-b2b'||m.nonce!==this.nonce||!/^https:\/\/([a-z0-9-]+\.googleusercontent\.com|script\.google\.com)$/.test(event.origin)||!this.sourceBelongs(event.source))return;
    if(m.type==='error'&&!this.peer)return fail(new Error(m.error||'GAS 通道設定不正確'));
    if(m.type==='ready'&&!this.peer){
     if(m.version!=='1.0.3.3')return fail(new Error('GAS 與前端版本不同，請重新部署新版 GAS'));
     settled=true;this.rejectConnect=null;this.peer=event.source;this.peerOrigin=event.origin;this.cancel(this.timer);this.peer.postMessage({channel:'demo-b2b',nonce:this.nonce,type:'connected'},this.peerOrigin);return resolve();
    }
    if(m.type==='response'&&event.source===this.peer){const p=this.pending.get(m.id);if(p){this.cancel(p.timer);this.pending.delete(m.id);m.result?.ok?p.resolve(m.result.data):p.reject(new Error(m.result?.error||'GAS 回應格式錯誤'));}}
   };
   this.w.addEventListener('message',this.listener);
   this.timer=this.delay(async()=>{
    try{const info=await healthCheck(this.url,{...this.options,origin:this.siteOrigin});
     if(!info.originAllowed)fail(new Error('來源未允許：請在 ALLOWED_ORIGINS 加入 '+this.siteOrigin));
     else if(!info.databaseConfigured||info.databaseReady===false)fail(new Error('GAS 尚未初始化：請在編輯器執行 setup'));
     else fail(new Error(mode==='popup'?'新視窗通道尚未建立，請確認網頁是否出現 Google 登入或存取限制':'GAS 檢測正常，但嵌入通道尚未建立。請點「以新視窗連線」後再登入'));
    }catch(err){fail(new Error(err.message+'；尚未完成連線檢測。若無痕可用，請先重設網站連線；也可能是 Google 多帳號登入或第三方 Cookie 限制，請用單一 Google 帳號的瀏覽器設定檔測試'));}
   },this.options.connectTimeoutMs||45000);
   if(mode==='popup'){
    this.popup=this.w.open(u.toString(),'demo-b2b-connection-'+this.nonce,'popup,width=540,height=340');if(!this.popup)fail(new Error('新視窗被瀏覽器封鎖，請允許此網站開啟彈出式視窗'));
   }else{
    this.frame=this.d.createElement('iframe');this.frame.title='企業平台資料連線';this.frame.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;left:-10px';this.frame.setAttribute('aria-hidden','true');this.frame.src=u.toString();this.d.body.append(this.frame);
   }
  });
  // Synchronous popup rejection must also clear ready after assignment.
  const current=this.ready;current.catch(()=>{if(attempt===this.attempt&&!this.peer)this.ready=null;});return current;
 }
 async call(request){
  if(this.mode==='popup'&&this.popup?.closed){this.destroy();throw new Error('連線視窗已關閉，請重新點選「以新視窗連線」');}
  await this.connect(this.mode||'iframe');
  return new Promise((resolve,reject)=>{
   const id=this.crypto.randomUUID(),timer=this.delay(()=>{this.pending.delete(id);reject(new Error('伺服器回應逾時，請重新整理確認結果；下單重試會沿用識別碼'));},this.options.requestTimeoutMs||45000);
   this.pending.set(id,{resolve,reject,timer});try{this.peer.postMessage({channel:'demo-b2b',nonce:this.nonce,type:'request',id,request},this.peerOrigin);}catch(err){this.cancel(timer);this.pending.delete(id);reject(err);}
  });
 }
}
function resolveConnection(config,storage,scope){
 const key='demo-b2b-connection:'+scope;let saved=null,legacy=null;try{saved=JSON.parse(storage.getItem(key)||'null');legacy=JSON.parse(storage.getItem('demo-b2b-url')||'null');}catch{}
 if(saved&&saved.version===config.version&&typeof saved.url==='string')return {url:saved.url,source:'本瀏覽器設定',key,legacy,migrated:false};
 return {url:config.gasUrl||'',source:'部署預設',key,legacy:saved?.url||legacy,migrated:!!(saved||legacy)};
}
return {GasBridge,healthCheck,resolveConnection};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=PortalTransport;
