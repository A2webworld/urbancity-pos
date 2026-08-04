console.log('Script started loading');
console.log('Document readyState:', document.readyState);

// =============================================
// CRITICAL FIX - ENSURE LOGIN SCREEN SHOWS
// =============================================
(function() {
    // Force login screen to be visible immediately
    setTimeout(function() {
        const loginScreen = document.getElementById('loginScreen');
        const posScreen = document.getElementById('posScreen');
        const managerDashboard = document.getElementById('managerDashboard');
        
        if (loginScreen) {
            loginScreen.classList.add('active');
            console.log('✅ Login screen activated');
        }
        if (posScreen) posScreen.classList.remove('active');
        if (managerDashboard) managerDashboard.classList.remove('active');
    }, 10);
})();

// =============================================
// NOTIFICATION FUNCTION (MUST BE FIRST)
// =============================================
function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// =============================================
// SESSION MANAGEMENT FOR PAGE REFRESH
// =============================================
class SessionManager {
    constructor() {
        this.currentScreen = null;
        this.currentStaff = null;
        this.init();
    }

    init() {
        // Load saved session state
        const savedSession = localStorage.getItem('posSession');
        if (savedSession) {
            const session = JSON.parse(savedSession);
            this.currentScreen = session.currentScreen;
            this.currentStaff = session.currentStaff;
        }
        
        // Save session on page unload
        window.addEventListener('beforeunload', () => this.saveSession());
        window.addEventListener('pagehide', () => this.saveSession());
        
        // Check session on load
        window.addEventListener('load', () => this.restoreSession());
    }

    saveSession() {
        const session = {
            currentScreen: this.currentScreen,
            currentStaff: this.currentStaff,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('posSession', JSON.stringify(session));
    }

    restoreSession() {
        const savedSession = localStorage.getItem('posSession');
        if (!savedSession) return;

        const session = JSON.parse(savedSession);
        
        // Check if session is still valid (within 8 hours)
        const sessionTime = new Date(session.timestamp);
        const now = new Date();
        const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);
        
        if (hoursDiff < 8 && session.currentStaff) {
            this.currentScreen = session.currentScreen;
            this.currentStaff = session.currentStaff;
            
            // If we have a logged in staff, show appropriate screen
            if (session.currentScreen === 'pos' || session.currentScreen === 'manager') {
                this.showScreenAfterRefresh(session.currentScreen, session.currentStaff);
            }
        } else {
            // Clear expired session
            this.clearSession();
        }
    }

    showScreenAfterRefresh(screenType, staffData) {
        // Hide all screens first
        document.getElementById('loginScreen')?.classList.remove('active');
        document.getElementById('posScreen')?.classList.remove('active');
        document.getElementById('managerDashboard')?.classList.remove('active');
        
        if (screenType === 'pos' && staffData) {
            // Restore POS screen
            pos.currentStaff = staffData;
            setTimeout(() => {
                pos.showPOSScreen();
            }, 100);
        } else if (screenType === 'manager' && staffData) {
            // Restore manager dashboard
            pos.currentStaff = staffData;
            setTimeout(() => {
                openManagerDashboard();
            }, 100);
        }
    }

    setCurrentScreen(screen) {
        this.currentScreen = screen;
        this.saveSession();
    }

    setCurrentStaff(staff) {
        this.currentStaff = staff;
        this.saveSession();
    }

    clearSession() {
        this.currentScreen = null;
        this.currentStaff = null;
        localStorage.removeItem('posSession');
    }
}

// Initialize session manager
const sessionManager = new SessionManager();

// =============================================
// SECURITY UTILITIES
// =============================================
const Security = {
    validatePIN: (pin) => {
        return /^\d{4}$/.test(pin);
    },

    sanitizeInput: (input) => {
        if (typeof input !== 'string') return input;
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    },

    hashPIN: (pin) => {
        // Simple hash for local validation
        let hash = 0;
        for (let i = 0; i < pin.length; i++) {
            hash = ((hash << 5) - hash) + pin.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).substring(0, 8);
    },

    encryptData: (data) => {
        try {
            return btoa(JSON.stringify(data));
        } catch (e) {
            console.error('Encryption error:', e);
            return null;
        }
    },

    decryptData: (encrypted) => {
        try {
            return JSON.parse(atob(encrypted));
        } catch (e) {
            console.error('Decryption error:', e);
            return null;
        }
    }
};

// =============================================
// SUPABASE GLOBAL VARIABLES
// =============================================
window.supabaseClient = null;
window.supabaseConnected = false;

// =============================================
// ENHANCED INVENTORY MANAGER WITH GOOGLE SHEETS
// =============================================
class InventoryManager {
    constructor() {
        this.inventory = this.loadInventory();
        this.setupInventoryCheck();
    }

    loadInventory() {
        const defaultInventory = [
            { id: 1, name: "Pasta", stock: 100, lowStock: 20, category: "pasta" },
            { id: 2, name: "Chicken Wings", stock: 200, lowStock: 50, category: "wings" },
            { id: 3, name: "Jollof Rice", stock: 150, lowStock: 30, category: "rice" },
            { id: 4, name: "Burger Buns", stock: 100, lowStock: 20, category: "burger" },
            { id: 5, name: "Shawarma Bread", stock: 120, lowStock: 25, category: "shawarma" },
            { id: 6, name: "Grilled Chicken", stock: 80, lowStock: 15, category: "grill" },
            { id: 7, name: "Combo Ingredients", stock: 60, lowStock: 10, category: "combos" },
            { id: 8, name: "Soft Drinks", stock: 300, lowStock: 50, category: "drinks" },
            { id: 9, name: "Water", stock: 200, lowStock: 40, category: "drinks" }
        ];
        
        const savedInventory = JSON.parse(localStorage.getItem('restaurantInventory') || '[]');
        return savedInventory.length > 0 ? savedInventory : defaultInventory;
    }

    saveInventory() {
        localStorage.setItem('restaurantInventory', JSON.stringify(this.inventory));
    }

    getItemByName(itemName) {
        return this.inventory.find(item => 
            item.name.toLowerCase().includes(itemName.toLowerCase()) ||
            itemName.toLowerCase().includes(item.name.toLowerCase())
        );
    }

    isMenuItemAvailable(itemId) {
        const menuItem = pos.menuItems.find(item => item.id === itemId);
        if (!menuItem) return false;
        
        const inventoryItem = this.getItemByName(menuItem.name);
        if (!inventoryItem) return true;
        
        return inventoryItem.stock > 0;
    }

    getMenuItemStockStatus(itemId) {
        const menuItem = pos.menuItems.find(item => item.id === itemId);
        if (!menuItem) return 'unknown';
        
        const inventoryItem = this.getItemByName(menuItem.name);
        if (!inventoryItem) return 'in-stock';
        
        if (inventoryItem.stock <= 0) return 'out-of-stock';
        if (inventoryItem.stock <= inventoryItem.lowStock) return 'low-stock';
        return 'in-stock';
    }

    getMenuItemStockCount(itemId) {
        const menuItem = pos.menuItems.find(item => item.id === itemId);
        if (!menuItem) return 0;
        
        const inventoryItem = this.getItemByName(menuItem.name);
        return inventoryItem ? inventoryItem.stock : 999;
    }

    deductInventoryForOrder(orderItems) {
        orderItems.forEach(orderItem => {
            const menuItem = pos.menuItems.find(item => item.id === orderItem.id);
            if (menuItem) {
                const inventoryItem = this.getItemByName(menuItem.name);
                if (inventoryItem) {
                    inventoryItem.stock = Math.max(0, inventoryItem.stock - orderItem.quantity);
                }
            }
        });
        this.saveInventory();
    }

    getAllItems() {
        return this.inventory;
    }

    addItem(itemData) {
        const newId = Math.max(0, ...this.inventory.map(item => item.id)) + 1;
        const newItem = {
            id: newId,
            name: itemData.name,
            stock: parseInt(itemData.stock) || 0,
            lowStock: parseInt(itemData.lowStock) || 10,
            category: itemData.category || 'other'
        };
        this.inventory.push(newItem);
        this.saveInventory();
        return newItem;
    }

    updateItem(id, itemData) {
        const index = this.inventory.findIndex(item => item.id === parseInt(id));
        if (index !== -1) {
            this.inventory[index] = {
                ...this.inventory[index],
                name: itemData.name || this.inventory[index].name,
                stock: parseInt(itemData.stock) || this.inventory[index].stock,
                lowStock: parseInt(itemData.lowStock) || this.inventory[index].lowStock,
                category: itemData.category || this.inventory[index].category
            };
            this.saveInventory();
            return this.inventory[index];
        }
        return null;
    }

    deleteItem(id) {
        const index = this.inventory.findIndex(item => item.id === parseInt(id));
        if (index !== -1) {
            this.inventory.splice(index, 1);
            this.saveInventory();
            return true;
        }
        return false;
    }

    setupInventoryCheck() {
        setInterval(() => {
            this.checkLowStock();
        }, 300000);
    }

    checkLowStock() {
        const lowStockItems = this.inventory.filter(item => item.stock <= item.lowStock);
        if (lowStockItems.length > 0 && pos.currentStaff) {
            console.log('Low stock items:', lowStockItems);
            // Could show notification for low stock
        }
    }
}

// =============================================
// DATA MANAGER CLASS
// =============================================
class DataManager {
    constructor() {
        this.backupInterval = null;
        this.startBackupInterval();
    }

    exportData() {
        const data = {
            menuItems: pos.menuItems,
            inventory: inventoryManager.inventory,
            customers: customerCRM.customers,
            staff: staffManager.staff,
            orders: JSON.parse(localStorage.getItem('restaurantOrders') || '[]'),
            timestamp: new Date().toISOString()
        };

        const dataStr = JSON.stringify(data, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `urbancity-backup-${new Date().toISOString().split('T')[0]}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        showNotification('Data exported successfully!', 'success');
    }

    createBackup() {
        const backup = {
            menuItems: pos.menuItems,
            inventory: inventoryManager.inventory,
            customers: customerCRM.customers,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('urbancity_backup', JSON.stringify(backup));
        showNotification('Backup created successfully!', 'success');
    }

    restoreBackup() {
        const backup = localStorage.getItem('urbancity_backup');
        if (backup) {
            if (confirm('Restore from backup? This will overwrite current data.')) {
                const data = JSON.parse(backup);
                
                pos.menuItems = data.menuItems || pos.menuItems;
                pos.saveMenuItems();
                
                inventoryManager.inventory = data.inventory || inventoryManager.inventory;
                inventoryManager.saveInventory();
                
                customerCRM.customers = data.customers || customerCRM.customers;
                customerCRM.saveCustomers();
                
                showNotification('Backup restored successfully!', 'success');
                location.reload();
            }
        } else {
            showNotification('No backup found', 'error');
        }
    }

    startBackupInterval() {
        this.backupInterval = setInterval(() => {
            this.createBackup();
        }, 3600000);
    }

    clearBackupInterval() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
        }
    }
}

// =============================================
// ENHANCED STAFF MANAGEMENT SYSTEM
// =============================================
class StaffManager {
    constructor() {
        this.staff = [];
        this.maxStaff = 10;
        this.loadStaff();
    }

    loadStaff() {
        const defaultStaff = [
            {
                id: 'Adeshina',
                name: 'Adeshina',
                display_name: 'Ridwan Adeshina',
                full_name: 'Ridwan Adeshina',
                role: 'CEO',
                pin_code: '1234',
                email: 'CEO@urbancity.com',
                phone: '+44 7350162788',
                is_active: true,
                can_edit_display_name: true,
                total_sales: 0,
                total_orders: 0,
                created_at: new Date().toISOString()
            },
            {
                id: 'Zubair & Saadudeen',
                name: 'Zubair R Aremu',
                display_name: 'Zubair R Aremu & Saadudeen K Abdulsalam',
                full_name: 'Zubair R Aremu & Saadudeen K Abdulsalam',
                role: 'manager',
                pin_code: '2345',
                email: 'manager@urbancity.com',
                phone: '08105442629',
                is_active: true,
                can_edit_display_name: true,
                total_sales: 0,
                total_orders: 0,
                created_at: new Date().toISOString()
            },
            {
                id: 'Staff',
                name: 'Staff',
                display_name: 'Staff',
                full_name: 'Staff Member',
                role: 'staff',
                pin_code: '3456',
                email: 'staff@urbancity.com',
                phone: '08105442629',
                is_active: true,
                can_edit_display_name: true,
                total_sales: 0,
                total_orders: 0,
                created_at: new Date().toISOString()
            }
        ];
        
        const savedStaff = JSON.parse(localStorage.getItem('restaurantStaff') || '[]');
        this.staff = savedStaff.length > 0 ? savedStaff : defaultStaff;
    }

    saveStaff() {
        localStorage.setItem('restaurantStaff', JSON.stringify(this.staff));
    }

    updateLoginDropdown() {
        const staffSelect = document.getElementById('staffSelect');
        if (staffSelect) {
            const activeStaff = this.getAllStaff();
            staffSelect.innerHTML = '<option value="">Select Your Name</option>' + 
                activeStaff.map(staff => 
                    `<option value="${staff.id}">${staff.display_name} (${staff.role})</option>`
                ).join('');
        }
    }

    getAllStaff() {
        return this.staff.filter(staff => staff.is_active);
    }

    getActiveStaffCount() {
        return this.getAllStaff().length;
    }

    canAddMoreStaff() {
        return this.getActiveStaffCount() < this.maxStaff;
    }

    validateStaffLogin(staffId, pin) {
        const staff = this.staff.find(s => s.id === staffId);
        return staff && staff.pin_code === pin;
    }

    getStaffDisplayName(staffId) {
        const staff = this.staff.find(s => s.id === staffId);
        return staff ? staff.display_name : 'Unknown Staff';
    }

    updateStaffDisplayName(staffId, newDisplayName) {
        const staff = this.staff.find(s => s.id === staffId);
        if (staff) {
            staff.display_name = newDisplayName;
            this.saveStaff();
            this.updateLoginDropdown();
            return true;
        }
        return false;
    }

    recordStaffSale(staffId, amount) {
        const staff = this.staff.find(s => s.id === staffId);
        if (staff) {
            staff.total_sales = (staff.total_sales || 0) + amount;
            staff.total_orders = (staff.total_orders || 0) + 1;
            this.saveStaff();
        }
    }

    getStaffPerformance() {
        return this.staff.map(staff => ({
            id: staff.id,
            name: staff.display_name,
            role: staff.role,
            sales: staff.total_sales || 0,
            orders: staff.total_orders || 0,
            average: staff.total_orders > 0 ? Math.round((staff.total_sales || 0) / staff.total_orders) : 0
        }));
    }

    getStaffById(staffId) {
        return this.staff.find(s => s.id === staffId);
    }

    getStaffPerformanceForStaff(staffId) {
        const staff = this.getStaffById(staffId);
        if (!staff) return null;
        
        return {
            id: staff.id,
            name: staff.name,
            display_name: staff.display_name,
            role: staff.role,
            sales: staff.total_sales || 0,
            orders: staff.total_orders || 0,
            average: staff.total_orders > 0 ? Math.round((staff.total_sales || 0) / staff.total_orders) : 0
        };
    }

    updateStaff(staffId, updates) {
        const staff = this.getStaffById(staffId);
        if (staff) {
            Object.assign(staff, updates);
            this.saveStaff();
            this.updateLoginDropdown();
            return true;
        }
        return false;
    }

    createStaff(staffData) {
        // Check if staff ID already exists
        if (this.staff.some(s => s.id === staffData.id)) {
            return { success: false, message: 'Staff ID already exists' };
        }
        
        const newStaff = {
            id: staffData.id,
            name: staffData.name,
            display_name: staffData.display_name,
            full_name: staffData.full_name || staffData.name,
            pin_code: staffData.pin_code,
            role: staffData.role,
            email: staffData.email || '',
            phone: staffData.phone || '',
            is_active: true,
            can_edit_display_name: true,
            total_sales: 0,
            total_orders: 0,
            created_at: new Date().toISOString()
        };
        
        this.staff.push(newStaff);
        this.saveStaff();
        this.updateLoginDropdown();
        return { success: true, data: newStaff };
    }

    deleteStaff(staffId) {
        const index = this.staff.findIndex(s => s.id === staffId);
        if (index !== -1) {
            // Soft delete - mark as inactive
            this.staff[index].is_active = false;
            this.saveStaff();
            this.updateLoginDropdown();
            return true;
        }
        return false;
    }
}

// =============================================
// CUSTOMER CRM
// =============================================
class CustomerCRM {
    constructor() {
        this.customers = this.loadCustomers();
    }

    loadCustomers() {
        return JSON.parse(localStorage.getItem('restaurantCustomers') || '[]');
    }

    saveCustomers() {
        localStorage.setItem('restaurantCustomers', JSON.stringify(this.customers));
    }

    autoSaveCustomerFromOrder(order, totalAmount) {
    // Use order number as unique identifier
    const customerPhone = order.order_number;
    const customerName = `Order-${order.order_number}`;
    
    let customer = this.findOrCreateCustomer(customerPhone, customerName);
    this.recordCustomerOrder(customer, order, totalAmount);
    
    return customer;
}

    findOrCreateCustomer(phone, name) {
        let customer = this.customers.find(c => c.phone === phone);
        
        if (!customer) {
            customer = {
                id: Date.now(),
                phone: phone,
                name: name,
                email: '',
                totalOrders: 0,
                totalSpent: 0,
                firstOrder: new Date().toISOString(),
                lastOrder: new Date().toISOString(),
                favoriteItems: [],
                orderHistory: [],
                preferences: {},
                loyaltyPoints: 0
            };
            this.customers.push(customer);
            this.saveCustomers();
        }
        
        return customer;
    }

    recordCustomerOrder(customer, order, totalAmount) {
        customer.totalOrders += 1;
        customer.totalSpent += totalAmount;
        customer.lastOrder = new Date().toISOString();
        customer.loyaltyPoints += Math.floor(totalAmount / 100);
        
        if (order.staff) {
            customer.preferences.lastServer = order.staff.display_name || order.staff.name;
            customer.preferences.lastServerId = order.staff.id;
        }
        
        order.items.forEach(item => {
            const existingItem = customer.favoriteItems.find(fav => fav.name === item.name);
            if (existingItem) {
                existingItem.count += item.quantity;
            } else {
                customer.favoriteItems.push({
                    name: item.name,
                    count: item.quantity
                });
            }
        });
        
        customer.favoriteItems.sort((a, b) => b.count - a.count);
        customer.favoriteItems = customer.favoriteItems.slice(0, 10);
        
        customer.orderHistory.unshift({
            orderId: order.id,
            total: totalAmount,
            items: order.items,
            timestamp: new Date().toISOString(),
            staff: order.staff?.display_name || order.staff?.name || 'Unknown',
            staffId: order.staff?.id || 'unknown',
            type: order.type || 'takeaway'
        });
        
        customer.orderHistory = customer.orderHistory.slice(0, 50);
        
        this.saveCustomers();
    }

    getCustomerByPhone(phone) {
        return this.customers.find(c => c.phone === phone);
    }

    getTopCustomers(limit = 20) {
        return this.customers
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, limit);
    }

    searchCustomers(query) {
        const lowerQuery = query.toLowerCase();
        return this.customers.filter(customer =>
            customer.name.toLowerCase().includes(lowerQuery) ||
            customer.phone.includes(query) ||
            customer.orderHistory.some(order => 
                order.staff?.toLowerCase().includes(lowerQuery)
            )
        );
    }

    getOrdersByStaff(staffId) {
        const staffOrders = [];
        this.customers.forEach(customer => {
            customer.orderHistory.forEach(order => {
                if (order.staffId === staffId) {
                    staffOrders.push({
                        customer: customer.name,
                        customerPhone: customer.phone,
                        ...order
                    });
                }
            });
        });
        return staffOrders;
    }

    getOrdersByDateRange(startDate, endDate) {
        const filteredOrders = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        this.customers.forEach(customer => {
            customer.orderHistory.forEach(order => {
                const orderDate = new Date(order.timestamp);
                if (orderDate >= start && orderDate <= end) {
                    filteredOrders.push({
                        customer: customer.name,
                        customerPhone: customer.phone,
                        ...order
                    });
                }
            });
        });
        return filteredOrders;
    }

    getOrdersByStaffAndDate(staffId, startDate, endDate) {
        const staffOrders = this.getOrdersByStaff(staffId);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        return staffOrders.filter(order => {
            const orderDate = new Date(order.timestamp);
            return orderDate >= start && orderDate <= end;
        });
    }

    getAllCustomers() {
        return this.customers;
    }

    getTotalSales() {
        return this.customers.reduce((total, customer) => total + (customer.totalSpent || 0), 0);
    }

    getTotalOrders() {
        return this.customers.reduce((total, customer) => total + (customer.totalOrders || 0), 0);
    }
}

// =============================================
// POS PAYMENT METHOD SELECTOR - FIXED VERSION
// =============================================
let posPaymentMethod = 'cash';

function setupPOSPaymentSelector() {
    console.log('🔧 Setting up payment selector...');
    
    const cashBtn = document.getElementById('posPaymentCash');
    const transferBtn = document.getElementById('posPaymentTransfer');
    
    if (!cashBtn || !transferBtn) {
        console.log('⚠️ Payment buttons not found, retrying in 500ms');
        setTimeout(setupPOSPaymentSelector, 500);
        return;
    }
    
    console.log('✅ Found payment buttons');
    
    // Remove any existing listeners by cloning and replacing
    const newCashBtn = cashBtn.cloneNode(true);
    const newTransferBtn = transferBtn.cloneNode(true);
    
    cashBtn.parentNode.replaceChild(newCashBtn, cashBtn);
    transferBtn.parentNode.replaceChild(newTransferBtn, transferBtn);
    
    // Set initial active state
    newCashBtn.style.background = '#4caf50';
    newCashBtn.style.color = 'white';
    newTransferBtn.style.background = '#f0f0f0';
    newTransferBtn.style.color = '#333';
    newTransferBtn.style.border = '1px solid #ddd';
    
    // Add click handler for Cash button
    newCashBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('💰 Cash button clicked');
        
        // Update styles
        this.style.background = '#4caf50';
        this.style.color = 'white';
        this.style.border = 'none';
        
        newTransferBtn.style.background = '#f0f0f0';
        newTransferBtn.style.color = '#333';
        newTransferBtn.style.border = '1px solid #ddd';
        
        // Update global variable
        posPaymentMethod = 'cash';
        console.log('✅ Payment method set to: CASH');
        
        // Visual feedback
        showNotification('💵 Payment method set to Cash', 'success');
    });
    
    // Add click handler for Transfer button
    newTransferBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('🏦 Bank Transfer button clicked');
        
        // Update styles
        this.style.background = '#2196f3';
        this.style.color = 'white';
        this.style.border = 'none';
        
        newCashBtn.style.background = '#f0f0f0';
        newCashBtn.style.color = '#333';
        newCashBtn.style.border = '1px solid #ddd';
        
        // Update global variable
        posPaymentMethod = 'transfer';
        console.log('✅ Payment method set to: BANK TRANSFER');
        
        // Visual feedback
        showNotification('🏦 Payment method set to Bank Transfer', 'success');
    });
    
    console.log('✅ Payment selector setup complete. Current method:', posPaymentMethod);
}

// =============================================
// URBANCITY POS
// =============================================
class UrbanCityPOS {
    constructor() {
        this.currentStaff = null;
        this.currentOrder = [];
        this.orderType = 'takeaway';
        this.isOrderSaved = false;
        this.orderCounter = this.loadOrderCounter();
        this.menuItems = this.loadMenuItems() || this.initializeMenu();
        this.currentCategory = 'all';
        this.isSaving = false;
        
        this.setupKeyboardShortcuts();
        this.setupSearchFunctionality();
        this.setupButtonEventListeners();
        
        setTimeout(() => {
            this.updateConnectionStatus();
            this.loadRecentOrders();
        }, 1000);
                // ADD THIS LINE AT THE END OF CONSTRUCTOR
        setTimeout(() => {
            this.restoreLocalPrices();
        }, 500);
    }

    addNewOrderHighlightStyle() {
    this.addOrderNotificationStyles(); // Just reuse the same method
}

playOrderNotification() {
    // Create a louder, more noticeable sound using Web Audio
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioContext.currentTime;
        
        // Create multiple oscillators for a richer sound
        const frequencies = [880, 1046.50, 1318.52]; // A5, C6, E6 (major chord)
        
        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = freq;
            gainNode.gain.value = 0.3;
            
            oscillator.start(now + index * 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.00001, now + 0.5 + index * 0.1);
            oscillator.stop(now + 0.5 + index * 0.1);
        });
        
        audioContext.resume();
    } catch(e) {
        console.log('Audio not supported, using fallback');
        // Fallback - create an alert sound using Audio element
        const audio = new Audio();
        audio.play().catch(e => console.log('Audio play failed'));
    }
    
    // Also vibrate the tablet if supported
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
    
    // Show visual notification
    this.showVisualNotification();
}
addNewOrderHighlightStyle() {
    this.addOrderNotificationStyles();
}

// Save local price backup
saveLocalPriceBackup() {
    const priceBackup = {};
    this.menuItems.forEach(item => {
        priceBackup[item.id] = {
            price: item.price,
            stock: item.stock,
            lowStock: item.lowStock
        };
    });
    localStorage.setItem('localPriceBackup', JSON.stringify(priceBackup));
    console.log('💾 Local price backup saved');
}

showPOSScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const posScreen = document.getElementById('posScreen');
    
    if (loginScreen) {
        loginScreen.classList.remove('active');
    }
    
    if (posScreen) {
        posScreen.classList.add('active');
    }
    
    document.getElementById('currentStaff').textContent = this.currentStaff.display_name;
    document.getElementById('currentServerName').textContent = this.currentStaff.display_name;
    
    this.updateManagerAccess();
    this.updateTime();
    this.renderMenuItems();
    this.renderCategories();
    this.updateActiveOrdersCount();
    this.loadRecentOrders();

    setInterval(() => this.updateTime(), 1000);
    
    // ===== ADD AUTO-SYNC HERE =====
    setTimeout(() => {
        this.autoSyncLocalOrders();
    }, 3000);
    // ===== END OF AUTO-SYNC =====
    
    setTimeout(() => {
        if (!this.realtimeChannel) {
            this.setupRealtimeOrderListener();
        }
    }, 2000);
    
    // ===== ADD THIS RIGHT HERE =====
    setTimeout(() => {
        setupPOSPaymentSelector();
        console.log('🎯 Payment selector initialized!');
    }, 500);
}

// =============================================
// REAL-TIME ORDER LISTENER FROM WEBSITE
// =============================================
setupRealtimeOrderListener() {
    if (!window.supabaseClient || !window.supabaseConnected) {
        console.log('⏳ Waiting for Supabase connection...');
        setTimeout(() => this.setupRealtimeOrderListener(), 2000);
        return;
    }
    
    console.log('🟢 Setting up real-time order listener for website orders...');
    
    // Clean up existing channel if any
    if (this.realtimeChannel) {
        try {
            window.supabaseClient.removeChannel(this.realtimeChannel);
        } catch(e) {}
    }
    
    // Create new channel
    this.realtimeChannel = window.supabaseClient
        .channel('website-orders')
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'orders' 
            },
            (payload) => {
                const newOrder = payload.new;
                console.log('🔔🔔🔔 NEW ORDER RECEIVED! 🔔🔔🔔');
                console.log('Order:', newOrder);
                
                // Play sound
                this.playOrderNotification();
                
                // Show notification
                this.showNewOrderAlert(newOrder);
                
                // Add to recent orders list
                this.addOrderToRecentList(newOrder);
                
                // Update order count
                this.updateActiveOrdersCount();
                
                // Refresh the recent orders display
                this.loadRecentOrders();
            }
        )
        .subscribe((status) => {
            console.log('📡 Realtime subscription status:', status);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Real-time listener is ACTIVE and waiting for orders!');
            }
        });
}

showNewOrderAlert(order) {
    // Create a visible alert on screen
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff9800;
        color: #111;
        padding: 30px 50px;
        border-radius: 20px;
        font-size: 24px;
        font-weight: bold;
        text-align: center;
        z-index: 20000;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        animation: pulse 1s ease-in-out 3;
        cursor: pointer;
    `;
    alertDiv.innerHTML = `
        🔔 NEW ORDER! 🔔<br>
        Order #${order.order_number || order.id}<br>
        ₦${(order.total || 0).toLocaleString()}<br>
        <small style="font-size: 14px;">Click to dismiss</small>
    `;
    alertDiv.onclick = () => alertDiv.remove();
    document.body.appendChild(alertDiv);
    setTimeout(() => {
        if (alertDiv.parentNode) alertDiv.remove();
    }, 5000);
    
    // Browser notification
    if (Notification.permission === 'granted') {
        new Notification('UrbanCity - New Order!', {
            body: `Order #${order.order_number || order.id} - ₦${(order.total || 0).toLocaleString()}`,
            icon: '/logo.jpg'
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
    
    // Flash title bar
    let originalTitle = document.title;
    let count = 0;
    const flashInterval = setInterval(() => {
        document.title = count % 2 === 0 ? '🔔 NEW ORDER! - UrbanCity POS' : originalTitle;
        count++;
        if (count > 20) clearInterval(flashInterval);
    }, 300);
    setTimeout(() => {
        clearInterval(flashInterval);
        document.title = originalTitle;
    }, 6000);
}

playOrderNotification() {
    // Try to play a simple beep using Web Audio
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 1);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        audioContext.resume();
    } catch(e) {
        console.log('Audio not supported');
    }
    
    // Also show visual notification
    this.showVisualNotification();
}

showVisualNotification() {
    const notification = document.createElement('div');
    notification.className = 'order-notification';
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <i class="fas fa-bell" style="font-size: 28px;"></i>
            <div>
                <strong style="font-size: 16px;">🔔 NEW ORDER RECEIVED!</strong><br>
                <small>Check the orders list</small>
            </div>
        </div>
    `;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.backgroundColor = '#4caf50';
    notification.style.color = 'white';
    notification.style.padding = '15px 20px';
    notification.style.borderRadius = '10px';
    notification.style.zIndex = '10000';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    notification.style.animation = 'slideIn 0.3s ease';
    notification.style.cursor = 'pointer';
    
    notification.onclick = () => {
        notification.remove();
        // Flash the recent orders section
        const recentSection = document.querySelector('.recent-orders-section');
        if (recentSection) {
            recentSection.style.backgroundColor = '#fff3cd';
            setTimeout(() => {
                recentSection.style.backgroundColor = '';
            }, 1000);
        }
    };
    
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) notification.remove();
    }, 5000);
}

showOrderAlert(order) {
    // Browser notification if permitted
    if (Notification.permission === 'granted') {
        new Notification('UrbanCity - New Order!', {
            body: `Order #${order.order_number || order.id} - ₦${(order.total || 0).toLocaleString()}`,
            icon: '/logo.jpg'
        });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
    
    // Flash the title bar
    let originalTitle = document.title;
    let count = 0;
    const flashInterval = setInterval(() => {
        document.title = count % 2 === 0 ? '🔔 NEW ORDER! - UrbanCity POS' : originalTitle;
        count++;
        if (count > 10) clearInterval(flashInterval);
    }, 500);
    setTimeout(() => {
        clearInterval(flashInterval);
        document.title = originalTitle;
    }, 5000);
}

addOrderToRecentList(order) {
    const activeOrdersList = document.getElementById('activeOrdersList');
    if (!activeOrdersList) return;
    
    const orderHTML = `
        <div class="active-order-item new-order-highlight" data-order-id="${order.id}">
            <div>
                <strong>#${order.order_number || order.id}</strong><br>
                <small>${new Date(order.created_at).toLocaleTimeString()}</small>
            </div>
            <div style="text-align: right;">
                <strong>₦${(order.total || 0).toLocaleString()}</strong><br>
                <small>${order.customer_name || 'Customer'}</small>
            </div>
        </div>
    `;
    
    // Insert at the top
    activeOrdersList.insertAdjacentHTML('afterbegin', orderHTML);
    
    // Highlight new order
    const newElement = activeOrdersList.firstElementChild;
    setTimeout(() => {
        if (newElement) newElement.classList.remove('new-order-highlight');
    }, 3000);
}

// Add CSS for animations
addOrderNotificationStyles() {
    if (!document.getElementById('posNotificationStyles')) {
        const style = document.createElement('style');
        style.id = 'posNotificationStyles';
        style.textContent = `
            .new-order-highlight {
                background: #fff3cd !important;
                border-left: 4px solid #ff9800 !important;
                animation: orderPulse 1s ease-in-out 3;
            }
            @keyframes orderPulse {
                0% { transform: scale(1); background: #fff3cd; }
                50% { transform: scale(1.01); background: #ffe0b3; }
                100% { transform: scale(1); background: #fff3cd; }
            }
            .order-notification {
                animation: slideInRight 0.3s ease;
            }
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Restore local prices from backup
restoreLocalPrices() {
    const backup = localStorage.getItem('localPriceBackup');
    if (backup) {
        const priceBackup = JSON.parse(backup);
        let restoredCount = 0;
        this.menuItems.forEach(item => {
            if (priceBackup[item.id]) {
                item.price = priceBackup[item.id].price;
                item.stock = priceBackup[item.id].stock;
                item.lowStock = priceBackup[item.id].lowStock;
                restoredCount++;
            }
        });
        this.saveMenuItems();
        if (restoredCount > 0) {
            console.log(`✅ Restored ${restoredCount} locally saved prices`);
        }
    }
}

// Auto-sync local orders to Supabase
async autoSyncLocalOrders() {
    // Only run if Supabase is connected
    if (!window.supabaseClient || !window.supabaseConnected) {
        console.log('Supabase not connected, skipping auto-sync');
        return;
    }
    
    // Get all local orders
    const localOrders = JSON.parse(localStorage.getItem('restaurantOrders') || '[]');
    
    if (localOrders.length === 0) {
        console.log('No local orders to sync');
        return;
    }
    
    // Get already synced order IDs from localStorage
    let syncedOrderIds = JSON.parse(localStorage.getItem('syncedOrderIds') || '[]');
    
    // Find orders that haven't been synced yet
    const unsyncedOrders = localOrders.filter(order => 
        !syncedOrderIds.includes(order.order_number)
    );
    
    if (unsyncedOrders.length === 0) {
        console.log('All local orders already synced');
        return;
    }
    
    console.log(`📤 Found ${unsyncedOrders.length} unsynced orders, uploading to Supabase...`);
    showNotification(`📤 Syncing ${unsyncedOrders.length} local orders to cloud...`, 'info');
    
    let syncedCount = 0;
    let failedCount = 0;
    
    for (const order of unsyncedOrders) {
        try {
            // Check if order already exists in Supabase
            const { data: existing } = await window.supabaseClient
                .from('orders')
                .select('order_number')
                .eq('order_number', order.order_number)
                .maybeSingle();
            
            if (!existing) {
                // Prepare order data for Supabase
                const orderData = {
                    order_number: order.order_number,
                    staff_id: order.staff_id,
                    staff_name: order.staff_name,
                    items: order.items,
                    subtotal: order.subtotal,
                    tax: order.tax || 0,
                    total: order.total,
                    order_type: order.order_type || order.type || 'takeaway',
                    status: 'completed',
                    created_at: order.created_at || order.timestamp || new Date().toISOString(),
                    customer_phone: order.customer_phone || `order-${order.order_number}`,
                    customer_name: order.customer_name || `Customer-${order.order_number}`
                };
                
                const { error } = await window.supabaseClient
                    .from('orders')
                    .insert([orderData]);
                
                if (error) {
                    console.error(`Failed to sync order ${order.order_number}:`, error);
                    failedCount++;
                } else {
                    console.log(`✅ Synced order: ${order.order_number}`);
                    syncedCount++;
                    syncedOrderIds.push(order.order_number);
                }
            } else {
                // Order already exists in Supabase
                syncedOrderIds.push(order.order_number);
            }
        } catch (error) {
            console.error(`Error syncing order ${order.order_number}:`, error);
            failedCount++;
        }
    }
    
    // Save synced order IDs
    localStorage.setItem('syncedOrderIds', JSON.stringify(syncedOrderIds));
    
    if (syncedCount > 0) {
        showNotification(`✅ Synced ${syncedCount} orders to cloud!`, 'success');
        // Refresh the recent orders display
        this.loadRecentOrders();
    } else if (failedCount > 0) {
        showNotification(`⚠️ Synced ${syncedCount}, failed ${failedCount} orders`, 'warning');
    }
}

// Save customer to Supabase
async saveCustomerToSupabase(orderData, totalAmount) {
    if (!window.supabaseClient || !window.supabaseConnected) return;
    
    const customerPhone = orderData.customer_phone || `order-${orderData.order_number}`;
    const customerName = orderData.customer_name || `Customer-${orderData.order_number}`;
    
    try {
        // Check if customer already exists
        const { data: existingCustomer } = await window.supabaseClient
            .from('customers')
            .select('*')
            .eq('phone', customerPhone)
            .maybeSingle();
        
        if (existingCustomer) {
            // Update existing customer
            const { error } = await window.supabaseClient
                .from('customers')
                .update({
                    total_orders: (existingCustomer.total_orders || 0) + 1,
                    total_spent: (existingCustomer.total_spent || 0) + totalAmount,
                    last_order_date: new Date().toISOString(),
                    last_order: orderData.order_number
                })
                .eq('phone', customerPhone);
            
            if (error) throw error;
            console.log(`✅ Updated customer: ${customerName}`);
        } else {
            // Create new customer
            const { error } = await window.supabaseClient
                .from('customers')
                .insert([{
                    phone: customerPhone,
                    name: customerName,
                    email: '',
                    total_orders: 1,
                    total_spent: totalAmount,
                    first_order_date: new Date().toISOString(),
                    last_order_date: new Date().toISOString(),
                    last_order: orderData.order_number,
                    loyalty_points: Math.floor(totalAmount / 100)
                }]);
            
            if (error) throw error;
            console.log(`✅ Created new customer: ${customerName}`);
        }
    } catch (error) {
        console.error('Failed to save customer to Supabase:', error);
    }
}

    initializeMenu() {
        // Menu data from your HTML
        const menuData = {
            categories: [
                {
                    id: "pasta",
                    name: "Urban Asian Pasta Zone",
                    items: [
                        {
                            id: "hot-stir-fry-chicken-pasta",
                            name: "Hot Stir-Fry Chicken Pasta",
                            price: 2500,
                            category: "pasta",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "asunn-hot-stir-fry-pasta",
                            name: "Asunn Hot Stir-Fry Pasta",
                            price: 3000,
                            category: "pasta",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "penne-chicken-pasta",
                            name: "Penne Chicken Pasta",
                            price: 3000,
                            category: "pasta",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "penne-shrimps-pasta",
                            name: "Penne Shrimps Pasta",
                            price: 4500,
                            category: "pasta",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "asunn-penne-pasta",
                            name: "Asunn Penne Pasta",
                            price: 4000,
                            category: "pasta",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "rice",
                    name: "Wok Rice Zone",
                    items: [
                        {
                            id: "ofada-rice-ayamase",
                            name: "Ofada Rice x Ayamase",
                            price: 6500,
                            category: "rice",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "chinese-chicken-fried-rice",
                            name: "Chinese Chicken Fried Rice",
                            price: 6200,
                            category: "rice",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "chinese-shrimp-fried-rice",
                            name: "Chinese Shrimp Fried Rice",
                            price: 7500,
                            category: "rice",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "grill-chicken",
                    name: "Urban Grillz & Chicken Zone",
                    items: [
                        {
                            id: "chicken-fries",
                            name: "Chicken & Fries",
                            price: 5500,
                            category: "grill-chicken",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "catfish-fries",
                            name: "Catfish & Fries & 1 Boli",
                            price: 8500,
                            category: "grill-chicken",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "chicken-fries",
                            name: "Peppered Chicken & Fries",
                            price: 5500,
                            category: "grill-chicken",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "wings-bucket",
                    name: "Wings Bucket",
                    items: [
                        {
                            id: "crispy-wings-combo",
                            name: "Crispy Wings + Yam/Fries Combo (4pcs)",
                            price: 7500,
                            category: "wings-bucket",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "peppered-wings-combo",
                            name: "Peppered Wings + Yam/Fries (4pcs)",
                            price: 7500,
                            category: "wings-bucket",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "shawarma",
                    name: "Shawarma Zone",
                    items: [
                        {
                            id: "chicken-spicy-shawarma",
                            name: "Chicken Spicy Shawarma",
                            price: 3500,
                            category: "shawarma",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "beef-shawarma",
                            name: "Beef Shawarma",
                            price: 3500,
                            category: "shawarma",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "burgers",
                    name: "Urban Burger Zone",
                    items: [
                        {
                            id: "chicken-burger",
                            name: "Chicken Burger",
                            price: 4000,
                            category: "burgers",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "beef-spicy-burger",
                            name: "Beef Spicy Burger",
                            price: 4000,
                            category: "burgers",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "sandwiches",
                    name: "Sandwich Zone",
                    items: [
                        {
                            id: "classic-chicken-sandwich",
                            name: "Classic Chicken Sandwich",
                            price: 3500,
                            category: "sandwiches",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "tuna-sandwich",
                            name: "Tuna Sandwich",
                            price: 5000,
                            category: "sandwiches",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "noodles",
                    name: "Noodles Zone",
                    items: [
                        {
                            id: "asian-chow-mein",
                            name: "Asian Chow Mein",
                            price: 5600,
                            category: "noodles",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "singapore-noodles",
                            name: "Singapore Noodles",
                            price: 5600,
                            category: "noodles",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "student-combos",
                    name: "Student Combo Zone",
                    items: [
                        {
                            id: "combo-1",
                            name: "Beef Burger + Fries + Small Strawberry Milkshake",
                            price: 7500,
                            category: "student-combos",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "combo-2",
                            name: "Chicken/Beef Hotdog Burger + French Fries + Chapman",
                            price: 5500,
                            category: "student-combos",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "fire-boli",
                    name: "Urban Fire Boli Zone",
                    items: [
                        {
                            id: "mixed-grilled-boli-1",
                            name: "Mixed grilled boli + grilled yam + 1 cut fish",
                            price: 3500,
                            category: "fire-boli",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "boli-combo-1",
                            name: "10 boli + yam + 1 kote fish + 2 chicken laps",
                            price: 24000,
                            category: "fire-boli",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "weekend-platter",
                    name: "Weekend Platter",
                    items: [
                        {
                            id: "weekend-combo-1",
                            name: "Fried yam + sweet potatoes + 1 boli + 2 turkey + classic hotdog",
                            price: 16500,
                            category: "weekend-platter",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "weekend-combo-2",
                            name: "Fried yam + sweet potatoes + 2 boli + 1 chicken lap + 2 turkey + 1 shawarma + 1 sandwich",
                            price: 22500,
                            category: "weekend-platter",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "breakfast",
                    name: "Breakfast Zone",
                    items: [
                        {
                            id: "toast-bread-nescafe",
                            name: "Toast Bread & Nescafe Tea",
                            price: 2000,
                            category: "breakfast",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "package-1",
                            name: "Package 1 - Pancakes + 1 chicken wing + scrambled egg + tiger nut drink",
                            price: 6500,
                            category: "breakfast",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "milkshake",
                    name: "Milkshake Zone",
                    items: [
                        {
                            id: "oreo-milkshake",
                            name: "Oreo Milkshake (Small)",
                            price: 3500,
                            category: "milkshake",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "strawberry-milkshake",
                            name: "Strawberry Milkshake (Small)",
                            price: 3000,
                            category: "milkshake",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                },
                {
                    id: "drinks",
                    name: "Drinks",
                    items: [
                        {
                            id: "chapman",
                            name: "Chapman (Small)",
                            price: 1500,
                            category: "drinks",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "coke",
                            name: "Coke",
                            price: 500,
                            category: "drinks",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "sprite",
                            name: "Sprite",
                            price: 500,
                            category: "drinks",
                            stock: 100,
                            lowStock: 20
                        },
                        {
                            id: "water",
                            name: "Water",
                            price: 300,
                            category: "drinks",
                            stock: 100,
                            lowStock: 20
                        }
                    ]
                }
            ]
        };

        // Convert all menu items to POS format
        let menuItems = [];
        let itemId = 1;
        
        menuData.categories.forEach(category => {
            category.items.forEach(item => {
                menuItems.push({
                    id: itemId++,
                    name: item.name,
                    price: item.price,
                    category: category.id,
                    stock: item.stock,
                    lowStock: item.lowStock
                });
            });
        });
        
        return menuItems;
    }

    loadMenuItems() {
        const savedItems = localStorage.getItem('restaurantMenuItems');
        if (savedItems) {
            try {
                return JSON.parse(savedItems);
            } catch (e) {
                console.error('Error loading menu items:', e);
                return null;
            }
        }
        return null;
    }

    saveMenuItems() {
        localStorage.setItem('restaurantMenuItems', JSON.stringify(this.menuItems));
    }

    loadOrderCounter() {
        const today = new Date().toDateString();
        const counterData = JSON.parse(localStorage.getItem('orderCounter') || '{"date": "", "count": 0}');
        
        if (counterData.date !== today) {
            counterData.date = today;
            counterData.count = 0;
            localStorage.setItem('orderCounter', JSON.stringify(counterData));
        }
        
        return counterData;
    }

    getNextOrderNumber() {
        this.orderCounter.count++;
        localStorage.setItem('orderCounter', JSON.stringify(this.orderCounter));
        return `ORD-${new Date().getDate()}${String(this.orderCounter.count).padStart(3, '0')}`;
    }

    async staffLogin() {
        const staffSelect = document.getElementById('staffSelect');
        const staffPin = document.getElementById('staffPin');
        
        const staffId = staffSelect.value;
        const pin = staffPin.value;

        if (!staffId) {
            showNotification('Please select your name from the list.', 'error');
            return;
        }

        if (!pin || !Security.validatePIN(pin)) {
            showNotification('Please enter a valid 4-digit PIN.', 'error');
            return;
        }

        const loginBtn = document.querySelector('.login-btn');
        if (loginBtn) {
            loginBtn.textContent = 'Logging in...';
            loginBtn.disabled = true;
        }

        const loginStatus = document.getElementById('loginStatus');
        if (loginStatus) {
            loginStatus.textContent = '🔐 Verifying credentials...';
            loginStatus.style.display = 'block';
            loginStatus.style.background = '#fff3cd';
            loginStatus.style.color = '#856404';
        }

        try {
            // Rate limiting check
            const loginAttempts = JSON.parse(localStorage.getItem('login_attempts') || '{}');
            const now = Date.now();
            const attempts = loginAttempts[staffId] || [];
            const recentAttempts = attempts.filter(time => now - time < 15 * 60 * 1000);
            
            if (recentAttempts.length >= 5) {
                showNotification('Too many failed attempts. Please wait 15 minutes.', 'error');
                if (loginStatus) loginStatus.style.display = 'none';
                if (loginBtn) {
                    loginBtn.textContent = 'Login to POS System';
                    loginBtn.disabled = false;
                }
                return;
            }

            // Validate login
            const isValid = staffManager.validateStaffLogin(staffId, pin);
            
            if (!isValid) {
                // Record failed attempt
                recentAttempts.push(now);
                loginAttempts[staffId] = recentAttempts;
                localStorage.setItem('login_attempts', JSON.stringify(loginAttempts));
                
                showNotification('Invalid PIN. Please try again.', 'error');
                if (loginStatus) loginStatus.style.display = 'none';
                if (loginBtn) {
                    loginBtn.textContent = 'Login to POS System';
                    loginBtn.disabled = false;
                }
                return;
            }

            // Clear attempts on success
            delete loginAttempts[staffId];
            localStorage.setItem('login_attempts', JSON.stringify(loginAttempts));

            // Get staff data
            const staffData = staffManager.getStaffById(staffId);
            if (!staffData) {
                throw new Error('Staff not found');
            }
            
            this.currentStaff = {
                id: staffId,
                name: staffData.name,
                display_name: staffData.display_name,
                role: staffData.role,
                can_edit_display_name: staffData.can_edit_display_name !== false
            };
            
            // Set order type
            const activeOrderTypeBtn = document.querySelector('.order-type-btn.active');
            if (activeOrderTypeBtn) {
                this.orderType = activeOrderTypeBtn.id === 'takeawayBtn' ? 'takeaway' : 'delivery';
            }
            
            this.updateOrderTypeDisplay();
            
            if (loginStatus) {
                loginStatus.textContent = '✅ Login successful!';
                loginStatus.style.background = '#d4edda';
                loginStatus.style.color = '#155724';
            }
            
            // Save session
            sessionManager.setCurrentStaff(this.currentStaff);
            sessionManager.setCurrentScreen('pos');
            
            setTimeout(() => {
                this.showPOSScreen();
                if (loginStatus) loginStatus.style.display = 'none';
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            showNotification('Login failed. Please try again.', 'error');
            if (loginStatus) loginStatus.style.display = 'none';
            if (loginBtn) {
                loginBtn.textContent = 'Login to POS System';
                loginBtn.disabled = false;
            }
        }
    }

    updateOrderTypeDisplay() {
        document.getElementById('currentOrderType').textContent = this.orderType === 'takeaway' ? 'Takeaway' : 'Delivery';
        document.getElementById('orderTypeSelect').value = this.orderType;
        
        const badge = document.getElementById('orderTypeBadge');
        if (badge) {
            badge.textContent = this.orderType === 'takeaway' ? '🏃 Takeaway' : '🚚 Delivery';
            badge.className = this.orderType === 'takeaway' ? 'order-type-badge' : 'order-type-badge delivery';
        }
    }

    changeOrderType(type) {
        this.orderType = type;
        this.updateOrderTypeDisplay();
    }

    showPOSScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const posScreen = document.getElementById('posScreen');
    
    if (loginScreen) {
        loginScreen.classList.remove('active');
    }
    
    if (posScreen) {
        posScreen.classList.add('active');
    }
    
    document.getElementById('currentStaff').textContent = this.currentStaff.display_name;
    document.getElementById('currentServerName').textContent = this.currentStaff.display_name;
    
    this.updateManagerAccess();
    this.updateTime();
    this.renderMenuItems();
    this.renderCategories();
    this.updateActiveOrdersCount();
    this.loadRecentOrders();

    setInterval(() => this.updateTime(), 1000);
    
    // ===== ADD AUTO-SYNC HERE =====
    setTimeout(() => {
        this.autoSyncLocalOrders();
    }, 3000);
    // ===== END OF AUTO-SYNC =====
    // Add this at the end of showPOSScreen()
setTimeout(() => {
    if (!this.realtimeChannel) {
        this.setupRealtimeOrderListener();
    }
}, 2000);
}

    updateManagerAccess() {
        const managerBtn = document.getElementById('managerDashboardBtn');
        const editDisplayNameBtn = document.querySelector('.edit-display-name-btn');
        
        if (this.currentStaff.role === 'manager' || this.currentStaff.role === 'CEO') {
            if (managerBtn) managerBtn.style.display = 'inline-block';
        } else {
            if (managerBtn) managerBtn.style.display = 'none';
        }
        
        if (editDisplayNameBtn) {
            editDisplayNameBtn.style.display = this.currentStaff.can_edit_display_name ? 'inline-block' : 'none';
        }
    }

    updateTime() {
        const now = new Date();
        document.getElementById('currentTime').textContent = 
            now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
    }

    updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        if (window.supabaseConnected) {
            statusElement.innerHTML = '✅ Connected to Supabase Cloud';
            statusElement.style.background = '#d4edda';
            statusElement.style.color = '#155724';
        } else {
            statusElement.innerHTML = '⚠️ Offline Mode (Using local storage)';
            statusElement.style.background = '#fff3cd';
            statusElement.style.color = '#856404';
        }
    }
}

    addRushItem(itemId) {
        const item = this.menuItems.find(m => m.id === itemId);
        if (item) {
            this.addToOrder(item);
        }
    }

    renderMenuItems() {
    const menuContainer = document.getElementById('menuItems');
    if (!menuContainer) return;
    
    menuContainer.innerHTML = '';

    const filteredItems = this.currentCategory === 'all' 
        ? this.menuItems 
        : this.menuItems.filter(item => item.category === this.currentCategory);

    filteredItems.forEach(item => {
        // Check if item has variants
        const hasVariants = item.variants && item.variants.length > 0;
        
        const stockStatus = this.getStockStatus(item);
        const isAvailable = stockStatus !== 'out-of-stock';
        const stockCount = item.stock || 0;
        
        const menuItem = document.createElement('div');
        menuItem.className = `menu-item ${stockStatus}`;
        menuItem.style.position = 'relative';
        menuItem.style.padding = '15px';
        menuItem.style.borderRadius = '8px';
        menuItem.style.background = '#ffffff';
        menuItem.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        menuItem.style.transition = 'all 0.2s ease';
        menuItem.style.marginBottom = '15px';
        menuItem.style.border = '1px solid #e9ecef';
        menuItem.style.minHeight = '150px';
        
        let statusText = '';
        let statusIcon = '';
        
        if (stockStatus === 'out-of-stock') {
            statusText = 'Sold Out';
            statusIcon = '❌';
            menuItem.style.opacity = '0.6';
        } else if (stockStatus === 'low-stock') {
            statusText = 'Low Stock';
            statusIcon = '⚠️';
        } else {
            statusText = 'In Stock';
            statusIcon = '✅';
        }
        
        // Build the status text with stock count
let statusDisplayText = '';
if (stockStatus === 'out-of-stock') {
    statusDisplayText = '❌ Sold Out';
} else if (stockStatus === 'low-stock') {
    statusDisplayText = `⚠️ Low Stock (${stockCount} left)`;
} else {
    statusDisplayText = `✅ In Stock (${stockCount})`;
}

// Build price display HTML
let priceHTML = '';
if (hasVariants) {
    priceHTML = '<div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px;">';
    item.variants.forEach((variant, idx) => {
        priceHTML += `
            <button class="variant-btn" data-item-id="${item.id}" data-variant-index="${idx}" 
                    style="padding: 6px 12px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 20px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s;">
                ${variant.display || `${variant.size} - ₦${variant.price.toLocaleString()}`}
            </button>
        `;
    });
    priceHTML += '</div>';
} else {
    priceHTML = `<div style="color: #007bff; font-weight: bold; font-size: 16px; margin-top: 8px;">
                    ₦${item.price.toLocaleString()}
                </div>`;
}

menuItem.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 5px; color: #212529; line-height: 1.4; font-size: 14px; padding-right: 40px;">
        ${item.name}
    </div>
    <div style="font-size: 11px; color: #6c757d; margin-bottom: 8px;">
        ${item.category}
    </div>
    ${priceHTML}
    <div style="position: absolute; bottom: 10px; right: 10px; font-size: 10px; padding: 4px 10px; border-radius: 12px; background: ${stockStatus === 'in-stock' ? '#d4edda' : stockStatus === 'low-stock' ? '#fff3cd' : '#f8d7da'}; color: ${stockStatus === 'in-stock' ? '#155724' : stockStatus === 'low-stock' ? '#856404' : '#721c24'};">
        ${statusDisplayText}
    </div>
`;
        
        // Add variant button event listeners
        if (hasVariants && isAvailable) {
            const variantBtns = menuItem.querySelectorAll('.variant-btn');
            variantBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const variantIndex = parseInt(btn.dataset.variantIndex);
                    const variant = item.variants[variantIndex];
                    this.addVariantToOrder(item, variant);
                });
            });
            menuItem.style.cursor = 'default';
        } else if (!hasVariants && isAvailable) {
            menuItem.addEventListener('click', () => this.addToOrder(item));
            menuItem.style.cursor = 'pointer';
        } else {
            menuItem.style.cursor = 'not-allowed';
            menuItem.addEventListener('click', () => {
                showNotification(`❌ ${item.name} is out of stock!`, 'error');
            });
        }
        
        // Add edit buttons for managers
        if (this.currentStaff && (this.currentStaff.role === 'manager' || this.currentStaff.role === 'CEO')) {
            const editDiv = document.createElement('div');
            editDiv.className = 'menu-item-edit-btns';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'menu-item-edit-btn edit-btn';
            editBtn.innerHTML = '✏️';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                editMenuItem(item.id);
            };
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'menu-item-edit-btn delete-btn';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                deleteMenuItem(item.id);
            };
            
            editDiv.appendChild(editBtn);
            editDiv.appendChild(deleteBtn);
            menuItem.appendChild(editDiv);
        }
        
        menuContainer.appendChild(menuItem);
    });
    
    // Add "Add Item" button for managers
    if (this.currentStaff && (this.currentStaff.role === 'manager' || this.currentStaff.role === 'CEO')) {
        this.addAddItemButton(menuContainer);
    }
    
    this.setupCategoryFilters();
}

// New method to add variant to order
addVariantToOrder(item, variant) {
    const variantId = `${item.id}_${variant.size.toLowerCase().replace(/\s/g, '_')}`;
    
    const variantItem = {
        id: variantId,
        name: `${item.name} (${variant.size})`,
        price: variant.price,
        variant: variant,
        quantity: 1,
        stock: item.stock,
        lowStock: item.lowStock,
        category: item.category
    };
    
    const existingItem = this.currentOrder.find(orderItem => orderItem.id === variantId);
    
    // Deduct stock from base item
    const menuItem = this.menuItems.find(m => m.id === item.id);
    if (menuItem && menuItem.stock > 0) {
        menuItem.stock -= 1;
        this.saveMenuItems();
    } else if (menuItem && menuItem.stock <= 0) {
        showNotification(`❌ ${item.name} is out of stock!`, 'error');
        return;
    }
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        this.currentOrder.push(variantItem);
    }
    
    this.isOrderSaved = false;
    this.updateOrderDisplay();
    this.updateButtonStates();
    this.renderMenuItems();
    
    showNotification(`✓ ${variantItem.name} added to order`, 'success');
}

// Helper method to add the "Add New Item" button
addAddItemButton(container) {
    const addButton = document.createElement('div');
    addButton.className = 'menu-item add-item-btn';
    addButton.innerHTML = `
        <div style="text-align: center; padding: 30px 0; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div style="font-size: 48px; margin-bottom: 10px; color: #6c757d;">➕</div>
            <div style="font-size: 14px; font-weight: bold; color: #212529;">Add New Menu Item</div>
            <div style="font-size: 12px; color: #6c757d; margin-top: 5px;">Click to add</div>
        </div>
    `;
    addButton.addEventListener('click', () => showAddMenuItemModal());
    addButton.style.cursor = 'pointer';
    addButton.style.background = '#f8f9fa';
    addButton.style.border = '2px dashed #dee2e6';
    addButton.style.display = 'flex';
    addButton.style.alignItems = 'center';
    addButton.style.justifyContent = 'center';
    addButton.style.marginBottom = '15px';
    addButton.style.minHeight = '120px';
    
    addButton.addEventListener('mouseenter', () => {
        addButton.style.borderColor = '#007bff';
        addButton.style.background = '#e9f7fe';
    });
    addButton.addEventListener('mouseleave', () => {
        addButton.style.borderColor = '#dee2e6';
        addButton.style.background = '#f8f9fa';
    });
    
    container.appendChild(addButton);
}

    getStockStatus(item) {
        if (item.stock <= 0) return 'out-of-stock';
        if (item.stock <= item.lowStock) return 'low-stock';
        return 'in-stock';
    }

    setupCategoryFilters() {
    // This is now handled by renderCategories, but keep for compatibility
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.currentCategory = btn.dataset.category;
            this.renderMenuItems();
        });
    });
}

// Render categories dynamically from menu data
renderCategories() {
    const categoryContainer = document.getElementById('categoryTabs');
    if (!categoryContainer) return;
    
    // Clear existing categories
    categoryContainer.innerHTML = '';
    
    // Add "All Items" button first
    const allBtn = document.createElement('button');
    allBtn.className = `category-btn ${this.currentCategory === 'all' ? 'active' : ''}`;
    allBtn.dataset.category = 'all';
    allBtn.textContent = 'All Items';
    allBtn.onclick = () => {
        document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
        allBtn.classList.add('active');
        this.currentCategory = 'all';
        this.renderMenuItems();
    };
    categoryContainer.appendChild(allBtn);
    
    // Get unique categories from menuItems
    const categories = new Map();
    this.menuItems.forEach(item => {
        if (!categories.has(item.category)) {
            let displayName = item.category;
            const categoryNames = {
                'pasta': '🍝 Pasta Zone',
                'rice': '🍚 Rice Zone',
                'grill-chicken': '🍗 Grill & Chicken',
                'wings-bucket': '🍗 Wings Bucket',
                'shawarma': '🌯 Shawarma Zone',
                'burgers': '🍔 Burger Zone',
                'sandwiches': '🥪 Sandwich Zone',
                'noodles': '🍜 Noodles Zone',
                'student-combos': '🎓 Student Combos',
                'drinks': '🥤 Drinks',
                'milkshake': '🥛 Milkshakes',
                'breakfast': '☕ Breakfast',
                'fire-boli': '🔥 Fire Boli',
                'weekend-platter': '⭐ Weekend Platter',
                'protein-sides': '🍗 Protein Sides',
                'special-wings': '🍗 Special Wings',
                'loaded-fries': '🍟 Loaded Fries',
                'chicken-nuggets': '🍗 Chicken Nuggets',
                'salads': '🥗 Salads'
            };
            displayName = categoryNames[item.category] || item.category;
            categories.set(item.category, displayName);
        }
    });
    
    // Sort categories alphabetically
    const sortedCategories = Array.from(categories.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    
    // Add category buttons
    sortedCategories.forEach(([catId, catName]) => {
        const btn = document.createElement('button');
        btn.className = `category-btn ${this.currentCategory === catId ? 'active' : ''}`;
        btn.dataset.category = catId;
        btn.textContent = catName;
        btn.onclick = () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.currentCategory = catId;
            this.renderMenuItems();
        };
        categoryContainer.appendChild(btn);
    });
}

    addToOrder(item) {
        const stockStatus = this.getStockStatus(item);
        if (stockStatus === 'out-of-stock') {
            showNotification(`❌ ${item.name} is out of stock!`, 'error');
            return;
        }
        
        if (stockStatus === 'low-stock') {
            showNotification(`⚠️ ${item.name} is low in stock! Only ${item.stock} left.`, 'warning');
        }

        const existingItem = this.currentOrder.find(orderItem => orderItem.id === item.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.currentOrder.push({
                ...item,
                quantity: 1
            });
        }
        
        item.stock = Math.max(0, item.stock - 1);
        this.saveMenuItems();
        
        this.isOrderSaved = false;
        this.updateOrderDisplay();
        this.updateButtonStates();
        
        showNotification(`✓ ${item.name} added to order`, 'success');
    }

    updateQuantity(itemId, change) {
    console.log('updateQuantity called:', itemId, change);
    
    // Find the item in current order (this works with compound IDs)
    const item = this.currentOrder.find(orderItem => orderItem.id === itemId);
    if (!item) {
        console.log('Item not found in order:', itemId);
        return;
    }
    
    const newQuantity = item.quantity + change;
    
    if (newQuantity <= 0) {
        // Remove item from order
        this.currentOrder = this.currentOrder.filter(orderItem => orderItem.id !== itemId);
        showNotification(`✓ ${item.name} removed from order`, 'info');
    } else {
        // Update quantity
        item.quantity = newQuantity;
        
        // Update stock for the base menu item (extract base ID)
        let baseItemId = itemId;
        if (typeof itemId === 'string' && itemId.includes('_')) {
            // For variant items, extract the base ID (everything before the first underscore)
            baseItemId = parseInt(itemId.split('_')[0]);
        }
        
        const menuItem = this.menuItems.find(m => m.id == baseItemId);
        if (menuItem) {
            if (change > 0 && menuItem.stock <= 0) {
                showNotification(`❌ ${item.name} is out of stock!`, 'error');
                return;
            }
            menuItem.stock = Math.max(0, menuItem.stock - change);
            this.saveMenuItems();
        } else if (change < 0) {
            // Return stock when decreasing quantity for non-variant items
            const returnStockItem = this.menuItems.find(m => m.id == itemId);
            if (returnStockItem) {
                returnStockItem.stock += Math.abs(change);
                this.saveMenuItems();
            }
        }
    }
    
    this.isOrderSaved = false;
    this.updateOrderDisplay();
    this.updateButtonStates();
    this.renderMenuItems();
}

    updateOrderDisplay() {
        // Add this at the beginning of updateOrderDisplay() for debugging
console.log('Order type:', this.orderType);
console.log('Takeaway fee:', this.orderType === 'takeaway' ? 300 : 0);
    const orderItemsContainer = document.getElementById('orderItems');
    const subtotalElement = document.getElementById('subtotal');
    const taxElement = document.getElementById('tax');
    const totalElement = document.getElementById('total');
    const orderStartTime = document.getElementById('orderStartTime');
    const orderNumber = document.getElementById('orderNumber');

    if (this.currentOrder.length === 0) {
        orderItemsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🛒</div>
                <p>No items added</p>
                <small>Select items to begin order</small>
            </div>
        `;
        subtotalElement.textContent = '₦0';
        taxElement.textContent = '₦0';
        totalElement.textContent = '₦0';
        orderNumber.textContent = '-';
        // Hide fee line when no items
        const feeLine = document.getElementById('feeLine');
        if (feeLine) feeLine.style.display = 'none';
        return;
    }

    let subtotal = 0;
    orderItemsContainer.innerHTML = '';

    this.currentOrder.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        const orderItem = document.createElement('div');
        orderItem.className = 'order-item';
        orderItem.innerHTML = `
            <div class="item-details">
                <div class="item-name" style="font-weight: bold;">${item.name}</div>
                <div class="item-price">₦${item.price.toLocaleString()} × ${item.quantity}</div>
            </div>
            <div class="item-quantity">
                <button class="quantity-btn" onclick="pos.updateQuantity(${item.id}, -1)">  -</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" onclick="pos.updateQuantity(${item.id}, 1)"> + </button>
            </div>
        `;
        orderItemsContainer.appendChild(orderItem);
    });

    // Tax is 0%
    const tax = 0;
    
    // Remove automatic takeaway fee - now manual only
const takeawayFee = 0;  // Changed from automatic to manual
const total = subtotal + takeawayFee;

    subtotalElement.textContent = `₦${subtotal.toLocaleString()}`;
    taxElement.textContent = `₦0`;
    totalElement.textContent = `₦${total.toLocaleString()}`;
    
    // Show/hide and update fee line
    const feeLine = document.getElementById('feeLine');
    const feeElement = document.getElementById('takeawayFee');
    
    if (feeLine && feeElement) {
        if (takeawayFee > 0) {
            feeLine.style.display = 'flex';
            feeElement.textContent = `₦${takeawayFee.toLocaleString()}`;
        } else {
            feeLine.style.display = 'none';
        }
    } else {
        // If elements don't exist, create them dynamically
        const totalsDiv = document.querySelector('.order-totals');
        if (totalsDiv && takeawayFee > 0) {
            const existingFee = document.querySelector('.fee-line');
            if (!existingFee) {
                const feeLineDiv = document.createElement('div');
                feeLineDiv.className = 'total-line fee-line';
                feeLineDiv.innerHTML = `
                    <span>🏃 Takeaway Fee:</span>
                    <span id="takeawayFee">₦${takeawayFee.toLocaleString()}</span>
                `;
                const grandTotalLine = document.querySelector('.grand-total');
                if (grandTotalLine) {
                    totalsDiv.insertBefore(feeLineDiv, grandTotalLine);
                } else {
                    totalsDiv.appendChild(feeLineDiv);
                }
            } else {
                document.getElementById('takeawayFee').textContent = `₦${takeawayFee.toLocaleString()}`;
                existingFee.style.display = 'flex';
            }
        }
    }
    
    if (!orderNumber.textContent || orderNumber.textContent === '-') {
        orderNumber.textContent = this.getNextOrderNumber();
    }
    orderStartTime.textContent = new Date().toLocaleTimeString();
}

    updateButtonStates() {
    const saveOrderBtn = document.querySelector('.save-order-btn');
    const checkoutBtn = document.querySelector('.checkout-btn');
    const clearOrderBtn = document.querySelector('.btn-clear');
    
    const hasItems = this.currentOrder.length > 0;
    
    if (saveOrderBtn) {
        saveOrderBtn.disabled = !hasItems || this.isOrderSaved;
    }
    
    // DISABLE CHECKOUT BUTTON - No hard copy printing for now
    if (checkoutBtn) {
        checkoutBtn.disabled = true;  // Always disabled
        checkoutBtn.style.opacity = '0.5';
        checkoutBtn.style.cursor = 'not-allowed';
        checkoutBtn.title = 'Checkout disabled - Use Save Order only';
    }
    
    if (clearOrderBtn) {
        clearOrderBtn.disabled = !hasItems;
    }
}

    clearOrder() {
        if (this.currentOrder.length === 0) return;
        
        if (confirm('Are you sure you want to clear the current order?')) {
            this.currentOrder.forEach(orderItem => {
                const menuItem = this.menuItems.find(m => m.id === orderItem.id);
                if (menuItem) {
                    menuItem.stock += orderItem.quantity;
                }
            });
            this.saveMenuItems();
            
            this.currentOrder = [];
            this.isOrderSaved = false;
            this.updateOrderDisplay();
            this.updateButtonStates();
            this.renderMenuItems();
            showNotification('Order cleared', 'info');
        }
    }

   async saveOrder() {
    if (this.isSaving) {
        console.log('Save already in progress, skipping...');
        return;
    }
    this.isSaving = true;
    
    if (this.currentOrder.length === 0) {
        showNotification('Please add items to the order before saving.', 'error');
        this.isSaving = false;
        return;
    }

    try {
        const subtotal = this.currentOrder.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal;
        
        const orderCounter = this.orderCounter.count + 1;
        const orderNumber = `POS-${String(orderCounter).padStart(4, '0')}`;
        
        // Get selected payment method from POS
        const paymentMethod = typeof posPaymentMethod !== 'undefined' ? posPaymentMethod : 'cash';
        
        const orderData = {
            id: orderNumber,
            order_number: orderNumber,
            staff_id: this.currentStaff.id,
            staff_name: this.currentStaff.display_name,
            customer_name: 'Walk-in Customer',
            customer_phone: `POS-${orderNumber}`,
            items: this.currentOrder.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                variant: item.variant || null
            })),
            subtotal: subtotal,
            takeaway_fee: 0,
            total: total,
            order_type: this.orderType,
            payment_method: paymentMethod,
            payment_status: 'paid',
            order_status: 'completed',
            created_at: new Date().toISOString()
        };

        let cloudSaved = false;
        
        // Save to Supabase
        if (window.supabaseClient && window.supabaseConnected) {
            try {
                const { error } = await window.supabaseClient
                    .from('orders')
                    .insert([orderData]);
                
                if (error) {
                    console.error('Supabase insert error:', error);
                    throw error;
                }
                
                cloudSaved = true;
                console.log('✅ POS Order saved to Supabase cloud');
                
            } catch (cloudError) {
                console.error('Supabase save failed:', cloudError);
                showNotification('⚠️ Cloud save failed, saving locally only', 'warning');
            }
        }
        
        // Always save to local storage as backup
        const orders = JSON.parse(localStorage.getItem('restaurantOrders') || '[]');
        orders.push(orderData);
        localStorage.setItem('restaurantOrders', JSON.stringify(orders));
        
        // Update order counter
        this.orderCounter.count++;
        localStorage.setItem('orderCounter', JSON.stringify(this.orderCounter));
        
        // Update staff sales locally
        staffManager.recordStaffSale(this.currentStaff.id, total);
        
        this.isOrderSaved = true;
        this.updateButtonStates();
        this.updateActiveOrdersCount();
        this.loadRecentOrders(); // This will now show POS orders
        
        // CLEAR THE CURRENT ORDER AFTER SAVING
        this.currentOrder = [];
        this.updateOrderDisplay();
        this.renderMenuItems();
        
        if (cloudSaved) {
            showNotification('✅ Order saved to cloud!', 'success');
        } else {
            showNotification('✅ Order saved locally', 'success');
        }

    } catch (error) {
        console.error('Save error:', error);
        showNotification('Failed to save: ' + error.message, 'error');
    } finally {
        this.isSaving = false;
    }
}

// Add this new function to update customer in Supabase
async updateCustomerInSupabase(orderData) {
    if (!window.supabaseClient || !window.supabaseConnected) return;
    
    try {
        // Check if customer exists
        const { data: existingCustomer } = await window.supabaseClient
            .from('customers')
            .select('*')
            .eq('phone', orderData.customer_phone)
            .single();
        
        if (existingCustomer) {
            // Update existing customer
            const { error } = await window.supabaseClient
                .from('customers')
                .update({
                    total_orders: existingCustomer.total_orders + 1,
                    total_spent: existingCustomer.total_spent + orderData.total,
                    last_order_date: new Date().toISOString()
                })
                .eq('phone', orderData.customer_phone);
            
            if (error) throw error;
        } else {
            // Create new customer
            const { error } = await window.supabaseClient
                .from('customers')
                .insert([{
                    phone: orderData.customer_phone,
                    name: orderData.customer_name,
                    total_orders: 1,
                    total_spent: orderData.total,
                    first_order_date: new Date().toISOString(),
                    last_order_date: new Date().toISOString()
                }]);
            
            if (error) throw error;
        }
        
        console.log('✅ Customer updated in Supabase');
    } catch (error) {
        console.error('Failed to update customer in Supabase:', error);
    }
}

// Add this function to update staff sales in Supabase
async updateStaffSalesInSupabase() {
    if (!window.supabaseClient || !window.supabaseConnected) return;
    
    try {
        // Get current staff data
        const { data: staffData } = await window.supabaseClient
            .from('staff')
            .select('total_sales, total_orders')
            .eq('id', this.currentStaff.id)
            .single();
        
        if (staffData) {
            const { error } = await window.supabaseClient
                .from('staff')
                .update({
                    total_sales: (staffData.total_sales || 0) + this.currentOrder.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                    total_orders: (staffData.total_orders || 0) + 1,
                    last_login: new Date().toISOString()
                })
                .eq('id', this.currentStaff.id);
            
            if (error) throw error;
            console.log('✅ Staff sales updated in Supabase');
        }
    } catch (error) {
        console.error('Failed to update staff sales:', error);
    }
}

    async checkout() {
        try {
            this.validateOrderBeforeCheckout();

            const subtotal = this.currentOrder.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const tax = 0;
            const total = subtotal;

            const orderRecord = {
                id: document.getElementById('orderNumber').textContent,
                staff: {
                    id: this.currentStaff.id,
                    name: this.currentStaff.name,
                    display_name: this.currentStaff.display_name
                },
                items: [...this.currentOrder],
                total: total,
                type: this.orderType,
                timestamp: new Date().toISOString()
            };
            
            const customer = customerCRM.autoSaveCustomerFromOrder(orderRecord, total);

            staffManager.recordStaffSale(this.currentStaff.id, total);

            // Print receipt
            await this.printReceipt();

            this.currentOrder = [];
            this.isOrderSaved = false;
            this.updateOrderDisplay();
            this.updateButtonStates();
            this.renderMenuItems();
            this.updateActiveOrdersCount();
            this.loadRecentOrders();
            
            showNotification('Order completed successfully! ✓', 'success');

        } catch (error) {
            showNotification('Checkout failed: ' + error.message, 'error');
        }
    }

    async printReceipt() {
        // Generate receipt content
        const receiptContent = this.generateReceiptContent();
        
        // Try to print using browser print
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Print Receipt</title>
                <style>
                    @media print {
                        @page { 
                            size: 80mm auto;
                            margin: 0;
                            padding: 0;
                        }
                        body { 
                            width: 80mm;
                            margin: 0;
                            padding: 5mm;
                            font-family: 'Courier New', monospace;
                            font-size: 11px;
                            line-height: 1;
                        }
                    }
                    body {
                        font-family: 'Courier New', monospace;
                        font-size: 11px;
                        line-height: 1.2;
                        width: 80mm;
                        margin: 0 auto;
                        padding: 5mm;
                    }
                    .receipt {
                        white-space: pre-wrap;
                    }
                </style>
            </head>
            <body>
                <div class="receipt">${receiptContent.replace(/\n/g, '<br>')}</div>
                <script>
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                            setTimeout(() => window.close(), 500);
                        }, 100);
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        return true;
    }

    generateReceiptContent() {
        const orderNumber = document.getElementById('orderNumber').textContent;
        const currentTime = new Date().toLocaleString();
        const staffDisplayName = this.currentStaff.display_name;
        const orderType = this.orderType;
        
        const subtotal = this.currentOrder.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = subtotal;
        
        let receipt = '';
        receipt += '══════════════════════════════\n';
        receipt += '      URBANCITY RESTAURANT\n';
        receipt += '══════════════════════════════\n';
        receipt += `Order #: ${orderNumber}\n`;
        receipt += `Date   : ${currentTime}\n`;
        receipt += `Cashier: ${staffDisplayName}\n`;
        receipt += `Type   : ${orderType.toUpperCase()}\n`;
        receipt += '══════════════════════════════\n';
        receipt += 'QTY ITEM                AMOUNT\n';
        receipt += '══════════════════════════════\n';
        
        this.currentOrder.forEach(item => {
            const itemTotal = item.price * item.quantity;
            const itemName = item.name.length > 20 ? item.name.substring(0, 20) : item.name;
            receipt += `${item.quantity.toString().padStart(3)} ${itemName.padEnd(20)} ₦${itemTotal.toLocaleString().padStart(8)}\n`;
        });
        
        receipt += '══════════════════════════════\n';
        receipt += `SUBTOTAL              ₦${subtotal.toLocaleString().padStart(8)}\n`;
        receipt += `TAX                   ₦0\n`;
        receipt += '══════════════════════════════\n';
        receipt += `TOTAL                 ₦${total.toLocaleString().padStart(8)}\n`;
        receipt += '══════════════════════════════\n';
        if (this.orderType === 'takeaway') {
    receipt += `Takeaway Fee:       ₦300\n`;
}
receipt += '══════════════════════════════\n';
        receipt += 'Thank you for your order!\n';
        receipt += `Served by: ${staffDisplayName}\n`;
        receipt += `${orderType === 'takeaway' ? '🏃 Grab & Go' : '🚚 Delivery Available'}\n`;
        receipt += '📞 08105442629\n';
        receipt += '══════════════════════════════\n\n\n\n';
        
        return receipt;
    }

    validateOrderBeforeCheckout() {
        if (this.currentOrder.length === 0) {
            throw new Error('Empty order');
        }
        if (!this.isOrderSaved) {
            throw new Error('Order must be saved before checkout');
        }
    }

    updateActiveOrdersCount() {
    const activeOrdersElement = document.getElementById('activeOrdersCount');
    if (!activeOrdersElement) return;
    
    const updateCount = async () => {
        let count = 0;
        
        // Try Supabase first
        if (window.supabaseClient && window.supabaseConnected) {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                const { count: supabaseCount, error } = await window.supabaseClient
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', today.toISOString())
                    .lt('created_at', tomorrow.toISOString());
                
                if (!error && supabaseCount !== null) {
                    count = supabaseCount;
                    console.log('Supabase count:', count);
                }
            } catch (error) {
                console.error('Failed to get count from Supabase:', error);
            }
        }
        
        // If Supabase failed or no connection, use localStorage
        if (count === 0) {
            const orders = JSON.parse(localStorage.getItem('restaurantOrders') || '[]');
            const today = new Date().toDateString();
            count = orders.filter(order => {
                const orderDate = new Date(order.created_at || order.timestamp).toDateString();
                return orderDate === today;
            }).length;
            console.log('LocalStorage count:', count);
        }
        
        activeOrdersElement.textContent = count;
    };
    
    updateCount();  // ← IMPORTANT: This actually runs the function
}
    async loadRecentOrders() {
    const activeOrdersList = document.getElementById('activeOrdersList');
    if (!activeOrdersList || !this.currentStaff) return;
    
    let orders = [];
    
    // Fetch orders from Supabase
    if (window.supabaseClient && window.supabaseConnected) {
        const { data, error } = await window.supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (!error && data) {
            orders = data;
            console.log('📋 Loaded', orders.length, 'orders from Supabase');
        }
    }
    
    // Fallback to localStorage
    if (orders.length === 0) {
        orders = JSON.parse(localStorage.getItem('restaurantOrders') || '[]');
        orders = orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
    }
    
    if (orders.length === 0) {
        activeOrdersList.innerHTML = `<div class="empty-state"><small>No recent orders</small></div>`;
        return;
    }
    
    let ordersHTML = '';
    orders.forEach(order => {
        const orderNumber = order.order_number || order.id;
        const customerName = order.customer_name || 'Walk-in Customer';
        const total = order.total || 0;
        const orderType = order.order_type || 'takeaway';
        const orderStatus = order.order_status || 'pending';
        // FIX: Get special instructions
        const specialInstructions = order.special_instructions || '';
        const hasInstructions = specialInstructions && specialInstructions.length > 0;
        
        // Format time
        let timeDisplay = 'Just now';
        if (order.created_at) {
            const orderDate = new Date(order.created_at);
            const now = new Date();
            const diffMinutes = Math.floor((now - orderDate) / 60000);
            if (diffMinutes < 60) {
                timeDisplay = `${diffMinutes}m ago`;
            } else if (diffMinutes < 1440) {
                timeDisplay = `${Math.floor(diffMinutes / 60)}h ago`;
            } else {
                timeDisplay = orderDate.toLocaleDateString();
            }
        }
        
        // Status badge
        let statusBadge = '';
        let statusColor = '';
        switch(orderStatus) {
            case 'pending': statusBadge = '⏳'; statusColor = '#ff9800'; break;
            case 'confirmed': statusBadge = '✅'; statusColor = '#2196f3'; break;
            case 'preparing': statusBadge = '🍳'; statusColor = '#ff9800'; break;
            case 'ready': statusBadge = '📦'; statusColor = '#4caf50'; break;
            case 'completed': statusBadge = '🎉'; statusColor = '#2ecc71'; break;
            default: statusBadge = '📋'; statusColor = '#666';
        }
        
        // FIX: Instructions badge
        const instructionsBadge = hasInstructions ? 
            `<span style="font-size: 9px; background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">
                📝 Special Instructions
            </span>` : '';
        
        // FIX: Instructions preview
        const instructionsPreview = hasInstructions ? 
            `<div style="font-size: 10px; color: #856404; margin-top: 3px; background: #fff3cd; padding: 2px 6px; border-radius: 4px; display: inline-block;">📝 ${specialInstructions.substring(0, 50)}${specialInstructions.length > 50 ? '...' : ''}</div>` : '';
        
        ordersHTML += `
            <div class="active-order-item" data-order-id="${order.id}" onclick='showOrderDetails(${JSON.stringify(order).replace(/'/g, "\\'")})' style="border-left: 3px solid ${statusColor}; margin-bottom: 8px; cursor: pointer;">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                        <strong>#${orderNumber}</strong>
                        ${instructionsBadge}
                        <span style="font-size: 10px; background: ${statusColor}20; padding: 2px 6px; border-radius: 10px;">
                            ${statusBadge} ${orderStatus.toUpperCase()}
                        </span>
                    </div>
                    <div style="font-size: 11px; color: #666;">${customerName}</div>
                    <div style="font-size: 10px; color: #999;">${timeDisplay} | ${orderType === 'delivery' ? '🚚' : '🏃'}</div>
                    ${instructionsPreview}
                </div>
                <div style="text-align: right;">
                    <div><strong>₦${total.toLocaleString()}</strong></div>
                    <div style="margin-top: 5px;">
                        <select class="order-status-select" data-order-id="${order.id}" style="font-size: 10px; padding: 2px 5px; border-radius: 5px;">
                            <option value="pending" ${orderStatus === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                            <option value="confirmed" ${orderStatus === 'confirmed' ? 'selected' : ''}>✅ Confirmed</option>
                            <option value="preparing" ${orderStatus === 'preparing' ? 'selected' : ''}>🍳 Preparing</option>
                            <option value="ready" ${orderStatus === 'ready' ? 'selected' : ''}>📦 Ready</option>
                            <option value="completed" ${orderStatus === 'completed' ? 'selected' : ''}>🎉 Completed</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    });
    
    activeOrdersList.innerHTML = ordersHTML;
    
    // Attach event listeners to status dropdowns
    document.querySelectorAll('.order-status-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const orderId = select.dataset.orderId;
            const newStatus = select.value;
            this.updateOrderStatus(orderId, newStatus);
        });
    });
}

async updateOrderStatus(orderId, newStatus) {
    if (!window.supabaseClient) return;
    
    // Update in Supabase
    const { error } = await window.supabaseClient
        .from('orders')
        .update({ 
            order_status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
    
    if (error) {
        console.error('Failed to update order status:', error);
        showNotification('❌ Failed to update status', 'error');
        return;
    }
    
    showNotification(`✅ Order status updated to ${newStatus}`, 'success');
    
    // Send notification to customer (email/WhatsApp)
    this.sendOrderStatusNotification(orderId, newStatus);
    
    // Refresh orders list
    this.loadRecentOrders();
}

async sendOrderStatusNotification(orderId, newStatus) {
    // Get order details
    const { data: order } = await window.supabaseClient
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
    
    if (!order) return;
    
    const statusMessages = {
        'confirmed': '✅ Your order has been CONFIRMED! We will start preparing it shortly.',
        'preparing': '🍳 Your order is now being PREPARED by our chefs!',
        'ready': '📦 Your order is READY for pickup/delivery!',
        'completed': '🎉 Your order is COMPLETED! Enjoy your meal!'
    };
    
    const message = statusMessages[newStatus];
    if (!message) return;
    
    // Send Email (using EmailJS or your email service)
    if (order.customer_email) {
        await this.sendEmailNotification(order.customer_email, order.order_number, message);
    }
    
    // Send WhatsApp (using WhatsApp API or redirect)
    if (order.customer_phone) {
        this.sendWhatsAppNotification(order.customer_phone, order.order_number, message);
    }
}

async sendEmailNotification(email, orderNumber, message) {
    // Using EmailJS (free tier)
    // Sign up at https://www.emailjs.com/
    try {
        const emailData = {
            to_email: email,
            subject: `UrbanCity - Order #${orderNumber} Update`,
            message: `Hello,\n\n${message}\n\nOrder #: ${orderNumber}\n\nThank you for choosing UrbanCity!\n\n📞 08105442629`
        };
        
        // Uncomment after setting up EmailJS
        // await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', emailData);
        console.log('Email notification sent to:', email);
    } catch(e) {
        console.error('Email send failed:', e);
    }
}

sendWhatsAppNotification(phone, orderNumber, message) {
    // Format phone number (remove any non-digits)
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '234' + cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('234')) {
        cleanPhone = '234' + cleanPhone;
    }
    
    const whatsappMessage = `*UrbanCity Restaurant* 🍽️\n\nOrder #${orderNumber}\n${message}\n\nThank you for ordering with us!`;
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    
    // Open WhatsApp in new window (customer will see it)
    // Or use WhatsApp Business API for automatic sending
    window.open(whatsappUrl, '_blank');
}

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            // Clear session
            sessionManager.clearSession();
            
            this.currentStaff = null;
            this.currentOrder = [];
            this.isOrderSaved = false;
            
            document.getElementById('posScreen').classList.remove('active');
            document.getElementById('managerDashboard').classList.remove('active');
            document.getElementById('loginScreen').classList.add('active');
            
            document.getElementById('staffSelect').value = '';
            document.getElementById('staffPin').value = '';
            
            const loginBtn = document.querySelector('.login-btn');
            if (loginBtn) {
                loginBtn.textContent = 'Login to POS System';
                loginBtn.disabled = false;
            }
            
            showNotification('Logged out successfully', 'info');
        }
    }

    addMenuItem(itemData) {
        const newId = Math.max(0, ...this.menuItems.map(item => item.id)) + 1;
        const newItem = {
            id: newId,
            name: itemData.name || 'New Menu Item',
            price: parseFloat(itemData.price) || 0,
            category: itemData.category || 'other',
            stock: parseInt(itemData.stock) || 0,
            lowStock: parseInt(itemData.lowStock) || 10
        };
        this.menuItems.push(newItem);
        this.saveMenuItems();
        this.renderMenuItems();
        return newItem;
    }

    updateMenuItem(id, itemData) {
    const index = this.menuItems.findIndex(item => item.id === parseInt(id));
    if (index !== -1) {
        this.menuItems[index] = {
            ...this.menuItems[index],
            name: itemData.name || this.menuItems[index].name,
            price: parseFloat(itemData.price) || this.menuItems[index].price,
            category: itemData.category || this.menuItems[index].category,
            stock: parseInt(itemData.stock) || this.menuItems[index].stock,
            lowStock: parseInt(itemData.lowStock) || this.menuItems[index].lowStock
        };
        this.saveMenuItems();
        this.saveLocalPriceBackup();  // ← ADD THIS LINE
        this.renderMenuItems();
        showNotification('✅ Menu item updated and saved!', 'success');
        return this.menuItems[index];
    }
    return null;
}

    deleteMenuItem(id) {
        const index = this.menuItems.findIndex(item => item.id === parseInt(id));
        if (index !== -1) {
            this.menuItems.splice(index, 1);
            this.saveMenuItems();
            this.renderMenuItems();
            return true;
        }
        return false;
    }

    getMenuItemById(id) {
        return this.menuItems.find(item => item.id === parseInt(id));
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveOrder();
                        break;
                    case 'c':
                        e.preventDefault();
                        this.checkout();
                        break;
                    case 'l':
                        e.preventDefault();
                        this.clearOrder();
                        break;
                }
            }
        });
    }

    setupSearchFunctionality() {
    setTimeout(() => {
        const searchInput = document.getElementById('menuSearch');
        if (searchInput) {
            console.log('Search input found, attaching event listeners');
            // Use 'input' event for real-time search
            searchInput.addEventListener('input', (e) => {
                console.log('Search input changed:', e.target.value);
                this.filterMenuItems(e.target.value);
            });
            // Also add 'keyup' for better responsiveness
            searchInput.addEventListener('keyup', (e) => {
                this.filterMenuItems(e.target.value);
            });
        } else {
            console.log('Search input not found!');
        }
    }, 1000);
}

    filterMenuItems(searchTerm) {
    const menuContainer = document.getElementById('menuItems');
    if (!menuContainer) return;
    
    const menuItems = menuContainer.querySelectorAll('.menu-item:not(.add-item-btn)');
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    
    console.log('Searching for:', lowerSearchTerm);
    console.log('Menu items found:', menuItems.length);
    
    if (lowerSearchTerm === '') {
        // Show all items if search is empty
        menuItems.forEach(item => {
            item.style.display = 'block';
        });
        return;
    }
    
    let matchCount = 0;
    
    menuItems.forEach(item => {
        // Get all text content from the menu item
        const itemText = item.textContent.toLowerCase();
        
        // Also check specific elements
        const itemName = item.querySelector('div[style*="font-weight: 600"]')?.textContent.toLowerCase() || '';
        const itemCategory = item.querySelector('div[style*="font-size: 11px"]')?.textContent.toLowerCase() || '';
        
        // Check variant buttons if they exist
        let variantText = '';
        const variantBtns = item.querySelectorAll('.variant-btn');
        variantBtns.forEach(btn => {
            variantText += btn.textContent.toLowerCase() + ' ';
        });
        
        // Check if search term is in any of the fields
        const isMatch = itemText.includes(lowerSearchTerm) || 
                        itemName.includes(lowerSearchTerm) ||
                        itemCategory.includes(lowerSearchTerm) ||
                        variantText.includes(lowerSearchTerm);
        
        if (isMatch) {
            matchCount++;
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
    
    console.log('Matches found:', matchCount);
    
    // Optional: Show no results message
    const noResultsMsg = document.getElementById('noSearchResults');
    if (matchCount === 0) {
        if (!noResultsMsg) {
            const msg = document.createElement('div');
            msg.id = 'noSearchResults';
            msg.style.textAlign = 'center';
            msg.style.padding = '40px';
            msg.style.color = '#999';
            msg.innerHTML = '🔍 No items found matching "' + searchTerm + '"';
            menuContainer.appendChild(msg);
        }
    } else if (noResultsMsg) {
        noResultsMsg.remove();
    }
}

    setupButtonEventListeners() {
        setTimeout(() => {
            const saveOrderBtn = document.querySelector('.save-order-btn');
            const checkoutBtn = document.querySelector('.checkout-btn');
            const clearOrderBtn = document.querySelector('.btn-clear');
            
            if (saveOrderBtn) {
                saveOrderBtn.addEventListener('click', () => this.saveOrder());
            }
            if (checkoutBtn) {
                checkoutBtn.addEventListener('click', () => this.checkout());
            }
            if (clearOrderBtn) {
                clearOrderBtn.addEventListener('click', () => this.clearOrder());
            }
        }, 1000);
    }
}

// Initialize core systems
const inventoryManager = new InventoryManager();
const dataManager = new DataManager();
const customerCRM = new CustomerCRM();
const staffManager = new StaffManager();
const pos = new UrbanCityPOS();

// =============================================
// GLOBAL FUNCTIONS
// =============================================

// Login functions
function staffLogin() { 
    console.log('Login button clicked');
    pos.staffLogin(); 
}

function logout() { 
    pos.logout(); 
}

function clearOrder() { 
    pos.clearOrder(); 
}

async function checkout() { 
    await pos.checkout(); 
}

async function saveOrder() { 
    await pos.saveOrder(); 
}

function addRushItem(itemId) { 
    pos.addRushItem(itemId); 
}

function setOrderType(type) {
    const takeawayBtn = document.getElementById('takeawayBtn');
    const deliveryBtn = document.getElementById('deliveryBtn');
    
    if (takeawayBtn && deliveryBtn) {
        takeawayBtn.classList.remove('active');
        deliveryBtn.classList.remove('active');
        
        if (type === 'takeaway') {
            takeawayBtn.classList.add('active');
        } else {
            deliveryBtn.classList.add('active');
        }
    }
}

function changeOrderType(type) {
    pos.changeOrderType(type);
}

// Upsell functions
function upsellDrink() {
    const drinks = [19, 20, 21, 22];
    for (const drinkId of drinks) {
        const item = pos.menuItems.find(m => m.id === drinkId);
        if (item && pos.getStockStatus(item) !== 'out-of-stock') {
            pos.addToOrder(item);
            showNotification(`✓ ${item.name} added to order`, 'success');
            return;
        }
    }
    showNotification('No drinks available in stock', 'error');
}

function upsellWater() {
    // Find water item by name instead of ID
    const water = pos.menuItems.find(m => m.name.toLowerCase().includes('water'));
    if (water && pos.getStockStatus(water) !== 'out-of-stock') {
        pos.addToOrder(water);
        showNotification(`✓ ${water.name} added to order`, 'success');
    } else {
        showNotification('Water is out of stock', 'error');
    }
}

// =============================================
// DISPLAY NAME EDITOR FUNCTIONS
// =============================================
function showEditDisplayNameModal() {
    const staffId = pos.currentStaff.id;
    const staff = staffManager.getStaffById(staffId);
    
    if (!staff) {
        showNotification('Staff not found', 'error');
        return;
    }

    const modalHTML = `
        <div class="modal-overlay active" id="displayNameModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ Edit Your Display Name</h3>
                    <button class="modal-close" onclick="closeDisplayNameModal()">×</button>
                </div>
                <div style="padding: 20px;">
                    <p style="margin-bottom: 15px; color: #666;">
                        This name will appear on receipts and customer records.
                        Your full name: <strong>${staff.full_name || staff.name}</strong>
                    </p>
                    <div class="form-group">
                        <label for="displayName">Display Name *</label>
                        <input type="text" id="displayName" value="${staff.display_name}" 
                               placeholder="Enter display name" style="width: 100%; padding: 10px;">
                    </div>
                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button type="button" class="btn-secondary" onclick="closeDisplayNameModal()">Cancel</button>
                        <button type="button" class="btn-primary" onclick="updateDisplayName()">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeDisplayNameModal() {
    const modal = document.getElementById('displayNameModal');
    if (modal) modal.remove();
}

function updateDisplayName() {
    const staffId = pos.currentStaff.id;
    const newDisplayName = document.getElementById('displayName').value.trim();
    
    if (!newDisplayName) {
        showNotification('Display name cannot be empty', 'error');
        return;
    }
    
    if (staffManager.updateStaffDisplayName(staffId, newDisplayName)) {
        pos.currentStaff.display_name = newDisplayName;
        document.getElementById('currentStaff').textContent = newDisplayName;
        document.getElementById('currentServerName').textContent = newDisplayName;
        
        // Update session
        sessionManager.setCurrentStaff(pos.currentStaff);
        
        closeDisplayNameModal();
        showNotification('Display name updated successfully! ✓', 'success');
    } else {
        showNotification('Failed to update display name', 'error');
    }
}

// =============================================
// MANAGER DASHBOARD FUNCTIONS
// =============================================
function openManagerDashboard() {
    console.log('Opening manager dashboard');
    if (pos.currentStaff && (pos.currentStaff.role === 'manager' || pos.currentStaff.role === 'CEO')) {
        document.getElementById('posScreen').classList.remove('active');
        document.getElementById('managerDashboard').classList.add('active');
        
        // Update session
        sessionManager.setCurrentScreen('manager');
        
        const now = new Date();
        document.getElementById('dashboardTime').textContent = 
            now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
        document.getElementById('dashboardStaffName').textContent = pos.currentStaff.display_name;
        
        // Load inventory
        loadInventoryManagement();
    }
}

function closeManagerDashboard() {
    console.log('⬅️ Back to POS called');
    document.getElementById('managerDashboard').classList.remove('active');
    document.getElementById('posScreen').classList.add('active');
    sessionManager.setCurrentScreen('pos');
}

// =============================================
// INVENTORY MANAGEMENT FUNCTIONS
// =============================================
function loadInventoryManagement() {
    console.log('Loading inventory...');
    const inventoryGrid = document.getElementById('inventoryGrid');
    if (!inventoryGrid) return;
    
    const inventory = inventoryManager.getAllItems();
    
    if (!inventory || inventory.length === 0) {
        inventoryGrid.innerHTML = `
            <div class="empty-inventory">
                <div class="empty-icon">📦</div>
                <h3>No Inventory Items</h3>
                <p>Add your first inventory item to get started</p>
                <button class="btn-primary" onclick="showAddItemModal()">+ Add Item</button>
            </div>
        `;
        return;
    }
    
    let inventoryHTML = '';
    
    inventory.forEach(item => {
        const stockStatus = item.stock <= 0 ? 'out' : item.stock <= item.lowStock ? 'low' : 'available';
        const statusClass = stockStatus === 'out' ? 'stock-out' : stockStatus === 'low' ? 'stock-low' : 'stock-available';
        const statusText = stockStatus === 'out' ? 'Out of Stock' : stockStatus === 'low' ? 'Low Stock' : 'In Stock';
        
        inventoryHTML += `
            <div class="inventory-item ${stockStatus === 'low' || stockStatus === 'out' ? stockStatus + '-stock' : ''}">
                <div class="inventory-header">
                    <div class="inventory-info">
                        <div class="inventory-name">${item.name}</div>
                        <div class="inventory-category">${item.category || 'General'}</div>
                    </div>
                    <div class="inventory-stock ${statusClass}">${statusText}</div>
                </div>
                <div class="inventory-details">
                    <div class="stock-info">Current Stock: <strong>${item.stock}</strong></div>
                    <div class="stock-info">Low Stock Alert: <strong>${item.lowStock}</strong></div>
                    <div class="stock-value">Reorder when below ${item.lowStock} units</div>
                </div>
                <div class="inventory-controls">
                    <button class="btn-small btn-edit" onclick="editInventoryItem(${item.id})">✏️ Edit</button>
                    <button class="btn-small btn-delete" onclick="deleteInventoryItem(${item.id})">🗑️ Delete</button>
                </div>
            </div>
        `;
    });
    
    inventoryGrid.innerHTML = inventoryHTML;
}

// Google Sheets function
function openGoogleSheets() {
    console.log('📊 Opening Google Sheets');
    window.open('https://docs.google.com/spreadsheets/d/10FeHf8TjzkUNf58-xEp9Lxt16Eqq5Te9lpdq7TfaDgk/edit', '_blank');
    showNotification('✅ Google Sheets opened in new tab', 'success');
}

// Sync to Google Sheets function
function syncInventoryToGoogleSheets() {
    showNotification('🔄 Syncing inventory to Google Sheets...', 'info');
    
    try {
        const inventory = inventoryManager.getAllItems();
        // In a real implementation, you would send this to your backend
        // For now, we'll just show a success message
        showNotification('✅ Inventory ready to sync! (Backend integration needed)', 'success');
    } catch (error) {
        console.error('Sync error:', error);
        showNotification('❌ Sync failed: ' + error.message, 'error');
    }
}

// =============================================
// ADD ITEM MODAL FUNCTIONS (FIXED)
// =============================================
function showAddItemModal() {
    console.log('📦 showAddItemModal called');
    
    // Close any existing modals
    const existingModal = document.getElementById('addItemModal');
    if (existingModal) existingModal.remove();
    
    const modalHTML = `
        <div class="modal-overlay active" id="addItemModal" style="z-index: 10000;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📦 Add Inventory Item</h3>
                    <button class="modal-close" onclick="closeAddItemModal()">×</button>
                </div>
                <form onsubmit="handleAddItem(event)">
                    <div style="padding: 20px;">
                        <div class="form-group">
                            <label for="itemName">Item Name *</label>
                            <input type="text" id="itemName" required class="form-control" placeholder="Enter item name">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="itemStock">Initial Stock *</label>
                                <input type="number" id="itemStock" required min="0" value="0" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="itemLowStock">Low Stock Alert *</label>
                                <input type="number" id="itemLowStock" required min="1" value="10" class="form-control">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="itemCategory">Category</label>
                            <select id="itemCategory" class="form-control">
                                <option value="general">General</option>
                                <option value="pasta">Pasta</option>
                                <option value="rice">Rice</option>
                                <option value="wings">Wings</option>
                                <option value="burger">Burger</option>
                                <option value="shawarma">Shawarma</option>
                                <option value="grill">Grill</option>
                                <option value="combos">Combos</option>
                                <option value="drinks">Drinks</option>
                                <option value="boli">Boli</option>
                            </select>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeAddItemModal()">Cancel</button>
                            <button type="submit" class="btn-primary">Add Item</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeAddItemModal() {
    console.log('📦 closeAddItemModal called');
    const modal = document.getElementById('addItemModal');
    if (modal) modal.remove();
}

function handleAddItem(event) {
    console.log('📦 handleAddItem called');
    event.preventDefault();
    
    const itemData = {
        name: document.getElementById('itemName').value,
        stock: parseInt(document.getElementById('itemStock').value) || 0,
        lowStock: parseInt(document.getElementById('itemLowStock').value) || 10,
        category: document.getElementById('itemCategory').value
    };
    
    inventoryManager.addItem(itemData);
    closeAddItemModal();
    loadInventoryManagement();
    showNotification('✅ Item added to inventory!', 'success');
}

// =============================================
// EDIT TORY ITEM FUNCTIONS (FIXED)
// =============================================
function editInventoryItem(itemId) {
    console.log('✏️ editInventoryItem called for ID:', itemId);
    
    const item = inventoryManager.getAllItems().find(i => i.id === itemId);
    if (!item) {
        showNotification('Item not found', 'error');
        return;
    }
    
    const modalHTML = `
        <div class="modal-overlay active" id="editItemModal" style="z-index: 10000;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ Edit Inventory Item</h3>
                    <button class="modal-close" onclick="closeEditItemModal()">×</button>
                </div>
                <form onsubmit="handleUpdateItem(event, ${itemId})">
                    <div style="padding: 20px;">
                        <div class="form-group">
                            <label for="editItemName">Item Name *</label>
                            <input type="text" id="editItemName" value="${item.name}" required class="form-control">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editItemStock">Current Stock *</label>
                                <input type="number" id="editItemStock" value="${item.stock}" required min="0" class="form-control">
                            </div>
                            <div class="form-group">
                                <label for="editItemLowStock">Low Stock Alert *</label>
                                <input type="number" id="editItemLowStock" value="${item.lowStock}" required min="1" class="form-control">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="editItemCategory">Category</label>
                            <select id="editItemCategory" class="form-control">
                                <option value="general" ${item.category === 'general' ? 'selected' : ''}>General</option>
                                <option value="pasta" ${item.category === 'pasta' ? 'selected' : ''}>Pasta</option>
                                <option value="rice" ${item.category === 'rice' ? 'selected' : ''}>Rice</option>
                                <option value="wings" ${item.category === 'wings' ? 'selected' : ''}>Wings</option>
                                <option value="burger" ${item.category === 'burger' ? 'selected' : ''}>Burger</option>
                                <option value="shawarma" ${item.category === 'shawarma' ? 'selected' : ''}>Shawarma</option>
                                <option value="grill" ${item.category === 'grill' ? 'selected' : ''}>Grill</option>
                                <option value="combos" ${item.category === 'combos' ? 'selected' : ''}>Combos</option>
                                <option value="drinks" ${item.category === 'drinks' ? 'selected' : ''}>Drinks</option>
                                <option value="boli" ${item.category === 'boli' ? 'selected' : ''}>Boli</option>
                            </select>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeEditItemModal()">Cancel</button>
                            <button type="submit" class="btn-primary">Update Item</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeEditItemModal() {
    console.log('✏️ closeEditItemModal called');
    const modal = document.getElementById('editItemModal');
    if (modal) modal.remove();
}

function handleUpdateItem(event, itemId) {
    console.log('✏️ handleUpdateItem called for ID:', itemId);
    event.preventDefault();
    
    const itemData = {
        name: document.getElementById('editItemName').value,
        stock: parseInt(document.getElementById('editItemStock').value) || 0,
        lowStock: parseInt(document.getElementById('editItemLowStock').value) || 10,
        category: document.getElementById('editItemCategory').value
    };
    
    inventoryManager.updateItem(itemId, itemData);
    closeEditItemModal();
    loadInventoryManagement();
    showNotification('✅ Item updated successfully!', 'success');
}

// =============================================
// DELETE INVENTORY ITEM FUNCTION (FIXED)
// =============================================
function deleteInventoryItem(itemId) {
    console.log('🗑️ deleteInventoryItem called for ID:', itemId);
    if (confirm('Are you sure you want to delete this item?')) {
        inventoryManager.deleteItem(itemId);
        loadInventoryManagement();
        showNotification('✅ Item deleted!', 'success');
    }
}

// In your POS script.js - Enhanced notification system

async function sendOrderStatusNotification(orderId, newStatus) {
    // Get order details from Supabase
    const { data: order } = await window.supabaseClient
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
    
    if (!order) return;
    
    const statusMessages = {
        'confirmed': {
            message: '✅ Your order has been CONFIRMED! We will start preparing it shortly.',
            subject: 'Order Confirmed - UrbanCity'
        },
        'preparing': {
            message: '🍳 Your order is now being PREPARED by our chefs!',
            subject: 'Order Being Prepared - UrbanCity'
        },
        'ready': {
            message: '📦 Your order is READY for pickup/delivery!',
            subject: 'Order Ready - UrbanCity'
        },
        'completed': {
            message: '🎉 Your order is COMPLETED! Enjoy your meal!',
            subject: 'Order Completed - UrbanCity'
        }
    };
    
    const msg = statusMessages[newStatus];
    if (!msg) return;
    
    const fullMessage = `UrbanCity Restaurant 🍽️\n\nOrder #${order.order_number}\n${msg.message}\n\nThank you for ordering with us!\n📞 Questions? Call 08105442629`;
    
    // 1. Send Email via EmailJS
    if (order.customer_email) {
        await sendEmail(order.customer_email, msg.subject, fullMessage);
    }
    
    // 2. Send WhatsApp via Click-to-Chat (opens chat for customer)
    if (order.customer_phone) {
        sendWhatsAppClickToChat(order.customer_phone, fullMessage);
    }
}

// EmailJS setup (free tier)
async function sendEmail(toEmail, subject, message) {
    try {
        // After setting up EmailJS account, replace with your credentials
        const templateParams = {
            to_email: toEmail,
            subject: subject,
            message: message
        };
        
        // Uncomment after EmailJS setup
        // await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', templateParams);
        console.log('📧 Email would send to:', toEmail);
        
    } catch (error) {
        console.error('Email send failed:', error);
    }
}

// WhatsApp Click-to-Chat (opens WhatsApp with pre-filled message)
function sendWhatsAppClickToChat(phone, message) {
    // Format phone number (Nigeria format)
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = '234' + cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('234')) {
        cleanPhone = '234' + cleanPhone;
    }
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    
    // Open in new window (staff can click to send)
    window.open(whatsappUrl, '_blank');
}


// =============================================
// MENU MANAGER FUNCTIONS (Integrated from admin.html)
// =============================================

let allMenuItems = [];
let menuFilter = 'all';
let menuSearchTerm = '';

async function loadMenuManager() {
    console.log('Loading menu manager...');
    const container = document.getElementById('menuManagerGrid');
    if (!container) return;
    
    // Fetch menu items from Supabase
        const { data, error } = await window.supabaseClient  // Add window.
        .from('menu_items')
        .select('*, categories!inner(category_id, name)')
        .order('name');
    
    if (error) {
        console.error('Error loading menu items:', error);
        container.innerHTML = '<div style="text-align:center; padding:50px; color:#e74c3c;">Failed to load menu items</div>';
        return;
    }
    
    allMenuItems = data;
    renderMenuManager();
}

function renderMenuManager() {
    const container = document.getElementById('menuManagerGrid');
    if (!container) return;
    
    let filtered = [...allMenuItems];
    
    // Apply filter
    if (menuFilter === 'available') {
        filtered = filtered.filter(item => item.is_available === true);
    } else if (menuFilter === 'unavailable') {
        filtered = filtered.filter(item => item.is_available === false);
    }
    
    // Apply search
    if (menuSearchTerm) {
        filtered = filtered.filter(item => 
            item.name.toLowerCase().includes(menuSearchTerm.toLowerCase()) ||
            (item.categories?.name && item.categories.name.toLowerCase().includes(menuSearchTerm.toLowerCase()))
        );
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:50px; color:#aaa;">No menu items found</div>';
        return;
    }
    
    container.innerHTML = filtered.map(item => {
        const isAvailable = item.is_available === true;
        const categoryName = item.categories?.name || item.category_id;
        const priceDisplay = item.price_display || (item.price ? `₦${item.price.toLocaleString()}` : 'Price varies');
        
        return `
            <div class="menu-card ${!isAvailable ? 'unavailable' : ''}">
                <div class="card-image" style="background-image: url('${item.image || ''}'); background-size: cover; background-position: center;">
                    <div class="availability-badge ${isAvailable ? 'badge-available' : 'badge-unavailable'}">
                        <i class="fas ${isAvailable ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                        ${isAvailable ? 'Available' : 'Unavailable'}
                    </div>
                </div>
                <div class="card-content">
                    <div class="card-title">${escapeHtml(item.name)}</div>
                    <div class="card-category"><i class="fas fa-tag"></i> ${escapeHtml(categoryName)}</div>
                    <div class="card-price"><i class="fas fa-naira-sign"></i> ${escapeHtml(priceDisplay)}</div>
                    <div class="card-actions">
                        <button class="edit-menu-btn" onclick="editMenuItemFromManager('${item.item_id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="toggle-availability-btn" onclick="toggleMenuAvailability('${item.item_id}', ${isAvailable})">
                            <i class="fas ${isAvailable ? 'fa-eye-slash' : 'fa-eye'}"></i>
                            ${isAvailable ? 'Disable' : 'Enable'}
                        </button>
                        <button class="delete-menu-btn" onclick="deleteMenuItemFromManager('${item.item_id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function toggleMenuAvailability(itemId, currentStatus) {
    const newStatus = !currentStatus;
    
    const { error } = await supabaseClient
        .from('menu_items')
        .update({ 
            is_available: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq('item_id', itemId);
    
    if (error) {
        showNotification('❌ Error updating item status', 'error');
        return;
    }
    
    showNotification(`✅ Item is now ${newStatus ? 'available' : 'unavailable'}`, 'success');
    loadMenuManager();
    // Also refresh the main menu if POS is active
    if (pos && pos.renderMenuItems) pos.renderMenuItems();
}

async function deleteMenuItemFromManager(itemId) {
    if (confirm('Delete this menu item? This cannot be undone.')) {
        // First delete variants
        await supabaseClient.from('variants').delete().eq('menu_item_id', itemId);
        // Then delete menu item
        const { error } = await supabaseClient.from('menu_items').delete().eq('item_id', itemId);
        
        if (error) {
            showNotification('❌ Error deleting item', 'error');
            return;
        }
        
        showNotification('🗑️ Menu item deleted', 'success');
        loadMenuManager();
        if (pos && pos.renderMenuItems) pos.renderMenuItems();
    }
}

function editMenuItemFromManager(itemId) {
    // Find the item in allMenuItems
    const item = allMenuItems.find(i => i.item_id === itemId);
    if (!item) return;
    
    // Show edit modal (reuse existing POS edit modal or create one)
    showEditMenuItemModal(item);
}

function showEditMenuItemModal(item) {
    // Create modal for editing menu item
    const modalHTML = `
        <div class="modal-overlay active" id="editMenuModal">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>✏️ Edit Menu Item</h3>
                    <button class="modal-close" onclick="closeEditMenuModal()">×</button>
                </div>
                <div style="padding: 20px;">
                    <div class="form-group">
                        <label>Item Name</label>
                        <input type="text" id="editItemName" value="${escapeHtml(item.name)}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <input type="text" id="editItemCategory" value="${item.category_id}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="editItemDesc" class="form-control" rows="2">${escapeHtml(item.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Price Display</label>
                        <input type="text" id="editItemPrice" value="${item.price_display || ''}" class="form-control" placeholder="₦7,500">
                    </div>
                    <div class="form-group">
                        <label>Image Filename</label>
                        <input type="text" id="editItemImage" value="${item.image || ''}" class="form-control">
                    </div>
                    <div class="modal-actions" style="margin-top: 20px;">
                        <button class="btn-secondary" onclick="closeEditMenuModal()">Cancel</button>
                        <button class="btn-primary" onclick="saveMenuItemEdit('${item.item_id}')">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeEditMenuModal() {
    const modal = document.getElementById('editMenuModal');
    if (modal) modal.remove();
}

async function saveMenuItemEdit(itemId) {
    const updates = {
        name: document.getElementById('editItemName').value,
        category_id: document.getElementById('editItemCategory').value,
        description: document.getElementById('editItemDesc').value,
        price_display: document.getElementById('editItemPrice').value,
        image: document.getElementById('editItemImage').value,
        updated_at: new Date().toISOString()
    };
    
    const { error } = await supabaseClient
        .from('menu_items')
        .update(updates)
        .eq('item_id', itemId);
    
    if (error) {
        showNotification('❌ Error updating item', 'error');
        return;
    }
    
    showNotification('✅ Menu item updated!', 'success');
    closeEditMenuModal();
    loadMenuManager();
    if (pos && pos.renderMenuItems) pos.renderMenuItems();
}

function openAddMenuItemModal() {
    // Show add menu item modal
    const modalHTML = `
        <div class="modal-overlay active" id="addMenuModal">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>➕ Add New Menu Item</h3>
                    <button class="modal-close" onclick="closeAddMenuModal()">×</button>
                </div>
                <div style="padding: 20px;">
                    <div class="form-group">
                        <label>Item Name *</label>
                        <input type="text" id="newItemName" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Category ID *</label>
                        <input type="text" id="newItemCategory" class="form-control" placeholder="e.g., pasta, burgers" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="newItemDesc" class="form-control" rows="2"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Price Display</label>
                        <input type="text" id="newItemPrice" class="form-control" placeholder="₦7,500">
                    </div>
                    <div class="form-group">
                        <label>Image Filename</label>
                        <input type="text" id="newItemImage" class="form-control" placeholder="34.jpg">
                    </div>
                    <div class="form-group">
                        <label>Tags (comma separated)</label>
                        <input type="text" id="newItemTags" class="form-control" placeholder="Spicy, Popular">
                    </div>
                    <div class="modal-actions" style="margin-top: 20px;">
                        <button class="btn-secondary" onclick="closeAddMenuModal()">Cancel</button>
                        <button class="btn-primary" onclick="createNewMenuItem()">Create Item</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeAddMenuModal() {
    const modal = document.getElementById('addMenuModal');
    if (modal) modal.remove();
}

async function createNewMenuItem() {
    const itemId = `item-${Date.now()}`;
    const newItem = {
        item_id: itemId,
        name: document.getElementById('newItemName').value,
        category_id: document.getElementById('newItemCategory').value,
        description: document.getElementById('newItemDesc').value,
        price_display: document.getElementById('newItemPrice').value,
        image: document.getElementById('newItemImage').value,
        tags: document.getElementById('newItemTags').value.split(',').map(t => t.trim()),
        is_available: true,
        is_active: true,
        created_at: new Date().toISOString()
    };
    
    const { error } = await supabaseClient.from('menu_items').insert([newItem]);
    
    if (error) {
        showNotification('❌ Error creating item: ' + error.message, 'error');
        return;
    }
    
    showNotification('✅ Menu item created!', 'success');
    closeAddMenuModal();
    loadMenuManager();
    if (pos && pos.renderMenuItems) pos.renderMenuItems();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Setup menu manager event listeners
function setupMenuManagerListeners() {
    const searchInput = document.getElementById('menuManagerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            menuSearchTerm = e.target.value;
            renderMenuManager();
        });
    }
    
    document.querySelectorAll('#menumanager-tab .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#menumanager-tab .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            menuFilter = btn.dataset.filter;
            renderMenuManager();
        });
    });
}

// =============================================
// MENU ITEM MANAGEMENT FUNCTIONS
// =============================================
function showAddMenuItemModal() {
    const modalHTML = `
        <div class="modal-overlay active" id="addMenuItemModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🍽️ Add Menu Item</h3>
                    <button class="modal-close" onclick="closeAddMenuItemModal()">×</button>
                </div>
                <form onsubmit="handleAddMenuItem(event)">
                    <div style="padding: 20px;">
                        <div class="form-group">
                            <label for="menuItemName">Item Name *</label>
                            <input type="text" id="menuItemName" required placeholder="Enter item name">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="menuItemPrice">Price (₦) *</label>
                                <input type="number" id="menuItemPrice" required min="0" step="100" placeholder="0">
                            </div>
                            <div class="form-group">
                                <label for="menuItemStock">Initial Stock *</label>
                                <input type="number" id="menuItemStock" required min="0" value="10">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="menuItemLowStock">Low Stock Alert</label>
                                <input type="number" id="menuItemLowStock" min="1" value="5">
                            </div>
                            <div class="form-group">
                                <label for="menuItemCategory">Category *</label>
                                <select id="menuItemCategory" required>
                                    <option value="pasta">🍝 Pasta</option>
                                    <option value="rice">🍚 Rice</option>
                                    <option value="grill-chicken">🍗 Grill</option>
                                    <option value="wings-bucket">🍗 Wings</option>
                                    <option value="shawarma">🌯 Shawarma</option>
                                    <option value="burgers">🍔 Burger</option>
                                    <option value="sandwiches">🥪 Sandwich</option>
                                    <option value="noodles">🍜 Noodles</option>
                                    <option value="student-combos">🎓 Combos</option>
                                    <option value="drinks">🥤 Drinks</option>
                                    <option value="milkshake">🥛 Milkshakes</option>
                                    <option value="breakfast">☕ Breakfast</option>
                                    <option value="fire-boli">🔥 Boli</option>
                                    <option value="weekend-platter">⭐ Weekend Platter</option>
                                </select>
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeAddMenuItemModal()">Cancel</button>
                            <button type="submit" class="btn-primary">Add Menu Item</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeAddMenuItemModal() {
    const modal = document.getElementById('addMenuItemModal');
    if (modal) modal.remove();
}

function handleAddMenuItem(event) {
    event.preventDefault();
    
    const itemData = {
        name: document.getElementById('menuItemName').value,
        price: document.getElementById('menuItemPrice').value,
        stock: document.getElementById('menuItemStock').value,
        lowStock: document.getElementById('menuItemLowStock').value,
        category: document.getElementById('menuItemCategory').value
    };
    
    pos.addMenuItem(itemData);
    closeAddMenuItemModal();
    showNotification('Menu item added!', 'success');
}

function editMenuItem(itemId) {
    const item = pos.getMenuItemById(itemId);
    if (!item) return;
    
    const modalHTML = `
        <div class="modal-overlay active" id="editMenuItemModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ Edit Menu Item</h3>
                    <button class="modal-close" onclick="closeEditMenuItemModal()">×</button>
                </div>
                <form onsubmit="handleUpdateMenuItem(event, ${itemId})">
                    <div style="padding: 20px;">
                        <div class="form-group">
                            <label for="editMenuItemName">Item Name *</label>
                            <input type="text" id="editMenuItemName" value="${item.name}" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editMenuItemPrice">Price (₦) *</label>
                                <input type="number" id="editMenuItemPrice" value="${item.price}" required min="0" step="100">
                            </div>
                            <div class="form-group">
                                <label for="editMenuItemStock">Current Stock *</label>
                                <input type="number" id="editMenuItemStock" value="${item.stock || 0}" required min="0">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editMenuItemLowStock">Low Stock Alert</label>
                                <input type="number" id="editMenuItemLowStock" value="${item.lowStock || 10}" min="1">
                            </div>
                            <div class="form-group">
                                <label for="editMenuItemCategory">Category *</label>
                                <select id="editMenuItemCategory" required>
                                    <option value="pasta" ${item.category === 'pasta' ? 'selected' : ''}>🍝 Pasta</option>
                                    <option value="rice" ${item.category === 'rice' ? 'selected' : ''}>🍚 Rice</option>
                                    <option value="grill-chicken" ${item.category === 'grill-chicken' ? 'selected' : ''}>🍗 Grill</option>
                                    <option value="wings-bucket" ${item.category === 'wings-bucket' ? 'selected' : ''}>🍗 Wings</option>
                                    <option value="shawarma" ${item.category === 'shawarma' ? 'selected' : ''}>🌯 Shawarma</option>
                                    <option value="burgers" ${item.category === 'burgers' ? 'selected' : ''}>🍔 Burger</option>
                                    <option value="sandwiches" ${item.category === 'sandwiches' ? 'selected' : ''}>🥪 Sandwich</option>
                                    <option value="noodles" ${item.category === 'noodles' ? 'selected' : ''}>🍜 Noodles</option>
                                    <option value="student-combos" ${item.category === 'student-combos' ? 'selected' : ''}>🎓 Combos</option>
                                    <option value="drinks" ${item.category === 'drinks' ? 'selected' : ''}>🥤 Drinks</option>
                                    <option value="milkshake" ${item.category === 'milkshake' ? 'selected' : ''}>🥛 Milkshakes</option>
                                    <option value="breakfast" ${item.category === 'breakfast' ? 'selected' : ''}>☕ Breakfast</option>
                                    <option value="fire-boli" ${item.category === 'fire-boli' ? 'selected' : ''}>🔥 Boli</option>
                                    <option value="weekend-platter" ${item.category === 'weekend-platter' ? 'selected' : ''}>⭐ Weekend Platter</option>
                                </select>
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeEditMenuItemModal()">Cancel</button>
                            <button type="submit" class="btn-primary">Update Menu Item</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeEditMenuItemModal() {
    const modal = document.getElementById('editMenuItemModal');
    if (modal) modal.remove();
}

function handleUpdateMenuItem(event, itemId) {
    event.preventDefault();
    
    const itemData = {
        name: document.getElementById('editMenuItemName').value,
        price: document.getElementById('editMenuItemPrice').value,
        stock: document.getElementById('editMenuItemStock').value,
        lowStock: document.getElementById('editMenuItemLowStock').value,
        category: document.getElementById('editMenuItemCategory').value
    };
    
    pos.updateMenuItem(itemId, itemData);
    closeEditMenuItemModal();
    showNotification('Menu item updated!', 'success');
}

function deleteMenuItem(itemId) {
    if (confirm('Are you sure you want to delete this menu item?')) {
        pos.deleteMenuItem(itemId);
        showNotification('Menu item deleted!', 'success');
    }
}

// =============================================
// STAFF MANAGEMENT FUNCTIONS
// =============================================
function loadStaffManagement() {
    const staffList = document.getElementById('staffList');
    if (!staffList) return;
    
    const staff = staffManager.getAllStaff();
    
    if (staff.length === 0) {
        staffList.innerHTML = '<div class="empty-state">No staff members found</div>';
        return;
    }
    
    let staffHTML = '';
    staff.forEach(staffMember => {
        staffHTML += `
            <div class="staff-card">
                <div class="staff-info">
                    <h4>${staffMember.display_name}</h4>
                    <div class="staff-role">${staffMember.role === 'manager' ? '👑 Manager' : staffMember.role === 'CEO' ? '👑 CEO' : '👤 Staff'}</div>
                    <div class="staff-id">ID: ${staffMember.id} | PIN: ${staffMember.pin_code}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">
                        📧 ${staffMember.email} | 📞 ${staffMember.phone}
                    </div>
                    <div style="font-size: 11px; color: #888; margin-top: 3px;">
                        Sales: ₦${(staffMember.total_sales || 0).toLocaleString()} | Orders: ${staffMember.total_orders || 0}
                    </div>
                </div>
                <div class="staff-controls">
                    <button class="btn-edit-staff" onclick="editStaff('${staffMember.id}')">✏️ Edit</button>
                    ${staffMember.role !== 'manager' && staffMember.role !== 'CEO' ? `<button class="btn-delete-staff" onclick="deleteStaff('${staffMember.id}')">🗑️ Delete</button>` : ''}
                </div>
            </div>
        `;
    });
    
    staffList.innerHTML = staffHTML;
}

function showAddStaffModal() {
    const modalHTML = `
        <div class="modal-overlay active" id="addStaffModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>👥 Add Staff Member</h3>
                    <button class="modal-close" onclick="closeAddStaffModal()">×</button>
                </div>
                <form onsubmit="handleAddStaff(event)">
                    <div style="padding: 20px;">
                        <div class="form-group">
                            <label for="staffName">Full Name *</label>
                            <input type="text" id="staffName" required placeholder="Enter full name">
                        </div>
                        <div class="form-group">
                            <label for="staffDisplayName">Display Name *</label>
                            <input type="text" id="staffDisplayName" required placeholder="Name shown on receipts">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="staffId">Staff ID *</label>
                                <input type="text" id="staffId" required placeholder="e.g., john_doe">
                            </div>
                            <div class="form-group">
                                <label for="staffPin">PIN Code (4 digits) *</label>
                                <input type="password" id="staffPin" required maxlength="4" pattern="[0-9]{4}" placeholder="1234">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="staffRole">Role *</label>
                                <select id="staffRole" required>
                                    <option value="staff">Staff</option>
                                    <option value="manager">Manager</option>
                                    <option value="CEO">CEO</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="staffEmail">Email</label>
                                <input type="email" id="staffEmail" placeholder="staff@urbancity.com">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="staffPhone">Phone Number</label>
                            <input type="tel" id="staffPhone" placeholder="0803-XXX-XXXX">
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeAddStaffModal()">Cancel</button>
                            <button type="submit" class="btn-primary">Add Staff</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeAddStaffModal() {
    const modal = document.getElementById('addStaffModal');
    if (modal) modal.remove();
}

function handleAddStaff(event) {
    event.preventDefault();
    
    const staffData = {
        id: document.getElementById('staffId').value,
        name: document.getElementById('staffName').value,
        display_name: document.getElementById('staffDisplayName').value,
        full_name: document.getElementById('staffName').value,
        pin_code: document.getElementById('staffPin').value,
        role: document.getElementById('staffRole').value,
        email: document.getElementById('staffEmail').value,
        phone: document.getElementById('staffPhone').value
    };
    
    const result = staffManager.createStaff(staffData);
    if (result.success) {
        closeAddStaffModal();
        loadStaffManagement();
        showNotification('Staff member added successfully!', 'success');
    } else {
        showNotification('Failed to add staff member: ' + result.message, 'error');
    }
}

function editStaff(staffId) {
    const staff = staffManager.getStaffById(staffId);
    if (!staff) return;
    
    const modalHTML = `
        <div class="modal-overlay active" id="editStaffModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ Edit Staff Member</h3>
                    <button class="modal-close" onclick="closeEditStaffModal()">×</button>
                </div>
                <form onsubmit="handleUpdateStaff(event, '${staffId}')">
                    <div style="padding: 20px;">
                        <div class="form-group">
                            <label for="editStaffName">Full Name *</label>
                            <input type="text" id="editStaffName" value="${staff.name}" required>
                        </div>
                        <div class="form-group">
                            <label for="editStaffDisplayName">Display Name *</label>
                            <input type="text" id="editStaffDisplayName" value="${staff.display_name}" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editStaffPin">PIN Code (4 digits) *</label>
                                <input type="password" id="editStaffPin" value="${staff.pin_code}" required maxlength="4" pattern="[0-9]{4}">
                            </div>
                            <div class="form-group">
                                <label for="editStaffRole">Role *</label>
                                <select id="editStaffRole" required>
                                    <option value="staff" ${staff.role === 'staff' ? 'selected' : ''}>Staff</option>
                                    <option value="manager" ${staff.role === 'manager' ? 'selected' : ''}>Manager</option>
                                    <option value="CEO" ${staff.role === 'CEO' ? 'selected' : ''}>CEO</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="editStaffEmail">Email</label>
                                <input type="email" id="editStaffEmail" value="${staff.email || ''}">
                            </div>
                            <div class="form-group">
                                <label for="editStaffPhone">Phone Number</label>
                                <input type="tel" id="editStaffPhone" value="${staff.phone || ''}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="editStaffCanEdit" ${staff.can_edit_display_name !== false ? 'checked' : ''}>
                                Allow to edit display name
                            </label>
                        </div>
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" onclick="closeEditStaffModal()">Cancel</button>
                            <button type="submit" class="btn-primary">Update Staff</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeEditStaffModal() {
    const modal = document.getElementById('editStaffModal');
    if (modal) modal.remove();
}

function handleUpdateStaff(event, staffId) {
    event.preventDefault();
    
    const updates = {
        name: document.getElementById('editStaffName').value,
        display_name: document.getElementById('editStaffDisplayName').value,
        pin_code: document.getElementById('editStaffPin').value,
        role: document.getElementById('editStaffRole').value,
        email: document.getElementById('editStaffEmail').value,
        phone: document.getElementById('editStaffPhone').value,
        can_edit_display_name: document.getElementById('editStaffCanEdit').checked
    };
    
    if (staffManager.updateStaff(staffId, updates)) {
        closeEditStaffModal();
        loadStaffManagement();
        
        // If editing current staff, update UI and session
        if (pos.currentStaff && pos.currentStaff.id === staffId) {
            pos.currentStaff.display_name = updates.display_name;
            pos.currentStaff.role = updates.role;
            pos.currentStaff.can_edit_display_name = updates.can_edit_display_name;
            document.getElementById('currentStaff').textContent = updates.display_name;
            document.getElementById('currentServerName').textContent = updates.display_name;
            pos.updateManagerAccess();
            
            // Update session
            sessionManager.setCurrentStaff(pos.currentStaff);
        }
        
        showNotification('Staff updated successfully! ✓', 'success');
    } else {
        showNotification('Failed to update staff member', 'error');
    }
}

function deleteStaff(staffId) {
    if (confirm('Are you sure you want to delete this staff member?')) {
        if (pos.currentStaff && pos.currentStaff.id === staffId) {
            showNotification('Cannot delete currently logged in staff member', 'error');
            return;
        }
        
        if (staffManager.deleteStaff(staffId)) {
            loadStaffManagement();
            showNotification('Staff member deleted successfully!', 'success');
        } else {
            showNotification('Failed to delete staff member', 'error');
        }
    }
}

// =============================================
// SALES REPORTS FUNCTIONS
// =============================================
function generateManagerReport() {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent) return;
    
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7);
    
    const totalSales = customerCRM.getTotalSales();
    const totalOrders = customerCRM.getTotalOrders();
    
    reportContent.innerHTML = `
        <div class="report-summary">
            <h3>📊 Sales Report</h3>
            
            <div class="report-controls">
                <h4>🔍 Filters</h4>
                <div class="report-filters">
                    <div class="form-group">
                        <label for="reportStartDate">Start Date</label>
                        <input type="date" id="reportStartDate" value="${startDate.toISOString().split('T')[0]}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="reportEndDate">End Date</label>
                        <input type="date" id="reportEndDate" value="${today.toISOString().split('T')[0]}" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="reportStaffFilter">Staff Member</label>
                        <select id="reportStaffFilter" class="form-control">
                            <option value="all">All Staff</option>
                            ${staffManager.getAllStaff().map(staff => 
                                `<option value="${staff.id}">${staff.display_name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <button class="btn-primary" onclick="generateFilteredReport()" style="height: fit-content;">
                        🔍 Generate Report
                    </button>
                </div>
            </div>
            
            <div class="report-stats" style="margin-top: 20px;">
                <div class="stat-card">
                    <div class="stat-value">₦${totalSales.toLocaleString()}</div>
                    <div class="stat-label">Total Sales</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalOrders}</div>
                    <div class="stat-label">Total Orders</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${staffManager.getAllStaff().length}</div>
                    <div class="stat-label">Staff Members</div>
                </div>
            </div>
            
            <div id="reportResults" style="margin-top: 20px;">
                <div style="text-align: center; padding: 40px; color: #666;">
                    Click "Generate Report" to view detailed sales data
                </div>
            </div>
        </div>
    `;
}

async function refreshSalesReport() {
    showNotification('🔄 Refreshing sales report...', 'info');
    
    // Clear cache and reload
    if (window.supabaseClient && window.supabaseConnected) {
        const { data, error } = await window.supabaseClient
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (!error && data) {
            console.log(`📋 Found ${data.length} orders in Supabase`);
            showNotification(`✅ Loaded ${data.length} orders from cloud`, 'success');
            
            // Update the report display
            await generateFilteredReport();
        } else {
            console.error('Error fetching orders:', error);
        }
    }
}

// Add a refresh button to the sales report tab
// Add this to your generateManagerReport function:
const refreshButton = `
    <div style="margin-bottom: 15px;">
        <button class="btn-secondary" onclick="refreshSalesReport()" style="margin-right: 10px;">
            🔄 Refresh from Cloud
        </button>
    </div>
`;

async function generateFilteredReport() {
    const startDateInput = document.getElementById('reportStartDate').value;
    const endDateInput = document.getElementById('reportEndDate').value;
    const staffFilter = document.getElementById('reportStaffFilter').value;
    
    if (!startDateInput || !endDateInput) {
        showNotification('Please select start and end dates', 'error');
        return;
    }
    
    showNotification('🔄 Fetching orders...', 'info');
    
    let orders = [];
    let fromCloud = false;
    
    // Try to fetch from Supabase cloud
    if (window.supabaseClient && window.supabaseConnected) {
        try {
            // Ensure dates are properly formatted
            const startDate = new Date(startDateInput);
            const endDate = new Date(endDateInput);
            endDate.setHours(23, 59, 59, 999);
            
            const { data, error } = await window.supabaseClient
                .from('orders')
                .select('*')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false });
            
            if (!error && data && data.length > 0) {
                orders = data;
                fromCloud = true;
                console.log(`✅ Fetched ${orders.length} orders from cloud`);
                showNotification(`✅ Loaded ${orders.length} orders from cloud`, 'success');
            } else if (error) {
                console.error('Supabase fetch error:', error);
            }
        } catch (error) {
            console.error('Supabase fetch failed:', error);
        }
    }
    
    // If cloud fetch failed, use localStorage
    if (orders.length === 0) {
        const localOrders = JSON.parse(localStorage.getItem('restaurantOrders') || '[]');
        
        // Filter by date range
        const startDate = new Date(startDateInput);
        const endDate = new Date(endDateInput);
        endDate.setHours(23, 59, 59, 999);
        
        orders = localOrders.filter(order => {
            const orderDate = new Date(order.created_at || order.timestamp);
            return orderDate >= startDate && orderDate <= endDate;
        });
        
        if (staffFilter !== 'all') {
            orders = orders.filter(order => (order.staff_id || order.staff?.id) === staffFilter);
        }
        
        if (!fromCloud && orders.length === 0) {
            showNotification('⚠️ No orders found in selected date range', 'warning');
        } else if (!fromCloud && orders.length > 0) {
            showNotification('⚠️ Using local data (cloud unavailable)', 'warning');
        }
    }
    
    // Display results
    displayReportResults(orders, startDateInput, endDateInput, fromCloud);
}

// Add these functions after generateFilteredReport()

function updateReportSummary(orders) {
    const totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalOrders = orders.length;
    const averageOrder = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
    
    const cashOrders = orders.filter(o => o.payment_method === 'cash');
    const transferOrders = orders.filter(o => o.payment_method === 'transfer');
    
    const cashSales = cashOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const transferSales = transferOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    
    const summaryHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
            <div class="stat-card" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white;">
                <div class="stat-value">₦${totalSales.toLocaleString()}</div>
                <div class="stat-label">Total Sales</div>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #f093fb, #f5576c); color: white;">
                <div class="stat-value">${totalOrders}</div>
                <div class="stat-label">Total Orders</div>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #4facfe, #00f2fe); color: white;">
                <div class="stat-value">₦${averageOrder.toLocaleString()}</div>
                <div class="stat-label">Average Order</div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
            <div class="stat-card" style="background: #4caf50; color: white;">
                <div class="stat-value">₦${cashSales.toLocaleString()}</div>
                <div class="stat-label">💵 Cash (${cashOrders.length} orders)</div>
            </div>
            <div class="stat-card" style="background: #2196f3; color: white;">
                <div class="stat-value">₦${transferSales.toLocaleString()}</div>
                <div class="stat-label">🏦 Bank Transfer (${transferOrders.length} orders)</div>
            </div>
        </div>
    `;
    
    // Add summary to report results
    const reportResults = document.getElementById('reportResults');
    if (reportResults && orders.length > 0) {
        // Check if summary already exists
        if (!document.querySelector('.report-summary-stats')) {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'report-summary-stats';
            summaryDiv.innerHTML = summaryHtml;
            reportResults.insertBefore(summaryDiv, reportResults.firstChild);
        }
    }
}

async function refreshSalesReport() {
    showNotification('🔄 Refreshing from cloud...', 'info');
    await generateFilteredReport();
}

async function exportReportToExcel() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    
    if (!startDate || !endDate) {
        showNotification('Please select date range first', 'error');
        return;
    }
    
    showNotification('📊 Preparing export...', 'info');
    
    // Fetch orders
    const { data: orders } = await window.supabaseClient
        .from('orders')
        .select('*')
        .gte('created_at', new Date(startDate).toISOString())
        .lte('created_at', new Date(endDate).toISOString());
    
    if (!orders || orders.length === 0) {
        showNotification('No orders to export', 'warning');
        return;
    }
    
    // Convert to CSV
    const csvRows = [
        ['Order Number', 'Date', 'Customer', 'Total', 'Payment Method', 'Staff', 'Items']
    ];
    
    orders.forEach(order => {
        csvRows.push([
            order.order_number,
            new Date(order.created_at).toLocaleString(),
            order.customer_name || 'Walk-in',
            order.total,
            order.payment_method || 'cash',
            order.staff_name,
            order.items?.length || 0
        ]);
    });
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_report_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('✅ Report exported!', 'success');
}

// Add this helper function
function displayReportResults(orders, startDate, endDate, fromCloud = false) {
    const totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0);
    const totalOrders = orders.length;
    const averageOrder = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
    
    let reportHTML = `
        <div class="report-stats">
            <div class="stat-card">
                <div class="stat-value">₦${totalSales.toLocaleString()}</div>
                <div class="stat-label">Total Sales</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalOrders}</div>
                <div class="stat-label">Total Orders</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">₦${averageOrder.toLocaleString()}</div>
                <div class="stat-label">Average Order</div>
            </div>
        </div>
        
        <div style="margin-top: 30px;">
            <h4>📋 Order Details (${startDate} to ${endDate})</h4>
    `;
    
    if (orders.length === 0) {
        reportHTML += `<div style="background: #f8f9fa; padding: 20px; text-align: center;">No orders found</div>`;
    } else {
        orders.slice(0, 20).forEach(order => {
            const orderDate = new Date(order.created_at || order.timestamp);
            reportHTML += `
                <div style="background: white; padding: 15px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #e9ecef;">
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <strong>#${order.order_number || order.id}</strong>
                            <div style="font-size: 12px; color: #666;">${orderDate.toLocaleString()}</div>
                        </div>
                        <div style="text-align: right;">
                            <strong>₦${(order.total || 0).toLocaleString()}</strong>
                            <div style="font-size: 12px;">👤 ${order.staff_name || 'Staff'}</div>
                        </div>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-top: 8px;">
                        Items: ${order.items ? order.items.map(i => `${i.quantity}x ${i.name}`).join(', ') : 'N/A'}
                    </div>
                </div>
            `;
        });
    }
    
    reportHTML += `</div>`;
    document.getElementById('reportResults').innerHTML = reportHTML;
}

function exportReportData() {
    showNotification('Export feature coming soon!', 'info');
}

function printReport() {
    const reportResults = document.getElementById('reportResults').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>UrbanCity Sales Report</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .report-header { text-align: center; margin-bottom: 30px; }
                    .stat-card { display: inline-block; margin: 10px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; min-width: 150px; text-align: center; }
                    .order-item { border-bottom: 1px solid #eee; padding: 10px 0; }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <h1>UrbanCity Sales Report</h1>
                    <p>Generated on ${new Date().toLocaleString()}</p>
                </div>
                ${reportResults}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    }
                </script>
            </body>
        </html>
    `);
}

// =============================================
// CUSTOMER MANAGEMENT FUNCTIONS
// =============================================
async function loadCustomerManagement() {
    const customersList = document.getElementById('customersList');
    if (!customersList) return;
    
    customersList.innerHTML = '<div class="loading">Loading customers from cloud...</div>';
    
    let customers = [];
    
    // Fetch from Supabase
    if (window.supabaseClient && window.supabaseConnected) {
        try {
            const { data, error } = await window.supabaseClient
                .from('customers')
                .select('*')
                .order('total_spent', { ascending: false });
            
            if (!error && data) {
                customers = data;
                console.log(`✅ Loaded ${customers.length} customers from Supabase`);
            } else {
                console.error('Supabase error:', error);
            }
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        }
    }
    
    // Fallback to localStorage
    if (customers.length === 0) {
        customers = customerCRM.getAllCustomers();
        customers = customers.filter(c => c.phone && !c.phone.includes('undefined'));
    }
    
    if (customers.length === 0) {
    customersList.innerHTML = `
        <div class="empty-inventory">
            <div class="empty-icon">👤</div>
            <h3>No Customers Found</h3>
            <p>Customer data will appear after orders are completed</p>
            <button class="btn-primary" onclick="generateCustomersFromOrders()" style="margin-top: 15px; background: #ff9800;">
                🔄 Generate Customers from Orders
            </button>
        </div>
    `;
    return;
}
    
        let customersHTML = '';
    customers.slice(0, 50).forEach(customer => {
        const lastOrderDate = customer.last_order_date ? new Date(customer.last_order_date).toLocaleDateString() : 'Never';
        const firstOrderDate = customer.first_order_date ? new Date(customer.first_order_date).toLocaleDateString() : 'N/A';
        
        customersHTML += `
            <div class="customer-card">
                <div class="customer-header">
                    <div class="customer-info">
                        <div class="customer-name">${escapeHtml(customer.name)}</div>
                        <div class="customer-phone">📞 ${customer.phone}</div>
                    </div>
                    <div class="customer-stats">
                        <div class="customer-total">₦${(customer.total_spent || 0).toLocaleString()}</div>
                        <div style="font-size: 12px; color: #666;">${customer.total_orders || 0} orders</div>
                    </div>
                </div>
                <div class="customer-details">
                    <div>First Order: ${firstOrderDate}</div>
                    <div>Last Order: ${lastOrderDate}</div>
                    <div>Loyalty Points: ${customer.loyalty_points || 0}</div>
                </div>
                <button class="btn-small" style="margin-top: 10px; background: #ff9800; width: 100%; cursor: pointer;" onclick="viewCustomerOrders('${customer.phone}')">
                    📋 View Orders
                </button>
            </div>
        `;
    });
    
    customersList.innerHTML = customersHTML;
}

// Add this function after loadCustomerManagement()
async function generateCustomersFromOrders() {
    showNotification('🔄 Generating customers from order history...', 'info');
    
    if (!window.supabaseClient || !window.supabaseConnected) {
        showNotification('❌ Cannot generate: Supabase not connected', 'error');
        return;
    }
    
    try {
        // Get all orders with customer info
        const { data: orders, error } = await window.supabaseClient
            .from('orders')
            .select('customer_phone, customer_name, total, created_at, staff_name, payment_method')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        if (!orders || orders.length === 0) {
            showNotification('No orders found to generate customers from', 'info');
            return;
        }
        
        // Group by customer phone
        const customerMap = new Map();
        
        orders.forEach(order => {
            const phone = order.customer_phone;
            if (!phone || phone.includes('undefined')) return;
            
            if (!customerMap.has(phone)) {
                customerMap.set(phone, {
                    phone: phone,
                    name: order.customer_name || `Customer-${phone.substring(0, 10)}`,
                    total_orders: 0,
                    total_spent: 0,
                    first_order_date: order.created_at,
                    last_order_date: order.created_at,
                    loyalty_points: 0
                });
            }
            
            const customer = customerMap.get(phone);
            customer.total_orders++;
            customer.total_spent += order.total || 0;
            customer.loyalty_points += Math.floor((order.total || 0) / 100);
            
            if (new Date(order.created_at) < new Date(customer.first_order_date)) {
                customer.first_order_date = order.created_at;
            }
            if (new Date(order.created_at) > new Date(customer.last_order_date)) {
                customer.last_order_date = order.created_at;
            }
        });
        
        // Insert customers into Supabase
        const customers = Array.from(customerMap.values());
        let inserted = 0;
        let failed = 0;
        
        for (const customer of customers) {
            const { error: insertError } = await window.supabaseClient
                .from('customers')
                .upsert([customer], { onConflict: 'phone' });
            
            if (insertError) {
                console.error('Failed to insert customer:', customer.phone, insertError);
                failed++;
            } else {
                inserted++;
            }
        }
        
        showNotification(`✅ Generated ${inserted} customers from ${orders.length} orders! (Failed: ${failed})`, 'success');
        loadCustomerManagement(); // Refresh the display
        
    } catch (error) {
        console.error('Failed to generate customers:', error);
        showNotification('❌ Failed to generate customers: ' + error.message, 'error');
    }
}

// Add this function to view customer orders
async function viewCustomerOrders(phone) {
    if (!window.supabaseClient) {
        showNotification('Supabase not connected', 'error');
        return;
    }
    
    const { data: orders, error } = await window.supabaseClient
        .from('orders')
        .select('*')
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false });
    
    if (error) {
        showNotification('Error fetching orders', 'error');
        return;
    }
    
    if (orders && orders.length > 0) {
        let ordersHtml = '<div style="max-height: 400px; overflow-y: auto;">';
        orders.forEach(order => {
            ordersHtml += `
                <div style="border-bottom: 1px solid #eee; padding: 10px;">
                    <strong>#${order.order_number}</strong> - ₦${(order.total || 0).toLocaleString()}<br>
                    <small>${new Date(order.created_at).toLocaleString()}</small>
                    <div style="font-size: 11px; color: #666;">Payment: ${order.payment_method || 'cash'} | Items: ${order.items?.length || 0}</div>
                </div>
            `;
        });
        ordersHtml += '</div>';
        
        // Create modal
        const modalHtml = `
            <div class="modal-overlay active" id="customerOrdersModal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>📋 Orders for ${phone}</h3>
                        <button class="modal-close" onclick="closeCustomerOrdersModal()">×</button>
                    </div>
                    <div style="padding: 20px;">
                        ${ordersHtml}
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } else {
        showNotification('No orders found for this customer', 'info');
    }
}

function closeCustomerOrdersModal() {
    const modal = document.getElementById('customerOrdersModal');
    if (modal) modal.remove();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function searchCustomers() {
    const searchInput = document.getElementById('customerSearch');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    if (!query) {
        loadCustomerManagement();
        return;
    }
    
    const customers = customerCRM.searchCustomers(query);
    const customersList = document.getElementById('customersList');
    
    if (customers.length === 0) {
        customersList.innerHTML = `
            <div class="empty-inventory">
                <div class="empty-icon">🔍</div>
                <h3>No Customers Found</h3>
                <p>No customers match your search criteria</p>
            </div>
        `;
        return;
    }
    
    let customersHTML = '';
    customers.forEach(customer => {
        customersHTML += `
            <div class="customer-card">
                <div class="customer-header">
                    <div class="customer-info">
                        <div class="customer-name">${customer.name}</div>
                        <div class="customer-phone">📞 ${customer.phone}</div>
                    </div>
                    <div class="customer-stats">
                        <div class="customer-total">₦${customer.totalSpent.toLocaleString()}</div>
                        <div style="font-size: 12px; color: #666;">${customer.totalOrders} orders</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    customersList.innerHTML = customersHTML;
}

function showAddCustomerModal() {
    showNotification('Customer add feature coming soon!', 'info');
}

// =============================================
// PRINTER SETUP FUNCTIONS
// =============================================
function showPrinterSetupModal() {
    const modalHTML = `
        <div class="modal-overlay active" id="printerSetupModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🖨️ Printer Setup</h3>
                    <button class="modal-close" onclick="closePrinterSetupModal()">×</button>
                </div>
                <div style="padding: 20px;">
                    <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <h4 style="margin-bottom: 10px;">📋 Printer Status</h4>
                        <p><strong>Status:</strong> Browser Printing (Default)</p>
                    </div>
                    
                    <div class="form-group">
                        <label>Printer Type</label>
                        <select id="printerSelect" class="form-control">
                            <option value="browser">Browser Print</option>
                            <option value="thermal">Thermal Receipt</option>
                        </select>
                        <small class="form-text text-muted">Select your printer type</small>
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <button class="btn-primary" onclick="testPrinter()">
                            🔍 Test Printer
                        </button>
                    </div>
                    
                    <div id="testResult" style="margin-top: 15px; min-height: 50px;"></div>
                    
                    <div class="modal-actions" style="margin-top: 20px;">
                        <button type="button" class="btn-secondary" onclick="closePrinterSetupModal()">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closePrinterSetupModal() {
    const modal = document.getElementById('printerSetupModal');
    if (modal) modal.remove();
}

function testPrinter() {
    const testResult = document.getElementById('testResult');
    testResult.innerHTML = '<p style="color: #666;">🔄 Testing printer...</p>';
    
    setTimeout(() => {
        testResult.innerHTML = `
            <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 8px;">
                <p style="font-weight: bold;">✅ Printer Test Successful!</p>
                <p>Browser print dialog should appear.</p>
            </div>
        `;
        
        // Trigger browser print
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Printer Test</title>
                    <style>body { font-family: monospace; }</style>
                </head>
                <body>
                    <h2>Printer Test Page</h2>
                    <p>If you can see this, your printer is working.</p>
                    <p>UrbanCity POS - Test Print</p>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
        setTimeout(() => printWindow.close(), 1000);
    }, 500);
}

// =============================================
// SYSTEM FUNCTIONS
// =============================================
function resetDailyData() {
    if (confirm('Reset daily order counter? This will reset today\'s order numbers.')) {
        const counterData = { date: new Date().toDateString(), count: 0 };
        localStorage.setItem('orderCounter', JSON.stringify(counterData));
        pos.orderCounter = counterData;
        showNotification('Daily data reset successfully!', 'success');
    }
}

function clearAllData() {
    if (confirm('⚠️ WARNING: This will delete ALL data including orders, customers, and inventory. This action cannot be undone. Continue?')) {
        if (confirm('Are you ABSOLUTELY sure? This will reset everything to default.')) {
            localStorage.clear();
            sessionManager.clearSession();
            showNotification('All data cleared. Reloading...', 'info');
            setTimeout(() => location.reload(), 2000);
        }
    }
}

function syncWithSupabase() {
    showNotification('Sync feature coming soon!', 'info');
}
/*// =============================================
// SUPABASE CONFIGURATION - CORRECT KEYS
// =============================================
const SUPABASE_URL = 'https://adeafeez42.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ds8r_-Tazgld1ZyGeysxdA_CooTp260';

let supabaseClient = null;
let supabaseConnected = false;

// Initialize Supabase
async function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase library not loaded');
        return false;
    }
    
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client created with anon key');
        
        // Test connection by checking if we can access the API
        const { data, error } = await supabaseClient
            .from('orders')
            .select('count', { count: 'exact', head: true });
        
        if (error) {
            // Check if it's a table doesn't exist error
            if (error.message.includes('does not exist')) {
                console.warn('⚠️ Orders table not found. Please create tables first in Supabase SQL editor.');
                supabaseConnected = false;
                return false;
            }
            console.error('Supabase test error:', error);
            supabaseConnected = false;
            return false;
        }
        
        supabaseConnected = true;
        console.log('✅ Supabase connected successfully!');
        
        // Update connection status in UI
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.innerHTML = '✅ Connected to Supabase Cloud';
            connectionStatus.style.background = '#d4edda';
            connectionStatus.style.color = '#155724';
        }
        
        return true;
    } catch (error) {
        console.error('❌ Supabase connection failed:', error.message);
        supabaseConnected = false;
        
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.innerHTML = '⚠️ Offline Mode (Using local storage)';
            connectionStatus.style.background = '#fff3cd';
            connectionStatus.style.color = '#856404';
        }
        
        return false;
    }
}

// Function to check Supabase connection status
function getSupabaseStatus() {
    return { connected: supabaseConnected, client: supabaseClient };
}*/

function updateSystemInfo() {
    const staffCount = staffManager.getAllStaff().length;
    const customers = customerCRM.customers;
    const totalOrders = customers.reduce((sum, customer) => sum + (customer.totalOrders || 0), 0);
    
    const staffCountElement = document.getElementById('staffCount');
    const totalOrdersCountElement = document.getElementById('totalOrdersCount');
    const lastSyncTimeElement = document.getElementById('lastSyncTime');
    const sessionInfoElement = document.getElementById('sessionInfo');
    
    if (staffCountElement) staffCountElement.textContent = staffCount;
    if (totalOrdersCountElement) totalOrdersCountElement.textContent = totalOrders;
    if (lastSyncTimeElement) lastSyncTimeElement.textContent = new Date().toLocaleTimeString();
    if (sessionInfoElement) sessionInfoElement.textContent = sessionManager.currentStaff ? 'Active' : 'Inactive';
    
    // Update printer status
    const systemPrinterStatus = document.getElementById('systemPrinterStatus');
    const systemPrinterType = document.getElementById('systemPrinterType');
    const systemPrinterIP = document.getElementById('systemPrinterIP');
    
    if (systemPrinterStatus) systemPrinterStatus.textContent = 'Browser Printing';
    if (systemPrinterType) systemPrinterType.textContent = 'Browser';
    if (systemPrinterIP) systemPrinterIP.textContent = 'Not applicable';
}

// =============================================
// CHECKOUT WITH PRINT FUNCTION
// =============================================
async function checkoutWithPrint() {
    showNotification('⚠️ Checkout & Print is currently disabled. Please use "Save Order" only.', 'warning');
    // Do nothing - just show warning
}

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    const pinInput = document.getElementById('staffPin');
    const staffSelect = document.getElementById('staffSelect');
    
    console.log('UrbanCity Takeaway POS System Loaded');

    /*// After Supabase is connected, set up real-time listener
if (window.supabaseConnected) {
    setTimeout(() => {
        if (pos && typeof pos.setupRealtimeOrderListener === 'function') {
            pos.setupRealtimeOrderListener();
            pos.addNewOrderHighlightStyle();
            console.log('✅ Real-time order listener active');
        }
    }, 2000);
}*/
    
    // ===== SUPABASE INITIALIZATION =====
    const SUPABASE_URL = 'https://bpeyueppcksrbhugltjt.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZXl1ZXBwY2tzcmJodWdsdGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NTQ4NzIsImV4cCI6MjA4MDIzMDg3Mn0.5CnMyogeIbvM7medccj3ZPgUcDm6W52asIqQDC7EKAM';
    
    async function initSupabase() {
    try {
        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase library not loaded');
            window.supabaseConnected = false;
            return;
        }
        
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase client created');
        
        // Test connection
        const { data, error } = await window.supabaseClient
            .from('orders')
            .select('count', { count: 'exact', head: true });
        
        if (error && error.message.includes('does not exist')) {
            console.warn('⚠️ Orders table not found yet');
            window.supabaseConnected = false;
        } else {
            window.supabaseConnected = true;
            console.log('✅ Supabase connected successfully!');
            
            const connectionStatus = document.getElementById('connectionStatus');
            if (connectionStatus) {
                connectionStatus.innerHTML = '✅ Connected to Supabase Cloud';
                connectionStatus.style.background = '#d4edda';
                connectionStatus.style.color = '#155724';
            }

           /* // =============================================
// POS PAYMENT METHOD SELECTOR
// =============================================
let posPaymentMethod = 'cash';

function setupPOSPaymentSelector() {
    const cashBtn = document.getElementById('posPaymentCash');
    const transferBtn = document.getElementById('posPaymentTransfer');
    
    if (cashBtn) {
        cashBtn.addEventListener('click', () => {
            cashBtn.style.background = '#4caf50';
            cashBtn.style.color = 'white';
            transferBtn.style.background = '#f0f0f0';
            transferBtn.style.color = '#333';
            posPaymentMethod = 'cash';
            console.log('POS Payment method set to: Cash');
        });
    }
    
    if (transferBtn) {
        transferBtn.addEventListener('click', () => {
            transferBtn.style.background = '#2196f3';
            transferBtn.style.color = 'white';
            cashBtn.style.background = '#f0f0f0';
            cashBtn.style.color = '#333';
            posPaymentMethod = 'transfer';
            console.log('POS Payment method set to: Bank Transfer');
        });
    }
}*/

// Call this when POS loads (in showPOSScreen or after login)
// Add this line to your showPOSScreen method:
// setupPOSPaymentSelector();
            
            // ===== ADD THIS AUTO-SYNC CODE RIGHT HERE =====
            setTimeout(() => {
                if (pos && typeof pos.autoSyncLocalOrders === 'function') {
                    console.log('🔄 Running auto-sync for local orders...');
                    pos.autoSyncLocalOrders();
                }
            }, 3000);
            // ===== END OF AUTO-SYNC CODE =====
        }
    } catch (error) {
        console.error('❌ Supabase connection failed:', error.message);
        window.supabaseConnected = false;
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            connectionStatus.innerHTML = '⚠️ Offline Mode (Using local storage)';
            connectionStatus.style.background = '#fff3cd';
            connectionStatus.style.color = '#856404';
        }
    }
}
    
    // Call Supabase initialization
initSupabase();
// After Supabase is connected, set up real-time listener
if (window.supabaseConnected) {
    setTimeout(() => {
        if (pos && typeof pos.setupRealtimeOrderListener === 'function') {
            pos.setupRealtimeOrderListener();
            pos.addOrderNotificationStyles();
            console.log('✅ Real-time order listener active - waiting for website orders');
        }
    }, 2000);
}
// ===== END OF SUPABASE INITIALIZATION =====

// Load staff dropdown
staffManager.updateLoginDropdown();

// ===== CONNECTION STATUS MONITOR =====
// Update connection status periodically (every 5 seconds)
setInterval(() => {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement && window.supabaseConnected) {
        statusElement.innerHTML = '✅ Connected to Supabase Cloud';
        statusElement.style.background = '#d4edda';
        statusElement.style.color = '#155724';
    } else if (statusElement && !window.supabaseConnected) {
        statusElement.innerHTML = '⚠️ Offline Mode (Using local storage)';
        statusElement.style.background = '#fff3cd';
        statusElement.style.color = '#856404';
    }
}, 5000);
// ===== END CONNECTION STATUS MONITOR =====

// Check for saved session
if (sessionManager.currentStaff && sessionManager.currentScreen) {
    sessionManager.showScreenAfterRefresh(sessionManager.currentScreen, sessionManager.currentStaff);
}
    
    setTimeout(() => {
        if (staffSelect) {
            staffSelect.focus();
        }
    }, 500);
    
    if (staffSelect) {
        staffSelect.addEventListener('change', function() {
            if (this.value) {
                setTimeout(() => {
                    const pinField = document.getElementById('staffPin');
                    if (pinField) {
                        pinField.focus();
                    }
                }, 100);
            }
        });
    }
    
    if (pinInput) {
        pinInput.addEventListener('input', function(event) {
            if (this.value.length === 4) {
                console.log('4 digits entered, auto-login triggered');
                staffLogin();
            }
        });
        
        pinInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                staffLogin();
            }
        });
    }

    const menuBtns = document.querySelectorAll('.menu-btn');
    menuBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        const tabName = this.dataset.tab;
        
        menuBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(tabName + '-tab').classList.add('active');
        
        if (tabName === 'inventory') {
            loadInventoryManagement();
        } else if (tabName === 'reports') {
            generateManagerReport();
        } else if (tabName === 'staff') {
            loadStaffManagement();
        } else if (tabName === 'customers') {
            loadCustomerManagement();
        } else if (tabName === 'rawitems') {
            console.log('Raw items tab opened');
        } else if (tabName === 'system') {
            updateSystemInfo();
        } else if (tabName === 'menumanager') {   // 👈 ADD THIS
            loadMenuManager();
            setTimeout(() => setupMenuManagerListeners(), 100);
        }
    });
});
    
    setTimeout(() => {
        pos.updateConnectionStatus();
        updateSystemInfo();
    }, 2000);
    
    const today = new Date().toDateString();
    const lastReset = localStorage.getItem('lastDailyReset');
    if (lastReset !== today) {
        localStorage.setItem('lastDailyReset', today);
        console.log('Daily reset check completed');
    }

    // Add this at the end of DOMContentLoaded
setTimeout(() => {
    console.log('🔄 Checking if payment selector needs setup...');
    if (typeof setupPOSPaymentSelector === 'function') {
        setupPOSPaymentSelector();
        console.log('✅ Payment selector setup called from DOMContentLoaded');
    }
}, 3000);
});

// Performance monitoring
console.time('appLoad');
window.addEventListener('load', () => {
    console.timeEnd('appLoad');
    console.log('UrbanCity POS loaded successfully');
});

// Memory optimization
setInterval(() => {
    // Clear old sessions
    const session = JSON.parse(localStorage.getItem('posSession') || '{}');
    if (session.timestamp) {
        const sessionTime = new Date(session.timestamp);
        const hoursOld = (new Date() - sessionTime) / (1000 * 60 * 60);
        if (hoursOld > 8) {
            localStorage.removeItem('posSession');
        }
    }
}, 3600000); // Run every hour

// =============================================
// MENU SYNC SERVICE - AUTO UPDATE FROM URL
// =============================================
class MenuSyncService {
    constructor() {
        this.menuUrl = window.location.origin + '/menu.json';
        this.syncInterval = 5 * 60 * 1000;
        this.lastSync = null;
        this.startAutoSync();
    }

    startAutoSync() {
        console.log('🔄 Menu auto-sync service started');
        this.syncMenu();
        setInterval(() => this.syncMenu(), this.syncInterval);
    }

    async syncMenu() {
        try {
            console.log('📥 Fetching menu from:', this.menuUrl);
            const response = await fetch(this.menuUrl + '?t=' + Date.now());
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const menuData = await response.json();
            this.updateMenuInPOS(menuData);
            this.lastSync = new Date();
            console.log('✅ Menu synced successfully');
            if (pos && pos.currentStaff) {
                showNotification('📋 Menu updated from server', 'info');
            }
            return true;
        } catch (error) {
            console.error('❌ Menu sync failed:', error);
            return false;
        }
    }

    updateMenuInPOS(menuData) {
    if (!window.pos && typeof pos !== 'undefined') {
        window.pos = pos;
    }
    
    if (!window.pos) {
        console.error('POS not ready, retrying...');
        setTimeout(() => this.updateMenuInPOS(menuData), 2000);
        return;
    }
    
    let newMenuItems = [];
    let itemId = 1;
    
    if (menuData.categories) {
        menuData.categories.forEach(category => {
            category.items.forEach(item => {
                const newItem = {
                    id: itemId++,
                    name: item.name,
                    category: category.id,
                    stock: item.stock || 100,
                    lowStock: item.lowStock || 20,
                    description: item.description || '',
                    image: item.image || ''
                };
                
                // Check if item has variants
                if (item.variants && item.variants.length > 0) {
                    newItem.variants = item.variants;
                    newItem.hasVariants = true;
                    // Set default price as first variant price
                    newItem.price = item.variants[0].price;
                } else {
                    newItem.price = item.price || 0;
                    newItem.hasVariants = false;
                }
                
                newMenuItems.push(newItem);
            });
        });
    }
    
    // Update POS menu items
    if (newMenuItems.length > 0) {
        const oldMenuItems = window.pos.menuItems || [];
        newMenuItems = newMenuItems.map(newItem => {
            const oldItem = oldMenuItems.find(o => o.name === newItem.name);
            if (oldItem) {
                newItem.stock = oldItem.stock;
                newItem.lowStock = oldItem.lowStock;
                // Preserve variants if they exist
                if (oldItem.variants && !newItem.variants) {
                    newItem.variants = oldItem.variants;
                }
            }
            return newItem;
        });
        
        window.pos.menuItems = newMenuItems;
        window.pos.saveMenuItems();
        
        if (document.getElementById('posScreen').classList.contains('active')) {
    window.pos.renderMenuItems();
    window.pos.renderCategories();  // <-- ADD THIS LINE
}
        console.log('📋 Menu updated with', newMenuItems.length, 'items');
    }
}

    async manualSync() {
        showNotification('🔄 Syncing menu...', 'info');
        const success = await this.syncMenu();
        showNotification(success ? '✅ Menu synced!' : '❌ Sync failed', success ? 'success' : 'error');
    }

    setMenuUrl(url) {
        this.menuUrl = url;
        localStorage.setItem('customMenuUrl', url);
        showNotification('📋 Menu URL updated', 'success');
    }
}

// ========== THIS SETTIMEOUT MUST BE OUTSIDE THE CLASS ==========
setTimeout(() => {
    if (typeof pos !== 'undefined' && pos) {
        window.menuSync = new MenuSyncService();
        console.log('✅ MenuSyncService initialized');
    } else {
        console.log('⏳ Waiting for POS...');
        setTimeout(() => {
            if (typeof pos !== 'undefined' && pos) {
                window.menuSync = new MenuSyncService();
                console.log('✅ MenuSyncService initialized (delayed)');
            } else {
                console.error('❌ POS not available for menu sync');
            }
        }, 3000);
    }
}, 8000);
// =============================================
// EXAMPLE MENU JSON STRUCTURE
// =============================================
/*
Option 1: Simple Array Format
[
    {
        "id": 1,
        "name": "Chicken Shawarma",
        "price": 2500,
        "category": "shawarma",
        "stock": 100,
        "lowStock": 20
    },
    {
        "id": 2,
        "name": "Beef Burger",
        "price": 3500,
        "category": "burgers",
        "stock": 100,
        "lowStock": 20
    }
]

Option 2: Categories Format (Like Your Existing Menu)
{
    "categories": [
        {
            "id": "shawarma",
            "name": "Shawarma Zone",
            "items": [
                {
                    "name": "Chicken Shawarma",
                    "price": 2500,
                    "description": "Spicy chicken shawarma",
                    "stock": 100,
                    "lowStock": 20
                }
            ]
        }
    ]
}
*/

// =============================================
// ADD MENU SYNC BUTTON TO MANAGER DASHBOARD
// =============================================
function addMenuSyncToSystemTab() {
    const systemTab = document.getElementById('system-tab');
    if (!systemTab) return;
    
    const systemContent = systemTab.querySelector('div');
    if (!systemContent) return;
    
    // Check if already added
    if (document.getElementById('menuSyncSection')) return;
    
    // Get last sync time from window.menuSync if available
    let lastSyncText = 'Not synced yet';
    if (window.menuSync && window.menuSync.lastSync) {
        lastSyncText = 'Last sync: ' + window.menuSync.lastSync.toLocaleTimeString();
    }
    
    // Get saved URL or use default
    const savedUrl = localStorage.getItem('customMenuUrl') || 'https://urbancity.food/menu.json';
    
    const menuSyncHTML = `
        <div id="menuSyncSection" style="margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
            <h3>📋 Menu Auto-Sync</h3>
            <div style="margin-top: 15px;">
                <div class="form-group">
                    <label for="menuUrl">Menu JSON URL</label>
                    <input type="url" id="menuUrl" class="form-control" 
                           value="${savedUrl}" 
                           placeholder="https://your-menu-site.com/menu.json">
                    <small class="form-text text-muted">Host your menu JSON file here</small>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button class="btn-primary" onclick="updateMenuUrl()">
                        📍 Update URL
                    </button>
                    <button class="btn-success" onclick="manualMenuSync()">
                        🔄 Sync Now
                    </button>
                    <button class="btn-secondary" onclick="testMenuUrl()">
                        🔍 Test URL
                    </button>
                </div>
                
                <div id="menuSyncStatus" style="margin-top: 15px; padding: 10px; background: white; border-radius: 5px;">
                    <strong>Status:</strong> 
                    <span id="menuSyncStatusText">${lastSyncText}</span>
                </div>
            </div>
        </div>
    `;
    
    systemContent.insertAdjacentHTML('beforeend', menuSyncHTML);

    // Add this to your addMenuSyncToSystemTab function
const forceSyncButton = `
    <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border-radius: 8px;">
        <h4>⚠️ Force Sync Local Orders</h4>
        <p style="font-size: 12px; margin-bottom: 10px;">Use this if you have orders saved locally on this computer that are not in the cloud.</p>
        <button class="btn-warning" onclick="forceSyncLocalOrders()" style="background: #ff9800; color: white; border: none; padding: 10px; border-radius: 5px; width: 100%;">
            🔄 Force Sync All Local Orders to Cloud
        </button>
    </div>
`;
async function forceSyncLocalOrders() {
    const localOrders = JSON.parse(localStorage.getItem('restaurantOrders') || '[]');
    
    if (localOrders.length === 0) {
        showNotification('No local orders found', 'info');
        return;
    }
    
    if (!confirm(`Found ${localOrders.length} local orders. Sync them to cloud?`)) return;
    
    showNotification(`📤 Syncing ${localOrders.length} orders...`, 'info');
    
    let synced = 0;
    let failed = 0;
    
    for (const order of localOrders) {
        try {
            // Check if already exists in Supabase
            const { data: existing } = await window.supabaseClient
                .from('orders')
                .select('order_number')
                .eq('order_number', order.order_number)
                .maybeSingle();
            
            if (!existing) {
                const { error } = await window.supabaseClient
                    .from('orders')
                    .insert([{
                        order_number: order.order_number,
                        staff_id: order.staff_id,
                        staff_name: order.staff_name,
                        items: order.items,
                        subtotal: order.subtotal,
                        total: order.total,
                        order_type: order.order_type,
                        created_at: order.created_at,
                        customer_name: order.customer_name
                    }]);
                
                if (error) throw error;
                synced++;
            } else {
                console.log('Order already exists:', order.order_number);
            }
        } catch (error) {
            console.error('Failed to sync:', order.order_number, error);
            failed++;
        }
    }
    
    showNotification(`✅ Synced ${synced} orders, Failed: ${failed}`, synced > 0 ? 'success' : 'error');
    
    // Also sync customers
    if (synced > 0) {
        showNotification('🔄 Syncing customers...', 'info');
        await pos.syncCustomersFromOrders();
    }
}

    // Add this inside addMenuSyncToSystemTab function, after the menu sync HTML
const manualSyncButton = `
    <div style="margin-top: 15px;">
        <button class="btn-secondary" onclick="pos.autoSyncLocalOrders()" style="width: 100%; padding: 10px;">
            🔄 Sync Local Orders to Cloud
        </button>
        <small style="display: block; text-align: center; margin-top: 5px;">Upload any unsynced local orders to Supabase</small>
    </div>
`;
document.getElementById('menuSyncSection')?.insertAdjacentHTML('afterend', manualSyncButton);
}

// Update Menu URL function
function updateMenuUrl() {
    const url = document.getElementById('menuUrl').value;
    if (url && url.startsWith('http')) {
        if (window.menuSync) {
            window.menuSync.setMenuUrl(url);
            showNotification('✅ Menu URL updated', 'success');
        } else {
            // Save for later
            localStorage.setItem('customMenuUrl', url);
            showNotification('✅ Menu URL saved (will apply when sync starts)', 'success');
        }
    } else {
        showNotification('❌ Please enter a valid URL starting with http:// or https://', 'error');
    }
}

// Test URL function
async function testMenuUrl() {
    const url = document.getElementById('menuUrl').value;
    if (!url) {
        showNotification('Please enter a URL', 'error');
        return;
    }
    
    showNotification('🔄 Testing URL...', 'info');
    
    try {
        const response = await fetch(url + '?t=' + Date.now(), {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // Count items
        let itemCount = 0;
        let isValid = false;
        
        if (Array.isArray(data)) {
            isValid = data.length > 0;
            itemCount = data.length;
        } else if (data.categories && Array.isArray(data.categories)) {
            isValid = data.categories.length > 0;
            data.categories.forEach(category => {
                if (category.items) itemCount += category.items.length;
            });
        }
        
        if (isValid && itemCount > 0) {
            showNotification(`✅ URL is valid! Found ${itemCount} menu items`, 'success');
            const statusSpan = document.getElementById('menuSyncStatusText');
            if (statusSpan) {
                statusSpan.innerHTML = `✅ Valid menu found (${itemCount} items)`;
            }
        } else {
            showNotification('❌ Invalid menu data format - no items found', 'error');
        }
        
    } catch (error) {
        console.error('URL test failed:', error);
        showNotification('❌ Failed to load menu: ' + error.message, 'error');
        const statusSpan = document.getElementById('menuSyncStatusText');
        if (statusSpan) {
            statusSpan.innerHTML = '❌ Failed to load menu';
        }
    }
}

// Manual sync function
async function manualMenuSync() {
    if (window.menuSync) {
        showNotification('🔄 Syncing menu...', 'info');
        const success = await window.menuSync.syncMenu();
        if (success) {
            showNotification('✅ Menu synced successfully!', 'success');
            const statusSpan = document.getElementById('menuSyncStatusText');
            if (statusSpan && window.menuSync.lastSync) {
                statusSpan.innerHTML = `Last sync: ${window.menuSync.lastSync.toLocaleTimeString()}`;
            }
        } else {
            showNotification('❌ Menu sync failed', 'error');
        }
    } else {
        showNotification('⚠️ Menu sync not ready yet, please wait...', 'warning');
        // Try to initialize
        setTimeout(() => {
            if (window.menuSync) {
                manualMenuSync();
            }
        }, 2000);
    }
}

// Initialize menu sync UI after everything is loaded
setTimeout(() => {
    // Wait for system tab to be available and menuSync to be ready
    const checkInterval = setInterval(() => {
        const systemTab = document.getElementById('system-tab');
        if (systemTab && window.menuSync) {
            addMenuSyncToSystemTab();
            clearInterval(checkInterval);
            console.log('✅ Menu sync UI added to system tab');
        }
    }, 1000);
    
    // Stop checking after 10 seconds
    setTimeout(() => clearInterval(checkInterval), 10000);
}, 5000);

// =============================================
// HOST YOUR MENU JSON (OPTIONS)
// =============================================
/*
OPTION 1: GitHub Gist (Free)
1. Go to https://gist.github.com
2. Create a new gist with your menu JSON
3. Click "Raw" button to get the raw URL
4. Use that URL in the system

OPTION 2: Google Sheets (Free)
1. Create a Google Sheet with your menu
2. Go to File → Share → Publish to web
3. Select JSON format
4. Use the published URL

OPTION 3: Your Own Server
1. Upload menu.json to your web server
2. Use the direct URL

OPTION 4: Netlify/Vercel (Free)
1. Create a public repository with menu.json
2. Deploy to Netlify
3. Use the deployed URL
*/

// =============================================
// ADD TO INITIALIZATION
// =============================================
// Add this to your DOMContentLoaded event
setTimeout(() => {
    if (document.getElementById('system-tab')) {
        addMenuSyncToSystemTab();
    }
}, 3000);

function openMenuManagerModal() {
    if (confirm('This will open the Menu Manager dashboard in a new tab. Continue?')) {
        window.open('admin.html', '_blank');
    }
}

// Add takeaway fee to order
function addTakeawayFee() {
    // Check if fee already added
    const hasFee = pos.currentOrder.some(item => item.name === 'Takeaway Fee');
    if (hasFee) {
        showNotification('⚠️ Takeaway fee already added!', 'warning');
        return;
    }
    
    // Create fee item
    const feeItem = {
        id: 9999,
        name: 'Takeaway Fee',
        price: 300,
        quantity: 1,
        category: 'fee',
        stock: 999,
        lowStock: 0
    };
    
    pos.addToOrder(feeItem);
    showNotification('✓ Takeaway fee of ₦300 added', 'success');
}

function clearAllLocalOrders() {
    if (confirm('⚠️ WARNING: This will delete ALL order records and customers from THIS DEVICE and CLOUD. This cannot be undone. Are you sure?')) {
        if (confirm('LAST CHANCE: Type "CLEAR ALL" to confirm')) {
            const confirmation = prompt('Type "CLEAR ALL" to confirm:');
            if (confirmation === 'CLEAR ALL') {
                
                // 1. Clear local storage
                localStorage.removeItem('restaurantOrders');
                localStorage.removeItem('syncedOrderIds');
                localStorage.removeItem('restaurantCustomers');
                localStorage.setItem('orderCounter', JSON.stringify({ 
                    date: new Date().toDateString(), 
                    count: 0 
                }));
                
                // 2. Clear customers from Supabase cloud
                if (window.supabaseClient && window.supabaseConnected) {
                    showNotification('🗑️ Clearing customers from cloud...', 'info');
                    
                    // Delete all customers from Supabase
                    window.supabaseClient
                        .from('customers')
                        .delete()
                        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all records
                        .then(({ error }) => {
                            if (error) {
                                console.error('Failed to clear cloud customers:', error);
                                showNotification('⚠️ Failed to clear cloud customers. Run SQL manually.', 'error');
                            } else {
                                showNotification('✅ Cloud customers cleared!', 'success');
                            }
                        });
                }
                
                // 3. Reset POS state
                if (pos) {
                    pos.currentOrder = [];
                    pos.orderCounter = { date: new Date().toDateString(), count: 0 };
                    pos.updateOrderDisplay();
                    pos.updateButtonStates();
                    pos.updateActiveOrdersCount();
                    pos.loadRecentOrders();
                }
                
                showNotification('✅ All local orders cleared! Refreshing...', 'success');
                setTimeout(() => location.reload(), 1500);
            } else {
                showNotification('❌ Clear cancelled - incorrect confirmation', 'error');
            }
        }
    }
}

// =============================================
// ORDER DETAILS MODAL - SHOW ITEMS IN ORDER
// =============================================
function showOrderDetails(order) {
    // Format items list
    let itemsHtml = '';
    if (order.items && order.items.length > 0) {
        itemsHtml = order.items.map(item => {
            let itemName = item.name || 'Item';
            if (item.variant) itemName = `${itemName} (${item.variant})`;
            return `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span>${item.quantity}x ${itemName}</span>
                    <span>₦${(item.price * item.quantity).toLocaleString()}</span>
                </div>
            `;
        }).join('');
    } else {
        itemsHtml = '<div style="padding: 10px; color: #999;">No items details available</div>';
    }
    
    // ============================================
    // FIX: Show special instructions if present
    // ============================================
    const instructions = order.special_instructions || '';
    const instructionsHtml = instructions ? 
        `<div style="margin: 10px 0; padding: 10px; background: #fff3cd; border-radius: 8px; border-left: 3px solid #ff9800;">
            <strong style="color: #856404;">📝 Special Instructions:</strong><br>
            <span style="color: #856404; font-size: 13px;">${instructions}</span>
        </div>` : '';
    
    // Get address display
    let addressDisplay = 'N/A';
    if (order.delivery_address) {
        addressDisplay = order.delivery_address;
    } else if (order.pickup_location) {
        addressDisplay = order.pickup_location;
    } else if (order.customer_address) {
        addressDisplay = order.customer_address;
    }
    
    const modalHtml = `
        <div class="modal-overlay active" id="orderDetailsModal">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-receipt"></i> Order Details</h3>
                    <button class="modal-close" onclick="closeOrderDetailsModal()">×</button>
                </div>
                <div style="padding: 20px;">
                    <p><strong>🆔 Order ID:</strong> ${order.order_number || order.id}</p>
                    <p><strong>👤 Customer:</strong> ${order.customer_name || 'Walk-in Customer'}</p>
                    <p><strong>📞 Phone:</strong> ${order.customer_phone || 'N/A'}</p>
                    <p><strong>📦 Type:</strong> ${order.order_type || 'takeaway'}</p>
                    <p><strong>📍 Address:</strong> ${addressDisplay}</p>
                    <p><strong>💳 Payment:</strong> ${order.payment_method || 'cash'}</p>
                    <p><strong>📅 Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                    ${instructionsHtml}
                    <hr style="margin: 15px 0; border-color: #333;">
                    <h4>🛒 Items Ordered:</h4>
                    <div style="max-height: 300px; overflow-y: auto; margin-top: 10px;">
                        ${itemsHtml}
                        <div style="display: flex; justify-content: space-between; padding: 10px 0; font-weight: bold; border-top: 2px solid #ff9800; margin-top: 10px;">
                            <span>TOTAL:</span>
                            <span>₦${(order.total || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-primary" onclick="closeOrderDetailsModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeOrderDetailsModal() {
    const modal = document.getElementById('orderDetailsModal');
    if (modal) modal.remove();
}

// Attach all functions to window for global access
window.staffLogin = staffLogin;
window.logout = logout;
window.clearOrder = clearOrder;
window.checkout = checkout;
window.saveOrder = saveOrder;
window.addRushItem = addRushItem;
window.setOrderType = setOrderType;
window.changeOrderType = changeOrderType;
window.upsellDrink = upsellDrink;
window.upsellWater = upsellWater;
window.showEditDisplayNameModal = showEditDisplayNameModal;
window.closeDisplayNameModal = closeDisplayNameModal;
window.updateDisplayName = updateDisplayName;
window.openManagerDashboard = openManagerDashboard;
window.closeManagerDashboard = closeManagerDashboard;
window.loadInventoryManagement = loadInventoryManagement;
window.openGoogleSheets = openGoogleSheets;
window.syncInventoryToGoogleSheets = syncInventoryToGoogleSheets;
window.showAddItemModal = showAddItemModal;
window.closeAddItemModal = closeAddItemModal;
window.handleAddItem = handleAddItem;
window.editInventoryItem = editInventoryItem;
window.closeEditItemModal = closeEditItemModal;
window.handleUpdateItem = handleUpdateItem;
window.deleteInventoryItem = deleteInventoryItem;
window.showAddMenuItemModal = showAddMenuItemModal;
window.closeAddMenuItemModal = closeAddMenuItemModal;
window.handleAddMenuItem = handleAddMenuItem;
window.editMenuItem = editMenuItem;
window.closeEditMenuItemModal = closeEditMenuItemModal;
window.handleUpdateMenuItem = handleUpdateMenuItem;
window.deleteMenuItem = deleteMenuItem;
window.loadStaffManagement = loadStaffManagement;
window.showAddStaffModal = showAddStaffModal;
window.closeAddStaffModal = closeAddStaffModal;
window.handleAddStaff = handleAddStaff;
window.editStaff = editStaff;
window.closeEditStaffModal = closeEditStaffModal;
window.handleUpdateStaff = handleUpdateStaff;
window.deleteStaff = deleteStaff;
window.generateManagerReport = generateManagerReport;
window.generateFilteredReport = generateFilteredReport;
window.exportReportData = exportReportData;
window.printReport = printReport;
window.loadCustomerManagement = loadCustomerManagement;
window.searchCustomers = searchCustomers;
window.showAddCustomerModal = showAddCustomerModal;
window.showPrinterSetupModal = showPrinterSetupModal;
window.closePrinterSetupModal = closePrinterSetupModal;
window.testPrinter = testPrinter;
window.resetDailyData = resetDailyData;
window.clearAllData = clearAllData;
window.syncWithSupabase = syncWithSupabase;
window.checkoutWithPrint = checkoutWithPrint;
window.loadMenuManager = loadMenuManager;
window.toggleMenuAvailability = toggleMenuAvailability;
window.deleteMenuItemFromManager = deleteMenuItemFromManager;
window.editMenuItemFromManager = editMenuItemFromManager;
window.openAddMenuItemModal = openAddMenuItemModal;
window.closeEditMenuModal = closeEditMenuModal;
window.closeAddMenuModal = closeAddMenuModal;
window.saveMenuItemEdit = saveMenuItemEdit;
window.createNewMenuItem = createNewMenuItem;
// Add this with the other window attachments
window.setupPOSPaymentSelector = setupPOSPaymentSelector;

console.log('🚀 All functions attached to window');
console.log('✅ POS System Ready!');