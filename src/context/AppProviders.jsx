import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { esES as pickersEs } from '@mui/x-date-pickers/locales';
import 'dayjs/locale/es';
import { ColorModeProvider } from './ColorModeContext';
import { NotifyProvider } from './NotifyContext';
import { ConfirmProvider } from './ConfirmContext';
import { ConnectivityProvider } from './ConnectivityContext';
import { CenterProvider } from './CenterContext';
import { AuthProvider } from './AuthContext';

const pickerText = pickersEs.components.MuiLocalizationProvider.defaultProps.localeText;

/** Proveedores globales en el orden en que dependen entre sí. */
export default function AppProviders({ children }) {
  return (
    <ColorModeProvider>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es" localeText={pickerText}>
        <ConnectivityProvider>
          <NotifyProvider>
            <ConfirmProvider>
              <AuthProvider>
                <CenterProvider>{children}</CenterProvider>
              </AuthProvider>
            </ConfirmProvider>
          </NotifyProvider>
        </ConnectivityProvider>
      </LocalizationProvider>
    </ColorModeProvider>
  );
}
