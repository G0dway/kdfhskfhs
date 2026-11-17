export const TYPES = {router:'Маршрутизатор',switch:'Коммутатор',firewall:'Межсетевой экран',server:'Сервер',storage:'Хранилище',computer:'Компьютер',wifi:'Точка доступа',printer:'Принтер',cloud:'Интернет'};
export const STATUSES = {online:'В работе',warning:'Требует внимания',offline:'Отключено'};
export const clone = value => structuredClone(value);
export function validIP(value) { return value === '' || /^(\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split('.').every(n=>Number(n)<=255); }
export function validateMap(input) {
  const fail = () => { throw new Error('Некорректный файл карты. Проверьте структуру JSON.'); };
  if(!input || input.version!==1 || typeof input.name!=='string' || !input.name.trim() || !Array.isArray(input.nodes) || !Array.isArray(input.edges) || input.nodes.length>500 || input.edges.length>2000) fail();
  const ids=new Set();
  const cleanText=(s,max=150)=>typeof s==='string'?s.slice(0,max):'';
  const nodes=input.nodes.map(n=>{
    if(!n || typeof n.id!=='string' || !n.id || ids.has(n.id) || !Object.hasOwn(TYPES,n.type) || typeof n.name!=='string' || !n.name.trim() || !Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.abs(n.x)>10000 || Math.abs(n.y)>10000 || !validIP(n.ip??'')) fail();
    ids.add(n.id);return {id:n.id,name:cleanText(n.name),type:n.type,ip:n.ip??'',vlan:cleanText(n.vlan,30),zone:cleanText(n.zone,60),status:Object.hasOwn(STATUSES,n.status)?n.status:'online',x:n.x,y:n.y,model:cleanText(n.model),notes:cleanText(n.notes,1500)};
  });
  const edgeIds=new Set(), pairs=new Set();
  const edges=input.edges.map(e=>{
    if(!e || typeof e.id!=='string' || !e.id || edgeIds.has(e.id) || !ids.has(e.from) || !ids.has(e.to) || e.from===e.to) fail();
    const pair=[e.from,e.to].sort().join('\0');if(pairs.has(pair))fail();pairs.add(pair);edgeIds.add(e.id);
    return {id:e.id,from:e.from,to:e.to,speed:cleanText(e.speed,40)||'1 Гбит/с',kind:e.kind==='wireless'?'wireless':'ethernet'};
  });
  const zones=Array.isArray(input.zones)?input.zones.slice(0,40).map(z=>{
    if(!z || typeof z.id!=='string' || typeof z.name!=='string' || ![z.x,z.y,z.w,z.h].every(Number.isFinite) || z.w<100 || z.h<100 || [z.x,z.y,z.w,z.h].some(n=>Math.abs(n)>10000))fail();
    return {id:cleanText(z.id,60),name:cleanText(z.name),color:['green','purple','amber','blue'].includes(z.color)?z.color:'green',x:z.x,y:z.y,w:z.w,h:z.h};
  }):[];
  if(new Set(zones.map(z=>z.id)).size!==zones.length)fail();
  return {version:1,name:input.name.slice(0,100),demo:input.demo===true,nodes,edges,zones};
}
export function removeNode(map,id) { return {...map,nodes:map.nodes.filter(n=>n.id!==id),edges:map.edges.filter(e=>e.from!==id && e.to!==id)}; }
export function demoMap() {
  const n=(id,name,type,ip,x,y,zone='core',vlan='1',status='online',model='')=>({id,name,type,ip,x,y,zone,vlan,status,model,notes:''});
  const nodes=[
    n('internet','Интернет','cloud','',443,22,'core','','online','Канал провайдера'),
    n('gateway','Gateway-01','firewall','192.168.1.1',443,151,'core','1','online','MikroTik RB4011'),
    n('core','Core-Switch','switch','192.168.1.2',443,286,'core','1','online','Cisco Catalyst C9300'),
    n('srv1','App-Server','server','10.10.10.11',48,483,'servers','10','online','Dell PowerEdge R350'),
    n('srv2','DB-Server','server','10.10.10.12',212,483,'servers','10','online','Dell PowerEdge R450'),
    n('nas','NAS-Storage','storage','10.10.10.20',48,625,'servers','10','warning','Synology DS923+'),
    n('backup','Backup-01','server','10.10.10.21',212,625,'servers','10','offline','HPE ProLiant DL20'),
    n('pc1','Workstation-01','computer','10.10.20.11',411,483,'office','20','online','Lenovo ThinkCentre'),
    n('pc2','Workstation-02','computer','10.10.20.12',575,483,'office','20','online','Dell OptiPlex'),
    n('pc3','Workstation-03','computer','10.10.20.13',411,625,'office','20','online','Lenovo ThinkCentre'),
    n('printer','Office-Printer','printer','10.10.20.50',575,625,'office','20','online','HP LaserJet Pro'),
    n('ap1','Access-Point-01','wifi','10.10.30.2',814,458,'wifi','30','online','Ubiquiti UniFi U6+'),
    n('ap2','Access-Point-02','wifi','10.10.30.3',814,570,'wifi','30','warning','Ubiquiti UniFi U6+'),
    n('laptop','Guest-Laptop','computer','10.10.30.21',814,682,'wifi','30','online','Гостевое устройство')
  ];
  const edge=(from,to,speed='1 Гбит/с',kind='ethernet')=>({id:from+'-'+to,from,to,speed,kind});
  return {version:1,name:'Главный офис',demo:true,nodes,edges:[edge('internet','gateway'),edge('gateway','core','10 Гбит/с'),...nodes.filter(n=>!['internet','gateway','core','laptop'].includes(n.id)).map(n=>edge('core',n.id,n.zone==='servers'?'10 Гбит/с':'1 Гбит/с')),edge('ap2','laptop','Wi-Fi','wireless')],zones:[{id:'servers',name:'Серверная',color:'purple',x:28,y:408,w:345,h:345},{id:'office',name:'Рабочие места',color:'green',x:392,y:408,w:345,h:345},{id:'wifi',name:'Беспроводная сеть',color:'amber',x:766,y:408,w:254,h:395}]};
}
