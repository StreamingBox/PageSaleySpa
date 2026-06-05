# PageSaleySpa

Sistema web para la gestión operativa de SaleySpa.

Incluye:
- dashboard de ventas y cartera
- gestión de clientes
- catálogo de productos y servicios
- facturación
- ventas
- movimientos
- categorías
- módulo de citas con agenda, bloqueos, Google Calendar y Google Maps

## Stack

- Node.js
- Express
- EJS
- React + Vite
- MySQL
- React Query

## Requisitos

- Node.js 20+
- MySQL 8+
- npm

## Variables de entorno

Crea un archivo `.env` con base en `.env.example`.

Variables principales:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=my_database
SESSION_SECRET=cambia_esto
SESSION_TTL_MS=7200000
REMEMBER_SESSION_TTL_MS=2592000000
HASH_SECRET=cambia_esto_tambien
NODE_ENV=development
PORT=3000

APPOINTMENTS_BUSINESS_NAME=SaleySpa
APPOINTMENTS_BUSINESS_ADDRESS=Calle 123 #45-67, Bogota, Colombia
APPOINTMENTS_CALENDAR_EMAIL=payss24@gmail.com

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://developers.google.com/oauthplayground
GOOGLE_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=primary
```

## Instalación local

```bash
npm install
npm run build
node app.js
```

App:

```text
http://localhost:3000
```

## Desarrollo

```bash
npm run dev
```

Esto deja:
- servidor Express con `nodemon`
- build cliente de Vite en modo watch

## Scripts

- `npm run dev`: desarrollo
- `npm run build`: compila frontend
- `npm start`: build + arranque
- `npm test`: pruebas Playwright

## Módulo de Citas

Funcionalidad incluida:
- horario operativo configurable
- anticipación mínima para reserva
- bloqueos manuales de agenda
- duración por servicio y duración manual por cita
- confirmación de cita y paso al formulario de venta
- sincronización de eventos con Google Calendar
- enlace a Google Maps con la dirección del spa

## Despliegue

Guía paso a paso:

- [docs/DEPLOY_EC2_UBUNTU.md](docs/DEPLOY_EC2_UBUNTU.md)
