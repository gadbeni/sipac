import { Controller } from 'react-hook-form';
import { Checkbox, FormControl, FormControlLabel, FormHelperText, Switch } from '@mui/material';

/** Casilla o interruptor (`variant="switch"`) controlado. */
export default function FormCheckbox({ name, control, label, helperText, variant = 'checkbox', disabled }) {
  const Control = variant === 'switch' ? Switch : Checkbox;
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FormControl error={Boolean(fieldState.error)}>
          <FormControlLabel
            control={
              <Control
                checked={Boolean(field.value)}
                onChange={(e) => field.onChange(e.target.checked)}
                onBlur={field.onBlur}
                slotProps={{ input: { ref: field.ref } }}
                disabled={disabled}
              />
            }
            label={label}
            sx={{ minHeight: 44 }}
          />
          {(fieldState.error || helperText) && (
            <FormHelperText sx={{ mt: -0.5 }}>{fieldState.error?.message || helperText}</FormHelperText>
          )}
        </FormControl>
      )}
    />
  );
}
