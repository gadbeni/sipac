import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Roboto local, solo subconjuntos latinos (español).
import '@fontsource/roboto/latin-300.css';
import '@fontsource/roboto/latin-ext-300.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-ext-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-ext-500.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/roboto/latin-ext-700.css';
import App from './App';
import { demoService } from '@/services/demoService';

// Siembra los datos la primera vez y aplica transiciones por paso del tiempo (RN-DEM-01, R7).
const root = createRoot(document.getElementById('root'));
demoService
  .initialize()
  .then((init) => {
    if (import.meta.env.DEV) console.info('[SIPAC] datos', init.seeded ? 'sembrados' : 'existentes', init);
  })
  .catch((e) => console.error('[SIPAC] no se pudieron preparar los datos', e))
  .finally(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
