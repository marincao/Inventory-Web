-- Inventory Management Database Schema
-- This file contains the complete database structure for deployment

CREATE DATABASE IF NOT EXISTS inventory_db;
USE inventory_db;

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(200) NOT NULL,
    capacity DECIMAL(10, 2) NOT NULL,
    capacity_unit ENUM('GB', 'TB') DEFAULT 'GB',
    interface VARCHAR(50),
    form_factor VARCHAR(50),
    warranty_period VARCHAR(50),
    quantity INT DEFAULT 0,
    condition_status ENUM('in_stock', 'out_of_stock') DEFAULT 'in_stock',
    is_active BOOLEAN DEFAULT TRUE,
    unit_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_product (brand, model, capacity, capacity_unit, interface, form_factor)
);

-- Inbound transactions table
CREATE TABLE IF NOT EXISTS inbound_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Outbound transactions table
CREATE TABLE IF NOT EXISTS outbound_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Add capacity_unit column if it doesn't exist (for existing databases)
-- This migration handles cases where the table was created before capacity_unit was added
SET @dbname = DATABASE();
SET @tablename = 'products';
SET @columnname = 'capacity_unit';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' ENUM(\'GB\', \'TB\') DEFAULT \'GB\' AFTER capacity')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
