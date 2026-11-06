import { useState } from 'react';
import {
  Alert,
  Button,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { demoService } from '@/services/demoService';
import { formatDateTime } from '@/utils/dates';
import { useConfirm } from '@/context/ConfirmContext';
import { useNotify } from '@/context/NotifyContext';
import PageHeader from '@/components/common/PageHeader';

const LABELS = {
  centros: 'Centros de salud',
  consultorios: 'Consultorios',
  especialidades: 'Especialidades (catálogo)',
  centroEspecialidades: 'Especialidades por centro',
  medicos: 'Médicos',
  medicoCentros: 'Vínculos médico-centro',
  horarios: 'Horarios',
  excepcionesAgenda: 'Excepciones de agenda',
  pacientes: 'Pacientes',
  solicitudes: 'Solicitudes',
  fichas: 'Fichas',
  usuarios: 'Usuarios',
  notificaciones: 'Notificaciones',
};

/** Página interna de verificación de la Épica 1 (siembra, integridad y uso de almacenamiento). */
export default function DataStatusPage() {
  const [health, setHealth] = useState(() => demoService.getHealth());
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const notify = useNotify();
  const pct = Math.round((health.usage.chars / health.usage.quotaChars) * 100);

  const reset = async () => {
    const ok = await confirm({
      title: '¿Restaurar los datos de demostración?',
      message: 'Se perderán los cambios realizados en este navegador.',
      confirmLabel: 'Restaurar datos',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await demoService.resetDemoData();
      setHealth(demoService.getHealth());
      notify.success('Datos de demostración restaurados.');
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <PageHeader
        title="Estado de los datos"
        breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Desarrollo' }, { label: 'Datos' }]}
      />
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 4 } }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Sembrado el {formatDateTime(health.meta?.sembradoEn)} · versión de esquema{' '}
          {health.meta?.schemaVersion} · uso de almacenamiento {pct}% ({Math.round(health.usage.chars / 1000)}{' '}
          mil de {health.usage.quotaChars / 1_000_000} millones de caracteres)
        </Typography>
        {health.errors.length === 0 ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Integridad verificada: 0 errores en relaciones, cupos y duplicados.
          </Alert>
        ) : (
          <Alert severity="error" sx={{ mb: 2 }}>
            {health.errors.length} errores de integridad: {health.errors.slice(0, 5).join(' · ')}
          </Alert>
        )}
        <Table size="small" sx={{ mb: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell>Colección</TableCell>
              <TableCell align="right">Registros</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(health.counts).map(([k, v]) => (
              <TableRow key={k}>
                <TableCell>{LABELS[k] || k}</TableCell>
                <TableCell align="right">{v.toLocaleString('es-BO')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" onClick={reset} disabled={busy}>
            {busy ? 'Restaurando…' : 'Restaurar datos de demostración'}
          </Button>
          <Button component={RouterLink} to="/">
            Volver al inicio
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
