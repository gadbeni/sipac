import { Box, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import TrendingUp from '@mui/icons-material/TrendingUp';
import TrendingDown from '@mui/icons-material/TrendingDown';
import TrendingFlat from '@mui/icons-material/TrendingFlat';

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('es-BO') : v);

/**
 * Indicador numérico. `delta` (número) muestra la variación con icono y texto;
 * `deltaGood: 'up' | 'down'` indica qué dirección es positiva (p. ej. ausentismo → 'down').
 */
export default function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  tone = 'primary',
  helper,
  delta,
  deltaLabel = 'vs. ayer',
  deltaGood = 'up',
  loading = false,
  onClick,
}) {
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const good = dir === 'flat' ? 'neutral' : dir === deltaGood ? 'success' : 'error';
  const TrendIcon = { up: TrendingUp, down: TrendingDown, flat: TrendingFlat }[dir];

  return (
    <Card
      sx={{
        height: '100%',
        ...(onClick && { cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }),
      }}
      onClick={onClick}
    >
      <CardContent sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', '&:last-child': { pb: 2 } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {label}
          </Typography>
          {loading ? (
            <Skeleton width="60%" height={44} />
          ) : (
            <Typography
              component="p"
              sx={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}
            >
              {fmt(value)}
              {unit && (
                <Typography
                  component="span"
                  sx={{ fontSize: '1rem', fontWeight: 500, ml: 0.5 }}
                  color="text.secondary"
                >
                  {unit}
                </Typography>
              )}
            </Typography>
          )}
          {!loading && typeof delta === 'number' && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.5 }}>
              <Box
                component="span"
                sx={(t) => ({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                  px: 0.75,
                  borderRadius: 1,
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  bgcolor: t.palette.status[good].bg,
                  color: t.palette.status[good].fg,
                })}
              >
                <TrendIcon sx={{ fontSize: 16 }} aria-hidden />
                {delta > 0 ? '+' : ''}
                {fmt(delta)}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {deltaLabel}
              </Typography>
            </Stack>
          )}
          {helper && !loading && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {helper}
            </Typography>
          )}
        </Box>
        {Icon && (
          <Box
            aria-hidden
            sx={(t) => ({
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: t.palette.status[tone]?.bg,
              color: t.palette.status[tone]?.fg,
            })}
          >
            <Icon />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
