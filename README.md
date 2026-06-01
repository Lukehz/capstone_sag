# 🌿 LandMosaic Vision

**Plataforma web de monitoreo fitosanitario para el SAG (Servicio Agrícola y Ganadero).**
Permite visualizar, registrar y gestionar parcelaciones agrícolas y zonas de cuarentena sobre un mapa interactivo, con control de acceso por roles, panel de estadísticas, bitácora de accesos y un módulo de análisis de imágenes con inteligencia artificial.

---

## 📖 Descripción general

LandMosaic Vision centraliza en un solo lugar la información territorial y fitosanitaria que el SAG necesita para tomar decisiones: dónde están las parcelas, qué se cultiva, qué zonas están bajo cuarentena (vigente o levantada) y quién accede al sistema.

Todo gira en torno a un **mapa interactivo** (Mapbox) donde se dibujan las parcelas y las cuarentenas, y desde el cual el usuario puede filtrar capas, buscar lugares, trazar rutas hacia un punto y crear nuevos registros. El resto de los apartados (datos maestros, dashboard, usuarios, roles, etc.) complementan esa vista principal.

El sistema es **multiusuario** y cada persona ve solo lo que su rol le permite, gracias a un control de acceso configurable desde la propia interfaz.

---

## 🧭 Apartados de la plataforma

### 🗺️ Mapa
La pantalla principal. Muestra:
- **Parcelaciones**, como marcadores diferenciados según si están registradas o no.
- **Cuarentenas**, dibujadas de dos formas: por **trazado** (un polígono que delimita la zona) o por **radio** (un círculo alrededor de un punto). Se distinguen las **activas** (vigentes) de las **inactivas** (levantadas).
- Controles para **filtrar capas** (mostrar/ocultar parcelas, cuarentenas, etc.), un **buscador de lugares y coordenadas**, un **selector de capa base** (satélite, calles, terreno) y la opción **"Ir a"**, que traza una ruta desde tu ubicación hasta una parcela o cuarentena elegida.
- Si tu rol lo permite, puedes **crear cuarentenas** (dibujándolas en el mapa) y **registrar parcelaciones** directamente.

### 🌱 Parcelaciones
Registro y administración de las parcelas: ubicación, comuna, cultivo, fase y estado de registro.

### ⚠️ Cuarentenas
Gestión de las zonas de cuarentena, incluyendo **activarlas y desactivarlas** (declarar o levantar una cuarentena), acción reservada a los roles con permiso para ello.

### 🗂️ Datos maestros
Catálogos que alimentan al resto del sistema: **sectores/comunas, cultivos y fases**. Mantenerlos al día asegura que los formularios y filtros tengan opciones correctas.

### 📊 Dashboard
Panel de control con indicadores y gráficos: total de parcelaciones y cuarentenas, distribución por cultivo, por región y por fase, evolución mensual, y —para administradores— estadísticas de usuarios y un **resumen de accesos** (ingresos del día, intentos fallidos, etc.).

### 🔍 Predicción de imágenes
Módulo de análisis con un **modelo YOLO** entrenado: se sube una imagen y el sistema la procesa para detectar y resaltar elementos de interés, devolviendo el resultado anotado.

### 👥 Usuarios
Alta, edición y baja de usuarios del sistema, con asignación de rol. Disponible solo para administradores.

### 🛡️ Roles
Gestión completa del control de acceso: crear, editar y eliminar roles y definir, **apartado por apartado**, qué puede hacer cada uno. Solo para administradores.

### 🧾 Bitácora de accesos
Registro de **quién entra y sale del sistema**: ingresos, cierres de sesión e intentos fallidos, con usuario, rol, IP, navegador y fecha. Es de **solo lectura** y sirve para auditoría y seguridad.

> ℹ️ Internamente existe además un **historial** de parcelaciones (altas, ediciones y eliminaciones) que funciona como control de versiones en la base de datos. No es una pantalla de usuario: alimenta la actividad reciente que se ve en el Dashboard.

---

## 🔐 Control de acceso por roles (RBAC)

El acceso no está "quemado" en el código: se define en la base de datos y se administra desde el apartado **Roles**. El modelo se basa en tres piezas:

- **Apartados:** cada sección de la plataforma (mapa, parcelaciones, cuarentenas, etc.).
- **Niveles de acceso por apartado:**
  - **Sin acceso** — no lo ve.
  - **Ver** — solo consulta.
  - **Ver + editar** — consulta y modifica.
- **Capacidades especiales:** acciones sensibles que se otorgan aparte, como *activar/desactivar cuarentenas*, *ejecutar la predicción* o *eliminar registros*.

El sistema trae cinco roles predefinidos, pensados para los distintos perfiles de trabajo:

| Rol | Enfoque |
|-----|---------|
| **Administrador** | Control total, incluida la gestión de usuarios y roles. |
| **Supervisor** | Decisiones fitosanitarias: declara y levanta cuarentenas. |
| **Inspector** | Trabajo de campo: registra parcelaciones y ejecuta predicciones. |
| **Analista** | Consulta amplia para fiscalización y reportes, sin modificar. |
| **Lectura** | Acceso básico, solo al mapa. |

El menú lateral y cada ruta del servidor se muestran/protegen automáticamente según los permisos del rol del usuario, que se cargan al iniciar sesión.

---

## ⚙️ Cómo funciona

1. **Inicio de sesión:** el usuario ingresa con sus credenciales. Las contraseñas se guardan cifradas (bcrypt). El intento (exitoso o fallido) queda registrado en la bitácora.
2. **Carga de permisos:** al autenticarse, el sistema consulta en la base de datos los permisos del rol del usuario y los guarda en la sesión. Con eso arma el menú y habilita o bloquea cada sección.
3. **Navegación:** la vista central es el mapa; desde el menú se accede al resto de los apartados. Cada página se renderiza en el servidor (EJS) y el comportamiento dinámico (mapa, dropdowns, gráficos) corre en el navegador.
4. **Datos:** toda la información (parcelas, cuarentenas, usuarios, accesos, etc.) vive en una base de datos **Azure SQL**, a la que el servidor accede mediante consultas parametrizadas.
5. **Cierre de sesión:** queda registrado en la bitácora y se destruye la sesión.

---

## 🧰 Tecnologías

**Backend**
- Node.js + Express
- EJS + express-ejs-layouts (renderizado en el servidor)
- express-session (sesiones) y bcryptjs (cifrado de contraseñas)
- mssql (conexión a Azure SQL Server)
- multer / sharp / jimp (carga y procesamiento de imágenes)

**Frontend**
- JavaScript modular (sin framework), HTML y un sistema de diseño en CSS con variables y **tema claro/oscuro**
- Mapbox GL JS + plugins de Direcciones y Geocodificación
- Chart.js (gráficos del dashboard)
- Font Awesome y tipografía DM Sans

**Inteligencia artificial**
- Modelo **YOLO** (Python) para el análisis de imágenes

**Base de datos**
- Microsoft **Azure SQL**

---

## 📁 Estructura del proyecto

```
capstone_sag/
├─ server.js                 # Punto de entrada (conecta a la BDD y levanta el servidor)
├─ server/
│  ├─ app.js                 # Configuración de Express, sesiones, rutas y middlewares
│  ├─ config/                # Conexión a la BDD (db.js) y migraciones (migrate.js)
│  ├─ Routes/                # Definición de rutas (API y páginas)
│  ├─ controllers/           # Lógica de cada recurso
│  ├─ Middlewares/           # RBAC y autenticación (permisos.js)
│  ├─ utils/                 # Utilidades (p. ej. registro de accesos)
│  ├─ views/                 # Plantillas EJS (layout + cada apartado)
│  ├─ scriptsPy/             # Script de predicción YOLO
│  └─ modeloYOLO/            # Modelo entrenado (best.pt)
└─ public/
   ├─ js/                    # JS del cliente (mapa, dropdowns, dashboard, etc.)
   └─ styles/app.css         # Sistema de diseño (tokens + tema claro/oscuro)
```

---

## 🚀 Instalación y ejecución local

**Requisitos:** Node.js 18+ y una base de datos Azure SQL accesible. (El módulo de predicción requiere además Python con el modelo YOLO; es opcional.)

1. **Clonar e instalar dependencias**
   ```bash
   git clone https://github.com/Lukehz/capstone_sag.git
   cd capstone_sag
   npm install
   ```

2. **Configurar variables de entorno:** copia la plantilla y completa tus valores.
   ```bash
   cp .env.example .env
   ```

3. **Preparar la base de datos** (crea tablas, catálogos y datos base; es idempotente):
   ```bash
   npm run migrate
   ```

4. **Iniciar el servidor**
   ```bash
   npm start
   ```
   La aplicación queda disponible en `http://localhost:3000`.

---

## 🔑 Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto local (por defecto 3000). |
| `NODE_ENV` | `development` o `production`. |
| `SESSION_SECRET` | Clave para firmar las sesiones (usa una cadena larga y aleatoria). |
| `COOKIE_SECURE` | `true` solo si se sirve por HTTPS detrás de proxy. |
| `DB_USER`, `DB_PASSWORD` | Credenciales de la base de datos. |
| `DB_SERVER`, `DB_DATABASE` | Servidor y nombre de la base Azure SQL. |
| `DB_ENCRYPT`, `DB_TRUST_SERVER_CERTIFICATE` | Opciones de conexión segura (`true`). |
| `MAPBOX_TOKEN` | Token **público** (`pk.`) de Mapbox para el mapa. |

> El archivo `.env` real no se sube al repositorio (está en `.gitignore`); usa `.env.example` como referencia.

---

## 📜 Scripts disponibles

| Comando | Acción |
|---------|--------|
| `npm start` | Inicia el servidor. |
| `npm run migrate` | Crea/actualiza el esquema y los datos base en la BDD. |

---

## ☁️ Despliegue

La aplicación es un servidor Express persistente, por lo que funciona bien en plataformas que mantienen el proceso activo (por ejemplo **Render** o **Azure App Service**). Basta con configurar las mismas variables de entorno, usar `node server.js` como comando de inicio y permitir el acceso del servicio al firewall de Azure SQL.

---

## ✨ Qué tiene de bueno

- **Todo en un mapa:** parcelas y cuarentenas se ven y se gestionan sobre el territorio real, no en tablas frías.
- **Permisos flexibles y sin tocar código:** los roles y lo que puede hacer cada uno se configuran desde la interfaz; el menú y las rutas se adaptan solos.
- **Seguridad y trazabilidad:** contraseñas cifradas, control de acceso en cada ruta y una bitácora que registra quién entra, sale o falla al ingresar.
- **Información lista para decidir:** el dashboard resume el estado del territorio y la actividad del sistema de un vistazo.
- **Experiencia cuidada:** interfaz coherente con tema claro/oscuro, buscador, selector de capas, avisos y diálogos propios.
- **Datos consistentes:** catálogos maestros centralizados y un historial interno que actúa como control de versiones de las parcelaciones.
- **Valor agregado con IA:** análisis de imágenes mediante un modelo YOLO entrenado.

---

> Proyecto de título (capstone) desarrollado para el monitoreo fitosanitario del SAG.