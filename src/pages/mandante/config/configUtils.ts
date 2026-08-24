import type { Mandante, Proyecto } from '../../../types';

export type ConfigTabId = 'empresa' | 'equipo' | 'notificaciones' | 'preferencias';
export type UserRole = 'Administrador' | 'Operaciones / Prevención' | 'Finanzas' | 'Solo lectura';
export type UserStatus = 'Activo' | 'Desactivado' | 'Invitación pendiente';
export interface ConfigUser { id:string; name:string; email:string; role:UserRole; status:UserStatus; projectIds:string[] }
export interface MandanteSettings {
  version:1; logo?:string;
  company:{ legalName:string; rut:string; businessActivity:string; legalRepresentative:string; corporateEmail:string; phone:string; address:string; communeRegion:string };
  users:ConfigUser[];
  notifications:{ workerLosesAccess:boolean; paymentRetained:boolean; accreditationBlocked:boolean; requiredDocumentRejected:boolean; accreditationRecovered:boolean; documentsExpiring:boolean; accreditationsPending:boolean; inApp:boolean; email:boolean; digest:'none'|'daily'|'weekly' };
  preferences:{ defaultProjectId:string|null; landingPage:'dashboard'|'proyectos'|'contratistas'; projectVisibility:'active'|'all'; tableDensity:'comfortable'|'compact'; criticalFirst:boolean; rememberFilters:boolean };
}
const LEGACY_KEY='acredita_mandante_config_v1';
const keyFor=(mandanteId:string)=>`${LEGACY_KEY}:${mandanteId}`;
export function defaults(m:Mandante, projects:Proyecto[]):MandanteSettings {
 const ids=projects.map(p=>p.id); return {version:1,company:{legalName:m.nombre,rut:m.rut,businessActivity:'',legalRepresentative:'',corporateEmail:'',phone:'',address:'',communeRegion:''},users:[{id:'admin',name:'Administrador',email:'',role:'Administrador',status:'Activo',projectIds:ids}],notifications:{workerLosesAccess:true,paymentRetained:true,accreditationBlocked:true,requiredDocumentRejected:true,accreditationRecovered:false,documentsExpiring:true,accreditationsPending:false,inApp:true,email:true,digest:'daily'},preferences:{defaultProjectId:null,landingPage:'dashboard',projectVisibility:'active',tableDensity:'comfortable',criticalFirst:true,rememberFilters:true}};
}
export function loadSettings(m:Mandante,p:Proyecto[]):MandanteSettings {
 const d=defaults(m,p); const key=keyFor(m.id);
 try {
  let raw=localStorage.getItem(key);
  if(!raw&&m.id==='andina'){
   raw=localStorage.getItem(LEGACY_KEY);
   if(raw){localStorage.setItem(key,raw);localStorage.removeItem(LEGACY_KEY);}
  }
  const x=JSON.parse(raw||'null') as Partial<MandanteSettings>|null;
  if(!x||x.version!==1||!x.company||!Array.isArray(x.users))return d;
  return {...d,...x,company:{...d.company,...x.company},notifications:{...d.notifications,...x.notifications},preferences:{...d.preferences,...x.preferences},users:x.users};
 } catch{return d;}
}
export const saveSettings=(mandanteId:string,s:MandanteSettings)=>localStorage.setItem(keyFor(mandanteId),JSON.stringify(s));
export const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
export const validEmail=(x:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim());
export const initials=(x:string)=>(x.trim().split(/\s+/).filter(w=>!['de','del','la','sa','s.a.'].includes(w.toLowerCase())).slice(0,2).map(w=>w[0]).join('')||'AC').toUpperCase();
