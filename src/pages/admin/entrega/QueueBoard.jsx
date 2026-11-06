/** Sala de espera por consultorio con controles de llamado (RN-FIC-03..05). */
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Campaign from '@mui/icons-material/Campaign';
import Replay from '@mui/icons-material/Replay';
import PlayArrow from '@mui/icons-material/PlayArrow';
import TaskAlt from '@mui/icons-material/TaskAlt';
import PersonOff from '@mui/icons-material/PersonOff';
import Undo from '@mui/icons-material/Undo';
import MeetingRoom from '@mui/icons-material/MeetingRoom';
import StatusChip from '@/components/common/StatusChip';
import EmptyState from '@/components/common/EmptyState';
import { appointmentService } from '@/services/appointmentService';
import { formatTime } from '@/utils/dates';

export default function QueueBoard({ queue, loading, act }) {
  if (loading && !queue) return <Skeleton variant="rounded" height={260} />;
  if (!queue?.length)
    return (
      <EmptyState
        icon={MeetingRoom}
        title="Hoy no hay consultorios con atención"
        sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 3 }}
      />
    );
  return (
    <Grid container spacing={2}>
      {queue.map((c) => {
        const a = c.actual;
        const llamadas = a?.llamadas?.length || 0;
        const sugerirAusente =
          a?.estado === 'llamada' && llamadas >= appointmentService.LLAMADAS_SUGERIR_AUSENTE;
        return (
          <Grid key={c.consultorioId} size={{ xs: 12, md: 6, xl: 4 }}>
            <Card component="section" aria-label={c.consultorio} sx={{ height: '100%' }}>
              <CardContent>
                <Stack
                  direction="row"
                  sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" component="h3">
                      {c.consultorio}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {c.bloques.map((b) => `${b.medico} · ${b.horaInicio}–${b.horaFin}`).join(' / ') ||
                        'Sin bloques hoy'}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                    <Tooltip title="Atendidos">
                      <Chip size="small" icon={<TaskAlt />} label={c.atendidas} />
                    </Tooltip>
                    <Tooltip title="Por llegar">
                      <Chip size="small" label={`${c.porLlegar} por llegar`} />
                    </Tooltip>
                  </Stack>
                </Stack>

                <Box
                  sx={(t) => ({
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: a ? t.palette.status[a.estado === 'llamada' ? 'info' : 'primary'].bg : 'subtle',
                    mb: 1.5,
                  })}
                >
                  {a ? (
                    <>
                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography
                          component="p"
                          sx={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1 }}
                        >
                          {a.codigoVisible}
                        </Typography>
                        <StatusChip estado={a.estado} />
                        {a.prioridad === 'preferente' && <StatusChip estado="preferente" />}
                      </Stack>
                      <Typography sx={{ mt: 0.5, fontWeight: 600 }}>{a.paciente}</Typography>
                      {a.estado === 'llamada' && (
                        <Typography variant="body2" color="text.secondary">
                          Llamado {llamadas} {llamadas === 1 ? 'vez' : 'veces'} · último{' '}
                          {formatTime(a.llamadaEn)}
                        </Typography>
                      )}
                      {sugerirAusente && (
                        <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                          Llamado {llamadas} veces sin respuesta: considere marcarlo ausente.
                        </Alert>
                      )}
                      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                        {a.estado === 'llamada' ? (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<PlayArrow />}
                              onClick={() =>
                                act('startAttention', a, `Atención iniciada: ${a.codigoVisible}`)
                              }
                            >
                              Iniciar atención
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Replay />}
                              onClick={() => act('repeatCall', a, `Llamado repetido: ${a.codigoVisible}`)}
                            >
                              Repetir llamado
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant={sugerirAusente ? 'contained' : 'text'}
                              startIcon={<PersonOff />}
                              onClick={() =>
                                act(
                                  'markAbsent',
                                  a,
                                  `${a.codigoVisible} marcado ausente. El paciente quedó bloqueado.`,
                                  {
                                    confirm: {
                                      title: `¿Marcar ausente ${a.codigoVisible}?`,
                                      message:
                                        'El paciente quedará bloqueado para nuevas fichas hasta que se lo habilite. Si llega más tarde hoy, puede revertirse.',
                                      confirmLabel: 'Marcar ausente',
                                      destructive: true,
                                    },
                                  },
                                )
                              }
                            >
                              Ausente
                            </Button>
                            <Button
                              size="small"
                              startIcon={<Undo />}
                              onClick={() =>
                                act('backToQueue', a, `${a.codigoVisible} volvió a la sala de espera.`)
                              }
                            >
                              Volver a espera
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<TaskAlt />}
                            onClick={() => act('finish', a, `Atención finalizada: ${a.codigoVisible}`)}
                          >
                            Atendido
                          </Button>
                        )}
                      </Stack>
                    </>
                  ) : (
                    <Typography color="text.secondary">Consultorio libre.</Typography>
                  )}
                </Box>

                <Button
                  fullWidth
                  variant={a ? 'outlined' : 'contained'}
                  size="large"
                  startIcon={<Campaign />}
                  disabled={Boolean(a) || !c.espera.length}
                  onClick={() => act('callNext', c, null, { consultorio: true })}
                >
                  Llamar siguiente {c.espera.length ? `(${c.espera[0].codigoVisible})` : ''}
                </Button>

                <Divider sx={{ my: 1.5 }} />
                <Typography variant="subtitle2" component="h4">
                  En espera ({c.espera.length})
                </Typography>
                {c.espera.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Nadie en espera.
                  </Typography>
                ) : (
                  <List dense disablePadding aria-label={`En espera en ${c.consultorio}`}>
                    {c.espera.map((f, i) => (
                      <ListItem
                        key={f.id}
                        disableGutters
                        divider={i < c.espera.length - 1}
                        secondaryAction={
                          f.prioridad === 'preferente' ? <StatusChip estado="preferente" /> : null
                        }
                      >
                        <ListItemText
                          primary={`${i + 1}. ${f.codigoVisible} · ${f.paciente}`}
                          secondary={`Llegó ${formatTime(f.llegadaEn)} · hora estimada ${f.horaEstimada}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}
