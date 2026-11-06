import { lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PUBLIC_ROUTES, DISPLAY_ROUTES, ADMIN_ROUTES } from './routes.config';
import PublicLayout from '@/layouts/PublicLayout';
import AdminLayout from '@/layouts/AdminLayout';
import DisplayLayout from '@/layouts/DisplayLayout';
import ScrollToTop from '@/components/layout/ScrollToTop';
import PlaceholderPage from '@/pages/PlaceholderPage';
import NotFoundPage from '@/pages/NotFoundPage';
import { RequireAuth, RequirePermission } from './ProtectedRoute';

// Carga diferida: cada módulo se descarga al visitarlo (reduce el paquete inicial).
const DataStatusPage = lazy(() => import('@/pages/DataStatusPage'));
const SettingsPage = lazy(() => import('@/pages/admin/configuracion/SettingsPage'));
const CentersPage = lazy(() => import('@/pages/public/centros/CentersPage'));
const CenterDetailPage = lazy(() => import('@/pages/public/centros/CenterDetailPage'));
const AdminCentersPage = lazy(() => import('@/pages/admin/centros/AdminCentersPage'));
const HomePage = lazy(() => import('@/pages/public/HomePage'));
const SpecialtiesPage = lazy(() => import('@/pages/public/SpecialtiesPage'));
const DoctorsOnDutyPage = lazy(() => import('@/pages/public/DoctorsOnDutyPage'));
const SchedulesPage = lazy(() => import('@/pages/public/SchedulesPage'));
const RequestWizardPage = lazy(() => import('@/pages/public/solicitud/RequestWizardPage'));
const ConsultPage = lazy(() => import('@/pages/public/ConsultPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ProfilePage = lazy(() => import('@/pages/admin/perfil/ProfilePage'));
const UsersPage = lazy(() => import('@/pages/admin/usuarios/UsersPage'));
const DashboardPage = lazy(() => import('@/pages/admin/dashboard/DashboardPage'));
const RequestsPage = lazy(() => import('@/pages/admin/solicitudes/RequestsPage'));
const DeliveryPage = lazy(() => import('@/pages/admin/entrega/DeliveryPage'));
const DoctorsPage = lazy(() => import('@/pages/admin/medicos/DoctorsPage'));
const DoctorDetailPage = lazy(() => import('@/pages/admin/medicos/DoctorDetailPage'));
const SpecialtiesAdminPage = lazy(() => import('@/pages/admin/especialidades/SpecialtiesAdminPage'));
const SchedulesAdminPage = lazy(() => import('@/pages/admin/horarios/SchedulesAdminPage'));
const AgendaPage = lazy(() => import('@/pages/admin/agenda/AgendaPage'));
const PatientsPage = lazy(() => import('@/pages/admin/pacientes/PatientsPage'));
const PatientDetailPage = lazy(() => import('@/pages/admin/pacientes/PatientDetailPage'));
const ReportsPage = lazy(() => import('@/pages/admin/reportes/ReportsPage'));
const CallDisplayPage = lazy(() => import('@/pages/display/CallDisplayPage'));

/** Páginas ya implementadas; el resto usa PlaceholderPage hasta su épica. */
const PAGES = {
  '/admin/configuracion': SettingsPage,
  '/centros': CentersPage,
  '/centros/:codigo': CenterDetailPage,
  '/admin/centros': AdminCentersPage,
  '/': HomePage,
  '/especialidades': SpecialtiesPage,
  '/medicos-de-turno': DoctorsOnDutyPage,
  '/horarios': SchedulesPage,
  '/solicitar-ficha': RequestWizardPage,
  '/consultar': ConsultPage,
  '/login': LoginPage,
  '/admin/perfil': ProfilePage,
  '/admin/usuarios': UsersPage,
  '/admin': DashboardPage,
  '/admin/solicitudes': RequestsPage,
  '/admin/entrega': DeliveryPage,
  '/admin/medicos': DoctorsPage,
  '/admin/medicos/:id': DoctorDetailPage,
  '/admin/especialidades': SpecialtiesAdminPage,
  '/admin/horarios': SchedulesAdminPage,
  '/admin/agenda': AgendaPage,
  '/admin/pacientes': PatientsPage,
  '/admin/pacientes/:id': PatientDetailPage,
  '/pantalla/:codigoCentro': CallDisplayPage,
  '/admin/reportes': ReportsPage,
};

const SHOW_DEV_PAGES = import.meta.env.DEV || import.meta.env.VITE_DEV_PAGES === 'true';
// Condicional para que el catálogo no se incluya en el build de producción.
const ComponentsShowcasePage = SHOW_DEV_PAGES
  ? lazy(() => import('@/pages/dev/ComponentsShowcasePage'))
  : null;

const element = (route, area) => {
  const Page = PAGES[route.path];
  return Page ? <Page /> : <PlaceholderPage route={route} area={area} />;
};

export default function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          {PUBLIC_ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={element(r, 'public')} />
          ))}
          <Route path="/dev/datos" element={<DataStatusPage />} />
          {SHOW_DEV_PAGES && <Route path="/dev/componentes" element={<ComponentsShowcasePage />} />}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route element={<DisplayLayout />}>
          {DISPLAY_ROUTES.map((r) => (
            <Route key={r.path} path={r.path} element={element(r, 'display')} />
          ))}
        </Route>
        {/* Panel: exige sesión y, por ruta, el permiso de routes.config.js (403 si falta). */}
        <Route
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          {ADMIN_ROUTES.map((r) => (
            <Route
              key={r.path}
              path={r.path}
              element={<RequirePermission permission={r.permission}>{element(r, 'admin')}</RequirePermission>}
            />
          ))}
          <Route path="/admin/*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
