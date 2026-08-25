import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, XCircle, Search, RefreshCw, Clock3 } from 'lucide-react';
import { getContratistas, getMandantes, getProyectos, getVerificadorActual } from '../../data/localStorageDb';
import {
  claimDocumentReview,
  refreshReviewOperationsCache,
  reviewDocument,
} from '../../data/supabaseReviewOperations';
import type { ClaimRevision, Verificador } from '../../types';
import { buildColaDocs, buildCorrectionDocs } from './colaUtils';
import DocumentPreview from './DocumentPreview';

type Tab = 'pending' | 'review' | 'correction';

const REASONS = [
  'Documento vencido',
  'Documento ilegible',
  'Documento incorrecto',
  'Datos no coinciden',
  'Falta información',
  'Falta firma',
  'Otro',
];

const BADGE: Record<string, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  gray: 'border-cream3 bg-cream2 text-gray-600',
};

function formatElapsed(fromMs: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - fromMs) / 60000));
  if (mins < 1) return 'recién tomada';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `hace ${hours} h`;
}

export default function ColaRevisionTab({
  selectedDocKey,
  setSelectedDocKey,
  aprobadosHoy,
  setAprobadosHoy,
  rechazadosHoy,
  setRechazadosHoy,
  showToast,
  verificadores,
  verificadorActualId,
  claimsRevision,
  setClaimsRevision,
}: {
  onVerEmpresa?: (empresa: any) => void;
  selectedDocKey?: string | null;
  setSelectedDocKey?: (key: string | null) => void;
  aprobadosHoy: number;
  setAprobadosHoy: (updater: (n: number) => number) => void;
  rechazadosHoy: number;
  setRechazadosHoy: (updater: (n: number) => number) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
  verificadores: Verificador[];
  verificadorActualId?: string | null;
  claimsRevision: ClaimRevision[];
  setClaimsRevision: (data: ClaimRevision[]) => void;
}) {
  const [tab, setTab] = useState<Tab>('pending');
  const [selectedKey, setSelectedKey] = useState<string | null>(selectedDocKey || null);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [checks, setChecks] = useState({ legible: false, datos: false, vigencia: false });
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const proyectos = getProyectos();
  const mandantes = getMandantes();
  const contratistas = getContratistas();

  const pendingDocs = useMemo(() => buildColaDocs(getContratistas(), getProyectos()), [dataVersion]);
  const correctionDocs = useMemo(() => buildCorrectionDocs(getContratistas(), getProyectos()), [dataVersion]);

  const currentReviewer = verificadores.find(item => item.id === verificadorActualId) || getVerificadorActual();
  const reviewerName = (id?: string) => verificadores.find(item => item.id === id)?.nombre || 'Usuario Acredita';
  const claimedKeys = useMemo(() => new Set(claimsRevision.map(item => item.documentoKey)), [claimsRevision]);

  const pendingAvailable = pendingDocs.filter(item => !claimedKeys.has(item.key));
  const inReview = pendingDocs.filter(item => claimedKeys.has(item.key));
  const source = tab === 'pending' ? pendingAvailable : tab === 'review' ? inReview : correctionDocs;

  const projectNames = Array.from(new Set([...pendingDocs, ...correctionDocs].map(item => item.proyecto))).sort();
  const filtered = source.filter(item => {
    const query = search.trim().toLowerCase();
    const searchOk = !query || [item.title, item.emp, item.proyecto, item.trabajadorNombre]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
    return searchOk && (!projectFilter || item.proyecto === projectFilter);
  }).sort((a, b) => {
    if (a.prio === 'Alta' && b.prio !== 'Alta') return -1;
    if (b.prio === 'Alta' && a.prio !== 'Alta') return 1;
    return a.timeSort - b.timeSort;
  });

  const current = filtered.find(item => item.key === selectedKey) || filtered[0];
  const currentClaim = current ? claimsRevision.find(item => item.documentoKey === current.key) : undefined;
  const isMine = Boolean(currentClaim && currentReviewer && currentClaim.verificadorId === currentReviewer.id);
  const isOther = Boolean(currentClaim && currentReviewer && currentClaim.verificadorId !== currentReviewer.id);

  const mandanteName = (projectId?: string) => {
    const project = proyectos.find(item => item.id === projectId);
    return mandantes.find(item => item.id === project?.mandanteId)?.nombre || 'Mandante';
  };

  const resetForm = () => {
    setChecks({ legible: false, datos: false, vigencia: false });
    setReason('');
    setNote('');
  };

  const contextFor = (item: any) => {
    if (!item.proyectoId) throw new Error('Este documento no tiene proyecto asociado.');
    return {
      contratistaId: item.contratistaId,
      proyectoId: item.proyectoId,
      requisito: {
        id: item.docId,
        nombre: item.title,
        destino: item.origen === 'Trabajador' ? 'trabajador' as const : 'empresa' as const,
      },
      trabajadorRut: item.trabajadorRut,
    };
  };

  const syncClaims = async () => {
    try {
      const snapshot = await refreshReviewOperationsCache();
      setClaimsRevision(snapshot.claims);
    } catch {
      // La cola conserva el último estado válido si hay una interrupción breve.
    }
  };

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const snapshot = await refreshReviewOperationsCache();
        if (active) setClaimsRevision(snapshot.claims);
      } catch {
        // No se interrumpe la revisión actual por un fallo transitorio de polling.
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
    // El setter proviene del contenedor y no representa una dependencia de negocio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedDocKey) {
      const inPending = pendingDocs.some(item => item.key === selectedDocKey);
      const inCorrection = correctionDocs.some(item => item.key === selectedDocKey);
      setTab(inCorrection ? 'correction' : inPending && claimedKeys.has(selectedDocKey) ? 'review' : 'pending');
      setSelectedKey(selectedDocKey);
      setSelectedDocKey?.(null);
    }
    // Solo consume navegación externa cuando llega una nueva key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocKey]);

  const tomarRevision = async () => {
    if (!current || !currentReviewer || busy) return;
    setBusy(true);
    try {
      const claim = await claimDocumentReview(contextFor(current), current.key);
      const snapshot = await refreshReviewOperationsCache();
      setClaimsRevision(snapshot.claims);
      setTab('review');
      setSelectedKey(current.key);
      resetForm();
      showToast(`Revisión tomada por ${reviewerName(claim.verificadorId)}`);
    } catch (error) {
      await syncClaims();
      showToast(error instanceof Error ? error.message : 'No fue posible tomar la revisión.', 'warning');
    } finally {
      setBusy(false);
    }
  };

  const aprobar = async () => {
    if (!current || !isMine || busy) return;
    if (!(checks.legible && checks.datos && checks.vigencia)) {
      showToast('Completa el chequeo mínimo antes de aprobar.', 'warning');
      return;
    }
    setBusy(true);
    try {
      await reviewDocument(contextFor(current), {
        action: 'approve',
        reviewerName: currentReviewer?.nombre,
      });
      setAprobadosHoy(value => value + 1);
      const snapshot = await refreshReviewOperationsCache();
      setClaimsRevision(snapshot.claims);
      setDataVersion(value => value + 1);
      setSelectedKey(null);
      setTab('pending');
      resetForm();
      showToast(`Documento aprobado: ${current.title}`);
    } catch (error) {
      await syncClaims();
      showToast(error instanceof Error ? error.message : 'No fue posible aprobar el documento.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const rechazar = async () => {
    if (!current || !isMine || busy) return;
    if (!reason) {
      showToast('Selecciona un motivo de rechazo.', 'warning');
      return;
    }
    if (!note.trim()) {
      showToast('Indica qué debe corregir el contratista.', 'warning');
      return;
    }
    setBusy(true);
    try {
      await reviewDocument(contextFor(current), {
        action: 'reject',
        reviewerName: currentReviewer?.nombre,
        reason,
        explanation: note,
        solution: note,
      });
      setRechazadosHoy(value => value + 1);
      const snapshot = await refreshReviewOperationsCache();
      setClaimsRevision(snapshot.claims);
      setDataVersion(value => value + 1);
      setSelectedKey(null);
      setTab('pending');
      resetForm();
      showToast(`Documento rechazado: ${current.title}`, 'warning');
    } catch (error) {
      await syncClaims();
      showToast(error instanceof Error ? error.message : 'No fue posible rechazar el documento.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const tabCount = (value: Tab) => value === 'pending' ? pendingAvailable.length : value === 'review' ? inReview.length : correctionDocs.length;

  return (
    <div className="fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
        <div>
          <div className="text-[11px] tracking-[1.8px] uppercase font-bold text-brown">Operación Acredita</div>
          <h2 className="text-2xl font-semibold text-navy mt-1">Cola de revisión</h2>
          <p className="text-[13px] text-gray-500 mt-1">Las tomas y decisiones se comparten en tiempo real entre todos los verificadores.</p>
        </div>
        <div className="flex gap-2 text-[11px]">
          <span className={`badge border ${BADGE.green}`}>{aprobadosHoy} aprobados hoy</span>
          <span className={`badge border ${BADGE.red}`}>{rechazadosHoy} rechazados hoy</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {([
          ['pending', 'Por revisar'],
          ['review', 'En revisión'],
          ['correction', 'Esperando corrección'],
        ] as Array<[Tab, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => { setTab(value); setSelectedKey(null); resetForm(); }}
            className={`px-3.5 py-2 rounded-lg border text-[12px] font-semibold ${tab === value ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-cream3 hover:bg-cream2'}`}
          >
            {label} · {tabCount(value)}
          </button>
        ))}
        <button type="button" onClick={() => void syncClaims()} className="ml-auto px-3 py-2 rounded-lg border border-cream3 bg-white text-gray-500 text-[12px] flex items-center gap-1.5 hover:bg-cream2">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      <div className="bg-white border border-cream3 rounded-xl p-3 mb-4 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[230px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar documento, empresa o trabajador..." className="form-input w-full pl-9 text-[12px]" />
        </div>
        <select value={projectFilter} onChange={event => setProjectFilter(event.target.value)} className="form-input text-[12px] min-w-[180px]">
          <option value="">Todos los proyectos</option>
          {projectNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr_300px] gap-4 items-start">
        <section className="bg-white border border-cream3 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-cream3 flex justify-between items-center">
            <strong className="text-[13px] text-navy">Documentos</strong>
            <span className={`badge border ${BADGE.gray}`}>{filtered.length}</span>
          </div>
          <div className="max-h-[650px] overflow-y-auto">
            {filtered.map(item => {
              const claim = claimsRevision.find(row => row.documentoKey === item.key);
              return (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => { setSelectedKey(item.key); resetForm(); }}
                  className={`w-full text-left p-3 border-b border-cream2 transition-colors ${current?.key === item.key ? 'bg-gold-soft/40' : 'bg-white hover:bg-cream2/50'}`}
                >
                  <div className="flex justify-between gap-2">
                    <strong className="text-[11.5px] text-navy leading-snug">{item.title}</strong>
                    <span className={`badge border text-[8.5px] ${item.prio === 'Alta' ? BADGE.red : BADGE.gray}`}>{item.prio}</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">{item.emp}</div>
                  <div className="text-[9.5px] text-gray-400 mt-0.5">{item.proyecto}{item.trabajadorNombre ? ` · ${item.trabajadorNombre}` : ''}</div>
                  {claim && <div className="text-[9.5px] text-blue-700 font-semibold mt-1.5"><Clock3 size={10} className="inline mr-1" />{reviewerName(claim.verificadorId)} · {formatElapsed(claim.claimedAt)}</div>}
                </button>
              );
            })}
            {filtered.length === 0 && <div className="p-8 text-center text-[12px] text-gray-400">No hay documentos en esta vista.</div>}
          </div>
        </section>

        <section className="bg-white border border-cream3 rounded-xl overflow-hidden shadow-sm min-w-0">
          {current ? (
            <>
              <div className="px-4 py-3 border-b border-cream3">
                <div className="text-[14px] font-bold text-navy">{current.title}</div>
                <div className="text-[10.5px] text-gray-500 mt-0.5">{mandanteName(current.proyectoId)} · {current.emp} · {current.proyecto}</div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  <div className="border border-cream3 rounded-lg p-2"><span className="text-[8px] uppercase text-gray-400">Origen</span><strong className="block text-[10.5px] mt-0.5">{current.origen}</strong></div>
                  <div className="border border-cream3 rounded-lg p-2"><span className="text-[8px] uppercase text-gray-400">Versión</span><strong className="block text-[10.5px] mt-0.5">v{current.version}</strong></div>
                  <div className="border border-cream3 rounded-lg p-2"><span className="text-[8px] uppercase text-gray-400">Vigencia</span><strong className="block text-[10.5px] mt-0.5">{current.vigenciaLabel}</strong></div>
                  <div className="border border-cream3 rounded-lg p-2"><span className="text-[8px] uppercase text-gray-400">Trabajador</span><strong className="block text-[10.5px] mt-0.5 truncate">{current.trabajadorNombre || 'No aplica'}</strong></div>
                </div>
                <div className="bg-gray-50 border border-cream3 rounded-xl min-h-[430px] flex items-center justify-center p-4">
                  <DocumentPreview item={current} />
                </div>
                {tab === 'correction' && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] text-red-800">
                    <strong>Motivo:</strong> {current.motivoRechazo || 'Documento rechazado'}{current.explicacionRechazo ? ` — ${current.explicacionRechazo}` : ''}
                  </div>
                )}
              </div>
            </>
          ) : <div className="p-12 text-center text-[12px] text-gray-400">Selecciona un documento.</div>}
        </section>

        <section className="bg-white border border-cream3 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-cream3"><strong className="text-[14px] text-navy">Decisión</strong></div>
          {!current ? (
            <div className="p-6 text-center text-[11px] text-gray-400">Sin documento seleccionado.</div>
          ) : tab === 'correction' ? (
            <div className="p-4 text-[11px] text-gray-600 leading-relaxed">Esperando que el contratista cargue una nueva versión. Cuando lo haga, volverá automáticamente a <b>Por revisar</b>.</div>
          ) : tab === 'pending' ? (
            <div className="p-4">
              <div className={`rounded-lg border p-2.5 text-[11px] mb-3 ${BADGE.amber}`}>Disponible para cualquier verificador Acredita.</div>
              <button type="button" disabled={!currentReviewer || busy} onClick={() => void tomarRevision()} className="btn btn-primary w-full justify-center disabled:opacity-50">{busy ? 'Tomando…' : 'Tomar revisión'}</button>
            </div>
          ) : (
            <div className="p-4">
              <div className={`rounded-lg border p-2.5 text-[11px] mb-3 ${isOther ? BADGE.amber : BADGE.blue}`}>
                {currentClaim ? `Tomada por ${reviewerName(currentClaim.verificadorId)} · ${formatElapsed(currentClaim.claimedAt)}` : 'Actualizando asignación…'}
              </div>
              {isOther && <div className="text-[11px] text-amber-800 mb-3">Puedes ver el documento, pero solo quien lo tomó puede decidirlo.</div>}

              <div className="text-[9px] uppercase tracking-wide text-gray-400 font-bold mb-2">Chequeo mínimo</div>
              <div className="flex flex-col gap-2 mb-3">
                {([
                  ['legible', 'Documento legible'],
                  ['datos', 'Datos coinciden'],
                  ['vigencia', 'Vigencia correcta'],
                ] as Array<[keyof typeof checks, string]>).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 border border-cream3 rounded-lg p-2 text-[11px]">
                    <input type="checkbox" disabled={!isMine || busy} checked={checks[key]} onChange={event => setChecks(value => ({ ...value, [key]: event.target.checked }))} />
                    {label}
                  </label>
                ))}
              </div>

              <select disabled={!isMine || busy} value={reason} onChange={event => setReason(event.target.value)} className="form-input w-full text-[11px] mb-2">
                <option value="">Motivo si rechazas...</option>
                {REASONS.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
              <textarea disabled={!isMine || busy} value={note} onChange={event => setNote(event.target.value)} placeholder="Qué debe corregir el contratista..." className="form-input w-full min-h-[80px] text-[11px] resize-y" />

              <div className="grid grid-cols-2 gap-2 mt-3">
                <button type="button" disabled={!isMine || busy} onClick={() => void aprobar()} className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 text-white py-2 text-[11px] font-bold disabled:opacity-40"><CheckCircle size={13} /> Aprobar</button>
                <button type="button" disabled={!isMine || busy} onClick={() => void rechazar()} className="flex items-center justify-center gap-1.5 rounded-lg bg-red-700 text-white py-2 text-[11px] font-bold disabled:opacity-40"><XCircle size={13} /> Rechazar</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
