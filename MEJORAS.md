# Plan de Mejoras - SaleySpa

Documento generado tras una auditoria completa del codigo (backend, frontend, seguridad, arquitectura, testing y DevOps) el 7 de mayo de 2026.

---

## Indice

1. [Seguridad (Critico)](#1-seguridad-critico)
2. [Arquitectura y Calidad de Codigo](#2-arquitectura-y-calidad-de-codigo)
3. [Frontend React SPA](#3-frontend-react-spa)
4. [Base de Datos](#4-base-de-datos)
5. [Testing](#5-testing)
6. [DevOps y Despliegue](#6-devops-y-despliegue)
7. [Rendimiento](#7-rendimiento)
8. [Funcionalidad y UX](#8-funcionalidad-y-ux)
9. [Documentacion](#9-documentacion)
10. [Resumen de Prioridades](#10-resumen-de-prioridades)

---

## 1. Seguridad (Critico)

### 1.1. Sin proteccion CSRF

**Problema:** No existe ningun middleware anti-CSRF. Todos los POST, PUT, PATCH y DELETE (tanto del API como de los formularios EJS) son vulnerables a ataques cross-site request forgery. La unica defensa es `sameSite: 'lax'` en la cookie de sesion, lo cual no protege en navegadores antiguos ni contra ataques same-site.

**Solucion:** Instalar y configurar `csrf-csrf` o `csurf` como middleware global. Para el SPA, implementar el patron double-submit cookie (el servidor envia un token en una cookie no-httpOnly, el frontend lo lee y lo envia en un header `X-CSRF-Token`).

```bash
npm install csrf-csrf
```

### 1.2. Sin rate limiting en login

**Problema:** `POST /login` no tiene limite de intentos. Un atacante puede ejecutar fuerza bruta contra contrasenas sin ninguna mitigacion.

**Solucion:** Instalar `express-rate-limit` y aplicarlo especificamente a las rutas de autenticacion. Recomendado: 5 intentos por IP cada 15 minutos, con bloqueo progresivo.

```bash
npm install express-rate-limit
```

### 1.3. Fijacion de sesion (session fixation)

**Problema:** En `controllers/authController.js`, el login no llama a `req.session.regenerate()`. Un atacante que establezca un session ID en el navegador de la victima antes del login puede secuestrar la sesion autenticada.

**Solucion:** Agregar `req.session.regenerate((err) => { ... })` antes de asignar `req.session.user` en el controlador de login.

### 1.4. Sin helmet ni cabeceras de seguridad

**Problema:** Faltan todas las cabeceras HTTP de seguridad: Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, Referrer-Policy. Esto deja la aplicacion expuesta a clickjacking, MIME sniffing, SSL stripping y falta de defensa en profundidad contra XSS.

**Solucion:** Instalar `helmet` y usarlo como middleware global.

```bash
npm install helmet
```

En `app.js`:

```js
const helmet = require('helmet');
app.use(helmet({
    contentSecurityPolicy: false // ajustar segun necesidades del SPA
}));
```

### 1.5. MemoryStore para sesiones (no apto para produccion)

**Problema:** `express-session` usa MemoryStore por defecto. Esto implica: perdida de todas las sesiones al reiniciar el servidor, fugas de memoria (las sesiones nunca se limpian del todo excepto por TTL), y no funciona con multiples procesos (cluster o load balancing).

**Solucion:** Migrar a un almacen de sesiones persistente. Opciones en orden de preferencia:

1. `connect-mysql` (ya tienes MySQL, cero dependencias nuevas de infraestructura) - crea una tabla `sessions` y listo
2. Redis con `connect-redis` (mas rendimiento pero requiere servidor Redis)

```bash
npm install express-mysql-session
```

### 1.6. Secretos con valores por defecto debiles

**Problema:** Cuatro archivos contienen fallbacks con frases predecibles en espanol:

- `config/encryption.js`: `'cambiame_por_algo_secreto'`
- `controllers/clientsController.js`: `'cambiame_por_algo_secreto'`
- `controllers/productsController.js`: `'cambiame_por_algo_secreto'`
- `app.js`: `'cambialo_por_un_valor_seguro'`

Si las variables de entorno no estan configuradas, la app corre con secretos conocidos.

**Solucion:** En produccion, lanzar un error fatal si `SESSION_SECRET` o `HASH_SECRET` no estan definidos, en lugar de usar valores por defecto. Los fallbacks solo deberian existir en entorno de desarrollo.

```js
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET es requerido en produccion');
}
```

### 1.7. Cierre de sesion por GET

**Problema:** `GET /logout` destruye la sesion. Un atacante puede forzar el cierre de sesion de un usuario con `<img src="/logout">` en cualquier pagina que visite.

**Solucion:** Cambiar la ruta de logout a `POST` y protegerla con CSRF.

### 1.8. Fuga de errores en API

**Problema:** El manejador de errores en `app.js` expone `err.message` directamente en las respuestas JSON. En errores no controlados, esto puede filtrar stack traces, rutas del servidor o consultas SQL.

**Solucion:** En produccion, devolver mensajes genericos. Solo incluir detalles en desarrollo.

```js
res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
        ? 'Error interno del servidor'
        : err.message
});
```

### 1.9. Suplantacion de MIME en uploads

**Problema:** `multer` confia en `file.mimetype` enviado por el cliente. Un atacante puede subir un `.exe` renombrado declarando `Content-Type: image/png`.

**Solucion:** Agregar verificacion de magic bytes con la libreria `file-type`.

```bash
npm install file-type
```

### 1.10. Archivos subidos publicamente accesibles

**Problema:** `app.use('/uploads', express.static(...))` expone todos los archivos subidos sin autenticacion. Cualquiera que conozca la URL puede descargar adjuntos privados.

**Solucion:** Servir los uploads a traves de una ruta protegida con `isAuth` que verifique la sesion antes de enviar el archivo.

### 1.11. SHA-1 para ofuscacion de IDs

**Problema:** SHA-1 esta criptograficamente roto. Aunque solo se usa para ofuscar IDs en URLs (no para autenticacion), es una practica debil.

**Solucion:** Migrar a SHA-256. Ya existe el patron correcto con `randomUUID()` en `invoicesService.js` para `public_id` -- extender ese enfoque a clients y products (agregar una columna `public_id UUID`).

### 1.12. Primer usuario admin sin proteccion anti-race-condition

**Problema:** Si dos usuarios se registran simultaneamente cuando la tabla `users` esta vacia, ambos podrian obtener rol `admin`. Ademas, si la tabla se trunca, el siguiente registro es admin.

**Solucion:** Usar una transaccion con lock o crear un usuario admin por semilla en lugar de asignar dinamicamente.

---

## 2. Arquitectura y Calidad de Codigo

### 2.1. Tres patrones de acceso a datos coexistiendo (CRITICO)

El proyecto tiene tres formas diferentes de acceder a la base de datos, lo cual causa duplicacion, inconsistencia y omision de reglas de negocio:

| Capa | Ubicacion | Ejemplo |
|------|-----------|---------|
| SQL directo en controladores | `clientsController.js`, `productsController.js`, `salesController.js`, `homeController.js`, `authController.js` | `pool.execute('SELECT * FROM ...')` |
| Modelos intermedios | `categoriesController.js` -> `categoriesModel.js`, `movementsController.js` -> `movementsModel.js` | `Cat.findAll()` |
| Servicios (via API) | `routes/api/index.js` -> `services/*.js` | `listClients()`, `createSale()` |

**Impacto real:** Los controladores web ignoran toda validacion de servicios. Por ejemplo:

- Se puede crear una venta desde `salesController.js` sin verificar que `client_id` exista
- Se puede editar una venta ya facturada (el servicio lo bloquea, el controlador no)
- Los schemas de base de datos pueden no estar migrados si solo se usan los controladores

**Solucion:** Refactorizar todos los controladores web para que deleguen en los servicios. Eliminar SQL directo de los controladores. Esto unifica el acceso a datos en una sola capa.

### 2.2. Archivo de rutas API monolitico (859 lineas)

**Problema:** `routes/api/index.js` contiene todas las rutas API para 8 dominios distintos en un solo archivo. Es dificil de navegar, mantener y probar.

**Solucion:** Dividir en modulos por dominio:

```
routes/api/
  index.js          (monta todos los sub-routers)
  clients.js
  products.js
  sales.js
  invoices.js
  appointments.js
  movements.js
  categories.js
  analytics.js
  dashboard.js
```

### 2.3. Archivos de servicio demasiado grandes

| Archivo | Lineas | Deberia dividirse en |
|---------|--------|---------------------|
| `services/appointmentsService.js` | 1051 | `appointmentsCrud.js`, `appointmentsAvailability.js`, `appointmentsGoogleSync.js`, `appointmentsSettings.js` |
| `services/invoicesService.js` | 665 | `invoicesCrud.js`, `invoicesPayment.js`, `invoicesMerge.js` |

### 2.4. Directorio models/ es codigo muerto

**Problema:** De los 7 modelos existentes, 5 no se usan en absoluto (`clientsModel`, `productsModel`, `salesModel`, `invoicesModel`, `usersModel`). Los otros 2 (`categoriesModel`, `movementsModel`) solo los usan los controladores legacy que deberian migrarse a servicios.

**Solucion:** Eliminar el directorio `models/` completo despues de migrar los dos controladores restantes a servicios. Mantener una unica capa de acceso a datos: `services/`.

### 2.5. Duplicacion de codigo

- **Formateo de dinero:** `controllers/salesController.js` y `controllers/homeController.js` definen su propia funcion `money()`/`fmtMoney()`. Deberia existir una unica utilidad en `utils/format.js`.
- **Parseo de fechas:** Implementado 3 veces distintas (`homeController`, `analyticsService`, `utils/dateRange.js`). Unificar en `utils/dateRange.js`.
- **Hash de IDs:** `config/encryption.js` ya provee `hashId()` y `hashedLookupClause()`, pero `clientsController.js` y `productsController.js` reimplementan ambas.

### 2.6. Validacion inconsistente

**Problema:** Las rutas API tienen validacion manual caso por caso dentro de `routes/api/index.js`. Los controladores web no tienen practicamente ninguna validacion.

**Solucion:** Instalar una libreria de validacion declarativa como `zod` o `joi`. Definir esquemas de validacion una vez y reutilizarlos en ambos lados (web y API).

```bash
npm install zod
```

### 2.7. Migraciones de schema en tiempo de ejecucion

**Problema:** Cinco funciones `ensure*Schema()` (`ensureUsersSchema`, `ensureAppointmentsSchema`, `ensureInvoiceSchema`, `ensureProductSchema`, `ensureClientSchema`) ejecutan DDL (ALTER TABLE, CREATE TABLE) en cada request o inicio de sesion. Esto agrega latencia innecesaria y mezcla responsabilidades.

**Solucion:** Ejecutar todas las migraciones una sola vez al iniciar el servidor, en un modulo centralizado `config/migrate.js`. O mejor aun, usar una herramienta de migraciones como `knex` o `node-pg-migrate` (adaptado para MySQL).

### 2.8. pool.query() vs pool.execute()

**Problema:** Los modelos usan `pool.query()` que no usa prepared statements reales. Los servicios usan `pool.execute()` correctamente con parametros tipados. Esta inconsistencia es un riesgo de seguridad y rendimiento.

**Solucion:** Eliminar `pool.query()` por completo. Usar exclusivamente `pool.execute()` con placeholders `?`.

### 2.9. Nombres inconsistentes

- `categories.js` no sigue el patron `categoriesRoutes.js` como los demas archivos de rutas
- Los controladores mezclan `index`, `list`, `dashboard` como nombres de metodos de listado -- sin un verbo estandar
- El modelo `findAll` usa nomenclatura estilo MongoDB en un proyecto MySQL

**Solucion:** Estandarizar: metodos de servicio y controlador usan `list`, `getById`, `create`, `update`, `delete`. Archivos de ruta usan el sufijo `Routes`.

### 2.10. Funcion no utilizada

`middleware/authorization.js` define `isUserSession` (linea 11) que nunca se importa ni se llama en ninguna parte.

---

## 3. Frontend React SPA

### 3.1. Sin manejo de errores global (Error Boundary)

**Problema:** No existe ningun Error Boundary en la aplicacion React. Si un componente lanza una excepcion no controlada, toda la aplicacion se cae y el usuario ve una pantalla en blanco.

**Solucion:** Agregar un ErrorBoundary en `App.jsx` que capture errores y muestre una pantalla de fallback con opcion de recargar.

### 3.2. Sin TypeScript

**Problema:** Todo el frontend esta en JavaScript plano (`.jsx`). Esto impide tener verificacion de tipos en tiempo de compilacion, lo que lleva a errores en tiempo de ejecucion que podrian evitarse.

**Solucion:** Migrar progresivamente a TypeScript. Priorizar:

1. `src/ui/lib/api.js` (el fetch wrapper)
2. Interfaces de datos compartidas (clientes, productos, ventas, facturas)
3. Componentes reutilizables

### 3.3. Sin estados de carga consistentes

**Problema:** Aunque se usa React Query (que provee `isLoading`, `isError`), varios componentes no manejan todos los estados. Algunos solo muestran datos o nada.

**Solucion:** Implementar un patron consistente: todo componente que usa datos debe mostrar estados de carga (skeleton/spinner), error (con boton de reintento) y vacio (EmptyState).

### 3.4. Sin accesibilidad (a11y)

**Problema:** No se encontraron atributos ARIA, roles semanticos, ni manejo de foco en componentes interactivos. Los formularios carecen de etiquetas asociadas correctamente.

**Solucion:** Agregar:

- `aria-label` en iconos y botones sin texto
- `role` apropiados en componentes personalizados
- Navegacion por teclado en DataTable y DrawerForm
- Contraste de color verificable en temas claro/oscuro

### 3.5. Sin tests de componentes

**Problema:** Cero tests unitarios o de integracion para los componentes React.

**Solucion:** Agregar Vitest + @testing-library/react. Priorizar:

- Componentes compartidos (DataTable, FilterBar, DrawerForm, SearchableSelect)
- Logica de `src/ui/lib/api.js` (fetch wrapper, manejo de errores)
- Paginas con logica de negocio (InvoiceFormPage, SalesFormPage, AppointmentsPage)

### 3.6. CSS monolítico

**Problema:** Existe un unico archivo `public/css/app.css` con todos los estilos de la aplicacion. A medida que crece, se vuelve dificil de mantener.

**Solucion:** Evaluar migrar a CSS Modules o Tailwind CSS. Alternativamente, dividir `app.css` en archivos por componente/pagina usando `@import` o un preprocesador.

### 3.7. Sin offline support real

**Problema:** El service worker (`public/service-worker.js`) existe pero es minimo. No hay cacheo de assets, datos offline, ni sincronizacion en segundo plano.

**Solucion:** Implementar estrategias de cache con Workbox:

- Cache-first para assets estaticos (CSS, JS, fuentes)
- Network-first para llamadas API
- Stale-while-revalidate para datos que cambian poco

---

## 4. Base de Datos

### 4.1. Sin pool de conexiones con limpieza de conexiones inactivas

**Problema:** `config/db.js` crea un pool de 10 conexiones pero no configura `waitForConnections`, `queueLimit`, ni `enableKeepAlive`.

**Solucion:**

```js
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});
```

### 4.2. Sin indices en columnas frecuentemente consultadas

**Problema:** Las migraciones automaticas crean tablas pero no verifican ni crean indices. Columnas como `sales.sold_at`, `sales.client_id`, `movements.date`, `appointments.appointment_date`, `invoice_items.invoice_id` probablemente carecen de indices optimos.

**Solucion:** Agregar una funcion `ensureIndexes()` que verifique y cree indices en columnas de busqueda frecuente, filtrado y JOIN.

### 4.3. Sin respaldos automatizados

**Problema:** No existe ningun mecanismo de backup de base de datos. Si hay una falla del servidor o eliminacion accidental, los datos se pierden permanentemente.

**Solucion:** Configurar un cron job en el servidor que ejecute `mysqldump` diariamente y rote los backups (guardar los ultimos 7 dias). O usar el servicio de backups automatizados del proveedor de hosting.

### 4.4. IDs autoincrementales expuestos (parcial)

**Problema:** Los IDs de `clients` y `products` se ofuscan con SHA-1 en las URLs pero `sales`, `invoices`, `movements`, `categories` y `appointments` usan IDs numericos directos en la API. Esto es inconsistente.

**Solucion:** Seguir el patron de `invoices` (columna `public_id` UUID) para todas las entidades principales.

---

## 5. Testing

### 5.1. Cero tests unitarios

**Problema:** No existe ningun framework de testing unitario configurado. Los 11 servicios, utilidades y middleware no tienen cobertura de tests.

**Solucion:** Instalar Vitest (ya usas Vite, es la opcion natural). Crear `vitest.config.js` y escribir tests para:

- `utils/apiResponse.js` (formato de respuestas)
- `utils/dateRange.js` (parseo y rangos de fechas)
- `utils/properCase.js` (formateo de nombres)
- `middleware/auth.js` y `middleware/apiAuth.js`
- Todos los servicios, empezando por `salesService.js` (validacion de reglas de negocio) y `invoicesService.js` (logica de facturacion)

```bash
npm install -D vitest
```

### 5.2. Solo 3 tests e2e (1 saltado)

**Problema:** `tests/e2e/smoke.spec.js` tiene 3 tests: 1 saltado por defecto (auth flow), 2 smoke tests basicos. No hay tests de flujos CRUD, formularios, manejo de errores, ni de la API REST.

**Solucion:** Expandir significativamente los tests Playwright:

- Flujo completo: login -> crear cliente -> crear producto -> crear venta -> facturar -> ver factura
- Tests de validacion de formularios (campos requeridos, formatos invalidos)
- Tests de permisos (usuario sin rol admin no puede acceder al dashboard)
- Tests de API directamente (llamadas fetch a `/api/*`)

### 5.3. Sin CI/CD que ejecute tests

**Problema:** No hay GitHub Actions ni ningun pipeline que ejecute los tests automaticamente.

**Solucion:** Crear `.github/workflows/ci.yml` que ejecute lint, tests unitarios, tests e2e y build en cada push y PR.

### 5.4. Sin cobertura de codigo

**Problema:** No se mide la cobertura de tests.

**Solucion:** Agregar script `"test:coverage": "vitest --coverage"` y establecer umbrales minimos (>=60% inicial, subiendo progresivamente).

---

## 6. DevOps y Despliegue

### 6.1. Sin Docker

**Problema:** Cada entorno (desarrollo, produccion) requiere instalacion manual de Node.js, MySQL y configuracion. El proceso de despliegue en `DEPLOY_EC2_UBUNTU.md` tiene mas de 15 pasos manuales.

**Solucion:** Crear:

- `Dockerfile` multi-etapa: etapa de build con Vite, etapa de produccion con Node/Express
- `docker-compose.yml` con servicios `app` + `mysql` + `phpmyadmin` (opcional)
- `.dockerignore`

### 6.2. Sin ESLint ni Prettier

**Problema:** No hay configuracion de linting ni formateo de codigo. El estilo de codigo es inconsistente entre archivos.

**Solucion:**

```bash
npm install -D eslint prettier eslint-config-prettier
```

Configurar reglas base y agregar `"lint": "eslint ."` y `"format": "prettier --write ."` a los scripts.

### 6.3. Dependencias desactualizadas

**Problema:** Varias dependencias tienen versiones significativamente detras de las ultimas estables. `express-session 1.18.1` (la ultima es 1.18.2+), `multer 2.0.2` (version beta, considerar 1.4.5-lts), `method-override 3.0.0` (considerar eliminar, Express 5 ya soporta metodos PUT/DELETE nativamente).

**Solucion:** Ejecutar `npm outdated` y planificar actualizaciones progresivas. Priorizar parches de seguridad.

### 6.4. Sin gestion de procesos en produccion

**Problema:** No hay configuracion de PM2 en el repositorio. El deploy manual requiere recordar comandos PM2.

**Solucion:** Agregar `ecosystem.config.js` para PM2 con configuracion de reinicio automatico, logs y entorno.

### 6.5. Variables de entorno sin validacion

**Problema:** Si una variable de entorno requerida falta, la app falla en runtime con errores oscuros en lugar de fallar al iniciar con un mensaje claro.

**Solucion:** Agregar validacion de variables de entorno al inicio con `zod` o una funcion simple que verifique las variables requeridas y emita errores descriptivos.

---

## 7. Rendimiento

### 7.1. Sin compresion de respuestas

**Problema:** Express no tiene compresion gzip/brotli habilitada. Las respuestas JSON y el bundle de React se envian sin comprimir.

**Solucion:**

```bash
npm install compression
```

```js
const compression = require('compression');
app.use(compression());
```

### 7.2. Assets estaticos sin cache headers

**Problema:** `express.static` se usa sin configuracion de cache. Los archivos en `public/app/` (bundle de Vite) deberian tener cache inmutable (ya que tienen hash en el nombre), pero no se configura.

**Solucion:**

```js
app.use(express.static('public', {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        if (filePath.includes('/app/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));
```

### 7.3. Sin lazy loading de rutas

**Problema:** Todas las paginas del SPA se cargan en el bundle inicial. Al crecer la aplicacion, el tiempo de carga inicial aumentara.

**Solucion:** Usar `React.lazy()` y `Suspense` para cargar paginas bajo demanda:

```jsx
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const AppointmentsPage = React.lazy(() => import('./pages/AppointmentsPage'));
```

### 7.4. QueryClient sin configuracion optima

**Problema:** React Query se inicializa con valores por defecto. Se pueden ajustar `staleTime`, `gcTime` y `retry` segun el tipo de dato.

**Solucion:** Configurar valores por defecto en `QueryClient`:

```js
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30 * 1000,      // 30 segundos antes de revalidar
            gcTime: 5 * 60 * 1000,      // 5 minutos de garbage collection
            retry: 2,
            refetchOnWindowFocus: false
        }
    }
});
```

---

## 8. Funcionalidad y UX

### 8.1. Sin busqueda global de clientes

**Problema:** Para encontrar un cliente hay que navegar a la pagina de clientes y filtrar. En flujos como crear una venta, el selector de cliente no tiene busqueda por texto libre (solo dropdown).

**Solucion:** Convertir el selector de cliente en un SearchableSelect con busqueda asincrona que consulte el API a medida que el usuario escribe.

### 8.2. Sin notificaciones en tiempo real

**Problema:** Las citas, ventas y facturas solo se actualizan al recargar la pagina o al navegar.

**Solucion:** Implementar polling con React Query (`refetchInterval`) para las paginas criticas (dashboard, citas del dia). A futuro, evaluar WebSockets para notificaciones push.

### 8.3. Sin exportacion de facturas individuales

**Problema:** El PDF se genera pero no hay un endpoint dedicado para descargar una factura especifica desde el frontend SPA. La funcionalidad de PDF existe en `utils/invoicePdf.js` pero no esta expuesta como API.

**Solucion:** Agregar endpoint `GET /api/invoices/:id/pdf` que genere y devuelva el PDF.

### 8.4. Sin filtros avanzados en movimientos

**Problema:** La pagina de movimientos tiene filtros basicos. No se puede filtrar por rango de montos, cuenta o descripcion.

**Solucion:** Agregar parametros de query adicionales al API y campos de filtro en el frontend.

### 8.5. Sin paginacion en algunas listas

**Problema:** Algunas listas (categorias, productos en ciertos contextos) no tienen paginacion. Si crecen, la pagina se vuelve lenta.

**Solucion:** Agregar paginacion consistente a todas las listas usando el mismo patron de `meta` con `page`, `pageSize`, `total` que ya usan movimientos y clientes.

---

## 9. Documentacion

### 9.1. Sin documentacion de API

**Problema:** Los 30+ endpoints del API no estan documentados. Un desarrollador nuevo tiene que leer `routes/api/index.js` entero (859 lineas) para entender que endpoints existen.

**Solucion:** Agregar documentacion OpenAPI/Swagger usando `swagger-jsdoc` y `swagger-ui-express`.

```bash
npm install swagger-jsdoc swagger-ui-express
```

### 9.2. Sin documentacion de arquitectura

**Problema:** No existe un documento que explique la arquitectura del proyecto, decisiones tecnicas, o guia de contribucion.

**Solucion:** Crear `docs/ARCHITECTURE.md` con el diagrama de capas, explicacion del stack, patrones usados y flujo de datos.

### 9.3. Sin CHANGELOG

**Problema:** No hay registro de cambios entre versiones.

**Solucion:** Mantener un `CHANGELOG.md` siguiendo el formato Keep a Changelog.

---

## 10. Resumen de Prioridades

### Prioridad 1 - Seguridad (implementar inmediatamente)

| # | Mejora | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 1 | Agregar helmet (cabeceras de seguridad) | Bajo (30 min) | Alto |
| 2 | Agregar rate limiting en login | Bajo (15 min) | Alto |
| 3 | Regenerar sesion en login (anti session fixation) | Bajo (5 min) | Alto |
| 4 | Migrar MemoryStore a MySQL session store | Medio (1-2 h) | Alto |
| 5 | Implementar proteccion CSRF | Medio (2-3 h) | Alto |
| 6 | Validar variables de entorno requeridas al iniciar | Bajo (30 min) | Medio |
| 7 | Cambiar logout de GET a POST | Bajo (15 min) | Medio |
| 8 | Verificar magic bytes en uploads | Bajo (30 min) | Medio |
| 9 | Proteger ruta de uploads con autenticacion | Bajo (15 min) | Medio |
| 10 | Ocultar mensajes de error en produccion | Bajo (10 min) | Bajo |

### Prioridad 2 - Arquitectura (siguiente sprint)

| # | Mejora | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 1 | Refactorizar controladores web para usar servicios | Alto (1-2 semanas) | Alto |
| 2 | Dividir `routes/api/index.js` en modulos por dominio | Medio (3-4 h) | Alto |
| 3 | Dividir `appointmentsService.js` en 3-4 archivos | Medio (3-4 h) | Medio |
| 4 | Eliminar directorio `models/` | Bajo (1 h) | Medio |
| 5 | Unificar funciones duplicadas (money, date, hash) | Bajo (1-2 h) | Medio |
| 6 | Centralizar migraciones de schema al inicio | Medio (2-3 h) | Medio |
| 7 | Agregar zod para validacion declarativa | Medio (3-4 h) | Alto |
| 8 | Estandarizar nombres de metodos y archivos | Bajo (1-2 h) | Bajo |

### Prioridad 3 - Frontend

| # | Mejora | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 1 | Agregar ErrorBoundary global | Bajo (15 min) | Alto |
| 2 | Configurar estados de carga consistentes | Medio (3-4 h) | Medio |
| 3 | Lazy loading de paginas | Bajo (1 h) | Medio |
| 4 | Migrar a TypeScript (progresivo) | Alto (semanas) | Alto |
| 5 | Mejorar accesibilidad (ARIA, teclado) | Medio (5-8 h) | Medio |

### Prioridad 4 - Testing y DevOps

| # | Mejora | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 1 | Configurar ESLint + Prettier | Bajo (30 min) | Medio |
| 2 | Crear Dockerfile y docker-compose.yml | Medio (2-3 h) | Alto |
| 3 | Configurar GitHub Actions (CI) | Medio (2-3 h) | Alto |
| 4 | Agregar Vitest + tests unitarios basicos | Medio (4-6 h) | Alto |
| 5 | Expandir tests e2e con flujos CRUD | Alto (1-2 semanas) | Medio |
| 6 | Agregar documentacion Swagger del API | Medio (3-4 h) | Medio |

### Prioridad 5 - Rendimiento y BD

| # | Mejora | Esfuerzo | Impacto |
|---|--------|----------|---------|
| 1 | Agregar compresion gzip | Bajo (5 min) | Medio |
| 2 | Configurar cache headers para assets | Bajo (10 min) | Medio |
| 3 | Configurar indices de base de datos | Medio (1-2 h) | Alto |
| 4 | Configurar keepAlive en pool MySQL | Bajo (5 min) | Medio |
| 5 | Configurar respaldos automaticos de BD | Medio (1 h) | Alto |
| 6 | Optimizar React Query (staleTime, gcTime) | Bajo (10 min) | Bajo |

---

*Documento generado el 7 de mayo de 2026. Version 1.0.*
