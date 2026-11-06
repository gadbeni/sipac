import { useCenter } from '@/context/CenterContext';
import SelectedCenterBanner from './SelectedCenterBanner';

/** Muestra el contenido solo si hay un centro elegido; si no, la invitación a elegir uno. */
export default function RequireCenter({ children }) {
  const { center } = useCenter();
  return center ? children : <SelectedCenterBanner />;
}
