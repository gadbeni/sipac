# BUSINESS_RULES — Reglas de negocio

> Cada regla tiene un identificador estable (`RN-…`) para referenciarla en código, pruebas y criterios de aceptación.
> Todas se implementan en `src/services/` (nunca en componentes). Ver [DATA_MODEL.md](DATA_MODEL.md) para los campos.

---

## 1. Multicentro y aislamiento

| ID | Regla |
|---|---|
| RN-MC-01 | Todo dato operativo (consultorios, configuración de especialidades, vínculos de médicos, horarios, excepciones, solicitudes, fichas, notificaciones) pertenece a **un único centro** (`centroId`). |
| RN-MC-02 | Todo servicio administrativo recibe `centroId` explícito y verifica `assertCenterAccess(session, centroId)`. Un usuario no central que solicita datos de otro centro recibe `ACCESO_DENEGADO` (no una lista vacía). |
| RN-MC-03 | El `admin_central` puede operar cualquier centro; su “centro activo” se elige en el navbar y todas las pantallas se filtran por él. Reportes y dashboard ofrecen además la vista “Todos los centros”. |
| RN-MC-04 | Un médico con vínculos en varios centros tiene **agendas independientes**: horarios, fichas y excepciones se filtran por centro. Excepciones de alcance `medico` aplican solo al centro donde se registran, salvo las de tipo `ausencia` registradas por el admin central con alcance global del médico. |
| RN-MC-05 | Un mismo médico **no puede tener horarios solapados** en la misma fecha y franja, aunque sean centros distintos. |
| RN-MC-06 | La numeración de fichas, los cupos y las colas de llamado son por centro; nunca se mezclan. |

## 2. Centros de salud

| ID | Regla |
|---|---|
| RN-CEN-01 | `codigo` institucional y `codigoCorto` son únicos. |
| RN-CEN-02 | Solo `admin_central` crea, edita, activa o desactiva centros. |
| RN-CEN-03 | Un centro **inactivo**: no aparece en el selector público, no acepta solicitudes ni emisión de fichas, conserva todo su historial y sigue visible en reportes y para el admin central. |
| RN-CEN-04 | Al desactivar un centro con fichas futuras `confirmada`, el sistema muestra cuántas existen y exige confirmar; las fichas no se cancelan automáticamente (deben reprogramarse o cancelarse con motivo). |
| RN-CEN-05 | El centro público seleccionado persiste entre navegaciones y sesiones del navegador; si el centro guardado pasa a inactivo, se borra la selección y se pide elegir otro. |
| RN-CEN-06 | El `codigoCorto` no se modifica después de crear el centro: forma parte de los códigos de solicitud ya emitidos (p. ej. `CSC-7K3F9Q`). |
| RN-CEN-07 | La ubicación del ciudadano se pide solo al pulsar “Usar mi ubicación”; se usa en el navegador para calcular distancias en línea recta y no se guarda ni se envía. Si se deniega el permiso, el catálogo sigue funcionando sin distancias. |

## 3. Especialidades

| ID | Regla |
|---|---|
| RN-ESP-01 | El catálogo de especialidades es global (lo administra `admin_central`). Cada centro activa las que ofrece mediante `CentroEspecialidad`. |
| RN-ESP-02 | Una especialidad se muestra en el portal del centro solo si: el vínculo está activo, `aceptaSolicitudesPublicas = true` **o** se muestra con la etiqueta “Solo en ventanilla”, y existe al menos un horario activo. |
| RN-ESP-03 | Desactivar una especialidad en un centro impide nuevas solicitudes; las solicitudes/fichas existentes se mantienen. |
| RN-ESP-04 | La “cantidad de fichas” de una especialidad es la suma de cupos de sus horarios; se configura en los horarios, no en la especialidad (fuente única). |
| RN-ESP-05 | `asignacionMedico = automatica` oculta el paso de elección de médico en el asistente (se muestra “El médico será asignado por el establecimiento”). |
| RN-ESP-06 | El `codigo` de una especialidad del catálogo no se modifica: forma parte de los números de ficha emitidos (`MG-07`). |

## 4. Médicos

| ID | Regla |
|---|---|
| RN-MED-01 | `numeroDocumento` y `registroProfesional` son únicos globalmente. Al crear un médico con un documento ya existente, el sistema ofrece **vincular el médico existente** al centro en vez de duplicarlo. |
| RN-MED-02 | Los datos personales del médico (nombre, documento, registro) los editan `admin_central` y los `admin_centro`/`responsable_medico` de centros donde está vinculado. Los datos del vínculo (especialidades en el centro, cargo, horarios) solo los edita el centro correspondiente. |
| RN-MED-03 | Desactivar el **vínculo** (`medicoCentro.activo = false`) lo retira de ese centro; desactivar el **médico** lo retira de todos. En ambos casos no se borran fichas; las futuras deben reasignarse o cancelarse (se listan al confirmar). |
| RN-MED-04 | Un médico solo puede tener horarios en especialidades que ejerce en ese centro (`medicoCentro.especialidadIds`). |
| RN-MED-05 | No se usan fotografías de personas reales; por defecto avatar con iniciales. |
| RN-MED-06 | Desactivar a un profesional en **toda la red** lo hace solo `admin_central`; un centro desactiva únicamente su vínculo. No se puede quitar una especialidad del vínculo mientras tenga horarios activos. |

## 5. Horarios, agendas y disponibilidad

| ID | Regla |
|---|---|
| RN-HOR-01 | Un horario es una plantilla semanal (día, franja, consultorio, duración, cupos, cupos públicos, vigencia). |
| RN-HOR-02 | `cuposPublicos ≤ cupos` y `cupos × duracionConsultaMin ≤ duración del bloque`. |
| RN-HOR-03 | No se permiten solapamientos del mismo médico (RN-MC-05) ni del mismo consultorio en la misma franja. |
| RN-HOR-04 | La franja del horario debe estar dentro del horario general del centro para ese día (advertencia, no bloqueo, si se trata de un turno extendido). |
| RN-HOR-05 | Modificar o desactivar un horario **no altera fichas ya emitidas**. Si la reducción de cupos deja fichas por encima del nuevo máximo, se advierte y se exige confirmar; las fichas existentes se respetan. |
| RN-HOR-06 | Un horario con fichas futuras emitidas no cambia de día, hora de inicio, duración, consultorio, profesional ni especialidad (las fichas quedarían fuera de su franja): se crea un horario nuevo y se desactiva el anterior. Sí puede cambiar cupos, hora de fin y vigencia, con advertencia. |
| RN-AGE-01 | Las excepciones (`feriado`, `ausencia`, `permiso`, `bloqueo`) anulan los bloques que intersectan; `ajuste_cupos` cambia los cupos de un bloque en una fecha. Los feriados globales aplican a todos los centros. |
| RN-AGE-02 | Registrar una excepción sobre una fecha con fichas emitidas muestra las fichas afectadas y obliga a elegir: reprogramar en lote, cancelar en lote con motivo, o abortar. |
| RN-AGE-03 | La disponibilidad **se calcula** (DATA_MODEL §5); nunca se guarda un contador de cupos libres. |
| RN-AGE-04 | **Reprogramación en lote** por novedad: cada ficha afectada va a la primera fecha (hasta 14 días) con cupo del mismo centro y especialidad, prefiriendo el mismo profesional y respetando el canal (web solo cupos web). Si no hay lugar, se cancela con el motivo de la novedad. Se notifica a recepción para avisar a los pacientes. Eliminar una novedad no restaura las fichas ya movidas o canceladas. |
| RN-AGE-05 | Novedades de alcance “toda la red” (feriados, bloqueos) y ausencias de un profesional en todos sus centros solo las registra `admin_central`. No se registran novedades en fechas pasadas ni de más de 90 días. |
| RN-DIS-01 | Una fecha está **habilitada** en el asistente público si: `fecha ≥ hoy`, `fecha ≤ hoy + diasAnticipacionMax` (14 por defecto), hay al menos un bloque efectivo de la especialidad con cupos **públicos** libres, y — si es hoy — la hora actual es anterior a `horaInicio del último bloque − cierreMismoDiaMin`. |
| RN-DIS-02 | Las solicitudes **pendientes no consumen cupo**. Solo las fichas en estados que ocupan cupo lo hacen (DATA_MODEL §5). |
| RN-DIS-03 | Para evitar acumulación ilimitada, el portal deja de aceptar solicitudes para una especialidad/fecha cuando `pendientes ≥ cuposPublicosLibres × factorLimitePendientes` (2 por defecto); se informa “Demanda alta: intente otra fecha”. |

## 6. Solicitudes

### 6.1 Creación

| ID | Regla |
|---|---|
| RN-SOL-01 | Solo se crean solicitudes en centros activos, para especialidades que aceptan solicitudes públicas y fechas habilitadas (RN-DIS-01). La validación se repite en el servicio al confirmar (la disponibilidad pudo cambiar durante el asistente). |
| RN-SOL-02 | **Sin duplicados:** un paciente no puede tener más de una solicitud activa (`pendiente`, `lista_espera`, `aprobada` con ficha activa) para el mismo **centro + especialidad + fecha**. |
| RN-SOL-03 | Límite de solicitudes activas por paciente: 3 en total (configurable) para todos los centros. |
| RN-SOL-04 | El paciente se identifica por `tipoDocumento + numeroDocumento (+ complemento)`. Si ya existe, **no se sobrescriben** sus datos desde el portal público; si los datos ingresados difieren, la solicitud se marca “Datos por verificar” para recepción. |
| RN-SOL-05 | Validaciones de datos: documento alfanumérico 5–15; nombres/apellidos 2–60 letras; fecha de nacimiento pasada y ≤ 120 años; teléfono boliviano (8 dígitos, prefijo 6/7 para móvil o fijo con código de área). Menores de edad: se registra el documento del menor y se muestra aviso de presentarse con su tutor. |
| RN-SOL-06 | El `codigo` es único global, no secuencial (no permite adivinar otras solicitudes) y se muestra con su centro: `CSC-7K3F9Q`. |
| RN-SOL-07 | Sin conexión, la creación se bloquea con el mensaje “No hay conexión. Su solicitud **no** fue enviada.” Nunca se muestra un comprobante sin haber persistido. |
| RN-SOL-15 | **Datos recordados en el dispositivo:** al confirmar, el ciudadano puede optar (casilla marcada por defecto) por recordar sus datos de identificación y contacto en `localStorage['sipac:pref:pacienteRecordado']`. Se guardan solo tras registrar la solicitud, precargan el paso “Datos del paciente” y el documento en “Consultar solicitud”. Nunca se guardan datos clínicos ni la declaración de conformidad (se acepta en cada solicitud). El aviso ofrece “Otro paciente” (vacía el formulario) y “Olvidar mis datos” (borra el almacenamiento). No se borran al restaurar los datos de demostración. |

### 6.2 Máquina de estados de la solicitud

```
            ┌──────────── aprobar (emite ficha) ─────────────┐
            │                                                ▼
 crear → PENDIENTE ── sin cupo ──► LISTA_ESPERA ── aprobar ──► APROBADA
            │  │                       │  │
            │  └── rechazar ──► RECHAZADA ◄── rechazar
            │                          │
            └── cancelar ──► CANCELADA ◄── cancelar
 (pendiente | lista_espera) y fecha pasada ──► VENCIDA   (automático)
```

| ID | Regla |
|---|---|
| RN-SOL-08 | Transiciones válidas solo las del diagrama; cualquier otra lanza `TRANSICION_INVALIDA`. Toda transición se agrega a `historial` con usuario, fecha y nota. |
| RN-SOL-09 | `pendiente`/`lista_espera` cuya `fechaSolicitada` ya pasó → `vencida` (evaluación perezosa al iniciar la app y al listar). |
| RN-SOL-10 | **Rechazar** y **cancelar** exigen motivo (catálogo + texto libre). Cancelar una solicitud `aprobada` cancela también su ficha (libera el cupo). |
| RN-SOL-11 | “Lista de espera” = solicitudes **sin cupo** para su fecha. Cuando se libera un cupo (cancelación/reprogramación) el sistema notifica a recepción que hay solicitudes en lista de espera para ese bloque; la aprobación sigue siendo manual. |
| RN-SOL-12 | El orden de atención de pendientes es por `creadoEn` ascendente (primero en llegar), salvo prioridad (RN-FIC-10). |
| RN-SOL-13 | **Cancelación por el ciudadano (D-14):** desde “Consultar solicitud” (código + documento) puede cancelar solicitudes `pendiente`/`lista_espera` en cualquier momento, y fichas `confirmada` hasta **2 h antes** de la hora estimada. Libera el cupo, se registra con `usuarioId = "publico"` y no genera bloqueo. |
| RN-SOL-14 | Al crear una solicitud se verifica que el paciente no esté bloqueado (RN-PAC-06); si lo está, se lanza `PACIENTE_BLOQUEADO`. |

### 6.3 Aprobación y emisión de ficha

| ID | Regla |
|---|---|
| RN-APR-01 | **Aprobar = emitir ficha**: en una sola transacción se cambia la solicitud a `aprobada`, se crea la ficha `confirmada` y se vinculan (`fichaId` ↔ `solicitudId`). No existe un estado intermedio “aprobada sin ficha”. |
| RN-APR-02 | Selección de médico: si hay `medicoPreferidoId` y tiene cupo → ese médico; si no lo tiene, recepción puede reasignar (queda registrado en historial) o pasar a lista de espera. Si es “cualquiera” o la especialidad es `automatica` → el médico con **más cupos libres** en la fecha; empate → el bloque que empieza antes. |
| RN-APR-03 | **Control de capacidad**: antes de escribir se recalcula ocupación del `horarioId + fecha`; si `ocupados ≥ cuposEfectivos` → `CUPO_AGOTADO`. Para canal web además `ocupadosWeb < cuposPublicos`. |
| RN-APR-04 | **Cupo único**: se asigna el menor `slot` libre del bloque; la combinación `(horarioId, fecha, slot)` no puede repetirse entre fichas que ocupan cupo. Se verifica al persistir (protección contra doble clic y dos pestañas). |
| RN-APR-05 | `numero` = siguiente correlativo de **centro + especialidad + fecha**; los números no se reutilizan aunque la ficha se cancele (evita confusión en sala). `codigoVisible = {codigoEspecialidad}-{numero con 2 dígitos}`. |
| RN-APR-06 | `horaEstimada = horaInicio + (slot − 1) × duracionConsultaMin`. Se comunica como **estimada**; el orden real es por llamado. |
| RN-APR-07 | Recepción puede **emitir fichas de ventanilla** (paciente presente sin solicitud previa). Usan cupos totales (no solo los públicos) y se crean con `canal = ventanilla`, `solicitudId = null`. Mismas reglas de capacidad, duplicado y slot. |
| RN-APR-08 | No se emiten fichas para fechas pasadas ni para bloques ya finalizados del día. |
| RN-APR-09 | Un paciente bloqueado no recibe fichas nuevas (aprobación ni ventanilla). La **reprogramación** sí se permite: respeta una ficha ya emitida (RN-PAC-09). |
| RN-APR-10 | Recepción opera sobre un centro concreto: con “Todos los centros” la entrega de fichas pide elegir uno; la gestión de solicitudes puede listar todos. |

### 6.4 Estado visible para el ciudadano (comprobante y consulta)

| Solicitud | Ficha | Se muestra |
|---|---|---|
| pendiente | — | **Pendiente** (aviso: “Aún no es una ficha confirmada”) |
| lista_espera | — | **En lista de espera** |
| aprobada | confirmada | **Confirmada** |
| aprobada | en_espera / llamada | **En espera** (“Llamando” si `llamada`) |
| aprobada | en_atencion | **En atención** |
| aprobada | atendida | **Atendida** |
| aprobada | ausente | **No se presentó** |
| aprobada | reprogramada | **Reprogramada** → muestra la nueva ficha |
| cancelada | * | **Cancelada** (con motivo) |
| rechazada | — | **Rechazada** (con motivo) |
| vencida | — | **Vencida** |

## 7. Fichas: entrega, sala de espera y llamado

### 7.1 Máquina de estados de la ficha

```
CONFIRMADA ── registrar llegada ──► EN_ESPERA ── llamar ──► LLAMADA ── iniciar ──► EN_ATENCION ── finalizar ──► ATENDIDA
    │                                  │  ▲                   │  │
    │                                  │  └─ repetir llamado ─┘  └── marcar ausente ──► AUSENTE
    ├── cancelar ──► CANCELADA         └── cancelar ──► CANCELADA
    ├── reprogramar ──► REPROGRAMADA (+ nueva ficha CONFIRMADA)
    └── cierre de jornada / fecha pasada ──► AUSENTE
```

| ID | Regla |
|---|---|
| RN-FIC-01 | Solo transiciones del diagrama; el resto lanza `TRANSICION_INVALIDA`. Cada transición registra su marca de tiempo (`llegadaEn`, `llamadaEn`, …). |
| RN-FIC-02 | **Entrega de ficha / registrar llegada**: recepción confirma la presencia del paciente (verifica documento; puede marcar `paciente.verificado`). Solo el día de la ficha. |
| RN-FIC-03 | **Llamar siguiente** (por consultorio/médico): toma la ficha `en_espera` de ese bloque con mayor prioridad y menor `numero`. Solo puede haber una ficha `llamada` o `en_atencion` por consultorio a la vez. |
| RN-FIC-04 | **Repetir llamado** agrega una entrada en `llamadas`; a partir del 3.er llamado sin respuesta la UI sugiere “Marcar ausente”. |
| RN-FIC-05 | **Ausente** ocupa el cupo (ya pasó) y cuenta para ausentismo. Se puede revertir a `en_espera` el mismo día si el paciente llega tarde (queda en historial). |
| RN-FIC-06 | **Cierre de jornada** (acción manual de recepción, o automático perezoso al pasar la fecha): `confirmada`/`en_espera`/`llamada` → `ausente`; `en_atencion` → `atendida` con nota “cierre automático”. |
| RN-FIC-07 | **Cancelar** exige motivo y libera el cupo. No se cancelan fichas `atendida` ni `ausente`. |
| RN-FIC-08 | **Reprogramar**: valida cupo en el destino; marca la original `reprogramada` (libera cupo) y crea una nueva ficha `confirmada` con `fichaOrigenId`; la solicitud apunta a la nueva ficha. Todo en una transacción. Máximo 2 reprogramaciones por cadena. | Al abrir el diálogo se propone la primera fecha con cupo.
| RN-FIC-09 | El **médico** solo puede ver y cambiar estado de sus propias fichas (iniciar, finalizar, marcar ausente) en los centros donde está vinculado. |
| RN-FIC-10 | **Prioridad** `preferente` (adultos mayores, gestantes, personas con discapacidad — atención preferente según normativa boliviana) la marca recepción; solo altera el orden del llamado, no los cupos. *(Decisión D-11.)* |

### 7.2 Pantalla de llamado

| ID | Regla |
|---|---|
| RN-PAN-01 | Muestra centro, fecha, la ficha llamada actual por consultorio (`codigoVisible` + consultorio + estado “Llamando/En atención”), los últimos 5 llamados y los próximos en espera. |
| RN-PAN-02 | **Nunca muestra nombres completos ni documentos**; solo `codigoVisible`. |
| RN-PAN-03 | Es de solo lectura; los controles (llamar, repetir, ausente, atendido) están en `/admin/entrega`. Un nuevo llamado o repetición dispara señal sonora y animación (Web Speech API opcional, sin servicios externos). |
| RN-PAN-04 | **Acceso:** `/pantalla/:codigoCentro` acepta el código corto (`CSC`) o el institucional (`BEN-TRI-0001`), sin sesión. Un centro inexistente o inactivo muestra “Centro no encontrado”. |
| RN-PAN-05 | **Llamado destacado:** se destaca la ficha `llamada` más reciente (última llamada o repetición). Al pasar a `en_atencion` deja de destacarse y queda en “Últimos llamados” con su estado. Cada consultorio muestra su ficha llamada/en atención y los 3 próximos en el orden de la sala (RN-FIC-03). |
| RN-PAN-06 | **Aviso:** timbre (Web Audio) y voz opcional (“Ficha M G 5. Diríjase a Consultorio 2.”) solo con un llamado nuevo de los últimos 12 s; al abrir o recargar la pantalla no suena. La preferencia de sonido/voz queda en el dispositivo. |
| RN-PAN-07 | **Actualización:** inmediata ante cambios en otra pestaña/ventana del mismo navegador (`data:changed`), con refresco de respaldo cada 30 s y al recuperar la conexión. Sin conexión muestra los últimos datos con un aviso. |

## 8. Pacientes

| ID | Regla |
|---|---|
| RN-PAC-01 | Datos mínimos: documento, nombres, apellidos, fecha de nacimiento, teléfono; sexo opcional. Sin datos clínicos. |
| RN-PAC-02 | Unicidad por documento (DATA_MODEL 4.9). Recepción puede corregir datos y marcar verificado; queda en auditoría. |
| RN-PAC-03 | Un usuario de centro solo ve pacientes que tienen al menos una solicitud o ficha en su centro, y su historial **filtrado a su centro**. El admin central ve todo. |
| RN-PAC-04 | La consulta pública exige **código + número de documento coincidentes**; si no coinciden, mensaje genérico “No se encontró una solicitud con esos datos” (no revela cuál falló). Nombre mostrado enmascarado (“María P***”). Máximo 5 intentos fallidos por minuto (simulado en cliente). |
| RN-PAC-05 | **Bloqueo por inasistencia (D-22):** cuando una ficha pasa a `ausente` (manualmente o por cierre de jornada), el paciente queda **bloqueado** (`paciente.bloqueo.activo = true`) con referencia a la ficha y al centro donde ocurrió. |
| RN-PAC-06 | Un paciente bloqueado **no puede crear solicitudes web en ningún centro**. El portal muestra: “Su documento tiene una inasistencia registrada. Acérquese al centro de salud para habilitarlo.” (sin revelar detalles). Tampoco se le pueden emitir fichas de ventanilla mientras siga bloqueado: recepción ve el motivo y debe habilitarlo primero. |
| RN-PAC-07 | **Habilitación manual:** solo `admin_central`, o `admin_centro`/`recepcionista` **del centro donde ocurrió la inasistencia**, pueden levantar el bloqueo, con nota obligatoria. Queda en `historialBloqueos` (quién, cuándo, nota). |
| RN-PAC-08 | Si la ficha `ausente` se revierte a `en_espera` el mismo día (llegó tarde, RN-FIC-05), el bloqueo generado por esa ficha se levanta automáticamente y se registra en el historial. |
| RN-PAC-09 | El bloqueo no afecta fichas ya emitidas del paciente (se respetan); solo impide nuevas. Cancelar una ficha con anticipación (RN-SOL-13) **no** genera bloqueo. |
| RN-PAC-10 | Toda edición de un paciente (datos, verificación, aplicación de datos del portal) queda en `paciente.auditoria` con usuario, fecha y cada campo con su valor anterior y nuevo. No se guarda ningún dato clínico. |
| RN-PAC-11 | **Datos por verificar:** cuando el portal detecta diferencias (RN-SOL-04) guarda lo ingresado en `solicitud.datosIngresados` sin tocar el registro. Recepción compara con el documento y elige “Actualizar con lo ingresado” (queda en auditoría) o “Mantener el registro”; en ambos casos la marca se limpia y se anota en el historial de la solicitud. |
| RN-PAC-12 | El médico ve en Pacientes solo a quienes tienen fichas con él en el centro de trabajo, sin solicitudes ni edición. |

## 9. Usuarios, roles y permisos

| ID | Regla |
|---|---|
| RN-USR-01 | Los permisos se verifican por **permiso**, no por rol, en rutas, menú y servicios. El menú solo muestra lo permitido. |
| RN-USR-02 | Usuarios no centrales tienen exactamente un centro; el médico opera en los centros de sus vínculos activos y puede alternar entre ellos. |
| RN-USR-03 | Solo `admin_central` gestiona usuarios y centros. Un `admin_centro` puede ver usuarios de su centro (lectura). |
| RN-USR-04 | Sesión simulada con expiración de 8 h; cambio de contraseña simulado (valida longitud ≥ 8 y confirma, actualiza el JSON local). |
| RN-USR-05 | Al iniciar sesión se valida que el usuario esté activo y tenga al menos un centro (salvo admin central). Si durante la sesión el usuario se desactiva, la sesión se cierra; si cambian sus vínculos (médico), sus centros permitidos se actualizan. El inicio de sesión requiere conexión. |
| RN-USR-06 | Tras un cierre de sesión voluntario no se conserva la ruta anterior; tras una expiración sí (vuelve a la página en la que estaba). Solo se aceptan destinos internos `/admin/*`. |

### Matriz de permisos

| Permiso | Admin central | Admin centro | Recepcionista | Resp. médico | Médico |
|---|:-:|:-:|:-:|:-:|:-:|
| `dashboard.ver` | ✔ (global) | ✔ | ✔ | ✔ | ✔ (propio) |
| `solicitudes.gestionar` | ✔ | ✔ | ✔ | — | — |
| `fichas.emitir` / `fichas.entregar` | ✔ | ✔ | ✔ | — | — |
| `llamado.controlar` | ✔ | ✔ | ✔ | — | ✔ (su consultorio) |
| `fichas.estadoPropio` | — | — | — | — | ✔ |
| `agenda.ver` | ✔ | ✔ | ✔ | ✔ | ✔ (propia) |
| `agenda.gestionar` (excepciones) | ✔ | ✔ | — | ✔ | — |
| `horarios.gestionar` | ✔ | ✔ | — | ✔ | — |
| `medicos.gestionar` | ✔ | ✔ | — | ✔ | — |
| `especialidades.gestionar` (del centro) | ✔ | ✔ | — | ✔ | — |
| `especialidades.catalogo` (global) | ✔ | — | — | — | — |
| `pacientes.ver` | ✔ | ✔ | ✔ | ✔ | ✔ (sus pacientes) |
| `pacientes.editar` | ✔ | ✔ | ✔ | — | — |
| `pacientes.habilitar` (levantar bloqueo) | ✔ | ✔ (su centro) | ✔ (su centro) | — | — |
| `reportes.ver` | ✔ (global) | ✔ | — | ✔ | — |
| `centros.gestionar` | ✔ | — | — | — | — |
| `usuarios.gestionar` | ✔ | — | — | — | — |
| `usuarios.ver` (lectura, su centro) | ✔ | ✔ | — | — | — |
| `centro.cambiar` | ✔ | — | — | — | ✔ (entre sus centros) |
| `demo.restaurar` | ✔ | ✔ | — | — | — |

## 10. Indicadores (definiciones únicas para dashboard y reportes)

Todos se calculan con `services/rules/kpis.js` a partir de los registros, para el centro activo (o todos) y el rango de fechas.

| Indicador | Fórmula |
|---|---|
| Fichas emitidas hoy | Fichas **para atención hoy** (`fecha = hoy`) con estado ≠ `cancelada`/`reprogramada` *(alternativa: fichas con `emitidaEn` hoy, para cualquier fecha — decisión D-12)* |
| Fichas disponibles | Σ cupos libres de los bloques efectivos de hoy |
| Solicitudes pendientes | Solicitudes `pendiente` con `fechaSolicitada ≥ hoy` |
| Pacientes en espera | Fichas de hoy en `en_espera` o `llamada` (sala de espera) |
| Pacientes atendidos | Fichas de hoy en `atendida` |
| % Ocupación | cupos ocupados / cupos efectivos de hoy × 100 |
| Ausentismo | `ausente` / (`atendida` + `ausente`) × 100 |
| Tiempo de espera | promedio de `inicioAtencionEn − llegadaEn` (fichas atendidas con ambas marcas) |
| Demanda por especialidad | solicitudes creadas + fichas de ventanilla, agrupadas por especialidad |
| Solicitudes de los últimos 7 días | solicitudes por `creadoEn` (día), últimos 7 días incluyendo hoy |
| Emitidas vs. atendidas | por día de `fecha`: fichas emitidas (no canceladas) vs. `atendida` |
| Distribución por horario | fichas por franja horaria de `horaEstimada` (bloques de 1 h) *(decisión D-12)* |

**Ventanas y alcance usados en el dashboard (Épica 7):** ausentismo y tiempo de espera se calculan sobre los últimos 7 días incluyendo hoy; “% Ocupación” y “Fichas disponibles” usan los bloques efectivos de hoy (sin bloqueados). Con “Todos los centros” se suman todos los centros (los inactivos aportan solo historial). La vista del médico filtra por sus propias fichas en el centro activo.

**Umbrales de insights:** ausentismo > 15 % con al menos 10 fichas cerradas en la semana; cupos escasos < 20 % libres por especialidad (hoy y mañana); mayor demanda si la especialidad suma ≥ 3 pedidos; día pico si suma ≥ 5 solicitudes.

**Insights** (`services/rules/insights.js`): reglas sobre los KPIs, p. ej. especialidad con mayor demanda (7 días), especialidad con < 20 % de cupos libres hoy/mañana, día de la semana con más solicitudes (últimas 4 semanas), existencia de pendientes para hoy/mañana, ausentismo > 15 %, lista de espera con cupos recién liberados. Se muestran solo los que aplican, ordenados por severidad.

### 10.1 Reportes (Épica 12)

| ID | Regla |
|---|---|
| RN-REP-01 | **Alcance:** el admin central elige “Todos los centros” o cualquier centro (incluidos inactivos, que aportan historial). Admin de centro y responsable médico quedan en su centro; el servicio rechaza otro centro (`ACCESO_DENEGADO`) o “Todos” (`PERMISO_DENEGADO`). Recepción y médicos no acceden. |
| RN-REP-02 | **Período:** por defecto los últimos 30 días incluyendo hoy; máximo 366 días; “Hasta” ≥ “Desde”. Hasta 62 días la serie es diaria; más largo, mensual. |
| RN-REP-03 | **Definiciones:** las mismas de §10 (`services/rules/reports.js` reutiliza las fórmulas): fichas por fecha de atención, emitidas = estado ≠ cancelada/reprogramada, ausentismo = ausentes / (atendidas + ausentes), espera = llegada → inicio de atención. Solicitudes por fecha de registro con su estado actual; con filtro de médico cuentan las de su ficha o con él como preferido. Demanda = solicitudes + fichas de ventanilla. Para el mismo día y centro los totales coinciden con el dashboard. |
| RN-REP-04 | **CSV:** UTF-8 con BOM, separador `;`, CRLF, coma decimal, fechas DD/MM/YYYY; encabezado con institución, filtros y fecha de generación; secciones Resumen, Por centro, Por día/mes, Por especialidad y Por médico. Los textos que empiezan con `= + - @` se escapan (inyección CSV). Sin datos de pacientes. |
| RN-REP-05 | **Impresión:** oculta navegación y filtros, agrega encabezado institucional con filtros aplicados, fuerza tema claro y ancho fijo de gráficos (A4 y Carta, márgenes 12 mm). |

## 11. Conectividad y datos de demostración

| ID | Regla |
|---|---|
| RN-OFF-01 | Sin conexión se permiten lecturas y navegación; las escrituras se bloquean con `SIN_CONEXION` y un mensaje explícito. No hay cola de envío diferido. |
| RN-OFF-02 | Al recuperar la conexión se informa “Conexión restablecida” y se invita a reintentar la operación (no se reintenta automáticamente). |
| RN-DEM-01 | Si no existen datos (o cambia `schemaVersion`), se siembran desde los JSON + generador. |
| RN-DEM-02 | “Restaurar datos de demostración” borra todas las claves `sigef:v1:*`, vuelve a sembrar y cierra la sesión; requiere confirmación. Conserva preferencias (modo oscuro, centro público). |
| RN-DEM-03 | Un banner/etiqueta discreto “Prototipo de demostración — datos ficticios” es visible en portal y panel. |
