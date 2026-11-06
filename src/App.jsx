import AppRouter from '@/routes/AppRouter';
import AppProviders from '@/context/AppProviders';

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
