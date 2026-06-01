/**
 * migrate.js
 * --------------------------------------------------------------------------
 * Crea (y opcionalmente puebla) toda la base de datos del proyecto capstone_sag
 * en SQL Server / Azure SQL, usando las credenciales del archivo .env.
 *
 * Uso:
 *   node server/config/migrate.js            -> crea lo que falte (no borra datos)
 *   node server/config/migrate.js --reset    -> ELIMINA todo y lo recrea de cero
 *
 * Notas:
 *  - Las tablas se crean solo si no existen (IF OBJECT_ID ... IS NULL).
 *  - Vistas, procedimiento y trigger usan CREATE OR ALTER (re-ejecutable).
 *  - Los INSERT de datos solo corren si la tabla está vacía (IF NOT EXISTS).
 *  - Los usuarios se guardan con la contraseña HASHEADA (bcrypt). El texto
 *    plano queda solo como referencia comentada más abajo.
 * --------------------------------------------------------------------------
 */

require('dotenv').config();
const sql = require('mssql');
const bcrypt = require('bcryptjs');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: (process.env.DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: (process.env.DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true'
  }
};

// Activar el borrado total con: node server/config/migrate.js --reset
const RESET = process.argv.includes('--reset') || process.env.MIGRATE_RESET === 'true';

// ---------------------------------------------------------------------------
// Credenciales semilla (texto plano SOLO de referencia; se guardan hasheadas)
//   admin -> usuario: "admin"  contraseña: "admin123"
//   user  -> usuario: "user"   contraseña: "user123"
// ---------------------------------------------------------------------------
const ADMIN_PASSWORD = 'admin123';
const USER_PASSWORD  = 'user123';

// ===========================================================================
//  0) Borrado opcional (--reset). Orden inverso a las dependencias (FK).
// ===========================================================================
const DROP_SQL = `
DROP VIEW IF EXISTS dbo.VW_usuario;
DROP VIEW IF EXISTS dbo.VW_sector;
DROP VIEW IF EXISTS dbo.VW_sector_completo;
DROP VIEW IF EXISTS dbo.VW_provincia;
DROP VIEW IF EXISTS dbo.VW_parcelacion;
DROP VIEW IF EXISTS dbo.VW_listado_region_provincia;
DROP VIEW IF EXISTS dbo.VW_Historial;
DROP VIEW IF EXISTS dbo.VW_cuarentena;
DROP VIEW IF EXISTS dbo.VW_conexiones_cuarentena;
DROP TRIGGER IF EXISTS TRG_historial_parcelacion;
DROP PROCEDURE IF EXISTS sp_CrearConexionesCuarentena;
DROP TABLE IF EXISTS dbo.conexion;
DROP TABLE IF EXISTS dbo.vertice;
DROP TABLE IF EXISTS dbo.parcelacion;
DROP TABLE IF EXISTS dbo.historial;
DROP TABLE IF EXISTS dbo.cuarentena;
DROP TABLE IF EXISTS dbo.sector;
DROP TABLE IF EXISTS dbo.provincia;
DROP TABLE IF EXISTS dbo.region;
DROP TABLE IF EXISTS dbo.cultivo;
DROP TABLE IF EXISTS dbo.fase;
DROP TABLE IF EXISTS dbo.usuario;
DROP TABLE IF EXISTS dbo.rol_apartado_permiso;
DROP TABLE IF EXISTS dbo.rol_capacidad;
DROP TABLE IF EXISTS dbo.rol;
DROP TABLE IF EXISTS dbo.apartado;
DROP TABLE IF EXISTS dbo.capacidad;
DROP TABLE IF EXISTS dbo.nivel_acceso;
`;

// ===========================================================================
//  Lista de "batches" (cada CREATE VIEW/PROCEDURE/TRIGGER debe ir en su
//  propio batch porque SQL Server exige que sea la primera sentencia).
// ===========================================================================
const batches = [];

// ---- 1) Tablas -----------------------------------------------------------
batches.push({ label: 'tablas', sql: `
IF OBJECT_ID('dbo.region','U') IS NULL
CREATE TABLE region (
    id_region INT NOT NULL IDENTITY(1,1),
    nombre    NVARCHAR(50) NOT NULL,
    numero    NVARCHAR(5)  NOT NULL,
    CONSTRAINT region_pk PRIMARY KEY (id_region)
);

IF OBJECT_ID('dbo.provincia','U') IS NULL
CREATE TABLE provincia (
    id_provincia INT NOT NULL IDENTITY(1,1),
    nombre       NVARCHAR(100) NOT NULL,
    id_region    INT NOT NULL,
    CONSTRAINT provincia_pk PRIMARY KEY (id_provincia),
    CONSTRAINT provincia_region_fk FOREIGN KEY (id_region) REFERENCES region (id_region)
);

IF OBJECT_ID('dbo.sector','U') IS NULL
CREATE TABLE sector (
    id_sector    INT NOT NULL IDENTITY(1,1),
    comuna       NVARCHAR(80) NOT NULL,
    id_provincia INT NOT NULL,
    CONSTRAINT sector_pk PRIMARY KEY (id_sector),
    CONSTRAINT sector_provincia_fk FOREIGN KEY (id_provincia) REFERENCES provincia (id_provincia)
);

IF OBJECT_ID('dbo.cuarentena','U') IS NULL
CREATE TABLE cuarentena (
    id_cuarentena INT NOT NULL IDENTITY(1,1),
    latitud       FLOAT,
    longitud      FLOAT,
    radio         FLOAT,
    id_sector     INT NOT NULL,
    comentario    NVARCHAR(200),
    activa        BIT NOT NULL CONSTRAINT DF_cuarentena_activa DEFAULT 1,  -- bandera activa/inactiva
    CONSTRAINT cuarentena_pk PRIMARY KEY (id_cuarentena),
    CONSTRAINT cuarentena_sector_fk FOREIGN KEY (id_sector) REFERENCES sector (id_sector)
);

IF OBJECT_ID('dbo.vertice','U') IS NULL
CREATE TABLE vertice (
    id_vertice    INT NOT NULL IDENTITY(1,1),
    id_cuarentena INT NOT NULL,
    latitud       FLOAT NOT NULL,
    longitud      FLOAT NOT NULL,
    orden         INT NOT NULL,
    CONSTRAINT vertice_pk PRIMARY KEY (id_vertice),
    FOREIGN KEY (id_cuarentena) REFERENCES cuarentena(id_cuarentena) ON DELETE CASCADE
);

IF OBJECT_ID('dbo.conexion','U') IS NULL
CREATE TABLE conexion (
    id_conexion       INT NOT NULL IDENTITY(1,1),
    id_cuarentena     INT NOT NULL,
    verticeInicial_id INT NOT NULL,
    verticeFinal_id   INT NOT NULL,
    CONSTRAINT conexion_pk PRIMARY KEY (id_conexion),
    FOREIGN KEY (id_cuarentena)     REFERENCES cuarentena(id_cuarentena) ON DELETE CASCADE,
    FOREIGN KEY (verticeInicial_id) REFERENCES vertice(id_vertice)       ON DELETE NO ACTION,
    FOREIGN KEY (verticeFinal_id)   REFERENCES vertice(id_vertice)       ON DELETE NO ACTION
);

IF OBJECT_ID('dbo.cultivo','U') IS NULL
CREATE TABLE cultivo (
    id_cultivo INT NOT NULL IDENTITY(1,1),
    nombre     NVARCHAR(100) NOT NULL,
    CONSTRAINT cultivo_pk PRIMARY KEY (id_cultivo)
);

IF OBJECT_ID('dbo.fase','U') IS NULL
CREATE TABLE fase (
    id_fase INT NOT NULL IDENTITY(1,1),
    nombre  NVARCHAR(100) NOT NULL,
    CONSTRAINT fase_pk PRIMARY KEY (id_fase)
);

IF OBJECT_ID('dbo.parcelacion','U') IS NULL
CREATE TABLE parcelacion (
    id_parcelacion INT NOT NULL IDENTITY(1,1),
    latitud        FLOAT NOT NULL,
    longitud       FLOAT NOT NULL,
    imagen         VARBINARY(MAX) NULL,
    id_sector      INT NOT NULL,
    id_fase        INT NOT NULL,
    id_cultivo     INT NOT NULL,
    registrada     BIT NOT NULL,
    CONSTRAINT parcelacion_pk PRIMARY KEY (id_parcelacion),
    CONSTRAINT parcelacion_cultivo_fk FOREIGN KEY (id_cultivo) REFERENCES cultivo (id_cultivo),
    CONSTRAINT parcelacion_fase_fk    FOREIGN KEY (id_fase)    REFERENCES fase (id_fase),
    CONSTRAINT parcelacion_sector_fk  FOREIGN KEY (id_sector)  REFERENCES sector (id_sector)
);

IF OBJECT_ID('dbo.historial','U') IS NULL
CREATE TABLE historial (
    id_historial   INT NOT NULL IDENTITY(1,1),
    nombre         NVARCHAR(50) NOT NULL,
    accion         NVARCHAR(50) NOT NULL,
    fecha          DATE NOT NULL,
    hora           TIME NOT NULL,
    id_parcelacion INT,
    latitud        FLOAT NOT NULL,
    longitud       FLOAT NOT NULL,
    imagen         VARBINARY(MAX),
    id_sector      INT,
    id_fase        INT,
    id_cultivo     INT,
    registrada     INT,
    CONSTRAINT historial_pk PRIMARY KEY (id_historial)
);

IF OBJECT_ID('dbo.usuario','U') IS NULL
CREATE TABLE usuario (
    id_usuario INT NOT NULL IDENTITY(1,1),
    correo     NVARCHAR(50),
    password   NVARCHAR(255),   -- ampliado: un hash bcrypt ocupa 60 caracteres
    usuario    NVARCHAR(30) NOT NULL,
    rut        INT NOT NULL,
    dv_rut     CHAR(1) NOT NULL,
    nombre     NVARCHAR(30) NOT NULL,
    apellido   NVARCHAR(30) NOT NULL,
    rol        NVARCHAR(50) NOT NULL,
    tema       NVARCHAR(10) NOT NULL CONSTRAINT DF_usuario_tema DEFAULT 'light',  -- preferencia de tema
    CONSTRAINT usuario_pk PRIMARY KEY (id_usuario)
);

IF OBJECT_ID('dbo.nivel_acceso','U') IS NULL
CREATE TABLE nivel_acceso (
    id_nivel    INT NOT NULL IDENTITY(1,1),
    codigo      NVARCHAR(5)   NOT NULL,   -- 'N', 'L', 'A'
    nombre      NVARCHAR(30)  NOT NULL,   -- 'Sin acceso', 'Lectura', 'Acción'
    descripcion NVARCHAR(120) NOT NULL,   -- texto explicativo
    CONSTRAINT nivel_acceso_pk PRIMARY KEY (id_nivel),
    CONSTRAINT nivel_acceso_codigo_uq UNIQUE (codigo)
);

IF OBJECT_ID('dbo.rol','U') IS NULL
CREATE TABLE rol (
    id_rol      INT NOT NULL IDENTITY(1,1),
    codigo      NVARCHAR(30)  NOT NULL,
    nombre      NVARCHAR(60)  NOT NULL,
    descripcion NVARCHAR(160) NULL,
    CONSTRAINT rol_pk PRIMARY KEY (id_rol),
    CONSTRAINT rol_codigo_uq UNIQUE (codigo)
);

IF OBJECT_ID('dbo.apartado','U') IS NULL
CREATE TABLE apartado (
    id_apartado INT NOT NULL IDENTITY(1,1),
    codigo      NVARCHAR(30) NOT NULL,
    nombre      NVARCHAR(60) NOT NULL,
    orden       INT NOT NULL CONSTRAINT DF_apartado_orden DEFAULT 0,
    CONSTRAINT apartado_pk PRIMARY KEY (id_apartado),
    CONSTRAINT apartado_codigo_uq UNIQUE (codigo)
);

IF OBJECT_ID('dbo.capacidad','U') IS NULL
CREATE TABLE capacidad (
    id_capacidad INT NOT NULL IDENTITY(1,1),
    codigo       NVARCHAR(40)  NOT NULL,
    nombre       NVARCHAR(100) NOT NULL,
    CONSTRAINT capacidad_pk PRIMARY KEY (id_capacidad),
    CONSTRAINT capacidad_codigo_uq UNIQUE (codigo)
);

IF OBJECT_ID('dbo.rol_apartado_permiso','U') IS NULL
CREATE TABLE rol_apartado_permiso (
    id_rol      INT NOT NULL,
    id_apartado INT NOT NULL,
    id_nivel    INT NOT NULL,
    CONSTRAINT rap_pk PRIMARY KEY (id_rol, id_apartado),
    CONSTRAINT rap_rol_fk      FOREIGN KEY (id_rol)      REFERENCES rol(id_rol) ON DELETE CASCADE,
    CONSTRAINT rap_apartado_fk FOREIGN KEY (id_apartado) REFERENCES apartado(id_apartado) ON DELETE CASCADE,
    CONSTRAINT rap_nivel_fk    FOREIGN KEY (id_nivel)    REFERENCES nivel_acceso(id_nivel)
);

IF OBJECT_ID('dbo.rol_capacidad','U') IS NULL
CREATE TABLE rol_capacidad (
    id_rol       INT NOT NULL,
    id_capacidad INT NOT NULL,
    CONSTRAINT rol_capacidad_pk PRIMARY KEY (id_rol, id_capacidad),
    CONSTRAINT rc_rol_fk FOREIGN KEY (id_rol)       REFERENCES rol(id_rol) ON DELETE CASCADE,
    CONSTRAINT rc_cap_fk FOREIGN KEY (id_capacidad) REFERENCES capacidad(id_capacidad) ON DELETE CASCADE
);
`});

// ---- 1b) Columnas de auditoría: fecha de creación y actualización --------
//  Idempotente: solo agrega lo que falte. La creación se llena con DEFAULT al
//  insertar; la actualización la mantiene un trigger AFTER UPDATE por tabla.
batches.push({ label: 'columnas de fecha (auditoría)', sql: `
IF COL_LENGTH('dbo.parcelacion','fecha_creacion') IS NULL
    ALTER TABLE dbo.parcelacion ADD fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_parcelacion_fcrea DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.parcelacion','fecha_actualizacion') IS NULL
    ALTER TABLE dbo.parcelacion ADD fecha_actualizacion DATETIME2(0) NULL;

IF COL_LENGTH('dbo.cuarentena','fecha_creacion') IS NULL
    ALTER TABLE dbo.cuarentena ADD fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_cuarentena_fcrea DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.cuarentena','fecha_actualizacion') IS NULL
    ALTER TABLE dbo.cuarentena ADD fecha_actualizacion DATETIME2(0) NULL;

IF COL_LENGTH('dbo.usuario','fecha_creacion') IS NULL
    ALTER TABLE dbo.usuario ADD fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_usuario_fcrea DEFAULT SYSUTCDATETIME();
IF COL_LENGTH('dbo.usuario','fecha_actualizacion') IS NULL
    ALTER TABLE dbo.usuario ADD fecha_actualizacion DATETIME2(0) NULL;
`});

batches.push({ label: 'triggers de fecha_actualizacion', sql: `
IF OBJECT_ID('dbo.TR_parcelacion_fecha_upd','TR') IS NULL
    EXEC('CREATE TRIGGER dbo.TR_parcelacion_fecha_upd ON dbo.parcelacion AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE p SET fecha_actualizacion = SYSUTCDATETIME() FROM dbo.parcelacion p INNER JOIN inserted i ON p.id_parcelacion = i.id_parcelacion; END');
IF OBJECT_ID('dbo.TR_cuarentena_fecha_upd','TR') IS NULL
    EXEC('CREATE TRIGGER dbo.TR_cuarentena_fecha_upd ON dbo.cuarentena AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE c SET fecha_actualizacion = SYSUTCDATETIME() FROM dbo.cuarentena c INNER JOIN inserted i ON c.id_cuarentena = i.id_cuarentena; END');
IF OBJECT_ID('dbo.TR_usuario_fecha_upd','TR') IS NULL
    EXEC('CREATE TRIGGER dbo.TR_usuario_fecha_upd ON dbo.usuario AFTER UPDATE AS BEGIN SET NOCOUNT ON; UPDATE u SET fecha_actualizacion = SYSUTCDATETIME() FROM dbo.usuario u INNER JOIN inserted i ON u.id_usuario = i.id_usuario; END');
`});

// ---- 2) Vistas (cada una en su propio batch) -----------------------------
batches.push({ label: 'vista VW_conexiones_cuarentena', sql: `
CREATE OR ALTER VIEW [dbo].[VW_conexiones_cuarentena] AS
SELECT co.id_conexion, c.id_cuarentena, i.latitud AS latitud_INI, i.longitud AS longitud_INI,
       e.latitud AS latitud_END, e.longitud AS longitud_END, i.orden AS ORDEN
FROM cuarentena c
INNER JOIN conexion co ON co.id_cuarentena = c.id_cuarentena
INNER JOIN (
    SELECT v.latitud, v.longitud, c.id_conexion, V.orden
    FROM vertice v INNER JOIN conexion c ON v.id_vertice = c.verticeInicial_id
) AS i ON i.id_conexion = co.id_conexion
INNER JOIN (
    SELECT v.latitud, v.longitud, c.id_conexion
    FROM vertice v INNER JOIN conexion c ON v.id_vertice = c.verticeFinal_id
) AS e ON e.id_conexion = co.id_conexion;
`});

batches.push({ label: 'vista VW_cuarentena', sql: `
CREATE OR ALTER VIEW [dbo].[VW_cuarentena] AS
SELECT a.id_cuarentena AS id, b.comuna AS sector, a.latitud, a.longitud,
       coalesce(CAST(radio AS nvarchar),'Trazado') AS 'radio(Metros)', a.comentario AS motivo,
       a.activa
FROM cuarentena a LEFT JOIN sector b ON (a.id_sector = b.id_sector);
`});

batches.push({ label: 'vista VW_Historial', sql: `
CREATE OR ALTER VIEW [dbo].[VW_Historial] AS
SELECT a.id_historial AS id,
       a.nombre AS tabla,
       a.id_parcelacion AS "ID Parcelacion",
       a.accion,
       concat(a.fecha,' ',FORMAT(a.hora, 'hh\\:mm\\:ss')) AS Fecha,
       CONCAT(a.latitud, ' , ', a.longitud) AS Coordenadas,
       b.comuna AS Sector,
       c.nombre AS Fase,
       d.nombre AS Cultivo,
       CASE a.registrada WHEN 1 THEN 'Registrada' WHEN 0 THEN 'No registrada' END AS Registrada
FROM historial a
LEFT JOIN sector b  ON (a.id_sector = b.id_sector)
LEFT JOIN fase c    ON (a.id_fase = c.id_fase)
LEFT JOIN cultivo d ON (d.id_cultivo = a.id_cultivo);
`});

batches.push({ label: 'vista VW_listado_region_provincia', sql: `
CREATE OR ALTER VIEW [dbo].[VW_listado_region_provincia] AS
SELECT b.id_region, a.id_provincia, CONCAT(b.nombre, ', ', a.nombre) AS provincia
FROM provincia a LEFT JOIN region b ON (a.id_region = b.id_region);
`});

batches.push({ label: 'vista VW_parcelacion', sql: `
CREATE OR ALTER VIEW [dbo].[VW_parcelacion] AS
SELECT p.id_parcelacion AS ID,
       p.latitud AS latitud, p.longitud AS longitud,
       f.nombre AS Fase,
       c.nombre AS Cultivo,
       s.comuna AS Comuna,
       CASE p.registrada WHEN 1 THEN 'Registrada' WHEN 0 THEN 'No Registrada' ELSE null END AS Registrada
FROM parcelacion p
LEFT JOIN sector s  ON (p.id_sector = s.id_sector)
LEFT JOIN fase f    ON (p.id_fase = f.id_fase)
LEFT JOIN cultivo c ON (p.id_cultivo = c.id_cultivo);
`});

batches.push({ label: 'vista VW_provincia', sql: `
CREATE OR ALTER VIEW [dbo].[VW_provincia] AS
SELECT a.id_provincia AS id, b.nombre AS region, a.nombre AS provincia
FROM provincia a LEFT JOIN region b ON (a.id_region = b.id_region);
`});

batches.push({ label: 'vista VW_sector_completo', sql: `
CREATE OR ALTER VIEW [dbo].[VW_sector_completo] AS
SELECT a.id_sector AS id, CONCAT(c.nombre, ', ', b.nombre) AS provincia, a.comuna AS comuna
FROM sector a
LEFT JOIN provincia b ON (a.id_provincia = b.id_provincia)
LEFT JOIN region c    ON (b.id_region = c.id_region);
`});

batches.push({ label: 'vista VW_sector', sql: `
CREATE OR ALTER VIEW [dbo].[VW_sector] AS
SELECT s.id_sector, CONCAT(r.nombre, ', ', s.comuna) AS Sector
FROM sector s
LEFT JOIN provincia p ON p.id_provincia = s.id_provincia
LEFT JOIN region r    ON r.id_region = p.id_region;
`});

batches.push({ label: 'vista VW_usuario', sql: `
CREATE OR ALTER VIEW [dbo].[VW_usuario] AS
SELECT id_usuario AS id,
       CONCAT(nombre, ' ', apellido) AS "Nombre Completo",
       REPLACE(FORMAT(rut, '##,###,###'), ',', '.') + '-' + dv_rut AS Rut,
       correo, rol, usuario, password
FROM usuario;
`});

// ---- 3) Procedimiento almacenado -----------------------------------------
batches.push({ label: 'procedimiento sp_CrearConexionesCuarentena', sql: `
CREATE OR ALTER PROCEDURE sp_CrearConexionesCuarentena
    @id_cuarentena INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @orden_max INT;
    DECLARE @num_vertices INT;

    SELECT @num_vertices = COUNT(*) FROM vertice WHERE id_cuarentena = @id_cuarentena;
    IF @num_vertices < 3
    BEGIN
        PRINT 'No hay suficientes vertices para formar un poligono.';
        RETURN;
    END

    SELECT @orden_max = MAX(orden) FROM vertice WHERE id_cuarentena = @id_cuarentena;

    ;WITH V AS (
        SELECT id_vertice, orden,
               LEAD(id_vertice) OVER (ORDER BY orden) AS siguiente_id_vertice
        FROM vertice
        WHERE id_cuarentena = @id_cuarentena
    )
    INSERT INTO conexion (id_cuarentena, verticeInicial_id, verticeFinal_id)
    SELECT @id_cuarentena, id_vertice, siguiente_id_vertice
    FROM V
    WHERE siguiente_id_vertice IS NOT NULL;

    INSERT INTO conexion (id_cuarentena, verticeInicial_id, verticeFinal_id)
    SELECT @id_cuarentena,
           (SELECT id_vertice FROM vertice WHERE id_cuarentena = @id_cuarentena AND orden = @orden_max),
           (SELECT id_vertice FROM vertice WHERE id_cuarentena = @id_cuarentena AND orden = 1);
END;
`});

// ---- 4) Trigger de historial sobre parcelacion ---------------------------
batches.push({ label: 'trigger TRG_historial_parcelacion', sql: `
CREATE OR ALTER TRIGGER TRG_historial_parcelacion
ON parcelacion
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    IF EXISTS (SELECT * FROM inserted) AND NOT EXISTS (SELECT * FROM deleted)
    BEGIN
        INSERT INTO historial (nombre, accion, fecha, hora, id_parcelacion, latitud, longitud, id_sector, id_fase, id_cultivo, registrada)
        SELECT 'Parcelacion', 'INSERT', CAST(SYSDATETIME() AS DATE), CAST(SYSDATETIME() AS TIME),
               i.id_parcelacion, i.latitud, i.longitud, i.id_sector, i.id_fase, i.id_cultivo, i.registrada
        FROM inserted i;
    END

    IF EXISTS (SELECT * FROM inserted) AND EXISTS (SELECT * FROM deleted)
    BEGIN
        INSERT INTO historial (nombre, accion, fecha, hora, id_parcelacion, latitud, longitud, id_sector, id_fase, id_cultivo, registrada)
        SELECT 'Parcelacion', 'UPDATE', CAST(SYSDATETIME() AS DATE), CAST(SYSDATETIME() AS TIME),
               i.id_parcelacion, i.latitud, i.longitud, i.id_sector, i.id_fase, i.id_cultivo, i.registrada
        FROM inserted i
        JOIN deleted d ON i.id_parcelacion = d.id_parcelacion
        WHERE i.latitud <> d.latitud OR i.longitud <> d.longitud OR i.id_sector <> d.id_sector
           OR i.id_fase <> d.id_fase OR i.id_cultivo <> d.id_cultivo OR i.registrada <> d.registrada;
    END

    IF EXISTS (SELECT * FROM deleted) AND NOT EXISTS (SELECT * FROM inserted)
    BEGIN
        INSERT INTO historial (nombre, accion, fecha, hora, id_parcelacion, latitud, longitud, id_sector, id_fase, id_cultivo, registrada)
        SELECT 'Parcelacion', 'DELETE', CAST(SYSDATETIME() AS DATE), CAST(SYSDATETIME() AS TIME),
               d.id_parcelacion, d.latitud, d.longitud, d.id_sector, d.id_fase, d.id_cultivo, d.registrada
        FROM deleted d;
    END
END;
`});

// ---- 5) Datos: regiones --------------------------------------------------
batches.push({ label: 'datos region', sql: `
IF NOT EXISTS (SELECT 1 FROM region)
BEGIN
    INSERT INTO region(nombre, numero) VALUES
      ('Región de Tarapacá', 'I'),
      ('Región de Antofagasta', 'II'),
      ('Región de Atacama', 'III'),
      ('Región de Coquimbo', 'IV'),
      ('Región de Valparaíso', 'V'),
      ('Región del Libertador General Bernardo O''Higgins', 'VI'),
      ('Región del Maule', 'VII'),
      ('Región del Bio-bío', 'VIII'),
      ('Región de La Araucanía', 'IX'),
      ('Región de Los Lagos', 'X'),
      ('Región Aysén del General Carlos Ibáñez del Campo', 'XI'),
      ('Región de Magallanes y Antártica Chilena', 'XII'),
      ('Región Metropolitana de Santiago', 'RM'),
      ('Región de Los Ríos', 'XIV'),
      ('Región de Arica y Parinacota', 'XV'),
      ('Región de Ñuble', 'XVI');
END
`});

// ---- 5) Datos: provincias (ORDEN EXACTO: las comunas dependen del id) -----
batches.push({ label: 'datos provincia', sql: `
IF NOT EXISTS (SELECT 1 FROM provincia)
BEGIN
    INSERT INTO provincia(nombre, id_region) VALUES
      ('Provincia de Iquique', 1),('Provincia del Tamarugal', 1),
      ('Provincia de Tocopilla', 2),('Provincia de El Loa', 2),('Provincia de Antofagasta', 2),
      ('Provincia de Chañaral', 3),('Provincia de Copiapó', 3),('Provincia de Huasco', 3),
      ('Provincia de Elqui', 4),('Provincia de Limarí', 4),('Provincia de Choapa', 4),
      ('Provincia de Petorca', 5),('Provincia de Los Andes', 5),('Provincia de San Felipe de Aconcagua', 5),
      ('Provincia de Quillota', 5),('Provincia de Valparaíso', 5),('Provincia de San Antonio', 5),
      ('Provincia de Isla de Pascua', 5),('Provincia de Marga Marga', 5),
      ('Provincia de Chacabuco', 13),('Provincia de Santiago', 13),('Provincia de Cordillera', 13),
      ('Provincia de Maipo', 13),('Provincia de Melipilla', 13),('Provincia de Talagante', 13),
      ('Provincia de Cachapoal', 6),('Provincia de Colchagua', 6),('Provincia de Cardenal Caro', 6),
      ('Provincia de Curicó', 7),('Provincia de Talca', 7),('Provincia de Linares', 7),('Provincia de Cauquenes', 7),
      ('Provincia de Diguillín', 16),('Provincia de Itata', 16),('Provincia de Punilla', 16),
      ('Provincia de Biobío', 8),('Provincia de Concepción', 8),('Provincia de Arauco', 8),
      ('Provincia de Malleco', 9),('Provincia de Cautín', 9),
      ('Provincia de Valdivia', 14),('Provincia del Ranco', 14),
      ('Provincia de Osorno', 10),('Provincia de Llanquihue', 10),('Provincia de Chiloé', 10),('Provincia de Palena', 10),
      ('Provincia de Coyhaique', 11),('Provincia de Aysén', 11),('Provincia General Carrera', 11),('Provincia Capitán Prat', 11),
      ('Provincia de Última Esperanza', 12),('Provincia de Magallanes', 12),('Provincia de Tierra del Fuego', 12),('Provincia Antártica Chilena', 12),
      ('Provincia de Arica', 15),('Provincia de Parinacota', 15);
END
`});

// ---- 5) Datos: sectores --------------------------------------------------
batches.push({ label: 'datos sector', sql: `
IF NOT EXISTS (SELECT 1 FROM sector)
BEGIN
    INSERT INTO sector(comuna, id_provincia) VALUES
      ('Puerto Octay', 43),('Purranque', 43),('Río Negro', 43),
      ('Los Muermos', 44),('Frutillar', 44),('Calbuco', 44),
      ('Castro', 45),('Ancud', 45),('Dalcahue', 45),
      ('Chaiten', 46),('Hualaihue', 46),('Futaleufu', 46);
END
`});

// ---- 5) Datos: cultivos --------------------------------------------------
batches.push({ label: 'datos cultivo', sql: `
IF NOT EXISTS (SELECT 1 FROM cultivo)
BEGIN
    INSERT INTO cultivo(nombre) VALUES
      ('Trigo'),('Papa'),('Maíz'),('Arroz'),('Soja'),('Cebada'),('Tomate'),('Zanahoria');
END
`});

// ---- 5) Datos: fases -----------------------------------------------------
batches.push({ label: 'datos fase', sql: `
IF NOT EXISTS (SELECT 1 FROM fase)
BEGIN
    INSERT INTO fase(nombre) VALUES
      ('Arado'),('Crecimiento Vegetativo'),('Floración/Desarrollo de Fruto'),('Cosecha'),('Descanso del Suelo');
END
`});

// ---- Maestro de niveles de acceso (N / L / A) ----------------------------
batches.push({ label: 'maestro nivel_acceso', sql: `
IF NOT EXISTS (SELECT 1 FROM nivel_acceso)
BEGIN
    INSERT INTO nivel_acceso (codigo, nombre, descripcion) VALUES
      ('N', 'Sin acceso', 'No tiene acceso al apartado'),
      ('L', 'Lectura',    'Solo ver'),
      ('A', 'Acción',     'Ver + crear/editar');
END
`});

// ---- Maestros de roles, apartados y capacidades --------------------------
batches.push({ label: 'maestro rol', sql: `
IF NOT EXISTS (SELECT 1 FROM rol)
INSERT INTO rol (codigo, nombre, descripcion) VALUES
  ('administrador','Administrador','Control total del sistema y gestión de usuarios'),
  ('supervisor','Supervisor','Decisiones fitosanitarias: declara/levanta cuarentenas y supervisa'),
  ('inspector','Inspector','Trabajo de campo: registra parcelaciones y ejecuta predicciones'),
  ('analista','Analista','Consulta amplia para fiscalización y reportes, sin modificar'),
  ('lectura','Lectura','Consulta básica: solo el mapa');
`});

batches.push({ label: 'maestro apartado', sql: `
IF NOT EXISTS (SELECT 1 FROM apartado)
INSERT INTO apartado (codigo, nombre, orden) VALUES
  ('mapa','Mapa',1),
  ('parcelaciones','Parcelaciones',2),
  ('cuarentenas','Cuarentenas',3),
  ('datos_maestros','Datos maestros',4),
  ('historial','Historial',5),
  ('dashboard','Dashboard',6),
  ('prediccion','Predicción de imágenes',7),
  ('usuarios','Usuarios',8);
`});

batches.push({ label: 'maestro capacidad', sql: `
IF NOT EXISTS (SELECT 1 FROM capacidad)
INSERT INTO capacidad (codigo, nombre) VALUES
  ('cuarentena.activar_desactivar','Activar / desactivar cuarentenas (poner en vigencia o levantar)'),
  ('prediccion.ejecutar','Ejecutar predicción de imágenes'),
  ('parcelacion.eliminar','Eliminar parcelaciones'),
  ('cuarentena.eliminar','Eliminar cuarentenas'),
  ('maestro.eliminar','Eliminar datos maestros'),
  ('usuario.eliminar','Eliminar usuarios');
`});

// ---- Matriz rol -> apartado -> nivel -------------------------------------
batches.push({ label: 'matriz rol_apartado_permiso', sql: `
IF NOT EXISTS (SELECT 1 FROM rol_apartado_permiso)
INSERT INTO rol_apartado_permiso (id_rol, id_apartado, id_nivel)
SELECT r.id_rol, a.id_apartado, n.id_nivel
FROM (VALUES
  ('administrador','mapa','L'),('administrador','parcelaciones','A'),('administrador','cuarentenas','A'),
  ('administrador','datos_maestros','A'),('administrador','historial','L'),('administrador','dashboard','L'),
  ('administrador','prediccion','A'),('administrador','usuarios','A'),
  ('supervisor','mapa','L'),('supervisor','parcelaciones','A'),('supervisor','cuarentenas','A'),
  ('supervisor','datos_maestros','N'),('supervisor','historial','L'),('supervisor','dashboard','L'),
  ('supervisor','prediccion','A'),('supervisor','usuarios','N'),
  ('inspector','mapa','L'),('inspector','parcelaciones','A'),('inspector','cuarentenas','L'),
  ('inspector','datos_maestros','N'),('inspector','historial','L'),('inspector','dashboard','L'),
  ('inspector','prediccion','A'),('inspector','usuarios','N'),
  ('analista','mapa','L'),('analista','parcelaciones','L'),('analista','cuarentenas','L'),
  ('analista','datos_maestros','N'),('analista','historial','L'),('analista','dashboard','L'),
  ('analista','prediccion','N'),('analista','usuarios','N'),
  ('lectura','mapa','L'),('lectura','parcelaciones','N'),('lectura','cuarentenas','N'),
  ('lectura','datos_maestros','N'),('lectura','historial','N'),('lectura','dashboard','N'),
  ('lectura','prediccion','N'),('lectura','usuarios','N')
) AS m(rol, apartado, nivel)
JOIN rol r          ON r.codigo = m.rol
JOIN apartado a     ON a.codigo = m.apartado
JOIN nivel_acceso n ON n.codigo = m.nivel;
`});

batches.push({ label: 'matriz rol_capacidad', sql: `
IF NOT EXISTS (SELECT 1 FROM rol_capacidad)
INSERT INTO rol_capacidad (id_rol, id_capacidad)
SELECT r.id_rol, c.id_capacidad
FROM (VALUES
  ('administrador','cuarentena.activar_desactivar'),('administrador','prediccion.ejecutar'),
  ('administrador','parcelacion.eliminar'),('administrador','cuarentena.eliminar'),
  ('administrador','maestro.eliminar'),('administrador','usuario.eliminar'),
  ('supervisor','cuarentena.activar_desactivar'),('supervisor','prediccion.ejecutar'),
  ('supervisor','parcelacion.eliminar'),('supervisor','cuarentena.eliminar'),
  ('inspector','prediccion.ejecutar')
) AS m(rol, cap)
JOIN rol r       ON r.codigo = m.rol
JOIN capacidad c ON c.codigo = m.cap;
`});

// ---- Apartado 'roles' (gestión de roles) + permiso al administrador ------
// Idempotente: solo agrega lo que falte (sirve para BDD ya pobladas).
batches.push({ label: 'apartado roles + permiso admin', sql: `
IF NOT EXISTS (SELECT 1 FROM apartado WHERE codigo = 'roles')
  INSERT INTO apartado (codigo, nombre, orden) VALUES ('roles', 'Roles', 9);

IF NOT EXISTS (
  SELECT 1 FROM rol_apartado_permiso rap
  JOIN rol r      ON r.id_rol      = rap.id_rol      AND r.codigo = 'administrador'
  JOIN apartado a ON a.id_apartado = rap.id_apartado AND a.codigo = 'roles'
)
  INSERT INTO rol_apartado_permiso (id_rol, id_apartado, id_nivel)
  SELECT r.id_rol, a.id_apartado, n.id_nivel
  FROM rol r CROSS JOIN apartado a CROSS JOIN nivel_acceso n
  WHERE r.codigo = 'administrador' AND a.codigo = 'roles' AND n.codigo = 'A';
`});

// ---- Apartado 'bitacora' (bitácora de accesos, solo lectura) -------------
// Idempotente. Visible solo para administrador; el resto se asigna desde la matriz.
batches.push({ label: 'apartado bitacora + permiso admin', sql: `
IF NOT EXISTS (SELECT 1 FROM apartado WHERE codigo = 'bitacora')
  INSERT INTO apartado (codigo, nombre, orden) VALUES ('bitacora', 'Bitácora de accesos', 10);

IF NOT EXISTS (
  SELECT 1 FROM rol_apartado_permiso rap
  JOIN rol r      ON r.id_rol      = rap.id_rol      AND r.codigo = 'administrador'
  JOIN apartado a ON a.id_apartado = rap.id_apartado AND a.codigo = 'bitacora'
)
  INSERT INTO rol_apartado_permiso (id_rol, id_apartado, id_nivel)
  SELECT r.id_rol, a.id_apartado, n.id_nivel
  FROM rol r CROSS JOIN apartado a CROSS JOIN nivel_acceso n
  WHERE r.codigo = 'administrador' AND a.codigo = 'bitacora' AND n.codigo = 'L';
`});

// ---- Bitácora de accesos (quién ingresa / sale) --------------------------
batches.push({ label: 'tabla acceso_log', sql: `
IF OBJECT_ID('dbo.acceso_log','U') IS NULL
CREATE TABLE acceso_log (
    id_acceso   INT NOT NULL IDENTITY(1,1),
    id_usuario  INT           NULL,
    usuario     NVARCHAR(50)  NULL,
    nombre      NVARCHAR(80)  NULL,
    rol         NVARCHAR(50)  NULL,
    evento      NVARCHAR(20)  NOT NULL,   -- 'login' | 'logout' | 'login_fallido'
    exito       BIT           NOT NULL CONSTRAINT DF_acceso_exito DEFAULT 1,
    ip          NVARCHAR(60)  NULL,
    user_agent  NVARCHAR(300) NULL,
    fecha       DATETIME2(0)  NOT NULL CONSTRAINT DF_acceso_fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT acceso_log_pk PRIMARY KEY (id_acceso)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_acceso_log_fecha')
    CREATE INDEX IX_acceso_log_fecha ON acceso_log (fecha DESC);
`});

// ---- Vistas para inspeccionar el modelo de permisos ----------------------
batches.push({ label: 'vista VW_permisos_detalle', sql: `
CREATE OR ALTER VIEW VW_permisos_detalle AS
SELECT
    r.codigo      AS rol_codigo,
    r.nombre      AS rol,
    a.orden       AS apartado_orden,
    a.codigo      AS apartado_codigo,
    a.nombre      AS apartado,
    n.codigo      AS nivel,
    n.nombre      AS nivel_nombre,
    n.descripcion AS nivel_descripcion
FROM rol_apartado_permiso rap
JOIN rol r          ON r.id_rol      = rap.id_rol
JOIN apartado a     ON a.id_apartado = rap.id_apartado
JOIN nivel_acceso n ON n.id_nivel    = rap.id_nivel;
`});

batches.push({ label: 'vista VW_matriz_roles', sql: `
CREATE OR ALTER VIEW VW_matriz_roles AS
SELECT *
FROM (
    SELECT r.nombre AS rol, a.codigo AS apartado, n.codigo AS nivel
    FROM rol_apartado_permiso rap
    JOIN rol r          ON r.id_rol      = rap.id_rol
    JOIN apartado a     ON a.id_apartado = rap.id_apartado
    JOIN nivel_acceso n ON n.id_nivel    = rap.id_nivel
) src
PIVOT (
    MAX(nivel) FOR apartado IN (
        [mapa],[parcelaciones],[cuarentenas],[datos_maestros],
        [historial],[dashboard],[prediccion],[usuarios]
    )
) p;
`});

batches.push({ label: 'vista VW_rol_capacidades', sql: `
CREATE OR ALTER VIEW VW_rol_capacidades AS
SELECT
    r.codigo AS rol_codigo,
    r.nombre AS rol,
    c.codigo AS capacidad_codigo,
    c.nombre AS capacidad
FROM rol_capacidad rc
JOIN rol r       ON r.id_rol       = rc.id_rol
JOIN capacidad c ON c.id_capacidad = rc.id_capacidad;
`});

batches.push({ label: 'vista VW_rol_capacidades_resumen', sql: `
CREATE OR ALTER VIEW VW_rol_capacidades_resumen AS
SELECT
    r.nombre AS rol,
    STRING_AGG(c.codigo, ' | ') AS capacidades
FROM rol r
LEFT JOIN rol_capacidad rc ON rc.id_rol      = r.id_rol
LEFT JOIN capacidad c      ON c.id_capacidad = rc.id_capacidad
GROUP BY r.nombre;
`});

// ---- 6) Datos: parcelaciones (dispara el trigger -> historial) -----------
batches.push({ label: 'datos parcelacion', sql: `
IF NOT EXISTS (SELECT 1 FROM parcelacion)
BEGIN
    INSERT INTO parcelacion (latitud, longitud, id_sector, id_fase, id_cultivo, registrada) VALUES
      (-41.41543, -73.54339, 1, 3, 2, 1),
      (-40.72792, -73.22039, 6, 5, 3, 0),
      (-40.96695, -73.17980, 5, 5, 7, 0),
      (-42.42246, -73.80953, 10, 1, 1, 1),
      (-41.39990, -73.55635, 1, 2, 1, 1);
END
`});

// ---- 7) Datos: cuarentenas + vertices + conexiones (activa = 1) ----------
batches.push({ label: 'datos cuarentena + vertices + conexiones', sql: `
IF NOT EXISTS (SELECT 1 FROM cuarentena)
BEGIN
    -- activa = 1 (cuarentena activa)
    INSERT INTO cuarentena(latitud, longitud, radio, id_sector, comentario, activa) VALUES (null, null, null, 1, 'Contaminación detectada', 1);
    INSERT INTO cuarentena(latitud, longitud, radio, id_sector, comentario, activa) VALUES (null, null, null, 1, 'Brotes de enfermedad confirmados', 1);
    INSERT INTO cuarentena(latitud, longitud, radio, id_sector, comentario, activa) VALUES (-41.39921, -73.55619, 2000, 1, 'Zona de alta contaminacion', 1);
    INSERT INTO cuarentena(latitud, longitud, radio, id_sector, comentario, activa) VALUES (-40.73325, -73.21907, 5000, 6, 'Peligro químico identificado', 1);

    -- Vertices de la cuarentena 1
    INSERT INTO vertice(id_cuarentena, latitud, longitud, orden) VALUES (1, -41.395978, -73.472544, 1);
    INSERT INTO vertice(id_cuarentena, latitud, longitud, orden) VALUES (1, -41.392590, -73.472978, 2);
    INSERT INTO vertice(id_cuarentena, latitud, longitud, orden) VALUES (1, -41.392398, -73.475479, 3);
    INSERT INTO vertice(id_cuarentena, latitud, longitud, orden) VALUES (1, -41.395901, -73.475020, 4);
    EXEC sp_CrearConexionesCuarentena @id_cuarentena = 1;

    -- Vertices de la cuarentena 2
    INSERT INTO vertice(id_cuarentena, latitud, longitud, orden) VALUES (2, -41.396035, -73.475045, 1);
    INSERT INTO vertice(id_cuarentena, latitud, longitud, orden) VALUES (2, -41.400132, -73.473871, 2);
    INSERT INTO vertice(id_cuarentena, latitud, longitud, orden) VALUES (2, -41.402027, -73.471906, 3);
    INSERT INTO vertice(id_cuarentena, latitud, longitud, orden) VALUES (2, -41.402199, -73.470273, 4);
    INSERT INTO vertice(id_cuarentena, latitud, longitud, orden) VALUES (2, -41.399481, -73.468819, 5);
    INSERT INTO vertice(id_cuarentena, latitud, longitud, orden) VALUES (2, -41.396189, -73.467900, 6);
    EXEC sp_CrearConexionesCuarentena @id_cuarentena = 2;
END
`});

// ===========================================================================
//  Ejecución
// ===========================================================================
async function run() {
  let pool;
  try {
    console.log(`Conectando a ${config.server} / ${config.database} ...`);
    pool = await sql.connect(config);
    console.log('Conexión exitosa.\n');

    if (RESET) {
      console.log('⚠  --reset activado: ELIMINANDO todos los objetos existentes...');
      await pool.request().batch(DROP_SQL);
      console.log('   objetos eliminados.\n');
    }

    for (const { label, sql: batchSql } of batches) {
      process.stdout.write(`-> ${label} ... `);
      await pool.request().batch(batchSql);
      console.log('ok');
    }

    // Usuarios semilla: uno por rol. Contraseñas hasheadas con bcrypt.
    // Se inserta cada uno solo si no existe (idempotente).
    const usuariosSemilla = [
      { correo:'admin@sag.cl',      usuario:'admin',      pass:'admin123',     rut:11111111, dv:'1', nombre:'Admin',   apellido:'SAG',         rol:'administrador' },
      { correo:'supervisor@sag.cl', usuario:'supervisor', pass:'super123',     rut:33333333, dv:'3', nombre:'Sofía',   apellido:'Supervisora', rol:'supervisor' },
      { correo:'inspector@sag.cl',  usuario:'inspector',  pass:'inspector123', rut:44444444, dv:'4', nombre:'Iván',    apellido:'Inspector',   rol:'inspector' },
      { correo:'analista@sag.cl',   usuario:'analista',   pass:'analista123',  rut:55555555, dv:'5', nombre:'Ana',     apellido:'Analista',    rol:'analista' },
      { correo:'user@sag.cl',       usuario:'user',       pass:'user123',      rut:22222222, dv:'2', nombre:'Usuario', apellido:'SAG',         rol:'lectura' }
    ];
    process.stdout.write('-> datos usuario (contraseñas hasheadas) ... ');
    for (const u of usuariosSemilla) {
      const hash = await bcrypt.hash(u.pass, 10);
      await pool.request()
        .input('correo',   sql.NVarChar, u.correo)
        .input('hash',     sql.NVarChar, hash)
        .input('usuario',  sql.NVarChar, u.usuario)
        .input('rut',      sql.Int,      u.rut)
        .input('dv',       sql.NVarChar, u.dv)
        .input('nombre',   sql.NVarChar, u.nombre)
        .input('apellido', sql.NVarChar, u.apellido)
        .input('rol',      sql.NVarChar, u.rol)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM usuario WHERE usuario = @usuario)
          INSERT INTO usuario (correo, password, usuario, rut, dv_rut, nombre, apellido, rol)
          VALUES (@correo, @hash, @usuario, @rut, @dv, @nombre, @apellido, @rol);
        `);
    }
    // Migración idempotente: roles antiguos -> nuevos códigos
    await pool.request().query(`
      UPDATE usuario SET rol = 'administrador' WHERE rol = 'Admin';
      UPDATE usuario SET rol = 'lectura'       WHERE rol = 'User';
    `);
    console.log('ok');

    console.log('\n✅ Migración completada con éxito.');
    console.log('   Usuarios disponibles (usuario / contraseña / rol):');
    console.log('     admin      / admin123     / administrador');
    console.log('     supervisor / super123     / supervisor');
    console.log('     inspector  / inspector123 / inspector');
    console.log('     analista   / analista123  / analista');
    console.log('     user       / user123      / lectura');
  } catch (err) {
    console.error('\n❌ Error durante la migración:', err.message);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.close();
  }
}

run();