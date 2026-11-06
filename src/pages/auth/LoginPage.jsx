/** /login — ingreso del personal (autenticación SIMULADA, RN-USR-04). */
import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Login from '@mui/icons-material/Login';
import Science from '@mui/icons-material/Science';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import FormTextField from '@/components/forms/FormTextField';
import BrandLogo from '@/components/layout/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { authService } from '@/services/authService';
import { isAppError } from '@/services/errors';
import { appConfig } from '@/config/app.config';

const schema = z.object({
  username: z.string().trim().min(1, 'Ingrese su usuario.'),
  password: z.string().min(1, 'Ingrese su contraseña.'),
});

/** Solo rutas internas del panel como destino (evita redirecciones abiertas). */
const safeNext = (n) => (n && n.startsWith('/admin') && !n.startsWith('//') ? n : '/admin');

export default function LoginPage() {
  useDocumentMeta('Ingreso del personal', 'Ingreso al panel de gestión de fichas (personal de salud).');
  const { session, expired, login } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const next = safeNext(params.get('next'));
  const [users] = useState(() => authService.demoUsers());
  const {
    control,
    handleSubmit,
    setValue,
    setFocus,
    formState: { isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { username: '', password: '' } });

  if (session) return <Navigate to={next} replace />;

  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      const s = await login(v.username, v.password);
      notify.success(`Bienvenido/a, ${s.nombre}`);
      navigate(next, { replace: true });
    } catch (e) {
      setError(isAppError(e) ? e.message : 'No se pudo iniciar sesión.');
    }
  });

  const fillDemo = (u) => {
    setValue('username', u.username, { shouldValidate: true });
    setValue('password', u.password || '', { shouldValidate: true });
    setFocus('password');
  };

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, md: 6 } }}>
      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', mb: 3 }}>
            <BrandLogo compact />
            <Typography variant="h5" component="h1">
              Ingreso del personal
            </Typography>
            <Typography color="text.secondary">Panel de gestión de solicitudes, fichas y agenda.</Typography>
          </Stack>
          {(expired || params.get('expirada')) && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Su sesión expiró. Vuelva a ingresar para continuar.
            </Alert>
          )}
          {params.get('next') && !params.get('expirada') && !expired && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Inicie sesión para acceder a la página solicitada.
            </Alert>
          )}
          {error && (
            <Alert severity="error" role="alert" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box component="form" noValidate onSubmit={submit}>
            <Stack spacing={2}>
              <FormTextField
                name="username"
                control={control}
                label="Usuario"
                autoComplete="username"
                autoFocus
                slotProps={{ htmlInput: { autoCapitalize: 'none', spellCheck: false } }}
              />
              <FormTextField
                name="password"
                control={control}
                label="Contraseña"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShow((x) => !x)}
                          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          edge="end"
                        >
                          {show ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <Login />}
                disabled={isSubmitting}
              >
                Ingresar
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {appConfig.demo.enabled && (
        <Accordion
          sx={{
            mt: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: '12px !important',
            '&:before': { display: 'none' },
          }}
          disableGutters
          elevation={0}
        >
          <AccordionSummary expandIcon={<ExpandMore />} aria-controls="demo-users" id="demo-users-header">
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Science fontSize="small" color="warning" aria-hidden />
              <Typography sx={{ fontWeight: 600 }}>Usuarios de demostración</Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails id="demo-users" sx={{ pt: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Autenticación simulada para la demostración. Contraseña de todos los usuarios:{' '}
              <code>Demo2026!</code>
            </Typography>
            <List dense disablePadding>
              {users.map((u) => (
                <ListItem key={u.username} disablePadding>
                  <ListItemButton onClick={() => fillDemo(u)} aria-label={`Usar ${u.username}`}>
                    <ListItemText
                      primary={
                        <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <code>{u.username}</code>
                          <Chip size="small" label={u.rol} />
                        </Stack>
                      }
                      secondary={u.centros}
                      slotProps={{ secondary: { sx: { mt: 0.5 } } }}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      )}
    </Container>
  );
}
