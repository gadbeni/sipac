/**
 * /pantalla/:codigoCentro — pantalla de llamado para la TV de la sala de espera (Épica 11).
 * Pública y de solo lectura: muestra únicamente códigos de ficha (RN-PAN-02). Se actualiza al
 * instante con los cambios de recepción (otra pestaña o ventana del mismo navegador) y, como
 * respaldo, cada 30 s.
 */
import { useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import Fullscreen from '@mui/icons-material/Fullscreen';
import FullscreenExit from '@mui/icons-material/FullscreenExit';
import VolumeUp from '@mui/icons-material/VolumeUp';
import VolumeOff from '@mui/icons-material/VolumeOff';
import RecordVoiceOver from '@mui/icons-material/RecordVoiceOver';
import VoiceOverOff from '@mui/icons-material/VoiceOverOff';
import CloudOff from '@mui/icons-material/CloudOff';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { useConnectivity } from '@/context/ConnectivityContext';
import { queueService } from '@/services/queueService';
import { audioBlocked, callPhrase, playChime, speak, speechAvailable, unlockAudio } from '@/utils/callAlert';
import { readPref, writePref } from '@/utils/preferences';
import { formatDateLong, formatTime, now, parseIso } from '@/utils/dates';
import { appConfig } from '@/config/app.config';

const WATCH = ['fichas', 'consultorios', 'horarios', 'excepcionesAgenda', 'centros', 'medicoCentros'];
const POLL_MS = 30_000;
const FRESH_MS = 12_000; // tiempo que el llamado se destaca con animación
const IDLE_MS = 4_000; // los botones de la pantalla se ocultan sin movimiento del mouse
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

const flash = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(43, 181, 138, 0); background-color: #0E1521; }
  50% { box-shadow: 0 0 0 10px rgba(43, 181, 138, 0.45); background-color: #0F3A2E; }
`;
const blink = keyframes`50% { opacity: 0.35; }`;

/** Reloj que avanza cada segundo. */
function useClock() {
  const [t, setT] = useState(() => now());
  useEffect(() => {
    const id = setInterval(() => setT(now()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function useFullscreen() {
  const [active, setActive] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const on = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const supported = Boolean(document.documentElement.requestFullscreen);
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return { active, supported, toggle };
}

/** Muestra los controles de la pantalla al mover el mouse; los oculta tras unos segundos. */
function useIdle() {
  const [idle, setIdle] = useState(true);
  const timer = useRef(null);
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setIdle(true), IDLE_MS);
    };
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', wake);
    window.addEventListener('touchstart', wake);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', wake);
      window.removeEventListener('touchstart', wake);
    };
  }, []);
  return idle;
}

export default function CallDisplayPage() {
  const { codigoCentro } = useParams();
  const { online } = useConnectivity();
  const clock = useClock();
  const screen = useFullscreen();
  const idle = useIdle();
  const [sound, setSound] = useState(() => readPref('pantallaSonido', true) !== false);
  const [voice, setVoice] = useState(() => readPref('pantallaVoz', false) === true);
  const [blocked, setBlocked] = useState(audioBlocked);
  const board = useAsync(() => queueService.getBoard(codigoCentro), [codigoCentro], { watch: WATCH });
  const { reload } = board;
  const data = board.data;

  // Respaldo: refresco periódico y al recuperar la conexión.
  useEffect(() => {
    const id = setInterval(() => reload(true), POLL_MS);
    const back = () => reload(true);
    window.addEventListener('online', back);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', back);
    };
  }, [reload]);

  // El navegador habilita el audio con el primer toque o clic sobre la pantalla.
  useEffect(() => {
    if (!blocked) return undefined;
    const unlock = () => unlockAudio().then((ok) => setBlocked(!ok));
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [blocked]);

  // Aviso sonoro y voz con cada llamado o repetición (no al abrir la pantalla).
  const lastEvent = useRef(undefined);
  const prefs = useRef({ sound, voice });
  useEffect(() => {
    prefs.current = { sound, voice };
  });
  useEffect(() => {
    if (!data) return;
    const ev = data.eventoLlamado;
    const first = lastEvent.current === undefined;
    if (ev === lastEvent.current) return;
    lastEvent.current = ev;
    const call = data.ultimoLlamado;
    if (first || !call || `${call.id}#${call.llamadas}` !== ev) return;
    if (now().diff(parseIso(call.llamadaEn), 'millisecond') > FRESH_MS) return;
    if (prefs.current.sound) playChime();
    if (prefs.current.voice)
      setTimeout(
        () => speak(callPhrase(call.codigoVisible, call.consultorio)),
        prefs.current.sound ? 1200 : 0,
      );
  }, [data]);

  useEffect(() => {
    if (data?.centro) document.title = `Pantalla de llamado · ${data.centro.nombre} · ${appConfig.name}`;
  }, [data?.centro]);

  if (board.loading && !data) return <Centered>Cargando pantalla de llamado…</Centered>;
  if (board.error && !data) return <Centered>No se pudo cargar la pantalla. Reintentando…</Centered>;
  if (!data)
    return (
      <Centered>
        <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
          Centro no encontrado
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          El código “{codigoCentro}” no corresponde a un centro de salud activo.
        </Typography>
        <Button variant="contained" component={RouterLink} to="/centros">
          Ver centros de salud
        </Button>
      </Centered>
    );

  const call = data.ultimoLlamado;
  const fresh = call && clock.diff(parseIso(call.llamadaEn), 'millisecond') <= FRESH_MS;
  const toggleSound = () => {
    const v = !sound;
    setSound(v);
    writePref('pantallaSonido', v);
    if (v) unlockAudio().then((ok) => setBlocked(!ok));
  };
  const toggleVoice = () => {
    const v = !voice;
    setVoice(v);
    writePref('pantallaVoz', v);
  };

  return (
    <Box
      sx={{
        minHeight: { md: '100vh' },
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, md: 3, xl: 4 },
        gap: { xs: 2, md: 3 },
        cursor: idle ? 'none' : 'auto',
      }}
    >
      {/* Encabezado: centro, fecha y reloj */}
      <Stack
        component="header"
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontWeight: 700, fontSize: { xs: 13, md: 18 }, letterSpacing: 2 }}
          >
            Pantalla de llamado
          </Typography>
          <Typography
            component="h1"
            sx={{ fontWeight: 800, lineHeight: 1.1, fontSize: { xs: 24, md: 36, xl: 44 } }}
          >
            {data.centro.nombre}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography
            aria-label={`Hora actual ${clock.format('HH:mm')}`}
            sx={{
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              fontSize: { xs: 36, md: 56, xl: 72 },
            }}
          >
            {clock.format('HH:mm')}
            <Box component="span" sx={{ fontSize: '0.45em', color: 'text.secondary', ml: 0.5 }}>
              {clock.format('ss')}
            </Box>
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: { xs: 14, md: 20, xl: 24 } }}>
            {cap(formatDateLong(data.fecha))}
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gap: { xs: 2, md: 3 },
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2.2fr) minmax(320px, 1fr)' },
          minHeight: 0,
        }}
      >
        <Stack spacing={{ xs: 2, md: 3 }} sx={{ minWidth: 0 }}>
          {/* Llamado actual */}
          <Box
            component="section"
            aria-label="Llamado actual"
            aria-live="assertive"
            aria-atomic="true"
            key={data.eventoLlamado || 'sin-llamado'}
            sx={{
              border: 2,
              borderColor: fresh ? 'primary.main' : 'divider',
              borderRadius: 4,
              bgcolor: 'background.paper',
              textAlign: 'center',
              px: 3,
              py: { xs: 3, md: 2.5, xl: 3 },
              animation: fresh ? `${flash} 1.2s ease-in-out 4` : 'none',
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            {call ? (
              <>
                <Typography
                  sx={{
                    fontWeight: 700,
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    color: 'primary.main',
                    fontSize: { xs: 18, md: 28, xl: 34 },
                  }}
                >
                  Llamando
                  {call.llamadas > 1 && (
                    <Box component="span" sx={{ color: 'warning.main', ml: 1.5 }}>
                      · {call.llamadas}.º llamado
                    </Box>
                  )}
                </Typography>
                <Typography
                  data-testid="codigo-llamado"
                  sx={{
                    fontWeight: 900,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 'clamp(88px, 9.5vw, 230px)',
                    my: { xs: 1, md: 1.5 },
                    wordBreak: 'break-all',
                  }}
                >
                  {call.codigoVisible}
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: { xs: 26, md: 40, xl: 50 } }}>
                  Diríjase a{' '}
                  <Box component="span" sx={{ color: 'primary.main' }}>
                    {call.consultorio}
                  </Box>
                </Typography>
                {call.preferente && (
                  <Chip
                    label="Atención preferente"
                    color="warning"
                    sx={{ mt: 2, fontSize: { xs: 14, md: 20 }, height: { md: 40 }, px: 1 }}
                  />
                )}
              </>
            ) : (
              <Box sx={{ py: { xs: 2, md: 5 } }}>
                <Typography sx={{ fontWeight: 800, fontSize: { xs: 32, md: 56, xl: 72 } }}>
                  Espere su llamado
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: { xs: 18, md: 28 }, mt: 1 }}>
                  {data.enEspera
                    ? `${data.enEspera} ${data.enEspera === 1 ? 'paciente' : 'pacientes'} en sala de espera`
                    : 'Su número aparecerá aquí cuando sea su turno.'}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Consultorios */}
          <Box
            component="section"
            aria-label="Consultorios"
            sx={{
              display: 'grid',
              gap: { xs: 1.5, md: 2 },
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
            }}
          >
            {data.consultorios.length === 0 && (
              <Typography sx={{ color: 'text.secondary', fontSize: { xs: 18, md: 24 } }}>
                Hoy no hay consultorios con atención programada.
              </Typography>
            )}
            {data.consultorios.map((c) => (
              <ConsultorioCard key={c.consultorioId} c={c} />
            ))}
          </Box>
        </Stack>

        {/* Últimos llamados */}
        <Box
          component="section"
          aria-label="Últimos llamados"
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 4,
            bgcolor: 'background.paper',
            p: { xs: 2, md: 3 },
            minWidth: 0,
          }}
        >
          <Typography
            component="h2"
            sx={{ fontWeight: 800, fontSize: { xs: 20, md: 28 }, mb: { xs: 1, md: 2 } }}
          >
            Últimos llamados
          </Typography>
          {data.ultimos.length === 0 ? (
            <Typography sx={{ color: 'text.secondary', fontSize: { xs: 16, md: 22 } }}>
              Todavía no hubo llamados hoy.
            </Typography>
          ) : (
            <Stack
              component="ol"
              sx={{ listStyle: 'none', p: 0, m: 0 }}
              divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}
            >
              {data.ultimos.map((t) => (
                <Stack
                  component="li"
                  key={t.id}
                  direction="row"
                  sx={{
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    py: { xs: 1, md: 1.5 },
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: { xs: 28, md: 44, xl: 52 },
                      lineHeight: 1.1,
                    }}
                  >
                    {t.codigoVisible}
                  </Typography>
                  <Box sx={{ textAlign: 'right', minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: { xs: 16, md: 22 } }}>
                      {t.consultorio}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: { xs: 14, md: 18 } }}>
                      {formatTime(t.llamadaEn)} · {ESTADO[t.estado] || ''}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      </Box>

      <Stack
        component="footer"
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          color: 'text.secondary',
          fontSize: { xs: 13, md: 16 },
        }}
      >
        <span>Por su privacidad, solo se muestra el número de ficha. Prototipo de demostración.</span>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {sound && blocked && (
            <Chip
              icon={<VolumeOff />}
              label="Toque la pantalla para activar el sonido"
              size="small"
              sx={{ bgcolor: 'subtle' }}
            />
          )}
          {!online && (
            <Chip
              icon={<CloudOff />}
              label="Sin conexión: mostrando los últimos datos"
              color="warning"
              size="small"
            />
          )}
          <span>Actualizado {formatTime(data.generadoEn)}</span>
        </Stack>
      </Stack>

      {/* Opciones de la pantalla (no hay controles de llamado: RN-PAN-03). */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          opacity: idle ? 0 : 1,
          pointerEvents: idle ? 'none' : 'auto',
          transition: 'opacity .3s',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 3,
          p: 1,
        }}
      >
        <Button
          color="inherit"
          startIcon={sound ? <VolumeUp /> : <VolumeOff />}
          onClick={toggleSound}
          aria-pressed={sound}
        >
          {sound ? 'Sonido' : 'Sin sonido'}
        </Button>
        {speechAvailable() && (
          <Button
            color="inherit"
            startIcon={voice ? <RecordVoiceOver /> : <VoiceOverOff />}
            onClick={toggleVoice}
            aria-pressed={voice}
          >
            {voice ? 'Voz' : 'Sin voz'}
          </Button>
        )}
        {screen.supported && (
          <Button
            color="inherit"
            startIcon={screen.active ? <FullscreenExit /> : <Fullscreen />}
            onClick={screen.toggle}
          >
            {screen.active ? 'Salir' : 'Pantalla completa'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}

const ESTADO = {
  llamada: 'Llamando',
  en_atencion: 'En atención',
  atendida: 'Atendida',
  ausente: 'No se presentó',
  en_espera: 'En espera',
};

function ConsultorioCard({ c }) {
  const a = c.actual;
  const llamando = a?.estado === 'llamada';
  return (
    <Box
      sx={{
        border: 1,
        borderColor: llamando ? 'primary.main' : 'divider',
        borderRadius: 3,
        bgcolor: 'background.paper',
        p: { xs: 2, md: 2 },
        minWidth: 0,
      }}
    >
      <Typography component="h3" sx={{ fontWeight: 800, fontSize: { xs: 20, md: 26 } }}>
        {c.consultorio}
      </Typography>
      <Typography noWrap sx={{ color: 'text.secondary', fontSize: { xs: 14, md: 17 } }}>
        {[c.especialidad, c.medico].filter(Boolean).join(' · ') || 'Sin atención programada'}
      </Typography>
      <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
        <Typography
          sx={{
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            fontSize: { xs: 40, md: 48, xl: 56 },
            lineHeight: 1.05,
            color: a ? 'text.primary' : 'text.disabled',
          }}
        >
          {a ? a.codigoVisible : '—'}
        </Typography>
        {a && (
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { xs: 15, md: 20 },
              color: llamando ? 'primary.main' : 'info.main',
              animation: llamando ? `${blink} 1.4s ease-in-out infinite` : 'none',
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            {llamando ? 'Llamando' : 'En atención'}
          </Typography>
        )}
      </Stack>
      <Typography sx={{ color: 'text.secondary', fontSize: { xs: 15, md: 19 }, mt: 1 }}>
        {c.proximos.length ? (
          <>
            Próximos:{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
              {c.proximos.map((p) => p.codigoVisible).join('  ·  ')}
            </Box>
            {c.enEspera > c.proximos.length && ` (+${c.enEspera - c.proximos.length})`}
          </>
        ) : (
          'Sin pacientes en espera'
        )}
      </Typography>
    </Box>
  );
}

function Centered({ children }) {
  return (
    <Box
      sx={{
        minHeight: '80vh',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        p: 3,
        fontSize: 24,
      }}
    >
      <Box>{children}</Box>
    </Box>
  );
}
