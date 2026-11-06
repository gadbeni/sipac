import { Link } from '@mui/material';

/** Enlace "Saltar al contenido" visible al recibir foco con teclado. */
export default function SkipLink() {
  return (
    <Link
      href="#contenido"
      onClick={(e) => {
        e.preventDefault();
        document.getElementById('contenido')?.focus();
      }}
      sx={{
        position: 'absolute',
        left: 8,
        top: -48,
        zIndex: 2000,
        px: 2,
        py: 1,
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        borderRadius: 1,
        '&:focus': { top: 8 },
      }}
    >
      Saltar al contenido
    </Link>
  );
}
