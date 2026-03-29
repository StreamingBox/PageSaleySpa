# Smoke Manual: Conversaciones

Valida el modulo `/conversations` y la creacion de la tabla `conversation_threads` despues de desplegar.

## Precondiciones

- La app ya esta desplegada con el commit que incluye el modulo.
- Existe un usuario con rol `admin`.
- La base de datos configurada en produccion es accesible.

## 1. Verificar despliegue base

1. Abre la URL productiva.
2. Inicia sesion con un usuario `admin`.
3. Confirma que en el menu lateral aparece `Conversaciones`.
4. Entra a `/conversations`.

Resultado esperado:

- La vista carga sin error 500.
- Se ven los KPIs del agente.
- Si no hay datos, aparece el estado vacio con opcion de crear una conversacion.

## 2. Verificar creacion automatica de tabla

Ejecuta en MySQL:

```sql
SHOW TABLES LIKE 'conversation_threads';
```

Resultado esperado:

- Debe existir una fila con `conversation_threads`.

Valida la estructura minima:

```sql
SHOW COLUMNS FROM conversation_threads;
```

Columnas esperadas:

- `id`
- `title`
- `owner_name`
- `channel`
- `status`
- `priority`
- `objective`
- `summary`
- `last_message`
- `next_action`
- `unread_count`
- `last_activity_at`
- `created_at`
- `updated_at`

## 3. Crear una conversacion

Desde `/conversations`:

1. Clic en `Nueva conversacion`.
2. Usa estos valores de prueba:

```text
Titulo: Seguimiento cliente VIP marzo
Responsable: Deyby
Canal: ChatGPT
Estado: Pendiente
Prioridad: Alta
Sin leer: 2
Objetivo: Preparar respuesta y propuesta comercial
Resumen actual: Cliente pide seguimiento sobre paquete premium
Ultimo mensaje clave: Quedo pendiente enviar propuesta hoy
Siguiente accion: Responder antes de las 5 PM
```

3. Guarda.

Resultado esperado:

- Redireccion a `/conversations`.
- Toast de exito.
- La nueva fila aparece en la tabla.
- El hilo aparece arriba o cerca de arriba por score alto.

## 4. Verificar persistencia en base de datos

Ejecuta:

```sql
SELECT
  title,
  owner_name,
  channel,
  status,
  priority,
  unread_count
FROM conversation_threads
ORDER BY id DESC
LIMIT 3;
```

Resultado esperado:

- Debe aparecer el registro creado con los valores ingresados.

## 5. Editar una conversacion

1. En la fila creada, clic en `Editar`.
2. Cambia:
   - `Estado` a `En progreso`
   - `Sin leer` a `0`
3. Guarda.

Resultado esperado:

- Se actualiza la fila.
- Cambian badges y recomendacion del agente.

## 6. Verificar filtros

1. Filtra por `Estado = En progreso`.
2. Filtra por `Prioridad = Alta`.
3. Filtra por `Canal = ChatGPT`.
4. Usa la caja de busqueda con una palabra del titulo.

Resultado esperado:

- La tabla responde a cada filtro sin error.
- `Limpiar filtros` restablece la vista.

## 7. Verificar borrado

1. En la fila de prueba, clic en `Eliminar`.
2. Confirma la accion.

Resultado esperado:

- La fila desaparece del listado.
- No queda visible en la consulta SQL.

Consulta de validacion:

```sql
SELECT COUNT(*) AS total
FROM conversation_threads
WHERE title = 'Seguimiento cliente VIP marzo';
```

Resultado esperado:

- `total = 0`

## 8. Verificar endpoints clave

Con sesion admin activa en navegador o usando una cookie valida:

- `GET /api/conversation-threads`
- `GET /api/conversation-threads/summary`

Resultado esperado:

- Responden `200`.
- El payload trae `data`.

## 9. Señales de fallo

Investiga de inmediato si ves alguno de estos sintomas:

- Error 500 al abrir `/conversations`
- La tabla `conversation_threads` no se crea
- Error SQL por permisos o base incorrecta
- La creacion o edicion guarda en UI pero no persiste en MySQL
- Los endpoints `/api/conversation-threads*` responden `403` con un usuario admin
