import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Mail, Phone, RefreshCw, UserCheck, XCircle } from 'lucide-react';
import {
  listAccessRequests,
  updateAccessRequestStatus,
  type AccessRequestRecord,
  type AccessRequestStatus,
} from '../../../data/supabaseAccessRequests';

const STATUS_LABEL: Record<AccessRequestStatus, string> = {
  pending: 'Pendiente',
  contacted: 'Contactada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const STATUS_CLASS: Record<AccessRequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  contacted: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function AccessRequestsConfig({
  showToast,
}: {
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const [rows, setRows] = useState<AccessRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | AccessRequestStatus>('pending');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listAccessRequests());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => ({
    pending: rows.filter(row => row.status === 'pending').length,
    contacted: rows.filter(row => row.status === 'contacted').length,
    approved: rows.filter(row => row.status === 'approved').length,
    rejected: rows.filter(row => row.status === 'rejected').length,
  }), [rows]);

  const filtered = filter === 'all' ? rows : rows.filter(row => row.status === filter);

  const changeStatus = async (row: AccessRequestRecord, status: AccessRequestStatus) => {
    if (savingId) return;
    setSavingId(row.id);
    try {
      await updateAccessRequestStatus(row.id, status);
      setRows(current => current.map(item => item.id === row.id ? { ...item, status } : item));
      showToast(`Solicitud marcada como ${STATUS_LABEL[status].toLowerCase()}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No fue posible actualizar la solicitud.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-navy">Solicitudes de acceso</h3>
          <p className="mt-1 max-w-[720px] text-[12.5px] leading-relaxed text-gray-500">
            Bandeja de solicitudes enviadas desde el formulario público. Aprobar una solicitud confirma la decisión comercial; la organización y su cuenta se crean o invitan después desde Mandantes o Contratistas.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn btn-secondary shrink-0 disabled:opacity-60">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['pending', 'contacted', 'approved', 'rejected'] as const).map(status => (
          <button
            type="button"
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-xl border px-3 py-3 text-left transition ${filter === status ? 'border-brown bg-cream shadow-sm' : 'border-cream3 bg-white hover:bg-cream2'}`}
          >
            <span className="block text-[11px] text-gray-500">{STATUS_LABEL[status]}</span>
            <strong className="mt-1 block text-xl text-navy">{counts[status]}</strong>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-cream3 pb-2">
        <button type="button" onClick={() => setFilter('all')} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] ${filter === 'all' ? 'bg-navy text-white' : 'bg-cream2 text-gray-600'}`}>Todas ({rows.length})</button>
        {(['pending', 'contacted', 'approved', 'rejected'] as const).map(status => (
          <button type="button" key={status} onClick={() => setFilter(status)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] ${filter === status ? 'bg-navy text-white' : 'bg-cream2 text-gray-600'}`}>{STATUS_LABEL[status]}</button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[12.5px] text-red-700">
          <strong className="block">No fue posible cargar la bandeja.</strong>
          <span>{error}</span>
        </div>
      ) : loading ? (
        <div className="py-14 text-center text-[13px] text-gray-400">Cargando solicitudes desde Supabase…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cream3 bg-cream2/60 py-12 text-center text-[13px] text-gray-400">No hay solicitudes en este estado.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(row => (
            <article key={row.id} className="rounded-xl border border-cream3 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[14px] font-semibold text-navy">{row.company_name}</h4>
                    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_CLASS[row.status]}`}>{STATUS_LABEL[row.status]}</span>
                    <span className="rounded-full bg-cream2 px-2 py-0.5 text-[10.5px] font-medium text-gray-600">{row.requested_role === 'mandante' ? 'Mandante' : 'Contratista'}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-gray-500">{row.full_name}{row.rut ? ` · RUT ${row.rut}` : ''}{row.industry ? ` · ${row.industry}` : ''}</p>
                  <p className="mt-1 text-[11px] text-gray-400">Recibida {formatDate(row.created_at)} · {row.request_type === 'demo' ? 'Solicitud de demostración' : 'Solicitud de acceso'}</p>
                  {row.message && <p className="mt-3 rounded-lg bg-cream2 p-3 text-[12px] leading-relaxed text-gray-600">{row.message}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a className="btn btn-secondary" href={`mailto:${row.email}`}><Mail size={13} />Correo</a>
                  {row.phone && <a className="btn btn-secondary" href={`tel:${row.phone}`}><Phone size={13} />Llamar</a>}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-cream3 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[11.5px] text-gray-500"><span className="font-medium text-navy">{row.email}</span>{row.phone ? ` · ${row.phone}` : ''}{row.company_size ? ` · ${row.company_size}` : ''}</div>
                <div className="flex flex-wrap gap-2">
                  {row.status !== 'contacted' && <button type="button" disabled={savingId === row.id} onClick={() => void changeStatus(row, 'contacted')} className="btn btn-secondary disabled:opacity-60"><UserCheck size={13} />Contactada</button>}
                  {row.status !== 'approved' && <button type="button" disabled={savingId === row.id} onClick={() => void changeStatus(row, 'approved')} className="btn btn-primary disabled:opacity-60"><CheckCircle2 size={13} />Aprobar</button>}
                  {row.status !== 'rejected' && <button type="button" disabled={savingId === row.id} onClick={() => void changeStatus(row, 'rejected')} className="btn btn-ghost text-red-700 disabled:opacity-60"><XCircle size={13} />Rechazar</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
