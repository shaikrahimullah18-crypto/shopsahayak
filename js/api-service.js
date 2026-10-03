/* ==========================================================================
   ShopSahayak - Backend API Service
   Communicates with Node.js/Express & MongoDB Atlas backend with user isolation
   ========================================================================== */

const API_BASE_URL = window.location.origin.includes('localhost:5000') || window.location.origin.includes('127.0.0.1:5000')
  ? `${window.location.origin}/api`
  : 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.isOnline = false;
  }

  getUserEmail() {
    try {
      const sessionRaw = sessionStorage.getItem('shopsahayak_session');
      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw);
        if (parsed.user && parsed.user.email) return parsed.user.email;
      }
    } catch (e) {}

    const localEmail = localStorage.getItem('shopsahayak_user_email');
    if (localEmail) return localEmail;

    if (window.shopStore && window.shopStore.profile && window.shopStore.profile.email) {
      return window.shopStore.profile.email;
    }

    return '';
  }

  getHeaders(extraHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders
    };
    const email = this.getUserEmail();
    if (email) {
      headers['x-user-email'] = email;
    }
    return headers;
  }

  buildUrl(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin);
    const email = this.getUserEmail();
    if (email && !params.userEmail) {
      params.userEmail = email;
    }
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.append(k, params[k]);
      }
    });
    return url.toString();
  }

  async checkBackendHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      const data = await res.json();
      this.isOnline = data.status === 'ok';
      return this.isOnline;
    } catch (e) {
      this.isOnline = false;
      return false;
    }
  }

  // --- PRODUCTS ---
  async getProducts(params = {}) {
    const res = await fetch(this.buildUrl('/products', params), {
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async addProduct(productData) {
    const payload = {
      ...productData,
      userEmail: productData.userEmail || this.getUserEmail()
    };
    const res = await fetch(`${this.baseUrl}/products`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  async updateProduct(id, productData) {
    const res = await fetch(`${this.baseUrl}/products/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(productData)
    });
    return await res.json();
  }

  async deleteProduct(id) {
    const res = await fetch(this.buildUrl(`/products/${id}`), {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async restockProduct(id, quantity, supplierName) {
    const res = await fetch(`${this.baseUrl}/products/${id}/restock`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        quantity,
        supplierName,
        userEmail: this.getUserEmail()
      })
    });
    return await res.json();
  }

  // --- METRICS ---
  async getMetrics(params = {}) {
    const res = await fetch(this.buildUrl('/store/metrics', params), {
      headers: this.getHeaders()
    });
    return await res.json();
  }

  // --- STORE PROFILE ---
  async getStoreProfile() {
    const res = await fetch(this.buildUrl('/store/profile'), {
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async updateStoreProfile(profileData) {
    const payload = {
      ...profileData,
      email: profileData.email || this.getUserEmail()
    };
    const res = await fetch(this.buildUrl('/store/profile'), {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  // --- CUSTOMERS ---
  async getCustomers(params = {}) {
    const res = await fetch(this.buildUrl('/customers', params), {
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async createCustomer(customerData) {
    const payload = {
      ...customerData,
      userEmail: customerData.userEmail || this.getUserEmail()
    };
    const res = await fetch(`${this.baseUrl}/customers`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  async updateCustomer(id, customerData) {
    const res = await fetch(`${this.baseUrl}/customers/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(customerData)
    });
    return await res.json();
  }

  async deleteCustomer(id) {
    const res = await fetch(this.buildUrl(`/customers/${id}`), {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async updateKhata(customerId, amount, action = 'credit', extra = {}) {
    const res = await fetch(`${this.baseUrl}/customers/${customerId}/khata`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ amount, action, ...extra })
    });
    return await res.json();
  }

  // --- SALES / TRANSACTIONS ---
  async getSales(params = {}) {
    const res = await fetch(this.buildUrl('/sales', params), {
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async createSale(saleData) {
    const payload = {
      ...saleData,
      userEmail: saleData.userEmail || this.getUserEmail()
    };
    const res = await fetch(`${this.baseUrl}/sales`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  async getSalesReport(params = {}) {
    const res = await fetch(this.buildUrl('/sales/report', params), {
      headers: this.getHeaders()
    });
    return await res.json();
  }

  // --- SUPPLIERS ---
  async getSuppliers(params = {}) {
    const res = await fetch(this.buildUrl('/suppliers', params), {
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async createSupplier(supplierData) {
    const payload = {
      ...supplierData,
      userEmail: supplierData.userEmail || this.getUserEmail()
    };
    const res = await fetch(`${this.baseUrl}/suppliers`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  async updateSupplier(id, supplierData) {
    const res = await fetch(`${this.baseUrl}/suppliers/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(supplierData)
    });
    return await res.json();
  }

  async deleteSupplier(id) {
    const res = await fetch(this.buildUrl(`/suppliers/${id}`), {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return await res.json();
  }

  async createPurchaseOrder(poData) {
    const payload = {
      ...poData,
      userEmail: poData.userEmail || this.getUserEmail()
    };
    const res = await fetch(`${this.baseUrl}/suppliers/purchase-orders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return await res.json();
  }

  // --- NOTIFICATIONS ---
  async getNotifications(params = {}) {
    const res = await fetch(this.buildUrl('/notifications', params), {
      headers: this.getHeaders()
    });
    return await res.json();
  }

  // --- AI ASSISTANT ---
  async askAI(query, isVoice = false) {
    const res = await fetch(`${this.baseUrl}/ai/query`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        query,
        isVoice,
        userEmail: this.getUserEmail()
      })
    });
    return await res.json();
  }
}

// Global API service singleton
window.shopApi = new ApiService();
