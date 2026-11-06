/** Alta / edición de usuario del personal (admin central). */
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  useMediaQuery,
} from '@mui/material';
import FormTextField from '@/components/forms/FormTextField';
import FormSelect from '@/components/forms/FormSelect';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { userService } from '@/services/userService';
import { isAppError } from '@/services/errors';
import { ROLES } from '@/config/constants';

const toForm = (u) => ({
  username: u?.username ?? '',
  nombre: u?.nombre ?? '',
  email: u?.email ?? '',
  rol: u?.rol ?? 'recepcionista',
  centroId: u?.centroId ?? '',
  medicoId: u?.medicoId ?? '',
  password: '',
});

export default function UserFormDialog({ open, user, onClose, onSaved }) {
  const { session } = useAuth();
  const notify = useNotify();
  const fullScreen = useMediaQuery((t) => t.breakpoints.down('sm'));
  const editing = Boolean(user);
  const options = useMemo(() => userService.formOptions(session), [session]);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm({ defaultValues: toForm(user) });
  const rol = useWatch({ control, name: 'rol' });

  useEffect(() => {
    if (open) reset(toForm(user));
  }, [open, user, reset]);

  const submit = handleSubmit(async (v) => {
    const values = { ...v, centroId: v.centroId || null, medicoId: v.medicoId || null };
    try {
      const saved = editing
        ? await userService.update(session, user.id, values)
        : await userService.create(session, values);
      notify.success(editing ? 'Usuario actualizado.' : 'Usuario creado.');
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
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="user-form-title"
    >
      <DialogTitle id="user-form-title">{editing ? `Editar ${user.nombre}` : 'Nuevo usuario'}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} component="form" id="user-form" noValidate onSubmit={submit}>
          <Grid size={12}>
            <FormTextField name="nombre" control={control} label="Nombre completo" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormTextField
              name="username"
              control={control}
              label="Usuario"
              transform={(x) => x.toLowerCase().replace(/\s/g, '')}
              slotProps={{ htmlInput: { autoCapitalize: 'none' } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormTextField name="email" control={control} label="Correo" type="email" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormSelect
              name="rol"
              control={control}
              label="Rol"
              options={Object.entries(ROLES).map(([value, label]) => ({ value, label }))}
              disabled={editing && user.id === session.usuarioId}
            />
          </Grid>
          {['admin_centro', 'recepcionista', 'responsable_medico'].includes(rol) && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormSelect
                name="centroId"
                control={control}
                label="Centro"
                options={options.centros}
                placeholder="Seleccione"
              />
            </Grid>
          )}
          {rol === 'medico' && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormSelect
                name="medicoId"
                control={control}
                label="Profesional"
                options={options.medicos}
                placeholder="Seleccione"
                helperText="Opera en los centros donde está vinculado."
              />
            </Grid>
          )}
          {rol === 'admin_central' && (
            <Grid size={12}>
              <Alert severity="info">El administrador central accede a todos los centros.</Alert>
            </Grid>
          )}
          {!editing && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormTextField
                name="password"
                control={control}
                label="Contraseña inicial"
                type="text"
                helperText="Mínimo 8 caracteres, con letras y números."
                autoComplete="new-password"
              />
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="user-form"
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {editing ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
