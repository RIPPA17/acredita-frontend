import { RefreshCw } from 'lucide-react';
import { useDataSync } from './DataSyncContext';

export default function DataSyncButton() {
  const { syncing, lastSyncedAt, refreshNow } = useDataSync();
  const title = syncing
    ? 'Sincronizando datos…'
    : lastSyncedAt
      ? `Actualizar datos · última sincronización ${new Date(lastSyncedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
      : 'Actualizar datos';

  return (
    <button
      type="button"
      onClick={() => void refreshNow()}
      disabled={syncing}
      aria-label={syncing ? 'Sincronizando datos' : 'Actualizar datos'}
      title={title}
      className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-white/10 px-2.5 text-cream transition-colors hover:bg-white/20 disabled:cursor-wait disabled:opacity-70"
    >
      <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
      <span className="hidden text-[12px] font-medium lg:inline">{syncing ? 'Actualizando…' : 'Actualizar'}</span>
    </button>
  );
}
