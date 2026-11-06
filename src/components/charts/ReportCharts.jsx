/**
 * Gráficos de Reportes (Épica 12). Mismas convenciones que el dashboard: una escala por
 * gráfico, leyenda con ≥ 2 series, vista de tabla. `width` numérico fija el ancho al imprimir
 * (ResponsiveContainer no se re-mide antes de que el navegador arme la página).
 */
import { Bar, BarChart, ResponsiveContainer, Tooltip } from 'recharts';
import ChartCard from './ChartCard';
import ChartLegend from './ChartLegend';
import { Axes } from './DashboardCharts';
import { useChartColors } from '@/theme/chartTheme';
import { fmtPct, periodLabel, periodTick } from '@/pages/admin/reportes/reportColumns';

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('es-BO') : v);

export function PeriodChart({ serie, loading, width = '100%', animate = true }) {
  const c = useChartColors();
  const gran = serie?.granularidad;
  const data = (serie?.filas || []).map((r) => ({
    ...r,
    tick: periodTick(r.periodo, gran),
    label: periodLabel(r.periodo, gran),
  }));
  const total = data.reduce((a, r) => a + r.emitidas, 0);
  return (
    <ChartCard
      title="Fichas emitidas vs. atendidas"
      subtitle={gran === 'mes' ? 'Por mes de atención' : 'Por día de atención'}
      loading={loading}
      empty={!loading && total === 0}
      summary={`Total emitidas ${fmt(total)}, atendidas ${fmt(data.reduce((a, r) => a + r.atendidas, 0))}.`}
      table={{
        columns: [
          { key: 'label', label: gran === 'mes' ? 'Mes' : 'Fecha' },
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
      <ResponsiveContainer width={width}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <Axes c={c} xKey="tick" />
          <Tooltip {...c.tooltip} labelFormatter={(_l, p) => p?.[0]?.payload?.label || _l} />
          <Bar
            isAnimationActive={animate}
            dataKey="emitidas"
            name="Emitidas"
            fill={c.series[0]}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
          <Bar
            isAnimationActive={animate}
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

/** Ausentismo (%) por categoría (centro o especialidad): barras horizontales, una serie. */
export function AbsenteeismChart({ rows, labelKey, labelTitle, loading, width = '100%', animate = true }) {
  const c = useChartColors();
  const data = (rows || [])
    .filter((r) => r.cerradas > 0)
    .map((r) => ({ ...r, nombre: r[labelKey] }))
    .sort((a, b) => b.ausentismoPct - a.ausentismoPct);
  const top = data[0];
  return (
    <ChartCard
      title={`Ausentismo por ${labelTitle.toLowerCase()}`}
      subtitle="Ausentes sobre fichas cerradas (atendidas + ausentes)"
      loading={loading}
      empty={!loading && !data.length}
      emptyText="No hay fichas cerradas en el período."
      height={Math.max(180, data.length * 38 + 40)}
      summary={top ? `Mayor ausentismo: ${top.nombre} con ${fmtPct(top.ausentismoPct)}.` : 'Sin datos.'}
      table={{
        columns: [
          { key: 'nombre', label: labelTitle },
          { key: 'ausentes', label: 'Ausentes', align: 'right' },
          { key: 'cerradas', label: 'Cerradas', align: 'right' },
          { key: 'pct', label: 'Ausentismo', align: 'right' },
        ],
        rows: data.map((r) => ({ ...r, pct: fmtPct(r.ausentismoPct) })),
      }}
    >
      <ResponsiveContainer width={width}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <Axes c={c} xKey="nombre" vertical xWidth={170} />
          <Tooltip
            {...c.tooltip}
            formatter={(v, _n, p) => [
              `${fmtPct(v)} (${p.payload.ausentes} de ${p.payload.cerradas})`,
              'Ausentismo',
            ]}
          />
          <Bar
            isAnimationActive={animate}
            dataKey="ausentismoPct"
            name="Ausentismo"
            fill={c.series[0]}
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
