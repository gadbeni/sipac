/** Icono de especialidad (campo `icono` del catálogo), importados uno a uno. */
import { createElement } from 'react';
import MedicalServices from '@mui/icons-material/MedicalServices';
import ChildCare from '@mui/icons-material/ChildCare';
import Female from '@mui/icons-material/Female';
import SentimentVerySatisfied from '@mui/icons-material/SentimentVerySatisfied';
import Vaccines from '@mui/icons-material/Vaccines';
import RestaurantMenu from '@mui/icons-material/RestaurantMenu';
import Psychology from '@mui/icons-material/Psychology';
import PregnantWoman from '@mui/icons-material/PregnantWoman';
import LocalHospital from '@mui/icons-material/LocalHospital';

const ICONS = {
  MedicalServices,
  ChildCare,
  Female,
  SentimentVerySatisfied,
  Vaccines,
  RestaurantMenu,
  Psychology,
  PregnantWoman,
};

export default function SpecialtyIcon({ name, ...props }) {
  return createElement(ICONS[name] || LocalHospital, props);
}
