import { httpApi } from './httpApi'
import { localApi } from './localApi'

/**
 * Punto único de acceso a datos. En los tests (vitest → MODE === 'test') se usa el
 * almacenamiento local, rápido y sin red; en la app real, Supabase (ver supabase/schema.sql).
 */
export const usaBaseRemota = import.meta.env.MODE !== 'test'
export const api = usaBaseRemota ? httpApi : localApi
export type { Api } from './types'
