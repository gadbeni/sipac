/**
 * Gráficos del dashboard (Recharts + useChartColors). Una sola escala por gráfico, marcas
 * finas, leyenda cuando hay ≥ 2 series y vista de tabla en cada tarjeta.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard from './ChartCard';
import ChartLegend from './ChartLegend';
import { useChartColors } from '@/theme/chartTheme';
import { DIAS_SEMANA } from '@/config/constants';
import { formatDate, isoWeekday } from '@/utils/dates';

const dayLabel = (f) => `${DIAS_SEMANA[isoWeekday(f)].slice(0, 3)} ${formatDate(f).slice(0, 2)}`;
const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('es-BO') : v);

export function Axes({ c, xKey, vertical = false, xWidth }) {
  return vertical ? (
    <>
      <CartesianGrid horizontal={false} stroke={c.grid} />
      <XAxis type="number" tick={c.font} axisLine={false} tickLine={false} allowDecimals={false} />
      <YAxis
        type="category"
        dataKey={xKey}
        tick={c.font}
        axisLine={{ stroke: c.grid }}
        tickLine={false}
        width={xWidth || 110}
      />
    </>
  ) : (
    <>
      <CartesianGrid vertical={false} stroke={c.grid} />
      <XAxis
        dataKey={xKey}
        tick={c.font}
        axisLine={{ stroke: c.grid }}
        tickLine={false}
        interval="preserveStartEnd"
        minTickGap={4}
      />
      <YAxis tick={c.font} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
    </>
  );
}

export function RequestsByDayChart({ rows, loading }) {
  const c = useChartColors();
  const data = (rows || []).map((r) => ({ ...r, dia: dayLabel(r.fecha) }));
  const total = data.reduce((a, r) => a + r.total, 0);
  return (
    <ChartCard
      title="Solicitudes de los últimos 7 días"
      subtitle={`${fmt(total)} solicitudes por fecha de registro`}
      loading={loading}
      empty={!loading && total === 0}
      summary={`Solicitudes por día: ${data.map((r) => `${r.dia} ${r.total}`).join(', ')}.`}
      table={{
        columns: [
          { key: 'dia', label: 'Día' },
          { key: 'total', label: 'Solicitudes', align: 'right' },
        ],
        rows: data,
      }}
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <Axes c={c} xKey="dia" />
          <Tooltip {...c.tooltip} formatter={(v) => [fmt(v), 'Solicitudes']} />
          <Bar dataKey="total" name="Solicitudes" fill={c.series[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function DemandBySpecialtyChart({
  rows,
  loading,
  subtitle = 'Solicitudes web y fichas de ventanilla, últimos 7 días',
  width = '100%',
  animate = true,
}) {
  const c = useChartColors();
  const data = (rows || []).slice(0, 8);
  return (
    <ChartCard
      title="Demanda por especialidad"
      subtitle={subtitle}
      loading={loading}
      empty={!loading && !data.length}
      height={Math.max(200, data.length * 36 + 40)}
      summary={
        data.length
          ? `Mayor demanda: ${data[0].especialidad} con ${data[0].total}.`
          : 'Sin demanda registrada.'
      }
      table={{
        columns: [
          { key: 'especialidad', label: 'Especialidad' },
          { key: 'solicitudes', label: 'Solicitudes', align: 'right' },
          { key: 'ventanilla', label: 'Ventanilla', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
        ],
        rows: data,
      }}
      footer={
        <ChartLegend
          items={[
            { label: 'Solicitudes web', color: c.series[0] },
            { label: 'Fichas de ventanilla', color: c.series[1] },
          ]}
        />
      }
    >
      <ResponsiveContainer width={width}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <Axes c={c} xKey="especialidad" vertical xWidth={118} />
          <Tooltip {...c.tooltip} />
          <Bar
            isAnimationActive={animate}
            dataKey="solicitudes"
            name="Solicitudes web"
            stackId="d"
            fill={c.series[0]}
            stroke={c.surface}
            strokeWidth={2}
            maxBarSize={22}
          />
          <Bar
            isAnimationActive={animate}
            dataKey="ventanilla"
            name="Fichas de ventanilla"
            stackId="d"
            fill={c.series[1]}
            stroke={c.surface}
            strokeWidth={2}
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function IssuedVsAttendedChart({ rows, loading, subtitle = 'Por día de atención, últimos 7 días' }) {
  const c = useChartColors();
  const data = (rows || []).map((r) => ({ ...r, dia: dayLabel(r.fecha) }));
  const total = data.reduce((a, r) => a + r.emitidas, 0);
  return (
    <ChartCard
      title="Fichas emitidas vs. atendidas"
      subtitle={subtitle}
      loading={loading}
      empty={!loading && total === 0}
      summary={`Emitidas y atendidas por día: ${data.map((r) => `${r.dia} ${r.emitidas}/${r.atendidas}`).join(', ')}.`}
      table={{
        columns: [
          { key: 'dia', label: 'Día' },
          { key: 'emitidas', label: 'Emitidas', align: 'right' },
          { key: 'atendidas', label: 'Atendidas', align: 'right' },
        ],
        rows: data,
      }}
      footer={
        <ChartLegend
          items={[
            { label: 'Emitidas', color: c.series[0] },
            { label: 'Atendidas', color: c.series[2] },
          ]}
        />
      }
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <Axes c={c} xKey="dia" />
          <Tooltip {...c.tooltip} />
          <Bar dataKey="emitidas" name="Emitidas" fill={c.series[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar
            dataKey="atendidas"
            name="Atendidas"
            fill={c.series[2]}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ByHourChart({ rows, loading }) {
  const c = useChartColors();
  const data = rows || [];
  const peak = data.reduce((m, r) => (r.fichas > (m?.fichas ?? -1) ? r : m), null);
  return (
    <ChartCard
      title="Distribución por horario (hoy)"
      subtitle="Fichas por franja de 1 hora según la hora estimada"
      loading={loading}
      empty={!loading && !data.length}
      emptyText="Hoy no hay fichas emitidas."
      summary={peak ? `La franja con más fichas es ${peak.hora} con ${peak.fichas}.` : 'Sin fichas hoy.'}
      table={{
        columns: [
          { key: 'hora', label: 'Franja' },
          { key: 'fichas', label: 'Fichas', align: 'right' },
        ],
        rows: data,
      }}
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <Axes c={c} xKey="hora" />
          <Tooltip {...c.tooltip} formatter={(v) => [fmt(v), 'Fichas']} />
          <Bar dataKey="fichas" name="Fichas" fill={c.series[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
