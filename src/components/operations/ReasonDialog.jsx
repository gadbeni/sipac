import { useEffect, useState } from 'react';
import { MenuItem, Stack, TextField } from '@mui/material';
import ConfirmDialog from '@/components/common/ConfirmDialog';

/** Confirmación que exige motivo (catálogo + detalle; "Otro" obliga a describir). RN-SOL-10. */
export default function ReasonDialog({
  open,
  title,
  message,
  motivos,
  confirmLabel = 'Confirmar',
  destructive = true,
  onConfirm,
  onClose,
}) {
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMotivo('');
      setDetalle('');
    }
  }, [open]);
  const invalid = !motivo || (motivo === 'Otro' && !detalle.trim());
  return (
    <ConfirmDialog
      open={open}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      destructive={destructive}
      confirmDisabled={invalid}
      onConfirm={() => onConfirm({ motivo, detalle })}
      onClose={onClose}
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField select label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
          {motivos.map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={motivo === 'Otro' ? 'Describa el motivo' : 'Detalle (opcional)'}
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          multiline
          minRows={2}
          required={motivo === 'Otro'}
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />
      </Stack>
    </ConfirmDialog>
  );
}
