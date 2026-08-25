import { useEffect, useMemo, useState } from 'react';
import { FileText, Image as ImageIcon, Loader2, ShieldCheck } from 'lucide-react';
import { loadDocumentFileObjectUrl, type DocumentStorageContext } from '../../data/supabaseDocumentStorage';

type LoadedFile = {
  url: string;
  filename: string;
  mimeType: string;
};

function buildContext(item: any): DocumentStorageContext | null {
  if (!item?.contratistaId || !item?.proyectoId || !item?.title) return null;
  return {
    contratistaId: item.contratistaId,
    proyectoId: item.proyectoId,
    requisito: {
      // El resolver de Storage prioriza integration_key y, para datos legacy,
      // cae al nombre normalizado del requisito. docId solo entrega una clave
      // estable cuando el requisito no trae su id al item de la cola.
      id: String(item.requisitoId || item.raw?.id || item.docId || item.title),
      nombre: item.title,
      destino: item.origen === 'Trabajador' ? 'trabajador' : 'empresa',
    },
    trabajadorRut: item.origen === 'Trabajador' ? item.trabajadorRut : undefined,
  };
}

function LegacyFallback({ item }: { item: any }) {
  const persona = item.origen === 'Trabajador' ? item.trabajadorNombre : item.emp;
  return (
    <div className="bg-white border border-[#dedad1] rounded-xl w-full max-w-[460px] p-7 shadow-sm text-center">
      <div className="w-14 h-14 rounded-full bg-[#f2ead8] flex items-center justify-center mx-auto mb-4">
        <FileText size={28} className="text-brown" />
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-1">Versión sin archivo físico</div>
      <div className="text-[15px] font-bold text-navy">{item.title || 'Documento'}</div>
      <div className="text-[12px] text-gray-500 mt-1">{persona || item.emp || 'Sin titular'} · {item.proyecto || 'Proyecto'}</div>
      <div className="mt-5 p-3 rounded-lg bg-cream2 border border-cream3 text-[11.5px] text-gray-600 leading-relaxed">
        Esta versión no contiene bytes de archivo en Storage. Las cargas actuales se muestran aquí como PDF o imagen real.
      </div>
    </div>
  );
}

export default function DocumentPreview({ item }: { item: any }) {
  const context = useMemo(() => buildContext(item), [
    item?.contratistaId,
    item?.proyectoId,
    item?.title,
    item?.origen,
    item?.trabajadorRut,
    item?.requisitoId,
    item?.docId,
    item?.raw?.id,
  ]);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [loading, setLoading] = useState(Boolean(context));
  const [hasRealFile, setHasRealFile] = useState(Boolean(context));

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!context) {
      setLoading(false);
      setHasRealFile(false);
      setFile(null);
      return () => {};
    }

    setLoading(true);
    setHasRealFile(true);
    setFile(null);

    void loadDocumentFileObjectUrl(context)
      .then(result => {
        if (!active) {
          URL.revokeObjectURL(result.url);
          return;
        }
        objectUrl = result.url;
        setFile(result);
      })
      .catch(error => {
        if (!active) return;
        // Los documentos sembrados antes de Storage no tienen objeto físico.
        // Eso no debe impedir revisar otros registros disponibles.
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        const legacyWithoutFile = message.includes('no tiene un archivo real')
          || message.includes('todavía no tiene un documento asociado')
          || message.includes('no fue posible encontrar el requisito');
        if (legacyWithoutFile) {
          setHasRealFile(false);
          return;
        }
        console.error('No fue posible cargar el archivo privado para revisión.', error);
        setHasRealFile(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [context]);

  if (loading) {
    return (
      <div className="bg-white border border-cream3 rounded-xl w-full max-w-[460px] h-[320px] flex flex-col items-center justify-center gap-3 text-gray-500">
        <Loader2 size={28} className="animate-spin text-brown" />
        <div className="text-[12px] font-medium">Abriendo archivo privado…</div>
      </div>
    );
  }

  if (!hasRealFile || !file) return <LegacyFallback item={item} />;

  const isPdf = file.mimeType === 'application/pdf' || file.filename.toLowerCase().endsWith('.pdf');
  const isImage = file.mimeType.startsWith('image/');

  if (isPdf) {
    return (
      <div className="w-full max-w-[620px] bg-white border border-cream3 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-cream3 flex items-center justify-between gap-3 bg-cream2">
          <div className="min-w-0 flex items-center gap-2">
            <FileText size={16} className="text-brown shrink-0" />
            <span className="text-[11.5px] font-semibold text-navy truncate">{file.filename}</span>
          </div>
          <span className="text-[10px] text-[#3f7c59] flex items-center gap-1 shrink-0"><ShieldCheck size={13} /> Archivo real</span>
        </div>
        <iframe
          src={file.url}
          title={`Vista previa de ${file.filename}`}
          className="w-full h-[520px] bg-white"
        />
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="w-full max-w-[620px] bg-white border border-cream3 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 border-b border-cream3 flex items-center justify-between gap-3 bg-cream2">
          <div className="min-w-0 flex items-center gap-2">
            <ImageIcon size={16} className="text-brown shrink-0" />
            <span className="text-[11.5px] font-semibold text-navy truncate">{file.filename}</span>
          </div>
          <span className="text-[10px] text-[#3f7c59] flex items-center gap-1 shrink-0"><ShieldCheck size={13} /> Archivo real</span>
        </div>
        <div className="p-4 bg-[#f4f1ea] flex items-center justify-center max-h-[560px] overflow-auto">
          <img src={file.url} alt={file.filename} className="max-w-full max-h-[520px] object-contain" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-cream3 rounded-xl w-full max-w-[460px] p-7 shadow-sm text-center">
      <FileText size={38} className="text-brown mx-auto mb-3" />
      <div className="font-semibold text-navy text-[13px]">{file.filename}</div>
      <div className="text-[11px] text-gray-500 mt-1">Archivo almacenado de forma privada en Supabase Storage.</div>
      <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary inline-flex mt-4">Abrir archivo</a>
    </div>
  );
}
