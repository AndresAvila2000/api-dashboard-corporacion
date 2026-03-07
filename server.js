// server.js - API Dashboard Corporación del Sur
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

pool.on('connect', () => console.log('✅ Conectado a PostgreSQL'));
pool.on('error', (err) => console.error('❌ Error en BD:', err));

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// ============================================
// HELPERS
// ============================================
function buildFilters(req, tableName) {
  const filters = [];
  const params = [];
  let paramCount = 1;
  
  const isVentas = tableName.includes('ventas');
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
    filters.push(`cliente ILIKE $${paramCount++}`);
    params.push(`%${req.query.cliente}%`);
  }
  if (req.query.proveedor && !isVentas) {
    filters.push(`proveedor ILIKE $${paramCount++}`);
    params.push(`%${req.query.proveedor}%`);
  }
  if (req.query.empresa) {
    filters.push(`empresa = $${paramCount++}`);
    params.push(req.query.empresa);
  }
  if (req.query.dimension) {
    const dims = Array.isArray(req.query.dimension) ? req.query.dimension : [req.query.dimension];
    const dimPlaceholders = dims.map((_, i) => `$${paramCount++}`).join(',');
    filters.push(`dimensionvalor IN (${dimPlaceholders})`);
    params.push(...dims);
  }
  
  const whereClause = filters.length > 0 ? ' WHERE ' + filters.join(' AND ') : '';
  return { whereClause, params };
}

// ============================================
// VENTAS - STATS
// ============================================
app.get('/api/ventas/stats', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'ventas');
    
    const query = `
      SELECT 
        SUM(importemonprincipal) as total_facturado,
        COUNT(DISTINCT comprobante) as cantidad_facturas,
        COUNT(DISTINCT cliente) as clientes_unicos,
        AVG(importemonprincipal) as promedio_factura
      FROM corporacion_analisis_de_facturas_de_ventas_2
      ${whereClause}
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error en /api/ventas/stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de ventas' });
  }
});

// ============================================
// VENTAS - EVOLUCIÓN MENSUAL
// ============================================
app.get('/api/ventas/evolucion', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'ventas');
    
    const query = `
      SELECT 
        TO_CHAR(fechacomprobante, 'YYYY-MM') as mes,
        SUM(importemonprincipal) as total
      FROM corporacion_analisis_de_facturas_de_ventas_2
      ${whereClause}
      GROUP BY TO_CHAR(fechacomprobante, 'YYYY-MM')
      ORDER BY mes
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/ventas/evolucion:', error);
    res.status(500).json({ error: 'Error al obtener evolución de ventas' });
  }
});

// ============================================
// VENTAS - TOP CLIENTES
// ============================================
app.get('/api/ventas/top-clientes', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'ventas');
    
    const query = `
      SELECT 
        cliente as nombre,
        SUM(importemonprincipal) as total
      FROM corporacion_analisis_de_facturas_de_ventas_2
      ${whereClause}
      GROUP BY cliente
      ORDER BY total DESC
      LIMIT 10
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/ventas/top-clientes:', error);
    res.status(500).json({ error: 'Error al obtener top clientes' });
  }
});

// ============================================
// VENTAS - ANÁLISIS COMPROBANTES
// ============================================
app.get('/api/ventas/analisis-comprobantes', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'ventas');
    
    const query = `
      SELECT 
        fechacomprobante as fecha,
        comprobante as numero_comprobante,
        transaccionsubtiponombre as tipo_comprobante,
        cliente,
        producto,
        descitem as descripcion,
        importemonprincipal as importe_neto,
        gravado as impuestos,
        total,
        '' as observaciones
      FROM corporacion_analisis_de_facturas_de_ventas_2
      ${whereClause}
      ORDER BY fechacomprobante DESC
      LIMIT 100
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/ventas/analisis-comprobantes:', error);
    res.status(500).json({ error: 'Error al obtener análisis de comprobantes' });
  }
});

// ============================================
// COMPRAS - STATS
// ============================================
app.get('/api/compras/stats', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'compras');
    
    const query = `
      SELECT 
        SUM(importe_mon_principal) as total_compras,
        COUNT(DISTINCT comprobante) as cantidad_facturas,
        COUNT(DISTINCT proveedor) as proveedores_unicos,
        AVG(importe_mon_principal) as promedio_compra
      FROM corporacion_analisis_de_facturas_de_compras_2
      ${whereClause}
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error en /api/compras/stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de compras' });
  }
});

// ============================================
// COMPRAS - EVOLUCIÓN MENSUAL
// ============================================
app.get('/api/compras/evolucion', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'compras');
    
    const query = `
      SELECT 
        TO_CHAR(fecha, 'YYYY-MM') as mes,
        SUM(importe_mon_principal) as total
      FROM corporacion_analisis_de_facturas_de_compras_2
      ${whereClause}
      GROUP BY TO_CHAR(fecha, 'YYYY-MM')
      ORDER BY mes
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/compras/evolucion:', error);
    res.status(500).json({ error: 'Error al obtener evolución de compras' });
  }
});

// ============================================
// COMPRAS - TOP PROVEEDORES
// ============================================
app.get('/api/compras/top-proveedores', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'compras');
    
    const query = `
      SELECT 
        proveedor as nombre,
        SUM(importe_mon_principal) as total
      FROM corporacion_analisis_de_facturas_de_compras_2
      ${whereClause}
      GROUP BY proveedor
      ORDER BY total DESC
      LIMIT 10
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/compras/top-proveedores:', error);
    res.status(500).json({ error: 'Error al obtener top proveedores' });
  }
});

// ============================================
// COMPRAS - ANÁLISIS COMPROBANTES
// ============================================
app.get('/api/compras/analisis-comprobantes', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, 'compras');
    
    const query = `
      SELECT 
        fecha,
        comprobante as numero_comprobante,
        descripcion as tipo_comprobante,
        proveedor,
        producto,
        descripcion,
        importe_mon_principal as importe_neto,
        gravado as impuestos,
        importe as total,
        '' as observaciones
      FROM corporacion_analisis_de_facturas_de_compras_2
      ${whereClause}
      ORDER BY fecha DESC
      LIMIT 100
    `;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/compras/analisis-comprobantes:', error);
    res.status(500).json({ error: 'Error al obtener análisis de comprobantes' });
  }
});

// ============================================
// FILTROS - CLIENTES
// ============================================
app.get('/api/filtros/clientes', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT cliente as nombre
      FROM corporacion_analisis_de_facturas_de_ventas_2
      WHERE cliente IS NOT NULL AND cliente != ''
      ORDER BY nombre
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// ============================================
// FILTROS - PROVEEDORES
// ============================================
app.get('/api/filtros/proveedores', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT proveedor as nombre
      FROM corporacion_analisis_de_facturas_de_compras_2
      WHERE proveedor IS NOT NULL AND proveedor != ''
      ORDER BY nombre
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/proveedores:', error);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

// ============================================
// FILTROS - EMPRESAS
// ============================================
app.get('/api/filtros/empresas', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT empresa as nombre
      FROM (
        SELECT empresa FROM corporacion_analisis_de_facturas_de_ventas_2
        UNION
        SELECT empresa FROM corporacion_analisis_de_facturas_de_compras_2
      ) AS combined
      WHERE empresa IS NOT NULL AND empresa != ''
      ORDER BY nombre
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/empresas:', error);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

// ============================================
// FILTROS - DIMENSIONES VENTAS
// ============================================
app.get('/api/filtros/dimensiones-ventas', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT dimensionvalor as nombre
      FROM corporacion_analisis_de_facturas_de_ventas_2
      WHERE dimensionvalor IS NOT NULL AND dimensionvalor != ''
      ORDER BY nombre
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/dimensiones-ventas:', error);
    res.status(500).json({ error: 'Error al obtener dimensiones de ventas' });
  }
});

// ============================================
// FILTROS - DIMENSIONES COMPRAS
// ============================================
app.get('/api/filtros/dimensiones-compras', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT COALESCE(dimensionvalor, '') as nombre
      FROM corporacion_analisis_de_facturas_de_compras_2
      WHERE dimensionvalor IS NOT NULL AND dimensionvalor != ''
      ORDER BY nombre
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/dimensiones-compras:', error);
    res.status(500).json({ error: 'Error al obtener dimensiones de compras' });
  }
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 API Dashboard: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health\n`);
});

