# Suray Cargo Web

Versión web (React + TypeScript + Vite) del sistema de control de ventas Suray Cargo, migrada desde la app Flutter
([SurayCargoPC](https://github.com/Roadixito23/SurayCargoPC)). Documentación completa en la bóveda de Obsidian
`D:\Obsidian\SurayCargo-Dev`.

**Sin Firebase.** Por ahora todos los datos se guardan en `localStorage` del navegador; el backend definitivo se
conectará después sin tocar las pantallas.

## Uso

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # reglas de negocio (vitest)
npm run build      # tsc + vite build → dist/
```

Usuario inicial: **admin / admin** (cambiar la contraseña desde Usuarios). Los datos son por navegador: haz
respaldos periódicos desde *Respaldos* (JSON compatible con los de la app Flutter).

## Arquitectura

```
src/
  types.ts              modelos (mismos campos que Flutter → respaldos compatibles)
  api/
    types.ts            contrato `Api` (lo que el backend debe ofrecer)
    localApi.ts         implementación con localStorage
    index.ts            ÚNICO lugar donde se elige la implementación
  services/             reglas de negocio + auditoría (ventas, usuarios, respaldo)
  auth/                 sesión y rutas protegidas
  components/           Layout, Ticket (80 mm), ReporteCierre, VentasExplorer, Modal…
  pages/                una por pantalla
```

### Conectar el backend real
1. Crear `src/api/httpApi.ts` que implemente `Api` (`src/api/types.ts`) con `fetch`.
2. Cambiar el export en `src/api/index.ts`.
3. Mover al servidor: numeración de boletas (transacción por sucursal), autenticación/roles, hash de contraseñas y
   la restricción "las ventas solo se anulan, nunca se eliminan".

## Impresión
Los tickets son HTML/CSS de 80 mm impresos con `window.print()` (`@page { size: 80mm auto }`). Para imprimir sin
diálogo en el PC de caja, abrir Chrome con `--kiosk-printing` e impresora térmica predeterminada.

## Reglas de negocio clave
- Boleta `AYS-000001` / `COY-000001`, correlativa por sucursal del usuario.
- Usuarios no admin: destino fijo = sucursal opuesta; solo ven/anulan sus ventas. Admin ve todo.
- Anulación con motivo obligatorio; nunca se elimina una venta.
- Cierre de caja = reporte; solo suma ventas no anuladas de tipo `venta`.
- Histórico: últimos 90 días, derivado de las ventas.
- Auditoría de login/logout, ventas, anulaciones, usuarios y respaldos.

## Limitaciones actuales (localStorage)
- Datos por navegador/equipo, sin sincronizar entre sucursales.
- Cuota ~5 MB; la auditoría se limita a los últimos 5.000 registros.
- Contraseñas con SHA-256 sin sal y rol validado en el cliente: **no es seguridad real**, solo un placeholder hasta el backend.
