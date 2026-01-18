const API_BASE = 'http://localhost:3000/api';

let products = [];

// Load products and transactions on page load
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadOutboundTransactions();
    
    // Setup form submission
    document.getElementById('outboundForm').addEventListener('submit', handleOutboundSubmit);
    
    // Setup product selection change
    document.getElementById('product_id').addEventListener('change', updateProductInfo);
    document.getElementById('quantity').addEventListener('input', updateQuantityInfo);
});

async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        
        products = await response.json();
        populateProductSelect(products);
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function populateProductSelect(products) {
    const select = document.getElementById('product_id');
    select.innerHTML = '<option value="">Select a product...</option>';
    
    // Only show products that are in stock and active
    const availableProducts = products.filter(p => 
        p.condition_status === 'in_stock' && p.is_active && p.quantity > 0
    );
    
    availableProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        const capacityDisplay = `${product.capacity} ${product.capacity_unit || 'GB'}`;
        option.textContent = `${product.brand} ${product.model} - ${capacityDisplay} (Qty: ${product.quantity})`;
        option.dataset.product = JSON.stringify(product);
        select.appendChild(option);
    });
    
    if (availableProducts.length === 0) {
        select.innerHTML = '<option value="">No products available</option>';
    }
}

function updateProductInfo() {
    const select = document.getElementById('product_id');
    const selectedOption = select.options[select.selectedIndex];
    const productInfo = document.getElementById('productInfo');
    const quantityInput = document.getElementById('quantity');
    const unitPriceInput = document.getElementById('unit_price');
    
    if (selectedOption.value) {
        const product = JSON.parse(selectedOption.dataset.product);
        productInfo.textContent = `Available: ${product.quantity} units | Unit Price: $${parseFloat(product.unit_price).toFixed(2)}`;
        quantityInput.max = product.quantity;
        unitPriceInput.value = product.unit_price;
        quantityInput.value = '';
        updateQuantityInfo();
    } else {
        productInfo.textContent = '';
        quantityInput.max = '';
        unitPriceInput.value = '';
    }
}

function updateQuantityInfo() {
    const select = document.getElementById('product_id');
    const quantityInput = document.getElementById('quantity');
    const quantityInfo = document.getElementById('quantityInfo');
    
    if (select.value && quantityInput.value) {
        const selectedOption = select.options[select.selectedIndex];
        const product = JSON.parse(selectedOption.dataset.product);
        const quantity = parseInt(quantityInput.value);
        const maxQuantity = product.quantity;
        
        if (quantity > maxQuantity) {
            quantityInfo.textContent = `⚠️ Cannot exceed available quantity (${maxQuantity})`;
            quantityInfo.style.color = '#dc3545';
        } else if (quantity > 0) {
            const total = quantity * parseFloat(product.unit_price);
            quantityInfo.textContent = `Total: $${total.toFixed(2)}`;
            quantityInfo.style.color = '#666';
        } else {
            quantityInfo.textContent = '';
        }
    } else {
        quantityInfo.textContent = '';
    }
}

async function handleOutboundSubmit(e) {
    e.preventDefault();
    
    const productId = parseInt(document.getElementById('product_id').value);
    const quantity = parseInt(document.getElementById('quantity').value);
    const unitPrice = document.getElementById('unit_price').value ? 
        parseFloat(document.getElementById('unit_price').value) : null;
    const notes = document.getElementById('notes').value.trim() || null;
    
    if (!productId || !quantity || quantity <= 0) {
        showMessage('Please select a product and enter a valid quantity', 'error');
        return;
    }
    
    // Check quantity
    const selectedOption = document.getElementById('product_id').options[document.getElementById('product_id').selectedIndex];
    const product = JSON.parse(selectedOption.dataset.product);
    
    if (quantity > product.quantity) {
        showMessage(`Insufficient quantity. Available: ${product.quantity}`, 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/outbound`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: quantity,
                unit_price: unitPrice,
                notes: notes
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to process outbound transaction');
        }
        
        const result = await response.json();
        
        // Show success message
        showMessage(`Success! Sale recorded. Remaining quantity: ${result.remainingQuantity}`, 'success');
        
        // Reset form
        document.getElementById('outboundForm').reset();
        document.getElementById('productInfo').textContent = '';
        document.getElementById('quantityInfo').textContent = '';
        
        // Reload products and transactions
        loadProducts();
        loadOutboundTransactions();
        
        // Note: Profit page will need to be manually refreshed, or user can navigate to it
        
    } catch (error) {
        console.error('Error processing outbound:', error);
        showMessage(`Error: ${error.message}`, 'error');
    }
}

async function loadOutboundTransactions() {
    try {
        const response = await fetch(`${API_BASE}/outbound`);
        if (!response.ok) throw new Error('Failed to fetch transactions');
        
        const transactions = await response.json();
        displayOutboundTransactions(transactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
        document.getElementById('outboundTableBody').innerHTML = 
            '<tr><td colspan="8" class="loading">Error loading transactions. Please check your connection.</td></tr>';
    }
}

function displayOutboundTransactions(transactions) {
    const tbody = document.getElementById('outboundTableBody');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No transactions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => {
        const date = new Date(transaction.transaction_date);
        const total = transaction.quantity * parseFloat(transaction.unit_price);
        const capacityDisplay = `${transaction.capacity} ${transaction.capacity_unit || 'GB'}`;
        
        return `
            <tr>
                <td>${date.toLocaleString()}</td>
                <td>${transaction.brand || '-'}</td>
                <td>${transaction.model || '-'}</td>
                <td>${capacityDisplay}</td>
                <td>${transaction.quantity}</td>
                <td>$${parseFloat(transaction.unit_price).toFixed(2)}</td>
                <td><strong>$${total.toFixed(2)}</strong></td>
                <td>${transaction.notes || '-'}</td>
            </tr>
        `;
    }).join('');
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Hide message after 5 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}
