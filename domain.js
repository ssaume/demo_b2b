/* Shared domain rules: browser + Apps Script. No external dependencies. */
var Domain = (function () {
  'use strict';
  var stages = ['審核中','已備料','生產中','已入庫','已出貨','訂單中止'];
  var categories = [
    {id:'components',name:'零組件',sector:'電源及零組件',types:[['passive','被動元件']]},
    {id:'power',name:'電源及系統',sector:'電源及零組件',types:[['din','軌道式電源'],['adapter','外接式電源']]},
    {id:'thermal',name:'風扇與散熱管理',sector:'電源及零組件',types:[['fan','散熱風扇']]},
    {id:'transport',name:'交通',sector:'交通',types:[['ev','電動車充電設備']]},
    {id:'automation',name:'工業自動化',sector:'自動化',types:[['drive','變頻器'],['servo','伺服系統'],['plc','可程式控制器'],['hmi','人機介面']]},
    {id:'building',name:'樓宇自動化',sector:'自動化',types:[['buildingcontrol','樓宇控制']]},
    {id:'datacenter',name:'資料中心',sector:'基礎設施',types:[['ups','不斷電系統']]},
    {id:'telecom',name:'通訊基礎設施',sector:'基礎設施',types:[['telecompower','通訊電源']]},
    {id:'energy',name:'能源基礎設施',sector:'基礎設施',types:[['solar','太陽能逆變器']]},
    {id:'medical',name:'生醫',sector:'基礎設施',types:[['medical','生醫設備']]},
    {id:'display',name:'視訊與顯像系統',sector:'基礎設施',types:[['projection','顯像設備']]}
  ];
  var products = [
    ['P01','automation','drive','MS300 系列','精巧標準型向量控制變頻器','DEMO-MS300',9800,1,14,'Inverters-AC-Motor-Drives','精巧控制・設備節能'],
    ['P02','automation','drive','CP2000 系列','風機水泵專用向量控制變頻器','DEMO-CP2000',24500,1,21,'Inverters-AC-Motor-Drives','風機水泵・流量控制'],
    ['P03','automation','servo','ASDA-B3 系列','交流伺服馬達與驅動器','DEMO-ASDA-B3',18800,1,21,'060201/4818','精密定位・運動控制'],
    ['P04','automation','plc','DVP 系列','可程式控制器','DEMO-DVP',6500,1,10,'PLCProgrammableLogicControllers','機台控制・模組擴充'],
    ['P05','automation','plc','AS 系列','可程式控制器','DEMO-AS',12800,1,14,'PLCProgrammableLogicControllers','多軸控制・高速運算'],
    ['P06','automation','hmi','DOP-100 系列','人機介面','DEMO-DOP100',11200,1,14,'Touch-Panel-HMI-Human-Machine-Interfaces','人機互動・生產可視化'],
    ['P07','power','din','CliQ II 系列','軌道式電源供應器','DEMO-CLIQ2',2800,5,7,'06040701','控制盤・穩定供電'],
    ['P08','power','din','CliQ M 系列','軌道式電源供應器','DEMO-CLIQM',4200,5,10,'06040701','工業電源・模組配置'],
    ['P09','power','adapter','外接式電源','設備用電源配置','DEMO-ADAPTER',950,10,14,'Power-and-System','設備供電・專案選型'],
    ['P10','components','passive','被動元件','工業用零組件配置','DEMO-COMP',180,100,14,'Components','零組件・專案選型'],
    ['P11','thermal','fan','散熱風扇','設備散熱配置','DEMO-FAN',850,10,14,'Fans-Thermal-Management','散熱管理・專案選型'],
    ['P12','transport','ev','電動車充電設備','商用充電設備配置','DEMO-EV',48000,1,35,'EV-Charging','智慧交通・專案選型'],
    ['P13','building','buildingcontrol','樓宇控制設備','建築自動化配置','DEMO-BAS',15600,1,28,'Building-Automation','樓宇控制・專案選型'],
    ['P14','datacenter','ups','不斷電系統','資料中心備援電源配置','DEMO-UPS',86000,1,35,'Data-Center','供電備援・專案選型'],
    ['P15','telecom','telecompower','通訊電源系統','通訊基礎設施配置','DEMO-TEL',32000,1,28,'Telecom-Power-Systems','通訊供電・專案選型'],
    ['P16','energy','solar','太陽能逆變器','能源基礎設施配置','DEMO-SOLAR',58000,1,35,'Energy-Infrastructure','能源管理・專案選型'],
    ['P17','medical','medical','生醫設備','生醫產品專案配置','DEMO-MED',36000,1,42,'Healthcare','生醫應用・專案選型'],
    ['P18','display','projection','視訊與顯像設備','顯像系統專案配置','DEMO-DISPLAY',45000,1,35,'Display-and-Visualization','專業顯像・專案選型']
  ].map(function(p){return {id:p[0],category:p[1],type:p[2],name:p[3],description:p[4],sku:p[5],price:p[6],moq:p[7],leadDays:p[8],source: ['P01','P02','P03','P04','P05','P06','P07','P08','P09'].indexOf(p[0])>=0?'https://www.deltaww.com/zh-TW/products/'+p[9]:'https://www.deltaww.com/zh-TW/index',tag:p[10],active:true};});
  function typeName(id){ for(var i=0;i<categories.length;i++)for(var j=0;j<categories[i].types.length;j++)if(categories[i].types[j][0]===id)return categories[i].types[j][1];return id; }
  function fail(message){throw new Error(message);}
  function text(v,max){v=String(v||'').trim();if(v.length>max)fail('文字長度超過 '+max+' 字');return v;}
  function quantity(v){var n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>100000)fail('數量須為 1–100000 的整數');return n;}
  function date(v){v=text(v,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)fail('日期格式不正確');return v;}
  function businessDate(now){return new Date(new Date(now).getTime()+8*3600000).toISOString().slice(0,10);}
  function makeOrders(cart,form,catalog,owner,key,now){
    if(!Array.isArray(cart)||!cart.length||cart.length>30)fail('購物車須有 1–30 筆產品');
    var po=text(form.po,80), address=text(form.address,300), contact=text(form.contact,80), needDate=date(form.needDate), note=text(form.note,500);
    if(!po||!address||!contact)fail('請填寫採購單號、收貨地址及聯絡人');
    if(needDate<businessDate(now))fail('需求日期不可早於今天');
    var groups=Object.create(null),seen=Object.create(null);cart.forEach(function(c){var p=catalog.find(function(x){return x.id===c.productId&&x.active!==false;});if(!p)fail('產品不存在或已下架');if(!Number.isFinite(p.price)||p.price<0||!Number.isSafeInteger(p.moq)||p.moq<1)fail('產品主檔價格或MOQ設定錯誤');if(seen[p.id])fail('購物車有重複產品');seen[p.id]=true;var q=quantity(c.qty);if(q<p.moq||q%p.moq!==0)fail(p.name+' 數量須為 '+p.moq+' 的倍數');if(!groups[p.type])groups[p.type]=[];groups[p.type].push({id:'I'+(groups[p.type].length+1),productId:p.id,sku:p.sku,name:p.name,qty:q,price:p.price,status:0,completedQty:0,shippedQty:0,details:{},history:[{at:now,status:0,actor:owner,note:'訂單建立，待價格與交期確認'}]});});
    var batchId='B'+key;return Object.keys(groups).map(function(type,i){return {id:'SO-'+businessDate(now).replace(/-/g,'')+'-'+key.replace(/[^a-zA-Z0-9]/g,'').slice(0,16).toUpperCase()+'-'+String(i+1).padStart(8,'0'),batchId:batchId,owner:owner,type:type,po:po,address:address,contact:contact,needDate:needDate,note:note,createdAt:now,revision:1,items:groups[type]};});
  }
  function aggregate(order){var live=order.items.filter(function(i){return i.status!==5;}),halted=order.items.length-live.length;return {status:live.length?Math.min.apply(null,live.map(function(i){return i.status;})):5,halted:halted,partialShipped:live.some(function(i){return i.shippedQty>0;})&&live.some(function(i){return i.status!==4;}),total:order.items.reduce(function(a,i){return a+i.qty*i.price;},0),activeTotal:live.reduce(function(a,i){return a+i.qty*i.price;},0),progress:live.length?Math.round(live.reduce(function(a,i){return a+i.status;},0)/(live.length*4)*100):0};}
  function transition(order,itemId,target,input,actor,role,now){
    var item=order.items.find(function(i){return i.id===itemId;});if(!item)fail('明細不存在');
    if(item.status===4||item.status===5)fail('明細已結束，不能再變更');
    target=Number(target);if(!Number.isInteger(target)||target<0||target>5)fail('狀態不正確');
    if(role!=='operator'&&!(target===5&&item.status===0&&role==='buyer'))fail('此操作需要供應端權限');
    var d=Object.assign({},item.details),q=item.completedQty,sh=item.shippedQty,note=text(input.note,500);
    if(target===5){if(sh>0)fail('已有部分出貨，請先以專案流程處理剩餘量');if(!note)fail('中止須填寫原因');d.stopReason=note;}
    else if(target===item.status&&target===3){/* Additional partial shipment only. */}
    else if(target!==item.status+1)fail('僅能依序推進到下一個狀態');
    if(target===1){d.materialRef=text(input.materialRef,80);d.committedDate=date(input.committedDate);d.kitReady=input.kitReady===true;if(!d.materialRef||!d.kitReady)fail('請填寫備料單號並確認物料齊套');}
    if(target===2){d.workOrder=text(input.workOrder,80);d.productionStart=date(input.productionStart);if(!d.workOrder)fail('請填寫工單號');}
    if(target===3&&item.status===2){q=quantity(input.completedQty);if(q!==item.qty)fail('此版須全數完工才可入庫');d.warehouse=text(input.warehouse,80);d.lot=text(input.lot,80);d.qualityReleased=input.qualityReleased===true;if(!d.warehouse||!d.lot||!d.qualityReleased)fail('入庫須有倉別、批號與品質放行');}
    if(target===4||(target===3&&item.status===3)){
      var add=quantity(input.shipQty);if(sh+add>item.qty)fail('出貨量不可超過未出貨量');
      var delivery=text(input.delivery,80),carrier=text(input.carrier,80),tracking=text(input.tracking,100);if(!delivery||!carrier||!tracking)fail('請填寫交貨單、物流商與追蹤資訊');
      if((sh+add===item.qty)!==(target===4))fail('部分出貨保留已入庫，全數出貨才轉已出貨');
      sh+=add;d.shipments=(d.shipments||[]).concat([{at:now,qty:add,delivery:delivery,carrier:carrier,tracking:tracking}]);
    }
    item.details=d;item.completedQty=q;item.shippedQty=sh;item.status=target;item.history.push({at:now,status:target,actor:actor,note:note|| (target===3&&sh>0?'部分出貨 '+input.shipQty+' 件':stages[target])});order.revision++;return order;
  }
  function seed(now){
    var f={po:'PO-DEMO-2026',address:'桃園市中壢區示範路 88 號',contact:'王先生 / 03-123-4567',needDate:businessDate(now),note:'示範採購需求'},cart=[{productId:'P01',qty:8},{productId:'P02',qty:3},{productId:'P03',qty:4},{productId:'P07',qty:20},{productId:'P04',qty:6},{productId:'P14',qty:2},{productId:'P12',qty:2}],orders=makeOrders(cart,f,products,'demo123','DEMO2026',now);
    orders.forEach(function(o,ix){o.items.forEach(function(it,j){var goal=[2,2,3,4,5,0][ix];if(ix===0&&j===1)goal=1;for(var s=1;s<=(goal===5?2:goal);s++)transition(o,it.id,s,{materialRef:'MR-DEMO-'+ix,committedDate:f.needDate,kitReady:true,workOrder:'WO-DEMO-'+ix,productionStart:f.needDate,completedQty:it.qty,warehouse:'桃園成品倉',lot:'LOT-DEMO-'+ix,qualityReleased:true,shipQty:it.qty,delivery:'DN-DEMO-'+ix,carrier:'示範物流',tracking:'DEMO-TRACK-'+ix},'ops123','operator',now);if(goal===5)transition(o,it.id,5,{note:'客戶需求變更，示範中止'},'ops123','operator',now);});});return orders;
  }
  return {stages:stages,categories:categories,products:products,typeName:typeName,makeOrders:makeOrders,aggregate:aggregate,transition:transition,seed:seed};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Domain;
