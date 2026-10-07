/* BOM/ROUTING snapshot, document references and precedence scheduling. Shared with GAS. */
var Network=(function(){
'use strict';
function D(){return typeof Domain!=='undefined'?Domain:require('./domain.js');}
function S(){return typeof Supply!=='undefined'?Supply:require('./supply.js');}
function copy(x){return JSON.parse(JSON.stringify(x));}
function round(x){return Math.round(x*100)/100;}
function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v)))throw new Error('日期格式不正確');var d=new Date(v+'T00:00:00Z');if(!isFinite(d)||d.toISOString().slice(0,10)!==v)throw new Error('日期格式不正確');return d;}
function finishDate(start,hours){var d=date(start),days=Math.ceil(hours/8);while(d.getUTCDay()%6===0)d.setUTCDate(d.getUTCDate()+1);while(days-->0){d.setUTCDate(d.getUTCDate()+1);while(d.getUTCDay()%6===0)d.setUTCDate(d.getUTCDate()+1);}return d.toISOString().slice(0,10);}
var types={CPO:'客戶PO識別',SO:'銷售訂單',DEM:'供應需求',PO:'採購單',WO:'製造工單',OW:'外包工單',GR:'入庫單',GI:'出庫單',MR:'備料單',BATCH:'下單批次'};
function code(type,day,key,seq){if(!types[type])throw new Error('單據類型不正確');var dt=String(day).slice(0,10).replace(/-/g,'');if(!/^\d{8}$/.test(dt))throw new Error('單據日期不正確');var k=String(key).replace(/[^a-zA-Z0-9]/g,'').slice(0,16).toUpperCase();if(!k)throw new Error('單據識別不可空白');return type+'-'+dt+'-'+k+'-'+String(seq||1).padStart(8,'0');}
function defaults(product){
 var group=S().ownerFor(product.type),heavy=['drive','servo','ev','ups','solar'].indexOf(product.type)>=0,variant=Number(product.id.replace(/\D/g,''))||1;
 var board=product.sku+'-PCB',chip=product.sku+'-IC',shell=product.sku+'-CASE';
 var nodes=[
  {id:'chip',name:'控制晶片',part:chip,parentPart:board,bomLevel:2,per:2,kind:'材料採購',resourceId:chip,docType:'PO',upstream:[],leadHours:(3+variant%3)*8,laborPer:0,threshold:1},
  {id:'board',name:'電路板基材',part:board+'-RAW',parentPart:board,bomLevel:2,per:1,kind:'材料採購',resourceId:board+'-RAW',docType:'PO',upstream:[],leadHours:(2+variant%4)*8,laborPer:0,threshold:1},
  {id:'shell',name:'外殼原材',part:shell+'-RAW',parentPart:shell,bomLevel:2,per:1,kind:'材料採購',resourceId:shell+'-RAW',docType:'PO',upstream:[],leadHours:3*8,laborPer:0,threshold:1},
  {id:'pcb',name:'電路板半成品製造',part:board,parentPart:product.sku,bomLevel:1,per:1,kind:'內部製造',resourceId:group.id+'-MAKE',docType:'WO',upstream:['chip','board'],leadHours:0,laborPer:heavy?1.6:.7,threshold:3},
  {id:'case',name:'外殼外包加工',part:shell,parentPart:product.sku,bomLevel:1,per:1,kind:'外包製造',resourceId:group.id+'-OUT',docType:'OW',upstream:['shell'],leadHours:8,laborPer:.6,threshold:3},
  {id:'assembly',name:'成品組裝',part:product.sku,parentPart:'',bomLevel:0,per:1,kind:'內部製造',resourceId:group.id+'-ASSEMBLY',docType:'WO',upstream:['pcb','case'],leadHours:0,laborPer:heavy?.8:.4,threshold:3},
  {id:'qa',name:'品質檢驗',part:product.sku,parentPart:'',bomLevel:0,per:1,kind:'組裝檢驗',resourceId:'SHARED-QA',docType:'WO',upstream:['assembly'],leadHours:0,laborPer:.4,threshold:3},
  {id:'stock',name:'成品入庫',part:product.sku,parentPart:'',bomLevel:0,per:1,kind:'倉儲',resourceId:'WH-FG-A01',docType:'GR',upstream:['qa'],leadHours:0,laborPer:.12,threshold:3},
  {id:'ship',name:'出庫交付',part:product.sku,parentPart:'',bomLevel:0,per:1,kind:'出貨',resourceId:'SHARED-SHIP',docType:'GI',upstream:['stock'],leadHours:0,laborPer:.1,threshold:4}
 ];
 if(product.type==='servo'||product.type==='ev'){nodes.splice(5,0,{id:'winding',name:'線圈加工',part:product.sku+'-COIL',parentPart:product.sku,bomLevel:1,per:1,kind:'內部製造',resourceId:group.id+'-MAKE',docType:'WO',upstream:['chip'],leadHours:0,laborPer:1.1,threshold:3});nodes.find(function(n){return n.id==='assembly';}).upstream.push('winding');}
 return {productId:product.id,revision:1,bomRevision:'BOM-'+product.id+'-R1',routingRevision:'RT-'+product.id+'-R1',simulation:true,nodes:nodes};
}
var resourceMaster=null;
function setResources(list){if(!Array.isArray(list)||!list.length)throw new Error('資源主檔不可空白');var ids={};list.forEach(function(r){if(!r.id||ids[r.id]||!Array.isArray(r.productTypes)||!Array.isArray(r.hierarchy)||[r.dailyHours,r.stockQty,r.openPoQty,r.slotCapacity,r.occupiedSlots].some(function(v){return v!==undefined&&(!Number.isFinite(v)||v<0);}))throw new Error('資源主檔欄位不正確');if(r.kind==='材料採購'&&(!Number.isFinite(r.stockQty)||!Number.isFinite(r.openPoQty)||!Number.isFinite(r.openPoDueDays))||r.kind==='倉儲'&&(!r.slotCapacity||!r.unitsPerSlot||r.occupiedSlots>r.slotCapacity))throw new Error('材料或庫位資源設定不正確');ids[r.id]=true;});resourceMaster=copy(list);}
function initialResources(){
 var rs=[];D().products.forEach(function(p){var g=S().ownerFor(p.type);defaults(p).nodes.filter(function(n){return n.kind==='材料採購';}).forEach(function(n,ix){rs.push({id:n.resourceId,name:n.part,kind:'材料採購',unit:'件',supplierIds:[g.id],productTypes:[p.type],parentName:'VENDOR-'+g.id+' · '+g.name+'材料商',hierarchy:['材料商 '+g.id,n.part],stockQty:ix===0?40:25,openPoQty:ix===0?60:35,openPoDueDays:3});});});
 S().initialProfiles().forEach(function(g){rs.push(
  {id:g.id+'-MAKE',name:g.name+'・加工產線 L01',kind:'內部製造',supplierIds:[g.id],productTypes:g.types,dailyHours:24,unit:'小時',parentName:'FACTORY-'+g.id,hierarchy:['工廠 '+g.id,'加工產線 L01']},
  {id:g.id+'-ASSEMBLY',name:g.name+'・組裝產線 L02',kind:'內部製造',supplierIds:[g.id],productTypes:g.types,dailyHours:16,unit:'小時',parentName:'FACTORY-'+g.id,hierarchy:['工廠 '+g.id,'組裝產線 L02']},
  {id:g.id+'-OUT',name:g.name+'・外包加工線 O01',kind:'外包製造',supplierIds:[g.id],productTypes:g.types,dailyHours:16,unit:'小時',parentName:'SUBCON-'+g.id,hierarchy:['外包工廠 '+g.id,'加工線 O01']}
 );});
 var all=D().products.map(function(p){return p.type;});
 rs.push({id:'SHARED-QA',name:'檢驗線 QA01',kind:'組裝檢驗',productTypes:all,supplierIds:[],dailyHours:24,unit:'小時',parentName:'FACTORY-QA',hierarchy:['工廠 QA','檢驗線 QA01']},
 {id:'WH-FG-A01',name:'A01 成品庫位',kind:'倉儲',productTypes:all,supplierIds:[],slotCapacity:100,occupiedSlots:12,unitsPerSlot:10,unit:'庫位',parentName:'WH-FG',hierarchy:['成品倉 WH-FG','A區','A01 庫位']},
 {id:'SHARED-SHIP',name:'出貨處理線 D01',kind:'出貨',productTypes:all,supplierIds:[],dailyHours:16,unit:'小時',parentName:'WH-FG',hierarchy:['成品倉 WH-FG','出貨處理線 D01']});return rs;
}
function resources(){return resourceMaster?copy(resourceMaster):initialResources();}
function validate(spec){
 if(!spec||!Array.isArray(spec.nodes)||!spec.nodes.length||spec.nodes.length>60)throw new Error('BOM／Routing 節點須為 1–60 筆');
 var ids={},resourceIds=resources().map(function(r){return r.id;});spec.nodes.forEach(function(n){if(!/^[a-zA-Z0-9_-]{1,40}$/.test(n.id)||ids[n.id])throw new Error('供應節點 ID 重複或不正確');ids[n.id]=true;if(resourceIds.indexOf(n.resourceId)<0)throw new Error('供應資源不存在：'+n.resourceId);if(!types[n.docType]||!Array.isArray(n.upstream)||!Number.isFinite(n.per)||n.per<=0||!Number.isFinite(n.laborPer)||n.laborPer<0||!Number.isFinite(n.leadHours)||n.leadHours<0||!Number.isInteger(n.threshold)||n.threshold<1||n.threshold>4)throw new Error('BOM／Routing 數量、工時或階段不正確');});
 spec.nodes.forEach(function(n){if(n.upstream.some(function(id){return !ids[id]||id===n.id;}))throw new Error('供應節點前置關係不正確');});cpm(spec.nodes.map(function(n){return {id:n.id,upstream:n.upstream,durationHours:0,laborHours:0};}));return spec;
}
function snapshot(order,item,spec){
 spec=validate(copy(spec||defaults(D().products.find(function(p){return p.id===item.productId;}))));
 item.network={revision:1,bomRevision:spec.bomRevision,routingRevision:spec.routingRevision,simulation:spec.simulation!==false,nodes:spec.nodes.map(function(n,ix){return Object.assign({},n,{docNo:code(n.docType,order.createdAt,order.id.split('-').slice(2,-1).join(''),(Number(order.id.split('-').pop())||1)*100000+(Number(item.id.replace(/\D/g,''))||1)*100+ix+1),progress:null});})};return item.network;
}
function nodesFor(order,item){return copy(item.network||snapshot(copy(order),copy(item))).nodes;}
function inferred(n,item){if(item.status===5)return 0;return item.status>=n.threshold?1:0;}
function progress(n,item){return n.progress===null||n.progress===undefined?inferred(n,item):n.progress;}
function cpm(nodes){
 var map={},done={},ordered=[];nodes.forEach(function(n){if(map[n.id])throw new Error('重複網路節點');map[n.id]=Object.assign({},n);});
 function visit(id,stack){if(done[id])return;if(stack[id])throw new Error('供應網路有循環，無法計算要徑');var n=map[id];if(!n)throw new Error('供應網路前置節點不存在');stack[id]=true;n.upstream.forEach(function(p){visit(p,stack);});delete stack[id];done[id]=true;ordered.push(n);}
 nodes.forEach(function(n){visit(n.id,{});});
 ordered.forEach(function(n){if(!Number.isFinite(n.durationHours)||n.durationHours<0||!Number.isFinite(n.laborHours)||n.laborHours<0)throw new Error('節點工時不正確');n.es=Math.max.apply(null,[0].concat(n.upstream.map(function(p){return map[p].ef;})));n.ef=n.es+n.durationHours;});
 var project=Math.max.apply(null,[0].concat(ordered.map(function(n){return n.ef;})));
 ordered.slice().reverse().forEach(function(n){var successors=ordered.filter(function(x){return x.upstream.indexOf(n.id)>=0;});n.lf=successors.length?Math.min.apply(null,successors.map(function(x){return x.ls;})):project;n.ls=n.lf-n.durationHours;n.floatHours=Math.max(0,n.ls-n.es);n.critical=n.floatHours<.000001&&n.durationHours>0;});
 // Pick one complete longest path. Additional zero-float branches remain highlighted.
 var end=ordered.slice().reverse().find(function(n){return Math.abs(n.ef-project)<.000001;});var path=[];while(end){path.unshift(end.id);end=end.upstream.map(function(id){return map[id];}).sort(function(a,b){return b.ef-a.ef;})[0];}
 return {nodes:ordered,totalLaborHours:round(ordered.reduce(function(a,n){return a+n.laborHours;},0)),criticalLeadHours:round(project),criticalLaborHours:round(path.reduce(function(a,id){return a+map[id].laborHours;},0)),criticalPath:path};
}
function build(order,item,scenario,full){
 scenario=scenario||{};var cap=scenario.capacityPercent===undefined?100:Number(scenario.capacityPercent),lead=scenario.materialLeadDays===undefined||scenario.materialLeadDays===''?null:Number(scenario.materialLeadDays);
 if(!Number.isFinite(cap)||cap<50||cap>200)throw new Error('可用產能須為 50–200%');if(lead!==null&&(!Number.isInteger(lead)||lead<0||lead>60))throw new Error('材料前置期須為 0–60 工作日');
 var rs=resources();return nodesFor(order,item).map(function(n){var r=rs.find(function(r){return r.id===n.resourceId;});if(!r)throw new Error('供應資源不存在：'+n.resourceId);var done=progress(n,item),factor=full?1:item.status>=4?0:1-done,q=item.qty*n.per,work=q*n.laborPer*factor,lag=n.kind==='材料採購'&&lead!==null?lead*8:n.leadHours;
 if(!full&&n.id==='ship'&&item.status<4){work=Math.max(0,item.qty-item.shippedQty)*n.laborPer;}var duration=(r.dailyHours?work/(r.dailyHours*cap/100)*8:work)+(full||factor>0?lag:0);
 return Object.assign(n,{requiredQty:q,completedQty:round(q*done),progress:done,laborHours:work,durationHours:duration,resourceName:r.name,resourceParent:r.parentName,state:item.status===5?'需求已中止':done===1?'已完成':done>0?'進行中':item.status>=n.threshold?'階段已通過':'待作業',inferred:n.progress===null||n.progress===undefined});});
}
function simulate(order,item,scenario,summary){
 scenario=scenario||{};var start=scenario.startDate||new Date(Date.now()+8*3600000).toISOString().slice(0,10);date(start);
 var full=cpm(build(order,item,scenario,true)),left=cpm(build(order,item,scenario,false));
 var base=summary||utilization([order],{username:order.supplyOwner||S().ownerFor(order.type).username,role:'operator'},{startDate:start,horizonDays:14}),baseline=build(order,item,{},false),includes=order.needDate<=base.endDate;
 var related=base.resources.filter(function(r){return left.nodes.some(function(n){return n.resourceId===r.id;});}).map(function(r){var x=Object.assign({},r);if(r.unit==='小時'){x.capacityHours=r.capacityHours*Number(scenario.capacityPercent||100)/100;x.utilization=x.capacityHours?round(x.hours/x.capacityHours*100):0;}return x;});
 return {simulation:true,scenario:{startDate:start,capacityPercent:Number(scenario.capacityPercent||100),materialLeadDays:scenario.materialLeadDays===undefined||scenario.materialLeadDays===''?'':Number(scenario.materialLeadDays)},nodes:left.nodes.map(function(n){return Object.assign(n,{endDate:item.status>=4?null:finishDate(start,n.ef),days:n.durationHours/8});}),completionDate:item.status>=4?null:finishDate(start,left.criticalLeadHours),latenessDays:item.status>=4?0:Math.max(0,Math.round((date(finishDate(start,left.criticalLeadHours))-date(order.needDate))/86400000)),totalLaborHours:full.totalLaborHours,remainingLaborHours:left.totalLaborHours,criticalLeadHours:full.criticalLeadHours,criticalLaborHours:full.criticalLaborHours,remainingCriticalHours:left.criticalLeadHours,remainingCriticalLaborHours:left.criticalLaborHours,criticalPath:left.criticalPath,resources:related,overloaded:related.filter(function(r){return r.utilization>100;}).map(function(r){return r.id;}),bomRevision:item.network&&item.network.bomRevision||'待建立',routingRevision:item.network&&item.network.routingRevision||'待建立',assumption:'總體工時為各節點作業工時加總；要徑工時為最長相依路徑作業工時；要徑歷時另含採購／等待及資源能力換算。週一至週五每日 8 小時，未扣國定假日；未做跨訂單有限產能排程。'};
}
function utilization(orders,user,options){
 options=options||{};var start=options.startDate||new Date(Date.now()+8*3600000).toISOString().slice(0,10),horizon=Number(options.horizonDays||14);date(start);if([7,14,28].indexOf(horizon)<0)throw new Error('資源期間須為 7、14 或 28 天');var end=date(start);end.setUTCDate(end.getUTCDate()+horizon-1);end=end.toISOString().slice(0,10);var workdays=S().businessDays(start,horizon),loads={},relatedIds={};
 orders.forEach(function(o){if(S().canAccess(user,o))o.items.forEach(function(i){nodesFor(o,i).forEach(function(n){relatedIds[n.resourceId]=true;});});if(o.needDate>end)return;o.items.filter(function(i){return i.status<4;}).forEach(function(i){build(o,i,{},false).forEach(function(n){var a=loads[n.resourceId]||(loads[n.resourceId]={hours:0,quantity:0});a.hours+=n.laborHours;if(n.progress<1)a.quantity+=n.requiredQty-n.completedQty;});});});
 var p=S().profile(user.username);return {simulation:true,startDate:start,endDate:end,horizonDays:horizon,workingDays:workdays,resources:resources().map(function(r){var load=loads[r.id]||{hours:0,quantity:0},related=!!relatedIds[r.id]||!!p&&r.productTypes.some(function(t){return p.types.indexOf(t)>=0;}),a=Object.assign({},r,{related:related,hours:round(load.hours),capacityHours:r.dailyHours?workdays*r.dailyHours:0,requiredQty:round(load.quantity)});if(r.kind==='材料採購'){a.openPoQty=r.openPoDueDays<horizon?r.openPoQty:0;a.availableQty=r.stockQty+a.openPoQty;a.shortageQty=Math.max(0,round(a.requiredQty-a.availableQty));a.utilization=a.availableQty?round(a.requiredQty/a.availableQty*100):a.requiredQty?100:0;}else if(r.kind==='倉儲'){a.requiredSlots=Math.ceil(a.requiredQty/r.unitsPerSlot);a.availableSlots=r.slotCapacity-r.occupiedSlots;a.utilization=round((r.occupiedSlots+a.requiredSlots)/r.slotCapacity*100);}else a.utilization=a.capacityHours?round(a.hours/a.capacityHours*100):0;return a;})};
}
function consumption(orders,resourceId,user,options){
 options=options||{};var summary=utilization(orders,user,options),r=summary.resources.find(function(r){return r.id===resourceId;});if(!r)throw new Error('資源不存在');var rows=[];
 orders.filter(function(o){return o.needDate<=summary.endDate&&S().canAccess(user,o);}).forEach(function(o){o.items.filter(function(i){return i.status<4;}).forEach(function(i){build(o,i,{},false).filter(function(n){return n.resourceId===resourceId;}).forEach(function(n){var qty=round(n.requiredQty-n.completedQty),h=round(n.laborHours);if(r.unit==='小時'?h<=0:qty<=0)return;rows.push({orderId:o.id,demandId:o.documentRefs&&o.documentRefs.demand||'DEM-'+o.id,itemId:i.id,documentNo:n.docNo,documentType:types[n.docType],product:i.name,sku:i.sku,part:n.part,nodeName:n.name,needDate:o.needDate,status:i.status,quantity:qty,hours:h,slots:r.unit==='庫位'?Math.ceil(qty/r.unitsPerSlot):null,unit:r.unit});});});});
 return {resourceId:r.id,name:r.name,kind:r.kind,unit:r.unit,startDate:summary.startDate,endDate:summary.endDate,rows:rows,visibleHours:round(rows.reduce(function(a,n){return a+n.hours;},0)),visibleQty:round(rows.reduce(function(a,n){return a+n.quantity;},0)),note:'僅列目前帳號可存取、期間內及逾期尚未完成的耗用單據。全體資源彙總可能包含其他帳號負荷，明細不予揭露；庫位為各筆估算，不代表可混放。'};
}
function assertMilestone(order,itemId,target){var i=order.items.find(function(i){return i.id===itemId;});if(i&&i.network&&Number(target)<5&&i.network.nodes.some(function(n){return n.threshold<=Number(target)&&n.progress!==null&&n.progress!==undefined&&n.progress<1;}))throw new Error('供應節點已有未完成實績，請先完成對應前置作業再推進單據階段');}
function updateProgress(order,itemId,nodeId,completedQty,actor,now){
 var i=order.items.find(function(i){return i.id===itemId;});if(!i||i.status>=4)throw new Error('明細已結束或不存在');var n=i.network&&i.network.nodes.find(function(n){return n.id===nodeId;});if(!n)throw new Error('供應節點不存在');var q=Number(completedQty),required=i.qty*n.per;if(!Number.isFinite(q)||q<0||q>required)throw new Error('完成量須介於 0 與節點需求量');
 if(q>0&&n.upstream.some(function(id){return progress(i.network.nodes.find(function(x){return x.id===id;}),i)<1;}))throw new Error('前置節點未完成，不能回報後段實績');
 if(q<required&&i.network.nodes.some(function(x){return x.upstream.indexOf(n.id)>=0&&progress(x,i)>0;}))throw new Error('已有後段實績，不可撤回前置完成');
 n.progress=q/required;n.updatedAt=now;n.updatedBy=actor;i.network.revision++;i.history.push({at:now,status:i.status,actor:actor,note:n.docNo+' 節點 '+n.name+' 完成 '+q+'/'+required});order.revision++;return order;
}
return {consumption:consumption,setResources:setResources,initialResources:initialResources,assertMilestone:assertMilestone,types:types,code:code,defaults:defaults,resources:resources,validate:validate,snapshot:snapshot,cpm:cpm,simulate:simulate,utilization:utilization,updateProgress:updateProgress};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Network;
