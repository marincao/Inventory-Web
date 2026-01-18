const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('docs'));

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'inventory_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Initialize database tables
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Create products table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        brand VARCHAR(100) NOT NULL,
        model VARCHAR(200) NOT NULL,
        capacity DECIMAL(10, 2) NOT NULL,
        capacity_unit ENUM('GB', 'TB') DEFAULT 'GB',
        interface VARCHAR(50),
        form_factor VARCHAR(50),
        read_speed INT,
        write_speed INT,
        nand_type VARCHAR(50),
        warranty_period VARCHAR(50),
        quantity INT DEFAULT 0,
        condition_status ENUM('in_stock', 'out_of_stock') DEFAULT 'in_stock',
        is_active BOOLEAN DEFAULT TRUE,
        unit_price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_product (brand, model, capacity, capacity_unit, interface, form_factor)
      )
    `);
    
    // Add capacity_unit column if it doesn't exist (for existing databases)
    try {
      // Check if column exists
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'products' 
        AND COLUMN_NAME = 'capacity_unit'
      `);
      
      if (columns.length === 0) {
        // Column doesn't exist, add it
        console.log('Adding capacity_unit column to products table...');
        await connection.query(`
          ALTER TABLE products 
          ADD COLUMN capacity_unit ENUM('GB', 'TB') DEFAULT 'GB' AFTER capacity
        `);
        console.log('capacity_unit column added successfully');
      } else {
        console.log('capacity_unit column already exists');
      }
    } catch (error) {
      console.error('Error checking/adding capacity_unit column:', error);
      // Try to continue anyway - column might exist but check failed
    }

    // Create inbound_transactions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inbound_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // Create outbound_transactions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS outbound_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    connection.release();
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// API Routes

// Get all products (current storage)
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Inbound - Add new product
app.post('/api/inbound', async (req, res) => {
  try {
      const {
        brand,
        model,
        capacity,
        capacity_unit,
        interface: interfaceType,
        form_factor,
        warranty_period,
        quantity,
        unit_price,
        condition_status,
        is_active,
        notes
      } = req.body;

    // Validate required fields
    if (!brand || !model || !capacity || !quantity || !unit_price) {
      return res.status(400).json({ 
        error: 'Missing required fields: brand, model, capacity, quantity, and unit_price are required' 
      });
    }

    // Validate data types
    if (isNaN(capacity) || capacity <= 0) {
      return res.status(400).json({ error: 'Capacity must be a positive number' });
    }
    if (isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer' });
    }
    if (isNaN(unit_price) || unit_price <= 0) {
      return res.status(400).json({ error: 'Unit price must be a positive number' });
    }

    console.log('Inbound request received:', { brand, model, capacity, capacity_unit, quantity, unit_price }); // Debug log

    let connection;
    try {
      connection = await pool.getConnection();
      console.log('Database connection acquired');
    } catch (connError) {
      console.error('Failed to get database connection:', connError);
      return res.status(500).json({ 
        error: 'Database connection failed: ' + connError.message 
      });
    }

    await connection.beginTransaction();

    try {
      // Ensure capacity_unit is valid (GB or TB)
      const validCapacityUnit = (capacity_unit === 'GB' || capacity_unit === 'TB') ? capacity_unit : 'GB';
      console.log('Received capacity_unit:', capacity_unit, 'Using:', validCapacityUnit); // Debug log
      
      // Check if product exists
      console.log('Checking for existing product...');
      const [existing] = await connection.query(
        'SELECT * FROM products WHERE brand = ? AND model = ? AND capacity = ? AND capacity_unit = ? AND interface = ? AND form_factor = ?',
        [brand, model, capacity, validCapacityUnit, interfaceType || null, form_factor || null]
      );
      console.log('Existing products found:', existing.length);

      let productId;
      let newQuantity;

      if (existing.length > 0) {
        // Update existing product
        productId = existing[0].id;
        newQuantity = existing[0].quantity + quantity;
        
        await connection.query(
          `UPDATE products 
           SET quantity = ?, 
               unit_price = ?,
               condition_status = ?,
               is_active = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [newQuantity, unit_price, condition_status || 'in_stock', is_active !== undefined ? is_active : true, productId]
        );
      } else {
        // Create new product
        const [result] = await connection.query(
          `INSERT INTO products 
           (brand, model, capacity, capacity_unit, interface, form_factor, warranty_period, 
            quantity, unit_price, condition_status, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            brand, model, capacity, validCapacityUnit, interfaceType, form_factor,
            warranty_period, quantity, unit_price, condition_status || 'in_stock',
            is_active !== undefined ? is_active : true
          ]
        );
        productId = result.insertId;
        newQuantity = quantity;
      }

      // Record inbound transaction
      console.log('Recording inbound transaction for product ID:', productId);
      await connection.query(
        'INSERT INTO inbound_transactions (product_id, quantity, unit_price, notes) VALUES (?, ?, ?, ?)',
        [productId, quantity, unit_price, notes || null]
      );

      await connection.commit();
      console.log('Transaction committed successfully');
      connection.release();

      res.json({
        success: true,
        message: 'New product added',
        productId,
        newQuantity
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error processing inbound:', error);
    console.error('Error stack:', error.stack); // Full stack trace for debugging
    res.status(500).json({ 
      error: 'Failed to process inbound transaction: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Outbound - Record sale
app.post('/api/outbound', async (req, res) => {
  try {
    const { product_id, quantity, unit_price, notes } = req.body;

    if (!product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Product ID and valid quantity are required' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Check product availability
      const [product] = await connection.query('SELECT * FROM products WHERE id = ?', [product_id]);
      
      if (product.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Product not found' });
      }

      if (product[0].quantity < quantity) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: 'Insufficient quantity in stock' });
      }

      // Update product quantity
      const newQuantity = product[0].quantity - quantity;
      const conditionStatus = newQuantity > 0 ? 'in_stock' : 'out_of_stock';

      await connection.query(
        'UPDATE products SET quantity = ?, condition_status = ? WHERE id = ?',
        [newQuantity, conditionStatus, product_id]
      );

      // Record outbound transaction
      await connection.query(
        'INSERT INTO outbound_transactions (product_id, quantity, unit_price, notes) VALUES (?, ?, ?, ?)',
        [product_id, quantity, unit_price || product[0].unit_price, notes || null]
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Outbound transaction recorded',
        remainingQuantity: newQuantity
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error processing outbound:', error);
    res.status(500).json({ error: 'Failed to process outbound transaction' });
  }
});

// Add quantity to existing product
app.post('/api/inbound/add-quantity', async (req, res) => {
  try {
    const { product_id, quantity, unit_price, notes } = req.body;

    if (!product_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Product ID and valid quantity are required' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Check if product exists
      const [product] = await connection.query('SELECT * FROM products WHERE id = ?', [product_id]);
      
      if (product.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: 'Product not found' });
      }

      // Update product quantity
      const newQuantity = product[0].quantity + quantity;
      const conditionStatus = newQuantity > 0 ? 'in_stock' : 'out_of_stock';

      await connection.query(
        'UPDATE products SET quantity = ?, condition_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newQuantity, conditionStatus, product_id]
      );

      // Record inbound transaction
      await connection.query(
        'INSERT INTO inbound_transactions (product_id, quantity, unit_price, notes) VALUES (?, ?, ?, ?)',
        [product_id, quantity, unit_price || product[0].unit_price, notes || null]
      );

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Quantity added successfully',
        newQuantity
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error adding quantity:', error);
    res.status(500).json({ error: 'Failed to add quantity' });
  }
});

// Get inbound transactions
app.get('/api/inbound', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT it.*, p.brand, p.model, p.capacity, p.capacity_unit 
       FROM inbound_transactions it
       JOIN products p ON it.product_id = p.id
       ORDER BY it.transaction_date DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching inbound transactions:', error);
    res.status(500).json({ error: 'Failed to fetch inbound transactions' });
  }
});

// Get outbound transactions
app.get('/api/outbound', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ot.*, p.brand, p.model, p.capacity, p.capacity_unit 
       FROM outbound_transactions ot
       JOIN products p ON ot.product_id = p.id
       ORDER BY ot.transaction_date DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching outbound transactions:', error);
    res.status(500).json({ error: 'Failed to fetch outbound transactions' });
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const { unit_price, condition_status, is_active } = req.body;
    const updates = [];
    const values = [];

    if (unit_price !== undefined) {
      updates.push('unit_price = ?');
      values.push(unit_price);
    }
    if (condition_status !== undefined) {
      updates.push('condition_status = ?');
      values.push(condition_status);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    await pool.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ success: true, message: 'Product updated' });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Get profit calculations
app.get('/api/profit', async (req, res) => {
  try {
    // Calculate profit for each outbound transaction
    // Profit = (sale_price - avg_cost) * quantity
    // Use product's unit_price as fallback cost if no inbound transactions exist
    const [rows] = await pool.query(
      `SELECT 
        ot.id as transaction_id,
        ot.product_id,
        ot.quantity as sold_quantity,
        ot.unit_price as sale_price,
        ot.transaction_date,
        p.brand,
        p.model,
        p.capacity,
        p.capacity_unit,
        p.unit_price as product_price,
        COALESCE(
          (SELECT AVG(unit_price) FROM inbound_transactions WHERE product_id = ot.product_id), 
          p.unit_price
        ) as avg_cost,
        (ot.unit_price - COALESCE(
          (SELECT AVG(unit_price) FROM inbound_transactions WHERE product_id = ot.product_id), 
          p.unit_price
        )) * ot.quantity as profit
       FROM outbound_transactions ot
       JOIN products p ON ot.product_id = p.id
       ORDER BY ot.transaction_date DESC`
    );

    // Process rows to ensure profit is always a number
    const processedRows = rows.map(row => {
      const profit = parseFloat(row.profit);
      const avgCost = parseFloat(row.avg_cost) || 0;
      const salePrice = parseFloat(row.sale_price) || 0;
      
      return {
        ...row,
        profit: isNaN(profit) ? 0 : profit,
        avg_cost: isNaN(avgCost) ? 0 : avgCost,
        sale_price: isNaN(salePrice) ? 0 : salePrice
      };
    });

    // Calculate totals
    const totalProfit = processedRows.reduce((sum, row) => {
      return sum + (row.profit || 0);
    }, 0);

    const totalRevenue = processedRows.reduce((sum, row) => {
      const revenue = (row.sale_price || 0) * parseInt(row.sold_quantity || 0);
      return sum + revenue;
    }, 0);

    res.json({
      transactions: processedRows,
      totalProfit: totalProfit,
      totalRevenue: totalRevenue,
      transactionCount: processedRows.length
    });
  } catch (error) {
    console.error('Error calculating profit:', error);
    res.status(500).json({ error: 'Failed to calculate profit: ' + error.message });
  }
});

// Get total profit summary
app.get('/api/profit/summary', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        COALESCE(SUM((ot.unit_price - COALESCE(
          (SELECT AVG(unit_price) FROM inbound_transactions WHERE product_id = ot.product_id), 
          p.unit_price
        )) * ot.quantity), 0) as total_profit
       FROM outbound_transactions ot
       JOIN products p ON ot.product_id = p.id`
    );

    const totalProfit = parseFloat(rows[0]?.total_profit) || 0;
    res.json({ totalProfit });
  } catch (error) {
    console.error('Error calculating profit summary:', error);
    res.status(500).json({ error: 'Failed to calculate profit summary: ' + error.message });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [productId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product: ' + error.message });
  }
});

// Test database connection
app.get('/api/debug/test-connection', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    res.json({ success: true, message: 'Database connection is working' });
  } catch (error) {
    console.error('Database connection test failed:', error);
    res.status(500).json({ 
      error: 'Database connection failed: ' + error.message,
      details: 'Check MySQL server is running and credentials are correct'
    });
  }
});

// Get all database data (for debugging)
app.get('/api/debug/data', async (req, res) => {
  try {
    console.log('Debug data endpoint called'); // Debug log
    
    // Test database connection first
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.ping();
      connection.release();
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return res.status(500).json({ 
        error: 'Database connection failed: ' + dbError.message,
        details: 'Please check: 1) MySQL server is running 2) Database credentials are correct 3) Database "inventory_db" exists'
      });
    }
    
    const [products] = await pool.query('SELECT * FROM products ORDER BY id');
    const [inbound] = await pool.query('SELECT * FROM inbound_transactions ORDER BY id');
    const [outbound] = await pool.query('SELECT * FROM outbound_transactions ORDER BY id');

    res.json({
      products: products,
      inbound_transactions: inbound,
      outbound_transactions: outbound,
      counts: {
        products: products.length,
        inbound: inbound.length,
        outbound: outbound.length
      }
    });
  } catch (error) {
    console.error('Error fetching debug data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch debug data: ' + error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Delete specific transaction
app.delete('/api/debug/transaction/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const tableName = type === 'inbound' ? 'inbound_transactions' : 'outbound_transactions';
    
    const [result] = await pool.query(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction: ' + error.message });
  }
});

// Delete all data (for debugging) - must be before static file route
app.delete('/api/debug/delete-all', async (req, res) => {
  console.log('Delete all data endpoint called'); // Debug log
  try {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete in order to respect foreign key constraints
      await connection.query('DELETE FROM outbound_transactions');
      await connection.query('DELETE FROM inbound_transactions');
      await connection.query('DELETE FROM products');

      await connection.commit();
      connection.release();

      console.log('All data deleted successfully'); // Debug log
      res.json({ success: true, message: 'All data deleted successfully' });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error deleting all data:', error);
    res.status(500).json({ error: 'Failed to delete all data: ' + error.message });
  }
});

// Serve frontend - This should be last
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
