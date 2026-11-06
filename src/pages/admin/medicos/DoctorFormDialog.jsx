/** Alta de profesional con detección de documento existente (RN-MED-01) o edición de datos personales. */
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  useMediaQuery,
} from '@mui/material';
import FormTextField from '@/components/forms/FormTextField';
import FormSelect from '@/components/forms/FormSelect';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { doctorAdminService } from '@/services/doctorAdminService';
import { isAppError } from '@/services/errors';
import { TIPOS_DOCUMENTO } from '@/config/constants';

const EMPTY = {
  nombres: '',
  apellidos: '',
  tipoDocumento: 'CI',
  numeroDocumento: '',
  registroProfesional: '',
  especialidadIds: [],
  telefono: '',
  email: '',
  cargo: 'Planta',
};

function SpecialtiesField({ control, name, label, options, helperText }) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Autocomplete
          multiple
          options={options}
          value={options.filter((o) => (field.value || []).includes(o.value))}
          onChange={(_e, v) => field.onChange(v.map((o) => o.value))}
          getOptionLabel={(o) => o.label}
          isOptionEqualToValue={(a, b) => a.value === b.value}
          renderValue={(value, getItemProps) =>
            value.map((o, i) => (
              <Chip size="small" label={o.label} {...getItemProps({ index: i })} key={o.value} />
            ))
          }
          renderInput={(p) => (
            <TextField
              {...p}
              label={label}
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message || helperText}
            />
          )}
        />
      )}
    />
  );
}

export default function DoctorFormDialog({ open, doctor, onClose, onSaved, onLinkExisting }) {
  const { session } = useAuth();
  const notify = useNotify();
  const full = useMediaQuery((t) => t.breakpoints.down('sm'));
  const editing = Boolean(doctor);
  const options = useMemo(() => doctorAdminService.catalogOptions(), []);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm({ defaultValues: EMPTY });
  const tipo = useWatch({ control, name: 'tipoDocumento' });
  const doc = useWatch({ control, name: 'numeroDocumento' });
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    if (open)
      reset(
        doctor ? { ...EMPTY, ...doctor, telefono: doctor.telefono || '', email: doctor.email || '' } : EMPTY,
      );
  }, [open, doctor, reset]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open || editing) return setExisting(null);
    setExisting(doctorAdminService.findByDocument(session, { tipoDocumento: tipo, numeroDocumento: doc }));
  }, [open, editing, session, tipo, doc]);

  const yaEnCentro = existing?.centros.some((c) => c.centroId === session.activeCenterId && c.activo);

  const submit = handleSubmit(async (v) => {
    try {
      const saved = editing
        ? await doctorAdminService.updatePersonal(session, doctor.id, v)
        : await doctorAdminService.create(session, v);
      notify.success(editing ? 'Datos actualizados.' : 'Profesional registrado y vinculado al centro.');
      onSaved?.(saved);
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
      maxWidth="sm"
      fullScreen={full}
      aria-labelledby="doctor-form-title"
    >
      <DialogTitle id="doctor-form-title">
        {editing ? `Editar ${doctor.nombres} ${doctor.apellidos}` : 'Nuevo profesional'}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} component="form" id="doctor-form" noValidate onSubmit={submit}>
          <Grid size={{ xs: 12, sm: 5 }}>
            <FormSelect
              name="tipoDocumento"
              control={control}
              label="Tipo de documento"
              options={Object.entries(TIPOS_DOCUMENTO).map(([value, label]) => ({ value, label }))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 7 }}>
            <FormTextField
              name="numeroDocumento"
              control={control}
              label="Número de documento"
              transform={(x) => x.toUpperCase().replace(/[\s-]/g, '')}
              helperText={editing ? null : 'Primero se busca si ya está registrado en la red.'}
            />
          </Grid>
          {existing && (
            <Grid size={12}>
              <Alert
                severity={yaEnCentro ? 'info' : 'warning'}
                action={
                  !yaEnCentro && (
                    <Button color="inherit" size="small" onClick={() => onLinkExisting?.(existing)}>
                      Vincular a este centro
                    </Button>
                  )
                }
              >
                {existing.nombre} ({existing.registro}) ya está registrado
                {existing.centros.length
                  ? ` en: ${existing.centros.map((c) => `${c.nombre}${c.activo ? '' : ' (inactivo)'}`).join(', ')}`
                  : ''}
                .{' '}
                {yaEnCentro
                  ? 'Ya trabaja en este centro.'
                  : 'Vincúlelo en lugar de crear un registro duplicado.'}
              </Alert>
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormTextField name="nombres" control={control} label="Nombres" disabled={Boolean(existing)} />
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
            <FormTextField
              name="registroProfesional"
              control={control}
              label="Registro profesional"
              transform={(x) => x.toUpperCase()}
              disabled={Boolean(existing)}
            />
          </Grid>
          {!editing && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormTextField
                name="cargo"
                control={control}
                label="Cargo en el centro"
                disabled={Boolean(existing)}
              />
            </Grid>
          )}
          <Grid size={12}>
            <SpecialtiesField
              control={control}
              name="especialidadIds"
              label="Especialidades que ejerce"
              options={options}
              helperText={
                editing
                  ? 'Las especialidades en cada centro se configuran en su vínculo.'
                  : 'Se habilitarán en este centro.'
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormTextField
              name="telefono"
              control={control}
              label="Teléfono (opcional)"
              disabled={Boolean(existing)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormTextField
              name="email"
              control={control}
              label="Correo (opcional)"
              type="email"
              disabled={Boolean(existing)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="doctor-form"
          variant="contained"
          disabled={isSubmitting || Boolean(existing)}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {editing ? 'Guardar' : 'Registrar profesional'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { SpecialtiesField };
