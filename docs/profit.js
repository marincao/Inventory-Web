const API_BASE = 'https://inventory-web-production.up.railway.app/api';

// Load profit data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadProfitData();
});

async function loadProfitData() {
    try {
        const response = await fetch(`${API_BASE}/profit`);
        if (!response.ok) throw new Error('Failed to fetch profit data');
        
        const data = await response.json();
        console.log('Profit data received:', data); // Debug log
        displayProfitData(data);
    } catch (error) {
        console.error('Error loading profit data:', error);
        document.getElementById('profitTableBody').innerHTML = 
            '<tr><td colspan="9" class="loading">Error loading profit data. Please check your connection.</td></tr>';
    }
}

function displayProfitData(data) {
    const transactions = data.transactions || [];
    const totalProfit = data.totalProfit || 0;
    const totalRevenue = data.totalRevenue || 0;
    const transactionCount = data.transactionCount || 0;
    const avgProfit = transactionCount > 0 ? totalProfit / transactionCount : 0;

    // Update summary stats
    document.getElementById('totalProfitDisplay').textContent = `$${totalProfit.toFixed(2)}`;
    document.getElementById('totalRevenueDisplay').textContent = `$${totalRevenue.toFixed(2)}`;
    document.getElementById('transactionCountDisplay').textContent = transactionCount;
    document.getElementById('avgProfitDisplay').textContent = `$${avgProfit.toFixed(2)}`;

    // Update profit stat card color
    const profitCard = document.getElementById('totalProfitDisplay').closest('.stat-card');
    profitCard.classList.remove('stat-profit-positive', 'stat-profit-negative');
    if (totalProfit >= 0) {
        profitCard.classList.add('stat-profit-positive');
    } else {
        profitCard.classList.add('stat-profit-negative');
    }

    // Display transactions
    const tbody = document.getElementById('profitTableBody');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">No sales transactions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => {
        const date = new Date(transaction.transaction_date);
        const avgCost = parseFloat(transaction.avg_cost) || 0;
        const salePrice = parseFloat(transaction.sale_price) || 0;
        const quantity = parseInt(transaction.sold_quantity) || 0;
        const revenue = salePrice * quantity;
        const profit = parseFloat(transaction.profit) || 0;
        const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
        
        // Debug log for each transaction
        console.log('Transaction:', {
            salePrice,
            avgCost,
            quantity,
            profit,
            calculated: (salePrice - avgCost) * quantity
        });
        
        const capacityDisplay = `${transaction.capacity} ${transaction.capacity_unit || 'GB'}`;
        return `
            <tr>
                <td>${date.toLocaleString()}</td>
                <td>${transaction.brand || '-'}</td>
                <td>${transaction.model || '-'}</td>
                <td>${capacityDisplay}</td>
                <td>${quantity}</td>
                <td>$${salePrice.toFixed(2)}</td>
                <td>$${avgCost.toFixed(2)}</td>
                <td>$${revenue.toFixed(2)}</td>
                <td class="${profitClass}"><strong>$${profit.toFixed(2)}</strong></td>
            </tr>
        `;
    }).join('');
}
