import { describe, it, expect, afterEach } from 'vitest';
import {
  setClock,
  today,
  currentTime,
  nowIso,
  addDays,
  diffDays,
  isoWeekday,
  formatDate,
  formatDateTime,
  parseDisplayDate,
  toIso,
  addMinutesIso,
  timeRangesOverlap,
  addMinutesToTime,
  ageAt,
  isoToDate,
} from '@/utils/dates';

afterEach(() => setClock());

describe('fechas en America/La_Paz', () => {
  it('"hoy" se calcula en La Paz aunque en UTC ya sea el día siguiente', () => {
    setClock(() => Date.parse('2026-11-06T02:30:00Z')); // 22:30 del 05/11 en La Paz
    expect(today()).toBe('2026-11-05');
    expect(currentTime()).toBe('22:30');
    expect(nowIso()).toBe('2026-11-05T22:30:00-04:00');
  });

  it('aritmética de días sin desfases', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-11-05', '2026-11-19')).toBe(14);
  });

  it('día ISO de la semana (1 = lunes, 7 = domingo)', () => {
    expect(isoWeekday('2026-11-09')).toBe(1);
    expect(isoWeekday('2026-11-08')).toBe(7);
  });

  it('formato DD/MM/YYYY', () => {
    expect(formatDate('2026-11-05')).toBe('05/11/2026');
    expect(formatDateTime('2026-11-05T08:15:00-04:00')).toBe('05/11/2026 08:15');
    expect(parseDisplayDate('05/11/2026')).toBe('2026-11-05');
    expect(parseDisplayDate('31/02/2026')).toBeNull();
  });

  it('fecha-hora ISO con offset −04:00', () => {
    expect(toIso('2026-11-05', '08:00')).toBe('2026-11-05T08:00:00-04:00');
    expect(addMinutesIso('2026-11-05T23:50:00-04:00', 20)).toBe('2026-11-06T00:10:00-04:00');
    expect(isoToDate('2026-11-06T02:00:00Z')).toBe('2026-11-05');
  });

  it('horas y solapamientos', () => {
    expect(addMinutesToTime('08:00', 140)).toBe('10:20');
    expect(timeRangesOverlap('08:00', '12:00', '11:59', '13:00')).toBe(true);
    expect(timeRangesOverlap('08:00', '12:00', '12:00', '13:00')).toBe(false);
  });

  it('edad cumplida', () => {
    expect(ageAt('2010-11-06', '2026-11-05')).toBe(15);
    expect(ageAt('2010-11-05', '2026-11-05')).toBe(16);
  });
});
