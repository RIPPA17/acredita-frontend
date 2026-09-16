import { CheckCircle2, RefreshCw } from 'lucide-react';
import { useDataSync } from './DataSyncContext';

export default function DataSyncButton() {
  const { syncing, lastSyncedAt, refreshNow } = useDataSync();
  const syncedLabel = lastSyncedAt
    ? `Actualizado ${new Date(lastSyncedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
    : 'Actualizar';
  const title = syncing
    ? 'Sincronizando datos…'
    : lastSyncedAt
      ? `${syncedLabel} · haz clic para actualizar ahora`
      : 'Actualizar datos';

  return (
    <button
      type="button"
      onClick={() => void refreshNow()}
      disabled={syncing}
      aria-label={syncing ? 'Sincronizando datos' : lastSyncedAt ? `${syncedLabel}. Actualizar ahora` : 'Actualizar datos'}
      title={title}
      className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-white/5 px-2.5 text-cream/80 transition-colors hover:bg-white/15 hover:text-cream disabled:cursor-wait disabled:opacity-70"
    >
      {syncing ? <RefreshCw size={14} className="animate-spin" /> : lastSyncedAt ? <CheckCircle2 size={14} /> : <RefreshCw size={14} />}
      <span className="hidden text-[11.5px] font-medium lg:inline">{syncing ? 'Actualizando…' : syncedLabel}</span>
    </button>
  );
}
