from pathlib import Path


def must_replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"No se encontró bloque esperado en {path}")
    p.write_text(text.replace(old, new, 1))


storage_path = Path("src/data/supabaseDocumentStorage.ts")
storage = storage_path.read_text()
if "export async function reviewLatestDocumentVersion" not in storage:
    storage += r'''

export interface DocumentReviewDecision {
  action: 'approve' | 'reject';
  reviewerName?: string;
  reason?: string;
  explanation?: string;
  solution?: string;
}

export async function reviewLatestDocumentVersion(
  context: DocumentStorageContext,
  decision: DocumentReviewDecision,
): Promise<{ version: number; status: 'aprobado' | 'rechazado' }> {
  const session = await restoreSupabaseSession();
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  if (session.role !== 'admin') throw new Error('Solo Acredita puede aprobar o rechazar documentos.');

  const token = session._supabase.accessToken;
  const { document } = await resolveDocumentContext(token, context, false);
  type ReviewableVersion = {
    id: string;
    version_number: number;
    workflow_status: 'pendiente' | 'revision' | 'aprobado' | 'rechazado' | 'reemplazado';
    metadata: Record<string, unknown> | null;
  };

  const versions = await selectRows<ReviewableVersion>('document_versions', token, {
    select: 'id,version_number,workflow_status,metadata',
    document_id: `eq.${document.id}`,
    order: 'version_number.desc',
    limit: '1',
  });
  const latest = versions[0];
  if (!latest) throw new Error('Este documento no tiene una versión para revisar.');
  if (latest.workflow_status !== 'revision') throw new Error('La versión más reciente ya no está en revisión.');
  if (decision.action === 'reject' && !decision.reason?.trim()) {
    throw new Error('Debes indicar un motivo de rechazo.');
  }

  const nextStatus = decision.action === 'approve' ? 'aprobado' : 'rechazado';
  const reviewedAt = new Date().toISOString();
  const patch = {
    workflow_status: nextStatus,
    reviewed_by: session.profileId,
    reviewed_at: reviewedAt,
    rejection_reason: decision.action === 'reject' ? decision.reason?.trim() : null,
    rejection_explanation: decision.action === 'reject'
      ? (decision.explanation?.trim() || decision.reason?.trim())
      : null,
    rejection_solution: decision.action === 'reject'
      ? (decision.solution?.trim() || decision.explanation?.trim() || null)
      : null,
    metadata: {
      ...(latest.metadata || {}),
      reviewer_name: decision.reviewerName || session.nombre || session.email,
      frontend_reviewed_text: reviewedAt,
      backend_review_decision: true,
    },
  };

  const url = new URL(`${SUPABASE_URL}/rest/v1/document_versions`);
  url.searchParams.set('id', `eq.${latest.id}`);
  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { ...authHeaders(token), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });
  const updated = await assertResponse(response, 'No fue posible guardar la revisión en Supabase.') as unknown[];
  if (!Array.isArray(updated) || updated.length !== 1) {
    throw new Error('La versión cambió mientras la revisabas. Recarga la cola.');
  }

  await hydrateOperationalDataFromSupabase(session);
  return { version: latest.version_number, status: nextStatus };
}
'''
    storage_path.write_text(storage)

old_sync = """    if (existing) {
      if (session.role === 'admin') {
        const { document_id: _documentId, version_number: _version, ...patch } = payload;
        await patchRows('document_versions', token, { id: `eq.${existing.id}` }, patch);
      }
      continue;
    }"""
new_sync = """    if (existing) {
      // Una decisión tomada directamente en Supabase es autoridad definitiva.
      // La capa legacy puede hidratarla, pero nunca volver a sobrescribirla.
      if (session.role === 'admin' && existing.metadata?.backend_review_decision !== true) {
        const { document_id: _documentId, version_number: _version, ...patch } = payload;
        await patchRows('document_versions', token, { id: `eq.${existing.id}` }, patch);
      }
      continue;
    }"""
must_replace("src/data/supabaseOperationalData.ts", old_sync, new_sync)

old_import = 'import { getContratistas, getProyectos, getMandantes, actualizarEstadoDocumento, simularNuevaVersion, sembrarDocumentosEjemplo, getVerificadorActual, getSupervisorActual, registrarActividadVerificador } from "../../data/localStorageDb";'
new_import = 'import { getContratistas, getProyectos, getMandantes, simularNuevaVersion, sembrarDocumentosEjemplo, getVerificadorActual, getSupervisorActual, registrarActividadVerificador } from "../../data/localStorageDb";\nimport { reviewLatestDocumentVersion } from "../../data/supabaseDocumentStorage";'
must_replace("src/pages/admin/ColaRevisionTab.tsx", old_import, new_import)

old_approve = """  const aprobar = () => {
    // Un documento tomado por otro verificador nunca puede aprobarse desde
    // aquí, sin importar el estado de los botones en la UI — la validación
    // de propiedad vive también dentro de la función, no solo en `disabled`.
    if (!current || !currentClaim || !currentVerificador || currentClaim.verificadorId !== currentVerificador.id) return;
    if (!(checks.legible && checks.datos && checks.vigencia)) {
      showToast("Para aprobar, completa el chequeo mínimo", "warning");
      return;
    }
    const list = getContratistas();
    const cObj = list.find(c => c.nombre === current.emp || c.rut === current.rut);
    const verificadorId = currentVerificador.id;
    if (cObj) {
      actualizarEstadoDocumento(cObj.id, current.proyectoId, current.docId, "approve", { verificador: nombreVerificador(verificadorId) });
      setAprobadosHoy(a => a + 1);
      registrarActividadVerificador(verificadorId, current.key, "aprobado");
    }
    showToast(`Documento aprobado: ${current.title}`);
    refreshAndAdvance("pending");
  };"""
new_approve = """  const aprobar = async () => {
    if (!current || !currentClaim || !currentVerificador || currentClaim.verificadorId !== currentVerificador.id) return;
    if (!(checks.legible && checks.datos && checks.vigencia)) {
      showToast("Para aprobar, completa el chequeo mínimo", "warning");
      return;
    }
    const list = getContratistas();
    const cObj = list.find(c => c.nombre === current.emp || c.rut === current.rut);
    if (!cObj || !current.proyectoId) {
      showToast("No fue posible resolver el documento en Supabase.", "error");
      return;
    }
    const verificadorId = currentVerificador.id;
    try {
      await reviewLatestDocumentVersion({
        contratistaId: cObj.id,
        proyectoId: current.proyectoId,
        requisito: {
          id: current.docId,
          nombre: current.title,
          destino: current.origen === "Trabajador" ? "trabajador" : "empresa",
        },
        trabajadorRut: current.trabajadorRut,
      }, {
        action: "approve",
        reviewerName: nombreVerificador(verificadorId),
      });
      setAprobadosHoy(a => a + 1);
      registrarActividadVerificador(verificadorId, current.key, "aprobado");
      showToast(`Documento aprobado: ${current.title}`);
      refreshAndAdvance("pending");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No fue posible aprobar el documento.", "error");
    }
  };"""
must_replace("src/pages/admin/ColaRevisionTab.tsx", old_approve, new_approve)

old_reject = """  const rechazar = () => {
    // Misma protección de propiedad que aprobar(): nunca confiar solo en
    // que el botón esté habilitado.
    if (!current || !currentClaim || !currentVerificador || currentClaim.verificadorId !== currentVerificador.id) return;
    if (!reason) { showToast("Selecciona un motivo de rechazo", "warning"); return; }
    if (!note.trim()) { showToast("Indica brevemente qué debe corregir el contratista", "warning"); return; }
    const list = getContratistas();
    const cObj = list.find(c => c.nombre === current.emp || c.rut === current.rut);
    const verificadorId = currentVerificador.id;
    if (cObj) {
      actualizarEstadoDocumento(cObj.id, current.proyectoId, current.docId, "reject", {
        motivoRechazo: reason,
        explicacionRechazo: note,
        verificador: nombreVerificador(verificadorId),
      });
      setRechazadosHoy(r => r + 1);
      registrarActividadVerificador(verificadorId, current.key, "rechazado");
    }
    showToast(`Documento rechazado: ${current.title}`, "warning");
    refreshAndAdvance("pending");
  };"""
new_reject = """  const rechazar = async () => {
    if (!current || !currentClaim || !currentVerificador || currentClaim.verificadorId !== currentVerificador.id) return;
    if (!reason) { showToast("Selecciona un motivo de rechazo", "warning"); return; }
    if (!note.trim()) { showToast("Indica brevemente qué debe corregir el contratista", "warning"); return; }
    const list = getContratistas();
    const cObj = list.find(c => c.nombre === current.emp || c.rut === current.rut);
    if (!cObj || !current.proyectoId) {
      showToast("No fue posible resolver el documento en Supabase.", "error");
      return;
    }
    const verificadorId = currentVerificador.id;
    try {
      await reviewLatestDocumentVersion({
        contratistaId: cObj.id,
        proyectoId: current.proyectoId,
        requisito: {
          id: current.docId,
          nombre: current.title,
          destino: current.origen === "Trabajador" ? "trabajador" : "empresa",
        },
        trabajadorRut: current.trabajadorRut,
      }, {
        action: "reject",
        reviewerName: nombreVerificador(verificadorId),
        reason,
        explanation: note,
        solution: note,
      });
      setRechazadosHoy(r => r + 1);
      registrarActividadVerificador(verificadorId, current.key, "rechazado");
      showToast(`Documento rechazado: ${current.title}`, "warning");
      refreshAndAdvance("pending");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "No fue posible rechazar el documento.", "error");
    }
  };"""
must_replace("src/pages/admin/ColaRevisionTab.tsx", old_reject, new_reject)
