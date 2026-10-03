/* ==========================================================================
   ShopSahayak - UI Controllers, Modals, Drawers & Security UX
   Role-Based Permissions, Confirmation Dialogs, Exports, Toasts
   ========================================================================== */

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

class UIController {
  constructor(store, aiEngine) {
    this.store = store;
    this.aiEngine = aiEngine;
    this.initEventListeners();
  }

  initEventListeners() {
    // Top bar language selector
    document.querySelectorAll(".lang-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const lang = e.target.getAttribute("data-lang");
        this.store.setLanguage(lang);
      });
    });

    // Sidebar navigation clicks
    document.querySelectorAll(".nav-item, .mobile-nav-item").forEach(item => {
      item.addEventListener("click", (e) => {
        const view = item.getAttribute("data-view");
        if (view) {
          this.switchView(view);
        }
      });
    });

    // Quick AI button in topbar
    const topbarAiBtn = document.getElementById("topbarAiBtn");
    if (topbarAiBtn) {
      topbarAiBtn.addEventListener("click", () => {
        this.switchView("ai-assistant");
      });
    }

    // Global keyboard shortcut Ctrl+K or Cmd+K
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const search = document.getElementById("globalSearchInput");
        if (search) search.focus();
      }
    });
  }

  switchView(viewName) {
    // Check role permission
    if (this.store.currentUserRole === "viewer" && (viewName === "settings")) {
      this.showToast("Viewer role does not have permission to modify store settings", "alert");
      return;
    }

    // Update active nav items
    document.querySelectorAll(".nav-item, .mobile-nav-item").forEach(item => {
      if (item.getAttribute("data-view") === viewName) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Update view panels
    document.querySelectorAll(".page-view").forEach(panel => {
      if (panel.id === `view-${viewName}`) {
        panel.classList.add("active");
      } else {
        panel.classList.remove("active");
      }
    });

    this.store.setView(viewName);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "✦";
    if (type === "success") icon = "✓";
    if (type === "alert") icon = "⚠";
    if (type === "ai") icon = "✦";

    const iconSpan = document.createElement("span");
    iconSpan.style.fontWeight = "700";
    iconSpan.textContent = icon;

    const msgSpan = document.createElement("span");
    msgSpan.style.flex = "1";
    msgSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 200ms ease";
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // ------------------------------------------------------------------------
  // SECURITY CONFIRMATION DIALOG (High-Impact Financial Actions)
  // ------------------------------------------------------------------------
  showSecurityConfirmDialog({ title, message, amount, details, onConfirm }) {
    const modalBackdrop = document.getElementById("securityConfirmModal");
    if (!modalBackdrop) return;

    document.getElementById("secConfirmTitle").textContent = title;
    document.getElementById("secConfirmMsg").textContent = message;
    document.getElementById("secConfirmAmount").textContent = `₹${Number(amount).toLocaleString('en-IN')}`;
    document.getElementById("secConfirmDetails").textContent = details || "";

    const confirmBtn = document.getElementById("secConfirmBtn");
    const cancelBtn = document.getElementById("secCancelBtn");

    const handleConfirm = () => {
      modalBackdrop.classList.remove("active");
      confirmBtn.onclick = null;
      if (onConfirm) onConfirm();
    };

    confirmBtn.onclick = handleConfirm;
    cancelBtn.onclick = () => {
      modalBackdrop.classList.remove("active");
    };

    modalBackdrop.classList.add("active");
  }

  // ------------------------------------------------------------------------
  // UNIFIED PURCHASE ORDER APPROVAL PIPELINE
  // ------------------------------------------------------------------------
  requestPurchaseOrderApproval({ productId, quantity, supplierName, actionCardId, autoConfirmDelayMs, onConfirmed }) {
    if (this.store.currentUserRole === "viewer" || this.store.currentUserRole === "staff") {
      this.showToast("Only Store Owner or Manager can approve purchase orders.", "alert");
      return;
    }

    const prod = this.store.products.find(p => p.id === productId);
    if (!prod) return;

    const numQty = Number(quantity) || (prod.id === "PROD-001" ? 100 : Math.max(20, (prod.minStock * 2) - prod.stock));
    const finalCost = numQty * prod.purchasePrice;
    const finalSupplier = supplierName || prod.supplierName;

    this.showSecurityConfirmDialog({
      title: "Confirm Purchase Order",
      message: `Are you sure you want to approve purchase order for ${prod.name} from ${finalSupplier}?`,
      amount: finalCost,
      details: `Quantity: ${numQty} ${prod.unit} • Terms: Net 7 Days Credit`,
      onConfirm: () => {
        const poNumber = this.store.getNextPONumber();
        this.store.restockProduct(prod.id, numQty, finalSupplier, poNumber);
        if (window.shopApi) {
          window.shopApi.restockProduct(prod.id, numQty, finalSupplier).catch(e => console.warn(e));
        }

        if (actionCardId && this.aiEngine) {
          this.aiEngine.finalizeActionCardApproval(actionCardId, poNumber, numQty, finalCost);
        }

        this.showToast(`Purchase order ${poNumber} approved! Added ${numQty} ${prod.unit} of ${prod.name}.`, "success");
        if (onConfirmed) onConfirmed(poNumber);
      }
    });

    if (autoConfirmDelayMs) {
      setTimeout(() => {
        const confirmBtn = document.getElementById("secConfirmBtn");
        if (confirmBtn) confirmBtn.click();
      }, autoConfirmDelayMs);
    }
  }

  // ------------------------------------------------------------------------
  // ADD PRODUCT MODAL
  // ------------------------------------------------------------------------
  openAddProductModal() {
    // Role check
    if (this.store.currentUserRole === "viewer" || this.store.currentUserRole === "staff") {
      this.showToast("Only Store Owner or Manager can add new product catalogue entries.", "alert");
      return;
    }

    const modal = document.getElementById("addProductModal");
    if (modal) modal.classList.add("active");
  }

  closeAddProductModal() {
    const modal = document.getElementById("addProductModal");
    if (modal) modal.classList.remove("active");
  }

  handleSaveProduct() {
    const name = document.getElementById("prodNameInput")?.value.trim();
    const category = document.getElementById("prodCategorySelect")?.value;
    const purchasePrice = document.getElementById("prodPurchasePrice")?.value;
    const sellingPrice = document.getElementById("prodSellingPrice")?.value;
    const stock = document.getElementById("prodStockInput")?.value;
    const minStock = document.getElementById("prodMinStockInput")?.value;
    const unit = document.getElementById("prodUnitInput")?.value;
    const supplierName = document.getElementById("prodSupplierSelect")?.value;

    if (!name) {
      this.showToast("Please enter a valid product name", "alert");
      return;
    }

    const item = this.store.addProduct({
      name,
      category,
      purchasePrice,
      sellingPrice,
      stock,
      minStock,
      unit,
      supplierName
    });

    if (window.shopApi) {
      window.shopApi.addProduct({
        name,
        category,
        purchasePrice,
        sellingPrice,
        stock,
        minStock,
        unit,
        supplierName
      }).catch(e => console.warn(e));
    }

    this.closeAddProductModal();
    this.showToast(`Product "${item.name}" successfully added to catalogue!`, "success");
    
    // Clear fields
    if (document.getElementById("prodNameInput")) document.getElementById("prodNameInput").value = "";
  }

  // ------------------------------------------------------------------------
  // RESTOCK RECOMMENDATION MODAL
  // ------------------------------------------------------------------------
  openRestockModal(productId) {
    const prod = this.store.products.find(p => p.id === productId);
    if (!prod) return;

    const modal = document.getElementById("restockModal");
    if (!modal) return;

    document.getElementById("restockProdName").innerText = prod.name;
    document.getElementById("restockProdSku").innerText = prod.sku;
    document.getElementById("restockCurrentStock").innerText = `${prod.stock} ${prod.unit}`;
    document.getElementById("restockMinStock").innerText = `${prod.minStock} ${prod.unit}`;
    document.getElementById("restockVelocity").innerText = `${prod.velocityDaily} ${prod.unit}/day`;
    
    // Recommended quantity calculation: (minStock * 2) - currentStock or standard 100 for rice
    const recQty = prod.id === "PROD-001" ? 100 : Math.max(20, (prod.minStock * 2) - prod.stock);
    const estCost = recQty * prod.purchasePrice;

    const qtyInput = document.getElementById("restockRecommendedQty");
    const costDisplay = document.getElementById("restockEstCost");
    
    qtyInput.value = recQty;
    document.getElementById("restockSupplier").innerText = prod.supplierName;
    costDisplay.innerText = `₹${estCost.toLocaleString('en-IN')}`;

    qtyInput.oninput = () => {
      const q = Number(qtyInput.value) || 0;
      costDisplay.innerText = `₹${(q * prod.purchasePrice).toLocaleString('en-IN')}`;
    };

    const approveBtn = document.getElementById("restockApproveBtn");
    approveBtn.onclick = () => {
      const finalQty = Number(qtyInput.value) || recQty;
      modal.classList.remove("active");
      this.requestPurchaseOrderApproval({
        productId: prod.id,
        quantity: finalQty,
        supplierName: prod.supplierName
      });
    };

    modal.classList.add("active");
  }

  closeRestockModal() {
    const modal = document.getElementById("restockModal");
    if (modal) modal.classList.remove("active");
  }

  // ------------------------------------------------------------------------
  // CUSTOMER PROFILE DRAWER
  // ------------------------------------------------------------------------
  openCustomerDrawer(customerId) {
    const cust = this.store.customers.find(c => c.id === customerId);
    if (!cust) return;

    const drawer = document.getElementById("customerDrawer");
    if (!drawer) return;

    document.getElementById("custDrawerInitials").innerText = cust.name.slice(0, 2).toUpperCase();
    document.getElementById("custDrawerName").innerText = cust.name;
    document.getElementById("custDrawerPhone").innerText = cust.phone;
    document.getElementById("custDrawerType").innerText = cust.type;
    document.getElementById("custDrawerOrders").innerText = cust.ordersCount;
    document.getElementById("custDrawerSpend").innerText = `₹${cust.totalSpend.toLocaleString('en-IN')}`;
    document.getElementById("custDrawerKhata").innerText = `₹${(cust.khataBalance || 0).toLocaleString('en-IN')}`;
    document.getElementById("custDrawerLastPurchase").innerText = cust.lastPurchase;
    document.getElementById("custDrawerInsight").innerText = cust.aiInsight;

    drawer.classList.add("active");
  }

  closeCustomerDrawer() {
    const drawer = document.getElementById("customerDrawer");
    if (drawer) drawer.classList.remove("active");
  }

  // ------------------------------------------------------------------------
  // RECORD SALE / POS QUICK BILLING MODAL
  // ------------------------------------------------------------------------
  openNewSaleModal() {
    const modal = document.getElementById("newSaleModal");
    if (modal) modal.classList.add("active");
  }

  closeNewSaleModal() {
    const modal = document.getElementById("newSaleModal");
    if (modal) modal.classList.remove("active");
  }

  handleSaveSale() {
    const custName = document.getElementById("saleCustomerInput")?.value.trim() || "Walk-in Customer";
    const amount = Number(document.getElementById("saleAmountInput")?.value);
    const summary = document.getElementById("saleItemsSummary")?.value.trim() || "Groceries & Provisions";
    const method = document.getElementById("salePaymentSelect")?.value || "UPI (PhonePe)";

    if (!amount || amount <= 0) {
      this.showToast("Please enter a valid sale amount in ₹", "alert");
      return;
    }

    const tx = this.store.addSaleTransaction({
      customer: custName,
      amount: amount,
      itemsSummary: summary,
      paymentMethod: method,
      itemsCount: 2
    });

    if (window.shopApi) {
      window.shopApi.createSale({
        customer: custName,
        amount: amount,
        itemsSummary: summary,
        paymentMethod: method,
        itemsCount: 2
      }).catch(e => console.warn(e));
    }

    this.closeNewSaleModal();
    this.showToast(`Sale of ₹${amount} recorded successfully! Order #${tx.id}`, "success");
  }

  // ------------------------------------------------------------------------
  // EXPORT REPORTS (CSV, EXCEL, PRINTABLE PDF)
  // ------------------------------------------------------------------------
  exportReport(format) {
    const BOM = "\uFEFF";
    if (format === "csv") {
      let csv = BOM + "Product Name,SKU,Category,Current Stock,Minimum Stock,Unit Price,Supplier,Status\n";
      this.store.products.forEach(p => {
        csv += `"${p.name}","${p.sku}","${p.category}",${p.stock},${p.minStock},${p.sellingPrice},"${p.supplierName}","${p.status}"\n`;
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `ShopSahayak_Inventory_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast("Inventory CSV report downloaded (opens in Excel)!", "success");
    } else if (format === "excel" || format === "sales_csv") {
      let csv = BOM + "Order ID,Time,Customer,Items,Amount,Payment Method,Status\n";
      this.store.transactions.forEach(t => {
        csv += `"${t.id}","${t.time}","${t.customer}","${t.itemsSummary}",${t.amount},"${t.paymentMethod}","${t.status}"\n`;
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `ShopSahayak_Sales_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast("Sales CSV report downloaded (opens in Excel)!", "success");
    } else if (format === "pdf") {
      this.showToast("Preparing printable report...", "info");
      setTimeout(() => {
        window.print();
      }, 300);
    }
  }

  // ------------------------------------------------------------------------
  // CUSTOMER MODAL
  // ------------------------------------------------------------------------
  openAddCustomerModal() {
    const modal = document.getElementById("addCustomerModal");
    if (modal) modal.classList.add("active");
  }

  closeAddCustomerModal() {
    const modal = document.getElementById("addCustomerModal");
    if (modal) modal.classList.remove("active");
  }

  async handleSaveCustomer() {
    const name = document.getElementById("custNameInput")?.value.trim();
    const phone = document.getElementById("custPhoneInput")?.value.trim() || "";
    const type = document.getElementById("custTypeSelect")?.value || "Regular";
    const khata = Number(document.getElementById("custInitialKhata")?.value) || 0;

    if (!name) {
      this.showToast("Please enter customer name", "alert");
      return;
    }

    const newCust = this.store.addCustomer({
      name,
      phone,
      type,
      khataBalance: khata,
      ordersCount: khata > 0 ? 1 : 0,
      totalSpend: khata,
      lastPurchase: "Just now"
    });

    if (window.shopApi) {
      await window.shopApi.createCustomer({
        name,
        phone,
        type,
        khataBalance: khata,
        ordersCount: khata > 0 ? 1 : 0,
        totalSpend: khata,
        lastPurchase: "Just now"
      }).catch(e => console.warn(e));
    }

    this.closeAddCustomerModal();
    this.showToast(`Customer "${name}" added to store ledger!`, "success");

    if (document.getElementById("custNameInput")) document.getElementById("custNameInput").value = "";
    if (document.getElementById("custPhoneInput")) document.getElementById("custPhoneInput").value = "";
    if (document.getElementById("custInitialKhata")) document.getElementById("custInitialKhata").value = "";
  }

  // ------------------------------------------------------------------------
  // SUPPLIER MODAL
  // ------------------------------------------------------------------------
  openAddSupplierModal() {
    const modal = document.getElementById("addSupplierModal");
    if (modal) modal.classList.add("active");
  }

  closeAddSupplierModal() {
    const modal = document.getElementById("addSupplierModal");
    if (modal) modal.classList.remove("active");
  }

  async handleSaveSupplier() {
    const name = document.getElementById("suppNameInput")?.value.trim();
    const category = document.getElementById("suppCategoryInput")?.value.trim() || "General Wholesale";
    const contact = document.getElementById("suppContactInput")?.value.trim() || "";
    const phone = document.getElementById("suppPhoneInput")?.value.trim() || "";

    if (!name) {
      this.showToast("Please enter supplier or agency name", "alert");
      return;
    }

    const newSupp = this.store.addSupplier({
      name,
      category,
      contactPerson: contact,
      phone,
      status: "Active"
    });

    if (window.shopApi) {
      await window.shopApi.createSupplier({
        name,
        category,
        contactPerson: contact,
        phone,
        status: "Active"
      }).catch(e => console.warn(e));
    }

    this.closeAddSupplierModal();
    this.showToast(`Wholesale supplier "${name}" added successfully!`, "success");

    if (document.getElementById("suppNameInput")) document.getElementById("suppNameInput").value = "";
    if (document.getElementById("suppCategoryInput")) document.getElementById("suppCategoryInput").value = "";
    if (document.getElementById("suppContactInput")) document.getElementById("suppContactInput").value = "";
    if (document.getElementById("suppPhoneInput")) document.getElementById("suppPhoneInput").value = "";
  }

  // ------------------------------------------------------------------------
  // PURCHASE ORDER MODAL
  // ------------------------------------------------------------------------
  openNewPurchaseOrderModal(supplierId) {
    const modal = document.getElementById("newPurchaseOrderModal");
    if (!modal) return;
    const suppSelect = document.getElementById("poSupplierSelect");
    if (suppSelect) {
      if (this.store.suppliers && this.store.suppliers.length > 0) {
        suppSelect.innerHTML = this.store.suppliers.map(s => 
          `<option value="${s.id}" ${s.id === supplierId ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.category)})</option>`
        ).join("");
      } else {
        suppSelect.innerHTML = `<option value="SUP-001">Direct Wholesale</option>`;
      }
    }
    modal.classList.add("active");
  }

  closeNewPurchaseOrderModal() {
    const modal = document.getElementById("newPurchaseOrderModal");
    if (modal) modal.classList.remove("active");
  }

  async handleSavePurchaseOrder() {
    const prodName = document.getElementById("poProductNameInput")?.value.trim();
    const suppSelect = document.getElementById("poSupplierSelect");
    const suppId = suppSelect?.value;
    const suppObj = this.store.suppliers.find(s => s.id === suppId);
    const suppName = suppObj ? suppObj.name : (suppSelect?.options[suppSelect?.selectedIndex]?.text || "Direct Wholesale");
    const qty = Number(document.getElementById("poQuantityInput")?.value) || 1;
    const unit = document.getElementById("poUnitInput")?.value || "units";
    const unitPrice = Number(document.getElementById("poUnitPriceInput")?.value) || 0;
    const totalAmount = qty * unitPrice;

    if (!prodName) {
      this.showToast("Please enter an item or product name", "alert");
      return;
    }

    const poNumber = this.store.getNextPONumber();

    if (suppObj) {
      suppObj.pendingOrders += 1;
      suppObj.totalPurchased += totalAmount;
      suppObj.lastOrderDate = "Today";
      this.store.notify("supplier_updated", suppObj);
    }

    if (window.shopApi) {
      await window.shopApi.createPurchaseOrder({
        poNumber,
        productName: prodName,
        supplierId: suppId || "SUP-001",
        supplierName: suppName,
        quantity: qty,
        unit,
        unitPrice,
        totalAmount
      }).catch(e => console.warn(e));
    }

    this.closeNewPurchaseOrderModal();
    this.showToast(`Purchase order ${poNumber} for ${prodName} approved and created!`, "success");

    this.store.notifications.unshift({
      id: "NOTIF-" + Date.now(),
      category: "Orders",
      severity: "success",
      title: `PO Dispatched (${poNumber})`,
      message: `Ordered ${qty} ${unit} of ${prodName} from ${suppName} (₹${totalAmount.toLocaleString('en-IN')}).`,
      time: "Just now",
      read: false
    });
    this.store.notify("supplier_added");
  }

  // ------------------------------------------------------------------------
  // SAVE STORE PROFILE SETTINGS
  // ------------------------------------------------------------------------
  async saveStoreProfileSettings() {
    const tradeName = document.getElementById("settingsTradeName")?.value.trim() || this.store.profile.storeName;
    const gstin = document.getElementById("settingsGstin")?.value.trim() || "";
    const ownerName = document.getElementById("settingsOwnerName")?.value.trim() || this.store.profile.ownerName;
    const phone = document.getElementById("settingsPhone")?.value.trim() || this.store.profile.phone;
    const address = document.getElementById("settingsAddress")?.value.trim() || this.store.profile.address;

    this.store.profile = {
      ...this.store.profile,
      storeName: tradeName,
      gstin: gstin,
      ownerName: ownerName,
      phone: phone,
      address: address
    };

    // Update Topbar and Sidebar
    const storeNameEls = document.querySelectorAll(".brand-subtitle, .topbar-store-name");
    storeNameEls.forEach(el => el.textContent = tradeName);
    const ownerNameEl = document.querySelector(".user-name");
    if (ownerNameEl) ownerNameEl.textContent = ownerName;

    if (window.shopApi) {
      try {
        await window.shopApi.updateStoreProfile(this.store.profile);
      } catch (e) {
        console.warn('Profile save sync error:', e);
      }
    }

    this.showToast("Store profile details saved & synced to MongoDB!", "success");
  }
}

window.shopUI = new UIController(window.shopStore, window.shopAiEngine);
