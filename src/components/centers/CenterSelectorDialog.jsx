/**
 * Diálogo selector de centro (header, asistente, bloques "Seleccione un centro").
 * Búsqueda + filtros por municipio y tipo + orden por cercanía opcional.
 */
import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Radio,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import SearchOff from '@mui/icons-material/SearchOff';
import CenterFilters from './CenterFilters';
import OpenStatusChip from './OpenStatusChip';
import EmptyState from '@/components/common/EmptyState';
import { useAsync } from '@/hooks/useAsync';
import { useGeolocation } from '@/hooks/useGeolocation';
import { centerService } from '@/services/centerService';
import { filterCenters } from '@/services/rules/centers';
import { TIPOS_CENTRO } from '@/config/constants';
import { formatDistance } from '@/utils/geo';

const EMPTY = { q: '', municipio: '', tipo: '' };

export default function CenterSelectorDialog({ open, currentId, onClose, onSelect }) {
  const fullScreen = useMediaQuery((t) => t.breakpoints.down('sm'));
  const [filters, setFilters] = useState(EMPTY);
  const [picked, setPicked] = useState(currentId);
  const geo = useGeolocation();
  const all = useAsync(() => centerService.listPublic(), [], { watch: ['centros'] });
  const facets = useAsync(() => centerService.getFacets(), [], { watch: ['centros'] });

  // El filtrado es local sobre la lista ya cargada: respuesta inmediata al escribir.
  const list = useMemo(
    () => (all.data ? filterCenters(all.data, { ...filters, origin: geo.position }) : []),
    [all.data, filters, geo.position],
  );
  const pickedCenter = all.data?.find((c) => c.id === picked);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="center-selector-title"
    >
      <DialogTitle id="center-selector-title" sx={{ pr: 7 }}>
        Seleccione su centro de salud
        <IconButton
          onClick={onClose}
          aria-label="Cerrar"
          sx={{ position: 'absolute', right: 8, top: 8, width: 44, height: 44 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
        <CenterFilters
          value={filters}
          onChange={setFilters}
          facets={facets.data}
          geo={geo}
          onClear={() => setFilters(EMPTY)}
          dense
        />
        {geo.error && (
          <Alert severity="info" sx={{ mt: 1.5 }} onClose={geo.clear}>
            {geo.error}
          </Alert>
        )}
        <Box sx={{ mt: 1.5 }}>
          {all.loading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} height={72} />)
          ) : all.error ? (
            <Alert severity="error">No se pudieron cargar los centros. Intente nuevamente.</Alert>
          ) : list.length === 0 ? (
            <EmptyState
              compact
              icon={SearchOff}
              title="No hay centros con esos criterios"
              action={{ label: 'Limpiar filtros', onClick: () => setFilters(EMPTY) }}
            />
          ) : (
            <List role="radiogroup" aria-label="Centros de salud" disablePadding>
              {list.map((c) => (
                <ListItemButton
                  key={c.id}
                  role="radio"
                  aria-checked={picked === c.id}
                  selected={picked === c.id}
                  onClick={() => setPicked(c.id)}
                  onDoubleClick={() => onSelect(c)}
                  sx={{
                    alignItems: 'flex-start',
                    mb: 0.5,
                    border: 1,
                    borderColor: picked === c.id ? 'primary.main' : 'divider',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, mt: 0.25 }}>
                    <Radio
                      edge="start"
                      checked={picked === c.id}
                      tabIndex={-1}
                      disableRipple
                      slotProps={{ input: { 'aria-hidden': true } }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={c.nombre}
                    slotProps={{ primary: { sx: { fontWeight: 600 } }, secondary: { component: 'div' } }}
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 0.25 }}>
                        <Typography variant="body2" color="text.secondary" component="span">
                          {TIPOS_CENTRO[c.tipo]} · {c.municipio}
                          {c.distanciaKm != null && ` · ${formatDistance(c.distanciaKm)}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" component="span">
                          {c.direccion}
                        </Typography>
                        <Box>
                          <OpenStatusChip status={c.estadoApertura} />
                        </Box>
                      </Stack>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button variant="contained" disabled={!pickedCenter} onClick={() => onSelect(pickedCenter)}>
          {pickedCenter && pickedCenter.id === currentId ? 'Mantener selección' : 'Seleccionar centro'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
