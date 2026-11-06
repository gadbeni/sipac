import { COLLECTIONS, ID_PREFIX } from '@/config/constants';
import { createRepository } from './createRepository';

/** Repositorios por colección: repos.centros.list(...), repos.fichas.getById(...) */
export const repos = Object.fromEntries(
  Object.values(COLLECTIONS).map((c) => [c, createRepository(c, { idPrefix: ID_PREFIX[c] })]),
);
