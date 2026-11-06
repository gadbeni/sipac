/** /consultar — consulta pública por código + documento (RN-PAC-04) y cancelación (RN-SOL-13). */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import Print from '@mui/icons-material/Print';
import EventBusy from '@mui/icons-material/EventBusy';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import FormTextField from '@/components/forms/FormTextField';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import RequestReceipt from '@/components/requests/RequestReceipt';
import { useNotify } from '@/context/NotifyContext';
import { requestService } from '@/services/requestService';
import { consultSchema } from '@/services/schemas/requestSchema';
import { isAppError } from '@/services/errors';
import { readRememberedPatient } from '@/utils/rememberedPatient';
import { formatDate } from '@/utils/dates';

const MOTIVOS = [
  'Ya no necesito la atención',
  'No podré asistir ese día',
  'Me equivoqué en los datos',
  'Otro',
];

export default function ConsultPage() {
  const [params] = useSearchParams();
  const notify = useNotify();
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [lastQuery, setLastQuery] = useState(null);
  const resultRef = useRef(null);
  const {
    control,
    handleSubmit,
    setFocus,
    formState: { isSubmitting },
  } = useForm({
    resolver: zodResolver(consultSchema),
    defaultValues: {
      codigo: (params.get('codigo') || '').toUpperCase(),
      numeroDocumento: readRememberedPatient()?.numeroDocumento || '',
    },
    mode: 'onTouched',
  });

  useEffect(() => {
    if (params.get('codigo')) setFocus('numeroDocumento');
  }, [params, setFocus]);

  // Lleva el foco al resultado para lectores de pantalla.
  useEffect(() => {
    if (view?.codigo) resultRef.current?.focus();
  }, [view?.codigo]);

  const submit = handleSubmit(async (values) => {
    setError(null);
    setView(null);
    try {
      const v = await requestService.getPublicStatus(values);
      setLastQuery(values);
      setView(v);
    } catch (e) {
      setError(isAppError(e) ? e.message : 'No se pudo realizar la consulta.');
    }
  });

  const cancel = async () => {
    try {
      const v = await requestService.cancelByCitizen({ ...lastQuery, motivo });
      setView(v);
      setCancelOpen(false);
      notify.success('Su solicitud fue cancelada.');
    } catch (e) {
      setCancelOpen(false);
      notify.error(e);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Box className="sipac-no-print">
        <PageHeader
          title="Consultar solicitud"
          subtitle="Ingrese el código de su solicitud y su número de documento."
          description="Consulte el estado de su solicitud de ficha médica con su código y número de documento."
        />
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box component="form" noValidate onSubmit={submit}>
              <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <FormTextField
                    name="codigo"
                    control={control}
                    label="Código de solicitud"
                    placeholder="CSC-7K3F9Q"
                    autoComplete="off"
                    transform={(v) => v.toUpperCase().replace(/\s/g, '')}
                    slotProps={{
                      htmlInput: {
                        maxLength: 10,
                        spellCheck: false,
                        style: { fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' },
                      },
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormTextField
                    name="numeroDocumento"
                    control={control}
                    label="Número de documento"
                    autoComplete="off"
                    transform={(v) => v.toUpperCase().replace(/[\s-]/g, '')}
                    slotProps={{ htmlInput: { maxLength: 15 } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <Search />}
                    disabled={isSubmitting}
                    sx={{ minHeight: 56 }}
                  >
                    Consultar
                  </Button>
                </Grid>
              </Grid>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              Por seguridad, si los datos no coinciden no indicamos cuál es incorrecto.
            </Typography>
          </CardContent>
        </Card>
        {error && (
          <Alert severity="warning" role="alert" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
      </Box>

      {view && (
        <Box ref={resultRef} tabIndex={-1} sx={{ outline: 'none' }}>
          <RequestReceipt view={view} printable title="Estado de la solicitud" />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ mt: 2 }}
            className="sipac-no-print"
          >
            <Button variant="outlined" startIcon={<Print />} onClick={() => window.print()}>
              Imprimir
            </Button>
            {view.puedeCancelar && (
              <Button
                color="error"
                variant="outlined"
                startIcon={<EventBusy />}
                onClick={() => setCancelOpen(true)}
              >
                {view.ficha ? 'Cancelar ficha' : 'Cancelar solicitud'}
              </Button>
            )}
          </Stack>
          {view.ficha && view.estado === 'confirmada' && !view.puedeCancelar && view.cancelarHasta && (
            <Alert severity="info" sx={{ mt: 2 }} className="sipac-no-print">
              Faltan menos de {view.cancelarHasta.horasAntes} horas para su atención: ya no puede cancelar
              desde el portal. Si no podrá asistir, comuníquese con el centro al {view.centro.telefono}.
            </Alert>
          )}
          {view.ficha && view.puedeCancelar && view.cancelarHasta && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1 }}
              className="sipac-no-print"
            >
              Puede cancelar hasta {view.cancelarHasta.horasAntes} horas antes de la hora estimada (
              {formatDate(view.cancelarHasta.fecha)} {view.cancelarHasta.hora}). Cancelar con anticipación no
              bloquea su documento.
            </Typography>
          )}
        </Box>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title={view?.ficha ? `¿Cancelar la ficha ${view.ficha.codigo}?` : '¿Cancelar la solicitud?'}
        message={
          view?.ficha
            ? 'El cupo quedará libre para otra persona. Esta acción no se puede deshacer.'
            : 'La solicitud dejará de estar en revisión. Esta acción no se puede deshacer.'
        }
        confirmLabel="Sí, cancelar"
        cancelLabel="Volver"
        destructive
        onConfirm={cancel}
        onClose={() => setCancelOpen(false)}
      >
        <TextField select label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          {MOTIVOS.map((m) => (
            <MenuItem key={m} value={m}>
              {m}
            </MenuItem>
          ))}
        </TextField>
      </ConfirmDialog>
    </Container>
  );
}
