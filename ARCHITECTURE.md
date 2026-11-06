# ARCHITECTURE — Sistema de Gestión de Fichas y Turnos Médicos (SIPAC)

> Documento de decisiones técnicas para el prototipo estático (React + Vite + LocalStorage) y su evolución hacia Laravel + MySQL.
> Documentos relacionados: [ROADMAP.md](ROADMAP.md) · [DATA_MODEL.md](DATA_MODEL.md) · [BUSINESS_RULES.md](BUSINESS_RULES.md)

---

## 1. Principios de arquitectura

1. **Los componentes nunca tocan los datos directamente.** Toda lectura o escritura pasa por una capa de *servicios* que es asíncrona (devuelve `Promise`) aunque hoy lea de LocalStorage. Así, el día que exista una API Laravel solo se reemplaza el adaptador de datos.
2. **Las reglas de negocio viven en los servicios**, no en los componentes ni en los formularios. Los formularios (Zod) validan *forma*; los servicios validan *negocio* (cupos, duplicados, permisos, centro).
3. **Todo dato operativo lleva `centroId`.** Los servicios exigen el `centroId` como parámetro explícito y verifican que el usuario tenga acceso a ese centro.
4. **Disponibilidad calculada, no almacenada.** Los cupos libres se calculan a partir de horarios + excepciones de agenda + fichas existentes. No se guarda un contador “cupos disponibles” que pueda desincronizarse.
5. **Configuración institucional externa al código.** Nombre del sistema, institución, logotipos, colores y textos legales salen de un archivo de configuración + variables `VITE_*`.
6. **Sin dependencias innecesarias.** Cada librería añadida tiene una justificación (ver §3).

---

## 2. Vista general por capas

```
┌──────────────────────────────────────────────────────────────────┐
│  UI: pages/ + components/   (MUI, React Hook Form + Zod, Recharts)│
├──────────────────────────────────────────────────────────────────┤
│  Hooks: useCenters, useAvailability, useRequests, useAuth…        │
│  (estado de carga, errores, refetch, suscripción a cambios)       │
├──────────────────────────────────────────────────────────────────┤
│  Context: Theme · Auth · Center · Notify(Snackbar) · Connectivity │
├──────────────────────────────────────────────────────────────────┤
│  Services (dominio): centerService, scheduleService,              │
│  requestService, appointmentService, queueService, reportService… │
│  → reglas de negocio, permisos, validación de centro, transacción │
├──────────────────────────────────────────────────────────────────┤
│  Repositories: createRepository('fichas') → list/get/create/…     │
├──────────────────────────────────────────────────────────────────┤
│  DataSource (adaptador intercambiable)                            │
│   • LocalDataSource  → LocalStorage + semilla JSON   (hoy)        │
│   • ApiDataSource    → fetch a Laravel REST           (futuro)    │
└──────────────────────────────────────────────────────────────────┘
```

### 2.1 Contrato del repositorio

```js
// services/repositories/createRepository.js
repo.list({ where, sort, page, pageSize })   // where: { centroId, estado, fecha… }
repo.getById(id)
repo.create(data)        // asigna id, creadoEn, actualizadoEn
repo.update(id, patch)   // actualizadoEn
repo.remove(id)          // sólo se usa en catálogos; operativos se anulan por estado
```

### 2.2 Contrato de servicios (ejemplos)

```js
centerService.getCenters({ soloActivos, municipio, tipo, texto })
centerService.getCenterById(id)
specialtyService.getSpecialties(centroId, { soloPublicas })
doctorService.getDoctors(centroId)
doctorService.getDoctorsOnDuty(centroId, fecha)          // médicos de turno
scheduleService.getAvailability(centroId, { fecha, especialidadId })
scheduleService.getEnabledDates(centroId, especialidadId, rango)
requestService.createRequest(payload)                    // público
requestService.getPublicStatus(codigo, numeroDocumento)  // consulta pública
requestService.getRequests(centroId, filtros)
requestService.approve(id, { medicoId?, horarioId? })    // emite ficha
requestService.reject(id, motivo) / cancel(id, motivo)
appointmentService.getAppointments(centroId, filtros)
appointmentService.issueWalkIn(centroId, payload)        // ficha presencial
appointmentService.checkIn(id) / reschedule(id, destino) / cancel(id)
appointmentService.callNext(session, consultorioId) / repeatCall(id) / markAbsent(id) / finish(id)
queueService.getBoard(codigoCentro)                       // pantalla de llamado, pública y sin datos personales
reportService.getDashboard(session) / getReport(session, filtros) / getReportOptions(session)   // CSV: utils/csv.js
demoService.resetDemoData()
```

Todos los servicios:
- Reciben el **contexto de sesión** (`session`) cuando la operación es administrativa y llaman a `assertCenterAccess(session, centroId)` y `assertPermission(session, 'fichas.emitir')`.
- Lanzan `AppError(code, message, details)` con códigos estables (`CUPO_AGOTADO`, `SOLICITUD_DUPLICADA`, `SIN_CONEXION`, `ACCESO_DENEGADO`, `CENTRO_INACTIVO`…). La UI traduce el código a un Snackbar/Alert.
- Simulan latencia configurable (`VITE_FAKE_LATENCY_MS`, por defecto 150–300 ms) para que existan estados de carga reales (Skeletons) y el cambio a API no sorprenda.

### 2.3 Transacciones en LocalStorage

Operaciones que tocan varias colecciones (aprobar = actualizar solicitud + crear ficha + crear notificación) usan:

```js
await db.transaction(['solicitudes', 'fichas', 'notificaciones'], (tx) => { ... })
```

Implementación: lee las colecciones, ejecuta la función sobre copias en memoria, **revalida la regla de cupo justo antes de escribir** y persiste todas las claves. Si la función lanza error, no se escribe nada. Ver riesgos de concurrencia entre pestañas en §9.

### 2.4 Sincronización entre pestañas

La pantalla de llamado y el panel de recepción suelen abrirse en ventanas distintas. Se usa el evento `storage` del navegador (y `BroadcastChannel` como refuerzo) para emitir `data:changed { coleccion }`; los hooks se suscriben y refrescan. **Funciona sólo dentro del mismo navegador y equipo** (limitación aceptada del prototipo).

---

## 3. Stack y dependencias

| Paquete | Uso | Justificación |
|---|---|---|
| `react`, `react-dom` | UI | Requerido |
| `vite` | Build / dev server | Requerido |
| `react-router-dom` | Rutas, guards | Requerido |
| `@mui/material`, `@emotion/react`, `@emotion/styled` | Componentes, tema | Requerido |
| `@mui/icons-material` | Material Icons | Requerido (iconos SVG, funcionan offline) |
| `@mui/x-date-pickers` (licencia MIT, versión community) | Calendario del asistente (`DateCalendar` con `shouldDisableDate`), selectores de fecha/hora | MUI no trae datepicker en el core; usa Day.js como adaptador |
| `dayjs` + plugins `utc`, `timezone`, `customParseFormat`, `isoWeek`, `isBetween`, `locale/es` | Fechas, zona `America/La_Paz` | Requerido |
| `recharts` | Gráficos | Requerido |
| `react-hook-form`, `zod`, `@hookform/resolvers` | Formularios y validación | Requerido (resolvers es el puente oficial) |
| `vite-plugin-pwa` | Manifest + Service Worker (Workbox) | Requerido |
| `leaflet`, `react-leaflet` | Mapa de centros | Sugerido en requisitos; es la **única** dependencia que necesita red (teselas OSM) |
| `@fontsource/roboto` | Fuente Roboto empaquetada | Evita depender de Google Fonts y funciona offline en la PWA |
| `vitest` (dev) | Pruebas de servicios/reglas | Las reglas de cupo y estados merecen pruebas automáticas (Épica 14) |
| `eslint`, `prettier` (dev) | Calidad de código | Estándar |

**Se descarta explícitamente:** Redux/Zustand (Context basta), React Query (un hook `useAsync` + bus de eventos cubre el caso; se puede adoptar cuando exista API), FullCalendar (la agenda día/semana/mes se construye con MUI Grid — evita una dependencia pesada y problemas de theming), MUI X DataGrid (se usa un `DataTable` propio sobre `Table` de MUI con búsqueda, orden y paginación; más ligero y totalmente tematizable), axios (`fetch` es suficiente).

Las versiones exactas se fijan en la Épica 1 (`package.json` con versiones sin `^` para la demo).

---

## 4. Estructura de carpetas

Se mantiene la estructura propuesta con tres ajustes: `config/` para la identidad configurable, `services/` dividido en dominio / repositorios / fuentes de datos, y `features/`-like agrupación dentro de `pages/admin` por módulo.

```
fichas-medicas-beni/
├─ public/
│  ├─ icons/                 # iconos PWA (192, 512, maskable)
│  └─ branding/              # logotipos configurables (placeholders genéricos)
├─ src/
│  ├─ main.jsx · App.jsx
│  ├─ config/
│  │  ├─ app.config.js       # nombre sistema, institución, contacto, colores, textos legales
│  │  └─ constants.js        # estados, roles, permisos, límites (ver BUSINESS_RULES)
│  ├─ assets/                # ilustraciones SVG, avatares genéricos
│  ├─ theme/
│  │  ├─ palette.js · typography.js · components.js   # overrides MUI
│  │  ├─ chartTheme.js       # colores de Recharts derivados del tema
│  │  └─ createAppTheme.js   # (mode) => theme
│  ├─ context/
│  │  ├─ ColorModeContext.jsx
│  │  ├─ AuthContext.jsx
│  │  ├─ CenterContext.jsx   # centro público seleccionado / centro activo admin
│  │  ├─ NotifyContext.jsx   # Snackbar global
│  │  └─ ConnectivityContext.jsx
│  ├─ hooks/                 # useAsync, useDataChanged, useCenters, useAvailability…
│  ├─ services/
│  │  ├─ datasource/
│  │  │  ├─ localDataSource.js   # LocalStorage + transacciones
│  │  │  ├─ apiDataSource.js     # stub para Laravel (fetch + mapper snake_case)
│  │  │  └─ index.js             # selecciona por VITE_DATA_SOURCE
│  │  ├─ repositories/createRepository.js
│  │  ├─ seed/
│  │  │  ├─ initDemoData.js      # carga JSON si no hay datos / restaurar
│  │  │  └─ activityGenerator.js # genera actividad coherente relativa a hoy
│  │  ├─ rules/                  # funciones puras: availability.js, stateMachines.js, kpis.js
│  │  ├─ centerService.js · specialtyService.js · doctorService.js
│  │  ├─ scheduleService.js · requestService.js · appointmentService.js
│  │  ├─ queueService.js · patientService.js · reportService.js
│  │  ├─ authService.js · userService.js · notificationService.js · demoService.js
│  │  └─ errors.js
│  ├─ data/                  # JSON semilla (ver DATA_MODEL.md)
│  ├─ utils/                 # dates.js (La Paz, DD/MM/YYYY), csv.js, geo.js (Haversine), codes.js
│  ├─ components/
│  │  ├─ common/             # DataTable, StatusChip, EmptyState, ConfirmDialog, PageHeader…
│  │  ├─ layout/             # PublicHeader, AdminNavbar, AdminSidebar, Footer, OfflineBanner
│  │  ├─ forms/              # FormTextField, FormSelect, FormDatePicker (RHF-controlled)
│  │  ├─ charts/             # ChartCard, BarByDay, PieBySpecialty…
│  │  ├─ centers/            # CenterSelector, CenterCard, CenterMap, SelectedCenterBanner
│  │  └─ schedule/           # AgendaDayView, AgendaWeekView, AgendaMonthView, SlotCell
│  ├─ layouts/
│  │  ├─ PublicLayout.jsx · AdminLayout.jsx · DisplayLayout.jsx (pantalla TV)
│  ├─ pages/
│  │  ├─ public/   # Home, Centros, Especialidades, MedicosTurno, Horarios, SolicitarFicha/, ConsultarSolicitud
│  │  ├─ auth/     # Login
│  │  ├─ display/  # PantallaLlamado
│  │  └─ admin/    # dashboard/, solicitudes/, entrega/, agenda/, medicos/, especialidades/,
│  │                # horarios/, pacientes/, centros/, usuarios/, reportes/, configuracion/, perfil/
│  └─ routes/
│     ├─ AppRouter.jsx
│     ├─ ProtectedRoute.jsx  # exige sesión + permiso
│     └─ routes.config.js    # rutas + permisos + items del sidebar (fuente única)
├─ tests/                    # vitest: reglas y servicios
├─ vercel.json               # rewrites SPA
├─ vite.config.js            # PWA
└─ .env.example
```

---

## 5. Rutas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/` | Landing (hero, centro seleccionado, accesos) | Público |
| `/centros` | Catálogo (tarjetas / mapa), filtros | Público |
| `/centros/:codigo` | Detalle del centro | Público |
| `/especialidades` | Especialidades del centro seleccionado | Público (requiere centro) |
| `/medicos-de-turno` | Hoy / mañana | Público (requiere centro) |
| `/horarios` | Horarios generales y por especialidad | Público (requiere centro) |
| `/solicitar-ficha` | Asistente de 7 pasos | Público |
| `/consultar` | Consulta por código + documento | Público |
| `/pantalla/:codigoCentro` | Pantalla de llamado (TV) | Público, solo lectura |
| `/login` | Ingreso | Público |
| `/admin` | Dashboard | Autenticado |
| `/admin/solicitudes` | Gestión de solicitudes | `solicitudes.gestionar` |
| `/admin/entrega` | Entrega de fichas / sala de espera / control de llamado | `fichas.entregar` |
| `/admin/agenda` | Agenda día/semana/mes | `agenda.ver` |
| `/admin/medicos` (+`/:id`) | Médicos | `medicos.gestionar` |
| `/admin/especialidades` | Especialidades del centro | `especialidades.gestionar` |
| `/admin/horarios` | Plantillas de horario y excepciones | `horarios.gestionar` |
| `/admin/pacientes` (+`/:id`) | Pacientes | `pacientes.ver` |
| `/admin/centros` | Centros | `centros.gestionar` (central) |
| `/admin/usuarios` | Usuarios | `usuarios.gestionar` (central) |
| `/admin/reportes` | Reportes | `reportes.ver` |
| `/admin/configuracion` | Preferencias, restaurar demo | Autenticado |
| `/admin/perfil` | Mi perfil / cambiar contraseña (simulado) | Autenticado |

Despliegue en Vercel con `BrowserRouter` + `vercel.json`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

---

## 6. Estado global (Context)

| Contexto | Contenido | Persistencia |
|---|---|---|
| `ColorModeContext` | `mode: 'light' \| 'dark' \| 'system'` | `localStorage['sipac:pref:colorMode']` |
| `AuthContext` | sesión (`usuarioId`, rol, permisos, `centrosPermitidos`), login/logout | `localStorage['sipac:session']` con expiración (8 h) |
| `CenterContext` | `publicCenterId` (portal) y `activeCenterId` (panel) — separados para que un admin central que navega el portal no cambie su centro de trabajo | `localStorage['sipac:pref:publicCenter']`, sesión |
| `utils/rememberedPatient` | Datos del paciente recordados para el asistente (RN-SOL-15) | `localStorage['sipac:pref:pacienteRecordado']` |
| `NotifyContext` | `notify.success/error/info(msg)` → Snackbar único | — |
| `ConnectivityContext` | `online` (eventos `online/offline`) | — |

Los datos de dominio **no** se guardan en Context (evita renders globales); se obtienen con hooks por pantalla.

---

## 7. Tema visual

- `createAppTheme(mode)` genera el tema a partir de `app.config.js` (`primary #159B72`, `secondary #0F766E`, `background.default #F5F7FA`, `text.primary #1E293B`, `divider #E2E8F0`) y su contraparte oscura (fondo `#0B1220`, papel `#111827`, texto `#E2E8F0`, bordes `#1F2A3A`; el verde primario se aclara a `#2BB58A` para mantener contraste AA).
- **Contraste del verde institucional (Épica 2):** `#159B72` con texto blanco da 3,5:1 y no cumple AA para texto normal. Se conserva como color de **marca** (`palette.brand`: logo, acentos, gráficos) y `primary.main` usa `#0E7A5A` (5,3:1 sobre blanco) en botones y enlaces. Los semánticos también se oscurecen (`success #15803D`, `warning #B45309`, `error #B91C1C`, `info #1D4ED8`); en modo oscuro se aclaran y usan texto `#0B1220`. Tokens en `theme/palette.js`; verificación automática en `tests/contrast.test.js`.
- Chips de estado con tonos suaves (`palette.status.*`: fondo, texto, borde) + icono + texto (`components/common/statusConfig.js`).
- Series de gráficos: paleta categórica de orden fijo validada para daltonismo (`palette.chart`).
- Overrides globales: `MuiCard` (radio 12, borde 1px `divider`, sombra discreta), `MuiButton` (sin mayúsculas forzadas), `MuiTableHead` (fondo sutil), `MuiChip` de estado con colores semánticos.
- Recharts no lee el tema MUI: `chartTheme.js` expone `useChartColors()` (ejes, grilla, tooltip, serie) desde `theme.palette` para que los gráficos cambien con el modo oscuro.
- Leaflet: en modo oscuro se aplica un filtro CSS a la capa de teselas.
- Accesibilidad: contraste mínimo WCAG AA, foco visible, `aria-label` en botones de icono, estados no comunicados solo por color (chip con texto + icono), tamaño táctil ≥ 44 px, pantalla de llamado con tipografía muy grande.
- Fechas: utilidades `formatDate` → `DD/MM/YYYY`, `formatTime` → `HH:mm`, `today()` siempre en `America/La_Paz` (UTC−4, sin horario de verano).

---

## 8. PWA y conectividad

- `vite-plugin-pwa` con `registerType: 'prompt'` (aviso “Hay una nueva versión, actualizar”).
- Precaché del *app shell* (JS, CSS, fuentes, iconos, JSON semilla). Runtime cache `StaleWhileRevalidate` para teselas OSM ya visitadas (límite de entradas).
- Botón “Instalar aplicación” usando `beforeinstallprompt` (y texto de ayuda para iOS).
- `OfflineBanner` visible cuando `navigator.onLine === false`.
- **Regla de honestidad offline:** aunque en el prototipo todo es local, las operaciones de *escritura* que en producción irían al servidor (crear solicitud, aprobar, emitir, cancelar…) **se bloquean sin conexión** con `AppError('SIN_CONEXION')`. Se implementa en un único punto: el `DataSource` de escritura consulta el estado de conectividad. Las lecturas y la navegación siguen funcionando. No se crea cola de envíos diferidos en esta etapa.

---

## 9. Riesgos y limitaciones de la simulación con LocalStorage

| # | Riesgo / limitación | Impacto | Mitigación en el prototipo |
|---|---|---|---|
| R1 | **Datos por navegador y dispositivo.** Lo que registra el ciudadano en su celular no lo ve la recepción en otra PC; la TV de sala no ve la recepción. | Alto para la demo multiusuario | Demostrar en un mismo navegador (varias pestañas/ventanas). Documentarlo en el README y en un aviso de “Modo demostración”. |
| R2 | **Sin concurrencia real.** Dos pestañas pueden leer el mismo estado y emitir el mismo cupo. | Medio | Revalidación del cupo dentro de `transaction` justo antes de escribir + restricción de unicidad (`horarioId+fecha+slot`) comprobada al persistir + **Web Locks API** entre pestañas (Épica 8); refresco por evento `storage`. En producción: transacción MySQL + índice único. |
| R3 | **Cuota de LocalStorage**: ~5 millones de caracteres en Chrome/Firefox; en Safari puede ser ~2,5 millones. Cada escritura reescribe la colección completa. | Medio | Semilla acotada a 8 días de historial + 7 futuros (~1 100 fichas, ~1,6 M caracteres, verificado por prueba automatizada < 1,8 M). Medidor de uso en Configuración. Si el navegador rechaza la cuota, la app sigue funcionando con almacenamiento en memoria (aviso en consola) y `ALMACENAMIENTO_LLENO` en escrituras. |
| R4 | **Datos manipulables** desde DevTools; contraseñas en texto plano en JSON. | Alto si se malinterpreta | Banner permanente “Prototipo — autenticación simulada, no apto para producción”. Credenciales solo ficticias. |
| R5 | **Fechas semilla envejecen.** Un JSON con fechas fijas deja el dashboard vacío una semana después. | Alto | La actividad se genera **relativa a hoy** al inicializar (ver DATA_MODEL §6). Botón “Restaurar datos de demostración”. |
| R6 | **Cambios de esquema** entre versiones rompen datos ya guardados. | Medio | Clave `sipac:meta.schemaVersion`; si no coincide se re-siembra (con aviso). |
| R7 | **Sin tareas programadas** (vencer solicitudes, cerrar jornada). | Medio | Evaluación “perezosa”: al iniciar la app y al leer colecciones se aplican las transiciones por tiempo (ver BUSINESS_RULES RN-SOL-09). |
| R8 | **Reloj del cliente.** “Hoy” depende de la hora del equipo. | Bajo | Siempre calcular en `America/La_Paz`; en producción la fecha la da el servidor. |
| R9 | **Mapa requiere internet** (teselas OSM). | Bajo | El mapa es secundario; sin conexión se muestra la vista de tarjetas y la dirección textual. |
| R10 | **Privacidad.** Datos personales en el navegador. | Medio | Solo datos ficticios; datos mínimos; nada clínico. La consulta pública enmascara nombres (p. ej. “Juan P***”). |
| R11 | **Sincronización entre pestañas** puede fallar en algunos navegadores en modo privado. | Bajo | Botón “Actualizar” en pantallas operativas y refresco periódico (30 s) en la pantalla de llamado. |

---

**Exclusión entre pestañas (Épica 8):** LocalStorage no garantiza exclusión mutua entre pestañas. `datasource/index.js` envuelve `transaction` con la **Web Locks API** (`navigator.locks.request('sipac-datos', …)`): dos pestañas que aprueban el último cupo a la vez se serializan y la segunda recibe `CUPO_AGOTADO` (verificado con dos pestañas reales). Con la API, `transaction` devuelve una promesa; la siembra usa la versión síncrona (`raw`). En Laravel esto lo resuelve la transacción de MySQL con `SELECT … FOR UPDATE` sobre el bloque.

## 10. Camino de migración a Laravel + MySQL

1. Implementar `apiDataSource.js` con el mismo contrato de repositorio, apuntando a `VITE_API_URL`, y un *mapper* `camelCase ⇄ snake_case`.
2. Mover las validaciones de `services/rules/` al backend (Form Requests + Policies por `centro_id`). El frontend conserva las mismas funciones solo para UX (pre-validación); **el backend pasa a ser la autoridad**.
3. Autenticación con Laravel Sanctum; `authService` cambia a llamadas HTTP, `AuthContext` no cambia.
4. Las tablas MySQL siguen 1:1 las colecciones de DATA_MODEL (`medico_centro`, `centro_especialidad` como tablas pivote con atributos).
5. Concurrencia de cupos: `SELECT … FOR UPDATE` sobre el horario/fecha o índice único `(horario_id, fecha, slot)`.
6. Generación de códigos y numeración correlativa en el servidor.
7. Tareas programadas (`schedule:run`) reemplazan la evaluación perezosa (R7).
8. Notificaciones por canales externos (SMS/WhatsApp/correo) se agregan como servicio del backend; fuera del alcance actual.

Los IDs ya son *strings* (ver DATA_MODEL §2), compatibles con ULID/UUID en MySQL; no hay que reescribir componentes que asuman enteros.

---

## 11. Calidad y convenciones

- JavaScript (sin TypeScript) con JSDoc en servicios para documentar tipos de entidades.
- ESLint + Prettier; nombres de componentes en inglés técnico (`CenterCard`), textos de UI 100 % en español centralizados en cada página (sin i18n por ahora; strings agrupados para facilitar una futura extracción).
- Pruebas con Vitest para `services/rules` (disponibilidad, máquinas de estado, KPIs) y servicios críticos (aprobar, emitir, reprogramar, aislamiento por centro).
- Lazy loading de rutas admin (`React.lazy`) para que el portal público cargue rápido en conexiones móviles.
