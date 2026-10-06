import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Studio ErrorBoundary caught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#07080c',
          color: '#f8fafc',
          padding: '24px',
          fontFamily: 'monospace',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#f43f5e', marginBottom: '12px' }}>Studio UI Recovery</h2>
          <p style={{ color: '#94a3b8', maxWidth: '500px', marginBottom: '20px', fontSize: '13px' }}>
            An unexpected error occurred during rendering.
          </p>
          <pre style={{
            background: '#10121b',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#fca5a5',
            maxWidth: '680px',
            overflowX: 'auto',
            textAlign: 'left'
          }}>
            {this.state.error?.stack || String(this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#06b6d4',
              color: '#042f2e',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Reload Studio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
