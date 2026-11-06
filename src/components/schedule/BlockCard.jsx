import { Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import Block from '@mui/icons-material/Block';

/** Bloque de agenda: franja, profesional y ocupación `ocupados/efectivos` (RN-AGE-03, calculada). */
export default function BlockCard({ b, compact = false, onClick }) {
  const pct = b.cuposEfectivos ? Math.min(100, Math.round((b.ocupados / b.cuposEfectivos) * 100)) : 0;
  const tone = b.bloqueado ? 'neutral' : pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'success';
  const label = `${b.horaInicio} a ${b.horaFin}, ${b.especialidad}, ${b.medico}: ${b.bloqueado ? `bloqueado (${b.motivoBloqueo})` : `${b.ocupados} de ${b.cuposEfectivos} cupos ocupados, ${b.publicosLibres} web libres`}`;
  return (
    <Box
      component={onClick ? 'button' : 'div'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label}
      sx={(t) => ({
        display: 'block',
        width: '100%',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        cursor: onClick ? 'pointer' : 'default',
        p: compact ? 1 : 1.25,
        borderRadius: 1.5,
        border: `1px solid ${t.palette.status[tone].border}`,
        borderLeftWidth: 4,
        bgcolor: b.bloqueado ? t.palette.status.neutral.bg : 'background.paper',
        '&:focus-visible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
      })}
    >
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 0.5, alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {b.horaInicio}–{b.horaFin}
        </Typography>
        <Chip size="small" label={b.codigoEsp} sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
      </Stack>
      <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.3, mt: 0.25 }} noWrap={compact}>
        {b.medico}
      </Typography>
      {!compact && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {b.especialidad} · {b.consultorio}
        </Typography>
      )}
      {b.bloqueado ? (
        <Typography
          variant="caption"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, fontWeight: 600 }}
        >
          <Block sx={{ fontSize: 14 }} aria-hidden /> {b.motivoBloqueo}
        </Typography>
      ) : (
        <>
          <LinearProgress
            variant="determinate"
            value={pct}
            color={tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : 'success'}
            aria-hidden
            sx={{ mt: 0.75, height: 6, borderRadius: 3 }}
          />
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.25, fontVariantNumeric: 'tabular-nums' }}
          >
            <strong>
              {b.ocupados}/{b.cuposEfectivos}
            </strong>{' '}
            ocupados · {b.publicosLibres} web libres{b.ajustado ? ' · cupos ajustados' : ''}
          </Typography>
        </>
      )}
    </Box>
  );
}
