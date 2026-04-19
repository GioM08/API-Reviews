# API Reviews — Contexto de Backend para Frontend

## Arquitectura general

Microservicios independientes. El frontend (Flutter) se comunica directamente con cada servicio según la operación. La autenticación es JWT firmado con RS256 (válido 1 hora).

---

## Servicios y puertos

| Servicio           | Puerto  | Protocolo | Base de datos              |
|--------------------|---------|-----------|----------------------------|
| auth-service       | 3000    | REST      | MongoDB (authdb)           |
| user-service       | 3001    | REST      | MongoDB (userdb)           |
| restaurant-service | 3003    | REST      | PostgreSQL (restaurantsdb) |
| review-service     | 3004    | REST      | PostgreSQL (reviewsdb)     |
| media-service      | 50051   | gRPC      | MinIO (S3)                 |

---

## Autenticación

Todas las rutas marcadas como **[AUTH]** requieren el header:
```
Authorization: Bearer <token>
```

El token se obtiene en `POST /api/auth/login`. El payload decodificado contiene:
```json
{ "id": "<authId>", "role": "user" | "admin" }
```

Las rutas marcadas como **[ADMIN]** requieren `role = "admin"` además del token.

---

## Auth Service — :3000

### POST /api/auth/register
Registra un nuevo usuario normal.

**Body:**
```json
{ "email": "user@example.com", "password": "123456" }
```
**Respuesta 201:**
```json
{ "id": "...", "email": "user@example.com", "role": "user" }
```

---

### POST /api/auth/login
Inicia sesión y devuelve el JWT.

**Body:**
```json
{ "email": "user@example.com", "password": "123456" }
```
**Respuesta 200:**
```json
{ "token": "<jwt>" }
```

---

## User Service — :3001

### GET /api/users/me [AUTH]
Devuelve el perfil del usuario autenticado.

**Respuesta 200:**
```json
{
  "authId": "...",
  "email": "user@example.com",
  "name": "",
  "avatar": "default-avatar.png",
  "bio": "",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

### PUT /api/users/me [AUTH]
Actualiza el perfil del usuario autenticado.

**Body (todos opcionales):**
```json
{ "name": "Juan", "bio": "Amante de la comida", "avatar": "url-de-imagen" }
```
**Respuesta 200:** perfil actualizado.

---

## Restaurant Service — :3003

### GET /api/restaurants/categories
Devuelve la lista de categorías disponibles.

**Respuesta 200:**
```json
["Restaurante", "Café", "Bar", "Comida rápida", "Pub", "Patio de comidas", "Heladería", "Panadería"]
```

---

### GET /api/restaurants
Lista restaurantes. Si se envían coordenadas, busca por zona y aplica lógica cache-first (consulta OpenStreetMap si hay pocos resultados en la zona). Sin coordenadas, devuelve todos ordenados por score.

**Query params (opcionales):**
| Param      | Tipo   | Descripción                              |
|------------|--------|------------------------------------------|
| `lat`      | float  | Latitud del usuario                      |
| `lng`      | float  | Longitud del usuario                     |
| `radius`   | int    | Radio en metros (default: 2000)          |
| `category` | string | Filtrar por categoría en español         |

**Ejemplo:**
```
GET /api/restaurants?lat=-34.6037&lng=-58.3816&radius=2000&category=Café
```

**Respuesta 200:**
```json
[
  {
    "id": 1,
    "name": "La Trattoria",
    "description": "italian",
    "address": "Calle 123",
    "category": "Restaurante",
    "latitude": "-34.6037000",
    "longitude": "-58.3816000",
    "osm_id": null,
    "score": "4.50",
    "review_count": 12,
    "created_at": "..."
  }
]
```

> Los restaurantes se importan automáticamente desde OpenStreetMap la primera vez que un usuario consulta una zona. Subsequent requests en la misma zona usan la caché local.

---

### GET /api/restaurants/:id
Devuelve un restaurante por ID.

**Respuesta 200:** mismo schema del array anterior.
**Errores:** 404 si no existe.

---

## Review Service — :3004

### GET /api/reviews?restaurantId=1
Lista las reseñas visibles de un restaurante (excluye las ocultas por admin).

**Query param requerido:** `restaurantId` (número entero)

**Respuesta 200:**
```json
[
  {
    "id": 1,
    "restaurant_id": 1,
    "user_id": "<authId>",
    "stars": 5,
    "comment": "Excelente lugar",
    "upvotes": 3,
    "downvotes": 0,
    "hidden": false,
    "created_at": "...",
    "media": [
      { "id": 1, "review_id": 1, "url": "http://minio:9000/media/uuid.jpg", "media_type": "image", "filename": "uuid.jpg", "created_at": "..." }
    ]
  }
]
```

---

### POST /api/reviews [AUTH]
Crea una reseña para un restaurante. Las imágenes/videos se suben primero al media-service vía gRPC y se incluyen sus URLs aquí.

**Body:**
```json
{
  "restaurantId": 1,
  "stars": 5,
  "comment": "Muy buena comida",
  "media": [
    { "url": "http://minio:9000/media/uuid.jpg", "media_type": "image", "filename": "uuid.jpg" },
    { "url": "http://minio:9000/media/uuid.mp4", "media_type": "video", "filename": "uuid.mp4" }
  ]
}
```
- `stars`: entero entre 1 y 5 (requerido)
- `comment`: texto libre (opcional)
- `media`: array opcional, cada item requiere `url` y `media_type` (`"image"` o `"video"`), `filename` es opcional

**Respuesta 201:**
```json
{
  "id": 1,
  "restaurant_id": 1,
  "user_id": "...",
  "stars": 5,
  "comment": "Muy buena comida",
  "upvotes": 0,
  "downvotes": 0,
  "hidden": false,
  "created_at": "...",
  "media": [
    { "id": 1, "review_id": 1, "url": "...", "media_type": "image", "filename": "uuid.jpg", "created_at": "..." }
  ]
}
```

> Al crear, el restaurant-service recibe el evento y actualiza el `score` automáticamente.

---

### POST /api/reviews/:id/vote [AUTH]
Vota una reseña. Un usuario solo puede tener un voto por reseña (cambia si vota diferente).

**Body:**
```json
{ "voteType": "up" }
```
- `voteType`: `"up"` o `"down"`

**Respuesta 200:** reseña con `upvotes` y `downvotes` actualizados.

---

### POST /api/reviews/:id/report [AUTH]
Reporta una reseña como inapropiada. Un usuario solo puede reportar una vez por reseña.

**Body (opcional):**
```json
{ "reason": "Contenido ofensivo" }
```
**Respuesta 200:** `{ "message": "Reseña reportada" }`

---

### GET /api/reviews/reported [ADMIN]
Devuelve todas las reseñas que tienen al menos un reporte, ordenadas por cantidad de reportes.

**Respuesta 200:**
```json
[
  {
    "id": 3,
    "restaurant_id": 1,
    "user_id": "...",
    "stars": 1,
    "comment": "...",
    "hidden": false,
    "report_count": "5",
    "created_at": "..."
  }
]
```

---

### PATCH /api/reviews/:id/hide [ADMIN]
Oculta una reseña (soft delete, reversible desde la DB).

**Respuesta 200:** objeto reseña con `hidden: true`.

---

### DELETE /api/reviews/:id [ADMIN]
Elimina permanentemente una reseña y sus votos/reportes asociados.

**Respuesta 200:** `{ "message": "Reseña eliminada" }`

---

## Media Service — :50051 (gRPC)

**Proto:** `media.MediaService`

### RPC: UploadMedia (client streaming)
El cliente envía el archivo en chunks y recibe una respuesta única.

**MediaChunk (enviar uno o más):**
```protobuf
message MediaChunk {
  bytes data = 1;          // contenido binario del chunk
  string filename = 2;     // nombre del archivo (ej: "foto.jpg")
  string content_type = 3; // MIME type (ej: "image/jpeg")
}
```

**UploadResponse:**
```protobuf
message UploadResponse {
  string url = 1;      // URL pública en MinIO
  string filename = 2; // nombre único generado (UUID + extensión)
}
```

> La URL resultante puede usarse como valor de `avatar` en `PUT /api/users/me`.

---

## Flujos principales

### Registro + perfil
1. `POST /api/auth/register` → crea usuario, emite evento RabbitMQ
2. user-service crea el perfil automáticamente al recibir el evento
3. `POST /api/auth/login` → obtiene JWT
4. `GET /api/users/me` con JWT → lee perfil

### Buscar restaurantes por zona
1. Obtener GPS del dispositivo (`lat`, `lng`)
2. `GET /api/restaurants?lat=X&lng=Y&category=Café`
3. Si es la primera vez en esa zona, el backend consulta OpenStreetMap automáticamente

### Crear reseña
1. Login → JWT
2. `GET /api/restaurants?lat=X&lng=Y` → obtener `id` del restaurante
3. `POST /api/reviews` con `restaurantId` y `stars`
4. El `score` del restaurante se actualiza automáticamente vía RabbitMQ

### Subir media y usarla de avatar
1. `UploadMedia` gRPC → recibir `url`
2. `PUT /api/users/me` con `{ "avatar": "<url>" }`

### Crear reseña con imágenes/videos
1. Por cada archivo: `UploadMedia` gRPC → recibir `{ url, filename }`
2. `POST /api/reviews` incluyendo el array `media` con las URLs obtenidas y su `media_type`

### Moderación (admin)
1. `GET /api/reviews/reported` → ver reseñas reportadas con conteo
2. `PATCH /api/reviews/:id/hide` → ocultar
3. `DELETE /api/reviews/:id` → eliminar permanentemente

---

## Notas para el frontend

- El `id` del JWT (`req.user.id`) es el `_id` de MongoDB del auth-service, y es el mismo valor que `authId` en user-service y `user_id` en reviews.
- El `score` del restaurante viene como string decimal de PostgreSQL (ej: `"4.50"`), parsear con `double.parse()` en Dart.
- El `report_count` en `/reported` también viene como string (`"5"`), parsear con `int.parse()`.
- Las reseñas ocultas (`hidden: true`) no aparecen en `GET /api/reviews` para usuarios normales.
- Las rutas de health check (`GET /api/*/health`) no requieren autenticación y devuelven `{ "status": "ok" }`.
- El campo `osm_id` es `null` para restaurantes creados manualmente y tiene valor para los importados de OpenStreetMap.
