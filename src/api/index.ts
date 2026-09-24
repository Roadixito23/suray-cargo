import { localApi } from './localApi'

/** Punto único de acceso a datos. Cambiar aquí por `httpApi` cuando exista el backend. */
export const api = localApi
export type { Api } from './types'
