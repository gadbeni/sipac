/** Vincular un profesional existente al centro o editar su vínculo (especialidades y cargo). */
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import FormTextField from '@/components/forms/FormTextField';
import { SpecialtiesField } from './DoctorFormDialog';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { doctorAdminService } from '@/services/doctorAdminService';
import { isAppError } from '@/services/errors';

export default function LinkDialog({ open, doctor, link, onClose, onSaved }) {
  const { session } = useAuth();
  const notify = useNotify();
  const options = useMemo(() => doctorAdminService.catalogOptions(), []);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { especialidadIds: [], cargo: 'Planta' } });
  useEffect(() => {
    if (open) reset({ especialidadIds: link?.especialidadIds || [], cargo: link?.cargo || 'Planta' });
  }, [open, link, reset]);
  const submit = handleSubmit(async (v) => {
    try {
      if (link) await doctorAdminService.updateLink(session, link.id, v);
      else await doctorAdminService.linkToCenter(session, doctor.id, v);
      notify.success(link ? 'Vínculo actualizado.' : `${doctor.nombre} vinculado al centro.`);
      onSaved?.();
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
      maxWidth="xs"
      aria-labelledby="link-title"
    >
      <DialogTitle id="link-title">
        {link ? 'Editar vínculo con el centro' : `Vincular a ${doctor?.nombre}`}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} component="form" id="link-form" noValidate onSubmit={submit}>
          {!link && (
            <Typography variant="body2" color="text.secondary">
              Tendrá agenda propia en este centro, independiente de los otros centros donde trabaja
              (RN-MC-04).
            </Typography>
          )}
          <SpecialtiesField
            control={control}
            name="especialidadIds"
            label="Especialidades en este centro"
            options={options}
          />
          <FormTextField name="cargo" control={control} label="Cargo" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="link-form"
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {link ? 'Guardar' : 'Vincular'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
