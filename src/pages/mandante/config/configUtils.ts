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
const KEY='acredita_mandante_config_v1';
export function defaults(m:Mandante, projects:Proyecto[]):MandanteSettings {
 const ids=projects.map(p=>p.id); return {version:1,company:{legalName:m?.nombre||'Constructora Andina S.A.',rut:m?.rut||'96.123.456-K',businessActivity:'Construcción de edificios',legalRepresentative:'Carlos Araya',corporateEmail:'administracion@andina.cl',phone:'+56 2 2345 6789',address:'Av. Apoquindo 4501',communeRegion:'Las Condes · Región Metropolitana'},users:[{id:'admin',name:'Cristóbal Araya',email:'caraya@andina.cl',role:'Administrador',status:'Activo',projectIds:ids},{id:'ops',name:'Jorge Morales',email:'jmorales@andina.cl',role:'Operaciones / Prevención',status:'Activo',projectIds:ids.slice(0,1)},{id:'fin',name:'Andrea Silva',email:'asilva@andina.cl',role:'Finanzas',status:'Activo',projectIds:ids}],notifications:{workerLosesAccess:true,paymentRetained:true,accreditationBlocked:true,requiredDocumentRejected:true,accreditationRecovered:false,documentsExpiring:true,accreditationsPending:false,inApp:true,email:true,digest:'daily'},preferences:{defaultProjectId:null,landingPage:'dashboard',projectVisibility:'active',tableDensity:'comfortable',criticalFirst:true,rememberFilters:true}};
}
export function loadSettings(m:Mandante,p:Proyecto[]):MandanteSettings { const d=defaults(m,p); try { const x=JSON.parse(localStorage.getItem(KEY)||'null') as Partial<MandanteSettings>|null; if(!x||x.version!==1||!x.company||!Array.isArray(x.users))return d; return {...d,...x,company:{...d.company,...x.company},notifications:{...d.notifications,...x.notifications},preferences:{...d.preferences,...x.preferences},users:x.users}; } catch{return d;} }
export const saveSettings=(s:MandanteSettings)=>localStorage.setItem(KEY,JSON.stringify(s));
export const clone=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
export const validEmail=(x:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim());
export const initials=(x:string)=>(x.trim().split(/\s+/).filter(w=>!['de','del','la','sa','s.a.'].includes(w.toLowerCase())).slice(0,2).map(w=>w[0]).join('')||'AC').toUpperCase();
