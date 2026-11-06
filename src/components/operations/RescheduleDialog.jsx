import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  useMediaQuery,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import BlockPicker from './BlockPicker';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { appointmentService } from '@/services/appointmentService';
import { addDays, today } from '@/utils/dates';

/** Reprogramar una ficha (RN-FIC-08): fecha + bloque con cupo + motivo. */
export default function RescheduleDialog({ open, ficha, onClose, onDone }) {
  const { session } = useAuth();
  const notify = useNotify();
  const full = useMediaQuery((t) => t.breakpoints.down('sm'));
  const [fecha, setFecha] = useState(() =>
    ficha ? appointmentService.nextRescheduleDate(session, ficha.id) : addDays(today(), 1),
  );
  const [horarioId, setHorarioId] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);
  const bloques = useMemo(
    () => (open && ficha ? appointmentService.rescheduleOptions(session, ficha.id, fecha) : []),
    [open, ficha, fecha, session],
  );

  const submit = async () => {
    setBusy(true);
    try {
      const nueva = await appointmentService.reschedule(session, ficha.id, { fecha, horarioId, motivo });
      notify.success(
        `Ficha reprogramada: ${nueva.codigoVisible} (${fecha.split('-').reverse().join('/')} ${nueva.horaEstimada}).`,
      );
      onDone?.(nueva);
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={full}
      aria-labelledby="resched-title"
    >
      <DialogTitle id="resched-title">Reprogramar ficha {ficha?.codigoVisible}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            La ficha actual quedará como reprogramada y su cupo se liberará. Se emitirá una nueva ficha con
            nuevo número.
          </Alert>
          <DatePicker
            label="Nueva fecha"
            format="DD/MM/YYYY"
            value={dayjs(fecha)}
            minDate={dayjs(today())}
            maxDate={dayjs(addDays(today(), 30))}
            onChange={(d) => {
              if (d?.isValid()) {
                setFecha(d.format('YYYY-MM-DD'));
                setHorarioId(null);
              }
            }}
            slotProps={{ textField: { fullWidth: true } }}
          />
          <BlockPicker bloques={bloques} value={horarioId} onChange={setHorarioId} canal={ficha?.canal} />
          <TextField
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={busy || !horarioId || !motivo.trim()}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Reprogramar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
