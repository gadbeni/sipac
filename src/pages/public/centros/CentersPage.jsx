/**
 * /centros — catálogo público de centros activos en tarjetas o mapa.
 * Filtros y vista viven en la URL (?q=&municipio=&tipo=&vista=mapa): se conservan al
 * cambiar de vista, al volver atrás y al compartir el enlace.
 */
import { lazy, Suspense, useMemo } from 'react';
import {
  Alert,
  Box,
  Container,
  Grid,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import ViewModule from '@mui/icons-material/ViewModule';
import MapIcon from '@mui/icons-material/Map';
import SearchOff from '@mui/icons-material/SearchOff';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import CenterCard from '@/components/centers/CenterCard';
import CenterFilters from '@/components/centers/CenterFilters';
import MapOfflineNotice from '@/components/centers/MapOfflineNotice';
import { useConnectivity } from '@/context/ConnectivityContext';
import { useAsync } from '@/hooks/useAsync';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useCenter } from '@/context/CenterContext';
import { useNotify } from '@/context/NotifyContext';
import { centerService } from '@/services/centerService';
import { filterCenters } from '@/services/rules/centers';

const CenterMap = lazy(() => import('@/components/centers/CenterMap'));

export default function CentersPage() {
  const [params, setParams] = useSearchParams();
  const filters = {
    q: params.get('q') || '',
    municipio: params.get('municipio') || '',
    tipo: params.get('tipo') || '',
  };
  const view = params.get('vista') === 'mapa' ? 'mapa' : 'tarjetas';
  const geo = useGeolocation();
  const { centerId, selectCenter } = useCenter();
  const notify = useNotify();
  const { online } = useConnectivity();
  const all = useAsync(() => centerService.listPublic(), [], { watch: ['centros'] });
  const facets = useAsync(() => centerService.getFacets(), [], { watch: ['centros'] });

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const list = useMemo(
    () => (all.data ? filterCenters(all.data, { ...filters, origin: geo.position }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all.data, filters.q, filters.municipio, filters.tipo, geo.position],
  );
  const clear = () => update({ q: '', municipio: '', tipo: '' });
  const onSelect = (c) => {
    selectCenter(c);
    notify.success(`Centro seleccionado: ${c.nombre}`);
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <PageHeader
        title="Centros de salud"
        subtitle="Encuentre el establecimiento más cercano y selecciónelo para ver su información y solicitar fichas."
      />

      <Box
        sx={{ p: 2, mb: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 3 }}
      >
        <CenterFilters value={filters} onChange={update} facets={facets.data} geo={geo} onClear={clear} />
      </Box>
      {geo.error && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={geo.clear}>
          {geo.error}
        </Alert>
      )}

      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1, flexWrap: 'wrap' }}
      >
        <Typography color="text.secondary" role="status">
          {all.loading
            ? 'Cargando centros…'
            : `${list.length} ${list.length === 1 ? 'centro encontrado' : 'centros encontrados'}${geo.position ? ', ordenados por cercanía' : ''}`}
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_e, v) => v && update({ vista: v === 'mapa' ? 'mapa' : '' })}
          aria-label="Vista"
          sx={{ '& .MuiToggleButton-root': { minHeight: 40, px: 1.5, gap: 0.75, textTransform: 'none' } }}
        >
          <ToggleButton value="tarjetas">
            <ViewModule fontSize="small" /> Tarjetas
          </ToggleButton>
          <ToggleButton value="mapa">
            <MapIcon fontSize="small" /> Mapa
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {all.error ? (
        <Alert severity="error">No se pudieron cargar los centros. Recargue la página.</Alert>
      ) : all.loading ? (
        <Grid container spacing={2}>
          {[0, 1, 2].map((i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rounded" height={340} />
            </Grid>
          ))}
        </Grid>
      ) : list.length === 0 ? (
        <EmptyState
          icon={SearchOff}
          title="No encontramos centros con esos criterios"
          description="Pruebe con otro nombre o quite algún filtro."
          action={{ label: 'Limpiar filtros', onClick: clear }}
          sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 3 }}
        />
      ) : view === 'mapa' && !online ? (
        <MapOfflineNotice onShowCards={() => update({ vista: '' })} />
      ) : view === 'mapa' ? (
        <Suspense fallback={<Skeleton variant="rounded" height={480} />}>
          <CenterMap
            centers={list}
            selectedId={centerId}
            onSelect={onSelect}
            userPosition={geo.position}
            onShowCards={() => update({ vista: '' })}
          />
        </Suspense>
      ) : (
        <Grid container spacing={2} component="section" aria-label="Resultados">
          {list.map((c) => (
            <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CenterCard center={c} selected={c.id === centerId} onSelect={onSelect} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
