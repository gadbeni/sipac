import { Avatar } from '@mui/material';

/** Avatar con iniciales (RN-MED-05: sin fotografías de personas reales). */
export default function DoctorAvatar({ iniciales, size = 40 }) {
  return (
    <Avatar
      aria-hidden
      sx={(t) => ({
        width: size,
        height: size,
        fontSize: size * 0.4,
        fontWeight: 700,
        bgcolor: t.palette.status.primary.bg,
        color: t.palette.status.primary.fg,
      })}
    >
      {iniciales}
    </Avatar>
  );
}
