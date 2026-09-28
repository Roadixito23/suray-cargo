import { describe, expect, it } from 'vitest'
import { CLAVE_TEMA, aplicarTema, guardarPreferencia, leerPreferencia, resolverTema } from './tema'

describe('tema', () => {
  it('sin preferencia guardada usa "sistema"', () => {
    expect(leerPreferencia()).toBe('sistema')
  })

  it('guarda y recupera la preferencia', () => {
    guardarPreferencia('oscuro')
    expect(leerPreferencia()).toBe('oscuro')
    guardarPreferencia('claro')
    expect(leerPreferencia()).toBe('claro')
  })

  it('ignora valores inválidos o corruptos', () => {
    localStorage.setItem(CLAVE_TEMA, JSON.stringify('violeta'))
    expect(leerPreferencia()).toBe('sistema')
    localStorage.setItem(CLAVE_TEMA, '{no es json')
    expect(leerPreferencia()).toBe('sistema')
  })

  it('resuelve el tema efectivo', () => {
    expect(resolverTema('claro', true)).toBe('claro')
    expect(resolverTema('oscuro', false)).toBe('oscuro')
    expect(resolverTema('sistema', true)).toBe('oscuro')
    expect(resolverTema('sistema', false)).toBe('claro')
  })

  it('aplica el tema al documento', () => {
    aplicarTema('oscuro')
    expect(document.documentElement.dataset.tema).toBe('oscuro')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    aplicarTema('claro')
    expect(document.documentElement.dataset.tema).toBe('claro')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })
})
