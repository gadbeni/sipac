/** Emitir ficha de ventanilla para un paciente presente (RN-APR-07, flujo F5). */
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import FormTextField from '@/components/forms/FormTextField';
import FormSelect from '@/components/forms/FormSelect';
import FormDatePicker from '@/components/forms/FormDatePicker';
import BlockPicker from '@/components/operations/BlockPicker';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { useAsync } from '@/hooks/useAsync';
import { appointmentService } from '@/services/appointmentService';
import { isAppError } from '@/services/errors';
import { TIPOS_DOCUMENTO } from '@/config/constants';
import { today } from '@/utils/dates';

const EMPTY = {
  tipoDocumento: 'CI',
  numeroDocumento: '',
  complemento: '',
  nombres: '',
  apellidos: '',
  fechaNacimiento: '',
  sexo: '',
  telefono: '',
};

export default function WalkInDialog({ open, onClose }) {
  const { session } = useAuth();
  const notify = useNotify();
  const full = useMediaQuery((t) => t.breakpoints.down('sm'));
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { isSubmitting },
  } = useForm({ defaultValues: EMPTY });
  const [especialidadId, setEspecialidadId] = useState('');
  const [horarioId, setHorarioId] = useState(null);
  const [preferente, setPreferente] = useState(false);
  const tipo = useWatch({ control, name: 'tipoDocumento' });
  const doc = useWatch({ control, name: 'numeroDocumento' });
  const compl = useWatch({ control, name: 'complemento' });
  const optsQ = useAsync(
    () => (open ? appointmentService.walkInOptions(session, especialidadId) : null),
    [open, session.activeCenterId, especialidadId],
    { watch: ['fichas'] },
  );
  const opts = optsQ.data || { especialidades: [], bloques: [] };
  const existing = useMemo(
    () =>
      open && doc?.length >= 5
        ? appointmentService.findPatient(session, {
            tipoDocumento: tipo,
            numeroDocumento: doc,
            complemento: compl,
          })
        : null,
    [open, session, tipo, doc, compl],
  );

  useEffect(() => {
    if (open) {
      reset(EMPTY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEspecialidadId('');
      setHorarioId(null);
      setPreferente(false);
    }
  }, [open, reset]);

  useEffect(() => {
    if (existing) {
      for (const k of ['nombres', 'apellidos', 'fechaNacimiento', 'telefono'])
        setValue(
          k,
          k === 'telefono' ? (existing.telefono || '').replace(/^\+591\s?/, '') : existing[k] || '',
        );
      setValue('sexo', existing.sexo || '');
    }
  }, [existing, setValue]);

  const submit = handleSubmit(async (v) => {
    try {
      const f = await appointmentService.issueWalkIn(session, {
        paciente: v,
        horarioId,
        prioridad: preferente ? 'preferente' : 'normal',
      });
      notify.success(
        `Ficha ${f.codigoVisible} emitida · hora estimada ${f.horaEstimada}. El paciente quedó en sala de espera.`,
      );
      onClose();
    } catch (e) {
      if (isAppError(e) && e.details?.fields)
        for (const [n, m] of Object.entries(e.details.fields)) setError(n, { type: 'server', message: m });
      notify.error(e);
    }
  });

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="md"
      fullScreen={full}
      aria-labelledby="walkin-title"
    >
      <DialogTitle id="walkin-title">Emitir ficha de ventanilla (hoy)</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3} component="form" id="walkin-form" noValidate onSubmit={submit}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
              Paciente
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormSelect
                  name="tipoDocumento"
                  control={control}
                  label="Tipo de documento"
                  options={Object.entries(TIPOS_DOCUMENTO).map(([value, label]) => ({ value, label }))}
                />
              </Grid>
              <Grid size={{ xs: 8, sm: 4 }}>
                <FormTextField
                  name="numeroDocumento"
                  control={control}
                  label="Número"
                  transform={(x) => x.toUpperCase().replace(/[\s-]/g, '')}
                />
              </Grid>
              <Grid size={{ xs: 4, sm: 2 }}>
                <FormTextField
                  name="complemento"
                  control={control}
                  label="Compl."
                  transform={(x) => x.toUpperCase()}
                />
              </Grid>
              {existing && (
                <Grid size={12}>
                  {existing.bloqueado ? (
                    <Alert severity="error">
                      Paciente bloqueado por inasistencia. Habilítelo en Pacientes antes de emitir una ficha.
                    </Alert>
                  ) : (
                    <Alert severity="success">
                      Paciente registrado: {existing.nombres} {existing.apellidos}. Se usarán sus datos
                      existentes.
                    </Alert>
                  )}
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField
                  name="nombres"
                  control={control}
                  label="Nombres"
                  disabled={Boolean(existing)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField
                  name="apellidos"
                  control={control}
                  label="Apellidos"
                  disabled={Boolean(existing)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormDatePicker
                  name="fechaNacimiento"
                  control={control}
                  label="Nacimiento"
                  maxDate={today()}
                  disabled={Boolean(existing)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormTextField
                  name="telefono"
                  control={control}
                  label="Teléfono"
                  transform={(x) => x.replace(/\D/g, '').slice(0, 8)}
                  disabled={Boolean(existing)}
                />
              </Grid>
            </Grid>
            <FormControlLabel
              sx={{ mt: 1, minHeight: 44 }}
              control={<Switch checked={preferente} onChange={(e) => setPreferente(e.target.checked)} />}
              label="Atención preferente (adulto mayor, gestante, discapacidad)"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
              Atención
            </Typography>
            <Stack spacing={2}>
              <TextField
                select
                label="Especialidad"
                value={opts.especialidades.some((o) => o.value === especialidadId) ? especialidadId : ''}
                onChange={(e) => {
                  setEspecialidadId(e.target.value);
                  setHorarioId(null);
                }}
              >
                {opts.especialidades.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              {especialidadId && (
                <BlockPicker
                  bloques={opts.bloques}
                  value={horarioId}
                  onChange={setHorarioId}
                  canal="ventanilla"
                />
              )}
              <Divider />
              <Typography variant="caption" color="text.secondary">
                Las fichas de ventanilla pueden usar todos los cupos del bloque (también los reservados para
                ventanilla). El paciente queda registrado en sala de espera.
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="walkin-form"
          variant="contained"
          disabled={isSubmitting || !horarioId || existing?.bloqueado}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Emitir ficha
        </Button>
      </DialogActions>
    </Dialog>
  );
}
