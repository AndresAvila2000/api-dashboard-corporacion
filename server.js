// server.js - FINAL CON NOMBRES REALES
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

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

pool.on('connect', () => console.log('✅ Conectado'));
pool.on('error', (err) => console.error('❌ Error BD:', err));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

function buildFilters(req, tipo) {
  const filters = [];
  const params = [];
  let paramCount = 1;
  
  const isVentas = tipo === 'ventas';
  const fechaCol = isVentas ? 'fechacomprobante' : 'fecha';
  
  if (req.query.fecha_desde) {
    filters.push(`${fechaCol}::date >= $${paramCount++}::date`);
    params.push(req.query.fecha_desde);
  }
  if (req.query.fecha_hasta) {
    filters.push(`${fechaCol}::date <= $${paramCount++}::date`);
    params.push(req.query.fecha_hasta);
  }
  if (req.query.cliente && isVentas) {
    filters.push(`cliente = $${paramCount++}`);
    params.push(req.query.cliente);
  }
  if (req.query.proveedor && !isVentas) {
    filters.push(`proveedor = $${paramCount++}`);
    params.push(req.query.proveedor);
  }
  if (req.query.empresa) {
    filters.push(`empresa = $${paramCount++}`);
    params.push(req.query.empresa);
  }
  if (req.query.dimension) {
    filters.push(`dimensionvalor = $${paramCount++}`);
    params.push(req.query.dimension);
  }
  
  const whereClause = filters.length > 0 ? ' WHERE ' + filters.join(' AND ') : '';
  return { whereClause, params };
}

// VENTAS
app.get('/api/ventas/stats', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'ventas');
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN importemonprincipal ~ '^[0-9.]+$' THEN CASE WHEN importemonprincipal ~ '^[0-9.]+$' THEN importemonprincipal::numeric ELSE 0 END ELSE 0 END), 0) as total_facturado,
        COUNT(*) as cantidad_facturas,
        COUNT(DISTINCT cliente) as clientes_unicos,
        COALESCE(AVG(CASE WHEN importemonprincipal ~ '^[0-9.]+$' THEN CASE WHEN importemonprincipal ~ '^[0-9.]+$' THEN importemonprincipal::numeric ELSE 0 END ELSE NULL END), 0) as promedio_factura
      FROM corporacion_analisisfacturadeventas2
      ${whereClause}
    `;
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ventas/evolucion', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'ventas');
    const query = `
      SELECT 
        TO_CHAR(fechacomprobante::date, 'YYYY-MM') as mes,
        SUM(CASE WHEN importemonprincipal ~ '^[0-9.]+$' THEN importemonprincipal::numeric ELSE 0 END) as total
      FROM corporacion_analisisfacturadeventas2
      ${whereClause}
      GROUP BY TO_CHAR(fechacomprobante::date, 'YYYY-MM')
      ORDER BY mes
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ventas/top-clientes', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'ventas');
    const query = `
      SELECT 
        cliente as nombre,
        SUM(CASE WHEN importemonprincipal ~ '^[0-9.]+$' THEN importemonprincipal::numeric ELSE 0 END) as total
      FROM corporacion_analisisfacturadeventas2
      ${whereClause}
      GROUP BY cliente
      ORDER BY total DESC
      LIMIT 10
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// COMPRAS
app.get('/api/compras/stats', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'compras');
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN importe_mon_principal ~ '^[0-9.]+$' THEN importe_mon_principal::numeric ELSE 0 END), 0) as total_compras,
        COUNT(*) as cantidad_facturas,
        COUNT(DISTINCT proveedor) as proveedores_unicos,
        COALESCE(AVG(CASE WHEN importe_mon_principal ~ '^[0-9.]+$' THEN importe_mon_principal::numeric ELSE 0 END), 0) as promedio_compra
      FROM corporacion_analisisfacturadecompras2
      ${whereClause}
    `;
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/compras/evolucion', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'compras');
    const query = `
      SELECT 
        TO_CHAR(fecha::date, 'YYYY-MM') as mes,
        SUM(CASE WHEN importe_mon_principal ~ '^[0-9.]+$' THEN importe_mon_principal::numeric ELSE 0 END) as total
      FROM corporacion_analisisfacturadecompras2
      ${whereClause}
      GROUP BY TO_CHAR(fecha::date, 'YYYY-MM')
      ORDER BY mes
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/compras/top-proveedores', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'compras');
    const query = `
      SELECT 
        proveedor as nombre,
        SUM(CASE WHEN importe_mon_principal ~ '^[0-9.]+$' THEN importe_mon_principal::numeric ELSE 0 END) as total
      FROM corporacion_analisisfacturadecompras2
      ${whereClause}
      GROUP BY proveedor
      ORDER BY total DESC
      LIMIT 10
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// FILTROS
app.get('/api/filtros/clientes', async (req, res) => {
  try {
    const query = `SELECT DISTINCT cliente as nombre FROM corporacion_analisisfacturadeventas2 WHERE cliente IS NOT NULL AND cliente != '' ORDER BY nombre LIMIT 100`;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/filtros/proveedores', async (req, res) => {
  try {
    const query = `SELECT DISTINCT proveedor as nombre FROM corporacion_analisisfacturadecompras2 WHERE proveedor IS NOT NULL AND proveedor != '' ORDER BY nombre LIMIT 100`;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/filtros/empresas', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT empresa as nombre FROM corporacion_analisisfacturadeventas2 WHERE empresa IS NOT NULL AND empresa != ''
      UNION
      SELECT DISTINCT empresa as nombre FROM corporacion_analisisfacturadecompras2 WHERE empresa IS NOT NULL AND empresa != ''
      ORDER BY nombre
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/filtros/dimensiones-ventas', async (req, res) => {
  try {
    const query = `SELECT DISTINCT dimensionvalor as nombre FROM corporacion_analisisfacturadeventas2 WHERE dimensionvalor IS NOT NULL AND dimensionvalor != '' ORDER BY nombre LIMIT 100`;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
