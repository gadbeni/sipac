/**
 * Tabla de datos liviana sobre MUI Table (ARCHITECTURE §3: sin DataGrid).
 *  - Búsqueda sin tildes, orden por columna, paginación, estado vacío y skeleton.
 *  - En pantallas < 600 px se muestra como lista de tarjetas (sin scroll horizontal).
 *
 * columns: [{ field, header, render?(row), value?(row), sortable?, sortValue?(row), align?,
 *             width?, hideOnMobile?, primary? (título de la tarjeta móvil), searchable? }]
 */
import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  InputAdornment,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import SearchOff from '@mui/icons-material/SearchOff';
import EmptyState from './EmptyState';
import { cellValue, filterRows, paginate, sortRows } from '@/utils/table';

const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: 1,
};

const renderCell = (col, row) => {
  if (col.render) return col.render(row);
  const v = cellValue(col, row);
  return v === null || v === undefined || v === '' ? '—' : v;
};

export default function DataTable({
  columns,
  rows = [],
  getRowId = (r) => r.id,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Buscar…',
  getSearchText,
  initialSort,
  pageSize: initialPageSize = 10,
  rowsPerPageOptions = [10, 25, 50],
  onRowClick,
  toolbar,
  empty = {},
  dense = false,
  title,
  ariaLabel,
}) {
  const isMobile = useMediaQuery((t) => t.breakpoints.down('sm'));
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort || null); // { field, direction }
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const filtered = useMemo(
    () => filterRows(rows, columns, query, getSearchText),
    [rows, columns, query, getSearchText],
  );
  const sorted = useMemo(
    () =>
      sortRows(
        filtered,
        columns.find((c) => c.field === sort?.field),
        sort?.direction,
      ),
    [filtered, columns, sort],
  );
  const view = paginate(sorted, page, pageSize);

  const isSorted = (c) => Boolean(c.field && sort && sort.field === c.field);
  const toggleSort = (field) => {
    setSort((s) =>
      s?.field === field
        ? { field, direction: s.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    );
    setPage(0);
  };

  const primaryCol = columns.find((c) => c.primary) || columns[0];
  const clickable = Boolean(onRowClick);
  const onKey = (row) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick(row);
    }
  };

  const showToolbar = searchable || toolbar || title;
  const emptyNode =
    query && rows.length > 0 ? (
      <EmptyState
        compact
        icon={SearchOff}
        title="Sin resultados"
        description={`No hay registros que coincidan con “${query}”.`}
        action={{ label: 'Limpiar búsqueda', onClick: () => setQuery('') }}
      />
    ) : (
      <EmptyState compact {...empty} />
    );

  return (
    <Card>
      {showToolbar && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ p: 2, alignItems: { xs: 'stretch', sm: 'center' }, borderBottom: 1, borderColor: 'divider' }}
        >
          {title && (
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, mr: 'auto' }}>
              {title}
            </Typography>
          )}
          {searchable && (
            <TextField
              size="small"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              sx={{ maxWidth: { sm: 320 }, ...(title ? {} : { mr: { sm: 'auto' } }) }}
              slotProps={{
                htmlInput: { 'aria-label': searchPlaceholder.replace('…', '') },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}
          {toolbar && (
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {toolbar}
            </Stack>
          )}
        </Stack>
      )}

      {loading ? (
        <Box sx={{ p: 2 }} aria-busy="true" aria-label="Cargando">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height={dense ? 32 : 44} />
          ))}
        </Box>
      ) : view.rows.length === 0 ? (
        emptyNode
      ) : isMobile ? (
        <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={ariaLabel || title}>
          {view.rows.map((row) => (
            <Box
              component="li"
              key={getRowId(row)}
              onClick={clickable ? () => onRowClick(row) : undefined}
              onKeyDown={clickable ? onKey(row) : undefined}
              tabIndex={clickable ? 0 : undefined}
              role={clickable ? 'button' : undefined}
              sx={{
                px: 2,
                py: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
                ...(clickable && {
                  cursor: 'pointer',
                  '&:hover, &:focus-visible': { bgcolor: 'action.hover', outline: 'none' },
                }),
              }}
            >
              <Box sx={{ fontWeight: 600, mb: 0.5, overflowWrap: 'anywhere' }}>
                {renderCell(primaryCol, row)}
              </Box>
              <Box
                component="dl"
                sx={{
                  m: 0,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(90px, 40%) 1fr',
                  columnGap: 1.5,
                  rowGap: 0.5,
                }}
              >
                {columns
                  .filter((c) => c !== primaryCol && !c.hideOnMobile)
                  .map((c) => (
                    <Box key={c.field || c.header} sx={{ display: 'contents' }}>
                      <Typography component="dt" variant="body2" color="text.secondary">
                        {c.header}
                      </Typography>
                      <Typography
                        component="dd"
                        variant="body2"
                        sx={{ m: 0, minWidth: 0, overflowWrap: 'anywhere' }}
                      >
                        {renderCell(c, row)}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            </Box>
          ))}
        </Stack>
      ) : (
        <TableContainer>
          <Table size={dense ? 'small' : 'medium'} aria-label={ariaLabel || title}>
            <TableHead>
              <TableRow>
                {columns.map((c) => (
                  <TableCell
                    key={c.field || c.header}
                    align={c.align}
                    sx={{ width: c.width }}
                    sortDirection={isSorted(c) ? sort.direction : false}
                  >
                    {c.sortable !== false && c.field ? (
                      <TableSortLabel
                        active={isSorted(c)}
                        direction={isSorted(c) ? sort.direction : 'asc'}
                        onClick={() => toggleSort(c.field)}
                      >
                        {c.header}
                        {isSorted(c) && (
                          <Box component="span" sx={visuallyHidden}>
                            {sort.direction === 'desc' ? 'orden descendente' : 'orden ascendente'}
                          </Box>
                        )}
                      </TableSortLabel>
                    ) : (
                      c.header
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {view.rows.map((row) => (
                <TableRow
                  key={getRowId(row)}
                  hover={clickable}
                  onClick={clickable ? () => onRowClick(row) : undefined}
                  onKeyDown={clickable ? onKey(row) : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  sx={
                    clickable
                      ? {
                          cursor: 'pointer',
                          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
                        }
                      : undefined
                  }
                >
                  {columns.map((c) => (
                    <TableCell key={c.field || c.header} align={c.align}>
                      {renderCell(c, row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && sorted.length > rowsPerPageOptions[0] && (
        <TablePagination
          component="div"
          count={sorted.length}
          page={view.page}
          onPageChange={(_e, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={isMobile ? [] : rowsPerPageOptions}
          labelRowsPerPage="Filas por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
          sx={{ borderTop: 1, borderColor: 'divider' }}
        />
      )}
    </Card>
  );
}
