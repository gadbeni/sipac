/**
 * /dev/componentes — catálogo interno para revisar los componentes comunes en modo claro
 * y oscuro (Épica 2). Solo disponible en desarrollo (o con VITE_DEV_PAGES=true).
 * Los datos son de ejemplo y no se guardan.
 */
import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ConfirmationNumber from '@mui/icons-material/ConfirmationNumber';
import Chair from '@mui/icons-material/Chair';
import PersonOff from '@mui/icons-material/PersonOff';
import Assignment from '@mui/icons-material/Assignment';
import EventBusy from '@mui/icons-material/EventBusy';
import Add from '@mui/icons-material/Add';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import StatusChip from '@/components/common/StatusChip';
import { STATUS_CONFIG } from '@/components/common/statusConfig';
import EmptyState from '@/components/common/EmptyState';
import KpiCard from '@/components/common/KpiCard';
import DemoBadge from '@/components/common/DemoBadge';
import ChartCard from '@/components/charts/ChartCard';
import ChartLegend from '@/components/charts/ChartLegend';
import FormTextField from '@/components/forms/FormTextField';
import FormSelect from '@/components/forms/FormSelect';
import FormDatePicker from '@/components/forms/FormDatePicker';
import FormCheckbox from '@/components/forms/FormCheckbox';
import ColorModeToggle from '@/components/layout/ColorModeToggle';
import { useChartColors } from '@/theme/chartTheme';
import { useNotify } from '@/context/NotifyContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useConnectivity } from '@/context/ConnectivityContext';
import { TIPOS_DOCUMENTO } from '@/config/constants';
import { addDays, formatDate, today } from '@/utils/dates';

const ROWS = [
  {
    id: 1,
    codigo: 'CSC-7K3F9Q',
    paciente: 'María Fernanda Rojas',
    especialidad: 'Medicina general',
    fecha: addDays(today(), 1),
    estado: 'pendiente',
  },
  {
    id: 2,
    codigo: 'CSC-PND2A4',
    paciente: 'José Luis Añez',
    especialidad: 'Pediatría',
    fecha: addDays(today(), 1),
    estado: 'aprobada',
  },
  {
    id: 3,
    codigo: 'CSP-PMP3W6',
    paciente: 'Rosa Céspedes',
    especialidad: 'Odontología',
    fecha: addDays(today(), 2),
    estado: 'lista_espera',
  },
  {
    id: 4,
    codigo: 'CVC-VCR4M7',
    paciente: 'Carlos Méndez Suárez',
    especialidad: 'Ginecología',
    fecha: today(),
    estado: 'rechazada',
  },
  {
    id: 5,
    codigo: 'CSC-MEN5N8',
    paciente: 'Ana Belén Vaca',
    especialidad: 'Nutrición',
    fecha: addDays(today(), -1),
    estado: 'vencida',
  },
  {
    id: 6,
    codigo: 'CSC-SHR6P9',
    paciente: 'Luis Alberto Parada',
    especialidad: 'Medicina general',
    fecha: addDays(today(), 3),
    estado: 'cancelada',
  },
  {
    id: 7,
    codigo: 'CSP-SHR7Q2',
    paciente: 'Patricia Moreno',
    especialidad: 'Pediatría',
    fecha: addDays(today(), 4),
    estado: 'pendiente',
  },
  {
    id: 8,
    codigo: 'CSC-ATD9S4',
    paciente: 'Jorge Égüez',
    especialidad: 'Enfermería',
    fecha: today(),
    estado: 'aprobada',
  },
  {
    id: 9,
    codigo: 'CSC-ESP7F9',
    paciente: 'Silvia Roca',
    especialidad: 'Psicología',
    fecha: addDays(today(), 5),
    estado: 'pendiente',
  },
  {
    id: 10,
    codigo: 'CSC-AUS8G2',
    paciente: 'Miguel Ángel Justiniano',
    especialidad: 'Odontología',
    fecha: addDays(today(), 2),
    estado: 'lista_espera',
  },
  {
    id: 11,
    codigo: 'CSC-RPG9H3',
    paciente: 'Carmen Durán',
    especialidad: 'Ginecología',
    fecha: addDays(today(), 6),
    estado: 'aprobada',
  },
  {
    id: 12,
    codigo: 'CSC-CNC2J4',
    paciente: 'Raúl Antelo',
    especialidad: 'Medicina general',
    fecha: addDays(today(), 1),
    estado: 'pendiente',
  },
];

const COLUMNS = [
  { field: 'codigo', header: 'Código', primary: true, render: (r) => <code>{r.codigo}</code> },
  { field: 'paciente', header: 'Paciente' },
  { field: 'especialidad', header: 'Especialidad', hideOnMobile: true },
  { field: 'fecha', header: 'Fecha', render: (r) => formatDate(r.fecha) },
  {
    field: 'estado',
    header: 'Estado',
    render: (r) => <StatusChip estado={r.estado} />,
    sortValue: (r) => STATUS_CONFIG[r.estado].label,
  },
];

const BY_DAY = Array.from({ length: 7 }, (_, i) => {
  const d = addDays(today(), i - 6);
  return { dia: formatDate(d).slice(0, 5), web: 18 + ((i * 7) % 11), ventanilla: 9 + ((i * 5) % 7) };
});
const BY_SPEC = [
  { name: 'Medicina general', value: 46 },
  { name: 'Pediatría', value: 28 },
  { name: 'Odontología', value: 17 },
  { name: 'Otras', value: 12 },
];
const ABSENT = BY_DAY.map((d, i) => ({ dia: d.dia, porcentaje: [8, 11, 7, 12, 9, 6, 10][i] }));

const schema = z.object({
  nombre: z.string().trim().min(3, 'Ingrese al menos 3 caracteres.'),
  tipoDocumento: z.string().min(1, 'Seleccione el tipo de documento.'),
  numeroDocumento: z.string().regex(/^\d{5,10}$/, 'Ingrese entre 5 y 10 dígitos.'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Seleccione una fecha válida.'),
  acepta: z.literal(true, { error: 'Debe aceptar para continuar.' }),
});

function Section({ title, children, description }) {
  return (
    <Box component="section" sx={{ mb: 5 }}>
      <Typography variant="h5" component="h2" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {description && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}
      {children}
    </Box>
  );
}

export default function ComponentsShowcasePage() {
  const c = useChartColors();
  const notify = useNotify();
  const confirm = useConfirm();
  const { simulatedOffline, setSimulatedOffline } = useConnectivity();
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', tipoDocumento: '', numeroDocumento: '', fecha: '', acepta: false },
    mode: 'onTouched',
  });

  const simulateLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  const askConfirm = async () => {
    const ok = await confirm({
      title: '¿Cancelar la ficha MG-07?',
      message: 'El cupo quedará libre para otro paciente. Esta acción no se puede deshacer.',
      confirmLabel: 'Cancelar ficha',
      cancelLabel: 'Volver',
      destructive: true,
    });
    notify.info(ok ? 'Confirmado (ejemplo: no se modificó ningún dato).' : 'Acción descartada.');
  };

  const pieColors = [c.series[0], c.series[1], c.series[2], c.muted];

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <PageHeader
        title="Componentes comunes"
        subtitle="Catálogo interno de la Épica 2. Cambie el modo de color para revisar ambos temas."
        breadcrumbs={[{ label: 'Inicio', to: '/' }, { label: 'Desarrollo' }, { label: 'Componentes' }]}
        actions={
          <>
            <ColorModeToggle />
            <Button variant="outlined" onClick={() => setSimulatedOffline(!simulatedOffline)}>
              {simulatedOffline ? 'Restablecer conexión' : 'Simular sin conexión'}
            </Button>
          </>
        }
      />

      <Section
        title="Estados"
        description="Texto + icono + color: el estado nunca se comunica solo por color."
      >
        <Card>
          <CardContent>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {Object.keys(STATUS_CONFIG).map((k) => (
                <StatusChip key={k} estado={k} />
              ))}
              <DemoBadge />
            </Stack>
          </CardContent>
        </Card>
      </Section>

      <Section title="Indicadores">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Fichas para hoy"
              value={124}
              icon={ConfirmationNumber}
              delta={12}
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="En sala de espera"
              value={18}
              icon={Chair}
              tone="info"
              helper="Promedio de espera: 22 min"
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Solicitudes pendientes"
              value={37}
              icon={Assignment}
              tone="warning"
              delta={0}
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <KpiCard
              label="Ausentismo"
              value={9.4}
              unit="%"
              icon={PersonOff}
              tone="error"
              delta={-1.2}
              deltaGood="down"
              loading={loading}
            />
          </Grid>
        </Grid>
        <Button sx={{ mt: 2 }} onClick={simulateLoading} disabled={loading}>
          Simular carga
        </Button>
      </Section>

      <Section
        title="Gráficos"
        description="Colores derivados del tema (useChartColors); cambian con el modo oscuro."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <ChartCard
              title="Fichas por día"
              subtitle="Últimos 7 días, por canal"
              loading={loading}
              summary="Gráfico de barras apiladas con las fichas web y de ventanilla de los últimos 7 días."
              footer={
                <ChartLegend
                  items={[
                    { label: 'Web', color: c.series[0] },
                    { label: 'Ventanilla', color: c.series[1] },
                  ]}
                />
              }
            >
              <ResponsiveContainer>
                <BarChart data={BY_DAY} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="dia" tick={c.font} axisLine={{ stroke: c.grid }} tickLine={false} />
                  <YAxis tick={c.font} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip {...c.tooltip} />
                  <Bar
                    dataKey="web"
                    name="Web"
                    stackId="a"
                    fill={c.series[0]}
                    stroke={c.surface}
                    strokeWidth={2}
                    maxBarSize={36}
                  />
                  <Bar
                    dataKey="ventanilla"
                    name="Ventanilla"
                    stackId="a"
                    fill={c.series[1]}
                    stroke={c.surface}
                    strokeWidth={2}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <ChartCard
              title="Por especialidad"
              subtitle="Fichas de hoy"
              loading={loading}
              summary="Medicina general concentra la mayor cantidad de fichas del día."
              footer={
                <ChartLegend
                  items={BY_SPEC.map((s, i) => ({ label: `${s.name} (${s.value})`, color: pieColors[i] }))}
                />
              }
            >
              <ResponsiveContainer>
                <PieChart>
                  <Tooltip {...c.tooltip} />
                  <Pie
                    data={BY_SPEC}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    stroke={c.surface}
                    strokeWidth={2}
                  >
                    {BY_SPEC.map((s, i) => (
                      <Cell key={s.name} fill={pieColors[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartCard
              title="Ausentismo"
              subtitle="Porcentaje diario"
              height={220}
              loading={loading}
              summary="El ausentismo diario osciló entre 6 % y 12 %."
            >
              <ResponsiveContainer>
                <LineChart data={ABSENT} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="dia" tick={c.font} axisLine={{ stroke: c.grid }} tickLine={false} />
                  <YAxis tick={c.font} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip {...c.tooltip} formatter={(v) => [`${v} %`, 'Ausentismo']} />
                  <Line
                    type="linear"
                    dataKey="porcentaje"
                    stroke={c.series[0]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: c.series[0], stroke: c.surface, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChartCard title="Sin datos" subtitle="Estado vacío del gráfico" height={220} empty />
          </Grid>
        </Grid>
      </Section>

      <Section
        title="Tabla de datos"
        description="Búsqueda sin tildes, orden por columna, paginación. En celulares se muestra como lista."
      >
        <DataTable
          title="Solicitudes de ejemplo"
          columns={COLUMNS}
          rows={ROWS}
          loading={loading}
          searchPlaceholder="Buscar por código, paciente o especialidad…"
          initialSort={{ field: 'fecha', direction: 'asc' }}
          onRowClick={(r) => notify.info(`Seleccionó ${r.codigo}`)}
          toolbar={
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => notify.success('Ejemplo: aquí se abriría el formulario.')}
            >
              Nueva
            </Button>
          }
        />
        <Box sx={{ mt: 2 }}>
          <DataTable
            title="Tabla vacía"
            columns={COLUMNS}
            rows={[]}
            empty={{
              icon: EventBusy,
              title: 'No hay solicitudes',
              description: 'Las nuevas solicitudes aparecerán aquí.',
            }}
          />
        </Box>
      </Section>

      <Section title="Formulario" description="React Hook Form + Zod, mensajes en español, fecha DD/MM/YYYY.">
        <Card>
          <CardContent>
            <Box
              component="form"
              noValidate
              onSubmit={handleSubmit((v) => {
                notify.success(`Formulario válido: ${v.nombre}, ${formatDate(v.fecha)}.`);
                reset();
              })}
            >
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormTextField name="nombre" control={control} label="Nombre completo" autoComplete="off" />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <FormSelect
                    name="tipoDocumento"
                    control={control}
                    label="Tipo de documento"
                    options={Object.entries(TIPOS_DOCUMENTO).map(([value, label]) => ({ value, label }))}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <FormTextField
                    name="numeroDocumento"
                    control={control}
                    label="Número"
                    slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                    transform={(v) => v.replace(/\D/g, '')}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormDatePicker
                    name="fecha"
                    control={control}
                    label="Fecha de atención"
                    minDate={today()}
                    maxDate={addDays(today(), 14)}
                    helperText="Hasta 14 días de anticipación."
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormCheckbox
                    name="acepta"
                    control={control}
                    label="Confirmo que los datos son correctos"
                  />
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <Button type="submit" variant="contained">
                  Validar
                </Button>
                <Button onClick={() => reset()} color="inherit">
                  Limpiar
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      </Section>

      <Section title="Diálogos y notificaciones">
        <Card>
          <CardContent>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button variant="outlined" color="error" onClick={askConfirm}>
                Confirmación destructiva
              </Button>
              <Button variant="outlined" onClick={() => notify.success('Ficha emitida: MG-07.')}>
                Éxito
              </Button>
              <Button variant="outlined" onClick={() => notify.info('Hay 3 solicitudes nuevas.')}>
                Información
              </Button>
              <Button variant="outlined" onClick={() => notify.warning('Quedan 2 cupos web.')}>
                Advertencia
              </Button>
              <Button
                variant="outlined"
                onClick={() => notify.error('No se pudo emitir la ficha: cupo agotado.')}
              >
                Error
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Section>

      <Section title="Estado vacío">
        <Card>
          <CardHeader title="Sala de espera" />
          <EmptyState
            icon={Chair}
            title="No hay pacientes en espera"
            description="Cuando registre la llegada de un paciente, aparecerá aquí."
            action={{ label: 'Ir a entrega de fichas', to: '/admin/entrega' }}
          />
        </Card>
      </Section>
    </Container>
  );
}
