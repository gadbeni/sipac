import { Alert, Button } from '@mui/material';

/** Aviso cuando el mapa no puede mostrarse por falta de conexión (D-18). */
export default function MapOfflineNotice({ onShowCards }) {
  return (
    <Alert
      severity="warning"
      action={
        onShowCards && (
          <Button color="inherit" size="small" onClick={onShowCards}>
            Ver tarjetas
          </Button>
        )
      }
    >
      El mapa necesita conexión a internet.{onShowCards ? ' Puede seguir usando la vista de tarjetas.' : ''}
    </Alert>
  );
}
