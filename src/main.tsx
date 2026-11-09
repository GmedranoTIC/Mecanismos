import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error capturado por ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('gmedranotic_mecanismos_save_v1');
    } catch {
      // ignore
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f171b',
            color: '#f8fafc',
            padding: '24px',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚙️⚠️</div>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '8px' }}>
            Aviso de inicialización del juego
          </h1>
          <p style={{ color: '#94a3b8', maxWidth: '500px', fontSize: '14px', marginBottom: '20px' }}>
            Se ha producido un error al cargar la aplicación. Si tenías datos guardados anteriores, puedes restablecerlos de forma segura.
          </p>
          <pre
            style={{
              background: '#1e293b',
              color: '#f87171',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              maxWidth: '600px',
              overflowX: 'auto',
              marginBottom: '20px',
              border: '1px solid #334155',
            }}
          >
            {this.state.error?.message || 'Error desconocido'}
          </pre>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#0284c7',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              🔄 Recargar página
            </button>
            <button
              onClick={this.handleReset}
              style={{
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              🗑️ Restablecer datos y reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
