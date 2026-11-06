import { MenuItem, TextField, Chip } from '@mui/material';
import LocalHospital from '@mui/icons-material/LocalHospital';
import { useAuth } from '@/context/AuthContext';
import { useNotify } from '@/context/NotifyContext';
import { getDataSource } from '@/services/datasource';
import { useMemo } from 'react';

const ALL = '__todos__';

/**
 * Centro de trabajo del panel (RN-USR-02). Admin central: "Todos los centros" o uno;
 * médico multicentro: sus centros. Resto: centro fijo (solo lectura).
 */
export default function CenterSwitcher({ sx }) {
  const { session, setActiveCenter, can } = useAuth();
  const notify = useNotify();
  const centros = useMemo(() => {
    const all = getDataSource().list('centros');
    return (session?.centrosPermitidos || []).map((id) => all.find((c) => c.id === id)).filter(Boolean);
  }, [session?.centrosPermitidos]);
  if (!session) return null;
  const canSwitch = can('centro.cambiar') && (session.rol === 'admin_central' || centros.length > 1);
  const current = centros.find((c) => c.id === session.activeCenterId);

  if (!canSwitch) {
    return (
      <Chip
        icon={<LocalHospital />}
        label={current?.nombre || 'Sin centro'}
        variant="outlined"
        sx={{ maxWidth: { xs: 132, sm: 280 }, ...sx }}
      />
    );
  }
  return (
    <TextField
      select
      size="small"
      value={session.activeCenterId ?? ALL}
      onChange={(e) => {
        const id = e.target.value === ALL ? null : e.target.value;
        try {
          setActiveCenter(id);
          notify.info(
            id ? `Trabajando en ${centros.find((c) => c.id === id)?.nombre}` : 'Vista de todos los centros',
          );
        } catch (err) {
          notify.error(err);
        }
      }}
      slotProps={{
        htmlInput: { 'aria-label': 'Centro de trabajo' },
        select: { MenuProps: { slotProps: { paper: { sx: { maxWidth: 360 } } } } },
      }}
      sx={{
        minWidth: { xs: 0, sm: 220 },
        maxWidth: { xs: 132, sm: 300 },
        '& .MuiSelect-select': { py: '7px' },
        ...sx,
      }}
    >
      {session.rol === 'admin_central' && <MenuItem value={ALL}>Todos los centros</MenuItem>}
      {centros.map((c) => (
        <MenuItem key={c.id} value={c.id}>
          {c.nombre}
          {c.activo ? '' : ' (inactivo)'}
        </MenuItem>
      ))}
    </TextField>
  );
}
