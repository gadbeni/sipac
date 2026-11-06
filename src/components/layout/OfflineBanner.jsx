import { Alert, Button } from '@mui/material';
import CloudOff from '@mui/icons-material/CloudOff';
import { useConnectivity } from '@/context/ConnectivityContext';

/** Aviso persistente sin conexión (RN-OFF-01): se puede consultar, no enviar ni modificar. */
export default function OfflineBanner() {
  const { online, simulatedOffline, setSimulatedOffline } = useConnectivity();
  if (online) return null;
  return (
    <Alert
      severity="warning"
      icon={<CloudOff />}
      role="status"
      square
      sx={{ borderRadius: 0, justifyContent: 'center', alignItems: 'center', py: 0.25 }}
      action={
        simulatedOffline ? (
          <Button color="inherit" size="small" onClick={() => setSimulatedOffline(false)}>
            Restablecer conexión
          </Button>
        ) : undefined
      }
    >
      {simulatedOffline ? 'Modo sin conexión simulado. ' : 'Sin conexión a internet. '}
      Puede consultar la información ya cargada, pero no enviar ni modificar datos.
    </Alert>
  );
}
