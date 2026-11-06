/**
 * Comprobante de solicitud (asistente y consulta). Imprimible: con `printable`, al imprimir
 * solo se muestra esta tarjeta (`@media print`).
 */
import { Alert, Box, Card, CardContent, Divider, GlobalStyles, Stack, Typography } from '@mui/material';
import StatusChip from '@/components/common/StatusChip';
import { appConfig } from '@/config/app.config';
import { formatDateLong, formatDateTime } from '@/utils/dates';

const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

function Row({ label, children }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' },
        gap: { xs: 0, sm: 2 },
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { border: 0 },
      }}
    >
      <Typography variant="body2" color="text.secondary" component="dt">
        {label}
      </Typography>
      <Typography component="dd" sx={{ m: 0, fontWeight: 500, overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
    </Box>
  );
}

function horarioText(v) {
  if (v.ficha) return `${v.ficha.horaEstimada} (hora estimada; el orden de atención es por llamado)`;
  if (v.ventana)
    return `Entre ${v.ventana.horaInicio} y ${v.ventana.horaFin} — se confirmará al asignar la ficha`;
  return 'Por confirmar';
}

export default function RequestReceipt({ view: v, printable = false, title = 'Comprobante de solicitud' }) {
  const pendiente = v.estado === 'pendiente' || v.estado === 'lista_espera';
  return (
    <>
      {printable && (
        <GlobalStyles
          styles={{
            '@media print': {
              'body *': { visibility: 'hidden' },
              '.sipac-print, .sipac-print *': { visibility: 'visible' },
              '.sipac-print': {
                position: 'absolute',
                inset: '0 0 auto 0',
                boxShadow: 'none !important',
                border: '1px solid #999 !important',
              },
              '.sipac-no-print': { display: 'none !important' },
              '@page': { margin: '14mm' },
            },
          }}
        />
      )}
      <Card className={printable ? 'sipac-print' : undefined} component="section" aria-label={title}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' }, mb: 2 }}
          >
            <Box>
              <Typography variant="overline" color="text.secondary">
                {title}
              </Typography>
              <Typography
                component="p"
                sx={{
                  fontSize: { xs: '1.75rem', sm: '2.25rem' },
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  lineHeight: 1.2,
                }}
              >
                {v.codigo}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Guarde este código: lo necesitará junto con su número de documento para consultar el estado.
              </Typography>
            </Box>
            <Box>
              <StatusChip estado={v.estado} publico size="medium" />
            </Box>
          </Stack>

          {pendiente && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Aún no es una ficha confirmada.</strong> El centro revisará su solicitud y le asignará
              una ficha si hay cupo. Consulte el estado antes de asistir.
            </Alert>
          )}
          {v.estado === 'confirmada' && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Su ficha está confirmada. Preséntese con su documento antes de la hora estimada. Si no asiste,
              su documento quedará bloqueado para nuevas fichas.
            </Alert>
          )}
          {v.ficha?.reprogramada && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Su ficha fue reprogramada. Estos son los datos de la nueva ficha.
            </Alert>
          )}
          {v.motivo && ['cancelada', 'rechazada', 'vencida'].includes(v.estado) && (
            <Alert severity={v.estado === 'rechazada' ? 'error' : 'info'} sx={{ mb: 2 }}>
              Motivo: {v.motivo}
            </Alert>
          )}

          <Box component="dl" sx={{ m: 0 }}>
            <Row label="Centro de salud">
              {v.centro.nombre}
              <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                {v.centro.direccion}, {v.centro.municipio} · {v.centro.telefono}
              </Typography>
            </Row>
            <Row label="Paciente">{v.paciente}</Row>
            <Row label="Especialidad">{v.especialidad}</Row>
            <Row label="Profesional">
              {v.medico ? `${v.medico}${v.medicoAsignado ? '' : ' (preferido)'}` : 'Por asignar'}
            </Row>
            <Row label="Fecha de atención">{cap(formatDateLong(v.ficha?.fecha || v.fecha))}</Row>
            <Row label="Horario">{horarioText(v)}</Row>
            {v.ficha && (
              <Row label="Número de ficha">
                <strong>{v.ficha.codigo}</strong>
                {v.ficha.consultorio && ` · ${v.ficha.consultorio}`}
              </Row>
            )}
            <Row label="Estado">{v.estadoLabel}</Row>
            <Row label="Solicitada el">{formatDateTime(v.creadoEn)}</Row>
          </Box>

          {v.esMenor && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Paciente menor de edad: debe presentarse acompañado de su madre, padre o tutor.
            </Alert>
          )}
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary" component="p">
            {appConfig.appName} · {appConfig.institution.name}.{' '}
            {appConfig.demo.enabled ? appConfig.demo.notice : ''}
          </Typography>
        </CardContent>
      </Card>
    </>
  );
}
