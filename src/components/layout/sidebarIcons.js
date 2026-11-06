/** Iconos del sidebar importados uno a uno (evita incluir todo @mui/icons-material). */
import Dashboard from '@mui/icons-material/Dashboard';
import Assignment from '@mui/icons-material/Assignment';
import ConfirmationNumber from '@mui/icons-material/ConfirmationNumber';
import CalendarMonth from '@mui/icons-material/CalendarMonth';
import MedicalServices from '@mui/icons-material/MedicalServices';
import Category from '@mui/icons-material/Category';
import Schedule from '@mui/icons-material/Schedule';
import People from '@mui/icons-material/People';
import LocalHospital from '@mui/icons-material/LocalHospital';
import ManageAccounts from '@mui/icons-material/ManageAccounts';
import Assessment from '@mui/icons-material/Assessment';
import Settings from '@mui/icons-material/Settings';
import Circle from '@mui/icons-material/Circle';

const ICONS = {
  Dashboard,
  Assignment,
  ConfirmationNumber,
  CalendarMonth,
  MedicalServices,
  Category,
  Schedule,
  People,
  LocalHospital,
  ManageAccounts,
  Assessment,
  Settings,
};

export const sidebarIcon = (name) => ICONS[name] || Circle;
