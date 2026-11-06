/** /admin/usuarios — gestión (admin central) o lectura de su centro (admin de centro), RN-USR-03. */
import { useState } from 'react';
import { Alert, Button, IconButton, Stack, Tooltip } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Edit from '@mui/icons-material/Edit';
import ToggleOn from '@mui/icons-material/ToggleOn';
import ToggleOff from '@mui/icons-material/ToggleOff';
import LockReset from '@mui/icons-material/LockReset';
import ManageAccounts from '@mui/icons-material/ManageAccounts';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import StatusChip from '@/components/common/StatusChip';
import UserFormDialog from './UserFormDialog';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useNotify } from '@/context/NotifyContext';
import { userService } from '@/services/userService';
import { formatDateTime } from '@/utils/dates';

export default function UsersPage() {
  const { session, can } = useAuth();
  const manage = can('usuarios.gestionar');
  const confirm = useConfirm();
  const notify = useNotify();
  const [form, setForm] = useState({ open: false, user: null });
  const { data, loading, error } = useAsync(
    () => userService.list(session, manage ? { centroId: session.activeCenterId || undefined } : {}),
    [session.usuarioId, session.activeCenterId, manage],
    { watch: ['usuarios'] },
  );

  const toggle = async (u) => {
    if (
      u.activo &&
      !(await confirm({
        title: `¿Desactivar a ${u.nombre}?`,
        message: 'No podrá ingresar al sistema hasta que se reactive. Sus registros se conservan.',
        confirmLabel: 'Desactivar',
        destructive: true,
      }))
    )
      return;
    try {
      await userService.setActive(session, u.id, !u.activo);
      notify.success(u.activo ? 'Usuario desactivado.' : 'Usuario activado.');
    } catch (e) {
      notify.error(e);
    }
  };

  const reset = async (u) => {
    if (
      !(await confirm({
        title: `¿Restablecer la contraseña de ${u.username}?`,
        message: 'Se asignará la contraseña temporal de la demostración.',
        confirmLabel: 'Restablecer',
      }))
    )
      return;
    try {
      const pwd = await userService.resetPassword(session, u.id);
      notify.success(`Contraseña temporal: ${pwd}`);
    } catch (e) {
      notify.error(e);
    }
  };

  const columns = [
    { field: 'nombre', header: 'Nombre', primary: true },
    { field: 'username', header: 'Usuario', render: (r) => <code>{r.username}</code> },
    { field: 'rolLabel', header: 'Rol' },
    { field: 'centrosLabel', header: 'Centro', hideOnMobile: true },
    {
      field: 'ultimoAcceso',
      header: 'Último acceso',
      render: (r) => formatDateTime(r.ultimoAcceso) || '—',
      hideOnMobile: true,
    },
    {
      field: 'activo',
      header: 'Estado',
      render: (r) => <StatusChip estado={r.activo ? 'activo' : 'inactivo'} />,
      sortValue: (r) => (r.activo ? 0 : 1),
    },
    ...(manage
      ? [
          {
            header: 'Acciones',
            align: 'right',
            sortable: false,
            searchable: false,
            render: (r) => (
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}
              >
                <Tooltip title="Editar">
                  <IconButton
                    aria-label={`Editar ${r.username}`}
                    onClick={() => setForm({ open: true, user: r })}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Restablecer contraseña">
                  <IconButton aria-label={`Restablecer contraseña de ${r.username}`} onClick={() => reset(r)}>
                    <LockReset fontSize="small" />
                  </IconButton>
                </Tooltip>
                {r.id !== session.usuarioId && (
                  <Tooltip title={r.activo ? 'Desactivar' : 'Activar'}>
                    <IconButton
                      aria-label={`${r.activo ? 'Desactivar' : 'Activar'} ${r.username}`}
                      onClick={() => toggle(r)}
                    >
                      {r.activo ? (
                        <ToggleOff fontSize="small" />
                      ) : (
                        <ToggleOn fontSize="small" color="primary" />
                      )}
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle={
          manage ? 'Cuentas del personal de la red y su rol.' : 'Usuarios de su centro (solo lectura).'
        }
        breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Usuarios' }]}
        actions={
          manage && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setForm({ open: true, user: null })}
            >
              Nuevo usuario
            </Button>
          )
        }
      />
      {manage && session.activeCenterId && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Se muestran los usuarios del centro de trabajo seleccionado. Elija “Todos los centros” en la barra
          superior para ver la red completa.
        </Alert>
      )}
      {error ? (
        <Alert severity="error">{error.message}</Alert>
      ) : (
        <DataTable
          columns={columns}
          rows={data || []}
          loading={loading}
          searchPlaceholder="Buscar por nombre, usuario o rol…"
          empty={{ icon: ManageAccounts, title: 'No hay usuarios' }}
          ariaLabel="Usuarios"
        />
      )}
      {manage && (
        <UserFormDialog
          open={form.open}
          user={form.user}
          onClose={() => setForm({ open: false, user: null })}
          onSaved={() => setForm({ open: false, user: null })}
        />
      )}
    </>
  );
}
