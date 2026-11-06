/** /admin/pacientes/:id — datos administrativos, bloqueo, verificación e historial en el centro. */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import LockOpen from '@mui/icons-material/LockOpen';
import VerifiedUser from '@mui/icons-material/VerifiedUser';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import StatusChip from '@/components/common/StatusChip';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import FormTextField from '@/components/forms/FormTextField';
import FormSelect from '@/components/forms/FormSelect';
import FormDatePicker from '@/components/forms/FormDatePicker';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useNotify } from '@/context/NotifyContext';
import { patientService, CAMPOS } from '@/services/patientService';
import { isAppError } from '@/services/errors';
import { TIPOS_DOCUMENTO } from '@/config/constants';
import { formatDate, formatDateTime, today } from '@/utils/dates';

const fmtVal = (campo, v) =>
  v == null || v === ''
    ? '—'
    : campo === 'fechaNacimiento'
      ? formatDate(v)
      : typeof v === 'boolean'
        ? v
          ? 'Sí'
          : 'No'
        : campo === 'tipoDocumento'
          ? TIPOS_DOCUMENTO[v]
          : String(v);

function EditDialog({ p, onClose }) {
  const { session } = useAuth();
  const notify = useNotify();
  const full = useMediaQuery((t) => t.breakpoints.down('sm'));
  const toForm = () => ({
    tipoDocumento: p.tipoDocumento,
    numeroDocumento: p.numeroDocumento,
    complemento: p.complemento || '',
    nombres: p.nombres,
    apellidos: p.apellidos,
    fechaNacimiento: p.fechaNacimiento,
    sexo: p.sexo || '',
    telefono: (p.telefono || '').replace(/^\+591\s?/, ''),
  });
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm({ defaultValues: toForm() });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => reset(toForm()), [p.id]);
  const submit = handleSubmit(async (v) => {
    try {
      await patientService.update(session, p.id, v);
      notify.success('Datos del paciente actualizados.');
      onClose();
    } catch (e) {
      if (isAppError(e) && e.details?.fields)
        for (const [n, m] of Object.entries(e.details.fields)) setError(n, { type: 'server', message: m });
      notify.error(e);
    }
  });
  return (
    <Dialog
      open
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={full}
      aria-labelledby="pac-edit-title"
    >
      <DialogTitle id="pac-edit-title">Editar datos de {p.nombre}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} component="form" id="pac-form" noValidate onSubmit={submit}>
          <Grid size={{ xs: 12, sm: 5 }}>
            <FormSelect
              name="tipoDocumento"
              control={control}
              label="Tipo de documento"
              options={Object.entries(TIPOS_DOCUMENTO).map(([value, label]) => ({ value, label }))}
            />
          </Grid>
          <Grid size={{ xs: 8, sm: 5 }}>
            <FormTextField
              name="numeroDocumento"
              control={control}
              label="Número"
              transform={(x) => x.toUpperCase().replace(/[\s-]/g, '')}
            />
          </Grid>
          <Grid size={{ xs: 4, sm: 2 }}>
            <FormTextField
              name="complemento"
              control={control}
              label="Compl."
              transform={(x) => x.toUpperCase()}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormTextField name="nombres" control={control} label="Nombres" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormTextField name="apellidos" control={control} label="Apellidos" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormDatePicker
              name="fechaNacimiento"
              control={control}
              label="Fecha de nacimiento"
              maxDate={today()}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormSelect
              name="sexo"
              control={control}
              label="Sexo (opcional)"
              options={[
                { value: '', label: 'No indicado' },
                { value: 'F', label: 'Femenino' },
                { value: 'M', label: 'Masculino' },
              ]}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormTextField
              name="telefono"
              control={control}
              label="Teléfono"
              transform={(x) => x.replace(/\D/g, '').slice(0, 8)}
              helperText="8 dígitos"
            />
          </Grid>
        </Grid>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Los cambios quedan registrados con su usuario y la fecha. No se registra información clínica.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form="pac-form"
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DataCheck({ s, p, onResolve }) {
  const campos = Object.entries(s.datosIngresados || {});
  return (
    <Alert severity="warning" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
      <AlertTitle>Datos por verificar · solicitud {s.codigo}</AlertTitle>
      Lo ingresado en el portal no coincide con el registro. Verifique con el documento del paciente.
      {campos.length > 0 && (
        <Box sx={{ overflowX: 'auto', mt: 1 }}>
          <Table size="small" aria-label="Comparación de datos">
            <TableHead>
              <TableRow>
                <TableCell>Dato</TableCell>
                <TableCell>Registro actual</TableCell>
                <TableCell>Ingresado en el portal</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campos.map(([k, v]) => (
                <TableRow
                  key={k}
                  sx={String(p[k] ?? '') !== String(v ?? '') ? { '& td': { fontWeight: 700 } } : undefined}
                >
                  <TableCell>{CAMPOS[k]}</TableCell>
                  <TableCell>{fmtVal(k, p[k])}</TableCell>
                  <TableCell>{fmtVal(k, v)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      <Stack direction="row" sx={{ gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
        {campos.length > 0 && (
          <Button size="small" variant="contained" color="warning" onClick={() => onResolve(s, 'aplicar')}>
            Actualizar con lo ingresado
          </Button>
        )}
        <Button size="small" variant="outlined" color="inherit" onClick={() => onResolve(s, 'mantener')}>
          Mantener el registro
        </Button>
      </Stack>
    </Alert>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const notify = useNotify();
  const confirm = useConfirm();
  const [tab, setTab] = useState('fichas');
  const [edit, setEdit] = useState(false);
  const [unblock, setUnblock] = useState(false);
  const [nota, setNota] = useState('');
  const {
    data: p,
    loading,
    error,
  } = useAsync(() => patientService.getDetail(session, id), [id, session.usuarioId, session.activeCenterId], {
    watch: ['pacientes', 'fichas', 'solicitudes'],
  });

  if (loading && !p) return <Skeleton variant="rounded" height={300} />;
  if (error)
    return (
      <>
        <PageHeader
          title="Paciente"
          breadcrumbs={[
            { label: 'Panel', to: '/admin' },
            { label: 'Pacientes', to: '/admin/pacientes' },
            { label: 'Paciente' },
          ]}
        />
        <Alert severity="warning">{error.message}</Alert>
      </>
    );

  const run = async (fn, ok) => {
    try {
      await fn();
      notify.success(ok);
    } catch (e) {
      notify.error(e);
    }
  };
  const resolve = async (s, accion) => {
    const ok = await confirm({
      title:
        accion === 'aplicar'
          ? '¿Actualizar el registro con lo ingresado en el portal?'
          : '¿Mantener el registro actual?',
      message:
        accion === 'aplicar'
          ? 'Confírmelo solo después de ver el documento del paciente. El cambio quedará en el historial.'
          : 'La solicitud quedará marcada como verificada sin cambiar los datos.',
      confirmLabel: accion === 'aplicar' ? 'Actualizar' : 'Mantener',
    });
    if (ok) await run(() => patientService.resolveDataCheck(session, s.id, accion), 'Datos verificados.');
  };

  const fichaCols = [
    {
      field: 'fecha',
      header: 'Fecha',
      primary: true,
      render: (f) => `${formatDate(f.fecha)} ${f.hora}`,
      sortValue: (f) => f.fecha + f.hora,
    },
    { field: 'codigo', header: 'Ficha', render: (f) => <strong>{f.codigo}</strong> },
    { field: 'especialidad', header: 'Especialidad' },
    { field: 'medico', header: 'Profesional', hideOnMobile: true },
    ...(session.activeCenterId ? [] : [{ field: 'centro', header: 'Centro', hideOnMobile: true }]),
    { field: 'estado', header: 'Estado', render: (f) => <StatusChip estado={f.estado} /> },
  ];
  const solCols = [
    {
      field: 'codigo',
      header: 'Código',
      primary: true,
      render: (s) => <code style={{ whiteSpace: 'nowrap' }}>{s.codigo}</code>,
    },
    { field: 'fecha', header: 'Para el', render: (s) => formatDate(s.fecha) },
    { field: 'especialidad', header: 'Especialidad' },
    ...(session.activeCenterId ? [] : [{ field: 'centro', header: 'Centro', hideOnMobile: true }]),
    { field: 'estado', header: 'Estado', render: (s) => <StatusChip estado={s.estado} /> },
    { field: 'creadoEn', header: 'Recibida', render: (s) => formatDateTime(s.creadoEn), hideOnMobile: true },
  ];
  const historial = [
    ...p.auditoria.map((a) => ({
      fecha: a.fecha,
      usuario: a.usuario,
      texto: `${a.accion === 'edicion' ? 'Edición' : a.accion === 'verificacion' ? 'Verificación' : `Actualización: ${a.accion}`}: ${a.cambios.map((c) => `${CAMPOS[c.campo] || c.campo} ${fmtVal(c.campo, c.antes)} → ${fmtVal(c.campo, c.despues)}`).join('; ')}`,
    })),
    ...p.historialBloqueos.map((h) => ({
      fecha: h.fecha,
      usuario: h.usuario,
      texto: `${h.accion === 'bloqueo' ? 'Bloqueado por inasistencia' : 'Habilitado'}${h.centro ? ` (${h.centro})` : ''}${h.nota ? `: ${h.nota}` : ''}`,
    })),
  ].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <>
      <PageHeader
        title={p.nombre}
        subtitle={`${TIPOS_DOCUMENTO[p.tipoDocumento]} ${p.numeroDocumento}${p.complemento ? `-${p.complemento}` : ''} · ${p.edad} años`}
        breadcrumbs={[
          { label: 'Panel', to: '/admin' },
          { label: 'Pacientes', to: '/admin/pacientes' },
          { label: p.nombre },
        ]}
        actions={
          p.puedeEditar && (
            <>
              {!p.verificado && (
                <Button
                  variant="outlined"
                  startIcon={<VerifiedUser />}
                  onClick={() =>
                    run(
                      () => patientService.setVerified(session, p.id, true),
                      'Documento marcado como verificado.',
                    )
                  }
                >
                  Marcar verificado
                </Button>
              )}
              <Button variant="outlined" startIcon={<Edit />} onClick={() => setEdit(true)}>
                Editar datos
              </Button>
            </>
          )
        }
      />
      <Stack spacing={2} sx={{ mb: 2 }}>
        {p.bloqueado && (
          <Alert
            severity="error"
            action={
              p.puedeHabilitar && (
                <Button color="inherit" startIcon={<LockOpen />} onClick={() => setUnblock(true)}>
                  Habilitar
                </Button>
              )
            }
          >
            <AlertTitle>Bloqueado por inasistencia</AlertTitle>
            Desde el {formatDateTime(p.bloqueo.desde)} · ficha {p.bloqueoFicha || '—'} en{' '}
            {p.bloqueoCentro || '—'}. No puede solicitar fichas por internet ni recibir fichas de ventanilla
            hasta que se lo habilite.
            {!p.puedeHabilitar &&
              ' Solo la administración central o el centro donde ocurrió la inasistencia pueden habilitarlo.'}
          </Alert>
        )}
        {p.puedeEditar && p.porVerificar.map((s) => <DataCheck key={s.id} s={s} p={p} onResolve={resolve} />)}
      </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 2 }}>
            <CardHeader title="Datos" />
            <CardContent sx={{ pt: 0 }}>
              <Box
                component="dl"
                sx={{ m: 0, display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 1, columnGap: 1.5 }}
              >
                {[
                  ['Nacimiento', `${formatDate(p.fechaNacimiento)} (${p.edad} años)`],
                  ['Sexo', p.sexo === 'F' ? 'Femenino' : p.sexo === 'M' ? 'Masculino' : 'No indicado'],
                  ['Teléfono', p.telefono],
                  ['Documento', p.verificado ? 'Verificado' : 'Sin verificar'],
                  [
                    'Registro',
                    p.origen === 'web' ? 'Portal' : p.origen === 'ventanilla' ? 'Ventanilla' : 'Demostración',
                  ],
                ].map(([k, v]) => (
                  <Box key={k} sx={{ display: 'contents' }}>
                    <Typography component="dt" variant="body2" color="text.secondary">
                      {k}
                    </Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 500 }}>
                      {v}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title={session.activeCenterId ? 'En este centro' : 'En la red'} />
            <CardContent sx={{ pt: 0 }}>
              <Stack direction="row" spacing={2}>
                {[
                  ['Fichas', p.resumen.fichas],
                  ['Atendidas', p.resumen.atendidas],
                  ['Ausencias', p.resumen.ausencias],
                ].map(([k, v]) => (
                  <Box key={k}>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{v}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {k}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Tabs
            value={tab}
            onChange={(_e, v) => setTab(v)}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{ mb: 1.5, borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab value="fichas" label={`Fichas (${p.fichas.length})`} sx={{ minHeight: 48 }} />
            {session.rol !== 'medico' && (
              <Tab
                value="solicitudes"
                label={`Solicitudes (${p.solicitudes.length})`}
                sx={{ minHeight: 48 }}
              />
            )}
            <Tab value="historial" label="Historial de cambios" sx={{ minHeight: 48 }} />
          </Tabs>
          {tab === 'fichas' && (
            <DataTable
              columns={fichaCols}
              rows={p.fichas}
              searchable={false}
              initialSort={{ field: 'fecha', direction: 'desc' }}
              empty={{ title: 'Sin fichas en este centro' }}
              ariaLabel="Fichas del paciente"
            />
          )}
          {tab === 'solicitudes' && (
            <DataTable
              columns={solCols}
              rows={p.solicitudes}
              searchable={false}
              onRowClick={(s) =>
                navigate(
                  `/admin/solicitudes?tab=${s.estado === 'pendiente' ? 'pendientes' : s.estado === 'aprobada' ? 'emitidas' : s.estado === 'lista_espera' ? 'lista_espera' : 'cerradas'}&id=${s.id}`,
                )
              }
              empty={{ title: 'Sin solicitudes en este centro' }}
              ariaLabel="Solicitudes del paciente"
            />
          )}
          {tab === 'historial' && (
            <Card>
              <CardContent>
                {historial.length === 0 ? (
                  <Typography color="text.secondary">Sin cambios registrados.</Typography>
                ) : (
                  <Stack component="ol" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                    {historial.map((h, i) => (
                      <Box component="li" key={i} sx={{ borderLeft: 3, borderColor: 'divider', pl: 1.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(h.fecha)} · {h.usuario}
                        </Typography>
                        <Typography variant="body2">{h.texto}</Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}
          <Button component={RouterLink} to="/admin/pacientes" sx={{ mt: 2 }}>
            Volver a pacientes
          </Button>
        </Grid>
      </Grid>
      {edit && <EditDialog p={p} onClose={() => setEdit(false)} />}
      <ConfirmDialog
        open={unblock}
        title={`¿Habilitar a ${p.nombre}?`}
        message="Podrá volver a solicitar fichas. Indique por qué se lo habilita (queda en el historial)."
        confirmLabel="Habilitar"
        confirmDisabled={nota.trim().length < 5}
        onConfirm={async () => {
          await run(() => patientService.unblock(session, p.id, { nota }), 'Paciente habilitado.');
          setUnblock(false);
          setNota('');
        }}
        onClose={() => setUnblock(false)}
      >
        <TextField
          label="Nota"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          multiline
          minRows={2}
          required
          helperText="Mínimo 5 caracteres."
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />
      </ConfirmDialog>
    </>
  );
}
