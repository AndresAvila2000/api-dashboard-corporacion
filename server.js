// server.js - API Dashboard Corporación del Sur - VERSIÓN FINAL
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

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// ============================================
// VENTAS
// ============================================
app.get('/api/ventas/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COALESCE(SUM(importemonprincipal), 0) as total_facturado,
        COUNT(*) as cantidad_facturas,
        COUNT(DISTINCT cliente) as clientes_unicos,
        COALESCE(AVG(importemonprincipal), 0) as promedio_factura
      FROM corporacion_analisis_de_facturas_de_ventas_2
    `;
    const result = await pool.query(query);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error en /api/ventas/stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ventas/evolucion', async (req, res) => {
  try {
    const query = `
      SELECT 
        TO_CHAR(fechacomprobante::date, 'YYYY-MM') as mes,
        SUM(importemonprincipal) as total
      FROM corporacion_analisis_de_facturas_de_ventas_2
      WHERE fechacomprobante IS NOT NULL
      GROUP BY TO_CHAR(fechacomprobante::date, 'YYYY-MM')
      ORDER BY mes
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/ventas/evolucion:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ventas/top-clientes', async (req, res) => {
  try {
    const query = `
      SELECT 
        cliente as nombre,
        SUM(importemonprincipal) as total
      FROM corporacion_analisis_de_facturas_de_ventas_2
      WHERE cliente IS NOT NULL
      GROUP BY cliente
      ORDER BY total DESC
      LIMIT 10
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/ventas/top-clientes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ventas/analisis-comprobantes', async (req, res) => {
  try {
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
      ORDER BY fechacomprobante DESC
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/ventas/analisis-comprobantes:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// COMPRAS
// ============================================
app.get('/api/compras/stats', async (req, res) => {
  try {
    const query = `
      SELECT 
        COALESCE(SUM(importe_mon_principal), 0) as total_compras,
        COUNT(*) as cantidad_facturas,
        COUNT(DISTINCT proveedor) as proveedores_unicos,
        COALESCE(AVG(importe_mon_principal), 0) as promedio_compra
      FROM corporacion_analisis_de_facturas_de_compras_2
    `;
    const result = await pool.query(query);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error en /api/compras/stats:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/compras/evolucion', async (req, res) => {
  try {
    const query = `
      SELECT 
        TO_CHAR(fecha::date, 'YYYY-MM') as mes,
        SUM(importe_mon_principal) as total
      FROM corporacion_analisis_de_facturas_de_compras_2
      WHERE fecha IS NOT NULL
      GROUP BY TO_CHAR(fecha::date, 'YYYY-MM')
      ORDER BY mes
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/compras/evolucion:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/compras/top-proveedores', async (req, res) => {
  try {
    const query = `
      SELECT 
        proveedor as nombre,
        SUM(importe_mon_principal) as total
      FROM corporacion_analisis_de_facturas_de_compras_2
      WHERE proveedor IS NOT NULL
      GROUP BY proveedor
      ORDER BY total DESC
      LIMIT 10
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/compras/top-proveedores:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/compras/analisis-comprobantes', async (req, res) => {
  try {
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
      ORDER BY fecha DESC
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/compras/analisis-comprobantes:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FILTROS
// ============================================
app.get('/api/filtros/clientes', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT cliente as nombre
      FROM corporacion_analisis_de_facturas_de_ventas_2
      WHERE cliente IS NOT NULL
      ORDER BY nombre
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/clientes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/filtros/proveedores', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT proveedor as nombre
      FROM corporacion_analisis_de_facturas_de_compras_2
      WHERE proveedor IS NOT NULL
      ORDER BY nombre
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/proveedores:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/filtros/empresas', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT empresa as nombre
      FROM corporacion_analisis_de_facturas_de_ventas_2
      WHERE empresa IS NOT NULL
      UNION
      SELECT DISTINCT empresa as nombre
      FROM corporacion_analisis_de_facturas_de_compras_2
      WHERE empresa IS NOT NULL
      ORDER BY nombre
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/empresas:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/filtros/dimensiones-ventas', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT dimensionvalor as nombre
      FROM corporacion_analisis_de_facturas_de_ventas_2
      WHERE dimensionvalor IS NOT NULL
      ORDER BY nombre
      LIMIT 100
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/dimensiones-ventas:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/filtros/dimensiones-compras', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT 'Sin dimension' as nombre
      LIMIT 1
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en /api/filtros/dimensiones-compras:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 API Dashboard: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health\n`);
});
