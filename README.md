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

## Análisis de código estático (SonarQube)

El proyecto incluye una instancia local de **SonarQube Community Edition** para analizar
cada microservicio por separado.

### 1. Levantar SonarQube

```bash
docker compose -f docker-compose.sonar.yml up -d
```

La interfaz queda disponible en [http://localhost:9002](http://localhost:9002)
(usuario/clave inicial: `admin` / `admin`, se pedirá cambiarla en el primer ingreso).

> En Docker Desktop / WSL2 puede ser necesario aumentar `vm.max_map_count` (requerido por
> Elasticsearch):
>
> ```bash
> wsl -d docker-desktop -u root sysctl -w vm.max_map_count=524288
> ```

### 2. Generar un token

En SonarQube: **My Account > Security > Generate Token**. Este token se usa para autenticar
el análisis (no necesita crear los proyectos manualmente, se crean automáticamente en el
primer análisis gracias al `sonar.projectKey` definido en cada servicio).

### 3. Ejecutar el análisis por servicio

Cada microservicio tiene su propio `sonar-project.properties` (un proyecto independiente
en SonarQube). Para analizarlo, generar la cobertura con Jest y correr el scanner:

```powershell
./scripts/sonar-scan.ps1 -Service review-service -Token <TU_TOKEN>
```

Repetir para `auth-service`, `user-service`, `restaurant-service`, `media-service`,
`social-service` y `notification-service`.

### 4. Detener SonarQube

```bash
docker compose -f docker-compose.sonar.yml down      # conserva los datos
docker compose -f docker-compose.sonar.yml down -v   # borra los datos (volúmenes)
```

---

## Instalación

Clonar el repositorio:

```bash
git clone <repository-url>
cd API-Reviews
