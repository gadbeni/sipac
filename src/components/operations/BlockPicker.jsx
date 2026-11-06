import {
  Box,
  Chip,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Radio,
  Typography,
} from '@mui/material';
import AutoAwesome from '@mui/icons-material/AutoAwesome';

/**
 * Selección de bloque (médico/franja) con cupos en tiempo real.
 * `canal`: 'web' cuenta solo cupos públicos; 'ventanilla' todos. `auto` agrega "Asignación automática".
 */
export default function BlockPicker({
  bloques,
  value,
  onChange,
  canal = 'web',
  auto = false,
  autoLabel = 'Asignación automática (recomendado)',
  medicoPreferidoId,
}) {
  const free = (b) => (canal === 'web' ? (b.publicosLibres ?? b.libres) : b.libres);
  if (!bloques.length) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        No hay bloques de atención disponibles para esa fecha.
      </Typography>
    );
  }
  return (
    <List role="radiogroup" aria-label="Bloque de atención" disablePadding>
      {auto && (
        <ListItemButton
          role="radio"
          aria-checked={value === ''}
          selected={value === ''}
          onClick={() => onChange('')}
          sx={{ mb: 0.5, border: 1, borderColor: value === '' ? 'primary.main' : 'divider' }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Radio
              edge="start"
              checked={value === ''}
              tabIndex={-1}
              disableRipple
              slotProps={{ input: { 'aria-hidden': true } }}
            />
          </ListItemIcon>
          <ListItemText
            primary={autoLabel}
            secondary="Médico preferido si tiene cupo; si no, el bloque con más cupos libres."
          />
          <AutoAwesome color="primary" fontSize="small" aria-hidden />
        </ListItemButton>
      )}
      {bloques.map((b) => {
        const libres = free(b);
        const disabled = b.bloqueado || libres <= 0;
        return (
          <ListItemButton
            key={b.horarioId}
            role="radio"
            aria-checked={value === b.horarioId}
            selected={value === b.horarioId}
            disabled={disabled}
            onClick={() => onChange(b.horarioId)}
            sx={{
              mb: 0.5,
              border: 1,
              borderColor: value === b.horarioId ? 'primary.main' : 'divider',
              alignItems: 'flex-start',
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
              <Radio
                edge="start"
                checked={value === b.horarioId}
                tabIndex={-1}
                disableRipple
                slotProps={{ input: { 'aria-hidden': true } }}
              />
            </ListItemIcon>
            <ListItemText
              primary={
                <>
                  {b.medico}
                  {medicoPreferidoId && b.medicoId === medicoPreferidoId && (
                    <Chip size="small" label="Preferido" sx={{ ml: 1 }} />
                  )}
                </>
              }
              secondary={`${b.horaInicio} a ${b.horaFin} · ${b.consultorio || ''}${b.bloqueado ? ` · Bloqueado: ${b.motivoBloqueo}` : ''}`}
            />
            <Box sx={{ textAlign: 'right', ml: 1 }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  color: libres > 0 ? 'success.main' : 'error.main',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {libres}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {canal === 'web' ? 'cupos web' : 'cupos'}
              </Typography>
            </Box>
          </ListItemButton>
        );
      })}
    </List>
  );
}
