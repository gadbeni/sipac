import { Table, TableBody, TableCell, TableRow, Typography } from '@mui/material';
import { weeklyHours } from '@/services/rules/centers';
import { isoWeekday, today } from '@/utils/dates';

/** Horario general por día; resalta el día actual. */
export default function CenterHoursTable({ center }) {
  const hoy = isoWeekday(today());
  return (
    <Table size="small" aria-label="Horario de atención">
      <TableBody>
        {weeklyHours(center).map((r) => (
          <TableRow key={r.dia} selected={r.dia === hoy} sx={{ '&:last-child td': { border: 0 } }}>
            <TableCell component="th" scope="row" sx={{ fontWeight: r.dia === hoy ? 700 : 400, pl: 1 }}>
              {r.label}
              {r.dia === hoy && (
                <Typography component="span" variant="caption" color="text.secondary">
                  {' '}
                  (hoy)
                </Typography>
              )}
            </TableCell>
            <TableCell
              align="right"
              sx={{
                fontVariantNumeric: 'tabular-nums',
                pr: 1,
                color: r.apertura ? 'text.primary' : 'text.secondary',
              }}
            >
              {r.apertura ? `${r.apertura} – ${r.cierre}` : 'Cerrado'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
