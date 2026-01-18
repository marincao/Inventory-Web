const API_BASE = 'https://marincao.github.io/Inventory-Web/';

let allProducts = [];

// Load inbound transactions and products on page load
document.addEventListener('DOMContentLoaded', () => {
    loadInboundTransactions();
    loadProducts();
    
    // Setup form submissions
    document.getElementById('newProductForm').addEventListener('submit', handleNewProductSubmit);
    document.getElementById('addQuantityForm').addEventListener('submit', handleAddQuantitySubmit);
    
    // Setup product selection change
    document.getElementById('existing_product_id').addEventListener('change', updateProductInfo);
});

async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        
        allProducts = await response.json();
        populateProductSelect();
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

function populateProductSelect() {
    const select = document.getElementById('existing_product_id');
    select.innerHTML = '<option value="">Select a product...</option>';
    
    allProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        const capacityDisplay = `${product.capacity} ${product.capacity_unit || 'GB'}`;
        option.textContent = `${product.brand} ${product.model} - ${capacityDisplay} (Current: ${product.quantity})`;
        option.dataset.product = JSON.stringify(product);
        select.appendChild(option);
    });
}

function updateProductInfo() {
    const select = document.getElementById('existing_product_id');
    const selectedOption = select.options[select.selectedIndex];
    const productInfo = document.getElementById('productInfo');
    const priceInput = document.getElementById('add_unit_price');
    
    if (selectedOption.value) {
        const product = JSON.parse(selectedOption.dataset.product);
        const capacityDisplay = `${product.capacity} ${product.capacity_unit || 'GB'}`;
        productInfo.textContent = `${product.brand} ${product.model} - ${capacityDisplay} | Current Price: $${parseFloat(product.unit_price).toFixed(2)}`;
        priceInput.value = product.unit_price;
    } else {
        productInfo.textContent = '';
        priceInput.value = '';
    }
}

function openNewProductModal() {
    document.getElementById('newProductModal').style.display = 'block';
}

function closeNewProductModal() {
    document.getElementById('newProductModal').style.display = 'none';
    document.getElementById('newProductForm').reset();
}

function openAddQuantityModal() {
    loadProducts();
    document.getElementById('addQuantityModal').style.display = 'block';
}

function closeAddQuantityModal() {
    document.getElementById('addQuantityModal').style.display = 'none';
    document.getElementById('addQuantityForm').reset();
    document.getElementById('productInfo').textContent = '';
}

// Close modals when clicking outside
window.onclick = function(event) {
    const newProductModal = document.getElementById('newProductModal');
    const addQuantityModal = document.getElementById('addQuantityModal');
    
    if (event.target === newProductModal) {
        closeNewProductModal();
    }
    if (event.target === addQuantityModal) {
        closeAddQuantityModal();
    }
}

async function handleNewProductSubmit(e) {
    e.preventDefault();
    
    const formData = {
        brand: document.getElementById('brand').value.trim(),
        model: document.getElementById('model').value.trim(),
        capacity: parseFloat(document.getElementById('capacity').value),
        capacity_unit: document.getElementById('capacity_unit').value,
        interface: document.getElementById('interface').value || null,
        form_factor: document.getElementById('form_factor').value || null,
        warranty_period: document.getElementById('warranty_period').value.trim() || null,
        quantity: parseInt(document.getElementById('quantity').value),
        unit_price: parseFloat(document.getElementById('unit_price').value),
        condition_status: document.getElementById('condition_status').value,
        is_active: document.getElementById('is_active').value === 'true',
        notes: document.getElementById('notes').value.trim() || null
    };
    
    try {
        const response = await fetch(`${API_BASE}/inbound`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            let errorMessage = 'Failed to process inbound transaction';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                if (errorData.details) {
                    console.error('Server error details:', errorData.details);
                }
            } catch (e) {
                errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        // Show success message
        showMessage(`Success! ${result.message}. Product ID: ${result.productId}, Quantity: ${result.newQuantity}`, 'success');
        
        // Close modal and reset form
        closeNewProductModal();
        
        // Reload transactions
        loadInboundTransactions();
        
    } catch (error) {
        console.error('Error processing new product:', error);
        showMessage(`Error: ${error.message}`, 'error');
    }
}

async function handleAddQuantitySubmit(e) {
    e.preventDefault();
    
    const productId = parseInt(document.getElementById('existing_product_id').value);
    const quantity = parseInt(document.getElementById('add_quantity').value);
    const unitPrice = document.getElementById('add_unit_price').value ? 
        parseFloat(document.getElementById('add_unit_price').value) : null;
    const notes = document.getElementById('add_notes').value.trim() || null;
    
    if (!productId || !quantity || quantity <= 0) {
        showMessage('Please select a product and enter a valid quantity', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/inbound/add-quantity`, {
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
            throw new Error(error.error || 'Failed to add quantity');
        }
        
        const result = await response.json();
        
        // Show success message
        showMessage(`Success! Quantity added. New total quantity: ${result.newQuantity}`, 'success');
        
        // Close modal and reset form
        closeAddQuantityModal();
        
        // Reload transactions
        loadInboundTransactions();
        
    } catch (error) {
        console.error('Error adding quantity:', error);
        showMessage(`Error: ${error.message}`, 'error');
    }
}

async function loadInboundTransactions() {
    try {
        const response = await fetch(`${API_BASE}/inbound`);
        if (!response.ok) throw new Error('Failed to fetch transactions');
        
        const transactions = await response.json();
        displayInboundTransactions(transactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
        document.getElementById('inboundTableBody').innerHTML = 
            '<tr><td colspan="8" class="loading">Error loading transactions. Please check your connection.</td></tr>';
    }
}

function displayInboundTransactions(transactions) {
    const tbody = document.getElementById('inboundTableBody');
    
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
