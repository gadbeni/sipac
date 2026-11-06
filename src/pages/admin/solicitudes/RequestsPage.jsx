/** /admin/solicitudes — gestión de solicitudes por pestañas (Épica 8, flujo F2). */
import { useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import {
  Badge,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import Lock from '@mui/icons-material/Lock';
import Assignment from '@mui/icons-material/Assignment';
import FilterAltOff from '@mui/icons-material/FilterAltOff';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import StatusChip from '@/components/common/StatusChip';
import RequestDetailDrawer from './RequestDetailDrawer';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { requestAdminService } from '@/services/requestAdminService';
import { formatDate, formatRelative } from '@/utils/dates';

const TABS = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'emitidas', label: 'Fichas emitidas' },
  { id: 'lista_espera', label: 'Lista de espera' },
  { id: 'cerradas', label: 'Canceladas / rechazadas' },
];
const WATCH = ['solicitudes', 'fichas', 'pacientes'];

export default function RequestsPage() {
  const { session } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'pendientes';
  const fecha = params.get('fecha') || '';
  const especialidadId = params.get('especialidad') || '';
  const medicoId = params.get('medico') || '';
  const detailId = params.get('id');
  const set = (patch) => {
    const n = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v);
      else n.delete(k);
    }
    setParams(n, { replace: true });
  };
  const deps = [tab, fecha, especialidadId, medicoId, session.usuarioId, session.activeCenterId];
  const { data, loading } = useAsync(
    () => requestAdminService.list(session, { tab, fecha, especialidadId, medicoId }),
    deps,
    { watch: WATCH },
  );
  const counts = useAsync(
    () => requestAdminService.counts(session),
    [session.usuarioId, session.activeCenterId],
    { watch: WATCH },
  );
  const options = useMemo(() => requestAdminService.filterOptions(session), [session]);

  // ?codigo= (desde notificaciones): abrir el detalle correspondiente.
  const codigo = params.get('codigo');
  const rows = data || [];
  const target = codigo && !detailId ? rows.find((x) => x.codigo === codigo) : null;
  useEffect(() => {
    if (target) set({ id: target.id, codigo: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  const columns = [
    {
      field: 'codigo',
      header: 'Código',
      primary: true,
      render: (r) => <code style={{ whiteSpace: 'nowrap' }}>{r.codigo}</code>,
    },
    {
      field: 'paciente',
      header: 'Paciente',
      render: (r) => (
        <Stack spacing={0.25}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {r.paciente}
            {r.pacienteBloqueado && (
              <Tooltip title="Bloqueado por inasistencia">
                <Lock fontSize="inherit" color="error" aria-label="Bloqueado" />
              </Tooltip>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            CI {r.documento}
            {r.datosPorVerificar && ' · Datos por verificar'}
          </Typography>
        </Stack>
      ),
      sortValue: (r) => r.paciente,
    },
    { field: 'especialidad', header: 'Especialidad' },
    { field: 'fecha', header: 'Fecha', render: (r) => formatDate(r.fecha) },
    {
      field: 'medico',
      header: 'Profesional',
      render: (r) => (r.medico ? `${r.medico}${r.medicoAsignado ? '' : ' (pref.)'}` : 'Cualquiera'),
      hideOnMobile: true,
    },
    ...(session.activeCenterId ? [] : [{ field: 'centro', header: 'Centro', hideOnMobile: true }]),
    {
      field: 'estado',
      header: 'Estado',
      render: (r) =>
        r.ficha ? (
          <StatusChip estado={r.ficha.estado} label={`${r.ficha.codigo} · ${r.ficha.horaEstimada}`} />
        ) : (
          <StatusChip estado={r.estado} />
        ),
    },
    { field: 'creadoEn', header: 'Recibida', render: (r) => formatRelative(r.creadoEn), hideOnMobile: true },
  ];

  const filtered = fecha || especialidadId || medicoId;
  return (
    <>
      <PageHeader
        title="Solicitudes de fichas"
        subtitle="Revise, apruebe y emita fichas respetando los cupos de cada bloque."
        breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Solicitudes' }]}
      />
      <Tabs
        value={tab}
        onChange={(_e, v) => set({ tab: v, id: '' })}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        aria-label="Estado de las solicitudes"
      >
        {TABS.map((t) => (
          <Tab
            key={t.id}
            value={t.id}
            sx={{ minHeight: 48 }}
            label={
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                {t.label}
                <Chip
                  size="small"
                  label={counts.data?.[t.id] ?? 0}
                  color={t.id === 'pendientes' && counts.data?.pendientes ? 'warning' : 'default'}
                  sx={{ height: 22, fontWeight: 700 }}
                />
              </Box>
            }
          />
        ))}
      </Tabs>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <DatePicker
          label="Fecha de atención"
          format="DD/MM/YYYY"
          value={fecha ? dayjs(fecha) : null}
          onChange={(d) => set({ fecha: d?.isValid() ? d.format('YYYY-MM-DD') : '' })}
          slotProps={{ textField: { size: 'small', sx: { minWidth: 190 } }, field: { clearable: true } }}
        />
        <TextField
          select
          size="small"
          label="Especialidad"
          value={especialidadId}
          onChange={(e) => set({ especialidad: e.target.value })}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {options.especialidades.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Profesional"
          value={medicoId}
          onChange={(e) => set({ medico: e.target.value })}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {options.medicos.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
        {filtered && (
          <Button
            startIcon={<FilterAltOff />}
            color="inherit"
            onClick={() => set({ fecha: '', especialidad: '', medico: '' })}
          >
            Limpiar filtros
          </Button>
        )}
      </Stack>
      {tab === 'pendientes' && rows.length > 0 && (
        <Chip size="small" label="Ordenadas por llegada: atienda primero las más antiguas" sx={{ mb: 1.5 }} />
      )}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading && !data}
        searchPlaceholder="Buscar por código, paciente o documento…"
        onRowClick={(r) => set({ id: r.id })}
        pageSize={25}
        rowsPerPageOptions={[25, 50, 100]}
        empty={{
          icon: Assignment,
          title: 'No hay solicitudes en esta pestaña',
          description: filtered ? 'Pruebe quitando los filtros.' : undefined,
        }}
        ariaLabel="Solicitudes"
      />
      <RequestDetailDrawer id={detailId} onClose={() => set({ id: '' })} />
    </>
  );
}
