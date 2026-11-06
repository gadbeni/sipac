/**
 * /admin/reportes — indicadores por período, centro, especialidad y médico (Épica 12).
 * Filtros en la URL; exportación CSV para Excel e impresión A4/Carta con encabezado
 * institucional (al imprimir se fuerza el tema claro y un ancho fijo para los gráficos).
 */
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ThemeProvider,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import Download from '@mui/icons-material/Download';
import Print from '@mui/icons-material/Print';
import ConfirmationNumber from '@mui/icons-material/ConfirmationNumber';
import TaskAlt from '@mui/icons-material/TaskAlt';
import PersonOff from '@mui/icons-material/PersonOff';
import EventBusy from '@mui/icons-material/EventBusy';
import Block from '@mui/icons-material/Block';
import HourglassBottom from '@mui/icons-material/HourglassBottom';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import KpiCard from '@/components/common/KpiCard';
import { DemandBySpecialtyChart } from '@/components/charts/DashboardCharts';
import { AbsenteeismChart, PeriodChart } from '@/components/charts/ReportCharts';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { defaultReportRange, reportService } from '@/services/reportService';
import { createAppTheme } from '@/theme/createAppTheme';
import { appConfig } from '@/config/app.config';
import { downloadCsv } from '@/utils/csv';
import { addDays, dayjs, formatDate, formatDateTime, today } from '@/utils/dates';
import { COLUMNS, csvFilename, fmtMin, fmtPct, reportCsv } from './reportColumns';

const WATCH = ['fichas', 'solicitudes', 'centros', 'medicos', 'especialidades'];
const PRINT_CHART_WIDTH = 660; // cabe en A4 y Carta con márgenes de 12 mm
const printTheme = createAppTheme('light');

function quickRanges() {
  const hoy = today();
  const mes = hoy.slice(0, 7);
  const prevEnd = addDays(`${mes}-01`, -1);
  return [
    { label: 'Hoy', desde: hoy, hasta: hoy },
    { label: 'Últimos 7 días', desde: addDays(hoy, -6), hasta: hoy },
    { label: 'Últimos 30 días', desde: addDays(hoy, -29), hasta: hoy },
    { label: 'Este mes', desde: `${mes}-01`, hasta: hoy },
    { label: 'Mes anterior', desde: `${prevEnd.slice(0, 7)}-01`, hasta: prevEnd },
  ];
}

/** `true` mientras el navegador prepara la impresión (Ctrl+P o el botón Imprimir). */
function usePrinting() {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return printing;
}

export default function ReportsPage() {
  const { session } = useAuth();
  const notify = useNotify();
  const printing = usePrinting();
  const [params, setParams] = useSearchParams();
  const def = defaultReportRange();
  const f = {
    centroId: params.get('centro') || session.activeCenterId || 'todos',
    desde: params.get('desde') || def.desde,
    hasta: params.get('hasta') || def.hasta,
    especialidadId: params.get('especialidad') || '',
    medicoId: params.get('medico') || '',
  };
  const set = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const options = useAsync(
    () => reportService.getReportOptions(session, { centroId: f.centroId }),
    [session.usuarioId, f.centroId],
  );
  const report = useAsync(
    () => reportService.getReport(session, f),
    [session.usuarioId, f.centroId, f.desde, f.hasta, f.especialidadId, f.medicoId],
    { watch: WATCH },
  );
  const r = report.data;
  const o = options.data;
  const medicos = (o?.medicos || []).filter(
    (m) => !f.especialidadId || !m.especialidadIds.length || m.especialidadIds.includes(f.especialidadId),
  );
  const loading = report.loading && !r;
  const chartWidth = printing ? PRINT_CHART_WIDTH : '100%';
  const half = printing ? 12 : { xs: 12, lg: 6 };

  const exportCsv = () => {
    if (!r) return;
    downloadCsv(csvFilename(r), reportCsv(r, appConfig.institution.name));
    notify.success('Reporte exportado en CSV.');
  };

  const content = (
    <Box className="sipac-report" sx={{ color: 'text.primary' }}>
      <Box className="sipac-no-print">
        <PageHeader
          title="Reportes"
          subtitle="Indicadores de fichas y solicitudes por período."
          breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Reportes' }]}
          actions={
            <>
              <Button variant="outlined" startIcon={<Download />} onClick={exportCsv} disabled={!r}>
                Exportar CSV
              </Button>
              <Button variant="contained" startIcon={<Print />} onClick={() => window.print()} disabled={!r}>
                Imprimir
              </Button>
            </>
          }
        />
      </Box>

      {/* Encabezado institucional: solo en la impresión */}
      {r && (
        <Box
          className="sipac-print-only"
          sx={{ mb: 2, pb: 1.5, borderBottom: 2, borderColor: 'primary.main' }}
        >
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
            <Box>
              <Typography variant="overline" sx={{ lineHeight: 1.4 }}>
                {appConfig.institution.name} · {appConfig.institution.department},{' '}
                {appConfig.institution.country}
              </Typography>
              <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
                Reporte de fichas médicas
              </Typography>
              <Typography variant="body2">
                {r.filtros.etiquetas.centro} · {formatDate(r.filtros.desde)} al {formatDate(r.filtros.hasta)}{' '}
                · Especialidad: {r.filtros.etiquetas.especialidad} · Médico: {r.filtros.etiquetas.medico}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography variant="subtitle2">{appConfig.appName}</Typography>
              <Typography variant="caption" component="p">
                Generado {formatDateTime(r.generadoEn)}
                {r.generadoPor ? ` por ${r.generadoPor}` : ''}
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}

      {/* Filtros */}
      <Card className="sipac-no-print" sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Centro"
                value={o ? f.centroId : ''}
                disabled={!o || (!o.global && o.centros.length <= 1)}
                onChange={(e) => set({ centro: e.target.value, medico: '' })}
              >
                {o?.global && <MenuItem value="todos">Todos los centros</MenuItem>}
                {(o?.centros || []).map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.nombre}
                    {c.activo ? '' : ' (inactivo)'}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 3, md: 2 }}>
              <DatePicker
                label="Desde"
                format="DD/MM/YYYY"
                value={dayjs(f.desde)}
                onChange={(d) => d?.isValid() && set({ desde: d.format('YYYY-MM-DD') })}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3, md: 2 }}>
              <DatePicker
                label="Hasta"
                format="DD/MM/YYYY"
                value={dayjs(f.hasta)}
                minDate={dayjs(f.desde)}
                onChange={(d) => d?.isValid() && set({ hasta: d.format('YYYY-MM-DD') })}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Especialidad"
                value={o ? f.especialidadId : ''}
                onChange={(e) => set({ especialidad: e.target.value, medico: '' })}
              >
                <MenuItem value="">Todas</MenuItem>
                {(o?.especialidades || []).map((e) => (
                  <MenuItem key={e.id} value={e.id}>
                    {e.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Médico"
                value={o && medicos.some((m) => m.id === f.medicoId) ? f.medicoId : ''}
                onChange={(e) => set({ medico: e.target.value })}
              >
                <MenuItem value="">Todos</MenuItem>
                {medicos.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.nombre}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 2 }} aria-label="Períodos rápidos">
            {quickRanges().map((q) => (
              <Chip
                key={q.label}
                label={q.label}
                clickable
                color={f.desde === q.desde && f.hasta === q.hasta ? 'primary' : 'default'}
                variant={f.desde === q.desde && f.hasta === q.hasta ? 'filled' : 'outlined'}
                onClick={() => set({ desde: q.desde, hasta: q.hasta })}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {report.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {report.error.message}
        </Alert>
      )}
      {r?.datosDesde && r.filtros.desde < r.datosDesde && (
        <Alert severity="info" sx={{ mb: 3 }} className="sipac-no-print">
          Los datos de demostración comienzan el {formatDate(r.datosDesde)}; los días anteriores figuran sin
          registros.
        </Alert>
      )}

      {(r || loading) && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              [
                'Fichas emitidas',
                r?.resumen.emitidas,
                ConfirmationNumber,
                'primary',
                r && `${r.resumen.ventanilla} de ventanilla`,
              ],
              [
                'Atendidas',
                r?.resumen.atendidas,
                TaskAlt,
                'success',
                r && `de ${r.resumen.emitidas} emitidas`,
              ],
              [
                'Ausentismo',
                r ? fmtPct(r.resumen.ausentismoPct) : null,
                PersonOff,
                'warning',
                r && `${r.resumen.ausentes} de ${r.resumen.cerradas} cerradas`,
              ],
              [
                'Canceladas',
                r?.resumen.canceladas,
                EventBusy,
                'error',
                r && `${r.resumen.reprogramadas} reprogramadas`,
              ],
              [
                'Solicitudes rechazadas',
                r?.resumen.rechazadas,
                Block,
                'error',
                r && `de ${r.resumen.solicitudes} registradas`,
              ],
              [
                'Espera promedio',
                r ? fmtMin(r.resumen.esperaPromedioMin) : null,
                HourglassBottom,
                'info',
                'Llegada → inicio de atención',
              ],
            ].map(([label, value, icon, tone, helper]) => (
              <Grid key={label} size={printing ? 4 : { xs: 6, md: 4, xl: 2 }}>
                <KpiCard
                  label={label}
                  value={value}
                  icon={icon}
                  tone={tone}
                  helper={helper}
                  loading={loading}
                />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={12} className="sipac-avoid-break">
              <PeriodChart serie={r?.serie} loading={loading} width={chartWidth} animate={!printing} />
            </Grid>
            <Grid size={half} className="sipac-avoid-break">
              {r?.porCentro ? (
                <AbsenteeismChart
                  rows={r.porCentro}
                  labelKey="centro"
                  labelTitle="Centro"
                  width={chartWidth}
                  animate={!printing}
                />
              ) : (
                <AbsenteeismChart
                  rows={r?.porEspecialidad}
                  labelKey="especialidad"
                  labelTitle="Especialidad"
                  loading={loading}
                  width={chartWidth}
                  animate={!printing}
                />
              )}
            </Grid>
            <Grid size={half} className="sipac-avoid-break">
              <DemandBySpecialtyChart
                rows={r?.porEspecialidad}
                loading={loading}
                subtitle="Solicitudes web y fichas de ventanilla en el período"
                width={chartWidth}
                animate={!printing}
              />
            </Grid>
          </Grid>

          {r && (
            <Stack spacing={3}>
              {r.porCentro && (
                <ReportTable title="Por centro" columns={COLUMNS.porCentro} rows={r.porCentro} />
              )}
              <ReportTable
                title="Por especialidad"
                columns={COLUMNS.porEspecialidad}
                rows={r.porEspecialidad}
              />
              <ReportTable title="Por médico" columns={COLUMNS.porMedico} rows={r.porMedico} />
              <ReportTable
                title={r.serie.granularidad === 'mes' ? 'Por mes' : 'Por día'}
                columns={COLUMNS.serie(r.serie.granularidad)}
                rows={r.serie.filas}
              />
              <Typography variant="caption" color="text.secondary">
                Fichas por fecha de atención; solicitudes por fecha de registro. Definiciones en
                BUSINESS_RULES §10. Prototipo de demostración: datos ficticios.
              </Typography>
            </Stack>
          )}
        </>
      )}
    </Box>
  );

  return printing ? <ThemeProvider theme={printTheme}>{content}</ThemeProvider> : content;
}

function ReportTable({ title, columns, rows }) {
  return (
    <Card className="sipac-avoid-break" component="section" aria-label={title}>
      <CardHeader title={title} slotProps={{ title: { variant: 'h6', component: 'h2' } }} sx={{ pb: 0 }} />
      <CardContent>
        {rows.length === 0 ? (
          <Typography color="text.secondary">Sin registros en el período.</Typography>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {columns.map((c) => (
                    <TableCell key={c.key} align={c.align} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={row.centroId || row.especialidadId || row.medicoId || row.periodo || i}>
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        align={c.align}
                        sx={{ whiteSpace: c.align ? 'nowrap' : undefined }}
                      >
                        {c.format ? c.format(row[c.key], row) : row[c.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
