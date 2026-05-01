# FoodRanker Backend

Backend de **FoodRanker**, una aplicación de reseñas de restaurantes donde los usuarios pueden consultar restaurantes, publicar opiniones, calificar experiencias y recibir notificaciones relacionadas con la actividad dentro de la plataforma.

El proyecto está organizado en servicios independientes para separar responsabilidades y facilitar el mantenimiento del sistema.

---

## Tecnologías principales

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT
- RabbitMQ
- Firebase Cloud Messaging
- Jest
- Supertest
- Docker

---

## Servicios del backend

El backend está compuesto por los siguientes servicios:

- **auth-service**: autenticación, login, registro y manejo de tokens.
- **user-service**: gestión de usuarios y perfiles.
- **restaurant-service**: administración y consulta de restaurantes.
- **review-service**: creación y consulta de reseñas.
- **media-service**: manejo de archivos e imágenes.
- **notification-service**: envío de notificaciones.

---

## Instalación

Clonar el repositorio:

```bash
git clone <repository-url>
cd API-Reviews
