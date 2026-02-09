// server.js - VERSIÓN CORREGIDA
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = const HOST = '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL Aurora');
});

pool.on('error', (err) => {
  console.error('❌ Error en conexión a base de datos:', err);
});

// Helper function para manejar múltiples dimensiones y empresa
function buildWhereClause(params, filters) {
  let whereClause = '1=1';
  let paramCount = 1;
  const queryParams = [];

  if (filters.fecha_desde) {
    queryParams.push(filters.fecha_desde);
    whereClause += ` AND fecha::date >= $${paramCount++}::date`;
  }
  if (filters.fecha_hasta) {
    queryParams.push(filters.fecha_hasta);
    whereClause += ` AND fecha::date <= $${paramCount++}::date`;
  }
  if (filters.empresa) {
    queryParams.push(filters.empresa);
    whereClause += ` AND empresa = $${paramCount++}`;
  }
  if (filters.cliente) {
    queryParams.push(filters.cliente);
    whereClause += ` AND cliente = $${paramCount++}`;
  }
  if (filters.proveedor) {
    queryParams.push(filters.proveedor);
    whereClause += ` AND proveedor = $${paramCount++}`;
  }
  if (filters.dimension) {
    // Soporte para múltiples dimensiones
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

// ============================================
// ENDPOINTS DE VENTAS
// ============================================

// GET /api/ventas/stats - KPIs principales de ventas
app.get('/api/ventas/stats', async (req, res) => {
  try {
    const filters = {
      fecha_desde: req.query.fecha_desde,
      fecha_hasta: req.query.fecha_hasta,
      empresa: req.query.empresa,
      cliente: req.query.cliente,
      dimension: req.query.dimension
    };

    const { whereClause, queryParams } = buildWhereClause([], filters);

    const query = `
      SELECT 
        SUM(CASE WHEN importemonprincipal = 'NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total_facturado,
        COUNT(*) as cantidad_facturas,
        COUNT(DISTINCT cliente) as clientes_unicos,
        AVG(CASE WHEN importemonprincipal = 'NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as promedio_factura
      FROM corporacion_analisisfacturaventa
      WHERE ${whereClause}
    `;

    const result = await pool.query(query, queryParams);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error en /api/ventas/stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de ventas' });
  }
});

// GET /api/ventas/evolucion - Evolución mensual de ventas
app.get('/api/ventas/evolucion', async (req, res) => {
  try {
    const filters = {
      fecha_desde: req.query.fecha_desde,
      fecha_hasta: req.query.fecha_hasta,
      empresa: req.query.empresa,
      cliente: req.query.cliente,
      dimension: req.query.dimension
    };

    const { whereClause, queryParams } = buildWhereClause([], filters);

    const query = `
      SELECT 
        TO_CHAR(DATE_TRUNC('month', fecha::date), 'YYYY-MM') as mes,
        SUM(CASE WHEN importemonprincipal = 'NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total
      FROM corporacion_analisisfacturaventa
      WHERE ${whereClause}
      GROUP BY DATE_TRUNC('month', fecha::date)
      ORDER BY DATE_TRUNC('month', fecha::date)
    `;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/ventas/evolucion:', error);
    res.status(500).json({ error: 'Error al obtener evolución de ventas' });
  }
});

// GET /api/ventas/top-clientes - Top 10 clientes por facturación
app.get('/api/ventas/top-clientes', async (req, res) => {
  try {
    const filters = {
      fecha_desde: req.query.fecha_desde,
      fecha_hasta: req.query.fecha_hasta,
      empresa: req.query.empresa,
      dimension: req.query.dimension
    };

    const { whereClause, queryParams } = buildWhereClause([], filters);

    const query = `
      SELECT 
        cliente as nombre,
        SUM(CASE WHEN importemonprincipal = 'NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total
      FROM corporacion_analisisfacturaventa
      WHERE ${whereClause}
      GROUP BY cliente
      ORDER BY total DESC
      LIMIT 10
    `;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/ventas/top-clientes:', error);
    res.status(500).json({ error: 'Error al obtener top clientes' });
  }
});

// GET /api/ventas/analisis-comprobantes - Detalle de comprobantes de ventas
app.get('/api/ventas/analisis-comprobantes', async (req, res) => {
  try {
    const filters = {
      fecha_desde: req.query.fecha_desde,
      fecha_hasta: req.query.fecha_hasta,
      empresa: req.query.empresa,
      cliente: req.query.cliente,
      dimension: req.query.dimension
    };

    const limit = req.query.limit || 100;
    const { whereClause, queryParams } = buildWhereClause([], filters);

    const query = `
      SELECT 
        fechacomprobante as fecha,
        comprobante as numero_comprobante,
        transacciontiponombre as tipo_comprobante,
        cliente,
        producto,
        descitem as descripcion,
        CASE WHEN importemonprincipal = 'NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END as importe_neto,
        CASE WHEN gravado = 'NULL' OR gravado IS NULL THEN 0 ELSE gravado::numeric END as impuestos,
        CASE WHEN total = 'NULL' OR total IS NULL THEN 0 ELSE total::numeric END as total,
        '' as observaciones
      FROM corporacion_analisisfacturaventa
      WHERE ${whereClause}
      ORDER BY fechacomprobante DESC, comprobante DESC
      LIMIT $${queryParams.length + 1}
    `;

    queryParams.push(limit);
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/ventas/analisis-comprobantes:', error);
    res.status(500).json({ error: 'Error al obtener análisis de comprobantes de ventas' });
  }
});

// ============================================
// ENDPOINTS DE COMPRAS
// ============================================

// GET /api/compras/stats - KPIs principales de compras
app.get('/api/compras/stats', async (req, res) => {
  try {
    const filters = {
      fecha_desde: req.query.fecha_desde,
      fecha_hasta: req.query.fecha_hasta,
      empresa: req.query.empresa,
      proveedor: req.query.proveedor,
      dimension: req.query.dimension
    };

    const { whereClause, queryParams } = buildWhereClause([], filters);

    const query = `
      SELECT 
        SUM(CASE WHEN importemonprincipal = 'NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total_compras,
        COUNT(*) as cantidad_facturas,
        COUNT(DISTINCT proveedor) as proveedores_unicos,
        AVG(CASE WHEN importemonprincipal = 'NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as promedio_compra
      FROM corporacion_analisisfacturacompra
      WHERE ${whereClause}
    `;

    const result = await pool.query(query, queryParams);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error en /api/compras/stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de compras' });
  }
});

// GET /api/compras/evolucion - Evolución mensual de compras
app.get('/api/compras/evolucion', async (req, res) => {
  try {
    const filters = {
      fecha_desde: req.query.fecha_desde,
      fecha_hasta: req.query.fecha_hasta,
      empresa: req.query.empresa,
      proveedor: req.query.proveedor,
      dimension: req.query.dimension
    };

    const { whereClause, queryParams } = buildWhereClause([], filters);

    const query = `
      SELECT 
        TO_CHAR(DATE_TRUNC('month', fecha::date), 'YYYY-MM') as mes,
        SUM(CASE WHEN importemonprincipal = 'NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total
      FROM corporacion_analisisfacturacompra
      WHERE ${whereClause}
      GROUP BY DATE_TRUNC('month', fecha::date)
      ORDER BY DATE_TRUNC('month', fecha::date)
    `;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/compras/evolucion:', error);
    res.status(500).json({ error: 'Error al obtener evolución de compras' });
  }
});

// GET /api/compras/top-proveedores - Top 10 proveedores por compras
app.get('/api/compras/top-proveedores', async (req, res) => {
  try {
    const filters = {
      fecha_desde: req.query.fecha_desde,
      fecha_hasta: req.query.fecha_hasta,
      empresa: req.query.empresa,
      dimension: req.query.dimension
    };

    const { whereClause, queryParams } = buildWhereClause([], filters);

    const query = `
      SELECT 
        proveedor as nombre,
        SUM(CASE WHEN importemonprincipal = 'NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END) as total
      FROM corporacion_analisisfacturacompra
      WHERE ${whereClause}
      GROUP BY proveedor
      ORDER BY total DESC
      LIMIT 10
    `;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/compras/top-proveedores:', error);
    res.status(500).json({ error: 'Error al obtener top proveedores' });
  }
});

// GET /api/compras/analisis-comprobantes - Detalle de comprobantes de compras
app.get('/api/compras/analisis-comprobantes', async (req, res) => {
  try {
    const filters = {
      fecha_desde: req.query.fecha_desde,
      fecha_hasta: req.query.fecha_hasta,
      empresa: req.query.empresa,
      proveedor: req.query.proveedor,
      dimension: req.query.dimension
    };

    const limit = req.query.limit || 100;
    const { whereClause, queryParams } = buildWhereClause([], filters);

    const query = `
      SELECT 
        fechacomprobante as fecha,
        comprobante as numero_comprobante,
        transacciontiponombre as tipo_comprobante,
        proveedor,
        producto,
        descitem as descripcion,
        CASE WHEN importemonprincipal = 'NULL' OR importemonprincipal IS NULL THEN 0 ELSE importemonprincipal::numeric END as importe_neto,
        CASE WHEN gravado = 'NULL' OR gravado IS NULL THEN 0 ELSE gravado::numeric END as impuestos,
        CASE WHEN total = 'NULL' OR total IS NULL THEN 0 ELSE total::numeric END as total,
        '' as observaciones
      FROM corporacion_analisisfacturacompra
      WHERE ${whereClause}
      ORDER BY fechacomprobante DESC, comprobante DESC
      LIMIT $${queryParams.length + 1}
    `;

    queryParams.push(limit);
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/compras/analisis-comprobantes:', error);
    res.status(500).json({ error: 'Error al obtener análisis de comprobantes de compras' });
  }
});

// ============================================
// ENDPOINTS DE FILTROS
// ============================================

// GET /api/filtros/clientes - Lista de clientes para filtros
app.get('/api/filtros/clientes', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT cliente as nombre
      FROM corporacion_analisisfacturaventa
      WHERE cliente IS NOT NULL
      ORDER BY cliente
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/clientes:', error);
    res.status(500).json({ error: 'Error al obtener lista de clientes' });
  }
});

// GET /api/filtros/proveedores - Lista de proveedores para filtros
app.get('/api/filtros/proveedores', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT proveedor as nombre
      FROM corporacion_analisisfacturacompra
      WHERE proveedor IS NOT NULL
      ORDER BY proveedor
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/proveedores:', error);
    res.status(500).json({ error: 'Error al obtener lista de proveedores' });
  }
});

// GET /api/filtros/dimensiones-ventas - Lista de dimensiones de ventas
app.get('/api/filtros/dimensiones-ventas', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT dimensionvalor as nombre
      FROM corporacion_analisisfacturaventa
      WHERE dimensionvalor IS NOT NULL
      ORDER BY dimensionvalor
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/dimensiones-ventas:', error);
    res.status(500).json({ error: 'Error al obtener dimensiones de ventas' });
  }
});

// GET /api/filtros/dimensiones-compras - Lista de dimensiones de compras
app.get('/api/filtros/dimensiones-compras', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT dimensionvalor as nombre
      FROM corporacion_analisisfacturacompra
      WHERE dimensionvalor IS NOT NULL
      ORDER BY dimensionvalor
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/dimensiones-compras:', error);
    res.status(500).json({ error: 'Error al obtener dimensiones de compras' });
  }
});

// GET /api/filtros/empresas - Lista de empresas
app.get('/api/filtros/empresas', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT empresa as nombre FROM corporacion_analisisfacturaventa WHERE empresa IS NOT NULL
      UNION
      SELECT DISTINCT empresa as nombre FROM corporacion_analisisfacturacompra WHERE empresa IS NOT NULL
      ORDER BY nombre
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/empresas:', error);
    res.status(500).json({ error: 'Error al obtener lista de empresas' });
  }
});

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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'API Dashboard Corporación del Sur',
    version: '2.0.0',
    endpoints: {
      ventas: [
        'GET /api/ventas/stats',
        'GET /api/ventas/evolucion',
        'GET /api/ventas/top-clientes',
        'GET /api/ventas/analisis-comprobantes'
      ],
      compras: [
        'GET /api/compras/stats',
        'GET /api/compras/evolucion',
        'GET /api/compras/top-proveedores',
        'GET /api/compras/analisis-comprobantes'
      ],
      filtros: [
        'GET /api/filtros/clientes',
        'GET /api/filtros/proveedores',
        'GET /api/filtros/dimensiones-ventas',
        'GET /api/filtros/dimensiones-compras',
        'GET /api/filtros/empresas'
      ]
    }
  });
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 API Dashboard: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
  pool.end();
  process.exit(0);
});
