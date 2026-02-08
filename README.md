# 🚀 API Dashboard Corporación del Sur

API REST para Dashboard de Ventas y Compras conectada a PostgreSQL Aurora.

## 📋 Características

✅ Endpoints para Ventas y Compras  
✅ KPIs en tiempo real  
✅ Evolución mensual  
✅ Rankings de clientes/proveedores  
✅ Análisis por dimensión valor  
✅ Listados detallados con paginación  
✅ Filtros dinámicos  
✅ Seguridad con API Key  
✅ Conexión optimizada a PostgreSQL Aurora  

---

## 🛠️ Instalación Local

### **Requisitos previos:**
- Node.js 16 o superior
- Acceso a la base de datos PostgreSQL Aurora

### **Paso 1: Clonar o descargar el proyecto**

```bash
cd api-dashboard
```

### **Paso 2: Instalar dependencias**

```bash
npm install
```

### **Paso 3: Configurar variables de entorno**

1. Copiá el archivo de ejemplo:
```bash
cp .env.example .env
```

2. Abrí el archivo `.env` y completá tus credenciales:

```env
DB_HOST=infraestructura-aurora-datawarehouse-instance-zxhlvevffc1c.cijt7auhxunw.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=finnegansbi
DB_USER=tu_usuario_real
DB_PASSWORD=tu_password_real
API_KEY=clave_secreta_aleatoria_123xyz
PORT=3000
```

**⚠️ IMPORTANTE:** 
- Reemplazá `tu_usuario_real` y `tu_password_real` con tus credenciales reales
- Genera una API_KEY única y segura
- NUNCA subas el archivo `.env` a Git

### **Paso 4: Probar la conexión**

```bash
npm start
```

Si todo está bien, verás:
```
✅ Conectado a PostgreSQL Aurora
🚀 Servidor corriendo en puerto 3000
📊 API Dashboard: http://localhost:3000
🏥 Health check: http://localhost:3000/health
```

### **Paso 5: Verificar que funciona**

Abrí tu navegador en: `http://localhost:3000/health`

Deberías ver:
```json
{
  "status": "ok",
  "database": "connected"
}
```

---

## 📡 Endpoints Disponibles

### **🔐 Autenticación**

Todos los endpoints (excepto `/health` y `/`) requieren enviar el header:
```
x-api-key: tu_clave_secreta
```

### **📊 VENTAS**

#### `GET /api/ventas/stats`
KPIs principales de ventas.

**Query params (opcionales):**
- `fecha_desde` - Filtrar desde fecha (YYYY-MM-DD)
- `fecha_hasta` - Filtrar hasta fecha (YYYY-MM-DD)
- `cliente` - Filtrar por cliente
- `dimension` - Filtrar por dimensión valor
- `tipo_documento` - Filtrar por tipo de documento

**Ejemplo:**
```
GET /api/ventas/stats?fecha_desde=2025-01-01&fecha_hasta=2025-12-31
Headers: x-api-key: tu_clave
```

**Respuesta:**
```json
{
  "total_facturado": 150000000.50,
  "cantidad_facturas": 446,
  "clientes_unicos": 14,
  "promedio_factura": 336322.42
}
```

---

#### `GET /api/ventas/evolucion`
Evolución mensual de ventas.

**Query params:** Mismos que `/stats`

**Respuesta:**
```json
[
  { "mes": "2025-01", "total": 12500000 },
  { "mes": "2025-02", "total": 15300000 },
  ...
]
```

---

#### `GET /api/ventas/top-clientes`
Top 10 clientes por facturación.

**Query params:** `fecha_desde`, `fecha_hasta`, `dimension`

**Respuesta:**
```json
[
  { "nombre": "IPV", "total": 45000000 },
  { "nombre": "DIRECCION DE RECURSOS NATURALES", "total": 38000000 },
  ...
]
```

---

#### `GET /api/ventas/dimensiones`
Distribución por dimensión valor (Top 10).

**Query params:** `fecha_desde`, `fecha_hasta`, `cliente`

**Respuesta:**
```json
[
  { "nombre": "INCENDIOS FORESTALES", "total": 50000000 },
  { "nombre": "PROCREAR - GUAYMALLEN", "total": 35000000 },
  ...
]
```

---

#### `GET /api/ventas/detalle`
Listado detallado de facturas con paginación.

**Query params:** 
- Filtros: `fecha_desde`, `fecha_hasta`, `cliente`, `dimension`, `tipo_documento`
- Paginación: `page` (default: 1), `limit` (default: 50)

**Ejemplo:**
```
GET /api/ventas/detalle?page=1&limit=50
```

**Respuesta:**
```json
{
  "data": [
    {
      "Fecha": "2025-01-22T00:00:00.000Z",
      "Numerocomprobante": "B-0003-00000716",
      "Cliente": "DIRECCION DE RECURSOS NATURALES",
      "Dimensionvalor": "INCENDIOS FORESTALES",
      "Descripcionitem": "CERTIFICADO...",
      "Producto": "...",
      "Importeneto": 29244217.47,
      "Total": 35385503.14
    },
    ...
  ],
  "total": 446,
  "page": 1,
  "totalPages": 9
}
```

---

### **🛒 COMPRAS**

Los endpoints de compras son análogos a los de ventas:

- `GET /api/compras/stats` - KPIs de compras
- `GET /api/compras/evolucion` - Evolución mensual
- `GET /api/compras/top-proveedores` - Top 10 proveedores
- `GET /api/compras/dimensiones` - Distribución por dimensión
- `GET /api/compras/detalle` - Listado detallado

**Query params para compras:**
- `fecha_desde`, `fecha_hasta`, `proveedor`, `dimension`

---

### **🔍 FILTROS**

Endpoints para obtener listas de valores únicos (para filtros del dashboard):

- `GET /api/filtros/clientes` - Lista de clientes
- `GET /api/filtros/proveedores` - Lista de proveedores
- `GET /api/filtros/dimensiones-ventas` - Dimensiones de ventas
- `GET /api/filtros/dimensiones-compras` - Dimensiones de compras
- `GET /api/filtros/tipos-documento` - Tipos de documento

**Ejemplo de respuesta:**
```json
[
  { "nombre": "IPV" },
  { "nombre": "DIRECCION DE RECURSOS..." },
  ...
]
```

---

## 🚀 Deploy en Railway (Recomendado)

### **Ventajas de Railway:**
- ✅ Deploy automático desde Git
- ✅ Variables de entorno seguras
- ✅ HTTPS incluido
- ✅ Logs en tiempo real
- ✅ ~$5/mes

### **Paso a Paso:**

1. **Crear cuenta en Railway**
   - Ve a: https://railway.app
   - Regístrate con GitHub

2. **Crear nuevo proyecto**
   - Click en "New Project"
   - Selecciona "Deploy from GitHub repo"
   - Conecta tu repositorio

3. **Configurar variables de entorno**
   - En el proyecto, ve a "Variables"
   - Agrega cada variable del archivo `.env`:
     ```
     DB_HOST=infraestructura-aurora-datawarehouse...
     DB_PORT=5432
     DB_NAME=finnegansbi
     DB_USER=tu_usuario
     DB_PASSWORD=tu_password
     API_KEY=tu_clave_secreta
     PORT=3000
     ```

4. **Deploy**
   - Railway hace deploy automático
   - Esperá 2-3 minutos
   - Te dará una URL como: `https://tu-api.railway.app`

5. **Verificar**
   - Abrí: `https://tu-api.railway.app/health`
   - Si ves `{"status":"ok","database":"connected"}` ¡funciona!

---

## 🚀 Deploy en Render (Gratis con límites)

### **Paso a Paso:**

1. **Crear cuenta en Render**
   - Ve a: https://render.com
   - Regístrate

2. **Nuevo Web Service**
   - Click en "New +" → "Web Service"
   - Conecta tu repo de GitHub

3. **Configuración:**
   - Name: `api-dashboard-cds`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free`

4. **Variables de entorno:**
   - En "Environment", agrega las variables del `.env`

5. **Deploy:**
   - Click en "Create Web Service"
   - Esperá 5-10 minutos

**⚠️ Nota sobre Render Free:**
- El servicio "duerme" después de 15 min sin uso
- Tarda ~30 seg en despertar
- Suficiente para pruebas, no para producción

---

## 🚀 Deploy en VPS (DigitalOcean, AWS, etc.)

### **Requisitos:**
- Ubuntu 20.04 o superior
- Node.js instalado
- PM2 para gestión de procesos

### **Paso a Paso:**

1. **Conectar por SSH**
```bash
ssh root@tu-servidor-ip
```

2. **Instalar Node.js y PM2**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

3. **Clonar el proyecto**
```bash
cd /var/www
git clone tu-repo.git
cd api-dashboard
```

4. **Instalar dependencias**
```bash
npm install
```

5. **Configurar .env**
```bash
nano .env
# Pega tus credenciales y guarda (Ctrl+X, Y, Enter)
```

6. **Iniciar con PM2**
```bash
pm2 start server.js --name api-dashboard
pm2 save
pm2 startup
```

7. **Configurar Nginx (opcional)**
```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/api-dashboard
```

Pega:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

8. **SSL con Certbot (opcional)**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

---

## 🧪 Probar la API

### **Con cURL:**

```bash
# Health check
curl http://localhost:3000/health

# Stats de ventas
curl -H "x-api-key: tu_clave" \
  "http://localhost:3000/api/ventas/stats?fecha_desde=2025-01-01"

# Top clientes
curl -H "x-api-key: tu_clave" \
  http://localhost:3000/api/ventas/top-clientes
```

### **Con Postman:**

1. Crea una colección "Dashboard API"
2. Agrega un header global:
   - Key: `x-api-key`
   - Value: `tu_clave_secreta`
3. Importa los endpoints y prueba

---

## 🔒 Seguridad

### **Mejores Prácticas:**

1. **API Key fuerte:**
   ```bash
   # Genera una clave segura
   openssl rand -hex 32
   ```

2. **HTTPS en producción:**
   - Usa siempre HTTPS (Railway lo incluye)
   - Nunca expongas la API sin encriptación

3. **Firewall en AWS:**
   - Configura Security Groups
   - Permite solo las IPs necesarias en el puerto 5432

4. **Variables de entorno:**
   - NUNCA hardcodees credenciales
   - Usa `.env` localmente
   - Variables de entorno en servicios cloud

5. **Usuarios de BD:**
   - Crea un usuario de solo lectura para la API
   - No uses el usuario admin

---

## 📊 Monitoreo

### **Logs:**

**Railway:**
- Ve a tu proyecto → "Deployments" → "Logs"

**Render:**
- En tu servicio → "Logs"

**PM2 (VPS):**
```bash
pm2 logs api-dashboard
pm2 monit
```

### **Errores comunes:**

**Error: "Connection refused"**
- Verificá que PostgreSQL acepte conexiones externas
- Revisá el Security Group de AWS
- Confirmá host, puerto, usuario y password

**Error: "API key inválida"**
- Verificá que el header `x-api-key` esté presente
- Confirmá que coincida con el valor en `.env`

**Error: "Column not found"**
- Los nombres de columnas tienen comillas dobles
- PostgreSQL es case-sensitive con comillas

---

## 🆘 Soporte

Si tenés problemas:

1. Verificá los logs: `pm2 logs` o en tu plataforma cloud
2. Probá el health check: `/health`
3. Verificá las credenciales en `.env`
4. Confirmá que PostgreSQL acepta conexiones

---

## 📝 Próximos Pasos

Una vez que tengas la API funcionando:

1. ✅ Probá todos los endpoints
2. ✅ Verificá que los filtros funcionen
3. ✅ Avisame la URL de tu API
4. ✅ Te paso el dashboard HTML conectado a tu API

---

## 📄 Licencia

MIT License - Corporación del Sur

---

**Desarrollado con ❤️ para Corporación del Sur**
