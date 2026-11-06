import { createTheme } from '@mui/material/styles';
import { createAppTheme } from './createAppTheme';

/**
 * Tema de la pantalla de llamado (TV): oscuro de alto contraste, siempre, sin depender de la
 * preferencia de color del navegador (Épica 11). Texto blanco sobre casi negro (> 15:1).
 */
export const displayTheme = createTheme(createAppTheme('dark'), {
  palette: {
    background: { default: '#05080D', paper: '#0E1521' },
    text: { primary: '#FFFFFF', secondary: '#CBD5E1' },
    divider: '#243246',
    subtle: '#162033',
  },
});
