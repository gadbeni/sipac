import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  forgetRememberedPatient,
  readRememberedPatient,
  saveRememberedPatient,
} from '@/utils/rememberedPatient';
import { createMemoryStorage } from '@/services/datasource/storage';

const DATOS = {
  tipoDocumento: 'CI',
  numeroDocumento: '7654321',
  complemento: '',
  nombres: 'Ana',
  apellidos: 'Ficticia Demo',
  fechaNacimiento: '1990-05-04',
  sexo: 'F',
  telefono: '71234567',
  acepta: true,
};

describe('Datos del paciente recordados en el dispositivo', () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage();
  });
  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('sin datos guardados devuelve null', () => {
    expect(readRememberedPatient()).toBeNull();
  });

  it('guarda solo identificación y contacto, sin la declaración', () => {
    saveRememberedPatient({ ...DATOS, motivo: 'dolor', especialidadId: 'x' });
    const r = readRememberedPatient();
    expect(r.numeroDocumento).toBe('7654321');
    expect(r.nombres).toBe('Ana');
    expect(r).not.toHaveProperty('acepta');
    expect(r).not.toHaveProperty('motivo');
    expect(r).not.toHaveProperty('especialidadId');
    expect(localStorage.getItem('sipac:pref:pacienteRecordado')).toContain('7654321');
  });

  it('olvidar borra los datos', () => {
    saveRememberedPatient(DATOS);
    forgetRememberedPatient();
    expect(readRememberedPatient()).toBeNull();
  });

  it('tolera datos corruptos y navegadores sin almacenamiento', () => {
    localStorage.setItem('sipac:pref:pacienteRecordado', '{no-json');
    expect(readRememberedPatient()).toBeNull();
    delete globalThis.localStorage;
    expect(readRememberedPatient()).toBeNull();
    expect(() => saveRememberedPatient(DATOS)).not.toThrow();
    expect(() => forgetRememberedPatient()).not.toThrow();
  });
});
