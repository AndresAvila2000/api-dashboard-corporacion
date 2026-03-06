// server.js - API Dashboard con queries directos
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

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
function buildFilters(req, baseWhere = '') {
  const filters = [];
  const params = [];
  let paramCount = 1;
  
  if (req.query.fecha_desde) {
    filters.push(`"BSTransaccion".FechaComprobante >= $${paramCount++}`);
    params.push(req.query.fecha_desde);
  }
  if (req.query.fecha_hasta) {
    filters.push(`"BSTransaccion".FechaComprobante <= $${paramCount++}`);
    params.push(req.query.fecha_hasta);
  }
  if (req.query.cliente) {
    filters.push(`"BSOrganizacion".Nombre ILIKE $${paramCount++}`);
    params.push(`%${req.query.cliente}%`);
  }
  if (req.query.proveedor) {
    filters.push(`"BSOrganizacion".Nombre ILIKE $${paramCount++}`);
    params.push(`%${req.query.proveedor}%`);
  }
  if (req.query.empresa) {
    filters.push(`"FAFEmpresa".Nombre = $${paramCount++}`);
    params.push(req.query.empresa);
  }
  if (req.query.dimension) {
    const dims = Array.isArray(req.query.dimension) ? req.query.dimension : [req.query.dimension];
    const dimPlaceholders = dims.map((_, i) => `$${paramCount++}`).join(',');
    filters.push(`"BSDimensionSeleccion".Nombre IN (${dimPlaceholders})`);
    params.push(...dims);
  }
  
  let whereClause = baseWhere;
  if (filters.length > 0) {
    whereClause += (baseWhere ? ' AND ' : ' WHERE ') + filters.join(' AND ');
  }
  
  return { whereClause, params, paramCount };
}

// ============================================
// VENTAS - STATS
// ============================================
app.get('/api/ventas/stats', async (req, res) => {
  try {
    const { whereClause, params } = buildFilters(req, `
      WHERE "FAFTransaccionCategoria".TransaccionCategoriaID IN (-8, -212, -222, -235)
      AND "BSOperacionItem".Tipo = 0
      AND "BSOrganizacion".EsCliente = 1
    `);
    
    const query = `
      SELECT 
        SUM("BSOperacionItem".ImporteMonPrincipal) as total_facturado,
        COUNT(DISTINCT "BSTransaccion".TransaccionID) as cantidad_facturas,
        COUNT(DISTINCT "BSOrganizacion".OrganizacionID) as clientes_unicos,
        AVG("BSOperacionItem".ImporteMonPrincipal) as promedio_factura
      FROM "BSTransaccion"
      INNER JOIN "FAFTransaccionSubtipo" ON "BSTransaccion".TransaccionSubtipoID = "FAFTransaccionSubtipo".TransaccionSubtipoID
      INNER JOIN "FAFTransaccionCategoria" ON "FAFTransaccionSubtipo".TransaccionCategoriaID = "FAFTransaccionCategoria".TransaccionCategoriaID
      INNER JOIN "BSOperacion" ON "BSTransaccion".TransaccionID = "BSOperacion".TransaccionID
      INNER JOIN "BSOperacion"Item ON "BSTransaccion".TransaccionID = "BSOperacionItem".TransaccionID
      INNER JOIN "BSOrganizacion" ON "BSOperacion".OrganizacionID = "BSOrganizacion".OrganizacionID
      LEFT JOIN "FAFEmpresa" ON "BSTransaccion".EmpresaID = "FAFEmpresa".EmpresaID
      LEFT JOIN "BSTransaccionDimension" ON "BSTransaccion".TransaccionID = "BSTransaccionDimension".TransaccionID
      LEFT JOIN "BSDimensionSeleccion" ON "BSTransaccionDimension".RegistroID = "BSDimensionSeleccion".RegistroID
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
    const { whereClause, params } = buildFilters(req, `
      WHERE "FAFTransaccionCategoria".TransaccionCategoriaID IN (-8, -212, -222, -235)
      AND "BSOperacionItem".Tipo = 0
      AND "BSOrganizacion".EsCliente = 1
    `);
    
    const query = `
      SELECT 
        TO_CHAR("BSTransaccion".FechaComprobante, 'YYYY-MM') as mes,
        SUM("BSOperacionItem".ImporteMonPrincipal) as total
      FROM "BSTransaccion"
      INNER JOIN "FAFTransaccionSubtipo" ON "BSTransaccion".TransaccionSubtipoID = "FAFTransaccionSubtipo".TransaccionSubtipoID
      INNER JOIN "FAFTransaccionCategoria" ON "FAFTransaccionSubtipo".TransaccionCategoriaID = "FAFTransaccionCategoria".TransaccionCategoriaID
      INNER JOIN "BSOperacion" ON "BSTransaccion".TransaccionID = "BSOperacion".TransaccionID
      INNER JOIN "BSOperacion"Item ON "BSTransaccion".TransaccionID = "BSOperacionItem".TransaccionID
      INNER JOIN "BSOrganizacion" ON "BSOperacion".OrganizacionID = "BSOrganizacion".OrganizacionID
      LEFT JOIN "FAFEmpresa" ON "BSTransaccion".EmpresaID = "FAFEmpresa".EmpresaID
      LEFT JOIN "BSTransaccionDimension" ON "BSTransaccion".TransaccionID = "BSTransaccionDimension".TransaccionID
      LEFT JOIN "BSDimensionSeleccion" ON "BSTransaccionDimension".RegistroID = "BSDimensionSeleccion".RegistroID
      ${whereClause}
      GROUP BY TO_CHAR("BSTransaccion".FechaComprobante, 'YYYY-MM')
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
    const { whereClause, params } = buildFilters(req, `
      WHERE "FAFTransaccionCategoria".TransaccionCategoriaID IN (-8, -212, -222, -235)
      AND "BSOperacionItem".Tipo = 0
      AND "BSOrganizacion".EsCliente = 1
    `);
    
    const query = `
      SELECT 
        "BSOrganizacion".Nombre as nombre,
        SUM("BSOperacionItem".ImporteMonPrincipal) as total
      FROM "BSTransaccion"
      INNER JOIN "FAFTransaccionSubtipo" ON "BSTransaccion".TransaccionSubtipoID = "FAFTransaccionSubtipo".TransaccionSubtipoID
      INNER JOIN "FAFTransaccionCategoria" ON "FAFTransaccionSubtipo".TransaccionCategoriaID = "FAFTransaccionCategoria".TransaccionCategoriaID
      INNER JOIN "BSOperacion" ON "BSTransaccion".TransaccionID = "BSOperacion".TransaccionID
      INNER JOIN "BSOperacion"Item ON "BSTransaccion".TransaccionID = "BSOperacionItem".TransaccionID
      INNER JOIN "BSOrganizacion" ON "BSOperacion".OrganizacionID = "BSOrganizacion".OrganizacionID
      LEFT JOIN "FAFEmpresa" ON "BSTransaccion".EmpresaID = "FAFEmpresa".EmpresaID
      LEFT JOIN "BSTransaccionDimension" ON "BSTransaccion".TransaccionID = "BSTransaccionDimension".TransaccionID
      LEFT JOIN "BSDimensionSeleccion" ON "BSTransaccionDimension".RegistroID = "BSDimensionSeleccion".RegistroID
      ${whereClause}
      GROUP BY "BSOrganizacion".Nombre
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
    const { whereClause, params } = buildFilters(req, `
      WHERE "FAFTransaccionCategoria".TransaccionCategoriaID IN (-8, -212, -222, -235)
      AND "BSOperacionItem".Tipo = 0
      AND "BSOrganizacion".EsCliente = 1
    `);
    
    const query = `
      SELECT 
        "BSTransaccion".FechaComprobante as fecha,
        "BSTransaccion".NumeroDocumento as numero_comprobante,
        "FAFTransaccionSubtipo".Nombre as tipo_comprobante,
        "BSOrganizacion".Nombre as cliente,
        "BSProducto".Nombre as producto,
        "BSOperacionItem".Descripcion as descripcion,
        "BSOperacionItem".ImporteMonPrincipal as importe_neto,
        "BSOperacionItem".ImporteGravado as impuestos,
        "BSOperacionItem".Importe as total,
        '' as observaciones
      FROM "BSTransaccion"
      INNER JOIN "FAFTransaccionSubtipo" ON "BSTransaccion".TransaccionSubtipoID = "FAFTransaccionSubtipo".TransaccionSubtipoID
      INNER JOIN "FAFTransaccionCategoria" ON "FAFTransaccionSubtipo".TransaccionCategoriaID = "FAFTransaccionCategoria".TransaccionCategoriaID
      INNER JOIN "BSOperacion" ON "BSTransaccion".TransaccionID = "BSOperacion".TransaccionID
      INNER JOIN "BSOperacion"Item ON "BSTransaccion".TransaccionID = "BSOperacionItem".TransaccionID
      INNER JOIN "BSOrganizacion" ON "BSOperacion".OrganizacionID = "BSOrganizacion".OrganizacionID
      LEFT JOIN "BSProducto" ON "BSOperacionItem".ProductoID = "BSProducto".ProductoID
      LEFT JOIN "FAFEmpresa" ON "BSTransaccion".EmpresaID = "FAFEmpresa".EmpresaID
      LEFT JOIN "BSTransaccionDimension" ON "BSTransaccion".TransaccionID = "BSTransaccionDimension".TransaccionID
      LEFT JOIN "BSDimensionSeleccion" ON "BSTransaccionDimension".RegistroID = "BSDimensionSeleccion".RegistroID
      ${whereClause}
      ORDER BY "BSTransaccion".FechaComprobante DESC
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
    const { whereClause, params } = buildFilters(req, `
      WHERE "FAFTransaccionCategoria".TransaccionCategoriaID IN (-10, -60)
      AND "BSOperacionItem".Tipo = 0
      AND "BSOrganizacion".EsProveedor = 1
    `);
    
    const query = `
      SELECT 
        SUM("BSOperacionItem".ImporteMonPrincipal) as total_compras,
        COUNT(DISTINCT "BSTransaccion".TransaccionID) as cantidad_facturas,
        COUNT(DISTINCT "BSOrganizacion".OrganizacionID) as proveedores_unicos,
        AVG("BSOperacionItem".ImporteMonPrincipal) as promedio_compra
      FROM "BSTransaccion"
      INNER JOIN "FAFTransaccionSubtipo" ON "BSTransaccion".TransaccionSubtipoID = "FAFTransaccionSubtipo".TransaccionSubtipoID
      INNER JOIN "FAFTransaccionCategoria" ON "FAFTransaccionSubtipo".TransaccionCategoriaID = "FAFTransaccionCategoria".TransaccionCategoriaID
      INNER JOIN "BSOperacion" ON "BSTransaccion".TransaccionID = "BSOperacion".TransaccionID
      INNER JOIN "BSOperacion"Item ON "BSTransaccion".TransaccionID = "BSOperacionItem".TransaccionID
      INNER JOIN "BSOrganizacion" ON "BSOperacion".OrganizacionID = "BSOrganizacion".OrganizacionID
      LEFT JOIN "FAFEmpresa" ON "BSTransaccion".EmpresaID = "FAFEmpresa".EmpresaID
      LEFT JOIN "BSTransaccionDimension" ON "BSTransaccion".TransaccionID = "BSTransaccionDimension".TransaccionID
      LEFT JOIN "BSDimensionSeleccion" ON "BSTransaccionDimension".RegistroID = "BSDimensionSeleccion".RegistroID
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
    const { whereClause, params } = buildFilters(req, `
      WHERE "FAFTransaccionCategoria".TransaccionCategoriaID IN (-10, -60)
      AND "BSOperacionItem".Tipo = 0
      AND "BSOrganizacion".EsProveedor = 1
    `);
    
    const query = `
      SELECT 
        TO_CHAR("BSTransaccion".Fecha, 'YYYY-MM') as mes,
        SUM("BSOperacionItem".ImporteMonPrincipal) as total
      FROM "BSTransaccion"
      INNER JOIN "FAFTransaccionSubtipo" ON "BSTransaccion".TransaccionSubtipoID = "FAFTransaccionSubtipo".TransaccionSubtipoID
      INNER JOIN "FAFTransaccionCategoria" ON "FAFTransaccionSubtipo".TransaccionCategoriaID = "FAFTransaccionCategoria".TransaccionCategoriaID
      INNER JOIN "BSOperacion" ON "BSTransaccion".TransaccionID = "BSOperacion".TransaccionID
      INNER JOIN "BSOperacion"Item ON "BSTransaccion".TransaccionID = "BSOperacionItem".TransaccionID
      INNER JOIN "BSOrganizacion" ON "BSOperacion".OrganizacionID = "BSOrganizacion".OrganizacionID
      LEFT JOIN "FAFEmpresa" ON "BSTransaccion".EmpresaID = "FAFEmpresa".EmpresaID
      LEFT JOIN "BSTransaccionDimension" ON "BSTransaccion".TransaccionID = "BSTransaccionDimension".TransaccionID
      LEFT JOIN "BSDimensionSeleccion" ON "BSTransaccionDimension".RegistroID = "BSDimensionSeleccion".RegistroID
      ${whereClause}
      GROUP BY TO_CHAR("BSTransaccion".Fecha, 'YYYY-MM')
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
    const { whereClause, params } = buildFilters(req, `
      WHERE "FAFTransaccionCategoria".TransaccionCategoriaID IN (-10, -60)
      AND "BSOperacionItem".Tipo = 0
      AND "BSOrganizacion".EsProveedor = 1
    `);
    
    const query = `
      SELECT 
        "BSOrganizacion".Nombre as nombre,
        SUM("BSOperacionItem".ImporteMonPrincipal) as total
      FROM "BSTransaccion"
      INNER JOIN "FAFTransaccionSubtipo" ON "BSTransaccion".TransaccionSubtipoID = "FAFTransaccionSubtipo".TransaccionSubtipoID
      INNER JOIN "FAFTransaccionCategoria" ON "FAFTransaccionSubtipo".TransaccionCategoriaID = "FAFTransaccionCategoria".TransaccionCategoriaID
      INNER JOIN "BSOperacion" ON "BSTransaccion".TransaccionID = "BSOperacion".TransaccionID
      INNER JOIN "BSOperacion"Item ON "BSTransaccion".TransaccionID = "BSOperacionItem".TransaccionID
      INNER JOIN "BSOrganizacion" ON "BSOperacion".OrganizacionID = "BSOrganizacion".OrganizacionID
      LEFT JOIN "FAFEmpresa" ON "BSTransaccion".EmpresaID = "FAFEmpresa".EmpresaID
      LEFT JOIN "BSTransaccionDimension" ON "BSTransaccion".TransaccionID = "BSTransaccionDimension".TransaccionID
      LEFT JOIN "BSDimensionSeleccion" ON "BSTransaccionDimension".RegistroID = "BSDimensionSeleccion".RegistroID
      ${whereClause}
      GROUP BY "BSOrganizacion".Nombre
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
    const { whereClause, params } = buildFilters(req, `
      WHERE "FAFTransaccionCategoria".TransaccionCategoriaID IN (-10, -60)
      AND "BSOperacionItem".Tipo = 0
      AND "BSOrganizacion".EsProveedor = 1
    `);
    
    const query = `
      SELECT 
        "BSTransaccion".Fecha as fecha,
        "BSTransaccion".NumeroDocumento as numero_comprobante,
        "FAFTransaccionSubtipo".Nombre as tipo_comprobante,
        "BSOrganizacion".Nombre as proveedor,
        "BSProducto".Nombre as producto,
        "BSOperacionItem".Descripcion as descripcion,
        "BSOperacionItem".ImporteMonPrincipal as importe_neto,
        "BSOperacionItem".ImporteGravado as impuestos,
        "BSOperacionItem".Importe as total,
        '' as observaciones
      FROM "BSTransaccion"
      INNER JOIN "FAFTransaccionSubtipo" ON "BSTransaccion".TransaccionSubtipoID = "FAFTransaccionSubtipo".TransaccionSubtipoID
      INNER JOIN "FAFTransaccionCategoria" ON "FAFTransaccionSubtipo".TransaccionCategoriaID = "FAFTransaccionCategoria".TransaccionCategoriaID
      INNER JOIN "BSOperacion" ON "BSTransaccion".TransaccionID = "BSOperacion".TransaccionID
      INNER JOIN "BSOperacion"Item ON "BSTransaccion".TransaccionID = "BSOperacionItem".TransaccionID
      INNER JOIN "BSOrganizacion" ON "BSOperacion".OrganizacionID = "BSOrganizacion".OrganizacionID
      LEFT JOIN "BSProducto" ON "BSOperacionItem".ProductoID = "BSProducto".ProductoID
      LEFT JOIN "FAFEmpresa" ON "BSTransaccion".EmpresaID = "FAFEmpresa".EmpresaID
      LEFT JOIN "BSTransaccionDimension" ON "BSTransaccion".TransaccionID = "BSTransaccionDimension".TransaccionID
      LEFT JOIN "BSDimensionSeleccion" ON "BSTransaccionDimension".RegistroID = "BSDimensionSeleccion".RegistroID
      ${whereClause}
      ORDER BY "BSTransaccion".Fecha DESC
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
      SELECT DISTINCT "BSOrganizacion".Nombre as nombre
      FROM BSOrganizacion
      WHERE "BSOrganizacion".EsCliente = 1
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
      SELECT DISTINCT "BSOrganizacion".Nombre as nombre
      FROM BSOrganizacion
      WHERE "BSOrganizacion".EsProveedor = 1
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
      SELECT DISTINCT "FAFEmpresa".Nombre as nombre
      FROM FAFEmpresa
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
      SELECT DISTINCT "BSDimensionSeleccion".Nombre as nombre
      FROM BSDimensionSeleccion
      INNER JOIN "BSTransaccionDimension" ON "BSDimensionSeleccion".RegistroID = "BSTransaccionDimension".RegistroID
      INNER JOIN BSTransaccion ON "BSTransaccionDimension".TransaccionID = "BSTransaccion".TransaccionID
      INNER JOIN "FAFTransaccionSubtipo" ON "BSTransaccion".TransaccionSubtipoID = "FAFTransaccionSubtipo".TransaccionSubtipoID
      INNER JOIN "FAFTransaccionCategoria" ON "FAFTransaccionSubtipo".TransaccionCategoriaID = "FAFTransaccionCategoria".TransaccionCategoriaID
      WHERE "FAFTransaccionCategoria".TransaccionCategoriaID IN (-8, -212, -222, -235)
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
      SELECT DISTINCT "BSDimensionSeleccion".Nombre as nombre
      FROM BSDimensionSeleccion
      INNER JOIN "BSTransaccionDimension" ON "BSDimensionSeleccion".RegistroID = "BSTransaccionDimension".RegistroID
      INNER JOIN BSTransaccion ON "BSTransaccionDimension".TransaccionID = "BSTransaccion".TransaccionID
      INNER JOIN "FAFTransaccionSubtipo" ON "BSTransaccion".TransaccionSubtipoID = "FAFTransaccionSubtipo".TransaccionSubtipoID
      INNER JOIN "FAFTransaccionCategoria" ON "FAFTransaccionSubtipo".TransaccionCategoriaID = "FAFTransaccionCategoria".TransaccionCategoriaID
      WHERE "FAFTransaccionCategoria".TransaccionCategoriaID IN (-10, -60)
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
