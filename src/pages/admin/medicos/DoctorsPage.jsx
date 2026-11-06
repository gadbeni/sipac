/** /admin/medicos — profesionales del centro de trabajo (Épica 9). */
import { useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import PersonAdd from '@mui/icons-material/PersonAdd';
import MedicalServices from '@mui/icons-material/MedicalServices';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import StatusChip from '@/components/common/StatusChip';
import DoctorAvatar from '@/components/portal/DoctorAvatar';
import DoctorFormDialog from './DoctorFormDialog';
import LinkDialog from './LinkDialog';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { doctorAdminService } from '@/services/doctorAdminService';

const initials = (n) =>
  n
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');

export default function DoctorsPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(false);
  const [link, setLink] = useState(null);
  const needCenter = !session.activeCenterId;
  const { data, loading, error } = useAsync(
    () => (needCenter ? [] : doctorAdminService.list(session)),
    [session.usuarioId, session.activeCenterId],
    { watch: ['medicos', 'medicoCentros', 'horarios', 'fichas'] },
  );

  const columns = [
    {
      field: 'nombre',
      header: 'Profesional',
      primary: true,
      render: (r) => (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <DoctorAvatar iniciales={initials(r.nombre)} size={34} />
          <span>{r.nombre}</span>
        </Stack>
      ),
    },
    { field: 'especialidades', header: 'Especialidades en el centro' },
    { field: 'cargo', header: 'Cargo', hideOnMobile: true },
    { field: 'otrosCentros', header: 'También en', hideOnMobile: true, render: (r) => r.otrosCentros || '—' },
    { field: 'horarios', header: 'Horarios', align: 'right', hideOnMobile: true },
    { field: 'fichasFuturas', header: 'Fichas próximas', align: 'right', hideOnMobile: true },
    {
      field: 'activo',
      header: 'Estado',
      render: (r) => (
        <StatusChip
          estado={r.activo ? 'activo' : 'inactivo'}
          label={!r.medicoActivo ? 'Inactivo en la red' : r.vinculoActivo ? 'Activo' : 'Desvinculado'}
        />
      ),
      sortValue: (r) => (r.activo ? 0 : 1),
    },
  ];

  return (
    <>
      <PageHeader
        title="Médicos"
        subtitle="Profesionales vinculados al centro, sus especialidades y horarios."
        breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Médicos' }]}
        actions={
          !needCenter && (
            <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setForm(true)}>
              Nuevo profesional
            </Button>
          )
        }
      />
      {needCenter ? (
        <Alert severity="info">Elija un centro de trabajo en la barra superior.</Alert>
      ) : error ? (
        <Alert severity="error">{error.message}</Alert>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={data || []}
            loading={loading && !data}
            onRowClick={(r) => navigate(`/admin/medicos/${r.id}`)}
            searchPlaceholder="Buscar profesional o especialidad…"
            empty={{ icon: MedicalServices, title: 'No hay profesionales vinculados' }}
            ariaLabel="Médicos"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Un profesional que trabaja en varios centros tiene un solo registro y una agenda independiente en
            cada centro.
          </Typography>
        </>
      )}
      <DoctorFormDialog
        open={form}
        onClose={() => setForm(false)}
        onSaved={(m) => {
          setForm(false);
          navigate(`/admin/medicos/${m.id}`);
        }}
        onLinkExisting={(d) => {
          setForm(false);
          setLink(d);
        }}
      />
      <LinkDialog
        open={Boolean(link)}
        doctor={link}
        onClose={() => setLink(null)}
        onSaved={() => {
          const id = link.id;
          setLink(null);
          navigate(`/admin/medicos/${id}`);
        }}
      />
    </>
  );
}
