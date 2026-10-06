import { sha256 } from './hash'

// Vectores calculados con SHA-256 estándar (bordes de bloque: 55, 56 y 64 bytes).
const casos: [string, string][] = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'],
  ['contraseña ñandú 🚚', 'b5e2fad38ca3ba0cfddda4260d1924d85a9bdfe6961702825b0287f8ecb743dc'],
  ['x'.repeat(55), 'd5e285683cd4efc02d021a5c62014694958901005d6f71e89e0989fac77e4072'],
  ['y'.repeat(56), '4877e564e5e36e367c7c8d59670774becd3350610b6df4c399c9fa9b66da5813'],
  ['z'.repeat(64), '72996563049cc84daa2c3f31fd5c3d10770e69d6ebbb8da5b6d76db303dbae43'],
  ['w'.repeat(1000), '04ffd92aef8aafe6f4f8388bc9f7c5b0d39eae37128b1ca693647b8569f8e629'],
]

describe('sha256', () => {
  it.each(casos)('hash de %j', async (texto, esperado) => {
    expect(await sha256(texto)).toBe(esperado)
  })

  it('funciona sin crypto.subtle (HTTP desde otra IP de la red)', async () => {
    vi.stubGlobal('crypto', {})
    try {
      for (const [texto, esperado] of casos) expect(await sha256(texto)).toBe(esperado)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
