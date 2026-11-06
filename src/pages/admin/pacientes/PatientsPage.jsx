/** /admin/pacientes — pacientes con registros en el centro (RN-PAC-03). Sin datos clínicos. */
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import People from '@mui/icons-material/People';
import Lock from '@mui/icons-material/Lock';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import StatusChip from '@/components/common/StatusChip';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { patientService } from '@/services/patientService';
import { formatDate } from '@/utils/dates';

const FILTROS = [
  { id: '', label: 'Todos' },
  { id: 'bloqueados', label: 'Bloqueados por inasistencia' },
  { id: 'porVerificar', label: 'Datos por verificar' },
  { id: 'noVerificados', label: 'Documento sin verificar' },
];

export default function PatientsPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filtro = params.get('bloqueados') ? 'bloqueados' : params.get('filtro') || '';
  const { data, loading, error } = useAsync(
    () => patientService.list(session, { filtro }),
    [filtro, session.usuarioId, session.activeCenterId],
    { watch: ['pacientes', 'fichas', 'solicitudes'] },
  );
  const scope =
    session.rol === 'medico'
      ? 'Pacientes de sus fichas en el centro de trabajo.'
      : session.activeCenterId
        ? 'Pacientes con al menos una solicitud o ficha en el centro.'
        : 'Todos los pacientes de la red.';

  const columns = [
    {
      field: 'nombre',
      header: 'Paciente',
      primary: true,
      render: (r) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {r.bloqueado && <Lock fontSize="inherit" color="error" aria-label="Bloqueado" />}
          {r.nombre}
        </Box>
      ),
    },
    { field: 'documento', header: 'Documento', render: (r) => <code>{r.documento}</code> },
    { field: 'edad', header: 'Edad', align: 'right', render: (r) => `${r.edad} años` },
    { field: 'telefono', header: 'Teléfono', hideOnMobile: true },
    { field: 'fichas', header: 'Fichas', align: 'right', hideOnMobile: true },
    {
      field: 'ultimaAtencion',
      header: 'Última atención',
      render: (r) => (r.ultimaAtencion ? formatDate(r.ultimaAtencion) : '—'),
      hideOnMobile: true,
    },
    {
      field: 'proxima',
      header: 'Próxima ficha',
      render: (r) => (r.proxima ? formatDate(r.proxima) : '—'),
      hideOnMobile: true,
    },
    {
      field: 'estado',
      header: 'Estado',
      sortValue: (r) => (r.bloqueado ? 0 : r.porVerificar ? 1 : 2),
      render: (r) => (
        <Stack direction="row" sx={{ gap: 0.5, flexWrap: 'wrap' }}>
          {r.bloqueado && <StatusChip estado="bloqueado" />}
          {r.porVerificar && <StatusChip estado="pendiente" label="Datos por verificar" />}
          {!r.bloqueado && !r.porVerificar && (
            <StatusChip
              estado={r.verificado ? 'activo' : 'inactivo'}
              label={r.verificado ? 'Verificado' : 'Sin verificar'}
            />
          )}
        </Stack>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Pacientes"
        subtitle={`${scope} Solo datos administrativos: el sistema no registra información clínica.`}
        breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Pacientes' }]}
      />
      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }} role="radiogroup" aria-label="Filtro">
        {FILTROS.map((f) => (
          <Chip
            key={f.id}
            role="radio"
            aria-checked={filtro === f.id}
            label={f.label}
            clickable
            color={filtro === f.id ? 'primary' : 'default'}
            variant={filtro === f.id ? 'filled' : 'outlined'}
            onClick={() => setParams(f.id ? { filtro: f.id } : {}, { replace: true })}
            sx={{ height: 36 }}
          />
        ))}
      </Stack>
      {error ? (
        <Alert severity="error">{error.message}</Alert>
      ) : (
        <DataTable
          columns={columns}
          rows={data || []}
          loading={loading && !data}
          onRowClick={(r) => navigate(`/admin/pacientes/${r.id}`)}
          pageSize={25}
          rowsPerPageOptions={[25, 50, 100]}
          searchPlaceholder="Buscar por CI, nombre o teléfono…"
          empty={{ icon: People, title: filtro ? 'Ningún paciente con este filtro' : 'Sin pacientes' }}
          ariaLabel="Pacientes"
        />
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Un paciente que se atiende en varios centros tiene un único registro; cada centro ve solo su
        historial.
      </Typography>
    </>
  );
}
