/** Detalle de una solicitud con historial y acciones (Épica 8). */
import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import CheckCircle from '@mui/icons-material/CheckCircle';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import Block from '@mui/icons-material/Block';
import EventBusy from '@mui/icons-material/EventBusy';
import EventRepeat from '@mui/icons-material/EventRepeat';
import Lock from '@mui/icons-material/Lock';
import StatusChip from '@/components/common/StatusChip';
import ReasonDialog from '@/components/operations/ReasonDialog';
import BlockPicker from '@/components/operations/BlockPicker';
import RescheduleDialog from '@/components/operations/RescheduleDialog';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useNotify } from '@/context/NotifyContext';
import { requestAdminService } from '@/services/requestAdminService';
import { MOTIVOS_CANCELACION, MOTIVOS_RECHAZO, TIPOS_DOCUMENTO } from '@/config/constants';
import { ageAt, formatDate, formatDateLong, formatDateTime } from '@/utils/dates';

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

function Field({ label, children }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 1.5, py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

function ApproveDialog({ open, detail, onClose, onDone }) {
  const { session } = useAuth();
  const notify = useNotify();
  const full = useMediaQuery((t) => t.breakpoints.down('sm'));
  const [horarioId, setHorarioId] = useState('');
  const [busy, setBusy] = useState(false);
  const libres = detail.bloques.reduce(
    (s, b) => s + (detail.canal === 'web' ? b.publicosLibres : b.libres),
    0,
  );
  const submit = async () => {
    setBusy(true); // evita doble envío
    try {
      const f = await requestAdminService.approve(session, detail.id, { horarioId: horarioId || undefined });
      notify.success(`Ficha ${f.codigoVisible} emitida (hora estimada ${f.horaEstimada}).`);
      onDone();
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={full}
      aria-labelledby="approve-title"
    >
      <DialogTitle id="approve-title">Aprobar y emitir ficha · {detail.codigo}</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ mb: 1 }}>
          {detail.especialidad} · {cap(formatDateLong(detail.fecha))}
        </Typography>
        {detail.canal === 'web' && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Solicitud web: solo puede usar cupos web. Los cupos de ventanilla quedan para pacientes presentes.
          </Typography>
        )}
        {libres === 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No quedan cupos para esta fecha. Puede pasar la solicitud a lista de espera.
          </Alert>
        )}
        <BlockPicker
          bloques={detail.bloques}
          value={horarioId}
          onChange={setHorarioId}
          canal={detail.canal}
          auto={libres > 0}
          medicoPreferidoId={detail.medicoPreferidoId}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={busy || libres === 0}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
        >
          Emitir ficha
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function RequestDetailDrawer({ id, onClose }) {
  const { session } = useAuth();
  const notify = useNotify();
  const confirm = useConfirm();
  const full = useMediaQuery((t) => t.breakpoints.down('md'));
  const [dialog, setDialog] = useState(null); // 'aprobar' | 'rechazar' | 'cancelar' | 'reprogramar'
  const {
    data: d,
    loading,
    error,
  } = useAsync(
    () => (id ? requestAdminService.getDetail(session, id) : null),
    [id, session.usuarioId, session.activeCenterId],
    { watch: ['solicitudes', 'fichas', 'pacientes'] },
  );
  const can = (a) => d?.acciones.includes(a);
  const run = async (fn, ok) => {
    try {
      await fn();
      notify.success(ok);
      setDialog(null);
    } catch (e) {
      notify.error(e);
    }
  };

  const waitlist = async () => {
    if (
      !(await confirm({
        title: `¿Pasar ${d.codigo} a lista de espera?`,
        message:
          'Quedará en espera de un cupo para la misma fecha. Se le avisará a recepción si se libera uno.',
        confirmLabel: 'Pasar a lista de espera',
      }))
    )
      return;
    await run(() => requestAdminService.moveToWaitlist(session, d.id), 'Solicitud en lista de espera.');
  };

  const p = d?.paciente;
  return (
    <Drawer
      anchor="right"
      open={Boolean(id)}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: full ? '100%' : 520 } } }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'center', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
          Solicitud {d?.codigo}
        </Typography>
        <IconButton onClick={onClose} aria-label="Cerrar detalle" sx={{ width: 44, height: 44 }}>
          <Close />
        </IconButton>
      </Stack>
      <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
        {loading && !d ? (
          <Skeleton variant="rounded" height={300} />
        ) : error ? (
          <Alert severity="error">{error.message}</Alert>
        ) : d ? (
          <Stack spacing={2}>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <StatusChip estado={d.estado} />
              {d.ficha && (
                <StatusChip
                  estado={d.ficha.estado}
                  label={`Ficha ${d.ficha.codigo} · ${d.ficha.horaEstimada}`}
                />
              )}
              <StatusChip estado={d.canal} />
            </Stack>
            {p.bloqueo?.activo && (
              <Alert severity="error" icon={<Lock />}>
                Paciente bloqueado por inasistencia desde el {formatDateTime(p.bloqueo.desde)}. No se le
                pueden emitir fichas hasta habilitarlo (Pacientes).
              </Alert>
            )}
            {d.datosPorVerificar && (
              <Alert severity="warning">
                Datos por verificar: lo ingresado en el portal no coincide con el registro existente del
                paciente. Verifique el documento al presentarse.
              </Alert>
            )}
            {d.otrasActivas.length > 0 && (
              <Alert severity="info">
                Otras solicitudes activas del paciente:{' '}
                {d.otrasActivas
                  .map((o) => `${o.codigo} (${o.especialidad}, ${formatDate(o.fecha)})`)
                  .join(' · ')}
              </Alert>
            )}
            <Box>
              <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
                Solicitud
              </Typography>
              <Field label="Especialidad">{d.especialidad}</Field>
              <Field label="Fecha">{cap(formatDateLong(d.fecha))}</Field>
              <Field label="Profesional preferido">{d.medicoPreferido || 'Cualquiera'}</Field>
              {d.fichaDetalle && (
                <Field label="Ficha">
                  {d.fichaDetalle.codigoVisible} · {d.fichaDetalle.medico} · {d.fichaDetalle.consultorio} ·{' '}
                  {d.fichaDetalle.horaEstimada}
                </Field>
              )}
              {d.motivo && <Field label="Motivo">{d.motivo}</Field>}
              <Field label="Recibida">{formatDateTime(d.creadoEn)}</Field>
              {!session.activeCenterId && <Field label="Centro">{d.centro}</Field>}
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
                Paciente
              </Typography>
              <Field label="Nombre">{p.nombre}</Field>
              <Field label="Documento">
                {TIPOS_DOCUMENTO[p.tipoDocumento]} {p.numeroDocumento}
                {p.complemento ? `-${p.complemento}` : ''}
              </Field>
              <Field label="Nacimiento">
                {formatDate(p.fechaNacimiento)} ({ageAt(p.fechaNacimiento)} años)
              </Field>
              <Field label="Teléfono">{p.telefono}</Field>
              <Field label="Verificado">{p.verificado ? 'Sí' : 'No (verificar documento al llegar)'}</Field>
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
                Historial
              </Typography>
              <Stack component="ol" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {[...d.historial].reverse().map((h, i) => (
                  <Box component="li" key={i} sx={{ borderLeft: 3, borderColor: 'divider', pl: 1.5 }}>
                    <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <StatusChip estado={h.estado} />
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(h.fecha)} · {h.usuario}
                      </Typography>
                    </Stack>
                    {h.nota && (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {h.nota}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        ) : null}
      </Box>
      {d && (
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', p: 2, borderTop: 1, borderColor: 'divider' }}>
          {can('aprobar') && (
            <Button
              variant="contained"
              startIcon={<CheckCircle />}
              onClick={() => setDialog('aprobar')}
              disabled={p.bloqueo?.activo}
            >
              Aprobar y emitir
            </Button>
          )}
          {can('a_lista_espera') && (
            <Button variant="outlined" startIcon={<HourglassEmpty />} onClick={waitlist}>
              Lista de espera
            </Button>
          )}
          {d.fichaDetalle?.estado === 'confirmada' && (
            <Button variant="outlined" startIcon={<EventRepeat />} onClick={() => setDialog('reprogramar')}>
              Reprogramar
            </Button>
          )}
          {can('rechazar') && (
            <Button color="error" startIcon={<Block />} onClick={() => setDialog('rechazar')}>
              Rechazar
            </Button>
          )}
          {can('cancelar') &&
            (!d.fichaDetalle || ['confirmada', 'en_espera'].includes(d.fichaDetalle.estado)) && (
              <Button color="error" startIcon={<EventBusy />} onClick={() => setDialog('cancelar')}>
                Cancelar
              </Button>
            )}
        </Stack>
      )}
      {d && dialog === 'aprobar' && (
        <ApproveDialog open detail={d} onClose={() => setDialog(null)} onDone={() => setDialog(null)} />
      )}
      <ReasonDialog
        open={dialog === 'rechazar'}
        title={`¿Rechazar la solicitud ${d?.codigo}?`}
        message="El ciudadano verá el motivo al consultar su solicitud."
        motivos={MOTIVOS_RECHAZO}
        confirmLabel="Rechazar solicitud"
        onConfirm={(v) => run(() => requestAdminService.reject(session, d.id, v), 'Solicitud rechazada.')}
        onClose={() => setDialog(null)}
      />
      <ReasonDialog
        open={dialog === 'cancelar'}
        title={`¿Cancelar la solicitud ${d?.codigo}?`}
        message={
          d?.fichaDetalle
            ? `También se cancelará la ficha ${d.fichaDetalle.codigoVisible} y se liberará su cupo.`
            : 'La solicitud dejará de estar activa.'
        }
        motivos={MOTIVOS_CANCELACION}
        confirmLabel="Cancelar solicitud"
        onConfirm={(v) => run(() => requestAdminService.cancel(session, d.id, v), 'Solicitud cancelada.')}
        onClose={() => setDialog(null)}
      />
      {d?.fichaDetalle && dialog === 'reprogramar' && (
        <RescheduleDialog
          open
          ficha={d.fichaDetalle}
          onClose={() => setDialog(null)}
          onDone={() => setDialog(null)}
        />
      )}
    </Drawer>
  );
}
