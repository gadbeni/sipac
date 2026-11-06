/** /admin/centros — gestión de centros (admin central, RN-CEN-02). */
import { useState } from 'react';
import { Button, IconButton, Stack, Tooltip } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Edit from '@mui/icons-material/Edit';
import ToggleOn from '@mui/icons-material/ToggleOn';
import ToggleOff from '@mui/icons-material/ToggleOff';
import OpenInNew from '@mui/icons-material/OpenInNew';
import LocalHospital from '@mui/icons-material/LocalHospital';
import { Link as RouterLink } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import StatusChip from '@/components/common/StatusChip';
import CenterFormDialog from './CenterFormDialog';
import { useAsync } from '@/hooks/useAsync';
import { useConfirm } from '@/context/ConfirmContext';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { centerService } from '@/services/centerService';
import { TIPOS_CENTRO } from '@/config/constants';

export default function AdminCentersPage() {
  const { session } = useAuth();
  const { data, loading } = useAsync(() => centerService.listAll(session), [], {
    watch: ['centros', 'centroEspecialidades', 'medicoCentros'],
  });
  const [form, setForm] = useState({ open: false, center: null });
  const confirm = useConfirm();
  const notify = useNotify();

  const toggle = async (c) => {
    if (c.activo) {
      const n = centerService.countFutureConfirmed(session, c.id);
      const ok = await confirm({
        title: `¿Desactivar ${c.nombre}?`,
        message:
          (n > 0
            ? `Tiene ${n} ${n === 1 ? 'ficha confirmada' : 'fichas confirmadas'} para los próximos días. No se cancelarán automáticamente: deberá reprogramarlas o cancelarlas con motivo. `
            : '') +
          'El centro dejará de aparecer en el portal y no aceptará nuevas solicitudes ni fichas. Su historial se conserva.',
        confirmLabel: 'Desactivar centro',
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      await centerService.setActive(session, c.id, !c.activo);
      notify.success(c.activo ? `${c.nombre} desactivado.` : `${c.nombre} activado.`);
    } catch (e) {
      notify.error(e);
    }
  };

  const columns = [
    { field: 'nombre', header: 'Centro', primary: true, value: (r) => r.nombre },
    { field: 'codigoCorto', header: 'Código', render: (r) => <code>{r.codigoCorto}</code> },
    { field: 'municipio', header: 'Municipio' },
    { field: 'tipo', header: 'Tipo', value: (r) => TIPOS_CENTRO[r.tipo], hideOnMobile: true },
    { field: 'especialidadesActivas', header: 'Especialidades', align: 'right', hideOnMobile: true },
    { field: 'medicosActivos', header: 'Profesionales', align: 'right', hideOnMobile: true },
    {
      field: 'activo',
      header: 'Estado',
      render: (r) => <StatusChip estado={r.activo ? 'activo' : 'inactivo'} />,
      sortValue: (r) => (r.activo ? 0 : 1),
    },
    {
      header: 'Acciones',
      align: 'right',
      sortable: false,
      searchable: false,
      render: (r) => (
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
          <Tooltip title="Editar">
            <IconButton aria-label={`Editar ${r.nombre}`} onClick={() => setForm({ open: true, center: r })}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={r.activo ? 'Desactivar' : 'Activar'}>
            <IconButton
              aria-label={`${r.activo ? 'Desactivar' : 'Activar'} ${r.nombre}`}
              onClick={() => toggle(r)}
              color={r.activo ? 'default' : 'primary'}
            >
              {r.activo ? <ToggleOff fontSize="small" /> : <ToggleOn fontSize="small" />}
            </IconButton>
          </Tooltip>
          {r.activo && (
            <Tooltip title="Ver en el portal">
              <IconButton
                aria-label={`Ver ${r.nombre} en el portal`}
                component={RouterLink}
                to={`/centros/${r.codigoCorto}`}
              >
                <OpenInNew fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Centros de salud"
        subtitle="Alta, edición y estado de los establecimientos de la red."
        breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Centros de salud' }]}
        actions={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setForm({ open: true, center: null })}
          >
            Nuevo centro
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={data || []}
        loading={loading}
        searchPlaceholder="Buscar por nombre, código o municipio…"
        empty={{ icon: LocalHospital, title: 'No hay centros registrados' }}
        ariaLabel="Centros de salud"
      />
      <CenterFormDialog
        open={form.open}
        center={form.center}
        onClose={() => setForm({ open: false, center: null })}
        onSaved={() => setForm({ open: false, center: null })}
      />
    </>
  );
}
