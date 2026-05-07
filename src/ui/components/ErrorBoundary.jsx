import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('Error capturado por ErrorBoundary:', error, info);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: '24px',
                    textAlign: 'center',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    color: 'var(--text)',
                    background: 'var(--bg)'
                }}>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>
                        Algo salió mal
                    </h1>
                    <p style={{ color: 'var(--muted)', marginBottom: '24px', maxWidth: '400px' }}>
                        Ocurrió un error inesperado. Intenta recargar la página.
                    </p>
                    <button
                        onClick={this.handleRetry}
                        style={{
                            padding: '12px 28px',
                            border: '0',
                            borderRadius: '999px',
                            background: 'linear-gradient(180deg, #b88ad0, #a978c4)',
                            color: '#fff',
                            font: 'inherit',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Reintentar
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
