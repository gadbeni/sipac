import { Button, CircularProgress, InputAdornment, MenuItem, Stack, TextField } from '@mui/material';
import Search from '@mui/icons-material/Search';
import MyLocation from '@mui/icons-material/MyLocation';
import LocationOff from '@mui/icons-material/LocationOff';
import FilterAltOff from '@mui/icons-material/FilterAltOff';

/**
 * Búsqueda + municipio + tipo + "Usar mi ubicación". Controlado: `value = { q, municipio, tipo }`.
 */
export default function CenterFilters({ value, onChange, facets, geo, onClear, dense = false }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const active = Boolean(value.q || value.municipio || value.tipo);
  return (
    <Stack
      direction={{ xs: 'column', md: dense ? 'column' : 'row' }}
      spacing={1.5}
      sx={{ alignItems: { md: dense ? 'stretch' : 'center' } }}
    >
      <TextField
        value={value.q}
        onChange={set('q')}
        placeholder="Buscar por nombre, municipio o dirección"
        size={dense ? 'small' : 'medium'}
        sx={{ flex: 2 }}
        slotProps={{
          htmlInput: { 'aria-label': 'Buscar centro de salud', enterKeyHint: 'search' },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          },
        }}
      />
      <Stack direction="row" spacing={1.5} sx={{ flex: 2, minWidth: 0 }}>
        <TextField
          select
          label="Municipio"
          value={value.municipio}
          onChange={set('municipio')}
          size={dense ? 'small' : 'medium'}
          sx={{ flex: 1, minWidth: 0 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {facets?.municipios.map((m) => (
            <MenuItem key={m.value} value={m.value}>
              {m.value} ({m.n})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Tipo"
          value={value.tipo}
          onChange={set('tipo')}
          size={dense ? 'small' : 'medium'}
          sx={{ flex: 1, minWidth: 0 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {facets?.tipos.map((t) => (
            <MenuItem key={t.value} value={t.value}>
              {t.label} ({t.n})
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ flexShrink: 0, flexWrap: 'wrap' }}>
        {geo &&
          (geo.position ? (
            <Button onClick={geo.clear} startIcon={<LocationOff />} color="inherit">
              Quitar ubicación
            </Button>
          ) : (
            <Button
              onClick={geo.request}
              startIcon={geo.loading ? <CircularProgress size={16} /> : <MyLocation />}
              disabled={geo.loading}
              variant="outlined"
            >
              {geo.loading ? 'Ubicando…' : 'Usar mi ubicación'}
            </Button>
          ))}
        {active && onClear && (
          <Button onClick={onClear} startIcon={<FilterAltOff />} color="inherit">
            Limpiar filtros
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
