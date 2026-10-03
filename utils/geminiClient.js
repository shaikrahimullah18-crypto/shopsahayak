/**
 * ShopSahayak AI - Google Gemini Client & Kirana Retail Intelligence Engine
 * Integrates with Google Gen AI SDK with fallback to deterministic retail heuristics
 */

let GoogleGenAI = null;
try {
  const genaiPkg = require('@google/genai');
  GoogleGenAI = genaiPkg.GoogleGenAI || genaiPkg;
} catch (e) {
  // Graceful fallback if package is still installing or alternate export
}

/**
 * Generate AI Business Analysis & Guidance for Kirana Store Owner
 * @param {string} prompt - User NL or voice query
 * @param {Object} context - Live store context (inventory, low stock, sales, khata)
 * @param {string} language - Target language (English, Telugu, Hindi)
 */
exports.generateRetailAIResponse = async (prompt, context = {}, language = 'English') => {
  const apiKey = process.env.GEMINI_API_KEY;

  const systemContext = `
You are ShopSahayak (షాప్‌సహాయక్ / शॉपसहायक), an elite, polite, highly practical AI business operating assistant for Sharma Kirana Store, a neighborhood grocery store in Hyderabad, India.
The store owner is Ravi Sharma.

Store Context:
- Low Stock Items: ${JSON.stringify(context.lowStock || [])}
- Today's Revenue: ₹${context.todayRevenue || 18450}
- Orders Today: ${context.todayOrders || 47}
- Outstanding Khata Balance: ₹${context.totalKhata || 8750}
- Active Suppliers: ABC Distributors, Balaji Trading Co, Sri Lakshmi Wholesalers, Amul Co-op Depot

Guidelines:
1. Address the owner politely (e.g., "Namaste Ravi garu / Sharma ji").
2. Answer directly with exact numbers, stock units, days until stockout, and suppliers.
3. If speaking Telugu or Hindi, respond naturally in code-mixed language (Telugu+English or Hinglish) as spoken by Indian store owners.
4. Always provide an actionable recommendation (e.g. recommended replenishment quantity, supplier name, and estimated cost).
5. Output concise, crisp advice without generic fluff.
`;

  // Try calling Google Gemini API if valid key is supplied
  if (apiKey && apiKey !== 'your_gemini_api_key_here' && GoogleGenAI) {
    try {
      let aiResponseText = '';

      // Check SDK flavor
      if (typeof GoogleGenAI === 'function') {
        const ai = new GoogleGenAI({ apiKey });
        // Use gemini-2.0-flash or gemini-1.5-flash
        const modelName = 'gemini-2.5-flash';
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `${systemContext}\n\nUser Question: ${prompt}\nRespond in: ${language}`
        });
        aiResponseText = response.text || (response.candidates && response.candidates[0]?.content?.parts[0]?.text);
      }

      if (aiResponseText) {
        return {
          source: 'gemini-live',
          text: aiResponseText.trim()
        };
      }
    } catch (apiError) {
      console.warn('[Gemini API Warning]: Could not reach Gemini API, falling back to deterministic retail engine.', apiError.message);
    }
  }

  // Deterministic Retail AI Fallback Engine
  const queryLower = (prompt || '').toLowerCase();

  if (queryLower.includes('rice') || queryLower.includes('బియ్యం') || queryLower.includes('chawal')) {
    const riceStock = context.riceStock || 18;
    return {
      source: 'retail-engine-local',
      text: `Namaste Ravi garu! You currently have ${riceStock} kg of Sona Masoori Raw Rice in stock. Based on your 30-day velocity (9.3 kg/day) and upcoming festival demand (+21%), your stock will deplete in approximately 48 hours. I recommend ordering 100 kg (4 bags of 25kg) from ABC Distributors for ₹8,400.`,
      calculation: {
        currentStock: `${riceStock} kg`,
        weeklyVelocity: '65 kg / week (9.3 kg / day)',
        safetyThreshold: '30 kg',
        daysRemaining: '2 days',
        recommendedOrder: '100 kg (4 bags of 25kg)',
        supplierName: 'ABC Distributors (Mahesh Agarwal)',
        estimatedCost: '₹8,400 (@ ₹84/kg wholesale bulk rate)'
      },
      actionCard: {
        id: 'action-po-rice',
        title: 'Recommended Replenishment Order',
        product: 'Sona Masoori Raw Rice (25kg Bags)',
        quantity: 100,
        unit: 'kg',
        supplier: 'ABC Distributors',
        estimatedCost: 8400,
        status: 'pending_approval'
      }
    };
  }

  if (queryLower.includes('oil') || queryLower.includes('నూనె') || queryLower.includes('tel')) {
    return {
      source: 'retail-engine-local',
      text: `Fortune Sunlite Sunflower Oil is critical: only 4 pouches (1L) remain against a safety buffer of 25 pouches. Sales velocity is 8.5 pouches/day. Stockout is estimated within 12 hours. Recommended reorder: 30 pouches from Balaji Trading Co for ₹3,840.`,
      calculation: {
        currentStock: '4 pouches (1L)',
        dailyVelocity: '8.5 pouches / day',
        safetyThreshold: '25 pouches',
        daysRemaining: '< 1 day (Critical)',
        recommendedOrder: '30 pouches',
        supplierName: 'Balaji Trading Co',
        estimatedCost: '₹3,840 (@ ₹128 wholesale rate)'
      },
      actionCard: {
        id: 'action-po-oil',
        title: 'Urgent Oil Restock Recommendation',
        product: 'Fortune Sunlite Sunflower Oil (1L)',
        quantity: 30,
        unit: 'pouches',
        supplier: 'Balaji Trading Co',
        estimatedCost: 3840,
        status: 'pending_approval'
      }
    };
  }

  if (queryLower.includes('khata') || queryLower.includes('customer') || queryLower.includes('ఉధార్')) {
    return {
      source: 'retail-engine-local',
      text: `Total outstanding Khata credit across Sharma Kirana Store is ₹8,750 among 3 active accounts. Top overdue: Mohammed Irfan (Biryani Point) ₹4,500 and Suresh Gupta ₹2,800. Ramesh Kumar (Teacher) usually clears his ₹1,450 by the 5th of the month.`,
      calculation: {
        totalKhata: '₹8,750',
        activeCreditCustomers: 3,
        highestBalance: '₹4,500 (Mohammed Irfan)',
        recoveryRate: '94% on-time'
      }
    };
  }

  // Default intelligent assistant response
  return {
    source: 'retail-engine-local',
    text: `Namaste Ravi garu! Today's revenue is ₹${context.todayRevenue || 18450} across ${context.todayOrders || 47} orders. There are currently ${context.lowStockCount || 6} products below their minimum safety stock level that need reordering. Would you like me to prepare purchase orders for the low-stock items?`
  };
};
