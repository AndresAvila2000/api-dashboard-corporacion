// server.js - CON AUTOLOGIN VISIONBLO v3.0
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const WebSocket = require('ws');
require('dotenv').config();

const nodeFetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

let cachedSid = process.env.VISIONBLO_SID || '';
let cachedServidor = process.env.VISIONBLO_SERVIDOR || 'apps6.visionblo.com';

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('connect', () => console.log('Conectado a PostgreSQL Aurora'));
pool.on('error', (err) => console.error('Error DB:', err));

function buildWhereClause(params, filters) {
  let whereClause = '1=1';
  let paramCount = 1;
  const queryParams = [];
  if (filters.fecha_desde) { queryParams.push(filters.fecha_desde); whereClause += ` AND fecha::date >= $${paramCount++}::date`; }
  if (filters.fecha_hasta) { queryParams.push(filters.fecha_hasta); whereClause += ` AND fecha::date <= $${paramCount++}::date`; }
  if (filters.empresa) { queryParams.push(filters.empresa); whereClause += ` AND empresa = $${paramCount++}`; }
  if (filters.cliente) { queryParams.push(filters.cliente); whereClause += ` AND cliente = $${paramCount++}`; }
  if (filters.proveedor) { queryParams.push(filters.proveedor); whereClause += ` AND proveedor = $${paramCount++}`; }
  if (filters.dimension) {
    const dimensiones = Array.isArray(filters.dimension) ? filters.dimension : [filters.dimension];
    if (dimensiones.length > 0) {
      const dimPlaceholders = dimensiones.map((_, i) => `$${paramCount + i}`).join(',');
      queryParams.push(...dimensiones);
      whereClause += ` AND dimensionvalor IN (${dimPlaceholders})`;
      paramCount += dimensiones.length;
    }
  }
  return { whereClause, queryParams };
}

// VENTAS
app.get('/api/ventas/stats', async (req, res) => {
  try {
    const filters = { fecha_desde: req.query.fecha_desde, fecha_hasta: req.query.fecha_hasta, empresa: req.query.empresa, cliente: req.query.cliente, dimension: req.query.dimension };
    const { whereClause, queryParams } = buildWhereClause([], filters);
    const result = await pool.query(`SELECT SUM(CASE WHEN importemonprincipal='NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total_facturado, COUNT(*) as cantidad_facturas, COUNT(DISTINCT cliente) as clientes_unicos, AVG(CASE WHEN importemonprincipal='NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as promedio_factura FROM corporacion_analisisfacturaventa WHERE ${whereClause}`, queryParams);
    res.json(result.rows[0]);
  } catch (error) { console.error('Error ventas/stats:', error); res.status(500).json({ error: 'Error al obtener estadísticas de ventas' }); }
});

app.get('/api/ventas/evolucion', async (req, res) => {
  try {
    const filters = { fecha_desde: req.query.fecha_desde, fecha_hasta: req.query.fecha_hasta, empresa: req.query.empresa, cliente: req.query.cliente, dimension: req.query.dimension };
    const { whereClause, queryParams } = buildWhereClause([], filters);
    const result = await pool.query(`SELECT TO_CHAR(DATE_TRUNC('month', fecha::date), 'YYYY-MM') as mes, SUM(CASE WHEN importemonprincipal='NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total FROM corporacion_analisisfacturaventa WHERE ${whereClause} GROUP BY DATE_TRUNC('month', fecha::date) ORDER BY DATE_TRUNC('month', fecha::date)`, queryParams);
    res.json(result.rows);
  } catch (error) { console.error('Error ventas/evolucion:', error); res.status(500).json({ error: 'Error al obtener evolución de ventas' }); }
});

app.get('/api/ventas/top-clientes', async (req, res) => {
  try {
    const filters = { fecha_desde: req.query.fecha_desde, fecha_hasta: req.query.fecha_hasta, empresa: req.query.empresa, dimension: req.query.dimension };
    const { whereClause, queryParams } = buildWhereClause([], filters);
    const result = await pool.query(`SELECT cliente as nombre, SUM(CASE WHEN importemonprincipal='NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total FROM corporacion_analisisfacturaventa WHERE ${whereClause} GROUP BY cliente ORDER BY total DESC LIMIT 10`, queryParams);
    res.json(result.rows);
  } catch (error) { console.error('Error ventas/top-clientes:', error); res.status(500).json({ error: 'Error al obtener top clientes' }); }
});

app.get('/api/ventas/analisis-comprobantes', async (req, res) => {
  try {
    const filters = { fecha_desde: req.query.fecha_desde, fecha_hasta: req.query.fecha_hasta, empresa: req.query.empresa, cliente: req.query.cliente, dimension: req.query.dimension };
    const limit = req.query.limit || 100;
    const { whereClause, queryParams } = buildWhereClause([], filters);
    queryParams.push(limit);
    const result = await pool.query(`SELECT fechacomprobante as fecha, comprobante as numero_comprobante, transacciontiponombre as tipo_comprobante, cliente, producto, descitem as descripcion, CASE WHEN importemonprincipal='NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END as importe_neto, CASE WHEN gravado='NULL' OR gravado IS NULL THEN 0 ELSE gravado::numeric END as impuestos, CASE WHEN total='NULL' OR total IS NULL THEN 0 ELSE total::numeric END as total, '' as observaciones FROM corporacion_analisisfacturaventa WHERE ${whereClause} ORDER BY fechacomprobante DESC, comprobante DESC LIMIT $${queryParams.length}`, queryParams);
    res.json(result.rows);
  } catch (error) { console.error('Error ventas/comprobantes:', error); res.status(500).json({ error: 'Error al obtener comprobantes de ventas' }); }
});

// COMPRAS
app.get('/api/compras/stats', async (req, res) => {
  try {
    const filters = { fecha_desde: req.query.fecha_desde, fecha_hasta: req.query.fecha_hasta, empresa: req.query.empresa, proveedor: req.query.proveedor, dimension: req.query.dimension };
    const { whereClause, queryParams } = buildWhereClause([], filters);
    const result = await pool.query(`SELECT SUM(CASE WHEN importemonprincipal='NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total_compras, COUNT(*) as cantidad_facturas, COUNT(DISTINCT proveedor) as proveedores_unicos, AVG(CASE WHEN importemonprincipal='NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as promedio_compra FROM corporacion_analisisfacturacompra WHERE ${whereClause}`, queryParams);
    res.json(result.rows[0]);
  } catch (error) { console.error('Error compras/stats:', error); res.status(500).json({ error: 'Error al obtener estadísticas de compras' }); }
});

app.get('/api/compras/evolucion', async (req, res) => {
  try {
    const filters = { fecha_desde: req.query.fecha_desde, fecha_hasta: req.query.fecha_hasta, empresa: req.query.empresa, proveedor: req.query.proveedor, dimension: req.query.dimension };
    const { whereClause, queryParams } = buildWhereClause([], filters);
    const result = await pool.query(`SELECT TO_CHAR(DATE_TRUNC('month', fecha::date), 'YYYY-MM') as mes, SUM(CASE WHEN importemonprincipal='NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total FROM corporacion_analisisfacturacompra WHERE ${whereClause} GROUP BY DATE_TRUNC('month', fecha::date) ORDER BY DATE_TRUNC('month', fecha::date)`, queryParams);
    res.json(result.rows);
  } catch (error) { console.error('Error compras/evolucion:', error); res.status(500).json({ error: 'Error al obtener evolución de compras' }); }
});

app.get('/api/compras/top-proveedores', async (req, res) => {
  try {
    const filters = { fecha_desde: req.query.fecha_desde, fecha_hasta: req.query.fecha_hasta, empresa: req.query.empresa, dimension: req.query.dimension };
    const { whereClause, queryParams } = buildWhereClause([], filters);
    const result = await pool.query(`SELECT proveedor as nombre, SUM(CASE WHEN importemonprincipal='NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total FROM corporacion_analisisfacturacompra WHERE ${whereClause} GROUP BY proveedor ORDER BY total DESC LIMIT 10`, queryParams);
    res.json(result.rows);
  } catch (error) { console.error('Error compras/top-proveedores:', error); res.status(500).json({ error: 'Error al obtener top proveedores' }); }
});

app.get('/api/compras/analisis-comprobantes', async (req, res) => {
  try {
    const filters = { fecha_desde: req.query.fecha_desde, fecha_hasta: req.query.fecha_hasta, empresa: req.query.empresa, proveedor: req.query.proveedor, dimension: req.query.dimension };
    const limit = req.query.limit || 100;
    const { whereClause, queryParams } = buildWhereClause([], filters);
    queryParams.push(limit);
    const result = await pool.query(`SELECT fechacomprobante as fecha, comprobante as numero_comprobante, transacciontiponombre as tipo_comprobante, proveedor, producto, descitem as descripcion, CASE WHEN importemonprincipal='NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END as importe_neto, CASE WHEN gravado='NULL' OR gravado IS NULL THEN 0 ELSE gravado::numeric END as impuestos, CASE WHEN total='NULL' OR total IS NULL THEN 0 ELSE total::numeric END as total, '' as observaciones FROM corporacion_analisisfacturacompra WHERE ${whereClause} ORDER BY fechacomprobante DESC, comprobante DESC LIMIT $${queryParams.length}`, queryParams);
    res.json(result.rows);
  } catch (error) { console.error('Error compras/comprobantes:', error); res.status(500).json({ error: 'Error al obtener comprobantes de compras' }); }
});

// FILTROS
app.get('/api/filtros/clientes', async (req, res) => {
  try { const r = await pool.query(`SELECT DISTINCT cliente as nombre FROM corporacion_analisisfacturaventa WHERE cliente IS NOT NULL ORDER BY cliente`); res.json(r.rows); }
  catch (e) { res.status(500).json({ error: 'Error al obtener clientes' }); }
});
app.get('/api/filtros/proveedores', async (req, res) => {
  try { const r = await pool.query(`SELECT DISTINCT proveedor as nombre FROM corporacion_analisisfacturacompra WHERE proveedor IS NOT NULL ORDER BY proveedor`); res.json(r.rows); }
  catch (e) { res.status(500).json({ error: 'Error al obtener proveedores' }); }
});
app.get('/api/filtros/dimensiones-ventas', async (req, res) => {
  try { const r = await pool.query(`SELECT DISTINCT dimensionvalor as nombre FROM corporacion_analisisfacturaventa WHERE dimensionvalor IS NOT NULL ORDER BY dimensionvalor`); res.json(r.rows); }
  catch (e) { res.status(500).json({ error: 'Error al obtener dimensiones ventas' }); }
});
app.get('/api/filtros/dimensiones-compras', async (req, res) => {
  try { const r = await pool.query(`SELECT DISTINCT dimensionvalor as nombre FROM corporacion_analisisfacturacompra WHERE dimensionvalor IS NOT NULL ORDER BY dimensionvalor`); res.json(r.rows); }
  catch (e) { res.status(500).json({ error: 'Error al obtener dimensiones compras' }); }
});
app.get('/api/filtros/empresas', async (req, res) => {
  try { const r = await pool.query(`SELECT DISTINCT empresa as nombre FROM corporacion_analisisfacturaventa WHERE empresa IS NOT NULL UNION SELECT DISTINCT empresa as nombre FROM corporacion_analisisfacturacompra WHERE empresa IS NOT NULL ORDER BY nombre`); res.json(r.rows); }
  catch (e) { res.status(500).json({ error: 'Error al obtener empresas' }); }
});

// AUTOLOGIN VISIONBLO
function loginVisionBlo(servidor, intentos) {
  return new Promise((resolve, reject) => {
    if (intentos <= 0) return reject(new Error('Demasiados redireccionamientos'));
    const user = process.env.VISIONBLO_USUARIO;
    const pass = process.env.VISIONBLO_CONTRASENA;
    if (!user || !pass) return reject(new Error('Faltan VISIONBLO_USUARIO / VISIONBLO_CONTRASENA en variables de entorno'));
    const ws = new WebSocket(`wss://${servidor}/rb/smoothie`, {
      headers: { 'Origin': 'https://apps.visionblo.com', 'User-Agent': 'Mozilla/5.0' }
    });
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; ws.terminate(); reject(new Error('Timeout')); } }, 15000);
    ws.on('open', () => {
      ws.send(JSON.stringify(['user/login', { usuario: user, contrasena: pass, user_agent: 'Mozilla/5.0', screen_size: '1920x1080', device_memory: 8 }]));
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const canal = Array.isArray(msg) ? msg[0] : null;
        const data = Array.isArray(msg) ? msg[1] : msg;
        if (canal !== 'user/login' && canal !== 'user/2fa') return;
        if (done) return;
        done = true; clearTimeout(timer); ws.close();
        if (!data.ok && data.servidor) { loginVisionBlo(data.servidor, intentos - 1).then(resolve).catch(reject); return; }
        if (!data.ok) return reject(new Error(data.error || 'Login fallido'));
        resolve({ sid: data.sid, servidor: data.servidor || servidor });
      } catch(e) {}
    });
    ws.on('error', (e) => { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    ws.on('close', () => { if (!done) { done = true; clearTimeout(timer); reject(new Error('WS cerrado')); } });
  });
}

app.post('/api/movilidad/login', async (req, res) => {
  try {
    const r = await loginVisionBlo(cachedServidor, 5);
    cachedSid = r.sid; cachedServidor = r.servidor;
    console.log('SID renovado. Servidor:', cachedServidor);
    res.json({ ok: true, servidor: cachedServidor });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PROXY MOVILIDAD
async function fetchVisionBlo(ruta, sid, servidor) {
  const fn = typeof fetch !== 'undefined' ? fetch : nodeFetch;
  const cookie = process.env.VISIONBLO_COOKIE || '';
  return fn(`https://${servidor}/rb/app/${ruta}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://apps.visionblo.com',
      'Referer': 'https://apps.visionblo.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...(cookie ? { 'Cookie': cookie } : {})
    },
    body: JSON.stringify({ sid })
  });
}

app.post('/api/movilidad', async (req, res) => {
  try {
    const ruta = req.query.ruta;
    if (!ruta) return res.status(400).json({ error: 'Falta ?ruta=' });
    let sid = req.body.sid || cachedSid;
    let servidor = cachedServidor;
    if (!sid) {
      try { const r = await loginVisionBlo(servidor, 5); cachedSid = r.sid; cachedServidor = r.servidor; sid = cachedSid; servidor = cachedServidor; }
      catch(e) { return res.status(500).json({ error: 'Sin SID y autologin falló: ' + e.message }); }
    }
    let response = await fetchVisionBlo(ruta, sid, servidor);
    if (!response.ok) {
      console.log(`Status ${response.status}, renovando SID...`);
      try {
        const r = await loginVisionBlo(servidor, 5);
        cachedSid = r.sid; cachedServidor = r.servidor;
        response = await fetchVisionBlo(ruta, cachedSid, cachedServidor);
      } catch(e) { console.error('Renovación fallida:', e.message); }
    }
    if (!response.ok) return res.status(response.status).json({ error: `VisionBlo status ${response.status}` });
    res.json(await response.json());
  } catch (error) { console.error('Error proxy:', error); res.status(500).json({ error: error.message }); }
});

// HEALTH
app.get('/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected', visionblo_sid: cachedSid ? 'activo' : 'sin SID' }); }
  catch (e) { res.status(500).json({ status: 'error', database: 'disconnected' }); }
});

app.get('/', (req, res) => {
  res.json({ message: 'API Dashboard Corporación del Sur', version: '3.0.0' });
});

app.listen(PORT, HOST, () => {
  console.log(`Servidor en puerto ${PORT}`);
  if (process.env.VISIONBLO_USUARIO && process.env.VISIONBLO_CONTRASENA) {
    console.log('Iniciando autologin VisionBlo...');
    loginVisionBlo(cachedServidor, 5)
      .then(r => { cachedSid = r.sid; cachedServidor = r.servidor; console.log('SID VisionBlo obtenido al arrancar. Servidor:', cachedServidor); })
      .catch(e => console.error('Autologin al arrancar falló:', e.message));
  }
});

process.on('SIGTERM', () => { pool.end(); process.exit(0); });
