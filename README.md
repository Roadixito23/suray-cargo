# Suray Cargo

Sistema de control de ventas Suray Cargo: React + TypeScript + Vite, con Supabase (Postgres) como backend.

## Uso

```bash
npm install
cp .env.local.example .env.local   # completar con las credenciales del proyecto Supabase
npm run dev        # http://localhost:5173
npm test           # reglas de negocio (vitest, corre contra almacenamiento local en memoria)
npm run build      # tsc + vite build → dist/
```

Antes del primer uso, ejecutar [`supabase/schema.sql`](supabase/schema.sql) completo en el **SQL Editor** del
proyecto de Supabase: crea las tablas, las políticas de RLS y las funciones (`login_usuario`, `crear_venta`, etc.)
de las que depende la app, y deja creado el usuario inicial **admin / admin** (cambiar la contraseña desde
Usuarios apenas se entra).

## Arquitectura

```
src/
  types.ts              modelos de datos de la aplicación
  api/
    types.ts            contrato `Api` (lo que el backend debe ofrecer)
    httpApi.ts           implementación real contra Supabase
    localApi.ts          implementación con localStorage (solo usada por los tests)
    supabaseClient.ts    cliente de Supabase (URL + llave publicable, desde .env.local)
    index.ts             ÚNICO lugar donde se elige la implementación
  services/             reglas de negocio + auditoría (ventas, usuarios, respaldo)
  auth/                 sesión y rutas protegidas
  components/           Layout, Ticket (80 mm), ReporteCierre, VentasExplorer, Modal…
  pages/                una por pantalla
supabase/
  schema.sql            tablas, RLS y funciones del backend (ejecutar en Supabase)
```

### Backend (Supabase)
- La numeración de boletas (`AYS-000001` / `COY-000001`) se asigna de forma atómica en el servidor vía la función
  `crear_venta`, evitando choques entre usuarios concurrentes.
- Las ventas son inmutables salvo su anulación: un trigger en Postgres lo hace cumplir también del lado servidor.
- El hash de la contraseña nunca sale por un `SELECT` normal (privilegio de columna revocado para el rol `anon`);
  el login se valida server-side con la función `login_usuario`, y el respaldo JSON (única vía que sí necesita el
  hash) usa la función `exportar_respaldo`.
- Como la app no usa Supabase Auth (login propio, sin sesión de Postgres por usuario), la llave publicable queda
  embebida en el bundle: es un backend adecuado para arrancar y guardar datos ya, pero no reemplaza una
  autenticación real. Ver limitaciones abajo.

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

## Limitaciones actuales
- No hay separación por fila a nivel de base de datos entre sucursales/usuarios (no hay sesión de Supabase Auth
  que la identifique): el filtro "cada usuario ve solo sus ventas" sigue siendo responsabilidad del cliente, igual
  que antes con localStorage.
- Contraseñas con SHA-256 sin sal: mejor que exponerlas en texto plano, pero sigue sin ser un hash pensado para
  contraseñas (bcrypt/argon2). Pendiente para cuando se pase al hosting propio de la empresa.
- Pensado como paso intermedio: cuando exista hosting propio con autenticación real, migrar `httpApi.ts` a ese
  backend sin tocar el resto de la app (el contrato `Api` no cambia).