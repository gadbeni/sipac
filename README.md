# SIPAC — Sistema de Gestión de Fichas y Turnos Médicos

Prototipo funcional para la solicitud, asignación y entrega de fichas médicas en centros de salud públicos
(multicentro), orientado inicialmente al departamento del Beni, Bolivia.

> ⚠️ **Prototipo de demostración.** Todos los datos son ficticios. La autenticación es simulada y los datos
> se guardan en el navegador (LocalStorage). **No es apto para producción.**

| Documento | Contenido |
|---|---|
| [ROADMAP.md](ROADMAP.md) | Decisiones, flujos, épicas y criterios de aceptación |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arquitectura, stack, riesgos de LocalStorage, migración a Laravel |
| [DATA_MODEL.md](DATA_MODEL.md) | Entidades, relaciones y ejemplos JSON |
| [BUSINESS_RULES.md](BUSINESS_RULES.md) | Reglas de negocio `RN-*`, estados, permisos e indicadores |

## Requisitos

- Node.js 22 o superior, npm 10 o superior.

## Uso

```bash
npm install        # usa legacy-peer-deps (.npmrc) por dependencias opcionales de vitest
npm run dev        # http://localhost:5173
npm test           # pruebas de reglas, capa de datos y semilla
npm run lint
npm run build      # salida estática en dist/
```

Página interna de verificación de datos: `/dev/datos` (cantidad de registros, integridad, uso de
almacenamiento y botón **Restaurar datos de demostración**).

Otras páginas útiles:

- `/centros`: catálogo de centros en tarjetas o mapa (OpenStreetMap, requiere internet), con búsqueda,
  filtros por municipio y tipo, y orden por cercanía si se permite la ubicación. El centro elegido se
  recuerda en el navegador y se muestra en el encabezado del portal.
- Portal (`/`, `/especialidades`, `/medicos-de-turno`, `/horarios`): dependen del centro elegido. Las
  “fichas disponibles” son los cupos por internet libres que calcula el motor de disponibilidad; los
  médicos de turno respetan permisos, ausencias y feriados.
- `/solicitar-ficha`: asistente de 7 pasos (centro, especialidad, fecha, profesional, datos, confirmar,
  comprobante imprimible). Crea una solicitud **pendiente**: no ocupa cupo hasta que el centro la aprueba.
- `/consultar`: consulta con código + número de documento (p. ej. `CSC-7K3F9Q` / `1234567`) y cancelación
  ciudadana. Para probar el bloqueo por inasistencia, solicite con el documento `5111032`.
- `/admin/centros`: alta, edición y activación/desactivación de centros.
- `/admin/configuracion`: modo claro / oscuro / según el sistema, **simular sin conexión** y restaurar datos.
- `/dev/componentes` (solo con `npm run dev`, o con `VITE_DEV_PAGES=true` en el build): catálogo de los
  componentes comunes (estados, indicadores, gráficos, tabla, formulario, diálogos) para revisarlos en ambos modos.

## Datos de demostración

- Los JSON de `src/data/` son la fuente inicial. Se cargan en LocalStorage la primera vez que se abre la app.
- La actividad (solicitudes y fichas) se genera **relativa a la fecha actual** (8 días de historial y 7 hacia
  adelante), respetando horarios, cupos, feriados y bloqueos, para que el sistema siempre luzca “vivo”.
- Las modificaciones hechas durante la demo persisten en el navegador hasta restaurar los datos.
- Cada día que pasa, al abrir la app se cierran las jornadas anteriores (fichas no atendidas → ausente y
  bloqueo del paciente; solicitudes sin asignar → vencidas). Para una demo “fresca”, restaure los datos.

### Credenciales (todas con contraseña `Demo2026!`)

Ingreso en `/login` (también desde “Ingresar” en el portal). La pantalla de ingreso tiene el panel
desplegable **Usuarios de demostración** con estos usuarios. Autenticación **simulada**: la sesión dura 8 h,
el menú y las rutas dependen del rol (una URL sin permiso muestra 403) y el administrador central y los
médicos multicentro cambian de centro de trabajo desde la barra superior.

| Usuario | Rol | Centro |
|---|---|---|
| `admin.central` | Administrador central | Todos |
| `admin.central.cs` | Administrador de centro | Central |
| `recepcion.central` | Recepcionista | Central |
| `responsable.central` | Responsable médico | Central |
| `dra.mendez` | Médico | Central y Pompeya |
| `admin.pompeya` / `recepcion.pompeya` | Admin. de centro / Recepcionista | Pompeya |
| `admin.villacorina` / `recepcion.villacorina` | Admin. de centro / Recepcionista | Villa Corina |
| `dr.melgar` | Médico | Central y Villa Corina |

### Escenarios incluidos

| Código | Qué muestra |
|---|---|
| `CSC-7K3F9Q` (CI 1234567) | Ficha confirmada para mañana |
| `CSC-PND2A4` (CI 2345678) | Solicitud pendiente de aprobación |
| `CSC-X5T4C6` | Solicitud en lista de espera (sin cupos) con **datos por verificar** (teléfono distinto: se resuelve en Pacientes) |
| `CSC-AUS8G2` | Paciente que no se presentó → bloqueado |
| `CSC-RPG9H3` | Ficha reprogramada |
| `CSC-CNC2J4` | Solicitud cancelada por la ciudadana |
| `CSC-RCH5D7` / `CSC-VNC2K5` | Solicitud rechazada / vencida |
| `CSC-SHR6P9` + `CSP-SHR7Q2` | Mismo paciente en dos centros (aislamiento por centro) |

### Pantalla de llamado (TV)

1. En una ventana, ingresar como `recepcion.central` y abrir **Entrega de fichas**.
2. Pulsar **Pantalla de llamado** (abre `/pantalla/CSC` en otra ventana; no requiere sesión).
   Cada centro usa su código corto: `/pantalla/CSP`, `/pantalla/CVC`, `/pantalla/CSJ`, `/pantalla/PSV`.
3. Mover el mouse sobre la pantalla muestra los botones **Pantalla completa**, **Sonido** y **Voz**
   (se ocultan solos). Los navegadores bloquean el sonido hasta el primer toque o clic; en una TV fija
   se puede abrir Chrome en modo quiosco con `--kiosk --autoplay-policy=no-user-gesture-required`.
4. Al pulsar **Llamar siguiente** o **Repetir llamado** en recepción, la pantalla muestra el número con
   animación y timbre (y voz, si está activada).

## Limitaciones conocidas del prototipo

- Los datos viven en **un solo navegador**: para demostrar recepción + pantalla de llamado, usar ventanas o
  pestañas del mismo navegador (se sincronizan automáticamente). Una TV real necesitará el backend.
- Los datos de demostración cubren 8 días de historial (límite de LocalStorage en Safari): un reporte
  de 30 días muestra sin registros los días anteriores y lo avisa.
- La voz del llamado depende de las voces en español instaladas en el equipo (Web Speech API).
- Sin conexión, la app bloquea las operaciones que en producción irían al servidor.
- El mapa de centros requiere internet (teselas de OpenStreetMap).

## Configuración institucional

Nombre del sistema, institución, colores y logotipos: `src/config/app.config.js` y variables `VITE_*`
(ver `.env.example`). Los logotipos incluidos son genéricos.

## Despliegue (Vercel)

Proyecto estático: comando `npm run build`, directorio `dist`. `vercel.json` redirige todas las rutas a
`index.html` para que funcionen las rutas profundas.
