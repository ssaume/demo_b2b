/* Shared supplier scopes and supply-planning simulation; no production documents are written. */
var Supply=(function(){
'use strict';
function catalogDomain(){return typeof Domain!=='undefined'&&Domain?Domain:typeof require==='function'?require('./domain.js'):null;}
var suppliers=[
 {id:'SUP-MOTION',username:'supplier01',name:'運動控制供應組',types:['drive','servo']},
 {id:'SUP-CONTROL',username:'supplier02',name:'控制設備供應組',types:['plc','hmi','buildingcontrol']},
 {id:'SUP-POWER',username:'supplier03',name:'電源與設備供應組',types:['din','adapter','passive','fan','ev','ups','telecompower','solar','medical','projection']}
];
function profile(username){return suppliers.find(function(s){return s.username===username;})||null;}
function canAccess(user,order){
 if(user.role==='buyer')return order.owner===user.username;
 var p=user.role==='operator'&&profile(user.username);if(!p||p.types.indexOf(order.type)<0)return false;
 return order.items.every(function(i){var product=catalogDomain().products.find(function(x){return x.id===i.productId;});return product&&product.type===order.type;});
}
function visibleProducts(user,catalog){var p=profile(user.username);return user.role==='buyer'?catalog:!p?[]:catalog.filter(function(x){return p.types.indexOf(x.type)>=0;});}
function publicUser(user){var p=user.role==='operator'&&profile(user.username);return {username:user.username,role:user.role,company:user.company,supplierId:p?p.id:null,productTypes:p?p.types.slice():[]};}
var resources=[];
suppliers.forEach(function(p){resources.push(
 {id:p.id+'-BUY',name:p.name+'・採購處理',kind:'材料採購',supplierIds:[p.id],dailyHours:8},
 {id:p.id+'-MAKE',name:p.name+'・內部產線',kind:'內部製造',supplierIds:[p.id],dailyHours:p.id==='SUP-MOTION'?24:16},
 {id:p.id+'-OUT',name:p.name+'・外包產線',kind:'外包製造',supplierIds:[p.id],dailyHours:16}
);});
resources.push({id:'SHARED-QA',name:'共用組裝與品質檢驗',kind:'組裝檢驗',supplierIds:suppliers.map(function(s){return s.id;}),dailyHours:24},{id:'SHARED-STOCK',name:'共用成品倉',kind:'倉儲',supplierIds:suppliers.map(function(s){return s.id;}),dailyHours:16},{id:'SHARED-SHIP',name:'共用出貨月台',kind:'出貨',supplierIds:suppliers.map(function(s){return s.id;}),dailyHours:16});
function ownerFor(type){return suppliers.find(function(p){return p.types.indexOf(type)>=0;})||null;}
function rates(type){return {make:type==='drive'||type==='servo'?2.4:type==='plc'||type==='hmi'?1.5:0.8,out:1.8,buy:0.25,qa:0.4,stock:0.12,ship:0.1};}
function remainingWork(order,item,outsourcePercent){
 var p=ownerFor(order.type);if(!p||item.status>=4)return [];var r=rates(order.type),q=item.qty,remaining=Math.max(0,q-item.shippedQty),share=(outsourcePercent===undefined?30:outsourcePercent)/100,list=[];
 function add(id,hours){if(hours>0)list.push({resourceId:id,hours:hours});}
 if(item.status===0)add(p.id+'-BUY',q*r.buy);
 if(item.status<=2){var work=Math.max(0,q-item.completedQty);add(p.id+'-MAKE',work*(1-share)*r.make);add(p.id+'-OUT',work*share*r.out);add('SHARED-QA',work*r.qa);}
 if(item.status<=3){add('SHARED-STOCK',remaining*r.stock);add('SHARED-SHIP',remaining*r.ship);}
 return list;
}
function day(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))throw new Error('日期格式不正確');var d=new Date(date+'T00:00:00Z');if(!isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw new Error('日期格式不正確');return d;}
function dateString(d){return d.toISOString().slice(0,10);}
function addDays(date,n){var d=day(date);d.setUTCDate(d.getUTCDate()+n);return dateString(d);}
function businessDays(start,count){var d=day(start),days=0;for(var i=0;i<count;i++){if(d.getUTCDay()!==0&&d.getUTCDay()!==6)days++;d.setUTCDate(d.getUTCDate()+1);}return days;}
function afterWorkDays(start,count){var d=day(start);while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()+1);for(var i=0;i<Math.ceil(count);i++){d.setUTCDate(d.getUTCDate()+1);while(d.getUTCDay()===0||d.getUTCDay()===6)d.setUTCDate(d.getUTCDate()+1);}return dateString(d);}
function utilization(orders,user,options){
 options=options||{};var start=options.startDate||dateString(new Date()),horizon=Number(options.horizonDays||14);day(start);if([7,14,28].indexOf(horizon)<0)throw new Error('資源期間須為 7、14 或 28 天');var end=addDays(start,horizon-1),workdays=businessDays(start,horizon),loads={},p=profile(user.username);
 orders.forEach(function(o){if(o.needDate>end)return;o.items.forEach(function(i){remainingWork(o,i).forEach(function(w){loads[w.resourceId]=(loads[w.resourceId]||0)+w.hours;});});});
 return {startDate:start,endDate:end,horizonDays:horizon,workingDays:workdays,simulation:true,resources:resources.map(function(r){var capacity=workdays*r.dailyHours,hours=loads[r.id]||0;return {id:r.id,name:r.name,kind:r.kind,supplierIds:r.supplierIds.slice(),dailyHours:r.dailyHours,related:!!p&&r.supplierIds.indexOf(p.id)>=0,hours:Math.round(hours*100)/100,capacityHours:capacity,utilization:capacity?Math.round(hours/capacity*1000)/10:0};})};
}
function simulate(order,item,scenario,summary){
 scenario=scenario||{};var start=scenario.startDate||dateString(new Date()),material=Number(scenario.materialLeadDays===undefined?5:scenario.materialLeadDays),capacity=Number(scenario.capacityPercent===undefined?100:scenario.capacityPercent),outsource=Number(scenario.outsourcePercent===undefined?30:scenario.outsourcePercent);day(start);
 if(!isFinite(material)||material<0||material>60||!Number.isInteger(material))throw new Error('材料前置期須為 0–60 個工作日');
 if(!isFinite(capacity)||capacity<50||capacity>200)throw new Error('可用產能須為 50–200%');
 if(!isFinite(outsource)||outsource<0||outsource>100)throw new Error('外包比例須為 0–100%');
 var supplier=ownerFor(order.type);if(!supplier)throw new Error('此產品尚未設定供應途程');
 var baseline=remainingWork(order,item),planned=remainingWork(order,item,outsource),rs=summary&&summary.resources||resources.map(function(r){return Object.assign({hours:0,capacityHours:r.dailyHours*10},r);}),projected=rs.map(function(r){var old=baseline.find(function(w){return w.resourceId===r.id;}),now=planned.find(function(w){return w.resourceId===r.id;}),included=!summary||order.needDate<=summary.endDate,hours=Math.max(0,r.hours-(included&&old?old.hours:0))+(now?now.hours:0),cap=r.capacityHours*(r.supplierIds.indexOf(supplier.id)>=0?capacity/100:1);return Object.assign({},r,{hours:Math.round(hours*100)/100,capacityHours:Math.round(cap*100)/100,utilization:cap?Math.round(hours/cap*1000)/10:0});});
 function duration(id){var work=planned.find(function(w){return w.resourceId===id;}),r=projected.find(function(x){return x.id===id;});return work&&r?work.hours/(r.dailyHours*capacity/100):0;}
 var productionDays=Math.max(duration(supplier.id+'-MAKE'),duration(supplier.id+'-OUT')),qa=duration('SHARED-QA'),stock=duration('SHARED-STOCK'),ship=duration('SHARED-SHIP'),finished=item.status>=4,materialDays=item.status===0?material:0,productionDate=afterWorkDays(start,materialDays),makeDate=afterWorkDays(productionDate,productionDays),qaDate=afterWorkDays(makeDate,qa),stockDate=afterWorkDays(qaDate,stock),completion=afterWorkDays(stockDate,ship);
 if(finished)completion=null;
 var nodes=[{id:'buy',name:'材料採購',kind:'材料採購',resourceId:supplier.id+'-BUY',endDate:productionDate,days:materialDays,upstream:[],state:item.status>=1?'階段已通過（推估）':'待齊料（推估）'},
 {id:'make',name:'內部製造',kind:'內部製造',resourceId:supplier.id+'-MAKE',endDate:makeDate,days:duration(supplier.id+'-MAKE'),share:100-outsource,upstream:['buy'],state:outsource===100?'未採用':item.status>=3?'階段已通過（推估）':item.status===2?'製造階段（推估）':'待投產（推估）'},
 {id:'out',name:'外包製造',kind:'外包製造',resourceId:supplier.id+'-OUT',endDate:makeDate,days:duration(supplier.id+'-OUT'),share:outsource,upstream:['buy'],state:outsource===0?'未採用':item.status>=3?'階段已通過（推估）':item.status===2?'製造階段（推估）':'待委外（推估）'},
 {id:'qa',name:'組裝與檢驗',kind:'組裝檢驗',resourceId:'SHARED-QA',endDate:qaDate,days:qa,upstream:['make','out'],state:item.status>=3?'階段已通過（推估）':'待放行（推估）'},
 {id:'stock',name:'成品入庫',kind:'倉儲',resourceId:'SHARED-STOCK',endDate:stockDate,days:stock,upstream:['qa'],state:item.status>=3?'已入庫':'待入庫'},
 {id:'ship',name:'客戶交付',kind:'出貨',resourceId:'SHARED-SHIP',endDate:completion,days:ship,upstream:['stock'],state:item.status===4?'已出貨':'待出貨'}];
 if(item.status===5)nodes.forEach(function(n){n.state='需求已中止';n.endDate=null;});else nodes.forEach(function(n){if(/階段已通過|未採用|已入庫|已出貨/.test(n.state))n.endDate=null;});
 var diff=completion?Math.round((day(completion)-day(order.needDate))/86400000):0,related=projected.filter(function(r){return r.supplierIds.indexOf(supplier.id)>=0;}),overloaded=related.filter(function(r){return r.utilization>100;});
 return {simulation:true,scenario:{startDate:start,materialLeadDays:material,capacityPercent:capacity,outsourcePercent:outsource},nodes:nodes,completionDate:completion,latenessDays:Math.max(0,diff),overloaded:overloaded.map(function(r){return r.id;}),resources:related,assumption:'工時與供應途程為示範參數；週一至週五工作、未扣國定假日。交期為本明細獨立途程推估，未排其他需求佇列；資源負荷含期間內需求及逾期積壓。'};
}
return {suppliers:suppliers,resources:resources,profile:profile,ownerFor:ownerFor,canAccess:canAccess,visibleProducts:visibleProducts,publicUser:publicUser,remainingWork:remainingWork,utilization:utilization,simulate:simulate,businessDays:businessDays};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Supply;
