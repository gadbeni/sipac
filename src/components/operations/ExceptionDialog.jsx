/**
 * Registrar una novedad de agenda (feriado, ausencia, permiso, bloqueo, ajuste de cupos).
 * Paso 1: datos. Paso 2: si hay fichas afectadas, elegir reprogramar o cancelar (RN-AGE-02).
 */
import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Radio,
  RadioGroup,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { agendaService } from '@/services/agendaService';
import { isAppError } from '@/services/errors';
import { TIPOS_EXCEPCION } from '@/config/constants';
import { addDays, formatDate, today } from '@/utils/dates';

const ALCANCES = [
  { value: 'medico', label: 'Un profesional', tipos: ['ausencia', 'permiso', 'bloqueo', 'ajuste_cupos'] },
  { value: 'horario', label: 'Un horario', tipos: ['bloqueo', 'ajuste_cupos', 'permiso', 'ausencia'] },
  { value: 'especialidad', label: 'Una especialidad', tipos: ['bloqueo'] },
  { value: 'centro', label: 'Todo el centro', tipos: ['feriado', 'bloqueo'] },
  {
    value: 'global',
    label: 'Toda la red (administración central)',
    tipos: ['feriado', 'bloqueo'],
    central: true,
  },
];

const initial = (pre) => ({
  tipo: 'permiso',
  alcance: 'medico',
  medicoId: '',
  especialidadId: '',
  horarioId: '',
  fechaInicio: addDays(today(), 1),
  fechaFin: addDays(today(), 1),
  horaInicio: '',
  horaFin: '',
  cuposAjustados: '',
  motivo: '',
  todosLosCentros: false,
  ...pre,
});

export default function ExceptionDialog({ open, preset, onClose }) {
  const { session } = useAuth();
  const notify = useNotify();
  const full = useMediaQuery((t) => t.breakpoints.down('sm'));
  const [v, setV] = useState(initial(preset));
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null);
  const [resolucion, setResolucion] = useState('reprogramar');
  const [busy, setBusy] = useState(false);
  const opts = useMemo(() => (open ? agendaService.scheduleOptions(session) : null), [open, session]);
  const medicos = useMemo(() => {
    const m = new Map();
    for (const x of opts?.vinculos || []) m.set(x.medicoId, x.label);
    return [...m.entries()].map(([value, label]) => ({ value, label }));
  }, [opts]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setV(initial(preset));
      setErrors({});
      setPreview(null);
      setResolucion('reprogramar');
    }
  }, [open, preset]);

  const set = (k) => (e) =>
    setV((x) => ({
      ...x,
      [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e,
    }));
  const alcanceDef = ALCANCES.find((a) => a.value === v.alcance);
  const tipos = useMemo(() => alcanceDef?.tipos || [], [alcanceDef]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!tipos.includes(v.tipo)) setV((x) => ({ ...x, tipo: tipos[0] }));
  }, [v.alcance, v.tipo, tipos]);

  const fail = (e) => {
    if (isAppError(e) && e.details?.fields) setErrors(e.details.fields);
    notify.error(e);
  };

  const next = async () => {
    setErrors({});
    setBusy(true);
    try {
      const p = await agendaService.previewException(session, v);
      if (p.afectadas.length === 0) {
        await agendaService.createException(session, v);
        notify.success('Novedad registrada. No había fichas emitidas afectadas.');
        onClose(true);
      } else setPreview(p);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmCreate = async () => {
    setBusy(true);
    try {
      const r = await agendaService.createException(session, v, { resolucion });
      notify.success(
        `Novedad registrada: ${r.reprogramadas.length} fichas reprogramadas, ${r.canceladas.length} canceladas. Avise a los pacientes.`,
      );
      onClose(true);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const date = (k, label) => (
    <DatePicker
      label={label}
      format="DD/MM/YYYY"
      value={v[k] ? dayjs(v[k]) : null}
      minDate={dayjs(today())}
      onChange={(d) =>
        d?.isValid() &&
        setV((x) => ({
          ...x,
          [k]: d.format('YYYY-MM-DD'),
          ...(k === 'fechaInicio' && x.fechaFin < d.format('YYYY-MM-DD')
            ? { fechaFin: d.format('YYYY-MM-DD') }
            : {}),
        }))
      }
      slotProps={{ textField: { fullWidth: true, error: Boolean(errors[k]), helperText: errors[k] } }}
    />
  );

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : () => onClose(false)}
      fullWidth
      maxWidth="sm"
      fullScreen={full}
      aria-labelledby="exc-title"
    >
      <DialogTitle id="exc-title">
        {preview ? 'Fichas afectadas por la novedad' : 'Registrar novedad de agenda'}
      </DialogTitle>
      <DialogContent dividers>
        {!preview ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Alcance"
                value={v.alcance}
                onChange={set('alcance')}
                error={Boolean(errors.alcance)}
                helperText={errors.alcance}
              >
                {ALCANCES.filter((a) => !a.central || session.rol === 'admin_central').map((a) => (
                  <MenuItem key={a.value} value={a.value}>
                    {a.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Tipo"
                value={tipos.includes(v.tipo) ? v.tipo : ''}
                onChange={set('tipo')}
                error={Boolean(errors.tipo)}
                helperText={errors.tipo}
              >
                {tipos.map((t) => (
                  <MenuItem key={t} value={t}>
                    {TIPOS_EXCEPCION[t]}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {v.alcance === 'medico' && (
              <Grid size={12}>
                <TextField
                  select
                  label="Profesional"
                  value={v.medicoId}
                  onChange={set('medicoId')}
                  error={Boolean(errors.medicoId)}
                  helperText={errors.medicoId}
                >
                  {medicos.map((m) => (
                    <MenuItem key={m.value} value={m.value}>
                      {m.label}
                    </MenuItem>
                  ))}
                </TextField>
                {session.rol === 'admin_central' && v.tipo === 'ausencia' && (
                  <FormControlLabel
                    control={<Switch checked={v.todosLosCentros} onChange={set('todosLosCentros')} />}
                    label="En todos los centros donde trabaja"
                    sx={{ mt: 1 }}
                  />
                )}
              </Grid>
            )}
            {v.alcance === 'horario' && (
              <Grid size={12}>
                <TextField
                  select
                  label="Horario"
                  value={v.horarioId}
                  onChange={set('horarioId')}
                  error={Boolean(errors.horarioId)}
                  helperText={errors.horarioId}
                >
                  {(opts?.horarios || []).map((h) => (
                    <MenuItem key={h.value} value={h.value}>
                      {h.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            {v.alcance === 'especialidad' && (
              <Grid size={12}>
                <TextField
                  select
                  label="Especialidad"
                  value={v.especialidadId}
                  onChange={set('especialidadId')}
                  error={Boolean(errors.especialidadId)}
                  helperText={errors.especialidadId}
                >
                  {(opts?.especialidades || []).map((e) => (
                    <MenuItem key={e.value} value={e.value}>
                      {e.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>{date('fechaInicio', 'Desde')}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{date('fechaFin', 'Hasta')}</Grid>
            {v.tipo !== 'feriado' && (
              <>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    type="time"
                    label="Hora inicio (opcional)"
                    value={v.horaInicio}
                    onChange={set('horaInicio')}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    type="time"
                    label="Hora fin (opcional)"
                    value={v.horaFin}
                    onChange={set('horaFin')}
                    error={Boolean(errors.horaFin)}
                    helperText={errors.horaFin || 'Vacías = todo el día'}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Grid>
              </>
            )}
            {v.tipo === 'ajuste_cupos' && (
              <Grid size={12}>
                <TextField
                  type="number"
                  label="Cupos para esas fechas"
                  value={v.cuposAjustados}
                  onChange={set('cuposAjustados')}
                  error={Boolean(errors.cuposAjustados)}
                  helperText={errors.cuposAjustados || 'Reemplaza los cupos del horario en esas fechas.'}
                />
              </Grid>
            )}
            <Grid size={12}>
              <TextField
                label="Motivo"
                value={v.motivo}
                onChange={set('motivo')}
                error={Boolean(errors.motivo)}
                helperText={errors.motivo}
                slotProps={{ htmlInput: { maxLength: 120 } }}
              />
            </Grid>
          </Grid>
        ) : (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {preview.afectadas.length}{' '}
              {preview.afectadas.length === 1
                ? 'ficha emitida queda afectada'
                : 'fichas emitidas quedan afectadas'}
              . Elija qué hacer con ellas (RN-AGE-02).
            </Alert>
            <RadioGroup value={resolucion} onChange={(e) => setResolucion(e.target.value)} sx={{ mb: 2 }}>
              <FormControlLabel
                value="reprogramar"
                control={<Radio />}
                label="Reprogramar en lote a la primera fecha con cupo de la misma especialidad (hasta 14 días). Las que no tengan lugar se cancelan."
              />
              <FormControlLabel
                value="cancelar"
                control={<Radio />}
                label="Cancelar en lote con el motivo de la novedad."
              />
            </RadioGroup>
            <Typography variant="subtitle2" component="h3">
              Fichas afectadas
            </Typography>
            <Box
              sx={{ maxHeight: 260, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <List dense disablePadding>
                {preview.afectadas.map((f) => (
                  <ListItem key={f.id} divider>
                    <ListItemText
                      primary={`${f.codigo} · ${f.paciente}`}
                      secondary={`${formatDate(f.fecha)} ${f.hora} · ${f.medico} · ${f.canal === 'web' ? 'Web' : 'Ventanilla'}`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={() => (preview ? setPreview(null) : onClose(false))} color="inherit" disabled={busy}>
          {preview ? 'Volver' : 'Cancelar'}
        </Button>
        <Button
          variant="contained"
          color={preview ? 'warning' : 'primary'}
          onClick={preview ? confirmCreate : next}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {preview
            ? resolucion === 'reprogramar'
              ? 'Registrar y reprogramar'
              : 'Registrar y cancelar fichas'
            : 'Continuar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
