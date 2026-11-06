/** /admin/especialidades — oferta del centro (RN-ESP-01..05) y catálogo de la red (admin central). */
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import Add from '@mui/icons-material/Add';
import Category from '@mui/icons-material/Category';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/common/DataTable';
import StatusChip from '@/components/common/StatusChip';
import SpecialtyIcon from '@/components/portal/SpecialtyIcon';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useNotify } from '@/context/NotifyContext';
import { specialtyAdminService, ICONOS } from '@/services/specialtyAdminService';
import { isAppError } from '@/services/errors';

function ConfigDialog({ esp, onClose }) {
  const { session } = useAuth();
  const notify = useNotify();
  const [v, setV] = useState(() => ({
    activo: esp.config?.activo ?? true,
    aceptaSolicitudesPublicas: esp.config?.aceptaSolicitudesPublicas ?? true,
    asignacionMedico: esp.config?.asignacionMedico || 'elegible',
    descripcionLocal: esp.config?.descripcionLocal || '',
  }));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await specialtyAdminService.configure(session, esp.id, v);
      notify.success(`${esp.nombre}: configuración guardada.`);
      onClose();
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="esp-config-title"
    >
      <DialogTitle id="esp-config-title">{esp.nombre} en este centro</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <FormControlLabel
            control={<Switch checked={v.activo} onChange={(e) => setV({ ...v, activo: e.target.checked })} />}
            label="El centro ofrece esta especialidad"
            sx={{ minHeight: 44 }}
          />
          {!v.activo && esp.config?.activo && (
            <Alert severity="warning">
              Dejará de recibir solicitudes nuevas; las solicitudes y fichas existentes se mantienen
              (RN-ESP-03).
            </Alert>
          )}
          <FormControlLabel
            control={
              <Switch
                checked={v.aceptaSolicitudesPublicas}
                disabled={!v.activo}
                onChange={(e) => setV({ ...v, aceptaSolicitudesPublicas: e.target.checked })}
              />
            }
            label="Acepta solicitudes por internet (si no, “Solo en ventanilla”)"
            sx={{ minHeight: 44 }}
          />
          <TextField
            select
            label="Elección de profesional en el portal"
            value={v.asignacionMedico}
            disabled={!v.activo}
            onChange={(e) => setV({ ...v, asignacionMedico: e.target.value })}
          >
            <MenuItem value="elegible">El ciudadano puede elegir profesional</MenuItem>
            <MenuItem value="automatica">Lo asigna el establecimiento (RN-ESP-05)</MenuItem>
          </TextField>
          <TextField
            label="Descripción local (opcional)"
            value={v.descripcionLocal}
            onChange={(e) => setV({ ...v, descripcionLocal: e.target.value })}
            multiline
            minRows={2}
            helperText={`Si se deja vacía se usa: “${esp.descripcion}”`}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <Typography variant="caption" color="text.secondary">
            La cantidad de fichas se define en los horarios de cada profesional (RN-ESP-04).
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CatalogDialog({ open, esp, onClose }) {
  const { session } = useAuth();
  const notify = useNotify();
  const [v, setV] = useState({ codigo: '', nombre: '', descripcion: '', icono: 'MedicalServices' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setV(
        esp
          ? { codigo: esp.codigo, nombre: esp.nombre, descripcion: esp.descripcion, icono: esp.icono }
          : { codigo: '', nombre: '', descripcion: '', icono: 'MedicalServices' },
      );
      setErrors({});
    }
  }, [open, esp]);
  const save = async () => {
    setBusy(true);
    try {
      if (esp) await specialtyAdminService.updateCatalog(session, esp.id, v);
      else await specialtyAdminService.createCatalog(session, v);
      notify.success('Catálogo actualizado.');
      onClose();
    } catch (e) {
      if (isAppError(e) && e.details?.fields) setErrors(e.details.fields);
      notify.error(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="catalog-title"
    >
      <DialogTitle id="catalog-title">
        {esp ? `Editar ${esp.nombre}` : 'Nueva especialidad en el catálogo'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Código"
              value={v.codigo}
              disabled={Boolean(esp)}
              onChange={(e) => setV({ ...v, codigo: e.target.value.toUpperCase().slice(0, 4) })}
              error={Boolean(errors.codigo)}
              helperText={errors.codigo || (esp ? 'No modificable' : 'Prefijo de la ficha (MG-07)')}
              sx={{ maxWidth: 160 }}
            />
            <TextField
              label="Nombre"
              value={v.nombre}
              onChange={(e) => setV({ ...v, nombre: e.target.value })}
              error={Boolean(errors.nombre)}
              helperText={errors.nombre}
            />
          </Stack>
          <TextField
            label="Descripción"
            value={v.descripcion}
            onChange={(e) => setV({ ...v, descripcion: e.target.value })}
            multiline
            minRows={2}
            error={Boolean(errors.descripcion)}
            helperText={errors.descripcion}
          />
          <TextField
            select
            label="Icono"
            value={v.icono}
            onChange={(e) => setV({ ...v, icono: e.target.value })}
          >
            {ICONOS.map((i) => (
              <MenuItem key={i} value={i}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <SpecialtyIcon name={i} fontSize="small" /> <span>{i}</span>
                </Stack>
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={save} disabled={busy}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SpecialtiesAdminPage() {
  const { session, can } = useAuth();
  const confirm = useConfirm();
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'catalogo' && can('especialidades.catalogo') ? 'catalogo' : 'centro';
  const [config, setConfig] = useState(null);
  const [catalog, setCatalog] = useState({ open: false, esp: null });
  const needCenter = !session.activeCenterId;
  const { data, loading } = useAsync(
    () =>
      tab === 'catalogo'
        ? specialtyAdminService.listCatalog(session)
        : needCenter
          ? []
          : specialtyAdminService.listForCenter(session),
    [tab, session.usuarioId, session.activeCenterId],
    { watch: ['especialidades', 'centroEspecialidades', 'horarios', 'medicoCentros'] },
  );

  const toggleCatalog = async (e) => {
    if (
      e.activo &&
      !(await confirm({
        title: `¿Desactivar ${e.nombre} en toda la red?`,
        message: 'Ningún centro podrá ofrecerla hasta reactivarla. Las fichas existentes se mantienen.',
        confirmLabel: 'Desactivar',
        destructive: true,
      }))
    )
      return;
    try {
      await specialtyAdminService.setCatalogActive(session, e.id, !e.activo);
      notify.success('Catálogo actualizado.');
    } catch (err) {
      notify.error(err);
    }
  };

  const centerColumns = [
    {
      field: 'nombre',
      header: 'Especialidad',
      primary: true,
      render: (e) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <SpecialtyIcon name={e.icono} color="primary" fontSize="small" aria-hidden />
          <span>
            {e.nombre}{' '}
            <Typography component="span" variant="caption" color="text.secondary">
              ({e.codigo})
            </Typography>
          </span>
        </Stack>
      ),
    },
    {
      field: 'ofrecida',
      header: 'En el centro',
      render: (e) => (
        <StatusChip
          estado={e.ofrecida ? 'activo' : 'inactivo'}
          label={e.ofrecida ? 'Ofrecida' : 'No ofrecida'}
        />
      ),
      sortValue: (e) => (e.ofrecida ? 0 : 1),
    },
    {
      field: 'web',
      header: 'Por internet',
      render: (e) => (e.ofrecida ? (e.config.aceptaSolicitudesPublicas ? 'Sí' : 'Solo ventanilla') : '—'),
      sortable: false,
    },
    { field: 'medicos', header: 'Profesionales', align: 'right' },
    {
      field: 'cuposSemana',
      header: 'Cupos / semana (web)',
      align: 'right',
      render: (e) => `${e.cuposSemana} (${e.cuposWebSemana})`,
    },
    {
      field: 'visiblePortal',
      header: 'Portal',
      render: (e) =>
        e.visiblePortal ? (
          <Chip size="small" label="Visible" color="success" variant="outlined" />
        ) : (
          <Chip size="small" label={e.ofrecida ? 'Sin horarios' : 'Oculta'} variant="outlined" />
        ),
      hideOnMobile: true,
    },
    {
      header: 'Acciones',
      align: 'right',
      sortable: false,
      searchable: false,
      render: (e) => (
        <Tooltip title={e.activo ? 'Configurar' : 'Desactivada en el catálogo de la red'}>
          <span>
            <IconButton
              aria-label={`Configurar ${e.nombre}`}
              onClick={() => setConfig(e)}
              disabled={!e.activo && !e.ofrecida}
            >
              <Edit fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ),
    },
  ];
  const catalogColumns = [
    { field: 'codigo', header: 'Código', render: (e) => <code>{e.codigo}</code> },
    { field: 'nombre', header: 'Nombre', primary: true },
    { field: 'descripcion', header: 'Descripción', hideOnMobile: true },
    {
      field: 'activo',
      header: 'Estado',
      render: (e) => <StatusChip estado={e.activo ? 'activo' : 'inactivo'} />,
    },
    {
      header: 'Acciones',
      align: 'right',
      sortable: false,
      searchable: false,
      render: (e) => (
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
          <IconButton aria-label={`Editar ${e.nombre}`} onClick={() => setCatalog({ open: true, esp: e })}>
            <Edit fontSize="small" />
          </IconButton>
          <Button size="small" color={e.activo ? 'error' : 'primary'} onClick={() => toggleCatalog(e)}>
            {e.activo ? 'Desactivar' : 'Activar'}
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Especialidades"
        subtitle="Qué ofrece el centro y cómo se solicita. El catálogo es común a toda la red."
        breadcrumbs={[{ label: 'Panel', to: '/admin' }, { label: 'Especialidades' }]}
        actions={
          tab === 'catalogo' && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCatalog({ open: true, esp: null })}
            >
              Nueva especialidad
            </Button>
          )
        }
      />
      {can('especialidades.catalogo') && (
        <Tabs
          value={tab}
          onChange={(_e, v) => setParams(v === 'catalogo' ? { tab: 'catalogo' } : {}, { replace: true })}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab value="centro" label="En este centro" sx={{ minHeight: 48 }} />
          <Tab value="catalogo" label="Catálogo de la red" sx={{ minHeight: 48 }} />
        </Tabs>
      )}
      {needCenter && tab === 'centro' ? (
        <Alert severity="info">
          Elija un centro de trabajo en la barra superior para configurar su oferta.
        </Alert>
      ) : (
        <DataTable
          columns={tab === 'centro' ? centerColumns : catalogColumns}
          rows={data || []}
          loading={loading && !data}
          searchPlaceholder="Buscar especialidad…"
          empty={{ icon: Category, title: 'Sin especialidades' }}
          ariaLabel="Especialidades"
        />
      )}
      {config && <ConfigDialog key={config.id} esp={config} onClose={() => setConfig(null)} />}
      <CatalogDialog
        open={catalog.open}
        esp={catalog.esp}
        onClose={() => setCatalog({ open: false, esp: null })}
      />
    </>
  );
}
