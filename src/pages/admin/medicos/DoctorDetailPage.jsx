/** /admin/medicos/:id — datos personales, vínculos por centro y horarios en el centro. */
import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import CalendarMonth from '@mui/icons-material/CalendarMonth';
import { Link as RouterLink, useParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import StatusChip from '@/components/common/StatusChip';
import DoctorAvatar from '@/components/portal/DoctorAvatar';
import DoctorFormDialog from './DoctorFormDialog';
import LinkDialog from './LinkDialog';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useNotify } from '@/context/NotifyContext';
import { doctorAdminService } from '@/services/doctorAdminService';
import { DIAS_SEMANA, TIPOS_DOCUMENTO } from '@/config/constants';
import { formatDate } from '@/utils/dates';

export default function DoctorDetailPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const confirm = useConfirm();
  const notify = useNotify();
  const [edit, setEdit] = useState(false);
  const [editLink, setEditLink] = useState(null);
  const {
    data: d,
    loading,
    error,
  } = useAsync(() => doctorAdminService.getDetail(session, id), [id, session.activeCenterId], {
    watch: ['medicos', 'medicoCentros', 'horarios', 'fichas'],
  });

  const toggleLink = async (l) => {
    if (l.activo) {
      const n = doctorAdminService.linkImpact(session, l.id);
      const ok = await confirm({
        title: `¿Desvincular de ${l.centro}?`,
        message: `${n ? `Tiene ${n} fichas próximas en este centro: no se cancelan automáticamente; reprográmelas o cancélelas desde la agenda. ` : ''}Dejará de aparecer en el portal y en la agenda de este centro. Sus otros centros no cambian (RN-MED-03).`,
        confirmLabel: 'Desvincular',
        destructive: true,
      });
      if (!ok) return;
    }
    try {
      await doctorAdminService.setLinkActive(session, l.id, !l.activo);
      notify.success(l.activo ? 'Vínculo desactivado.' : 'Vínculo reactivado.');
    } catch (e) {
      notify.error(e);
    }
  };

  const toggleDoctor = async () => {
    const ok = await confirm({
      title: d.activo ? `¿Desactivar a ${d.nombre} en toda la red?` : `¿Reactivar a ${d.nombre}?`,
      message: d.activo
        ? 'Dejará de atender en todos los centros. Las fichas emitidas no se borran.'
        : 'Volverá a estar disponible en los centros donde tiene vínculos activos.',
      confirmLabel: d.activo ? 'Desactivar' : 'Reactivar',
      destructive: d.activo,
    });
    if (!ok) return;
    try {
      await doctorAdminService.setDoctorActive(session, d.id, !d.activo);
      notify.success(d.activo ? 'Profesional desactivado.' : 'Profesional reactivado.');
    } catch (e) {
      notify.error(e);
    }
  };

  if (loading && !d) return <Skeleton variant="rounded" height={300} />;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  const iniciales = `${d.nombres[0]}${d.apellidos[0]}`;
  return (
    <>
      <PageHeader
        title={d.nombre}
        subtitle={`${d.registroProfesional} · ${TIPOS_DOCUMENTO[d.tipoDocumento]} ${d.numeroDocumento}`}
        breadcrumbs={[
          { label: 'Panel', to: '/admin' },
          { label: 'Médicos', to: '/admin/medicos' },
          { label: d.nombre },
        ]}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<CalendarMonth />}
              component={RouterLink}
              to={`/admin/agenda?medico=${d.id}&vista=semana`}
            >
              Ver agenda
            </Button>
            {d.editablePersonal && (
              <Button variant="outlined" startIcon={<Edit />} onClick={() => setEdit(true)}>
                Editar datos
              </Button>
            )}
            {session.rol === 'admin_central' && (
              <Button color={d.activo ? 'error' : 'primary'} onClick={toggleDoctor}>
                {d.activo ? 'Desactivar en la red' : 'Reactivar'}
              </Button>
            )}
          </>
        }
      />
      {!d.activo && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Profesional desactivado en toda la red.
        </Alert>
      )}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center', mb: 2 }}>
                <DoctorAvatar iniciales={iniciales} size={72} />
                <Typography variant="h6" component="h2">
                  {d.nombre}
                </Typography>
                <StatusChip estado={d.activo ? 'activo' : 'inactivo'} />
              </Stack>
              <Typography variant="body2">Teléfono: {d.telefono || '—'}</Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                Correo: {d.email || '—'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Fichas próximas en este centro: <strong>{d.fichasFuturasLocal}</strong>
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 2 }}>
            <CardHeader
              title="Centros donde trabaja"
              subheader="Cada vínculo tiene su propia agenda. Solo puede editar el de su centro."
            />
            <CardContent sx={{ pt: 0 }}>
              <Stack spacing={1.5}>
                {d.vinculos.map((l) => (
                  <Box
                    key={l.id}
                    sx={{
                      p: 1.5,
                      border: 1,
                      borderColor: l.editable ? 'primary.main' : 'divider',
                      borderRadius: 2,
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      sx={{ justifyContent: 'space-between', gap: 1 }}
                    >
                      <Box>
                        <Typography component="div" sx={{ fontWeight: 600 }}>
                          {l.centro} {l.editable && <Chip size="small" label="Su centro" sx={{ ml: 1 }} />}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {l.especialidades.join(', ')} · {l.cargo} · desde {formatDate(l.fechaInicio)}
                          {l.fechaFin ? ` hasta ${formatDate(l.fechaFin)}` : ''} · {l.fichasFuturas} fichas
                          próximas
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
                        <StatusChip estado={l.activo ? 'activo' : 'inactivo'} />
                        {l.editable && (
                          <>
                            <Button size="small" onClick={() => setEditLink(l)}>
                              Editar
                            </Button>
                            <Button
                              size="small"
                              color={l.activo ? 'error' : 'primary'}
                              onClick={() => toggleLink(l)}
                            >
                              {l.activo ? 'Desvincular' : 'Reactivar'}
                            </Button>
                          </>
                        )}
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
          <Card>
            <CardHeader
              title="Horarios en este centro"
              action={
                <Button size="small" component={RouterLink} to={`/admin/horarios?medico=${d.id}`}>
                  Gestionar horarios
                </Button>
              }
            />
            <CardContent sx={{ pt: 0, overflowX: 'auto' }}>
              {d.horarios.length === 0 ? (
                <Typography color="text.secondary">Sin horarios en este centro.</Typography>
              ) : (
                <Table size="small" aria-label="Horarios">
                  <TableHead>
                    <TableRow>
                      <TableCell>Día</TableCell>
                      <TableCell>Franja</TableCell>
                      <TableCell>Especialidad</TableCell>
                      <TableCell align="right">Cupos (web)</TableCell>
                      <TableCell>Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {d.horarios.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{DIAS_SEMANA[h.diaSemana]}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {h.horaInicio}–{h.horaFin}
                        </TableCell>
                        <TableCell>
                          {h.especialidad} · {h.consultorio}
                        </TableCell>
                        <TableCell align="right">
                          {h.cupos} ({h.cuposPublicos})
                        </TableCell>
                        <TableCell>
                          <StatusChip estado={h.activo ? 'activo' : 'inactivo'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <DoctorFormDialog
        open={edit}
        doctor={d}
        onClose={() => setEdit(false)}
        onSaved={() => setEdit(false)}
      />
      <LinkDialog
        open={Boolean(editLink)}
        doctor={d}
        link={editLink}
        onClose={() => setEditLink(null)}
        onSaved={() => setEditLink(null)}
      />
    </>
  );
}
