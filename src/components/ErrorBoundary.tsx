import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  props: Props;
  state: State = { hasError: false };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream2 p-4">
          <div className="card w-full max-w-[440px] p-8 text-center">
            <div className="text-[22px] tracking-[2px] text-navy mb-6">Acre<b className="text-brown font-normal">dita</b></div>
            <h2 className="text-[22px] text-navy font-semibold mb-2">Algo salió mal</h2>
            <p className="text-gray-500 text-[14.3px] mb-8 leading-relaxed">
              Ocurrió un error inesperado al mostrar esta página. Puedes intentar recargar o volver al inicio.
            </p>
            <div className="flex gap-3 justify-center">
              <a href="/" className="btn btn-primary">Volver al inicio</a>
              <button onClick={() => window.location.reload()} className="btn btn-ghost">Recargar</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
