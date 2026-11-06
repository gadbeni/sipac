/** /admin/perfil — datos de la cuenta, centros, permisos y cambio de contraseña (simulado). */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useForm } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import FormTextField from '@/components/forms/FormTextField';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { authService } from '@/services/authService';
import { getDataSource } from '@/services/datasource';
import { isAppError } from '@/services/errors';
import { formatDateTime } from '@/utils/dates';

const PERMISOS_LABEL = {
  'dashboard.ver': 'Ver dashboard',
  'dashboard.global': 'Dashboard de todos los centros',
  'solicitudes.gestionar': 'Gestionar solicitudes',
  'fichas.emitir': 'Emitir fichas de ventanilla',
  'fichas.entregar': 'Entrega de fichas y sala de espera',
  'llamado.controlar': 'Controlar el llamado',
  'fichas.estadoPropio': 'Cambiar estado de sus fichas',
  'agenda.ver': 'Ver agenda',
  'agenda.gestionar': 'Gestionar novedades de agenda',
  'horarios.gestionar': 'Gestionar horarios',
  'medicos.gestionar': 'Gestionar médicos',
  'especialidades.gestionar': 'Especialidades del centro',
  'especialidades.catalogo': 'Catálogo global de especialidades',
  'pacientes.ver': 'Ver pacientes',
  'pacientes.editar': 'Editar pacientes',
  'pacientes.habilitar': 'Habilitar pacientes bloqueados',
  'reportes.ver': 'Ver reportes',
  'reportes.global': 'Reportes de todos los centros',
  'centros.gestionar': 'Gestionar centros',
  'usuarios.gestionar': 'Gestionar usuarios',
  'usuarios.ver': 'Ver usuarios de su centro',
  'centro.cambiar': 'Cambiar de centro de trabajo',
  'demo.restaurar': 'Restaurar datos de demostración',
};

function PasswordField({ name, control, label, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <FormTextField
      name={name}
      control={control}
      label={label}
      type={show ? 'text' : 'password'}
      autoComplete={autoComplete}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShow((x) => !x)}
                aria-label={show ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
                edge="end"
              >
                {show ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

export default function ProfilePage() {
  const { session } = useAuth();
  const notify = useNotify();
  const { hash } = useLocation();
  const [done, setDone] = useState(false);
  const user = useMemo(() => getDataSource().get('usuarios', session.usuarioId), [session.usuarioId]);
  const centros = useMemo(() => {
    const all = getDataSource().list('centros');
    return session.rol === 'admin_central'
      ? ['Todos los centros de la red']
      : session.centrosPermitidos.map((id) => all.find((c) => c.id === id)?.nombre);
  }, [session]);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { actual: '', nueva: '', confirmacion: '' } });

  useEffect(() => {
    if (hash === '#contrasena') document.getElementById('contrasena')?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  const submit = handleSubmit(async (v) => {
    setDone(false);
    try {
      await authService.changePassword(session, v);
      reset();
      setDone(true);
      notify.success('Contraseña actualizada.');
    } catch (e) {
      if (isAppError(e) && e.details?.fields)
        for (const [n, m] of Object.entries(e.details.fields)) setError(n, { type: 'server', message: m });
      notify.error(e);
    }
  });

  return (
    <>
      <PageHeader
        title="Mi perfil"
        breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Mi perfil' }]}
      />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ mb: 3 }}>
            <CardHeader title="Cuenta" />
            <CardContent sx={{ pt: 0 }}>
              <Box
                component="dl"
                sx={{ m: 0, display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 1, columnGap: 2 }}
              >
                {[
                  ['Nombre', session.nombre],
                  ['Usuario', <code key="u">{session.username}</code>],
                  ['Correo', session.email],
                  ['Rol', session.rolLabel],
                  ['Centros', centros.join(' · ')],
                  ['Último acceso', formatDateTime(user?.ultimoAcceso) || '—'],
                  ['Sesión vence', formatDateTime(session.expiraEn)],
                ].map(([k, v]) => (
                  <Box key={k} sx={{ display: 'contents' }}>
                    <Typography component="dt" variant="body2" color="text.secondary">
                      {k}
                    </Typography>
                    <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                      {v}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
          <Card>
            <CardHeader
              title="Permisos de su rol"
              subheader="Definidos en la matriz de permisos; no se editan por usuario."
            />
            <CardContent sx={{ pt: 0 }}>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                {session.permisos.map((p) => (
                  <Chip key={p} size="small" label={PERMISOS_LABEL[p] || p} variant="outlined" />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card id="contrasena" sx={{ scrollMarginTop: 90 }}>
            <CardHeader title="Cambiar contraseña" subheader="Simulado: se guarda solo en este navegador." />
            <CardContent sx={{ pt: 0 }}>
              {done && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Su contraseña fue actualizada. Úsela en su próximo ingreso.
                </Alert>
              )}
              <Box component="form" noValidate onSubmit={submit}>
                <Stack spacing={2}>
                  <PasswordField
                    name="actual"
                    control={control}
                    label="Contraseña actual"
                    autoComplete="current-password"
                  />
                  <PasswordField
                    name="nueva"
                    control={control}
                    label="Nueva contraseña"
                    autoComplete="new-password"
                  />
                  <PasswordField
                    name="confirmacion"
                    control={control}
                    label="Repetir nueva contraseña"
                    autoComplete="new-password"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Mínimo 8 caracteres, con letras y números.
                  </Typography>
                  <Box>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isSubmitting}
                      startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                      Guardar contraseña
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
