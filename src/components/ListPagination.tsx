import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  label = 'resultados',
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  if (total <= pageSize) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * pageSize + 1;
  const to = Math.min(total, safePage * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-cream3 bg-white">
      <span className="text-[11.5px] text-gray-500">
        Mostrando {from}–{to} de {total} {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-cream3 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-navy disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cream2"
        >
          <ChevronLeft size={14} /> Anterior
        </button>
        <span className="text-[11.5px] text-gray-500 min-w-[74px] text-center">
          Página {safePage} de {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="inline-flex items-center gap-1 rounded-lg border border-cream3 bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-navy disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cream2"
        >
          Siguiente <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
