import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  FormControlLabel,
  LinearProgress,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import LightMode from '@mui/icons-material/LightMode';
import DarkMode from '@mui/icons-material/DarkMode';
import SettingsBrightness from '@mui/icons-material/SettingsBrightness';
import RestartAlt from '@mui/icons-material/RestartAlt';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/common/PageHeader';
import { useColorMode } from '@/context/ColorModeContext';
import { useConnectivity } from '@/context/ConnectivityContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useNotify } from '@/context/NotifyContext';
import { demoService } from '@/services/demoService';
import { formatDateTime } from '@/utils/dates';

/** /admin/configuracion — preferencias de apariencia, simulación sin conexión y datos de demostración. */
export default function SettingsPage() {
  const { mode, setMode } = useColorMode();
  const { networkOnline, simulatedOffline, setSimulatedOffline } = useConnectivity();
  const confirm = useConfirm();
  const notify = useNotify();
  const [meta] = useState(() => demoService.getMeta());
  const [usage] = useState(() => demoService.getStorageUsage());
  const { can, logout } = useAuth();
  const navigate = useNavigate();
  const pct = Math.min(100, Math.round((usage.chars / usage.quotaChars) * 100));

  const restore = async () => {
    const ok = await confirm({
      title: '¿Restaurar los datos de demostración?',
      message:
        'Se perderán las solicitudes, fichas y cambios realizados en este navegador y se cerrará la sesión. Las preferencias (como el modo oscuro) se conservan.',
      confirmLabel: 'Restaurar datos',
      destructive: true,
    });
    if (!ok) return;
    try {
      await demoService.resetDemoData();
      // F10: la restauración re-siembra los usuarios, por lo que se cierra la sesión.
      logout();
      notify.success('Datos de demostración restaurados. Vuelva a ingresar.');
      navigate('/login', { replace: true });
    } catch (e) {
      notify.error(e);
    }
  };

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle="Preferencias de este navegador y herramientas de la demostración."
        breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Configuración' }]}
      />
      <Stack spacing={3} sx={{ maxWidth: 760 }}>
        <Card>
          <CardHeader
            title="Apariencia"
            subheader="Se guarda en este navegador y se aplica al portal y al panel."
          />
          <CardContent sx={{ pt: 0 }}>
            <ToggleButtonGroup
              exclusive
              value={mode}
              onChange={(_e, v) => v && setMode(v)}
              aria-label="Modo de color"
              sx={{
                flexWrap: 'wrap',
                '& .MuiToggleButton-root': { minHeight: 44, px: 2, gap: 1, textTransform: 'none' },
              }}
            >
              <ToggleButton value="light">
                <LightMode fontSize="small" /> Claro
              </ToggleButton>
              <ToggleButton value="dark">
                <DarkMode fontSize="small" /> Oscuro
              </ToggleButton>
              <ToggleButton value="system">
                <SettingsBrightness fontSize="small" /> Según el sistema
              </ToggleButton>
            </ToggleButtonGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Conectividad"
            subheader="Sin conexión se puede consultar, pero no enviar ni modificar datos."
          />
          <CardContent sx={{ pt: 0 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Estado de la red: <strong>{networkOnline ? 'conectado' : 'sin conexión'}</strong>
            </Typography>
            <FormControlLabel
              control={
                <Switch checked={simulatedOffline} onChange={(e) => setSimulatedOffline(e.target.checked)} />
              }
              label="Simular sin conexión (solo esta pestaña, hasta recargar)"
              sx={{ minHeight: 44 }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Datos de demostración"
            subheader="Todos los datos son ficticios y se guardan solo en este navegador."
          />
          <CardContent sx={{ pt: 0 }}>
            <Typography variant="body2" color="text.secondary">
              Sembrados el {formatDateTime(meta?.sembradoEn) || '—'}
            </Typography>
            <Box sx={{ my: 2 }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">Uso del almacenamiento local</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {pct}%
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={pct}
                aria-label="Uso del almacenamiento local"
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {can('demo.restaurar') && (
                <Button variant="outlined" color="error" startIcon={<RestartAlt />} onClick={restore}>
                  Restaurar datos de demostración
                </Button>
              )}
              <Button component={RouterLink} to="/dev/datos">
                Ver estado de los datos
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </>
  );
}
