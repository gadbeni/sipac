import { Controller } from 'react-hook-form';
import { TextField } from '@mui/material';

/** TextField controlado por React Hook Form; muestra el mensaje de Zod como ayuda. */
export default function FormTextField({
  name,
  control,
  label,
  helperText,
  rules,
  transform,
  slotProps,
  ...rest
}) {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          value={field.value ?? ''}
          onChange={(e) => field.onChange(transform ? transform(e.target.value) : e.target.value)}
          inputRef={field.ref}
          label={label}
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message || helperText}
          slotProps={slotProps}
          {...rest}
        />
      )}
    />
  );
}
