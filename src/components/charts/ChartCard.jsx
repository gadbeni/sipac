import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableRows from '@mui/icons-material/TableRows';
import EmptyState from '@/components/common/EmptyState';

/**
 * Contenedor de gráfico: título, descripción, acciones, carga y vacío.
 * El hijo suele ser un <ResponsiveContainer> de Recharts; `height` fija la altura del área.
 * `summary` es un texto alternativo con la lectura principal del gráfico (accesibilidad).
 * `table = { columns: [{ key, label, align? }], rows }` agrega el botón “Ver datos” (vista de tabla).
 */
export default function ChartCard({
  title,
  subtitle,
  action,
  height = 280,
  loading = false,
  empty = false,
  emptyText = 'No hay datos para el período seleccionado.',
  summary,
  children,
  footer,
  table,
}) {
  const [showTable, setShowTable] = useState(false);
  const toggle = table && !empty && !loading && (
    <Tooltip title={showTable ? 'Ver gráfico' : 'Ver datos'}>
      <IconButton
        onClick={() => setShowTable((v) => !v)}
        aria-label={showTable ? `Ver gráfico de ${title}` : `Ver datos de ${title}`}
        aria-pressed={showTable}
        size="small"
      >
        {showTable ? <BarChartIcon fontSize="small" /> : <TableRows fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={title}
        subheader={subtitle}
        action={action || toggle}
        sx={{ pb: 0, '& .MuiCardHeader-action': { m: 0 } }}
      />
      <CardContent sx={{ flex: 1, '&:last-child': { pb: 2 } }}>
        {loading ? (
          <Skeleton variant="rounded" height={height} />
        ) : empty ? (
          <Box sx={{ height, display: 'grid', placeItems: 'center' }}>
            <EmptyState compact icon={BarChartIcon} title="Sin datos" description={emptyText} />
          </Box>
        ) : showTable ? (
          <TableContainer sx={{ maxHeight: height, overflowY: 'auto' }}>
            <Table size="small" stickyHeader aria-label={`Datos: ${title}`}>
              <TableHead>
                <TableRow>
                  {table.columns.map((c) => (
                    <TableCell key={c.key} align={c.align}>
                      {c.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {table.rows.map((r, i) => (
                  <TableRow key={i}>
                    {table.columns.map((c) => (
                      <TableCell key={c.key} align={c.align} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {r[c.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box role="img" aria-label={summary || title} sx={{ height, width: '100%', minWidth: 0 }}>
            {children}
          </Box>
        )}
        {!showTable && footer}
      </CardContent>
    </Card>
  );
}
