/** /admin/horarios — plantillas de horario y novedades de agenda del centro (Épica 9). */
import { useState } from 'react';
import { Alert, Button, IconButton, MenuItem, Stack, Tab, Tabs, TextField, Tooltip } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Edit from '@mui/icons-material/Edit';
import ToggleOn from '@mui/icons-material/ToggleOn';
import ToggleOff from '@mui/icons-material/ToggleOff';
import Delete from '@mui/icons-material/Delete';
import Schedule from '@mui/icons-material/Schedule';
import EventBusy from '@mui/icons-material/EventBusy';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import StatusChip from '@/components/common/StatusChip';
import ExceptionDialog from '@/components/operations/ExceptionDialog';
import ScheduleFormDialog from './ScheduleFormDialog';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useNotify } from '@/context/NotifyContext';
import { agendaService } from '@/services/agendaService';
import { DIAS_SEMANA } from '@/config/constants';
import { formatDate } from '@/utils/dates';
import { withWarnings } from '@/utils/withWarnings';

const WATCH = ['horarios', 'excepcionesAgenda', 'fichas', 'medicoCentros'];

export default function SchedulesAdminPage() {
  const { session, can } = useAuth();
  const confirm = useConfirm();
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'novedades' ? 'novedades' : 'horarios';
  const medicoId = params.get('medico') || '';
  const [form, setForm] = useState({ open: false, horario: null });
  const [exc, setExc] = useState(false);
  const needCenter = !session.activeCenterId;
  const schedules = useAsync(
    () => (needCenter || tab !== 'horarios' ? null : agendaService.listSchedules(session, { medicoId })),
    [tab, medicoId, session.activeCenterId],
    { watch: WATCH },
  );
  const exceptions = useAsync(
    () => (needCenter || tab !== 'novedades' ? null : agendaService.listExceptions(session)),
    [tab, session.activeCenterId],
    { watch: WATCH },
  );
  const medicos = schedules.data
    ? [...new Map(schedules.data.map((h) => [h.medicoId, h.medico])).entries()]
    : [];

  const toggle = async (h) => {
    try {
      const r = await withWarnings(
        ({ confirmar }) => agendaService.setScheduleActive(session, h.id, !h.activo, { confirmar }),
        confirm,
        h.activo ? '¿Desactivar el horario?' : '¿Reactivar el horario?',
      );
      if (r) notify.success(h.activo ? 'Horario desactivado.' : 'Horario activado.');
    } catch (e) {
      notify.error(e);
    }
  };

  const remove = async (e) => {
    if (
      !(await confirm({
        title: '¿Eliminar la novedad?',
        message:
          'La disponibilidad de esas fechas vuelve a calcularse sin ella. Las fichas que ya se reprogramaron o cancelaron no se restauran.',
        confirmLabel: 'Eliminar',
        destructive: true,
      }))
    )
      return;
    try {
      await agendaService.deleteException(session, e.id);
      notify.success('Novedad eliminada.');
    } catch (err) {
      notify.error(err);
    }
  };

  const hCols = [
    {
      field: 'diaSemana',
      header: 'Día',
      render: (h) => DIAS_SEMANA[h.diaSemana],
      sortValue: (h) => h.diaSemana * 10000 + Number(h.horaInicio.replace(':', '')),
    },
    { field: 'horaInicio', header: 'Franja', render: (h) => `${h.horaInicio}–${h.horaFin}` },
    { field: 'medico', header: 'Profesional', primary: true },
    { field: 'especialidad', header: 'Especialidad' },
    { field: 'consultorio', header: 'Consultorio', hideOnMobile: true },
    {
      field: 'cupos',
      header: 'Cupos (web)',
      align: 'right',
      render: (h) => `${h.cupos} (${h.cuposPublicos}) · ${h.duracionConsultaMin} min`,
    },
    {
      field: 'vigenciaHasta',
      header: 'Vigencia',
      render: (h) =>
        `${formatDate(h.vigenciaDesde)}${h.vigenciaHasta ? ` – ${formatDate(h.vigenciaHasta)}` : ' →'}`,
      hideOnMobile: true,
    },
    {
      field: 'activo',
      header: 'Estado',
      render: (h) => <StatusChip estado={h.activo ? 'activo' : 'inactivo'} />,
      sortValue: (h) => (h.activo ? 0 : 1),
    },
    ...(can('horarios.gestionar')
      ? [
          {
            header: 'Acciones',
            align: 'right',
            sortable: false,
            searchable: false,
            render: (h) => (
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}
              >
                <Tooltip title="Editar">
                  <IconButton
                    aria-label={`Editar horario ${h.medico} ${h.horaInicio}`}
                    onClick={() => setForm({ open: true, horario: h })}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={h.activo ? 'Desactivar' : 'Activar'}>
                  <IconButton
                    aria-label={`${h.activo ? 'Desactivar' : 'Activar'} horario ${h.medico} ${h.horaInicio}`}
                    onClick={() => toggle(h)}
                  >
                    {h.activo ? (
                      <ToggleOff fontSize="small" />
                    ) : (
                      <ToggleOn fontSize="small" color="primary" />
                    )}
                  </IconButton>
                </Tooltip>
              </Stack>
            ),
          },
        ]
      : []),
  ];

  const eCols = [
    {
      field: 'fechaInicio',
      header: 'Fechas',
      primary: true,
      render: (e) =>
        e.fechaInicio === e.fechaFin
          ? formatDate(e.fechaInicio)
          : `${formatDate(e.fechaInicio)} – ${formatDate(e.fechaFin)}`,
    },
    {
      field: 'tipoLabel',
      header: 'Tipo',
      render: (e) => (
        <StatusChip estado={e.tipo === 'ajuste_cupos' ? 'en_atencion' : 'cancelada'} label={e.tipoLabel} />
      ),
    },
    { field: 'alcanceLabel', header: 'Alcance' },
    {
      field: 'horaInicio',
      header: 'Horario',
      render: (e) => (e.horaInicio ? `${e.horaInicio}–${e.horaFin}` : 'Todo el día'),
    },
    {
      field: 'motivo',
      header: 'Motivo',
      render: (e) => `${e.motivo}${e.tipo === 'ajuste_cupos' ? ` (${e.cuposAjustados} cupos)` : ''}`,
    },
    { field: 'creador', header: 'Registró', hideOnMobile: true },
    {
      header: 'Acciones',
      align: 'right',
      sortable: false,
      searchable: false,
      render: (e) =>
        e.editable && can('agenda.gestionar') ? (
          <IconButton aria-label={`Eliminar novedad ${e.motivo}`} onClick={() => remove(e)}>
            <Delete fontSize="small" />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Horarios"
        subtitle="Plantillas semanales de atención y novedades (feriados, permisos, bloqueos, ajustes de cupos)."
        breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Horarios' }]}
        actions={
          !needCenter &&
          (tab === 'horarios'
            ? can('horarios.gestionar') && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setForm({ open: true, horario: null })}
                >
                  Nuevo horario
                </Button>
              )
            : can('agenda.gestionar') && (
                <Button variant="contained" startIcon={<EventBusy />} onClick={() => setExc(true)}>
                  Registrar novedad
                </Button>
              ))
        }
      />
      <Tabs
        value={tab}
        onChange={(_e, v) => setParams(v === 'novedades' ? { tab: 'novedades' } : {}, { replace: true })}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="horarios" label="Horarios semanales" sx={{ minHeight: 48 }} />
        <Tab value="novedades" label="Novedades de agenda" sx={{ minHeight: 48 }} />
      </Tabs>
      {needCenter ? (
        <Alert severity="info">Elija un centro de trabajo en la barra superior.</Alert>
      ) : tab === 'horarios' ? (
        <>
          <TextField
            select
            size="small"
            label="Profesional"
            value={medicoId}
            onChange={(e) => setParams(e.target.value ? { medico: e.target.value } : {}, { replace: true })}
            sx={{ mb: 2, minWidth: 240 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {(medicoId && !medicos.some(([id]) => id === medicoId)
              ? [[medicoId, 'Seleccionado'], ...medicos]
              : medicos
            ).map(([id, n]) => (
              <MenuItem key={id} value={id}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <DataTable
            columns={hCols}
            rows={schedules.data || []}
            loading={!schedules.data}
            pageSize={25}
            rowsPerPageOptions={[25, 50, 100]}
            searchPlaceholder="Buscar profesional o especialidad…"
            empty={{ icon: Schedule, title: 'No hay horarios' }}
            ariaLabel="Horarios"
          />
        </>
      ) : (
        <DataTable
          columns={eCols}
          rows={exceptions.data || []}
          loading={!exceptions.data}
          searchable={false}
          empty={{ icon: EventBusy, title: 'No hay novedades vigentes o próximas' }}
          ariaLabel="Novedades de agenda"
        />
      )}
      <ScheduleFormDialog
        open={form.open}
        horario={form.horario}
        onClose={() => setForm({ open: false, horario: null })}
      />
      <ExceptionDialog open={exc} onClose={() => setExc(false)} />
    </>
  );
}
