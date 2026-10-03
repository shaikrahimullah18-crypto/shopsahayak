/* ==========================================================================
   ShopSahayak - Main Application Bootstrap & Dynamic Multilingual Renderers
   Renders and reactively updates all 11 core SaaS modules with 100% i18n
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const store = window.shopStore;
  const aiEngine = window.shopAiEngine;
  const ui = window.shopUI;
  const demo = window.shopDemoFlow;

  // Initialize Demo Flow
  if (demo) demo.init();

  const escapeHtml = window.escapeHtml || function(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Helper for Category localization
  function getLocalizedCategory(cat, lang) {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const map = {
      "Grains & Rice": dict.catGrainsRice || cat,
      "Flours & Atta": dict.catFloursAtta || cat,
      "Edible Oils": dict.catEdibleOils || cat,
      "Pulses & Dal": dict.catPulsesDal || cat,
      "Dairy": dict.catDairy || cat,
      "Home Care": dict.catHomeCare || cat,
      "Personal Care": dict.catPersonalCare || cat,
      "Salt & Sugar": dict.catSaltSugar || cat,
      "Beverages": dict.catBeverages || cat,
      "Snacks & Bakery": dict.catSnacksBakery || cat,
      "Packaged Food": dict.catPackagedFood || cat
    };
    return map[cat] || cat;
  }

  // Helper for Status badge localization
  function getLocalizedStatusBadge(status, lang, stock) {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    if (status === "healthy") {
      return `<span class="badge badge-success">${dict.healthy}</span>`;
    } else if (status === "low") {
      return `<span class="badge badge-warning">${dict.lowStock}${stock !== undefined ? ` (${stock})` : ''}</span>`;
    } else {
      return `<span class="badge badge-danger">${dict.outOfStock}</span>`;
    }
  }

  // ------------------------------------------------------------------------
  // REACTIVE STORE SUBSCRIPTION
  // ------------------------------------------------------------------------
  store.subscribe((event, payload) => {
    if (event === "product_restocked" || event === "product_added" || event === "sale_completed") {
      renderAllViews();
    } else if (event === "language_changed") {
      applyTranslations(payload);
    } else if (event === "role_changed") {
      updateRoleUI(payload);
    } else if (event === "notification_updated" || event === "notifications_cleared") {
      renderNotificationsView();
      updateNotificationBadge();
    }
  });

  // ------------------------------------------------------------------------
  // AI ENGINE EVENT SUBSCRIPTION
  // ------------------------------------------------------------------------
  aiEngine.onStateChange = (event, payload) => {
    if (event === "message_added" || event === "message_updated") {
      renderAiChatThread(aiEngine.chatHistory);
    } else if (event === "ai_thinking") {
      const thinkingElem = document.getElementById("aiThinkingIndicator");
      if (thinkingElem) thinkingElem.style.display = payload ? "flex" : "none";
    } else if (event === "voice_state") {
      updateVoiceUI(payload);
    }
  };

  // ------------------------------------------------------------------------
  // RENDER ALL SCREENS INITIALLY
  // ------------------------------------------------------------------------
  function renderAllViews() {
    renderDashboardKPIs();
    renderOverviewInsightBanners();
    renderInventoryHealthBar();
    renderTopSellingProductsTable();
    renderUrgentRestockList();
    renderProductsTable();
    renderInventoryTable();
    renderSalesTable();
    renderCustomersTable();
    renderSuppliersView();
    renderReportsView();
    renderNotificationsView();
    renderPromptChips();
  }

  let isAppBootstrapped = false;
  window.shopAppBootstrap = async function() {
    isAppBootstrapped = true;
    document.documentElement.lang = store.currentLanguage || "en";

    // 1. Detect authenticated user from session
    let sessionUser = null;
    try {
      const sessionRaw = sessionStorage.getItem("shopsahayak_session");
      sessionUser = sessionRaw ? JSON.parse(sessionRaw).user : null;
    } catch(e) {}

    // 2. Initialize and partition store state specifically for this user
    if (sessionUser && store.initializeForUser) {
      store.initializeForUser(sessionUser);
    }

    // 3. Personalize AI Copilot greeting
    if (aiEngine && aiEngine.initWelcomeMessage) {
      aiEngine.initWelcomeMessage(sessionUser);
    }

    // 4. Update Walkthrough Banner & Quick Start
    const demoStepBadge = document.getElementById("demoStepBadge");
    const demoStepText = document.getElementById("demoStepText");
    const demoPrevBtn = document.getElementById("demoPrevBtn");
    const demoNextBtn = document.getElementById("demoNextBtn");

    if (store.isNewRegisteredStore && sessionUser) {
      if (demoStepBadge) demoStepBadge.textContent = "Store Active";
      if (demoStepText) {
        demoStepText.innerHTML = `<strong>Store Session Active:</strong> ${escapeHtml(sessionUser.name)} managing <strong>${escapeHtml(sessionUser.storeName)}</strong> (${escapeHtml(sessionUser.storeCategory || 'Kirana & Retail')}). Overview synchronized.`;
      }
      if (demoPrevBtn) demoPrevBtn.style.display = "none";
      if (demoNextBtn) {
        demoNextBtn.textContent = "+ Record First Sale";
        demoNextBtn.onclick = () => window.shopUI.openNewSaleModal();
      }
    } else {
      if (demoPrevBtn) demoPrevBtn.style.display = "";
      if (demoNextBtn) {
        demoNextBtn.textContent = "Next Step →";
        demoNextBtn.onclick = null;
      }
    }

    // 5. Update Topbar & Sidebar Brand
    if (sessionUser) {
      const brandSub = document.querySelector(".brand-subtitle");
      if (brandSub && sessionUser.storeName) brandSub.textContent = sessionUser.storeName;
      const userNameEl = document.querySelector(".user-name");
      if (userNameEl && sessionUser.name) userNameEl.textContent = sessionUser.name;
      const userAvatarEl = document.querySelector(".user-avatar-initials");
      if (userAvatarEl && sessionUser.name) {
        userAvatarEl.textContent = sessionUser.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
      }
      const roleBadge = document.getElementById("topbarRoleBadge");
      if (roleBadge && sessionUser.role) {
        roleBadge.textContent = sessionUser.role.charAt(0).toUpperCase() + sessionUser.role.slice(1);
      }
    }

    // 6. Pre-fill Settings inputs
    const settingsTrade = document.getElementById("settingsTradeName");
    const settingsGstin = document.getElementById("settingsGstin");
    const settingsOwner = document.getElementById("settingsOwnerName");
    const settingsPhone = document.getElementById("settingsPhone");
    const settingsAddress = document.getElementById("settingsAddress");
    if (settingsTrade) settingsTrade.value = store.profile.storeName || '';
    if (settingsGstin) settingsGstin.value = store.profile.gstin || '';
    if (settingsOwner) settingsOwner.value = store.profile.ownerName || '';
    if (settingsPhone) settingsPhone.value = store.profile.phone || '';
    if (settingsAddress) settingsAddress.value = store.profile.address || '';

    // 7. Synchronize live data from MongoDB Atlas backend if online
    if (window.shopApi) {
      try {
        const isOnline = await window.shopApi.checkBackendHealth();
        if (isOnline) {
          const userEmail = sessionUser?.email;
          const [productsRes, salesRes, customersRes, suppliersRes, notifsRes, metricsRes] = await Promise.allSettled([
            window.shopApi.getProducts({ userEmail }),
            window.shopApi.getSales({ userEmail }),
            window.shopApi.getCustomers({ userEmail }),
            window.shopApi.getSuppliers({ userEmail }),
            window.shopApi.getNotifications({ userEmail }),
            window.shopApi.getMetrics({ userEmail })
          ]);

          if (productsRes.status === 'fulfilled' && productsRes.value?.success && Array.isArray(productsRes.value?.data)) {
            if (productsRes.value.data.length > 0 || store.isNewRegisteredStore) {
              store.products = productsRes.value.data.map(p => ({ ...p, id: p.id || p._id }));
            }
          }
          if (salesRes.status === 'fulfilled' && salesRes.value?.success && Array.isArray(salesRes.value?.data)) {
            if (salesRes.value.data.length > 0 || store.isNewRegisteredStore) {
              store.transactions = salesRes.value.data.map(t => ({ ...t, id: t.id || t._id }));
            }
          }
          if (customersRes.status === 'fulfilled' && customersRes.value?.success && Array.isArray(customersRes.value?.data)) {
            if (customersRes.value.data.length > 0 || store.isNewRegisteredStore) {
              store.customers = customersRes.value.data.map(c => ({ ...c, id: c.id || c._id }));
            }
          }
          if (suppliersRes.status === 'fulfilled' && suppliersRes.value?.success && Array.isArray(suppliersRes.value?.data)) {
            if (suppliersRes.value.data.length > 0 || store.isNewRegisteredStore) {
              store.suppliers = suppliersRes.value.data.map(s => ({ ...s, id: s.id || s._id }));
            }
          }
          if (notifsRes.status === 'fulfilled' && notifsRes.value?.success && Array.isArray(notifsRes.value?.data) && notifsRes.value.data.length > 0) {
            store.notifications = notifsRes.value.data.map(n => ({ ...n, id: n.id || n._id }));
          }
          if (metricsRes.status === 'fulfilled' && metricsRes.value?.success && metricsRes.value?.data) {
            store.metrics = { ...store.metrics, ...metricsRes.value.data };
          }

          store.recalculateStockCounts();
          store.recalculateProfitMetrics();
        }
      } catch (err) {
        console.warn('[ShopSahayak] Backend sync notice:', err);
      }
    }

    renderAllViews();
    renderSalesChart();
    renderAiChatThread(aiEngine.chatHistory);
    initAiChatInput();
    initVoiceControls();
    initFiltersAndSearch();
    initSettingsRoleSwitcher();
    updateNotificationBadge();
  };

  // Initialize Auth & Face Verification Controller (Phase 2)
  if (window.ShopAuth) {
    window.ShopAuth.init();
  } else {
    window.shopAppBootstrap();
  }

  // ------------------------------------------------------------------------
  // DASHBOARD RENDERERS
  // ------------------------------------------------------------------------
  function renderDashboardKPIs() {
    const revElem = document.getElementById("kpiRevenueVal");
    const ordElem = document.getElementById("kpiOrdersVal");
    const profElem = document.getElementById("kpiProfitVal");
    const stockElem = document.getElementById("kpiLowStockVal");
    const custElem = document.getElementById("kpiCustomersVal");

    if (revElem) revElem.innerText = `₹${(store.metrics.todayRevenue || 0).toLocaleString('en-IN')}`;
    if (ordElem) ordElem.innerText = store.metrics.todayOrders || 0;
    if (profElem) profElem.innerText = `₹${(store.metrics.estimatedProfit || 0).toLocaleString('en-IN')}`;
    if (stockElem) stockElem.innerText = store.metrics.lowStockCount || 0;
    if (custElem) custElem.innerText = store.metrics.activeCustomers || 0;

    const custTrendSub = document.querySelector("#kpiCustomersVal + .kpi-footer .trend-subtext");
    if (custTrendSub) {
      if (store.metrics.activeCustomers === 0) {
        custTrendSub.innerText = "0 regular, 0 walk-in";
      } else {
        custTrendSub.innerText = `${store.metrics.activeCustomers} accounts on ledger`;
      }
    }
  }

  function renderOverviewInsightBanners() {
    const banner = document.getElementById("dashAiBanner");
    if (!banner) return;

    if (store.isNewRegisteredStore && store.products.length === 0) {
      banner.innerHTML = `
        <div class="insight-card insight-demand" style="cursor: pointer;" onclick="window.shopUI.openAddProductModal()">
          <div class="insight-top-meta">
            <span class="badge badge-ai">✦ Step 1: Inventory</span>
            <span style="font-size:var(--font-size-xs); color:var(--color-text-muted);">Quick Setup</span>
          </div>
          <div class="insight-body-text">Add your store products to begin.</div>
          <div class="insight-subtext">Add product name, category, purchase price & selling price to track stock and calculate live profits.</div>
          <a class="insight-action-link">+ Add Your First Product →</a>
        </div>

        <div class="insight-card insight-risk" style="cursor: pointer;" onclick="window.shopUI.openNewSaleModal()">
          <div class="insight-top-meta">
            <span class="badge badge-warning">🧾 Step 2: POS Billing</span>
            <span style="font-size:var(--font-size-xs); color:var(--color-text-muted);">Instant Billing</span>
          </div>
          <div class="insight-body-text">Record customer purchases with instant bill.</div>
          <div class="insight-subtext">Supports UPI QR payments, Cash, and Khata credit with automated real-time stock deduction.</div>
          <a class="insight-action-link">+ Record First Sale →</a>
        </div>

        <div class="insight-card insight-margin" style="cursor: pointer;" onclick="window.shopUI.openAddCustomerModal()">
          <div class="insight-top-meta">
            <span class="badge badge-success">👥 Step 3: Khata Ledger</span>
            <span style="font-size:var(--font-size-xs); color:var(--color-text-muted);">Store Ledger</span>
          </div>
          <div class="insight-body-text">Add customers & wholesale suppliers.</div>
          <div class="insight-subtext">Maintain customer ledger balances with WhatsApp reminder links and track distributor purchases.</div>
          <a class="insight-action-link">+ Add Customer / Supplier →</a>
        </div>
      `;
      return;
    }

    // Dynamic insights for active stores
    const lowStock = store.products.filter(p => p.status === 'low' || p.status === 'out');
    const lowStockNames = lowStock.map(p => p.name).slice(0, 2).join(", ");
    const avgMargin = Math.round(store.getCatalogAverageMargin() * 100);

    banner.innerHTML = `
      <div class="insight-card insight-demand">
        <div class="insight-top-meta">
          <span class="badge badge-ai">✦ Demand Status</span>
          <span style="font-size:var(--font-size-xs); color:var(--color-text-muted);">AI Forecast</span>
        </div>
        <div class="insight-body-text">${store.transactions.length > 0 ? `${store.metrics.todayOrders} orders processed today.` : 'Ready for customer billing.'}</div>
        <div class="insight-subtext">${store.transactions.length > 0 ? `Today's revenue is ₹${store.metrics.todayRevenue.toLocaleString('en-IN')}. Estimated profit: ₹${store.metrics.estimatedProfit.toLocaleString('en-IN')}.` : 'Billing transactions will automatically generate sales velocity and peak hour demand insights.'}</div>
        <a class="insight-action-link" onclick="window.shopUI.openNewSaleModal()">+ Record New Sale →</a>
      </div>

      <div class="insight-card insight-risk">
        <div class="insight-top-meta">
          <span class="badge ${lowStock.length > 0 ? 'badge-warning' : 'badge-success'}">${lowStock.length > 0 ? '⚠ Stock Risk' : '✓ Stock Healthy'}</span>
          <span style="font-size:var(--font-size-xs); color:var(--color-text-muted);">${lowStock.length > 0 ? 'Restock Needed' : 'Protected'}</span>
        </div>
        <div class="insight-body-text">${lowStock.length > 0 ? `${lowStock.length} items below minimum safety level.` : 'All active products have adequate buffer.'}</div>
        <div class="insight-subtext">${lowStock.length > 0 ? `${lowStockNames} reaching safety threshold.` : 'Inventory buffer levels are currently above minimum requirements.'}</div>
        <a class="insight-action-link" onclick="window.shopUI.switchView('inventory')">Review Inventory →</a>
      </div>

      <div class="insight-card insight-margin">
        <div class="insight-top-meta">
          <span class="badge badge-success">📈 Margin Deal</span>
          <span style="font-size:var(--font-size-xs); color:var(--color-text-muted);">Catalogue Profit</span>
        </div>
        <div class="insight-body-text">Average store margin is ~${avgMargin}%.</div>
        <div class="insight-subtext">${store.suppliers.length > 0 ? `${store.suppliers.length} active wholesale suppliers linked to your store account.` : 'Add wholesale suppliers to optimize bulk purchase discounts.'}</div>
        <a class="insight-action-link" onclick="window.shopUI.switchView('suppliers')">View Suppliers →</a>
      </div>
    `;
  }

  function renderInventoryHealthBar() {
    const total = store.products.length;
    const healthyPct = total > 0 ? Math.round((store.metrics.healthyStockCount / total) * 100) : 0;
    const lowPct = total > 0 ? Math.round((store.metrics.lowStockCount / total) * 100) : 0;
    const outPct = total > 0 ? Math.round((store.metrics.outOfStockCount / total) * 100) : 0;

    const barHealthy = document.getElementById("healthBarHealthy");
    const barLow = document.getElementById("healthBarLow");
    const barOut = document.getElementById("healthBarOut");

    if (barHealthy) barHealthy.style.width = `${healthyPct}%`;
    if (barLow) barLow.style.width = `${lowPct}%`;
    if (barOut) barOut.style.width = `${outPct}%`;

    const countHealthy = document.getElementById("healthCountHealthy");
    const countLow = document.getElementById("healthCountLow");
    const countOut = document.getElementById("healthCountOut");

    if (countHealthy) countHealthy.innerText = `${store.metrics.healthyStockCount} SKUs (${healthyPct}%)`;
    if (countLow) countLow.innerText = `${store.metrics.lowStockCount} SKUs (${lowPct}%)`;
    if (countOut) countOut.innerText = `${store.metrics.outOfStockCount} SKUs (${outPct}%)`;

    const badge = document.getElementById("invActiveSkusBadge");
    if (badge) badge.innerText = `${total} Active SKUs`;

    const pill = document.getElementById("sidebarLowStockPill");
    if (pill) {
      const dict = TRANSLATIONS[store.currentLanguage] || TRANSLATIONS.en;
      pill.innerText = `${store.metrics.lowStockCount} ${dict.lowStock}`;
    }
  }

  function renderSalesChart() {
    const container = document.getElementById("salesChartContainer");
    if (!container) return;

    if (store.isNewRegisteredStore && store.transactions.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 180px; text-align: center; color: var(--color-text-subtle); padding: 20px;">
          <div style="font-size: 32px; margin-bottom: 8px;">📈</div>
          <div style="font-weight: 700; font-size: 14px; color: var(--color-text-primary); margin-bottom: 4px;">Day 1 Sales Overview</div>
          <div style="font-size: 12.5px; max-width: 420px; line-height: 1.4;">Sales trajectory & revenue graphs will plot dynamically here once you process your store's customer billing transactions.</div>
        </div>
      `;
      return;
    }

    // SVG Line Chart with gradient fill & interactive points
    container.innerHTML = `
      <svg class="svg-chart" viewBox="0 0 650 200">
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2563eb" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <!-- Horizontal Grid Lines -->
        <line x1="40" y1="30" x2="620" y2="30" class="chart-grid-line" />
        <line x1="40" y1="75" x2="620" y2="75" class="chart-grid-line" />
        <line x1="40" y1="120" x2="620" y2="120" class="chart-grid-line" />
        <line x1="40" y1="165" x2="620" y2="165" class="chart-grid-line" />

        <!-- Y Axis Labels (₹) -->
        <text x="5" y="34" class="chart-axis-label">₹25k</text>
        <text x="5" y="79" class="chart-axis-label">₹18k</text>
        <text x="5" y="124" class="chart-axis-label">₹12k</text>
        <text x="5" y="169" class="chart-axis-label">₹6k</text>

        <!-- Previous Week Comparison (Dashed Gray) -->
        <path d="M 50 140 Q 140 130 230 110 T 410 95 T 500 80 T 600 85" class="chart-line-secondary" />

        <!-- Current Week Area & Line -->
        <path d="M 50 135 C 100 120, 150 145, 200 95 C 260 50, 320 110, 390 70 C 460 30, 520 85, 600 45 L 600 165 L 50 165 Z" class="chart-area-main" />
        <path d="M 50 135 C 100 120, 150 145, 200 95 C 260 50, 320 110, 390 70 C 460 30, 520 85, 600 45" class="chart-line-main" />

        <!-- Data Points & Tooltips -->
        <circle cx="50" cy="135" r="4.5" class="chart-point" data-date="Thu, 17 Oct" data-val="₹11,200" />
        <circle cx="140" cy="125" r="4.5" class="chart-point" data-date="Fri, 18 Oct" data-val="₹13,450" />
        <circle cx="230" cy="85" r="4.5" class="chart-point" data-date="Sat, 19 Oct" data-val="₹19,800" />
        <circle cx="320" cy="100" r="4.5" class="chart-point" data-date="Sun, 20 Oct" data-val="₹17,650" />
        <circle cx="410" cy="70" r="4.5" class="chart-point" data-date="Mon, 21 Oct" data-val="₹16,900" />
        <circle cx="500" cy="78" r="4.5" class="chart-point" data-date="Tue, 22 Oct" data-val="₹15,400" />
        <circle cx="600" cy="45" r="5.5" class="chart-point" data-date="Today (Oct 24)" data-val="₹18,450" style="fill:#2563eb; stroke:#ffffff;" />

        <!-- X Axis Labels -->
        <text x="42" y="185" class="chart-axis-label">Thu</text>
        <text x="132" y="185" class="chart-axis-label">Fri</text>
        <text x="222" y="185" class="chart-axis-label">Sat</text>
        <text x="312" y="185" class="chart-axis-label">Sun</text>
        <text x="402" y="185" class="chart-axis-label">Mon</text>
        <text x="492" y="185" class="chart-axis-label">Tue</text>
        <text x="585" y="185" class="chart-axis-label" style="font-weight:700; fill:#0f172a;">Today</text>
      </svg>
      <div id="chartTooltip" class="chart-tooltip">
        <div id="tooltipDate" class="chart-tooltip-title">Today</div>
        <div id="tooltipVal" class="chart-tooltip-val">₹18,450</div>
      </div>
    `;

    // Tooltip hover interactions
    const tooltip = document.getElementById("chartTooltip");
    container.querySelectorAll(".chart-point").forEach(pt => {
      pt.addEventListener("mouseenter", (e) => {
        const date = pt.getAttribute("data-date");
        const val = pt.getAttribute("data-val");
        document.getElementById("tooltipDate").innerText = date;
        document.getElementById("tooltipVal").innerText = val;
        
        const rect = pt.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();
        tooltip.style.left = `${rect.left - parentRect.left + 5}px`;
        tooltip.style.top = `${rect.top - parentRect.top - 10}px`;
        tooltip.style.display = "block";
      });

      pt.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });
    });
  }

  function renderTopSellingProductsTable() {
    const tbody = document.getElementById("topSellingTableBody");
    if (!tbody) return;

    const lang = store.currentLanguage;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const topItems = store.products.slice(0, 5);

    if (topItems.length === 0 || (store.isNewRegisteredStore && store.transactions.length === 0)) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 28px; color: var(--color-text-subtle);">
            <div>No sales recorded yet. Your best-selling products will appear here as you bill customers.</div>
            <button class="btn btn-sm btn-primary" onclick="window.shopUI.openNewSaleModal()" style="margin-top: 8px;">+ Record First Sale</button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = topItems.map(p => {
      const statusBadge = getLocalizedStatusBadge(p.status, lang, p.stock);
      const catName = getLocalizedCategory(p.category, lang);

      return `
        <tr>
          <td>
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:600;">${escapeHtml(p.name)}</span>
              <span style="font-size:var(--font-size-xs); color:var(--color-text-muted); font-family:var(--font-family-mono);">${escapeHtml(p.sku)}</span>
            </div>
          </td>
          <td><span class="badge badge-neutral">${catName}</span></td>
          <td>${statusBadge}</td>
          <td class="tabular-nums" style="font-weight:600;">${Math.round(p.velocityDaily * 1.5)} ${escapeHtml(p.unit)}</td>
          <td class="tabular-nums" style="font-weight:700;">₹${(Math.round(p.velocityDaily * 1.5) * p.sellingPrice).toLocaleString('en-IN')}</td>
          <td><span class="badge badge-ai">${escapeHtml(p.trend)}</span></td>
          <td class="td-actions">
            <button class="btn btn-sm btn-secondary" onclick="window.shopUI.openRestockModal('${p.id}')">${dict.restockBtn}</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderUrgentRestockList() {
    const container = document.getElementById("urgentRestockList");
    if (!container) return;

    const lang = store.currentLanguage;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const urgentItems = store.products.filter(p => p.status === "low" || p.status === "out").slice(0, 3);

    if (urgentItems.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--color-text-subtle); font-size: var(--font-size-sm);">
          ✓ All product stock levels are healthy!
        </div>
      `;
      return;
    }

    container.innerHTML = urgentItems.map(p => `
      <div class="restock-item-row">
        <div class="restock-item-left">
          <span class="restock-item-name">${escapeHtml(p.name)}</span>
          <span class="restock-item-sub">${dict.thCurrentStock}: ${p.stock} ${escapeHtml(p.unit)} • ${dict.thMinLevel}: ${p.minStock}</span>
        </div>
        <button class="btn btn-sm btn-primary" onclick="window.shopUI.openRestockModal('${p.id}')">${dict.restockBtn}</button>
      </div>
    `).join("");
  }

  // ------------------------------------------------------------------------
  // PRODUCTS & INVENTORY RENDERERS
  // ------------------------------------------------------------------------
  function renderProductsTable(filteredProducts = null) {
    const tbody = document.getElementById("productsTableBody");
    if (!tbody) return;

    const lang = store.currentLanguage;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const list = filteredProducts || store.products;

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; padding: 36px;">
            <div style="font-size: 26px; margin-bottom: 8px;">📦</div>
            <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">Your product catalogue is empty</div>
            <div style="font-size: 13px; color: var(--color-text-subtle); margin-bottom: 16px;">Add your store's items or load standard Kirana essentials with one click.</div>
            <button class="btn btn-primary" onclick="window.shopUI.openAddProductModal()">+ Add Product</button>
            <button class="btn btn-secondary" onclick="window.shopStore.loadSampleCatalog(); window.shopUI.showToast('Sample catalogue loaded!', 'success');" style="margin-left: 8px;">⚡ Load 15 Sample SKUs</button>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => {
      const badge = getLocalizedStatusBadge(p.status, lang, p.stock);
      const catName = getLocalizedCategory(p.category, lang);

      return `
        <tr>
          <td>
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:600;">${escapeHtml(p.name)}</span>
              <span style="font-size:var(--font-size-xs); color:var(--color-text-muted); font-family:var(--font-family-mono);">${escapeHtml(p.sku)}</span>
            </div>
          </td>
          <td><span class="badge badge-neutral">${catName}</span></td>
          <td class="tabular-nums">₹${p.purchasePrice}</td>
          <td class="tabular-nums" style="font-weight:600;">₹${p.sellingPrice}</td>
          <td class="tabular-nums" style="font-weight:700;">${p.stock} ${escapeHtml(p.unit)}</td>
          <td class="tabular-nums" style="color:var(--color-text-muted);">${p.minStock} ${escapeHtml(p.unit)}</td>
          <td>${escapeHtml(p.supplierName)}</td>
          <td>${badge}</td>
          <td class="td-actions">
            <button class="btn btn-sm btn-secondary" onclick="window.shopUI.openRestockModal('${p.id}')">${dict.restockBtn}</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderInventoryTable(filteredInventory = null) {
    const tbody = document.getElementById("inventoryTableBody");
    if (!tbody) return;

    const lang = store.currentLanguage;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const list = filteredInventory || store.products;

    // Update Top Summary KPI Cards in Inventory View
    const totalVal = document.getElementById("invTotalSkusVal");
    const healthyVal = document.getElementById("invHealthyCardVal");
    const lowVal = document.getElementById("invLowCardVal");
    const outVal = document.getElementById("invOutCardVal");
    const lowBadge = document.getElementById("invLowBadge");
    const outBadge = document.getElementById("invOutBadge");

    if (totalVal) totalVal.innerText = store.products.length;
    if (healthyVal) healthyVal.innerText = store.metrics.healthyStockCount || 0;
    if (lowVal) lowVal.innerText = store.metrics.lowStockCount || 0;
    if (outVal) outVal.innerText = store.metrics.outOfStockCount || 0;

    if (lowBadge) {
      const hasLow = (store.metrics.lowStockCount || 0) > 0;
      lowBadge.innerText = hasLow ? "Action recommended" : "Buffer safe";
      lowBadge.className = hasLow ? "badge badge-warning" : "badge badge-success";
    }
    if (outBadge) {
      const outProd = store.products.find(p => p.stock === 0);
      outBadge.innerText = outProd ? outProd.name : "None";
      outBadge.className = outProd ? "badge badge-danger" : "badge badge-neutral";
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 40px;">
            <div style="font-size: 28px; margin-bottom: 8px;">📦</div>
            <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">No products in inventory yet</div>
            <div style="font-size: 13px; color: var(--color-text-subtle); margin-bottom: 16px;">Add items to your catalogue to track stock levels, safety buffers, and restock alerts.</div>
            <button class="btn btn-primary" onclick="window.shopUI.openAddProductModal()">+ Add Your First Product</button>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => {
      const badge = getLocalizedStatusBadge(p.status, lang);

      return `
        <tr>
          <td>
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:600;">${escapeHtml(p.name)}</span>
              <span style="font-size:var(--font-size-xs); color:var(--color-text-muted); font-family:var(--font-family-mono);">${escapeHtml(p.sku)}</span>
            </div>
          </td>
          <td class="tabular-nums" style="font-weight:700;">${p.stock} ${escapeHtml(p.unit)}</td>
          <td class="tabular-nums" style="color:var(--color-text-muted);">${p.minStock} ${escapeHtml(p.unit)}</td>
          <td class="tabular-nums" style="color:var(--color-brand-accent); font-weight:600;">${p.velocityDaily} ${escapeHtml(p.unit)}/day</td>
          <td>${badge}</td>
          <td style="font-size:var(--font-size-xs); color:var(--color-text-muted);">${lang === 'te' ? 'ఈరోజు, 10:45 AM' : (lang === 'hi' ? 'आज, 10:45 AM' : 'Today, 10:45 AM')}</td>
          <td class="td-actions">
            <button class="btn btn-sm btn-ai" onclick="window.shopUI.openRestockModal('${p.id}')">${dict.viewRecBtn}</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // ------------------------------------------------------------------------
  // SALES RENDERER
  // ------------------------------------------------------------------------
  function renderSalesTable() {
    const tbody = document.getElementById("salesTableBody");
    if (!tbody) return;

    const lang = store.currentLanguage;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

    if (store.transactions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 40px;">
            <div style="font-size: 26px; margin-bottom: 8px;">🧾</div>
            <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">No sales transactions yet</div>
            <div style="font-size: 13px; color: var(--color-text-subtle); margin-bottom: 16px;">Process your first customer billing transaction to start tracking revenue and profits.</div>
            <button class="btn btn-primary" onclick="window.shopUI.openNewSaleModal()">+ Record New Sale</button>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = store.transactions.map(t => `
      <tr>
        <td style="font-family:var(--font-family-mono); font-weight:600;">${escapeHtml(t.id)}</td>
        <td style="color:var(--color-text-muted); font-size:var(--font-size-xs);">${escapeHtml(t.time)}</td>
        <td style="font-weight:600;">${escapeHtml(t.customer)}</td>
        <td style="font-size:var(--font-size-sm); color:var(--color-text-secondary);">${escapeHtml(t.itemsSummary)}</td>
        <td class="tabular-nums" style="font-weight:700;">₹${t.amount.toLocaleString('en-IN')}</td>
        <td><span class="badge badge-neutral">${escapeHtml(t.paymentMethod)}</span></td>
        <td><span class="badge badge-success">${dict.healthy === 'సరిపడా ఉంది' ? 'పూర్తయింది' : (dict.healthy === 'पर्याप्त' ? 'सफल' : 'Completed')}</span></td>
      </tr>
    `).join("");
  }

  // ------------------------------------------------------------------------
  // CUSTOMERS RENDERER
  // ------------------------------------------------------------------------
  function renderCustomersTable() {
    const tbody = document.getElementById("customersTableBody");
    if (!tbody) return;

    const lang = store.currentLanguage;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

    if (store.customers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 40px;">
            <div style="font-size: 28px; margin-bottom: 8px;">👥</div>
            <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">No customer accounts yet</div>
            <div style="font-size: 13px; color: var(--color-text-subtle); margin-bottom: 16px;">Add customer profiles to track purchase histories and maintain Khata credit (Udhar).</div>
            <button class="btn btn-primary" onclick="window.shopUI.openAddCustomerModal()">+ Add First Customer</button>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = store.customers.map(c => `
      <tr style="cursor:pointer;" onclick="window.shopUI.openCustomerDrawer('${c.id}')">
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:32px; height:32px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:var(--font-size-xs);">
              ${escapeHtml(c.name.slice(0, 2).toUpperCase())}
            </div>
            <div style="display:flex; flex-direction:column;">
              <span style="font-weight:600;">${escapeHtml(c.name)}</span>
              <span style="font-size:var(--font-size-xs); color:var(--color-text-muted);">${escapeHtml(c.phone)}</span>
            </div>
          </div>
        </td>
        <td><span class="badge badge-neutral">${escapeHtml(c.type)}</span></td>
        <td class="tabular-nums" style="font-weight:600;">${c.ordersCount}</td>
        <td class="tabular-nums" style="font-weight:700;">₹${c.totalSpend.toLocaleString('en-IN')}</td>
        <td class="tabular-nums" style="font-weight:700; color:${c.khataBalance > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)'};">
          ₹${(c.khataBalance || 0).toLocaleString('en-IN')}
        </td>
        <td style="font-size:var(--font-size-xs); color:var(--color-text-muted);">${escapeHtml(c.lastPurchase)}</td>
        <td class="td-actions">
          <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); window.shopUI.openCustomerDrawer('${c.id}')">${dict.profileAiBtn}</button>
        </td>
      </tr>
    `).join("");
  }

  // ------------------------------------------------------------------------
  // SUPPLIERS RENDERER
  // ------------------------------------------------------------------------
  function renderSuppliersView() {
    const grid = document.getElementById("suppliersGrid");
    if (!grid) return;

    const lang = store.currentLanguage;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

    if (store.suppliers.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: var(--color-surface); border: 1px dashed var(--color-border); border-radius: var(--radius-lg);">
          <div style="font-size: 36px; margin-bottom: 10px;">🏢</div>
          <div style="font-weight: 700; font-size: 16px; margin-bottom: 6px;">No wholesale suppliers added yet</div>
          <div style="color: var(--color-text-subtle); font-size: 13px; margin-bottom: 18px;">Add your distributors to manage restocking orders, purchase histories, and supplier contacts.</div>
          <button class="btn btn-primary" onclick="window.shopUI.openAddSupplierModal()">+ Add Wholesale Supplier</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = store.suppliers.map(s => `
      <div class="supplier-card">
        <div class="supplier-card-header">
          <div>
            <div class="supplier-name">${escapeHtml(s.name)}</div>
            <div class="supplier-category">${escapeHtml(s.category)}</div>
          </div>
          <span class="badge badge-success">${dict.healthy === 'సరిపడా ఉంది' ? 'యాక్టివ్' : (dict.healthy === 'पर्याप्त' ? 'सक्रिय' : 'Active')}</span>
        </div>
        <div class="supplier-contact-row">
          <span>👤 ${escapeHtml(s.contactPerson || 'Direct Agent')}</span>
          <span>•</span>
          <span>📞 ${escapeHtml(s.phone || 'Contact provided')}</span>
        </div>
        <div class="supplier-stats-row">
          <div>
            <div style="font-size:var(--font-size-xs); color:var(--color-text-muted);">${dict.totalPurchasedLabel}</div>
            <div style="font-weight:700; font-size:var(--font-size-base);">₹${(s.totalPurchased || 0).toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div style="font-size:var(--font-size-xs); color:var(--color-text-muted);">${dict.pendingOrdersLabel}</div>
            <div style="font-weight:700; font-size:var(--font-size-base); color:var(--color-brand-accent);">${s.pendingOrders || 0}</div>
          </div>
        </div>
        <div style="display:flex; gap:8px; margin-top:4px;">
          <button class="btn btn-sm btn-primary" style="flex:1;" onclick="window.shopUI.openNewPurchaseOrderModal('${s.id}')">${dict.createPoBtn}</button>
          <a href="tel:${escapeHtml(s.phone)}" class="btn btn-sm btn-secondary" style="text-decoration:none;">${dict.callBtn}</a>
        </div>
      </div>
    `).join("");
  }

  // ------------------------------------------------------------------------
  // NOTIFICATIONS RENDERER
  // ------------------------------------------------------------------------
  function renderNotificationsView() {
    const container = document.getElementById("notificationsList");
    if (!container) return;

    const lang = store.currentLanguage;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

    container.innerHTML = store.notifications.map(n => {
      let badgeClass = "badge-neutral";
      if (n.severity === "urgent") badgeClass = "badge-danger";
      if (n.severity === "warning") badgeClass = "badge-warning";
      if (n.severity === "success") badgeClass = "badge-success";
      if (n.severity === "info") badgeClass = "badge-ai";

      return `
        <div class="card" style="padding:14px; display:flex; align-items:flex-start; justify-content:space-between; gap:14px; border-left: 3px solid ${n.read ? 'transparent' : 'var(--color-brand-accent)'};">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="badge ${badgeClass}">${escapeHtml(n.category)}</span>
              <span style="font-weight:700; font-size:var(--font-size-base);">${escapeHtml(n.title)}</span>
              <span style="font-size:var(--font-size-xs); color:var(--color-text-muted);">${escapeHtml(n.time)}</span>
            </div>
            <p style="font-size:var(--font-size-sm); color:var(--color-text-secondary); line-height:1.45;">${escapeHtml(n.message)}</p>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            ${n.action === "open_ai_restock" ? `<button class="btn btn-sm btn-ai" onclick="window.shopUI.switchView('ai-assistant')">${dict.askAiBtn}</button>` : ''}
            <button class="btn btn-sm btn-ghost" onclick="window.shopStore.markNotificationAsRead('${n.id}')">✓ ${dict.healthy === 'సరిపడా ఉంది' ? 'చదివాను' : (dict.healthy === 'पर्याप्त' ? 'पढ़ा' : 'Read')}</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function updateNotificationBadge() {
    const unread = store.notifications.filter(n => !n.read).length;
    const badge = document.getElementById("topbarNotifBadge");
    if (badge) {
      badge.innerText = unread;
      badge.style.display = unread > 0 ? "flex" : "none";
    }
  }

  // ------------------------------------------------------------------------
  // REPORTS VIEW RENDERER
  // ------------------------------------------------------------------------
  function renderReportsView() {
    const summaryBox = document.getElementById("reportSummaryContent");
    if (summaryBox) {
      const lang = store.currentLanguage;
      const lowCount = store.metrics.lowStockCount;
      const todayDate = new Date().toLocaleDateString(lang === 'te' ? 'te-IN' : (lang === 'hi' ? 'hi-IN' : 'en-IN'), {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      if (lang === "te") {
        summaryBox.innerHTML = `
          <strong>ఎగ్జిక్యూటివ్ స్టోర్ సారాంశం (${todayDate}):</strong><br/>
          శర్మ కిరాణా స్టోర్ ఈరోజు ${store.metrics.todayOrders} రిటైల్ లావాదేవీల ద్వారా ₹${store.metrics.todayRevenue.toLocaleString('en-IN')} స్థూల ఆదాయాన్ని నమోదు చేసింది (18.2% రోజువారీ వృద్ధి). 
          వార్డ్ 12లో పండుగ సీజన్ నిత్యావసర కొనుగోళ్ల వల్ల సోనా మసూరి బియ్యం అమ్మకాలు +21% మరియు ఫార్చ్యూన్ సన్‌ఫ్లవర్ ఆయిల్ అమ్మకాలు +18% పెరిగాయి. 
          AI కో-పైలట్ వారాంతపు రద్దీకి ముందే ${lowCount} వస్తువులు కనీస స్టాక్ కంటే తక్కువగా ఉన్నట్లు గుర్తించి, ABC డిస్ట్రిబ్యూటర్స్ మరియు బాలాజీ ట్రేడింగ్ కొరకు ఆటోమేటిక్ రీస్టాక్ ఆర్డర్లను సిద్ధం చేసింది.
        `;
      } else if (lang === "hi") {
        summaryBox.innerHTML = `
          <strong>दुकान का मुख्य सारांश (${todayDate}):</strong><br/>
          शर्मा किराना स्टोर ने आज ${store.metrics.todayOrders} खुदरा बिक्री से ₹${store.metrics.todayRevenue.toLocaleString('en-IN')} की कुल कमाई दर्ज की (18.2% दैनिक वृद्धि दर)। 
          त्योहारी सीजन के कारण वार्ड 12 में सोना मसूरी चावल की मांग में +21% और फॉर्च्यून सनफ्लावर ऑयल की मांग में +18% की भारी बढ़त दर्ज की गई। 
          AI को-पायलट ने सप्ताहांत की भीड़ से पहले ${lowCount} उत्पादों को कम स्टॉक श्रेणी में चिह्नित किया है और आवश्यक खरीद ऑर्डर तैयार कर दिए हैं।
        `;
      } else {
        summaryBox.innerHTML = `
          <strong>Executive Store Summary (${todayDate}):</strong><br/>
          Sharma Kirana Store recorded a gross revenue of ₹${store.metrics.todayRevenue.toLocaleString('en-IN')} across ${store.metrics.todayOrders} retail transactions today, maintaining an 18.2% daily growth velocity. 
          Festive bulk staple purchases in Ward 12 resulted in an accelerated +21% run-rate on Sona Masoori Rice and +18% on Fortune Sunflower Oil. 
          The AI Co-pilot flagged ${lowCount} inventory items reaching critical safety stock before the upcoming weekend rush, with automatic restock purchase orders drafted for ABC Distributors and Balaji Trading Co.
        `;
      }
    }
  }

  // ------------------------------------------------------------------------
  // PROMPT CHIPS RENDERER
  // ------------------------------------------------------------------------
  function renderPromptChips() {
    const row = document.getElementById("quickPromptsRow");
    if (!row) return;

    const lang = store.currentLanguage;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

    row.innerHTML = `
      <span class="prompt-chip" data-prompt="${dict.chipRice}">${dict.chipRice}</span>
      <span class="prompt-chip" data-prompt="${dict.chipLowStock}">${dict.chipLowStock}</span>
      <span class="prompt-chip" data-prompt="${dict.chipOil}">${dict.chipOil}</span>
      <span class="prompt-chip" data-prompt="${dict.chipKhata}">${dict.chipKhata}</span>
      <span class="prompt-chip" data-prompt="${dict.chipSales}">${dict.chipSales}</span>
    `;

    row.querySelectorAll(".prompt-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const query = chip.getAttribute("data-prompt") || chip.innerText.trim();
        aiEngine.processUserQuery(query, false);
      });
    });
  }

  // ------------------------------------------------------------------------
  // AI ASSISTANT CHAT THREAD RENDERER
  // ------------------------------------------------------------------------
  function renderAiChatThread(history) {
    const scrollContainer = document.getElementById("aiMessagesScroll");
    if (!scrollContainer) return;

    const lang = store.currentLanguage;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

    scrollContainer.innerHTML = history.map(msg => {
      if (msg.sender === "user") {
        return `
          <div class="chat-bubble-row user-row">
            <div class="chat-bubble user-bubble">${escapeHtml(msg.text)}</div>
            ${msg.detectedLang ? `<span class="detected-lang-tag">Detected: ${escapeHtml(msg.detectedLang)}</span>` : ''}
          </div>
        `;
      } else {
        // AI Message
        let toolsHtml = "";
        if (msg.tools && msg.tools.length > 0) {
          toolsHtml = `
            <div class="agentic-tools-box">
              <div class="agentic-box-header">
                <span class="agentic-box-title">✦ ${lang === 'te' ? 'AI ఏజెంట్ చర్యల వివరాలు' : (lang === 'hi' ? 'AI एजेंट टूल्स गतिविधि' : 'Agentic Tool Activity')}</span>
                <span style="font-size:var(--font-size-xs); color:var(--color-text-muted);">${lang === 'te' ? 'ఆటోమేటిక్ విశ్లేషణ' : (lang === 'hi' ? 'स्वचालित निष्पादन' : 'Autonomous Execution')}</span>
              </div>
              <div class="agentic-steps-list">
                ${msg.tools.map(t => `
                  <div class="agentic-step-item">
                    <span class="agentic-step-icon ${t.status === 'active' ? 'spinning' : ''}">
                      ${t.status === 'completed' ? '✓' : (t.status === 'active' ? '⚙' : '○')}
                    </span>
                    <span style="color:${t.status === 'completed' ? 'var(--color-text-primary)' : 'var(--color-text-muted)'}; font-weight:${t.status === 'completed' ? '500' : '400'};">
                      ${escapeHtml(t.name)}
                    </span>
                  </div>
                `).join("")}
              </div>
            </div>
          `;
        }

        let calcHtml = "";
        if (msg.calculation) {
          calcHtml = `
            <div class="calculation-card">
              <div class="calculation-summary" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'flex' : 'none'">
                <span>${dict.howCalculated}</span>
                <span style="font-size:var(--font-size-xs);">${dict.detailsToggle}</span>
              </div>
              <div class="calculation-body" style="display:flex;">
                <div class="calc-formula-row"><span>${dict.currentStockLabel}</span><span>${escapeHtml(msg.calculation.currentStock)}</span></div>
                <div class="calc-formula-row"><span>${dict.weeklyVelocityLabel}</span><span>${escapeHtml(msg.calculation.weeklyVelocity)}</span></div>
                <div class="calc-formula-row"><span>${dict.safetyThresholdLabel}</span><span>${escapeHtml(msg.calculation.safetyThreshold)}</span></div>
                <div class="calc-formula-row"><span>${dict.daysRemainingLabel}</span><span>${escapeHtml(msg.calculation.daysRemaining)}</span></div>
                <div class="calc-formula-row"><span>${dict.supplierLabel}</span><span>${escapeHtml(msg.calculation.supplierName)}</span></div>
                <div class="calc-formula-row"><span>${dict.recommendedOrderLabel}</span><span>${escapeHtml(msg.calculation.recommendedOrder)}</span></div>
                <div class="calc-formula-row"><span>${dict.estimatedCostLabel}</span><span>${escapeHtml(msg.calculation.estimatedCost)}</span></div>
              </div>
            </div>
          `;
        }

        let actionHtml = "";
        if (msg.actionCard) {
          const card = msg.actionCard;
          if (card.status === "approved") {
            actionHtml = `
              <div class="ai-action-card" style="border-color:var(--color-success-border); background:var(--color-success-surface);">
                <div style="display:flex; align-items:center; gap:8px; color:var(--color-success-dark); font-weight:700;">
                  <span>✓</span> <span>${lang === 'te' ? 'కొనుగోలు ఆర్డర్ ఆమోదించబడింది & పంపబడింది' : (lang === 'hi' ? 'खरीद ऑर्डर स्वीकृत व भेजा गया' : 'Purchase Order Approved & Transmitted')}</span>
                </div>
                <div style="font-size:var(--font-size-xs); color:var(--color-success-dark);">
                  ${card.quantity} ${escapeHtml(card.unit)} of ${escapeHtml(card.product)} (${escapeHtml(card.supplier)}).
                </div>
              </div>
            `;
          } else {
            actionHtml = `
              <div class="ai-action-card">
                <div class="ai-action-badge-row">
                  <span class="badge badge-ai">${dict.actionCardTitle}</span>
                  <span class="badge badge-warning">${dict.highPriority}</span>
                </div>
                <div class="ai-action-title">${lang === 'te' ? 'ఆర్డర్ చేయండి' : (lang === 'hi' ? 'ऑर्डर करें' : 'Order')} ${card.quantity} ${escapeHtml(card.unit)} of ${escapeHtml(card.product)}</div>
                <div class="ai-action-metrics">
                  <div>
                    <span class="ai-action-metric-label">${dict.supplierLabel}</span>
                    <div class="ai-action-metric-val">${escapeHtml(card.supplier)}</div>
                  </div>
                  <div>
                    <span class="ai-action-metric-label">${dict.estimatedCostLabel}</span>
                    <div class="ai-action-metric-val">₹${card.estimatedCost.toLocaleString('en-IN')}</div>
                  </div>
                </div>
                <div class="ai-action-buttons">
                  <button class="btn btn-sm btn-secondary" onclick="window.shopUI.openRestockModal('PROD-001')">${dict.reviewDetails}</button>
                  <button class="btn btn-sm btn-ai" onclick="window.shopAiEngine.approvePurchaseOrder('${card.id}')">${dict.approveAndOrder}</button>
                </div>
              </div>
            `;
          }
        }

        const safeAiText = escapeHtml(msg.text).replace(/\n/g, '<br/>');

        return `
          <div class="chat-bubble-row ai-row">
            <div class="chat-bubble ai-bubble">${safeAiText}</div>
            ${toolsHtml}
            ${calcHtml}
            ${actionHtml}
          </div>
        `;
      }
    }).join("");

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }

  // ------------------------------------------------------------------------
  // CHAT INPUT & PROMPTS
  // ------------------------------------------------------------------------
  function initAiChatInput() {
    const input = document.getElementById("aiChatInput");
    const sendBtn = document.getElementById("aiChatSendBtn");

    const handleSend = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      aiEngine.processUserQuery(text, false);
    };

    if (sendBtn) sendBtn.addEventListener("click", handleSend);
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleSend();
        }
      });
    }
  }

  // ------------------------------------------------------------------------
  // LIVEKIT VOICE UI
  // ------------------------------------------------------------------------
  function initVoiceControls() {
    const micBtn = document.getElementById("voiceMicBtn");
    const muteBtn = document.getElementById("voiceMuteBtn");
    const interruptBtn = document.getElementById("voiceInterruptBtn");

    if (micBtn) {
      micBtn.addEventListener("click", () => {
        if (aiEngine.voiceState === "listening" || aiEngine.voiceState === "speaking") {
          aiEngine.interruptVoice();
        } else {
          aiEngine.startVoiceListening();
        }
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener("click", () => {
        aiEngine.isMuted = !aiEngine.isMuted;
        const dict = TRANSLATIONS[store.currentLanguage] || TRANSLATIONS.en;
        muteBtn.innerText = aiEngine.isMuted ? dict.unmuteVoice : dict.muteVoice;
        ui.showToast(aiEngine.isMuted ? "Voice speech muted" : "Voice speech unmuted", "info");
      });
    }

    if (interruptBtn) {
      interruptBtn.addEventListener("click", () => {
        aiEngine.interruptVoice();
      });
    }
  }

  function updateVoiceUI(payload) {
    const micBtn = document.getElementById("voiceMicBtn");
    const statusTitle = document.getElementById("voiceStatusTitle");
    const statusSubtitle = document.getElementById("voiceStatusSubtitle");
    const waveform = document.getElementById("voiceWaveform");
    const avatarCard = document.getElementById("beyondPresenceAvatarCard");
    const avatarCaption = document.getElementById("avatarCaptionText");

    const state = payload.state;
    const dict = TRANSLATIONS[store.currentLanguage] || TRANSLATIONS.en;

    if (micBtn) {
      micBtn.classList.remove("listening", "speaking");
      if (state === "listening") micBtn.classList.add("listening");
      if (state === "speaking") micBtn.classList.add("speaking");
    }

    if (waveform) {
      if (state === "listening" || state === "speaking") {
        waveform.classList.add("voice-active");
      } else {
        waveform.classList.remove("voice-active");
      }
    }

    if (avatarCard) {
      if (state === "speaking") {
        avatarCard.classList.add("avatar-speaking");
      } else {
        avatarCard.classList.remove("avatar-speaking");
      }
    }

    if (statusTitle && statusSubtitle) {
      if (state === "ready") {
        statusTitle.innerText = dict.tapToSpeak;
        statusSubtitle.innerText = dict.voiceReadySub;
      } else if (state === "listening") {
        statusTitle.innerText = dict.listening;
        statusSubtitle.innerText = dict.listeningSub;
      } else if (state === "processing") {
        statusTitle.innerText = dict.understanding;
        statusSubtitle.innerText = payload.transcript ? `"${payload.transcript}"` : dict.understanding;
      } else if (state === "speaking") {
        statusTitle.innerText = dict.responding;
        statusSubtitle.innerText = dict.respondingSub;
      }
    }

    if (avatarCaption && payload.caption) {
      avatarCaption.innerText = `"${payload.caption}"`;
    }
  }

  // ------------------------------------------------------------------------
  // SEARCH & FILTER SYSTEM
  // ------------------------------------------------------------------------
  function initFiltersAndSearch() {
    const prodSearch = document.getElementById("prodSearchInput");
    const prodCat = document.getElementById("prodCategoryFilter");
    const prodStatus = document.getElementById("prodStatusFilter");

    const filterProducts = () => {
      const q = (prodSearch?.value || "").toLowerCase();
      const cat = prodCat?.value || "All";
      const st = prodStatus?.value || "All";

      const filtered = store.products.filter(p => {
        const matchQ = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
        const matchCat = cat === "All" || p.category === cat;
        const matchSt = st === "All" || p.status === st;
        return matchQ && matchCat && matchSt;
      });

      renderProductsTable(filtered);
    };

    if (prodSearch) prodSearch.addEventListener("input", filterProducts);
    if (prodCat) prodCat.addEventListener("change", filterProducts);
    if (prodStatus) prodStatus.addEventListener("change", filterProducts);

    const invSearch = document.getElementById("invSearchInput");
    const invStatus = document.getElementById("invStatusFilter");

    const filterInventory = () => {
      const q = (invSearch?.value || "").toLowerCase();
      const st = invStatus?.value || "All";

      const filtered = store.products.filter(p => {
        const matchQ = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
        const matchSt = st === "All" || p.status === st;
        return matchQ && matchSt;
      });

      renderInventoryTable(filtered);
    };

    if (invSearch) invSearch.addEventListener("input", filterInventory);
    if (invStatus) invStatus.addEventListener("change", filterInventory);

    const globalSearch = document.getElementById("globalSearchInput");
    if (globalSearch) {
      globalSearch.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const q = globalSearch.value.trim();
          if (q) {
            ui.switchView("ai-assistant");
            aiEngine.processUserQuery(q, false);
            globalSearch.value = "";
          }
        }
      });
    }
  }

  // ------------------------------------------------------------------------
  // ROLE SWITCHER & PERMISSIONS
  // ------------------------------------------------------------------------
  function initSettingsRoleSwitcher() {
    const roleSelect = document.getElementById("settingsRoleSelect");
    if (roleSelect) {
      roleSelect.value = store.currentUserRole;
      roleSelect.addEventListener("change", (e) => {
        store.setRole(e.target.value);
        ui.showToast(`Switched active role to "${e.target.value.toUpperCase()}"`, "info");
      });
    }
  }

  function updateRoleUI(role) {
    const badge = document.getElementById("topbarRoleBadge");
    if (badge) {
      const dict = TRANSLATIONS[store.currentLanguage] || TRANSLATIONS.en;
      badge.innerText = role === 'owner' ? dict.userRoleOwner : role.charAt(0).toUpperCase() + role.slice(1);
    }
    const select = document.getElementById("settingsRoleSelect");
    if (select) select.value = role;
  }

  // ------------------------------------------------------------------------
  // 100% COMPLETE MULTILINGUAL UI APPLICATION
  // ------------------------------------------------------------------------
  function applyTranslations(lang) {
    document.documentElement.lang = lang;
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

    // 1. Translate every element with [data-i18n]
    document.querySelectorAll("[data-i18n]").forEach(elem => {
      const key = elem.getAttribute("data-i18n");
      if (dict[key] !== undefined) {
        if (dict[key].includes("<") && dict[key].includes(">")) {
          elem.innerHTML = dict[key];
        } else {
          elem.innerText = dict[key];
        }
      }
    });

    // 2. Translate every input placeholder with [data-i18n-ph]
    document.querySelectorAll("[data-i18n-ph]").forEach(elem => {
      const key = elem.getAttribute("data-i18n-ph");
      if (dict[key] !== undefined) {
        elem.setAttribute("placeholder", dict[key]);
      }
    });

    // 3. Update topbar and login language buttons
    document.querySelectorAll(".lang-btn").forEach(btn => {
      if (btn.getAttribute("data-lang") === lang) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // 4. Update AI initial welcome message if not overridden
    if (aiEngine.chatHistory.length > 0 && aiEngine.chatHistory[0].id === "msg-welcome") {
      aiEngine.chatHistory[0].text = dict.aiWelcome;
    }

    // 5. Update Beyond Presence Avatar caption
    const avatarCaption = document.getElementById("avatarCaptionText");
    if (avatarCaption) {
      if (lang === "te") {
        avatarCaption.innerText = '"శుభోదయం. శర్మ కిరాణా స్టోర్‌లో ఈరోజు ₹18,450 అమ్మకాలు జరిగాయి."';
      } else if (lang === "hi") {
        avatarCaption.innerText = '"शुभ प्रभात। शर्मा किराना स्टोर में आज ₹18,450 की कुल बिक्री हुई।"';
      } else {
        avatarCaption.innerText = '"Good morning. Sharma Kirana Store had ₹18,450 in revenue today."';
      }
    }

    // 6. Re-render all views and dynamic tables in the chosen language
    renderAllViews();
    renderAiChatThread(aiEngine.chatHistory);

    ui.showToast(`Language switched to ${lang === 'te' ? 'తెలుగు (Telugu)' : (lang === 'hi' ? 'हिंदी (Hindi)' : 'English')}`, "info");
  }
});
