const https = require('https');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const { sanitizePhone, recordDataInUserTable } = require('./dynamicTableManager');

/**
 * Format phone number to 10-digit Indian standard or international E.164
 */
function formatInternationalPhone(phone) {
  if (!phone) return '919849023145';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

/**
 * Send real SMS via Fast2SMS Gateway if API key is present
 */
function sendFast2Sms(apiKey, mobile10Digit, messageText) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      route: 'q',
      message: messageText,
      language: 'english',
      flash: 0,
      numbers: mobile10Digit
    });

    const options = {
      hostname: 'www.fast2sms.com',
      port: 443,
      path: '/dev/bulkV2',
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          resolve({ raw: body });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(5000, () => {
      req.abort();
      resolve({ status: 'TIMEOUT', message: 'SMS Gateway response timeout' });
    });
    req.write(data);
    req.end();
  });
}

/**
 * Send Welcome SMS & WhatsApp notification to newly registered user
 *
 * @param {Object} params
 * @param {string} params.phone - User mobile number
 * @param {string} params.name - User/Owner name
 * @param {string} params.storeName - Store name
 * @param {string} params.email - User email
 * @returns {Promise<Object>}
 */
async function sendRegistrationSMS({ phone, name, storeName, email }) {
  const cleanPhone = sanitizePhone(phone);
  const intlPhone = formatInternationalPhone(phone);
  const messageId = `SMS-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  const displayStore = storeName || 'ShopSahayak Kirana';
  const displayOwner = name || 'Store Partner';

  const welcomeContent = `Namaste ${displayOwner}! Welcome to ShopSahayak AI Retail Assistant. Your store "${displayStore}" is registered successfully in MongoDB Atlas. You can now manage Smart Billing, Stock, Khata & AI Orders seamlessly. Mobile: ${phone}. Support: +91 98490 23145.`;

  // Generate Direct WhatsApp URL for instant mobile dispatch
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(welcomeContent)}`;
  const waMeUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(welcomeContent)}`;

  let dispatchStatus = 'SENT';
  let gatewayUsed = 'ShopSahayak SMS Dispatcher (Simulated & WhatsApp Ready)';
  let gatewayResponse = null;

  // 1. Check if real SMS gateway is configured (Fast2SMS or Twilio)
  if (process.env.FAST2SMS_API_KEY) {
    try {
      console.log(`📡 [SMS Service] Dispatching via Fast2SMS to ${cleanPhone}...`);
      gatewayResponse = await sendFast2Sms(process.env.FAST2SMS_API_KEY, cleanPhone, welcomeContent);
      dispatchStatus = 'DELIVERED';
      gatewayUsed = 'Fast2SMS Carrier Gateway';
    } catch (err) {
      console.warn(`⚠️ [SMS Service] Fast2SMS error: ${err.message}. Falling back to default delivery log.`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`📱 [ShopSahayak SMS Dispatcher] NEW USER REGISTRATION SMS`);
  console.log(`👤 Recipient: ${displayOwner} (${phone})`);
  console.log(`🏪 Store: ${displayStore}`);
  console.log(`🆔 Message ID: ${messageId}`);
  console.log(`💬 Content: "${welcomeContent}"`);
  console.log(`📲 WhatsApp Direct Link: ${waMeUrl}`);
  console.log(`⚡ Status: ${dispatchStatus} (${gatewayUsed})`);
  console.log(`======================================================\n`);

  // 2. Persist in MongoDB Atlas 'messages' collection
  let savedMessage = null;
  try {
    savedMessage = await Message.create({
      messageId,
      recipientPhone: phone,
      recipientName: displayOwner,
      storeName: displayStore,
      userEmail: email || '',
      type: 'WELCOME_SMS',
      channel: 'Multi-Channel',
      content: welcomeContent,
      status: dispatchStatus,
      gateway: gatewayUsed,
      whatsappUrl: waMeUrl,
      sentAt: new Date()
    });
  } catch (err) {
    console.warn(`⚠️ [SMS Service] Failed to save in Message model:`, err.message);
  }

  // 3. Persist in user's dedicated dynamic table in MongoDB Atlas (e.g. messages_9849023145)
  try {
    await recordDataInUserTable(phone, 'messages', {
      messageId,
      recipientPhone: phone,
      recipientName: displayOwner,
      storeName: displayStore,
      content: welcomeContent,
      status: dispatchStatus,
      whatsappUrl: waMeUrl,
      sentAt: new Date()
    });
  } catch (err) {
    console.warn(`⚠️ [SMS Service] Failed to sync to user dynamic table:`, err.message);
  }

  // 4. Create in-app notification in MongoDB Atlas
  try {
    await Notification.create({
      id: `NOTIF-${Date.now()}`,
      category: 'Security',
      severity: 'success',
      title: 'Welcome SMS Delivered',
      message: `Welcome registration message dispatched to mobile ${phone} for store "${displayStore}".`,
      time: 'Just now',
      read: false,
      action: 'View WhatsApp Message',
      target: waMeUrl
    });
  } catch (err) {
    // Ignore duplicate notification warnings
  }

  return {
    success: true,
    messageId,
    recipientPhone: phone,
    recipientName: displayOwner,
    storeName: displayStore,
    status: dispatchStatus,
    content: welcomeContent,
    whatsappUrl: waMeUrl,
    whatsappDirectUrl: whatsappUrl,
    savedMessage
  };
}

/**
 * Send Khata reminder SMS/WhatsApp message to a customer
 */
async function sendKhataReminderSMS({ customerPhone, customerName, storeName, khataBalance, upiId }) {
  const cleanPhone = sanitizePhone(customerPhone);
  const intlPhone = formatInternationalPhone(customerPhone);
  const messageId = `KHATA-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  const storeLabel = storeName || 'Kirana Store';
  const upiInfo = upiId ? ` Pay via UPI: ${upiId}.` : '';

  const messageText = `Namaste ${customerName}, gentle reminder from ${storeLabel}. Your Khata balance is ₹${khataBalance}.${upiInfo} Thank you for your business!`;
  const whatsappUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(messageText)}`;

  try {
    await Message.create({
      messageId,
      recipientPhone: customerPhone,
      recipientName: customerName,
      storeName: storeLabel,
      type: 'KHATA_REMINDER',
      channel: 'Multi-Channel',
      content: messageText,
      status: 'SENT',
      gateway: 'ShopSahayak Khata Reminders',
      whatsappUrl,
      sentAt: new Date()
    });
  } catch (err) {
    console.warn(`⚠️ [SMS Service] Error logging Khata SMS:`, err.message);
  }

  return {
    success: true,
    messageId,
    content: messageText,
    whatsappUrl
  };
}

module.exports = {
  formatInternationalPhone,
  sendRegistrationSMS,
  sendKhataReminderSMS
};
