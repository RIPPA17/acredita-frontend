import DocumentLibraryPanel from '../../components/DocumentLibraryPanel';
import type { Contratista, Mandante, Proyecto } from '../../types';
import DocumentRequirementsTab from './DocumentRequirementsTab';

export default function SubirTab({
  contratistaLogueado,
  misProyectos,
  allMandantes,
  selectedProyectoId,
  setSelectedProyectoId,
  onDataChanged,
  showToast,
}: {
  contratistaLogueado: Contratista;
  misProyectos: Proyecto[];
  allMandantes: Mandante[];
  selectedProyectoId: string;
  setSelectedProyectoId: (id: string) => void;
  onDataChanged: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const project = misProyectos.find(item => item.id === selectedProyectoId) || misProyectos[0];
  const requirementsProps = {
    contratistaLogueado,
    misProyectos,
    allMandantes,
    selectedProyectoId,
    setSelectedProyectoId,
    onDataChanged,
    showToast,
  };

  return (
    <>
      <DocumentRequirementsTab {...requirementsProps} />
      {project && (
        <section className="mx-auto w-full max-w-[1440px] px-4 pb-8 sm:px-6 lg:px-8">
          <DocumentLibraryPanel
            projectKey={project.id}
            contractorKey={contratistaLogueado.id}
            showToast={showToast}
            onChanged={onDataChanged}
          />
        </section>
      )}
    </>
  );
}
