/** Alta / edición de centro (admin central, RN-CEN-02). */
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import FormTextField from '@/components/forms/FormTextField';
import FormSelect from '@/components/forms/FormSelect';
import FormCheckbox from '@/components/forms/FormCheckbox';
import { centerSchema } from '@/services/schemas/centerSchema';
import { centerService, centerToForm } from '@/services/centerService';
import { isAppError } from '@/services/errors';
import { useNotify } from '@/context/NotifyContext';
import { useAuth } from '@/context/AuthContext';
import { DIAS_SEMANA, NIVELES_ATENCION, TIPOS_CENTRO } from '@/config/constants';

const toOptions = (obj) => Object.entries(obj).map(([value, label]) => ({ value, label }));

function DayRow({ control, index }) {
  const open = useWatch({ control, name: `horario.${index}.abierto` });
  return (
    <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <FormCheckbox name={`horario.${index}.abierto`} control={control} label={DIAS_SEMANA[index + 1]} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4 }}>
        <FormTextField
          name={`horario.${index}.apertura`}
          control={control}
          label="Apertura"
          type="time"
          size="small"
          disabled={!open}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4 }}>
        <FormTextField
          name={`horario.${index}.cierre`}
          control={control}
          label="Cierre"
          type="time"
          size="small"
          disabled={!open}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Grid>
    </Grid>
  );
}

export default function CenterFormDialog({ open, center, onClose, onSaved }) {
  const editing = Boolean(center);
  const notify = useNotify();
  const { session } = useAuth();
  const fullScreen = useMediaQuery((t) => t.breakpoints.down('md'));
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting, errors },
  } = useForm({
    resolver: zodResolver(centerSchema),
    defaultValues: centerToForm(center),
    mode: 'onTouched',
  });

  useEffect(() => {
    if (open) reset(centerToForm(center));
  }, [open, center, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      const saved = editing
        ? await centerService.update(session, center.id, values)
        : await centerService.create(session, values);
      notify.success(editing ? 'Centro actualizado.' : 'Centro creado.');
      onSaved?.(saved);
    } catch (e) {
      const fields = isAppError(e) && e.details?.fields;
      if (fields)
        for (const [name, message] of Object.entries(fields)) setError(name, { type: 'server', message });
      notify.error(e);
    }
  });

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      aria-labelledby="center-form-title"
    >
      <DialogTitle id="center-form-title">
        {editing ? `Editar ${center.nombre}` : 'Nuevo centro de salud'}
      </DialogTitle>
      <DialogContent dividers>
        <Box component="form" id="center-form" noValidate onSubmit={submit}>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
            Identificación
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <FormTextField name="nombre" control={control} label="Nombre" />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <FormTextField
                name="codigoCorto"
                control={control}
                label="Código corto"
                disabled={editing}
                helperText={editing ? 'No modificable' : 'Ej.: CSC'}
                transform={(v) => v.toUpperCase().slice(0, 3)}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <FormTextField
                name="codigo"
                control={control}
                label="Código"
                transform={(v) => v.toUpperCase()}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormSelect name="tipo" control={control} label="Tipo" options={toOptions(TIPOS_CENTRO)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormSelect
                name="nivelAtencion"
                control={control}
                label="Nivel de atención"
                options={toOptions(NIVELES_ATENCION)}
              />
            </Grid>
            <Grid size={12}>
              <FormTextField
                name="descripcion"
                control={control}
                label="Descripción (opcional)"
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
            Ubicación y contacto
          </Typography>
          <Grid container spacing={2}>
            <Grid size={12}>
              <FormTextField name="direccion" control={control} label="Dirección" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormTextField name="provincia" control={control} label="Provincia" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormTextField name="municipio" control={control} label="Municipio" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormTextField name="localidad" control={control} label="Localidad" />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormTextField
                name="latitud"
                control={control}
                label="Latitud"
                helperText="Ej.: -14.8336"
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <FormTextField
                name="longitud"
                control={control}
                label="Longitud"
                helperText="Ej.: -64.9006"
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormTextField name="telefono" control={control} label="Teléfono" type="tel" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormTextField name="email" control={control} label="Correo (opcional)" type="email" />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
            Horario general de atención
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Horario del establecimiento. Los horarios de cada médico se configuran en Horarios.
          </Typography>
          {errors.horario?.root?.message || errors.horario?.message ? (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {errors.horario?.root?.message || errors.horario?.message}
            </Alert>
          ) : null}
          <Stack spacing={1}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <DayRow key={i} control={control} index={i} />
            ))}
          </Stack>

          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1.5 }}>
            Solicitudes por internet
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormTextField
                name="diasAnticipacionMax"
                control={control}
                label="Días de anticipación máxima"
                type="number"
                helperText="Hasta cuántos días adelante se puede solicitar."
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormTextField
                name="cierreMismoDiaMin"
                control={control}
                label="Cierre para el mismo día (minutos)"
                type="number"
                helperText="Minutos antes del inicio del bloque."
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={isSubmitting} color="inherit">
          Cancelar
        </Button>
        <Button
          type="submit"
          form="center-form"
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {editing ? 'Guardar cambios' : 'Crear centro'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
