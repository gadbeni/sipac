/** Alta / edición de horario (plantilla semanal) con validación de solapamientos y capacidad. */
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useNotify } from '@/context/NotifyContext';
import { agendaService } from '@/services/agendaService';
import { isAppError } from '@/services/errors';
import { DIAS_SEMANA } from '@/config/constants';
import { timeToMinutes, today } from '@/utils/dates';
import { withWarnings } from '@/utils/withWarnings';

const EMPTY = {
  medicoCentroId: '',
  especialidadId: '',
  consultorioId: '',
  diaSemana: 1,
  horaInicio: '08:00',
  horaFin: '12:00',
  duracionConsultaMin: 20,
  cupos: 12,
  cuposPublicos: 8,
  vigenciaDesde: '',
  vigenciaHasta: '',
};

export default function ScheduleFormDialog({ open, horario, onClose }) {
  const { session } = useAuth();
  const notify = useNotify();
  const confirm = useConfirm();
  const full = useMediaQuery((t) => t.breakpoints.down('sm'));
  const opts = useMemo(
    () => (open ? agendaService.scheduleOptions(session) : { vinculos: [], consultorios: [] }),
    [open, session],
  );
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setV(
        horario
          ? {
              ...EMPTY,
              ...horario,
              vigenciaDesde: horario.vigenciaDesde || '',
              vigenciaHasta: horario.vigenciaHasta || '',
            }
          : { ...EMPTY, vigenciaDesde: today() },
      );
      setErrors({});
    }
  }, [open, horario]);
  const vinculo = opts.vinculos.find((x) => x.value === v.medicoCentroId);
  const set = (k) => (e) =>
    setV((x) => ({ ...x, [k]: e.target.value, ...(k === 'medicoCentroId' ? { especialidadId: '' } : {}) }));
  const span = timeToMinutes(v.horaFin) - timeToMinutes(v.horaInicio);
  const maxCupos = span > 0 && v.duracionConsultaMin > 0 ? Math.floor(span / v.duracionConsultaMin) : 0;
  const tieneFichas = horario?.fichasFuturas > 0;

  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      const r = await withWarnings(
        ({ confirmar }) =>
          horario
            ? agendaService.updateSchedule(session, horario.id, v, { confirmar })
            : agendaService.createSchedule(session, v, { confirmar }),
        confirm,
        'Revise las advertencias',
      );
      if (r) {
        notify.success(horario ? 'Horario actualizado.' : 'Horario creado.');
        onClose();
      }
    } catch (e) {
      if (isAppError(e) && e.details?.fields) setErrors(e.details.fields);
      notify.error(e);
    } finally {
      setBusy(false);
    }
  };

  const sel = (k, label, items, disabled) => (
    <TextField
      select
      label={label}
      value={items.some((o) => o.value === v[k]) ? v[k] : ''}
      onChange={set(k)}
      error={Boolean(errors[k])}
      helperText={errors[k]}
      disabled={disabled}
    >
      {items.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
  const num = (k, label, helper) => (
    <TextField
      type="number"
      label={label}
      value={v[k]}
      onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value === '' ? '' : Number(e.target.value) }))}
      error={Boolean(errors[k])}
      helperText={errors[k] || helper}
    />
  );

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={full}
      aria-labelledby="sched-title"
    >
      <DialogTitle id="sched-title">{horario ? 'Editar horario' : 'Nuevo horario'}</DialogTitle>
      <DialogContent dividers>
        {tieneFichas && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Este horario tiene {horario.fichasFuturas} fichas próximas: solo puede cambiar cupos, hora de fin
            y vigencia (RN-HOR-05).
          </Alert>
        )}
        {errors.diaSemana && errors.diaSemana.length > 40 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errors.diaSemana}
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid size={12}>{sel('medicoCentroId', 'Profesional', opts.vinculos, tieneFichas)}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            {sel('especialidadId', 'Especialidad', vinculo?.especialidades || [], tieneFichas)}
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            {sel('consultorioId', 'Consultorio', opts.consultorios, tieneFichas)}
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            {sel(
              'diaSemana',
              'Día',
              Object.entries(DIAS_SEMANA).map(([value, label]) => ({ value: Number(value), label })),
              tieneFichas,
            )}
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              type="time"
              label="Inicio"
              value={v.horaInicio}
              onChange={set('horaInicio')}
              disabled={tieneFichas}
              error={Boolean(errors.horaInicio)}
              helperText={errors.horaInicio}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField
              type="time"
              label="Fin"
              value={v.horaFin}
              onChange={set('horaFin')}
              error={Boolean(errors.horaFin)}
              helperText={errors.horaFin}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{num('duracionConsultaMin', 'Minutos por consulta')}</Grid>
          <Grid size={{ xs: 6, sm: 4 }}>{num('cupos', 'Cupos', `Máximo en la franja: ${maxCupos}`)}</Grid>
          <Grid size={{ xs: 6, sm: 4 }}>{num('cuposPublicos', 'Cupos web', 'El resto, ventanilla')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Vigente desde"
              format="DD/MM/YYYY"
              value={v.vigenciaDesde ? dayjs(v.vigenciaDesde) : null}
              onChange={(d) =>
                setV((x) => ({ ...x, vigenciaDesde: d?.isValid() ? d.format('YYYY-MM-DD') : '' }))
              }
              disabled={tieneFichas}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Vigente hasta (opcional)"
              format="DD/MM/YYYY"
              value={v.vigenciaHasta ? dayjs(v.vigenciaHasta) : null}
              onChange={(d) =>
                setV((x) => ({ ...x, vigenciaHasta: d?.isValid() ? d.format('YYYY-MM-DD') : '' }))
              }
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: Boolean(errors.vigenciaHasta),
                  helperText: errors.vigenciaHasta,
                },
                field: { clearable: true },
              }}
            />
          </Grid>
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Se valida que el profesional no tenga otro horario a la misma hora en ningún centro y que el
          consultorio esté libre.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
