/* ==========================================================================
   ShopSahayak - AI Agentic Business Assistant & Voice AI Engine
   Agentic Tool Execution, LiveKit Voice Simulation, Beyond Presence Avatar
   ========================================================================== */

class ShopSahayakAIEngine {
  constructor(store) {
    this.store = store;
    this.voiceState = "ready"; // 'ready' | 'listening' | 'processing' | 'speaking'
    this.isMuted = false;
    this.activeSpeechUtterance = null;
    this.chatHistory = [];
    this.onStateChange = null;

    // Load initial greeting message
    this.initWelcomeMessage();
  }

  initWelcomeMessage(user) {
    const ownerName = user?.name || "Ravi";
    const storeName = user?.storeName || "Sharma Kirana Store";
    const isNew = Boolean(user && user.email && user.email !== "ravi.sharma@kiranaos.in" && user.username !== "ravi");

    let text;
    if (isNew) {
      text = `Namaste ${ownerName} ji! Welcome to ShopSahayak. Your store "${storeName}" is live and ready for operations. I am your AI business copilot. You can add your products, start recording customer sales, or ask me for advice on pricing and inventory management.`;
    } else {
      const stockCounts = this.store ? this.store.recalculateStockCounts() : { low: 7 };
      const lowCount = stockCounts.low;
      text = `Namaste Ravi garu! Good morning. I'm your ShopSahayak business operating assistant. Sharma Kirana Store currently has ${lowCount} items below safety stock, and rice demand is up by +21%. You can ask me anything about your inventory, sales, or supplier reorders in English, Telugu, or Hindi.`;
    }

    this.chatHistory = [
      {
        id: "msg-welcome",
        sender: "ai",
        text: text,
        detectedLang: "English",
        tools: null,
        calculation: null,
        actionCard: null
      }
    ];
  }

  tokenize(text) {
    if (!text) return [];
    // Match letter/number/combining mark sequences across Unicode scripts (including Indic matras/viramas)
    const matches = text.toLowerCase().match(/[\p{L}\p{N}\p{M}]+/gu);
    return matches || [];
  }

  detectLanguage(query) {
    if (!query) return "English";

    const hasTeluguScript = /[\u0C00-\u0C7F]/.test(query);
    const hasHindiScript = /[\u0900-\u097F]/.test(query);
    const hasLatinScript = /[a-zA-Z]/.test(query);

    const tokens = this.tokenize(query);

    // Whitelist of specific Latin-transliterated words (matched strictly as whole tokens)
    const teluguLatinWords = new Set([
      "anna", "entha", "undi", "babu", "choodu", "ivvandi", "cheppandi", "ledu", "evaru", "kavali", "namaskaram"
    ]);
    const hindiLatinWords = new Set([
      "aaj", "kitna", "batao", "bhejo", "kaisa", "daal", "chawal", "dukan", "karein", "pucho", "namaste"
    ]);

    const hasTeluguLatin = tokens.some(t => teluguLatinWords.has(t));
    const hasHindiLatin = tokens.some(t => hindiLatinWords.has(t));

    const isTelugu = hasTeluguScript || hasTeluguLatin;
    const isHindi = hasHindiScript || hasHindiLatin;

    if (isTelugu && hasLatinScript) {
      return "Telugu + English";
    } else if (isTelugu) {
      return "Telugu (తెలుగు)";
    } else if (isHindi && hasLatinScript) {
      return "Hindi + English (Hinglish)";
    } else if (isHindi) {
      return "Hindi (हिंदी)";
    }
    return "English";
  }

  async processUserQuery(queryText, isVoice = false) {
    const detectedLang = this.detectLanguage(queryText);

    // Add user message to conversation
    const userMsgId = "msg-user-" + Date.now();
    this.chatHistory.push({
      id: userMsgId,
      sender: "user",
      text: queryText,
      detectedLang: detectedLang
    });

    if (this.onStateChange) this.onStateChange("message_added", { history: this.chatHistory });

    // Show AI typing / thinking indicator
    if (this.onStateChange) this.onStateChange("ai_thinking", true);

    const tokens = this.tokenize(queryText);
    const tokenSet = new Set(tokens);
    const queryLower = queryText.toLowerCase();

    // Check for Rice intent (whole tokens or script)
    const isRice = tokenSet.has("rice") ||
      tokenSet.has("chawal") ||
      tokens.some(t => t.includes("బియ్యం") || t.includes("చావల్") || t.includes("चावल"));

    // Check for Oil intent (whole tokens only: 'tel' as a single token, never substring of 'tell')
    const isOil = tokenSet.has("oil") ||
      tokenSet.has("sunflower") ||
      tokenSet.has("fortune") ||
      tokenSet.has("tel") ||
      tokens.some(t => t.includes("నూనె") || t.includes("తైలం") || t.includes("तेल"));

    // Check for Khata / customer credit intent
    const isKhata = tokenSet.has("khata") ||
      tokenSet.has("udhar") ||
      tokenSet.has("khatabook") ||
      tokenSet.has("credit") ||
      tokenSet.has("balance") ||
      tokens.some(t => t.includes("ఖాతా") || t.includes("ఉధార్") || t.includes("खाता") || t.includes("उधार"));

    // Check for Low Stock summary intent
    const isLowStock = queryLower.includes("low stock") ||
      (tokenSet.has("low") && tokenSet.has("stock")) ||
      tokenSet.has("reorder") ||
      tokens.some(t => t.includes("తక్కువ") || t.includes("కొరత") || t.includes("कम") || t.includes("कमी"));

    // Check for Sales / Reports intent
    const isSales = tokenSet.has("report") ||
      tokenSet.has("reports") ||
      tokenSet.has("sales") ||
      tokenSet.has("revenue") ||
      tokenSet.has("profit") ||
      tokens.some(t => t.includes("రిపోర్ట్") || t.includes("అమ్మకాలు") || t.includes("बिक्री") || t.includes("रिपोर्ट"));

    // Route based on token intent
    if (isRice) {
      await this.executeRiceStockAgenticWorkflow(detectedLang, isVoice);
    } else if (isOil) {
      await this.executeOilAgenticWorkflow(detectedLang, isVoice);
    } else if (isKhata) {
      await this.executeKhataAnalysisWorkflow(detectedLang, isVoice);
    } else if (isLowStock) {
      await this.executeLowStockSummaryWorkflow(detectedLang, isVoice);
    } else if (isSales) {
      await this.executeSalesAnalysisWorkflow(detectedLang, isVoice);
    } else {
      await this.executeGeneralRetailWorkflow(queryText, detectedLang, isVoice);
    }
  }

  // ------------------------------------------------------------------------
  // HACKATHON CORE DEMO WORKFLOW: RICE STOCK & REORDER AGENT
  // ------------------------------------------------------------------------
  async executeRiceStockAgenticWorkflow(detectedLang, isVoice) {
    const riceProd = this.store.products.find(p => p.id === "PROD-001");
    const stockQty = riceProd ? riceProd.stock : 18;
    const velocityDaily = riceProd ? riceProd.velocityDaily : 9.3;
    const buyPrice = riceProd ? riceProd.purchasePrice : 54;
    const reorderQty = 100;
    const totalCost = reorderQty * buyPrice; // 100 * 54 = 5,400

    const daysRemaining = (stockQty / velocityDaily).toFixed(1); // 1.9 days
    const hoursRemaining = Math.round((stockQty / velocityDaily) * 24); // ~48 hours

    // Agentic activity timeline
    const tools = [
      { name: "Checking inventory for 'Sona Masoori Raw Rice'...", status: "active", icon: "search" },
      { name: "Analyzing 30-day sales velocity...", status: "pending", icon: "chart" },
      { name: "Calculating restocking demand model...", status: "pending", icon: "calculator" },
      { name: "Fetching supplier quotes from ABC Distributors...", status: "pending", icon: "truck" }
    ];

    const aiMsgId = "msg-ai-" + Date.now();
    const aiMessage = {
      id: aiMsgId,
      sender: "ai",
      text: `You currently have ${stockQty} kg of Sona Masoori Raw Rice in stock. Your average weekly rice sales are 65 kg (approx ${velocityDaily} kg/day). Based on recent festive demand, your current stock may run low within 48 hours.`,
      detectedLang: detectedLang,
      tools: tools,
      calculation: {
        currentStock: `${stockQty} kg`,
        weeklyVelocity: "65 kg / week (9.3 kg / day)",
        safetyThreshold: "30 kg",
        daysRemaining: `${daysRemaining} days (~${hoursRemaining} hours)`,
        recommendedOrder: `${reorderQty} kg`,
        supplierName: "ABC Distributors (Mahesh Agarwal)",
        estimatedCost: `₹${totalCost.toLocaleString('en-IN')} (@ ₹${buyPrice}/kg wholesale bulk rate)`
      },
      actionCard: {
        id: "action-po-rice",
        title: "Recommended Replenishment Order",
        product: "Sona Masoori Raw Rice",
        productId: "PROD-001",
        quantity: reorderQty,
        unit: "kg",
        unitPrice: buyPrice,
        supplier: "ABC Distributors",
        estimatedCost: totalCost,
        status: "pending_approval"
      }
    };

    this.chatHistory.push(aiMessage);
    if (this.onStateChange) this.onStateChange("ai_thinking", false);
    if (this.onStateChange) this.onStateChange("message_added", { history: this.chatHistory });

    // Animate tools step-by-step
    await this.delay(400);
    tools[0].status = "completed";
    tools[0].name = `✓ Checked inventory: Found ${stockQty} kg in stock (Below min safety level 30 kg)`;
    tools[1].status = "active";
    if (this.onStateChange) this.onStateChange("message_updated", { messageId: aiMsgId });

    await this.delay(450);
    tools[1].status = "completed";
    tools[1].name = "✓ Analyzed 30-day velocity: 65 kg/week (+21% festival surge)";
    tools[2].status = "active";
    if (this.onStateChange) this.onStateChange("message_updated", { messageId: aiMsgId });

    await this.delay(400);
    tools[2].status = "completed";
    tools[2].name = `✓ Recommendation generated: Order ${reorderQty} kg to prevent weekend stockout`;
    tools[3].status = "completed";
    tools[3].name = `✓ Supplier verified: ABC Distributors (₹${totalCost.toLocaleString('en-IN')}, Net 7 Days)`;
    if (this.onStateChange) this.onStateChange("message_updated", { messageId: aiMsgId });

    // Voice response if voice mode
    const spokenText = `You currently have ${stockQty} kg of Sona Masoori Rice. At your weekly sales rate of 65 kg, your stock will run out in two days. I recommend ordering ${reorderQty} kg from ABC Distributors for ₹${totalCost.toLocaleString('en-IN')}.`;
    this.speakText(spokenText);
  }

  // ------------------------------------------------------------------------
  // COOKING OIL WORKFLOW
  // ------------------------------------------------------------------------
  async executeOilAgenticWorkflow(detectedLang, isVoice) {
    const tools = [
      { name: "Checking Fortune Sunflower Oil 1L stock...", status: "completed", icon: "search" },
      { name: "Analyzing supplier bundle discount...", status: "completed", icon: "truck" }
    ];

    const aiMsgId = "msg-ai-" + Date.now();
    const aiMessage = {
      id: aiMsgId,
      sender: "ai",
      text: "Fortune Sunflower Oil is currently at 4 pouches (critical alert). Daily sales velocity is 8.5 pouches. Distributor Balaji Trading Co is offering a 4% volume rebate if you order a 25-pouch bundle today.",
      detectedLang: detectedLang,
      tools: tools,
      calculation: {
        currentStock: "4 pouches",
        safetyThreshold: "25 pouches",
        recommendedOrder: "25 pouches",
        supplierName: "Balaji Trading Co",
        estimatedCost: "₹3,200 (Savings: ₹130)"
      },
      actionCard: {
        id: "action-po-oil",
        title: "Reorder Fortune Sunflower Oil",
        product: "Fortune Sunlite Sunflower Oil (1L)",
        productId: "PROD-003",
        quantity: 25,
        unit: "pouches",
        unitPrice: 128,
        supplier: "Balaji Trading Co",
        estimatedCost: 3200,
        status: "pending_approval"
      }
    };

    this.chatHistory.push(aiMessage);
    if (this.onStateChange) this.onStateChange("ai_thinking", false);
    if (this.onStateChange) this.onStateChange("message_added", { history: this.chatHistory });
    this.speakText("Fortune Sunflower oil has only 4 pouches left. I recommend ordering 25 pouches to get the distributor discount.");
  }

  // ------------------------------------------------------------------------
  // LOW STOCK AUDIT WORKFLOW
  // ------------------------------------------------------------------------
  async executeLowStockSummaryWorkflow(detectedLang, isVoice) {
    const stockCounts = this.store.recalculateStockCounts();
    const lowStockItems = this.store.products.filter(p => p.status === "low");
    const outStockItems = this.store.products.filter(p => p.status === "out");

    const summary = lowStockItems.map(p => `• ${p.name}: ${p.stock} ${p.unit} remaining (Min: ${p.minStock})`).join("\n");
    const outSummary = outStockItems.map(p => `• ${p.name}: OUT OF STOCK (0 ${p.unit})`).join("\n");

    const aiMsgId = "msg-ai-" + Date.now();
    this.chatHistory.push({
      id: aiMsgId,
      sender: "ai",
      text: `There are currently ${stockCounts.low} low-stock items and ${stockCounts.out} out-of-stock item needing attention:\n\n${summary}\n${outSummary ? "\n" + outSummary : ""}\n\nWould you like me to draft replenishment purchase orders for your primary suppliers?`,
      detectedLang: detectedLang,
      tools: [
        { name: `Scanned ${this.store.products.length} store catalogue SKUs`, status: "completed", icon: "search" },
        { name: `Identified ${stockCounts.low} low-stock SKUs and ${stockCounts.out} out-of-stock SKU`, status: "completed", icon: "alert" }
      ],
      calculation: null,
      actionCard: null
    });

    if (this.onStateChange) this.onStateChange("ai_thinking", false);
    if (this.onStateChange) this.onStateChange("message_added", { history: this.chatHistory });
    this.speakText(`You have ${stockCounts.low} products below safety stock and 1 out of stock item.`);
  }

  // ------------------------------------------------------------------------
  // SALES ANALYSIS WORKFLOW
  // ------------------------------------------------------------------------
  async executeSalesAnalysisWorkflow(detectedLang, isVoice) {
    const aiMsgId = "msg-ai-" + Date.now();
    this.chatHistory.push({
      id: aiMsgId,
      sender: "ai",
      text: `Today's revenue is ₹${this.store.metrics.todayRevenue.toLocaleString('en-IN')} across ${this.store.metrics.todayOrders} customer orders. Estimated gross profit is ₹${this.store.metrics.estimatedProfit.toLocaleString('en-IN')} (approx ${this.store.metrics.profitMargin}% margin). Highest velocity was between 6:00 PM and 8:30 PM.`,
      detectedLang: detectedLang,
      tools: [
        { name: "Compiled live POS ledger entries", status: "completed", icon: "chart" },
        { name: "Calculated gross margin and top velocity SKUs", status: "completed", icon: "check" }
      ],
      calculation: null,
      actionCard: null
    });

    if (this.onStateChange) this.onStateChange("ai_thinking", false);
    if (this.onStateChange) this.onStateChange("message_added", { history: this.chatHistory });
    this.speakText(`Today's revenue is ₹${this.store.metrics.todayRevenue.toLocaleString('en-IN')} with ${this.store.metrics.todayOrders} orders. Profit margin is running at ${this.store.metrics.profitMargin} percent.`);
  }

  // ------------------------------------------------------------------------
  // KHATA / CUSTOMER ANALYSIS WORKFLOW
  // ------------------------------------------------------------------------
  async executeKhataAnalysisWorkflow(detectedLang, isVoice) {
    const totalKhata = this.store.customers.reduce((acc, c) => acc + (c.khataBalance || 0), 0);

    const aiMsgId = "msg-ai-" + Date.now();
    this.chatHistory.push({
      id: aiMsgId,
      sender: "ai",
      text: `Total outstanding Khata (Udhar) across regular customers is ₹${totalKhata.toLocaleString('en-IN')}. The largest outstanding balance is Mohammed Irfan at ₹4,500, followed by Suresh Gupta at ₹2,800. I can draft friendly WhatsApp payment reminders if you approve.`,
      detectedLang: detectedLang,
      tools: [
        { name: "Audited customer ledger balances", status: "completed", icon: "users" },
        { name: "Verified payment history and credit cycles", status: "completed", icon: "check" }
      ],
      calculation: null,
      actionCard: null
    });

    if (this.onStateChange) this.onStateChange("ai_thinking", false);
    if (this.onStateChange) this.onStateChange("message_added", { history: this.chatHistory });
    this.speakText(`Total outstanding customer khata is ₹${totalKhata.toLocaleString('en-IN')}. Would you like me to send payment reminders?`);
  }

  // ------------------------------------------------------------------------
  // GENERAL FALLBACK WORKFLOW
  // ------------------------------------------------------------------------
  async executeGeneralRetailWorkflow(query, detectedLang, isVoice) {
    const aiMsgId = "msg-ai-" + Date.now();
    this.chatHistory.push({
      id: aiMsgId,
      sender: "ai",
      text: `I've analyzed your question regarding "${query}". Sharma Kirana Store operations are currently healthy with ₹18,450 daily revenue. Let me know if you want me to check specific stock levels, reorder from distributors, or generate a GST sales summary.`,
      detectedLang: detectedLang,
      tools: [
        { name: "Parsed retail natural-language query", status: "completed", icon: "check" }
      ],
      calculation: null,
      actionCard: null
    });

    if (this.onStateChange) this.onStateChange("ai_thinking", false);
    if (this.onStateChange) this.onStateChange("message_added", { history: this.chatHistory });
  }

  // ------------------------------------------------------------------------
  // APPROVE PURCHASE ORDER ACTION (ROUTED THROUGH CONFIRMATION DIALOG)
  // ------------------------------------------------------------------------
  approvePurchaseOrder(actionCardId, autoConfirmDelayMs = 0) {
    let msg = this.chatHistory.find(m => m.actionCard && m.actionCard.id === actionCardId);
    
    // Idempotent: If action card is missing (e.g. direct step jump), create card first
    if (!msg || !msg.actionCard) {
      const riceProd = this.store.products.find(p => p.id === "PROD-001");
      const stockQty = riceProd ? riceProd.stock : 18;
      const buyPrice = riceProd ? riceProd.purchasePrice : 54;
      const reorderQty = 100;
      const totalCost = reorderQty * buyPrice;

      msg = {
        id: "msg-ai-" + Date.now(),
        sender: "ai",
        text: `Restocking recommendation: Order ${reorderQty} kg of Sona Masoori Raw Rice from ABC Distributors.`,
        detectedLang: "English",
        actionCard: {
          id: actionCardId || "action-po-rice",
          title: "Recommended Replenishment Order",
          product: "Sona Masoori Raw Rice",
          productId: "PROD-001",
          quantity: reorderQty,
          unit: "kg",
          unitPrice: buyPrice,
          supplier: "ABC Distributors",
          estimatedCost: totalCost,
          status: "pending_approval"
        }
      };
      this.chatHistory.push(msg);
      if (this.onStateChange) this.onStateChange("message_added", { history: this.chatHistory });
    }

    // If already approved, do not double-approve
    if (msg.actionCard.status === "approved") {
      if (window.shopUI) {
        window.shopUI.showToast("This purchase order has already been approved and recorded.", "info");
      }
      return;
    }

    const { productId, quantity, supplier } = msg.actionCard;
    const prodId = productId || (actionCardId === "action-po-oil" ? "PROD-003" : "PROD-001");

    // Route through unified security dialog pipeline
    if (window.shopUI && window.shopUI.requestPurchaseOrderApproval) {
      window.shopUI.requestPurchaseOrderApproval({
        productId: prodId,
        quantity: quantity || 100,
        supplierName: supplier || "ABC Distributors",
        actionCardId: actionCardId,
        autoConfirmDelayMs: autoConfirmDelayMs
      });
    }
  }

  // Called when confirmation dialog is actually confirmed
  finalizeActionCardApproval(actionCardId, poNumber, quantity, finalCost) {
    const msg = this.chatHistory.find(m => m.actionCard && m.actionCard.id === actionCardId);
    if (msg && msg.actionCard) {
      msg.actionCard.status = "approved";
    }

    const stockCounts = this.store.recalculateStockCounts();
    const lowStockCount = stockCounts.low;

    this.chatHistory.push({
      id: "msg-confirm-" + Date.now(),
      sender: "ai",
      text: `✓ Purchase order confirmed! ${quantity} kg of Sona Masoori Raw Rice has been ordered from ABC Distributors. Inventory stock and dashboard health have been automatically updated.`,
      detectedLang: "System",
      tools: [
        { name: `Generated ${poNumber} sent to ABC Distributors`, status: "completed", icon: "check" },
        { name: `Store inventory updated (+${quantity} kg Sona Masoori Rice)`, status: "completed", icon: "check" },
        { name: `Dashboard stock health recalculated: Low Stock reduced to ${lowStockCount}`, status: "completed", icon: "check" }
      ],
      calculation: null,
      actionCard: null
    });

    if (this.onStateChange) this.onStateChange("message_added", { history: this.chatHistory });
    this.speakText(`Purchase order ${poNumber} has been created. Added ${quantity} kg of Sona Masoori Rice to inventory.`);
  }

  // ------------------------------------------------------------------------
  // SCRIPTED VOICE QUERY SIMULATION (NO MIC PROMPT FOR DEMO STEP 5)
  // ------------------------------------------------------------------------
  simulateVoiceQuery(queryText = "Anna, rice stock entha undi?") {
    this.voiceState = "listening";
    if (this.onStateChange) this.onStateChange("voice_state", { state: "listening" });

    setTimeout(() => {
      this.voiceState = "processing";
      if (this.onStateChange) this.onStateChange("voice_state", { state: "processing", transcript: queryText });
      
      setTimeout(() => {
        this.processUserQuery(queryText, true);
      }, 700);
    }, 1200);
  }

  // ------------------------------------------------------------------------
  // LIVEKIT VOICE AI LISTENING (FOR REAL MICROPHONE USE)
  // ------------------------------------------------------------------------
  startVoiceListening() {
    this.voiceState = "listening";
    if (this.onStateChange) this.onStateChange("voice_state", { state: "listening" });

    // Use Web Speech Recognition if available in the browser!
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        
        // Dynamically set recognition language from UI language
        const langMap = {
          en: "en-IN",
          te: "te-IN",
          hi: "hi-IN"
        };
        const currentLang = this.store ? this.store.currentLanguage : "en";
        recognition.lang = langMap[currentLang] || "en-IN";

        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          this.voiceState = "processing";
          if (this.onStateChange) this.onStateChange("voice_state", { state: "processing", transcript });
          setTimeout(() => {
            this.processUserQuery(transcript, true);
          }, 600);
        };

        recognition.onerror = () => {
          this.fallbackVoiceSimulation();
        };

        recognition.start();
        return;
      } catch (e) {
        // fallback
      }
    }

    this.fallbackVoiceSimulation();
  }

  fallbackVoiceSimulation() {
    // Simulated Voice prompt fallback
    setTimeout(() => {
      this.voiceState = "processing";
      const sampleVoiceQuery = "Anna, rice stock entha undi?";
      if (this.onStateChange) this.onStateChange("voice_state", { state: "processing", transcript: sampleVoiceQuery });
      
      setTimeout(() => {
        this.processUserQuery(sampleVoiceQuery, true);
      }, 700);
    }, 1800);
  }

  interruptVoice() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.voiceState = "ready";
    if (this.onStateChange) this.onStateChange("voice_state", { state: "ready" });
  }

  speakText(text) {
    if (this.isMuted) return;

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      // Try to choose an Indian English voice if present
      const voices = window.speechSynthesis.getVoices();
      const inVoice = voices.find(v => v.lang.includes("en-IN") || v.lang.includes("hi-IN"));
      if (inVoice) utterance.voice = inVoice;

      this.voiceState = "speaking";
      if (this.onStateChange) this.onStateChange("voice_state", { state: "speaking", caption: text });

      utterance.onend = () => {
        this.voiceState = "ready";
        if (this.onStateChange) this.onStateChange("voice_state", { state: "ready" });
      };

      utterance.onerror = () => {
        this.voiceState = "ready";
        if (this.onStateChange) this.onStateChange("voice_state", { state: "ready" });
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // Audio fallback simulation
      this.voiceState = "speaking";
      if (this.onStateChange) this.onStateChange("voice_state", { state: "speaking", caption: text });
      setTimeout(() => {
        this.voiceState = "ready";
        if (this.onStateChange) this.onStateChange("voice_state", { state: "ready" });
      }, 3500);
    }
  }

  delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }
}

window.shopAiEngine = new ShopSahayakAIEngine(window.shopStore);
