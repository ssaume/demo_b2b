/* Supplier responsibility, retained demand ownership and live delegation checks. */
var Supply=(function(){
'use strict';
function catalogDomain(){return typeof Domain!=='undefined'&&Domain?Domain:typeof require==='function'?require('./domain.js'):null;}
var suppliers=[
 {id:'SUP-MOTION',username:'supplier01',name:'運動控制供應組',types:['drive','servo']},
 {id:'SUP-CONTROL',username:'supplier02',name:'控制設備供應組',types:['plc','hmi','buildingcontrol']},
 {id:'SUP-POWER',username:'supplier03',name:'電源與設備供應組',types:['din','adapter','passive','fan','ev','ups','telecompower','solar','medical','projection']}
];
var defaults=JSON.parse(JSON.stringify(suppliers));
function setProfiles(list){suppliers.splice.apply(suppliers,[0,suppliers.length].concat(list.map(function(p){return Object.assign({},p,{types:p.types.slice()});})));}
function initialProfiles(){return JSON.parse(JSON.stringify(defaults));}
function pin(order){if(!order.supplyOwner){var p=suppliers.find(function(p){return p.active!==false&&p.types.indexOf(order.type)>=0;});if(!p)throw new Error('產品線尚無有效供應負責人');order.supplyOwner=p.username;order.delegates=[];}return order;}
function eligible(order,username){var p=profile(username);return !!p&&p.active!==false&&p.types.indexOf(order.type)>=0;}
function delegate(order,actor,target){if(actor!==order.supplyOwner)throw new Error('只有原負責人可指派代理');if(!order.items.some(function(i){return i.status<4;}))throw new Error('已結束需求不可新增代理');if(target&&(!eligible(order,target)||target===actor))throw new Error('代理須為有效且擁有同產品線權限的其他帳號');order.delegates=target?[target]:[];order.revision++;return order;}
function profile(username){return suppliers.find(function(s){return s.username===username;})||null;}
function canAccess(user,order){
 if(user.role==='buyer')return order.owner===user.username;
 var p=user.role==='operator'&&profile(user.username);if(!p||p.active===false)return false;
 if(!order.items.every(function(i){var product=catalogDomain().products.find(function(x){return x.id===i.productId;});return product&&product.type===order.type;}))return false;
 return order.supplyOwner ? (order.supplyOwner===user.username||(order.delegates||[]).indexOf(user.username)>=0&&eligible(order,user.username)) : p.types.indexOf(order.type)>=0;
}
function visibleProducts(user,catalog){var p=profile(user.username);return user.role==='buyer'?catalog:!p?[]:catalog.filter(function(x){return p.types.indexOf(x.type)>=0;});}
function publicUser(user){var p=user.role==='operator'&&profile(user.username);return {username:user.username,role:user.role,company:user.company,supplierId:p?p.id:null,productTypes:p?p.types.slice():[],isSupplyAdmin:!!(p&&p.isSupplyAdmin)};}
function ownerFor(type){return defaults.find(function(p){return p.types.indexOf(type)>=0;})||null;}
function day(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))throw new Error('日期格式不正確');var d=new Date(date+'T00:00:00Z');if(!isFinite(d)||d.toISOString().slice(0,10)!==date)throw new Error('日期格式不正確');return d;}
function businessDays(start,count){var d=day(start),days=0;for(var i=0;i<count;i++){if(d.getUTCDay()!==0&&d.getUTCDay()!==6)days++;d.setUTCDate(d.getUTCDate()+1);}return days;}
function net(){return typeof Network!=='undefined'?Network:require('./network.js');}
return {setProfiles:setProfiles,initialProfiles:initialProfiles,pin:pin,eligible:eligible,delegate:delegate,suppliers:suppliers,profile:profile,ownerFor:ownerFor,canAccess:canAccess,visibleProducts:visibleProducts,publicUser:publicUser,utilization:function(orders,user,options){return net().utilization(orders,user,options);},simulate:function(order,item,scenario,summary){return net().simulate(order,item,scenario,summary);},businessDays:businessDays};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Supply;
