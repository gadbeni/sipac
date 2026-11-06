import { Box, Stack, Typography } from '@mui/material';

/** Leyenda HTML (texto en color de texto; el color solo en la marca). */
export default function ChartLegend({ items }) {
  return (
    <Stack
      direction="row"
      component="ul"
      sx={{ listStyle: 'none', p: 0, m: 0, mt: 1.5, flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}
    >
      {items.map((it) => (
        <Stack key={it.label} component="li" direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Box
            aria-hidden
            sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: it.color, flexShrink: 0 }}
          />
          <Typography variant="body2" color="text.secondary">
            {it.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
