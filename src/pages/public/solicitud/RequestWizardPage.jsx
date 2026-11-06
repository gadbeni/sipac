/**
 * /solicitar-ficha — asistente de 7 pasos (Épica 5, flujo F1).
 * El estado se conserva al retroceder; centro/especialidad/fecha/profesional se guardan en
 * sessionStorage (sin datos personales) para sobrevivir a una recarga.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  useMediaQuery,
} from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Send from '@mui/icons-material/Send';
import Print from '@mui/icons-material/Print';
import Search from '@mui/icons-material/Search';
import Add from '@mui/icons-material/Add';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import RequestReceipt from '@/components/requests/RequestReceipt';
import { StepCenter, StepConfirm, StepDate, StepDoctor, StepPatient, StepSpecialty } from './WizardSteps';
import { useAsync } from '@/hooks/useAsync';
import { useCenter } from '@/context/CenterContext';
import { useConnectivity } from '@/context/ConnectivityContext';
import { useNotify } from '@/context/NotifyContext';
import { specialtyService } from '@/services/specialtyService';
import { requestService } from '@/services/requestService';
import { patientSchema } from '@/services/schemas/requestSchema';
import { isAppError, ERROR_MESSAGES } from '@/services/errors';
import { centerConfig } from '@/services/rules/availability';
import { TIPOS_DOCUMENTO } from '@/config/constants';
import { formatDate, formatDateLong } from '@/utils/dates';
import {
  forgetRememberedPatient,
  readRememberedPatient,
  saveRememberedPatient,
} from '@/utils/rememberedPatient';

const STEPS = [
  'Centro',
  'Especialidad',
  'Fecha',
  'Profesional',
  'Datos del paciente',
  'Confirmar',
  'Comprobante',
];
const S = { centro: 0, especialidad: 1, fecha: 2, medico: 3, datos: 4, confirmar: 5, comprobante: 6 };
const DRAFT_KEY = 'sipac:asistente';
const EMPTY_PATIENT = {
  tipoDocumento: 'CI',
  numeroDocumento: '',
  complemento: '',
  nombres: '',
  apellidos: '',
  fechaNacimiento: '',
  sexo: '',
  telefono: '',
  acepta: false,
};
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

const readDraft = () => {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
  } catch {
    return null;
  }
};
const writeDraft = (d) => {
  try {
    if (d) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* sin sessionStorage */
  }
};

export default function RequestWizardPage() {
  const { center, centerId } = useCenter();
  const { online } = useConnectivity();
  const notify = useNotify();
  const [params] = useSearchParams();
  const vertical = useMediaQuery((t) => t.breakpoints.down('md'));
  const topRef = useRef(null);

  const draft = useMemo(() => {
    const d = readDraft();
    return d && d.centroId === centerId ? d : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [step, setStep] = useState(() =>
    draft ? Math.min(draft.step, S.medico) : centerId ? S.especialidad : S.centro,
  );
  const [sel, setSel] = useState(() => ({
    especialidadId: draft?.especialidadId || null,
    fecha: draft?.fecha || null,
    medicoId: draft?.medicoId || '',
  }));
  const [notices, setNotices] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [datesKey, setDatesKey] = useState(0);
  // Datos recordados en este dispositivo (opcional, solo identificación y contacto).
  const [remembered, setRemembered] = useState(readRememberedPatient);
  const [remember, setRemember] = useState(true);
  const form = useForm({
    resolver: zodResolver(patientSchema, undefined, { raw: true }),
    defaultValues: { ...EMPTY_PATIENT, ...remembered },
    mode: 'onTouched',
  });

  // Cambiar de centro reinicia la selección.
  const prevCenter = useRef(centerId);
  useEffect(() => {
    if (prevCenter.current !== centerId) {
      prevCenter.current = centerId;
      setSel({ especialidadId: null, fecha: null, medicoId: '' });
      setStep(S.centro);
    }
  }, [centerId]);

  useEffect(() => {
    if (receipt) writeDraft(null);
    else if (centerId) writeDraft({ centroId: centerId, step, ...sel });
  }, [centerId, step, sel, receipt]);

  useEffect(() => {
    topRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [step]);

  const specialties = useAsync(() => specialtyService.getCenterSpecialties(centerId), [centerId], {
    watch: ['centros', 'centroEspecialidades', 'horarios'],
  });
  const esp = specialties.data?.find((e) => e.id === sel.especialidadId) || null;

  // Preselección desde /especialidades (?especialidad=MG).
  const preselected = useRef(false);
  useEffect(() => {
    const code = params.get('especialidad');
    if (preselected.current || !code || !specialties.data || draft?.especialidadId) return;
    preselected.current = true;
    const e = specialties.data.find((x) => x.codigo === code.toUpperCase());
    if (e && e.aceptaSolicitudesPublicas && e.proxima) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSel({ especialidadId: e.id, fecha: null, medicoId: '' });
      setStep(S.fecha);
    }
  }, [params, specialties.data, draft]);

  const dates = useAsync(
    () =>
      centerId && sel.especialidadId ? requestService.getEnabledDates(centerId, sel.especialidadId) : [],
    [centerId, sel.especialidadId, datesKey],
  );
  const automatic = esp?.asignacionMedico === 'automatica';
  const doctors = useAsync(
    () =>
      centerId && sel.especialidadId && sel.fecha && !automatic
        ? requestService.getDoctorOptions(centerId, sel.especialidadId, sel.fecha)
        : [],
    [centerId, sel.especialidadId, sel.fecha, automatic, datesKey],
  );

  // Si la fecha guardada dejó de estar habilitada, se descarta.
  useEffect(() => {
    if (sel.fecha && dates.data && !dates.loading && !dates.data.some((d) => d.fecha === sel.fecha)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSel((s) => ({ ...s, fecha: null, medicoId: '' }));
    }
  }, [dates.data, dates.loading, sel.fecha]);

  const canNext = {
    [S.centro]: Boolean(center),
    [S.especialidad]: Boolean(esp),
    [S.fecha]: Boolean(sel.fecha),
    [S.medico]: true,
  };

  const go = (n) => {
    setSubmitError(null);
    setStep(n);
  };

  const next = async () => {
    if (step === S.datos) {
      const ok = await form.trigger();
      if (!ok) return;
    }
    go(step + 1);
  };

  const confirm = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const view = await requestService.createRequest({
        centroId: centerId,
        especialidadId: sel.especialidadId,
        fecha: sel.fecha,
        medicoPreferidoId: automatic ? null : sel.medicoId || null,
        paciente: form.getValues(),
      });
      if (remember) {
        saveRememberedPatient(form.getValues());
        setRemembered(readRememberedPatient());
      } else {
        forgetRememberedPatient();
        setRemembered(null);
      }
      setReceipt(view);
      setStep(S.comprobante);
      notify.success('Solicitud registrada.');
    } catch (e) {
      const code = isAppError(e) ? e.code : null;
      if (code === 'FECHA_NO_DISPONIBLE' || code === 'DEMANDA_ALTA' || code === 'CUPO_AGOTADO') {
        setDatesKey((k) => k + 1);
        setNotices({
          fecha: `${ERROR_MESSAGES[code] || e.message} La disponibilidad cambió mientras completaba la solicitud: elija otra fecha.`,
        });
        setSel((s) => ({ ...s, fecha: null, medicoId: '' }));
        go(S.fecha);
      } else if (code === 'MEDICO_NO_DISPONIBLE') {
        setDatesKey((k) => k + 1);
        setNotices({ medico: e.message });
        setSel((s) => ({ ...s, medicoId: '' }));
        go(S.medico);
      } else if (code === 'VALIDACION' && e.details?.fields) {
        for (const [name, message] of Object.entries(e.details.fields))
          form.setError(name, { type: 'server', message });
        setNotices({ datos: 'Revise los datos marcados.' });
        go(S.datos);
      } else if (code === 'SIN_CONEXION') {
        setSubmitError({
          message: 'No hay conexión. Su solicitud no fue enviada. Vuelva a intentarlo cuando tenga internet.',
        });
      } else if (code === 'SOLICITUD_DUPLICADA') {
        setSubmitError({
          message: `${e.message} Puede consultar su solicitud existente con su código.`,
          step: S.fecha,
          stepLabel: 'Cambiar fecha',
        });
      } else if (code === 'CENTRO_INACTIVO') {
        setSubmitError({ message: e.message, step: S.centro, stepLabel: 'Elegir otro centro' });
      } else {
        setSubmitError({
          message: isAppError(e) ? e.message : 'No se pudo registrar la solicitud. Intente nuevamente.',
        });
        if (!isAppError(e)) console.error(e);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    form.reset({ ...EMPTY_PATIENT, ...remembered });
    setReceipt(null);
    setSel({ especialidadId: null, fecha: null, medicoId: '' });
    setNotices({});
    go(center ? S.especialidad : S.centro);
  };

  const p = form.getValues();
  const medicoNombre = automatic
    ? 'Asignado por el establecimiento'
    : doctors.data?.find((d) => d.id === sel.medicoId)?.nombre || 'Cualquier profesional disponible';
  const ventana =
    step === S.confirmar && sel.fecha
      ? requestService.getWindow(centerId, sel.especialidadId, sel.fecha, sel.medicoId || null)
      : null;
  const summary = [
    ['Centro de salud', center?.nombre],
    ['Especialidad', esp?.nombre],
    ['Fecha', sel.fecha ? cap(formatDateLong(sel.fecha)) : ''],
    ['Profesional', medicoNombre],
    [
      'Horario de atención',
      ventana
        ? `Entre ${ventana.horaInicio} y ${ventana.horaFin} (la hora estimada se informa al asignar la ficha)`
        : '—',
    ],
    ['Paciente', `${p.nombres} ${p.apellidos}`],
    [
      'Documento',
      `${TIPOS_DOCUMENTO[p.tipoDocumento] || ''} ${p.numeroDocumento}${p.complemento ? `-${p.complemento}` : ''}`,
    ],
    ['Fecha de nacimiento', p.fechaNacimiento ? formatDate(p.fechaNacimiento) : ''],
    ['Teléfono', p.telefono ? `+591 ${p.telefono}` : ''],
  ];

  const body = (i) => {
    switch (i) {
      case S.centro:
        return <StepCenter />;
      case S.especialidad:
        return (
          <StepSpecialty
            specialties={specialties.data}
            loading={specialties.loading}
            value={sel.especialidadId}
            onChange={(e) =>
              setSel((s) =>
                s.especialidadId === e.id ? s : { especialidadId: e.id, fecha: null, medicoId: '' },
              )
            }
          />
        );
      case S.fecha:
        return (
          <StepDate
            dates={dates.data}
            loading={dates.loading}
            value={sel.fecha}
            maxDays={centerConfig(center).diasAnticipacionMax}
            notice={notices.fecha}
            onChange={(f) => {
              setNotices({});
              setSel((s) => (s.fecha === f ? s : { ...s, fecha: f, medicoId: '' }));
            }}
          />
        );
      case S.medico:
        return (
          <StepDoctor
            automatic={automatic}
            doctors={doctors.data}
            loading={doctors.loading}
            value={sel.medicoId}
            notice={notices.medico}
            onChange={(m) => setSel((s) => ({ ...s, medicoId: m }))}
          />
        );
      case S.datos:
        return (
          <StepPatient
            control={form.control}
            notice={notices.datos}
            remembered={remembered}
            remember={remember}
            onRememberChange={setRemember}
            onOtherPatient={() => form.reset(EMPTY_PATIENT)}
            onForget={() => {
              forgetRememberedPatient();
              setRemembered(null);
              setRemember(false);
              form.reset(EMPTY_PATIENT);
              notify.info('Se borraron los datos guardados en este dispositivo.');
            }}
          />
        );
      case S.confirmar:
        return <StepConfirm summary={summary} error={submitError} onRetryStep={go} />;
      case S.comprobante:
        return receipt ? <RequestReceipt view={receipt} printable /> : null;
      default:
        return null;
    }
  };

  const nav = (i) => {
    if (i === S.comprobante) {
      return (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }} className="sipac-no-print">
          <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>
            Imprimir comprobante
          </Button>
          <Button
            variant="outlined"
            startIcon={<Search />}
            component={RouterLink}
            to={`/consultar?codigo=${receipt?.codigo || ''}`}
          >
            Consultar estado
          </Button>
          <Button startIcon={<Add />} onClick={restart}>
            Nueva solicitud
          </Button>
        </Stack>
      );
    }
    return (
      <Stack direction="row" spacing={1} sx={{ mt: 3, justifyContent: 'space-between' }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => go(i - 1)}
          disabled={i === 0 || submitting}
          color="inherit"
        >
          Atrás
        </Button>
        {i === S.confirmar ? (
          <Button
            variant="contained"
            size="large"
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Send />}
            onClick={confirm}
            disabled={submitting}
          >
            {submitting ? 'Enviando…' : 'Confirmar solicitud'}
          </Button>
        ) : (
          <Button
            variant="contained"
            endIcon={<ArrowForward />}
            onClick={next}
            disabled={canNext[i] === false}
          >
            Continuar
          </Button>
        )}
      </Stack>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Box ref={topRef} sx={{ scrollMarginTop: 120 }} />
      <Box className="sipac-no-print">
        <PageHeader
          title="Solicitar ficha"
          subtitle="Complete los pasos. Al final recibirá un código para consultar el estado de su solicitud."
          description="Solicite una ficha médica por internet en su centro de salud."
        />
      </Box>
      {!online && step === S.confirmar && (
        <Alert severity="warning" sx={{ mb: 2 }} className="sipac-no-print">
          Está sin conexión: podrá revisar los datos, pero la solicitud no se enviará hasta que vuelva la
          conexión.
        </Alert>
      )}
      {vertical ? (
        <Stepper
          activeStep={step}
          orientation="vertical"
          className={step === S.comprobante ? undefined : 'sipac-no-print'}
        >
          {STEPS.map((label, i) => (
            <Step key={label} completed={i < step || (i === S.comprobante && Boolean(receipt))}>
              <StepLabel className="sipac-no-print">{label}</StepLabel>
              <StepContent>
                {body(i)}
                {nav(i)}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      ) : (
        <>
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }} className="sipac-no-print">
            {STEPS.map((label, i) => (
              <Step key={label} completed={i < step || (i === S.comprobante && Boolean(receipt))}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Box component="section" aria-label={STEPS[step]}>
            {body(step)}
            {nav(step)}
          </Box>
        </>
      )}
    </Container>
  );
}
