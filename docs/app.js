const API_BASE = 'http://localhost:3000/api';

let allProducts = [];

// Load products on page load
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadTotalProfit();
    
    // Setup search and filters
    document.getElementById('searchInput').addEventListener('input', filterProducts);
    document.getElementById('statusFilter').addEventListener('change', filterProducts);
    document.getElementById('activeFilter').addEventListener('change', filterProducts);
});

async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`);
        if (!response.ok) throw new Error('Failed to fetch products');
        
        allProducts = await response.json();
        displayProducts(allProducts);
        updateStats(allProducts);
    } catch (error) {
        console.error('Error loading products:', error);
        document.getElementById('productsTableBody').innerHTML = 
            '<tr><td colspan="12" class="loading">Error loading products. Please check your connection.</td></tr>';
    }
}

async function loadTotalProfit() {
    try {
        const response = await fetch(`${API_BASE}/profit/summary`);
        if (!response.ok) throw new Error('Failed to fetch profit');
        
        const data = await response.json();
        const profit = data.totalProfit || 0;
        document.getElementById('totalProfit').textContent = `$${profit.toFixed(2)}`;
        
        // Update profit stat card color based on profit
        const profitCard = document.getElementById('totalProfit').closest('.stat-card');
        if (profit >= 0) {
            profitCard.classList.add('stat-profit-positive');
        } else {
            profitCard.classList.add('stat-profit-negative');
        }
    } catch (error) {
        console.error('Error loading profit:', error);
        document.getElementById('totalProfit').textContent = '$0.00';
    }
}

function displayProducts(products) {
    const tbody = document.getElementById('productsTableBody');
    
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="loading">No products found</td></tr>';
        return;
    }
    
    tbody.innerHTML = products.map(product => {
        const capacityDisplay = `${product.capacity} ${product.capacity_unit || 'GB'}`;
        const newStatus = product.condition_status === 'in_stock' ? 'out_of_stock' : 'in_stock';
        const newActive = !product.is_active;
        return `
        <tr>
            <td>${product.brand || '-'}</td>
            <td>${product.model || '-'}</td>
            <td><strong>${capacityDisplay}</strong></td>
            <td>${product.interface || '-'}</td>
            <td>${product.form_factor || '-'}</td>
            <td>${product.warranty_period || '-'}</td>
            <td><strong>${product.quantity}</strong></td>
            <td>$${parseFloat(product.unit_price).toFixed(2)}</td>
            <td><strong>$${(product.quantity * parseFloat(product.unit_price)).toFixed(2)}</strong></td>
            <td><span class="status-badge status-${product.condition_status === 'in_stock' ? 'in-stock' : 'out-of-stock'} clickable-badge" onclick="toggleStatus(${product.id}, '${newStatus}')" title="Click to toggle">${product.condition_status === 'in_stock' ? 'In Stock' : 'Out of Stock'}</span></td>
            <td><span class="active-badge active-${product.is_active ? 'yes' : 'no'} clickable-badge" onclick="toggleActive(${product.id}, ${newActive})" title="Click to toggle">${product.is_active ? 'Yes' : 'No'}</span></td>
            <td>
                <button class="btn btn-primary btn-small" onclick="openEditModal(${product.id})">Edit</button>
            </td>
        </tr>
    `;
    }).join('');
}

function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const activeFilter = document.getElementById('activeFilter').value;
    
    let filtered = allProducts.filter(product => {
        const matchesSearch = !searchTerm || 
            product.brand?.toLowerCase().includes(searchTerm) ||
            product.model?.toLowerCase().includes(searchTerm) ||
            product.capacity?.toLowerCase().includes(searchTerm);
        
        const matchesStatus = statusFilter === 'all' || product.condition_status === statusFilter;
        
        const matchesActive = activeFilter === 'all' || 
            (activeFilter === 'active' && product.is_active) ||
            (activeFilter === 'inactive' && !product.is_active);
        
        return matchesSearch && matchesStatus && matchesActive;
    });
    
    displayProducts(filtered);
    updateStats(filtered);
}

function updateStats(products) {
    const totalProducts = products.length;
    const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
    const inStockCount = products.filter(p => p.condition_status === 'in_stock').length;
    const outOfStockCount = products.filter(p => p.condition_status === 'out_of_stock').length;
    
    document.getElementById('totalProducts').textContent = totalProducts;
    document.getElementById('totalQuantity').textContent = totalQuantity;
    document.getElementById('inStockCount').textContent = inStockCount;
    document.getElementById('outOfStockCount').textContent = outOfStockCount;
}

function refreshStorage() {
    loadProducts();
    loadTotalProfit();
}

let currentEditId = null;

function openEditModal(productId) {
    currentEditId = productId;
    const product = allProducts.find(p => p.id === productId);
    
    if (product) {
        document.getElementById('editUnitPrice').value = product.unit_price;
        document.getElementById('editStatus').value = product.condition_status;
        document.getElementById('editActive').value = product.is_active.toString();
        document.getElementById('editModal').style.display = 'block';
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditId = null;
    document.getElementById('editForm').reset();
}

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const unitPrice = parseFloat(document.getElementById('editUnitPrice').value);
    const status = document.getElementById('editStatus').value;
    const isActive = document.getElementById('editActive').value === 'true';
    
    try {
        const response = await fetch(`${API_BASE}/products/${currentEditId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                unit_price: unitPrice,
                condition_status: status,
                is_active: isActive
            })
        });
        
        if (!response.ok) throw new Error('Failed to update product');
        
        await response.json();
        closeEditModal();
        loadProducts();
    } catch (error) {
        console.error('Error updating product:', error);
        alert('Failed to update product. Please try again.');
    }
});

// Toggle product status
async function toggleStatus(productId, newStatus) {
    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                condition_status: newStatus
            })
        });
        
        if (!response.ok) throw new Error('Failed to update status');
        
        await response.json();
        loadProducts();
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status. Please try again.');
    }
}

// Toggle product active status
async function toggleActive(productId, newActive) {
    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_active: newActive
            })
        });
        
        if (!response.ok) throw new Error('Failed to update active status');
        
        await response.json();
        loadProducts();
    } catch (error) {
        console.error('Error updating active status:', error);
        alert('Failed to update active status. Please try again.');
    }
}

// Delete product
async function deleteProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    const capacityDisplay = `${product.capacity} ${product.capacity_unit || 'GB'}`;
    const confirmMessage = `Are you sure you want to delete "${product.brand} ${product.model} - ${capacityDisplay}"?\n\nThis will also delete all related transactions. This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            // Try to parse error response
            let errorMessage = 'Failed to delete product';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        loadProducts();
    } catch (error) {
        console.error('Error deleting product:', error);
        alert(`Failed to delete product: ${error.message}`);
    }
}

// Delete all data (debug function)
async function deleteAllData() {
    const confirmMessage = `⚠️ WARNING: This will delete ALL data in the database!\n\nThis includes:\n- All products\n- All inbound transactions\n- All outbound transactions\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Double confirmation
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
        alert('All data deleted successfully!');
        loadProducts();
        loadTotalProfit();
    } catch (error) {
        console.error('Error deleting all data:', error);
        alert(`Failed to delete all data: ${error.message}`);
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeEditModal();
    }
}
