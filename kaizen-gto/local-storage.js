'use strict';
const LocalPractice=(()=>{
 let connection;
 function open(){
  if(connection)return connection;
  connection=new Promise((resolve,reject)=>{
   if(!globalThis.indexedDB){reject(new Error('Browser storage is unavailable.'));return;}
   const request=indexedDB.open('kaizen-gto-practice',1);
   request.onupgradeneeded=()=>{for(const name of ['decisions','imports'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:'id'});};
   request.onerror=()=>reject(request.error);
   request.onblocked=()=>reject(new Error('Close other Kaizen GTO tabs and retry.'));
   request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();connection=null;};resolve(request.result);};
  }).catch(error=>{connection=null;throw error;});
  return connection;
 }
 async function transaction(names,mode,work){
  const db=await open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(names,mode);let value;
   tx.oncomplete=()=>resolve(value);
   tx.onabort=()=>reject(tx.error||new Error('Browser storage could not save your changes.'));
   tx.onerror=()=>{};
   try{value=work(tx);}catch(error){tx.abort();reject(error);}
  });
 }
 function insert(tx,name,value){
  const store=tx.objectStore(name),request=store.get(value.id);
  request.onsuccess=()=>{
   const old=request.result;
   if(!old||(name==='imports'&&old.kind==='hand'&&!old.replay&&value.kind==='hand'&&value.replay?.version===1))store.put(value);
  };
 }
 async function api(route,data){
  if(route==='progress'){
   const value={records:[],imports:[]};
   await transaction(['decisions','imports'],'readonly',tx=>{
    tx.objectStore('decisions').getAll().onsuccess=e=>value.records=e.target.result;
    tx.objectStore('imports').getAll().onsuccess=e=>value.imports=e.target.result;
   });
   value.records.sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));return value;
  }
  if(!['decisions','imports'].includes(route))throw new Error('Unknown storage action.');
  await transaction([route],'readwrite',tx=>insert(tx,route,data));return {saved:true};
 }
 async function restore(data){
  PracticeBackup.validate(data);
  await transaction(['decisions','imports'],'readwrite',tx=>{
   data.records.forEach(r=>insert(tx,'decisions',r));data.imports.forEach(i=>insert(tx,'imports',i));
  });
 }
 return {api,restore};
})();
