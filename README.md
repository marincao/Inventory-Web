# SSD Inventory Management System

A web-based inventory management system for tracking SSD products with inbound and outbound transactions.

## Features

- **Storage Dashboard**: View all products with filtering and search capabilities
- **Inbound Management**: Add new products or update quantities for existing products
- **Outbound Management**: Record sales and automatically update inventory
- **Product Details**: Track SSD specifications including brand, model, capacity, interface, form factor, speeds, NAND type, warranty, and pricing

## Prerequisites

- Node.js (v14 or higher)
- MySQL Server (running on port 3306)
- Database: `inventory_db` (already created)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Make sure your MySQL database is running and the `inventory_db` database exists.

3. Update database credentials in `server.js` if needed (currently set to:
   - User: root
   - Password: 123456
   - Port: 3306
   - Database: inventory_db

## Running the Application

Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Database Schema

The application automatically creates the following tables on first run:

- **products**: Stores SSD product information
- **inbound_transactions**: Records incoming inventory
- **outbound_transactions**: Records sales/outgoing inventory

## API Endpoints

- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/inbound` - Add product or update quantity
- `POST /api/outbound` - Record sale
- `GET /api/inbound` - Get inbound transactions
- `GET /api/outbound` - Get outbound transactions
- `PUT /api/products/:id` - Update product details

## Usage

1. **View Storage**: Navigate to the main page to see all products in inventory
2. **Add Products**: Use the Inbound page to add new SSDs or increase quantities
3. **Record Sales**: Use the Outbound page to record when products are sold
