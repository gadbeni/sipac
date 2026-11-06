import { Controller } from 'react-hook-form';
import dayjs from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

const ISO = 'YYYY-MM-DD';

/**
 * Selector de fecha DD/MM/YYYY. El valor del formulario es un string 'YYYY-MM-DD'
 * (mismo formato que el modelo de datos), no un objeto Day.js.
 * `minDate`/`maxDate` aceptan 'YYYY-MM-DD'; `shouldDisableDate(iso)` recibe el string.
 */
export default function FormDatePicker({
  name,
  control,
  label,
  helperText,
  minDate,
  maxDate,
  shouldDisableDate,
  disabled,
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <DatePicker
          label={label}
          format="DD/MM/YYYY"
          value={field.value ? dayjs(field.value) : null}
          onChange={(d) => field.onChange(d && d.isValid() ? d.format(ISO) : d ? 'invalida' : '')}
          minDate={minDate ? dayjs(minDate) : undefined}
          maxDate={maxDate ? dayjs(maxDate) : undefined}
          shouldDisableDate={shouldDisableDate ? (d) => shouldDisableDate(d.format(ISO)) : undefined}
          disabled={disabled}
          slotProps={{
            textField: {
              fullWidth: true,
              inputRef: field.ref,
              onBlur: field.onBlur,
              error: Boolean(fieldState.error),
              helperText: fieldState.error?.message || helperText,
            },
          }}
        />
      )}
    />
  );
}
