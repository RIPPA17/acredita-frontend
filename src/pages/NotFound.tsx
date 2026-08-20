import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream2 p-4">
      <div className="card w-full max-w-[440px] p-8 text-center">
        <div className="text-[22px] tracking-[2px] text-navy mb-6">Acre<b className="text-brown font-normal">dita</b></div>
        <div className="text-[48px] font-semibold text-navy mb-2 leading-none">404</div>
        <h2 className="text-[20px] text-navy font-semibold mb-2">Página no encontrada</h2>
        <p className="text-gray-500 text-[14.3px] mb-8 leading-relaxed">
          La página que buscas no existe o fue movida.
        </p>
        <Link to="/" className="btn btn-primary">Volver al inicio</Link>
      </div>
    </div>
  );
}
