import { Component } from 'react';
import { Alert, Box, Button } from '@mui/material';

/**
 * Captura errores de renderizado y fallas al descargar módulos diferidos (p. ej. sin conexión),
 * mostrando un aviso con "Reintentar" en lugar de una pantalla en blanco.
 * `resetKey` (p. ej. la ruta) limpia el error al navegar.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey };
    return null;
  }

  componentDidCatch(error, info) {
    console.error('[SIPAC] error de interfaz', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(
      String(this.state.error?.message),
    );
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 720, mx: 'auto' }}>
        <Alert
          severity={chunk ? 'warning' : 'error'}
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          }
        >
          {chunk
            ? 'No se pudo cargar esta sección. Verifique su conexión a internet e intente nuevamente.'
            : 'Ocurrió un error inesperado al mostrar esta sección.'}
        </Alert>
      </Box>
    );
  }
}
