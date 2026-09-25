import React from 'react';
import { Building2, CheckCircle2, UserRound, X } from 'lucide-react';
import { createAdminContractor } from '../data/supabaseContractorDirectory';
import { restoreSupabaseSession } from '../data/supabaseAuth';
import { hydrateCoreDataFromSupabase } from '../data/supabaseCoreData';
import { isValidRut } from '../utils/rut';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
};

const REGIONS = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana de Santiago',
  "O'Higgins",
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén',
  'Magallanes y de la Antártica Chilena',
];

const emptyForm = () => ({
  name: '',
  legalName: '',
  rut: '',
  companyType: '',
  businessActivity: '',
  siiActivityCode: '',
  companyEmail: '',
  companyPhone: '',
  website: '',
  country: 'Chile',
  region: '',
  commune: '',
  address: '',
  legalRepresentativeName: '',
  legalRepresentativeRut: '',
  legalRepresentativeEmail: '',
  legalRepresentativePhone: '',
  adminFullName: '',
  adminRut: '',
  adminEmail: '',
  adminPhone: '',
  occupationalInsurer: '',
  compensationFund: '',
  employeeCount: '',
});

function FieldTitle({ children, optional = false }: { children: React.ReactNode; optional?: boolean }) {
  return <span className="text-[13px] font-medium text-gray-700">{children}{optional && <span className="ml-1 font-normal text-gray-400">opcional</span>}</span>;
}

export default function AdminContractorCreateModal({ open, onClose, onCreated, showToast }: Props) {
  const [form, setForm] = React.useState(emptyForm);
  const [sameAdministrator, setSameAdministrator] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [created, setCreated] = React.useState<{ name: string; email: string; invited: boolean } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    setSameAdministrator(false);
    setCreated(null);
  }, [open]);

  if (!open) return null;

  const adminName = sameAdministrator ? form.legalRepresentativeName : form.adminFullName;
  const adminRut = sameAdministrator ? form.legalRepresentativeRut : form.adminRut;
  const adminEmail = sameAdministrator ? form.legalRepresentativeEmail : form.adminEmail;
  const adminPhone = sameAdministrator ? form.legalRepresentativePhone : form.adminPhone;

  const requiredComplete = [
    form.name,
    form.legalName,
    form.rut,
    form.companyType,
    form.businessActivity,
    form.companyEmail,
    form.companyPhone,
    form.region,
    form.commune,
    form.address,
    form.legalRepresentativeName,
    form.legalRepresentativeRut,
    form.legalRepresentativeEmail,
    form.legalRepresentativePhone,
    adminName,
    adminRut,
    adminEmail,
    adminPhone,
    form.occupationalInsurer,
  ].every(value => value.trim());

  const rutErrors = {
    company: Boolean(form.rut.trim()) && !isValidRut(form.rut),
    legal: Boolean(form.legalRepresentativeRut.trim()) && !isValidRut(form.legalRepresentativeRut),
    admin: Boolean(adminRut.trim()) && !isValidRut(adminRut),
  };

  const close = () => {
    if (saving) return;
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !requiredComplete) return;
    if (rutErrors.company || rutErrors.legal || rutErrors.admin) {
      showToast('Revisa los RUT ingresados antes de crear el contratista.', 'error');
      return;
    }

    setSaving(true);
    try {
      const result = await createAdminContractor({
        name: form.name,
        legalName: form.legalName,
        rut: form.rut,
        companyType: form.companyType,
        businessActivity: form.businessActivity,
        siiActivityCode: form.siiActivityCode,
        companyEmail: form.companyEmail,
        companyPhone: form.companyPhone,
        website: form.website,
        country: form.country,
        region: form.region,
        commune: form.commune,
        address: form.address,
        legalRepresentativeName: form.legalRepresentativeName,
        legalRepresentativeRut: form.legalRepresentativeRut,
        legalRepresentativeEmail: form.legalRepresentativeEmail,
        legalRepresentativePhone: form.legalRepresentativePhone,
        adminFullName: adminName,
        adminRut,
        adminEmail,
        adminPhone,
        occupationalInsurer: form.occupationalInsurer,
        compensationFund: form.compensationFund,
        employeeCount: form.employeeCount.trim() ? Number(form.employeeCount) : null,
      });

      const session = await restoreSupabaseSession();
      if (session) await hydrateCoreDataFromSupabase(session);
      setCreated({
        name: result.contractor.name,
        email: result.administrator.email,
        invited: result.invited,
      });
      onCreated();
      showToast(result.invited
        ? 'Contratista creado. Invitación enviada a su administrador.'
        : 'Contratista creado y administrador vinculado.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No fue posible crear el contratista.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof ReturnType<typeof emptyForm>, value: string) => setForm(current => ({ ...current, [key]: value }));

  return <div className="fixed inset-0 z-[520] flex items-center justify-center bg-black/50 p-3 sm:p-4" onClick={close}>
    <div className="max-h-[calc(100vh-20px)] w-full max-w-[760px] overflow-y-auto rounded-xl bg-white shadow-xl" onClick={event => event.stopPropagation()}>
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-cream bg-white p-4">
        <div>
          <h3 className="flex items-center gap-2 text-[17.6px] font-medium text-navy"><Building2 size={19} /> Nuevo contratista</h3>
          <p className="mt-0.5 max-w-[620px] text-xs text-gray-500">Crea la ficha maestra de la empresa y deja habilitado a su administrador para operar Acredita.</p>
        </div>
        <button type="button" onClick={close} disabled={saving} className="text-gray-400 hover:text-gray-600 disabled:opacity-40"><X size={20} /></button>
      </div>

      {created ? <div className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckCircle2 size={32} /></div>
        <h4 className="text-lg font-semibold text-navy">Contratista creado completamente</h4>
        <p className="mt-2 text-sm text-gray-600"><strong>{created.name}</strong> ya quedó registrado en el directorio maestro de Acredita.</p>
        <div className="mx-auto mt-4 max-w-md rounded-lg border border-cream3 bg-cream2/50 p-3 text-left text-xs text-gray-600">
          <strong className="block text-navy">Administrador Acredita</strong>
          <span>{created.email}</span>
          <span className="mt-1 block">{created.invited ? 'Se envió una invitación para crear su acceso.' : 'La cuenta ya existía y quedó vinculada a la empresa.'}</span>
        </div>
        <button type="button" onClick={close} className="btn btn-primary mt-6">Cerrar</button>
      </div> : <form onSubmit={submit} className="flex flex-col gap-5 p-5 sm:p-6">
        <section className="rounded-xl border border-cream3 p-4">
          <div className="mb-4">
            <strong className="text-sm text-navy">1. Identificación de la empresa</strong>
            <p className="mt-1 text-[11.5px] text-gray-500">Datos que identifican al contratista como empresa dentro de Acredita.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label><FieldTitle>Nombre comercial</FieldTitle><input aria-label="Nombre comercial del contratista" value={form.name} onChange={e=>set('name',e.target.value)} className="form-input mt-1.5 w-full" placeholder="Transportes Ejemplo" required /></label>
            <label><FieldTitle>RUT empresa</FieldTitle><input aria-label="RUT del contratista" value={form.rut} onChange={e=>set('rut',e.target.value)} className="form-input mt-1.5 w-full" placeholder="76.123.456-0" required />{rutErrors.company && <small className="mt-1 block text-red-600">RUT inválido.</small>}</label>
            <label><FieldTitle>Razón social</FieldTitle><input aria-label="Razón social del contratista" value={form.legalName} onChange={e=>set('legalName',e.target.value)} className="form-input mt-1.5 w-full" placeholder="Transportes Ejemplo SpA" required /></label>
            <label><FieldTitle>Tipo de empresa</FieldTitle><select aria-label="Tipo de empresa" value={form.companyType} onChange={e=>set('companyType',e.target.value)} className="form-input mt-1.5 w-full" required><option value="">Selecciona...</option><option value="spa">SpA</option><option value="ltda">Ltda.</option><option value="sa">S.A.</option><option value="eirl">EIRL</option><option value="persona_natural">Persona natural con giro</option><option value="otra">Otra</option></select></label>
            <label className="sm:col-span-2"><FieldTitle>Rubro / actividad principal</FieldTitle><input aria-label="Actividad principal del contratista" value={form.businessActivity} onChange={e=>set('businessActivity',e.target.value)} className="form-input mt-1.5 w-full" placeholder="Montaje industrial, transporte, construcción..." required /></label>
            <label><FieldTitle optional>Código actividad SII</FieldTitle><input aria-label="Código actividad SII" value={form.siiActivityCode} onChange={e=>set('siiActivityCode',e.target.value)} className="form-input mt-1.5 w-full" placeholder="Ej. 492300" /></label>
            <label><FieldTitle optional>Sitio web</FieldTitle><input aria-label="Sitio web del contratista" value={form.website} onChange={e=>set('website',e.target.value)} className="form-input mt-1.5 w-full" placeholder="empresa.cl" /></label>
            <label><FieldTitle>Correo general</FieldTitle><input aria-label="Correo general del contratista" type="email" value={form.companyEmail} onChange={e=>set('companyEmail',e.target.value)} className="form-input mt-1.5 w-full" placeholder="contacto@empresa.cl" required /></label>
            <label><FieldTitle>Teléfono empresa</FieldTitle><input aria-label="Teléfono general del contratista" value={form.companyPhone} onChange={e=>set('companyPhone',e.target.value)} className="form-input mt-1.5 w-full" placeholder="+56 2 2345 6789" required /></label>
          </div>
        </section>

        <section className="rounded-xl border border-cream3 p-4">
          <div className="mb-4"><strong className="text-sm text-navy">2. Domicilio</strong><p className="mt-1 text-[11.5px] text-gray-500">Domicilio principal de la empresa en Chile.</p></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label><FieldTitle>País</FieldTitle><input aria-label="País del contratista" value={form.country} readOnly className="form-input mt-1.5 w-full bg-gray-50" /></label>
            <label><FieldTitle>Región</FieldTitle><select aria-label="Región del contratista" value={form.region} onChange={e=>set('region',e.target.value)} className="form-input mt-1.5 w-full" required><option value="">Selecciona...</option>{REGIONS.map(region=><option key={region} value={region}>{region}</option>)}</select></label>
            <label><FieldTitle>Comuna</FieldTitle><input aria-label="Comuna del contratista" value={form.commune} onChange={e=>set('commune',e.target.value)} className="form-input mt-1.5 w-full" placeholder="Santiago" required /></label>
            <label><FieldTitle>Dirección</FieldTitle><input aria-label="Dirección del contratista" value={form.address} onChange={e=>set('address',e.target.value)} className="form-input mt-1.5 w-full" placeholder="Av. Ejemplo 123" required /></label>
          </div>
        </section>

        <section className="rounded-xl border border-cream3 p-4">
          <div className="mb-4"><strong className="text-sm text-navy">3. Representante legal</strong><p className="mt-1 text-[11.5px] text-gray-500">Persona que representa legalmente a la empresa.</p></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label><FieldTitle>Nombre completo</FieldTitle><input aria-label="Nombre del representante legal" value={form.legalRepresentativeName} onChange={e=>set('legalRepresentativeName',e.target.value)} className="form-input mt-1.5 w-full" required /></label>
            <label><FieldTitle>RUT</FieldTitle><input aria-label="RUT del representante legal" value={form.legalRepresentativeRut} onChange={e=>set('legalRepresentativeRut',e.target.value)} className="form-input mt-1.5 w-full" placeholder="12.345.678-5" required />{rutErrors.legal && <small className="mt-1 block text-red-600">RUT inválido.</small>}</label>
            <label><FieldTitle>Correo</FieldTitle><input aria-label="Correo del representante legal" type="email" value={form.legalRepresentativeEmail} onChange={e=>set('legalRepresentativeEmail',e.target.value)} className="form-input mt-1.5 w-full" required /></label>
            <label><FieldTitle>Teléfono</FieldTitle><input aria-label="Teléfono del representante legal" value={form.legalRepresentativePhone} onChange={e=>set('legalRepresentativePhone',e.target.value)} className="form-input mt-1.5 w-full" placeholder="+56 9 1234 5678" required /></label>
          </div>
        </section>

        <section className="rounded-xl border border-cream3 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div><strong className="flex items-center gap-1.5 text-sm text-navy"><UserRound size={15} /> 4. Administrador de Acredita</strong><p className="mt-1 text-[11.5px] text-gray-500">Será la cuenta principal del contratista y recibirá la invitación de acceso.</p></div>
          </div>
          <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={sameAdministrator} onChange={e=>setSameAdministrator(e.target.checked)} /> El representante legal también será el administrador de Acredita</label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label><FieldTitle>Nombre completo</FieldTitle><input aria-label="Nombre del administrador Acredita" value={adminName} disabled={sameAdministrator} onChange={e=>set('adminFullName',e.target.value)} className="form-input mt-1.5 w-full disabled:bg-gray-50" required /></label>
            <label><FieldTitle>RUT</FieldTitle><input aria-label="RUT del administrador Acredita" value={adminRut} disabled={sameAdministrator} onChange={e=>set('adminRut',e.target.value)} className="form-input mt-1.5 w-full disabled:bg-gray-50" required />{rutErrors.admin && <small className="mt-1 block text-red-600">RUT inválido.</small>}</label>
            <label><FieldTitle>Correo de acceso</FieldTitle><input aria-label="Correo del administrador Acredita" type="email" value={adminEmail} disabled={sameAdministrator} onChange={e=>set('adminEmail',e.target.value)} className="form-input mt-1.5 w-full disabled:bg-gray-50" required /></label>
            <label><FieldTitle>Teléfono</FieldTitle><input aria-label="Teléfono del administrador Acredita" value={adminPhone} disabled={sameAdministrator} onChange={e=>set('adminPhone',e.target.value)} className="form-input mt-1.5 w-full disabled:bg-gray-50" required /></label>
          </div>
        </section>

        <section className="rounded-xl border border-cream3 p-4">
          <div className="mb-4"><strong className="text-sm text-navy">5. Información laboral básica</strong><p className="mt-1 text-[11.5px] text-gray-500">Información general de la empresa. Los documentos de cumplimiento se exigirán después según cada proyecto.</p></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label><FieldTitle>Organismo administrador Ley 16.744</FieldTitle><select aria-label="Organismo administrador Ley 16.744" value={form.occupationalInsurer} onChange={e=>set('occupationalInsurer',e.target.value)} className="form-input mt-1.5 w-full" required><option value="">Selecciona...</option><option value="achs">ACHS</option><option value="mutual_seguridad">Mutual de Seguridad CChC</option><option value="ist">IST</option><option value="isl">ISL</option><option value="otro">Otro</option><option value="no_aplica">No aplica</option></select></label>
            <label><FieldTitle optional>Caja de compensación</FieldTitle><select aria-label="Caja de compensación" value={form.compensationFund} onChange={e=>set('compensationFund',e.target.value)} className="form-input mt-1.5 w-full"><option value="">No informada</option><option value="Los Andes">Los Andes</option><option value="La Araucana">La Araucana</option><option value="Los Héroes">Los Héroes</option><option value="18 de Septiembre">18 de Septiembre</option><option value="Otra">Otra</option><option value="No afiliada">No afiliada</option></select></label>
            <label><FieldTitle optional>Dotación aproximada</FieldTitle><input aria-label="Dotación aproximada del contratista" type="number" min="0" max="1000000" value={form.employeeCount} onChange={e=>set('employeeCount',e.target.value)} className="form-input mt-1.5 w-full" placeholder="50" /></label>
          </div>
        </section>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11.5px] leading-relaxed text-blue-800">
          Esta creación registra la <strong>empresa maestra</strong> y su <strong>administrador</strong>. No la asigna a ningún proyecto y no solicita F30, contratos, cotizaciones u otros documentos: esos antecedentes se exigen después mediante la matriz documental correspondiente.
        </div>

        <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-3 border-t border-cream bg-white p-4 sm:-mx-6 sm:-mb-6">
          <button type="button" onClick={close} disabled={saving} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={saving || !requiredComplete || rutErrors.company || rutErrors.legal || rutErrors.admin} className="btn btn-primary disabled:opacity-60">{saving ? 'Creando e invitando…' : 'Crear contratista'}</button>
        </div>
      </form>}
    </div>
  </div>;
}
