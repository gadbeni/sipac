import { Controller } from 'react-hook-form';
import { MenuItem, TextField } from '@mui/material';

/** Select controlado. `options`: [{ value, label, disabled? }]. */
export default function FormSelect({ name, control, label, options = [], helperText, placeholder, ...rest }) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          value={field.value ?? ''}
          inputRef={field.ref}
          select
          label={label}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message || helperText}
          {...rest}
        >
          {placeholder && (
            <MenuItem value="" disabled>
              {placeholder}
            </MenuItem>
          )}
          {options.map((o) => (
            <MenuItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      )}
    />
  );
}
