import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { assertCenterAccess, can, scopeCenter } from '@/services/auth/guards';
import { setDataSource } from '@/services/datasource';
import { createLocalDataSource } from '@/services/datasource/localDataSource';
import { createMemoryStorage } from '@/services/datasource/storage';
import { setOnlineOverride } from '@/services/datasource/connectivity';
import { setLatency } from '@/services/repositories/createRepository';
import { seedDemoData } from '@/services/seed/initDemoData';
import { PERMISOS_POR_ROL } from '@/config/constants';
import { ADMIN_ROUTES } from '@/routes/routes.config';
import { setClock, toIso } from '@/utils/dates';

const ISO = toIso('2026-11-09', '10:00');
const T0 = new Date(ISO).getTime();
let ds;

// localStorage mínimo para el almacén de sesión en Node.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  key: () => null,
  length: 0,
};

beforeEach(() => {
  mem.clear();
  setLatency(0);
  setClock(() => T0);
  setOnlineOverride(true);
  ds = createLocalDataSource({ storage: createMemoryStorage(), emit: () => {} });
  setDataSource(ds);
  seedDemoData(ds, { date: '2026-11-09', time: '10:00', iso: ISO });
});
afterAll(() => {
  setClock();
  setOnlineOverride(null);
  delete globalThis.localStorage;
});

const login = (u) => authService.login(u, 'Demo2026!');

describe('authService', () => {
  it('login correcto crea sesión con centros y permisos', async () => {
    const s = await login('recepcion.central');
    expect(s).toMatchObject({
      rol: 'recepcionista',
      centrosPermitidos: ['cen_001'],
      activeCenterId: 'cen_001',
    });
    expect(authService.getSession().usuarioId).toBe('usr_003');
    expect(ds.get('usuarios', 'usr_003').ultimoAcceso).toBeTruthy();
  });

  it('credenciales inválidas: mensaje único', async () => {
    await expect(authService.login('recepcion.central', 'x')).rejects.toMatchObject({
      code: 'CREDENCIALES_INVALIDAS',
    });
    await expect(authService.login('no.existe', 'Demo2026!')).rejects.toMatchObject({
      code: 'CREDENCIALES_INVALIDAS',
    });
  });

  it('médico multicentro: centros de sus vínculos activos; admin central: vista global', async () => {
    const m = await login('dra.mendez');
    expect(m.centrosPermitidos.sort()).toEqual(['cen_001', 'cen_002']);
    const s2 = authService.setActiveCenter(m, 'cen_002');
    expect(s2.activeCenterId).toBe('cen_002');
    expect(() => authService.setActiveCenter(s2, 'cen_003')).toThrow(
      expect.objectContaining({ code: 'ACCESO_DENEGADO' }),
    );
    expect(() => authService.setActiveCenter(s2, null)).toThrow(
      expect.objectContaining({ code: 'ACCESO_DENEGADO' }),
    );
    const c = await login('admin.central');
    expect(c.activeCenterId).toBeNull();
    expect(authService.setActiveCenter(c, 'cen_003').activeCenterId).toBe('cen_003');
  });

  it('la sesión expira a las 8 h (RN-USR-04)', async () => {
    await login('admin.pompeya');
    setClock(() => T0 + 8 * 3600_000 - 1000);
    expect(authService.getSession().usuarioId).toBe('usr_006');
    setClock(() => T0 + 8 * 3600_000 + 1000);
    expect(authService.getSession()).toEqual({ expired: true });
    expect(authService.getSession()).toBeNull();
  });

  it('usuario desactivado pierde la sesión y no puede ingresar', async () => {
    const c = await login('admin.central');
    await login('recepcion.pompeya');
    await userService.setActive(c, 'usr_007', false);
    expect(authService.getSession()).toBeNull();
    await expect(login('recepcion.pompeya')).rejects.toMatchObject({ code: 'USUARIO_INACTIVO' });
  });

  it('login sin conexión no se simula', async () => {
    setOnlineOverride(false);
    await expect(login('admin.central')).rejects.toMatchObject({ code: 'SIN_CONEXION' });
    setOnlineOverride(true);
  });

  it('cambio de contraseña valida y persiste', async () => {
    const s = await login('recepcion.central');
    await expect(
      authService.changePassword(s, { actual: 'mal', nueva: 'Nueva2026', confirmacion: 'Nueva2026' }),
    ).rejects.toMatchObject({ code: 'VALIDACION' });
    await expect(
      authService.changePassword(s, { actual: 'Demo2026!', nueva: 'corta', confirmacion: 'corta' }),
    ).rejects.toMatchObject({ details: { fields: { nueva: expect.any(String) } } });
    await authService.changePassword(s, {
      actual: 'Demo2026!',
      nueva: 'Nueva2026',
      confirmacion: 'Nueva2026',
    });
    await expect(login('recepcion.central')).rejects.toMatchObject({ code: 'CREDENCIALES_INVALIDAS' });
    expect((await authService.login('recepcion.central', 'Nueva2026')).usuarioId).toBe('usr_003');
  });
});

describe('guardas de acceso', () => {
  it('centroId ajeno → ACCESO_DENEGADO', async () => {
    const s = await login('recepcion.central');
    expect(() => assertCenterAccess(s, 'cen_002')).toThrow(
      expect.objectContaining({ code: 'ACCESO_DENEGADO' }),
    );
    expect(() => scopeCenter(s, 'cen_002')).toThrow(expect.objectContaining({ code: 'ACCESO_DENEGADO' }));
    expect(scopeCenter(s)).toBe('cen_001');
    const admin = await login('admin.central.cs');
    await expect(userService.list(admin, { centroId: 'cen_002' })).rejects.toMatchObject({
      code: 'ACCESO_DENEGADO',
    });
    const propios = await userService.list(admin);
    expect(propios.every((u) => u.centrosIds.includes('cen_001'))).toBe(true);
    expect(propios.some((u) => 'password' in u)).toBe(false);
  });

  it('cada rol ve exactamente las rutas de la matriz (RN-USR-01)', () => {
    for (const rol of Object.keys(PERMISOS_POR_ROL)) {
      const s = { usuarioId: 'x', rol };
      const visibles = ADMIN_ROUTES.filter((r) => r.sidebar && (!r.permission || can(s, r.permission))).map(
        (r) => r.path,
      );
      const esperadas = ADMIN_ROUTES.filter(
        (r) =>
          r.sidebar &&
          (!r.permission || [].concat(r.permission).some((p) => PERMISOS_POR_ROL[rol].includes(p))),
      ).map((r) => r.path);
      expect(visibles).toEqual(esperadas);
    }
    const recep = ADMIN_ROUTES.filter(
      (r) => r.sidebar && (!r.permission || can({ usuarioId: 'x', rol: 'recepcionista' }, r.permission)),
    ).map((r) => r.title);
    expect(recep).toEqual([
      'Dashboard',
      'Solicitudes de fichas',
      'Entrega de fichas',
      'Agenda médica',
      'Pacientes',
      'Configuración',
    ]);
    const medico = ADMIN_ROUTES.filter(
      (r) => r.sidebar && (!r.permission || can({ usuarioId: 'x', rol: 'medico' }, r.permission)),
    ).map((r) => r.title);
    expect(medico).toEqual(['Dashboard', 'Agenda médica', 'Pacientes', 'Configuración']);
  });
});

describe('userService (admin central)', () => {
  it('crea, valida y restablece contraseña; otros roles no pueden', async () => {
    const c = await login('admin.central');
    const base = {
      username: 'recep.nueva',
      nombre: 'Recepción Nueva',
      email: 'recep.nueva@demo-salud.bo',
      rol: 'recepcionista',
      centroId: 'cen_003',
      medicoId: null,
      password: 'Clave2026',
    };
    const u = await userService.create(c, base);
    expect(u).toMatchObject({ username: 'recep.nueva', centroId: 'cen_003', activo: true });
    expect(u.password).toBeUndefined();
    await expect(userService.create(c, base)).rejects.toMatchObject({ code: 'DUPLICADO' });
    await expect(
      userService.create(c, { ...base, username: 'otro.user', centroId: null }),
    ).rejects.toMatchObject({ details: { fields: { centroId: expect.any(String) } } });
    await expect(
      userService.create(c, { ...base, username: 'medico.dup', rol: 'medico', medicoId: 'med_001' }),
    ).rejects.toMatchObject({ code: 'DUPLICADO' });
    expect(await userService.resetPassword(c, u.id)).toBe('Demo2026!');
    await expect(userService.setActive(c, c.usuarioId, false)).rejects.toMatchObject({ code: 'VALIDACION' });
    const recep = await login('recepcion.central');
    await expect(userService.create(recep, base)).rejects.toMatchObject({ code: 'PERMISO_DENEGADO' });
    await expect(userService.list(recep)).rejects.toMatchObject({ code: 'PERMISO_DENEGADO' });
  });
});
