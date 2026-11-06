/** Pasos del asistente "Solicitar ficha" (Épica 5). */
import { useMemo } from 'react';
import dayjs from 'dayjs';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputAdornment,
  Radio,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { useWatch } from 'react-hook-form';
import CheckCircle from '@mui/icons-material/CheckCircle';
import PersonSearch from '@mui/icons-material/PersonSearch';
import Groups from '@mui/icons-material/Groups';
import SelectedCenterBanner from '@/components/centers/SelectedCenterBanner';
import AvailabilitySummary from '@/components/portal/AvailabilitySummary';
import SpecialtyIcon from '@/components/portal/SpecialtyIcon';
import EmptyState from '@/components/common/EmptyState';
import FormTextField from '@/components/forms/FormTextField';
import FormSelect from '@/components/forms/FormSelect';
import FormDatePicker from '@/components/forms/FormDatePicker';
import FormCheckbox from '@/components/forms/FormCheckbox';
import { TIPOS_DOCUMENTO, DIAS_SEMANA } from '@/config/constants';
import { addDays, ageAt, formatDate, formatDateLong, isValidDate, isoWeekday, today } from '@/utils/dates';

const ISO = 'YYYY-MM-DD';
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Tarjeta seleccionable accesible (role radio). */
function OptionCard({ selected, disabled, onClick, children, label }) {
  return (
    <Card
      sx={{
        height: '100%',
        borderColor: selected ? 'primary.main' : 'divider',
        boxShadow: selected ? (t) => `0 0 0 1px ${t.palette.primary.main}` : undefined,
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <CardActionArea
        role="radio"
        aria-checked={selected}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        sx={{
          height: '100%',
          p: 2,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          justifyContent: 'flex-start',
        }}
      >
        <Radio
          checked={selected}
          tabIndex={-1}
          disableRipple
          sx={{ p: 0, mt: '2px' }}
          slotProps={{ input: { 'aria-hidden': true } }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      </CardActionArea>
    </Card>
  );
}

// ------------------------------------------------------------------ 1. Centro
export function StepCenter() {
  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">
        Las fichas se solicitan en un centro de salud. Puede cambiarlo antes de continuar.
      </Typography>
      <SelectedCenterBanner title="Centro de salud elegido" />
    </Stack>
  );
}

// ------------------------------------------------------------------ 2. Especialidad
export function StepSpecialty({ specialties, loading, value, onChange }) {
  if (loading) return <Skeleton variant="rounded" height={220} />;
  if (!specialties?.length)
    return <EmptyState compact title="Este centro no tiene especialidades disponibles" />;
  return (
    <Grid container spacing={2} role="radiogroup" aria-label="Especialidad">
      {specialties.map((e) => {
        const disabled = !e.aceptaSolicitudesPublicas || !e.proxima;
        return (
          <Grid key={e.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <OptionCard
              selected={value === e.id}
              disabled={disabled}
              onClick={() => onChange(e)}
              label={e.nombre}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <SpecialtyIcon name={e.icono} color="primary" fontSize="small" aria-hidden />
                <Typography sx={{ fontWeight: 700 }}>{e.nombre}</Typography>
              </Stack>
              <AvailabilitySummary especialidad={e} />
            </OptionCard>
          </Grid>
        );
      })}
    </Grid>
  );
}

// ------------------------------------------------------------------ 3. Fecha
export function StepDate({ dates, loading, value, onChange, maxDays = 14, notice }) {
  const enabled = useMemo(() => new Map((dates || []).map((d) => [d.fecha, d])), [dates]);
  if (loading) return <Skeleton variant="rounded" height={320} />;
  if (!dates?.length) {
    return (
      <EmptyState
        compact
        title="No hay fechas disponibles"
        description="Todas las fichas por internet de los próximos días están ocupadas. Pruebe con otra especialidad o acérquese al centro."
      />
    );
  }
  return (
    <Stack spacing={2}>
      {notice && <Alert severity="warning">{notice}</Alert>}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <DateCalendar
              value={value ? dayjs(value) : null}
              onChange={(d) => d && onChange(d.format(ISO))}
              minDate={dayjs(today())}
              maxDate={dayjs(addDays(today(), maxDays))}
              shouldDisableDate={(d) => !enabled.has(d.format(ISO))}
              views={['day']}
              sx={{
                width: '100%',
                maxWidth: 360,
                '& .MuiPickerDay-root.Mui-disabled:not(.Mui-selected):not(.MuiPickerDay-fillerCell)': {
                  textDecoration: 'line-through',
                },
              }}
            />
          </Card>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Las fechas tachadas no tienen fichas por internet: feriados, días sin atención, agenda bloqueada o
            cupos agotados.
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
            Fechas con fichas disponibles
          </Typography>
          <Stack
            direction="row"
            sx={{ flexWrap: 'wrap', gap: 1 }}
            role="radiogroup"
            aria-label="Fechas disponibles"
          >
            {dates.map((d) => (
              <Chip
                key={d.fecha}
                role="radio"
                aria-checked={value === d.fecha}
                clickable
                onClick={() => onChange(d.fecha)}
                color={value === d.fecha ? 'primary' : 'default'}
                variant={value === d.fecha ? 'filled' : 'outlined'}
                label={`${DIAS_SEMANA[isoWeekday(d.fecha)].slice(0, 3)} ${formatDate(d.fecha).slice(0, 5)} · ${d.publicosLibres} ${d.publicosLibres === 1 ? 'ficha' : 'fichas'}`}
                sx={{ height: 40, fontWeight: 600 }}
              />
            ))}
          </Stack>
          {value && enabled.get(value) && (
            <Alert severity="success" icon={<CheckCircle />} sx={{ mt: 2 }}>
              {cap(formatDateLong(value))}: {enabled.get(value).publicosLibres} fichas por internet
              disponibles.
            </Alert>
          )}
        </Grid>
      </Grid>
    </Stack>
  );
}

// ------------------------------------------------------------------ 4. Profesional
export function StepDoctor({ automatic, doctors, loading, value, onChange, notice }) {
  if (automatic) {
    return (
      <Alert severity="info" icon={<Groups />}>
        En esta especialidad el profesional será asignado por el establecimiento.
      </Alert>
    );
  }
  if (loading) return <Skeleton variant="rounded" height={160} />;
  return (
    <Stack spacing={2}>
      {notice && <Alert severity="warning">{notice}</Alert>}
      <Grid container spacing={2} role="radiogroup" aria-label="Profesional">
        <Grid size={{ xs: 12, sm: 6 }}>
          <OptionCard selected={!value} onClick={() => onChange('')} label="Cualquier profesional disponible">
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <PersonSearch color="primary" fontSize="small" aria-hidden />
              <Typography sx={{ fontWeight: 700 }}>Cualquier profesional disponible</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Recomendado: el centro le asigna el profesional con más fichas libres.
            </Typography>
          </OptionCard>
        </Grid>
        {(doctors || []).map((d) => (
          <Grid key={d.id} size={{ xs: 12, sm: 6 }}>
            <OptionCard selected={value === d.id} onClick={() => onChange(d.id)} label={d.nombre}>
              <Typography sx={{ fontWeight: 700 }}>{d.nombre}</Typography>
              <Typography variant="body2" color="text.secondary">
                {d.bloques.map((b) => `${b.horaInicio} a ${b.horaFin}`).join(' · ')}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600, color: 'success.main' }}>
                {d.publicosLibres} {d.publicosLibres === 1 ? 'ficha disponible' : 'fichas disponibles'}
              </Typography>
            </OptionCard>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

// ------------------------------------------------------------------ 5. Datos del paciente
export function StepPatient({
  control,
  notice,
  remembered,
  remember,
  onRememberChange,
  onOtherPatient,
  onForget,
}) {
  const tipo = useWatch({ control, name: 'tipoDocumento' });
  const nacimiento = useWatch({ control, name: 'fechaNacimiento' });
  const menor = isValidDate(nacimiento) && nacimiento <= today() && ageAt(nacimiento) < 18;
  return (
    <Stack spacing={2}>
      {notice && <Alert severity="error">{notice}</Alert>}
      <Alert severity="info">
        Use datos ficticios: este es un prototipo de demostración. No se solicita información clínica.
      </Alert>
      {remembered && (
        <Alert severity="success" icon={<PersonSearch />}>
          Cargamos los datos guardados en este dispositivo de{' '}
          <strong>
            {remembered.nombres} {remembered.apellidos}
          </strong>
          . Revíselos antes de continuar.
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
            <Button color="inherit" size="small" onClick={onOtherPatient}>
              Otro paciente
            </Button>
            <Button color="inherit" size="small" onClick={onForget}>
              Olvidar mis datos
            </Button>
          </Stack>
        </Alert>
      )}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 5 }}>
          <FormSelect
            name="tipoDocumento"
            control={control}
            label="Tipo de documento"
            options={Object.entries(TIPOS_DOCUMENTO).map(([value, label]) => ({ value, label }))}
          />
        </Grid>
        <Grid size={{ xs: tipo === 'CI' ? 8 : 12, sm: tipo === 'CI' ? 5 : 7 }}>
          <FormTextField
            name="numeroDocumento"
            control={control}
            label="Número de documento"
            autoComplete="off"
            transform={(v) => v.toUpperCase().replace(/[\s-]/g, '')}
            slotProps={{ htmlInput: { maxLength: 15 } }}
          />
        </Grid>
        {tipo === 'CI' && (
          <Grid size={{ xs: 4, sm: 2 }}>
            <FormTextField
              name="complemento"
              control={control}
              label="Compl."
              helperText="Opcional"
              transform={(v) => v.toUpperCase()}
              slotProps={{ htmlInput: { maxLength: 3, 'aria-label': 'Complemento (opcional)' } }}
            />
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormTextField name="nombres" control={control} label="Nombres" autoComplete="given-name" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormTextField name="apellidos" control={control} label="Apellidos" autoComplete="family-name" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormDatePicker
            name="fechaNacimiento"
            control={control}
            label="Fecha de nacimiento"
            maxDate={today()}
            minDate={addDays(today(), -120 * 366)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormSelect
            name="sexo"
            control={control}
            label="Sexo (opcional)"
            options={[
              { value: '', label: 'Prefiero no indicar' },
              { value: 'F', label: 'Femenino' },
              { value: 'M', label: 'Masculino' },
            ]}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormTextField
            name="telefono"
            control={control}
            label="Teléfono o celular"
            type="tel"
            autoComplete="tel-national"
            transform={(v) => v.replace(/[^\d]/g, '').slice(0, 8)}
            helperText="Para avisos del centro. 8 dígitos."
            slotProps={{
              input: { startAdornment: <InputAdornment position="start">+591</InputAdornment> },
              htmlInput: { inputMode: 'numeric' },
            }}
          />
        </Grid>
      </Grid>
      {menor && (
        <Alert severity="warning">
          El paciente es menor de edad: deberá presentarse acompañado de su madre, padre o tutor.
        </Alert>
      )}
      <FormCheckbox
        name="acepta"
        control={control}
        label="Declaro que los datos son correctos y entiendo que, si obtengo ficha y no me presento, mi documento quedará bloqueado para nuevas fichas hasta que el centro lo habilite."
      />
      <Box>
        <FormControlLabel
          control={<Checkbox checked={remember} onChange={(e) => onRememberChange(e.target.checked)} />}
          label="Recordar estos datos en este dispositivo para la próxima solicitud"
          sx={{ minHeight: 44 }}
        />
        <FormHelperText sx={{ mt: -0.5 }}>
          Se guardan solo en este navegador. No lo marque si usa un equipo compartido.
        </FormHelperText>
      </Box>
    </Stack>
  );
}

// ------------------------------------------------------------------ 6. Confirmar
export function StepConfirm({ summary, error, onRetryStep }) {
  return (
    <Stack spacing={2}>
      {error && (
        <Alert
          severity="error"
          action={
            error.step != null && (
              <Button color="inherit" size="small" onClick={() => onRetryStep(error.step)}>
                {error.stepLabel}
              </Button>
            )
          }
        >
          {error.message}
        </Alert>
      )}
      <Card>
        <CardContent>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' },
              rowGap: 1,
              columnGap: 2,
            }}
          >
            {summary.map(([k, v]) => (
              <Box key={k} sx={{ display: 'contents' }}>
                <Typography component="dt" variant="body2" color="text.secondary">
                  {k}
                </Typography>
                <Typography
                  component="dd"
                  sx={{ m: 0, fontWeight: 500, mb: { xs: 1, sm: 0 }, overflowWrap: 'anywhere' }}
                >
                  {v}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
      <Alert severity="warning">
        Al confirmar se registrará una <strong>solicitud</strong>. Todavía no será una ficha: el centro la
        revisará y, si hay cupo, le asignará número y hora estimada.
      </Alert>
    </Stack>
  );
}
