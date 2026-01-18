const API_BASE = 'https://inventory-web-production.up.railway.app/api';

let debugData = null;

// Load debug data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadDebugData();
});

async function loadDebugData() {
    try {
        const response = await fetch(`${API_BASE}/debug/data`);
        
        if (!response.ok) {
            let errorMessage = `Failed to fetch debug data: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                // If response is not JSON, use status text
            }
            throw new Error(errorMessage);
        }
        
        debugData = await response.json();
        displayDebugData(debugData);
    } catch (error) {
        console.error('Error loading debug data:', error);
        const errorMsg = error.message || 'Unknown error. Please check: 1) Server is running 2) Database connection is active 3) Server was restarted after adding debug endpoints';
        showMessage(`Error loading data: ${errorMsg}`, 'error');
    }
}

function displayDebugData(data) {
    // Update counts
    document.getElementById('totalProductsCount').textContent = data.counts.products;
    document.getElementById('totalInboundCount').textContent = data.counts.inbound;
    document.getElementById('totalOutboundCount').textContent = data.counts.outbound;
    document.getElementById('productsCount').textContent = data.counts.products;
    document.getElementById('inboundCount').textContent = data.counts.inbound;
    document.getElementById('outboundCount').textContent = data.counts.outbound;

    // Display products
    displayProducts(data.products);
    
    // Display inbound transactions
    displayInboundTransactions(data.inbound_transactions);
    
    // Display outbound transactions
    displayOutboundTransactions(data.outbound_transactions);
}

function displayProducts(products) {
    const tbody = document.getElementById('productsTableBody');
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="loading">No products found</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(product => {
        const capacityDisplay = `${product.capacity} ${product.capacity_unit || 'GB'}`;
        const date = new Date(product.created_at);
        
        return `
            <tr>
                <td>${product.id}</td>
                <td>${product.brand || '-'}</td>
                <td>${product.model || '-'}</td>
                <td><strong>${capacityDisplay}</strong></td>
                <td>${product.interface || '-'}</td>
                <td>${product.form_factor || '-'}</td>
                <td>${product.quantity}</td>
                <td>$${parseFloat(product.unit_price).toFixed(2)}</td>
                <td><span class="status-badge status-${product.condition_status === 'in_stock' ? 'in-stock' : 'out-of-stock'}">${product.condition_status === 'in_stock' ? 'In Stock' : 'Out of Stock'}</span></td>
                <td><span class="active-badge active-${product.is_active ? 'yes' : 'no'}">${product.is_active ? 'Yes' : 'No'}</span></td>
                <td>${date.toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-danger btn-small delete-btn-small" onclick="deleteProduct(${product.id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function displayInboundTransactions(transactions) {
    const tbody = document.getElementById('inboundTableBody');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No inbound transactions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => {
        const date = new Date(transaction.transaction_date);
        const total = transaction.quantity * parseFloat(transaction.unit_price);
        
        return `
            <tr>
                <td>${transaction.id}</td>
                <td>${transaction.product_id}</td>
                <td>${transaction.quantity}</td>
                <td>$${parseFloat(transaction.unit_price).toFixed(2)}</td>
                <td>$${total.toFixed(2)}</td>
                <td>${date.toLocaleString()}</td>
                <td>${transaction.notes || '-'}</td>
                <td>
                    <button class="btn btn-danger btn-small delete-btn-small" onclick="deleteTransaction('inbound', ${transaction.id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

function displayOutboundTransactions(transactions) {
    const tbody = document.getElementById('outboundTableBody');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No outbound transactions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => {
        const date = new Date(transaction.transaction_date);
        const total = transaction.quantity * parseFloat(transaction.unit_price);
        
        return `
            <tr>
                <td>${transaction.id}</td>
                <td>${transaction.product_id}</td>
                <td>${transaction.quantity}</td>
                <td>$${parseFloat(transaction.unit_price).toFixed(2)}</td>
                <td>$${total.toFixed(2)}</td>
                <td>${date.toLocaleString()}</td>
                <td>${transaction.notes || '-'}</td>
                <td>
                    <button class="btn btn-danger btn-small delete-btn-small" onclick="deleteTransaction('outbound', ${transaction.id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function deleteProduct(productId) {
    const product = debugData?.products?.find(p => p.id === productId);
    if (!product) return;
    
    const capacityDisplay = `${product.capacity} ${product.capacity_unit || 'GB'}`;
    const confirmMessage = `Delete product "${product.brand} ${product.model} - ${capacityDisplay}"?\n\nThis will also delete all related transactions.`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete product');
        }
        
        showMessage('Product deleted successfully', 'success');
        loadDebugData();
    } catch (error) {
        console.error('Error deleting product:', error);
        showMessage(`Error: ${error.message}`, 'error');
    }
}

async function deleteTransaction(type, transactionId) {
    const confirmMessage = `Delete this ${type} transaction?`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        const response = await fetch(`${API_BASE}/debug/transaction/${type}/${transactionId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete transaction');
        }
        
        showMessage('Transaction deleted successfully', 'success');
        loadDebugData();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showMessage(`Error: ${error.message}`, 'error');
    }
}

async function deleteAllProducts() {
    if (!confirm('⚠️ Delete ALL products?\n\nThis will also delete all related transactions!\n\nThis cannot be undone!')) {
        return;
    }
    
    if (!confirm('Are you ABSOLUTELY sure?')) {
        return;
    }
    
    try {
        const products = debugData?.products || [];
        for (const product of products) {
            await fetch(`${API_BASE}/products/${product.id}`, { method: 'DELETE' });
        }
        
        showMessage('All products deleted successfully', 'success');
        loadDebugData();
    } catch (error) {
        console.error('Error deleting all products:', error);
        showMessage(`Error: ${error.message}`, 'error');
    }
}

async function deleteAllInbound() {
    if (!confirm('⚠️ Delete ALL inbound transactions?\n\nThis cannot be undone!')) {
        return;
    }
    
    try {
        const transactions = debugData?.inbound_transactions || [];
        for (const transaction of transactions) {
            await fetch(`${API_BASE}/debug/transaction/inbound/${transaction.id}`, { method: 'DELETE' });
        }
        
        showMessage('All inbound transactions deleted successfully', 'success');
        loadDebugData();
    } catch (error) {
        console.error('Error deleting all inbound:', error);
        showMessage(`Error: ${error.message}`, 'error');
    }
}

async function deleteAllOutbound() {
    if (!confirm('⚠️ Delete ALL outbound transactions?\n\nThis cannot be undone!')) {
        return;
    }
    
    try {
        const transactions = debugData?.outbound_transactions || [];
        for (const transaction of transactions) {
            await fetch(`${API_BASE}/debug/transaction/outbound/${transaction.id}`, { method: 'DELETE' });
        }
        
        showMessage('All outbound transactions deleted successfully', 'success');
        loadDebugData();
    } catch (error) {
        console.error('Error deleting all outbound:', error);
        showMessage(`Error: ${error.message}`, 'error');
    }
}

async function deleteAllData() {
    const confirmMessage = `⚠️ WARNING: This will delete ALL data in the database!\n\nThis includes:\n- All products\n- All inbound transactions\n- All outbound transactions\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    if (!confirm('Are you REALLY sure? This will delete EVERYTHING!')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/debug/delete-all`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            let errorMessage = 'Failed to delete all data';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        showMessage('All data deleted successfully!', 'success');
        loadDebugData();
    } catch (error) {
        console.error('Error deleting all data:', error);
        showMessage(`Failed to delete all data: ${error.message}`, 'error');
    }
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}
