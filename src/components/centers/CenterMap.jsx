/**
 * Mapa de centros (Leaflet + teselas de OpenStreetMap). Se carga de forma diferida.
 * Requiere internet para las teselas (D-18): sin conexión muestra un aviso y la opción de
 * volver a las tarjetas. Marcadores SVG propios (sin imágenes externas de Leaflet).
 */
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Button, GlobalStyles, Stack, Typography } from '@mui/material';
import MapOfflineNotice from './MapOfflineNotice';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import OpenStatusChip from './OpenStatusChip';
import { useConnectivity } from '@/context/ConnectivityContext';
import { formatDistance } from '@/utils/geo';

const DEFAULT_CENTER = [-14.8336, -64.9006]; // Trinidad

const pinIcon = (fill, stroke, selected) =>
  L.divIcon({
    className: 'sipac-pin',
    html: `<svg width="${selected ? 40 : 32}" height="${selected ? 50 : 40}" viewBox="0 0 32 40" aria-hidden="true">
      <path d="M16 1C8 1 1.5 7.3 1.5 15.2 1.5 26 16 39 16 39s14.5-13 14.5-23.8C30.5 7.3 24 1 16 1z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <path d="M13.5 8.5h5v5h5v5h-5v5h-5v-5h-5v-5h5z" fill="#fff"/></svg>`,
    iconSize: selected ? [40, 50] : [32, 40],
    iconAnchor: selected ? [20, 50] : [16, 40],
    popupAnchor: [0, selected ? -46 : -36],
  });

const userIcon = (color) =>
  L.divIcon({
    className: 'sipac-pin',
    html: `<span style="display:block;width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 2px ${color}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

function FitBounds({ points }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join(';');
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function CenterMap({
  centers,
  selectedId,
  onSelect,
  userPosition,
  height = 480,
  onShowCards,
  single = false,
}) {
  const theme = useTheme();
  const { online } = useConnectivity();
  const dark = theme.palette.mode === 'dark';
  const icons = useMemo(
    () => ({
      normal: pinIcon(theme.palette.primary.main, '#ffffff', false),
      selected: pinIcon(theme.palette.secondary.dark, '#ffffff', true),
      user: userIcon(theme.palette.info.main),
    }),
    [theme],
  );
  const points = centers.map((c) => [c.latitud, c.longitud]);
  if (userPosition && !single) points.push([userPosition.lat, userPosition.lng]);

  if (!online) return <MapOfflineNotice onShowCards={onShowCards} />;

  return (
    <Box
      sx={{
        height,
        borderRadius: 3,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        position: 'relative',
        zIndex: 0,
      }}
    >
      <GlobalStyles
        styles={{
          '.sipac-pin': { background: 'none', border: 'none' },
          '.leaflet-container': {
            fontFamily: theme.typography.fontFamily,
            background: theme.palette.background.default,
          },
          '.leaflet-popup-content-wrapper, .leaflet-popup-tip': {
            background: theme.palette.background.paper,
            color: theme.palette.text.primary,
          },
          '.leaflet-popup-content': { margin: '12px 14px', minWidth: 220 },
          '.leaflet-container a.leaflet-popup-close-button': { color: theme.palette.text.secondary },
          '.leaflet-control-attribution': {
            background: `${theme.palette.background.paper} !important`,
            color: theme.palette.text.secondary,
          },
          '.leaflet-control-attribution a': { color: theme.palette.primary.main },
          // Modo oscuro: se invierten las teselas claras de OSM (ARCHITECTURE §7).
          '.sipac-tiles-dark': { filter: 'invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9)' },
        }}
      />
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        aria-label="Mapa de centros de salud"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          maxZoom={19}
          className={dark ? 'sipac-tiles-dark' : ''}
        />
        <FitBounds points={points} />
        {userPosition && (
          <Marker position={[userPosition.lat, userPosition.lng]} icon={icons.user} title="Su ubicación" />
        )}
        {centers.map((c) => {
          const selected = c.id === selectedId;
          return (
            <Marker
              key={c.id}
              position={[c.latitud, c.longitud]}
              icon={selected ? icons.selected : icons.normal}
              title={c.nombre}
              zIndexOffset={selected ? 500 : 0}
            >
              {!single && (
                <Popup>
                  <Stack spacing={1}>
                    <Typography sx={{ fontWeight: 700, lineHeight: 1.3 }}>{c.nombre}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ m: '0 !important' }}>
                      {c.direccion} · {c.municipio}
                      {c.distanciaKm != null && ` · ${formatDistance(c.distanciaKm)}`}
                    </Typography>
                    <Box>
                      <OpenStatusChip status={c.estadoApertura} />
                    </Box>
                    <Stack direction="row" spacing={1}>
                      {onSelect &&
                        (selected ? (
                          <Button size="small" disabled>
                            Seleccionado
                          </Button>
                        ) : (
                          <Button size="small" variant="contained" onClick={() => onSelect(c)}>
                            Seleccionar
                          </Button>
                        ))}
                      <Button size="small" component={RouterLink} to={`/centros/${c.codigoCorto}`}>
                        Ver detalle
                      </Button>
                    </Stack>
                  </Stack>
                </Popup>
              )}
            </Marker>
          );
        })}
      </MapContainer>
    </Box>
  );
}
