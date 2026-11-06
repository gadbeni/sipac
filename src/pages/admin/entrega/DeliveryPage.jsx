/** /admin/entrega — mostrador del día: llegada, ventanilla, sala de espera y llamado (Épica 8, F4/F5). */
import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import AddCard from '@mui/icons-material/AddCard';
import HowToReg from '@mui/icons-material/HowToReg';
import MoreVert from '@mui/icons-material/MoreVert';
import NightsStay from '@mui/icons-material/NightsStay';
import ConfirmationNumber from '@mui/icons-material/ConfirmationNumber';
import Tv from '@mui/icons-material/Tv';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import StatusChip from '@/components/common/StatusChip';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import ReasonDialog from '@/components/operations/ReasonDialog';
import RescheduleDialog from '@/components/operations/RescheduleDialog';
import QueueBoard from './QueueBoard';
import WalkInDialog from './WalkInDialog';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useNotify } from '@/context/NotifyContext';
import { appointmentService } from '@/services/appointmentService';
import { centerService } from '@/services/centerService';
import { MOTIVOS_CANCELACION } from '@/config/constants';
import { formatDateLong, today } from '@/utils/dates';

const WATCH = ['fichas', 'pacientes', 'solicitudes'];
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

function CheckInDialog({ ficha, onClose, onConfirm }) {
  const [verificar, setVerificar] = useState(!ficha?.pacienteVerificado);
  const [preferente, setPreferente] = useState(ficha?.prioridad === 'preferente');
  return (
    <ConfirmDialog
      open={Boolean(ficha)}
      title={`Registrar llegada · ${ficha?.codigoVisible}`}
      message={`${ficha?.paciente} · ${ficha?.documento} · ${ficha?.especialidad} · ${ficha?.consultorio}`}
      confirmLabel="Registrar llegada"
      onConfirm={() => onConfirm({ verificar, prioridad: preferente ? 'preferente' : 'normal' })}
      onClose={onClose}
    >
      <Stack>
        {!ficha?.pacienteVerificado && (
          <FormControlLabel
            control={<Checkbox checked={verificar} onChange={(e) => setVerificar(e.target.checked)} />}
            label="Documento verificado (presentó su documento)"
            sx={{ minHeight: 44 }}
          />
        )}
        <FormControlLabel
          control={<Checkbox checked={preferente} onChange={(e) => setPreferente(e.target.checked)} />}
          label="Atención preferente"
          sx={{ minHeight: 44 }}
        />
      </Stack>
    </ConfirmDialog>
  );
}

export default function DeliveryPage() {
  const { session, can } = useAuth();
  const notify = useNotify();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const tab = params.get('vista') === 'fichas' ? 'fichas' : 'sala';
  const [q, setQ] = useState('');
  const [walkIn, setWalkIn] = useState(false);
  const [checkIn, setCheckIn] = useState(null);
  const [cancelF, setCancelF] = useState(null);
  const [resched, setResched] = useState(null);
  const [menu, setMenu] = useState(null);
  const needCenter = !session.activeCenterId;
  const displayCode = needCenter ? null : centerService.getActiveSync(session.activeCenterId)?.codigoCorto;
  const queue = useAsync(
    () => (needCenter ? null : appointmentService.getQueue(session)),
    [session.usuarioId, session.activeCenterId],
    { watch: WATCH },
  );
  const day = useAsync(
    () => (needCenter ? [] : appointmentService.listDay(session)),
    [session.usuarioId, session.activeCenterId],
    { watch: WATCH },
  );
  const search = useAsync(
    () => (needCenter || q.trim().length < 2 ? null : appointmentService.search(session, q)),
    [q, session.activeCenterId],
    { watch: WATCH },
  );

  /** Ejecuta una acción del llamado/entrega con confirmación opcional y Snackbar de resultado. */
  const act = async (method, target, okMsg, opts = {}) => {
    if (opts.confirm && !(await confirm(opts.confirm))) return;
    try {
      const r = opts.consultorio
        ? await appointmentService[method](session, target.consultorioId)
        : await appointmentService[method](session, target.id, opts.args);
      notify.success(okMsg || `Llamando ${r.codigoVisible} · ${target.consultorio || ''}`);
    } catch (e) {
      notify.error(e);
    }
  };

  const closeDay = async () => {
    const pend = (day.data || []).filter((f) =>
      ['confirmada', 'en_espera', 'llamada', 'en_atencion'].includes(f.estado),
    );
    const ausentes = pend.filter((f) => f.estado !== 'en_atencion').length;
    if (
      !(await confirm({
        title: '¿Cerrar la jornada de hoy?',
        message: `${ausentes} ${ausentes === 1 ? 'ficha pendiente pasará' : 'fichas pendientes pasarán'} a "No se presentó" y esos pacientes quedarán bloqueados. Las fichas en atención se marcarán como atendidas.`,
        confirmLabel: 'Cerrar jornada',
        destructive: true,
      }))
    )
      return;
    try {
      const r = await appointmentService.closeDay(session);
      notify.success(
        `Jornada cerrada: ${r.ausentes} ausentes, ${r.cerradas} atenciones cerradas, ${r.bloqueados} pacientes bloqueados.`,
      );
    } catch (e) {
      notify.error(e);
    }
  };

  const doCheckIn = async (v) => {
    try {
      const f = await appointmentService.checkIn(session, checkIn.id, v);
      notify.success(`Llegada registrada: ${f.codigoVisible} está en sala de espera.`);
      setCheckIn(null);
      setQ('');
    } catch (e) {
      notify.error(e);
    }
  };

  const rowActions = (f) => (
    <Stack direction="row" spacing={0.5} sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
      {f.estado === 'confirmada' && (
        <Button
          size="small"
          variant="contained"
          startIcon={<HowToReg />}
          onClick={(e) => (e.stopPropagation(), setCheckIn(f))}
        >
          Llegada
        </Button>
      )}
      {f.estado === 'ausente' && (
        <Button
          size="small"
          onClick={() =>
            act(
              'revertAbsence',
              f,
              `${f.codigoVisible} volvió a la sala de espera y se levantó el bloqueo.`,
              {
                confirm: {
                  title: `¿Revertir la ausencia de ${f.codigoVisible}?`,
                  message:
                    'Use esta opción si el paciente llegó tarde hoy. Se levantará el bloqueo generado por esta ficha.',
                  confirmLabel: 'Revertir ausencia',
                },
              },
            )
          }
        >
          Llegó tarde
        </Button>
      )}
      {['confirmada', 'en_espera'].includes(f.estado) && (
        <Tooltip title="Más acciones">
          <IconButton
            aria-label={`Más acciones para ${f.codigoVisible}`}
            onClick={(e) => setMenu({ anchor: e.currentTarget, f })}
          >
            <MoreVert fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );

  const columns = [
    {
      field: 'codigoVisible',
      header: 'Ficha',
      primary: true,
      render: (f) => <strong>{f.codigoVisible}</strong>,
      sortValue: (f) => f.numero,
    },
    { field: 'horaEstimada', header: 'Hora', render: (f) => f.horaEstimada },
    {
      field: 'paciente',
      header: 'Paciente',
      render: (f) => `${f.paciente}${f.prioridad === 'preferente' ? ' · Preferente' : ''}`,
    },
    { field: 'documento', header: 'Documento', hideOnMobile: true },
    { field: 'especialidad', header: 'Especialidad', hideOnMobile: true },
    { field: 'consultorio', header: 'Consultorio', hideOnMobile: true },
    { field: 'canal', header: 'Canal', render: (f) => <StatusChip estado={f.canal} />, hideOnMobile: true },
    { field: 'estado', header: 'Estado', render: (f) => <StatusChip estado={f.estado} /> },
    { header: 'Acciones', align: 'right', sortable: false, searchable: false, render: rowActions },
  ];

  const results = search.data;
  return (
    <>
      <PageHeader
        title="Entrega de fichas"
        subtitle={needCenter ? 'Seleccione un centro de trabajo.' : `${cap(formatDateLong(today()))}`}
        breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Entrega de fichas' }]}
        actions={
          !needCenter && (
            <>
              {can('fichas.emitir') && (
                <Button variant="contained" startIcon={<AddCard />} onClick={() => setWalkIn(true)}>
                  Ficha de ventanilla
                </Button>
              )}
              {displayCode && (
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<Tv />}
                  component={RouterLink}
                  to={`/pantalla/${displayCode}`}
                  target="_blank"
                  rel="noopener"
                >
                  Pantalla de llamado
                </Button>
              )}
              <Button variant="outlined" color="inherit" startIcon={<NightsStay />} onClick={closeDay}>
                Cierre de jornada
              </Button>
            </>
          )
        }
      />
      {needCenter ? (
        <Alert severity="info">
          La entrega de fichas opera sobre un centro. Elija uno en “Centro de trabajo” en la barra superior.
        </Alert>
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <TextField
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por código de solicitud, número de ficha, documento o nombre…"
                slotProps={{
                  htmlInput: { 'aria-label': 'Búsqueda rápida' },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {results && (
                <Box sx={{ mt: 1.5 }}>
                  {results.fichas.length === 0 && results.solicitudes.length === 0 ? (
                    <Typography color="text.secondary">No hay fichas de hoy que coincidan.</Typography>
                  ) : (
                    <List dense disablePadding aria-label="Resultados de búsqueda">
                      {results.fichas.map((f) => (
                        <ListItem key={f.id} divider secondaryAction={rowActions(f)} sx={{ pr: 22 }}>
                          <ListItemText
                            primary={`${f.codigoVisible} · ${f.paciente}`}
                            secondary={`${f.documento} · ${f.especialidad} · ${f.consultorio} · ${f.horaEstimada}${f.solicitudCodigo ? ` · ${f.solicitudCodigo}` : ''}`}
                          />
                          <StatusChip estado={f.estado} sx={{ mr: 1 }} />
                        </ListItem>
                      ))}
                      {results.solicitudes.map((s) => (
                        <ListItem
                          key={s.id}
                          divider
                          secondaryAction={
                            <Button
                              size="small"
                              component={RouterLink}
                              to={`/admin/solicitudes?tab=${s.estado === 'lista_espera' ? 'lista_espera' : 'pendientes'}&id=${s.id}`}
                            >
                              Revisar
                            </Button>
                          }
                        >
                          <ListItemText
                            primary={`${s.codigo} · ${s.paciente}`}
                            secondary={`Solicitud para hoy sin ficha · ${s.especialidad}`}
                          />
                          <StatusChip estado={s.estado} sx={{ mr: 1 }} />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>

          <Tabs
            value={tab}
            onChange={(_e, v) => setParams(v === 'fichas' ? { vista: 'fichas' } : {}, { replace: true })}
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
            aria-label="Vista"
          >
            <Tab value="sala" label="Sala de espera y llamado" sx={{ minHeight: 48 }} />
            <Tab
              value="fichas"
              label={`Fichas del día (${(day.data || []).length})`}
              sx={{ minHeight: 48 }}
            />
          </Tabs>
          {tab === 'sala' ? (
            <QueueBoard queue={queue.data} loading={queue.loading} act={act} />
          ) : (
            <DataTable
              columns={columns}
              rows={day.data || []}
              loading={day.loading && !day.data}
              pageSize={25}
              rowsPerPageOptions={[25, 50, 100]}
              searchPlaceholder="Filtrar fichas del día…"
              empty={{ icon: ConfirmationNumber, title: 'Hoy no hay fichas emitidas' }}
              ariaLabel="Fichas del día"
            />
          )}
        </>
      )}

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {menu?.f && (
          <MenuItem
            onClick={() => {
              const f = menu.f;
              setMenu(null);
              act(
                'setPriority',
                f,
                f.prioridad === 'preferente' ? 'Prioridad normal.' : 'Marcada como atención preferente.',
                { args: f.prioridad === 'preferente' ? 'normal' : 'preferente' },
              );
            }}
          >
            {menu.f.prioridad === 'preferente' ? 'Quitar atención preferente' : 'Marcar atención preferente'}
          </MenuItem>
        )}
        {menu?.f?.estado === 'confirmada' && (
          <MenuItem
            onClick={() => {
              setResched(menu.f);
              setMenu(null);
            }}
          >
            Reprogramar
          </MenuItem>
        )}
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            setCancelF(menu.f);
            setMenu(null);
          }}
        >
          Cancelar ficha
        </MenuItem>
      </Menu>
      {checkIn && <CheckInDialog ficha={checkIn} onClose={() => setCheckIn(null)} onConfirm={doCheckIn} />}
      <ReasonDialog
        open={Boolean(cancelF)}
        title={`¿Cancelar la ficha ${cancelF?.codigoVisible}?`}
        message="El cupo quedará libre. Si había solicitudes en lista de espera para ese día se avisará a recepción."
        motivos={MOTIVOS_CANCELACION}
        confirmLabel="Cancelar ficha"
        onConfirm={async (v) => {
          await act('cancel', cancelF, `Ficha ${cancelF.codigoVisible} cancelada.`, { args: v });
          setCancelF(null);
        }}
        onClose={() => setCancelF(null)}
      />
      {resched && (
        <RescheduleDialog
          open
          ficha={resched}
          onClose={() => setResched(null)}
          onDone={() => setResched(null)}
        />
      )}
      <WalkInDialog open={walkIn} onClose={() => setWalkIn(false)} />
    </>
  );
}
