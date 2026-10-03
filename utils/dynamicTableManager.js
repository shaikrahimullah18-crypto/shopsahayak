const mongoose = require('mongoose');

/**
 * Sanitize phone number to digits only (e.g., "+91 98490 23145" -> "9849023145")
 */
function sanitizePhone(phone) {
  if (!phone) return '0000000000';
  const digits = String(phone).replace(/\D/g, '');
  // If starts with country code 91 and has 12 digits, can keep last 10 or full
  return digits.length > 10 ? digits.slice(-10) : digits || '0000000000';
}

/**
 * Sanitize username to alphanumeric lowercase
 */
function sanitizeName(name) {
  if (!name) return 'user';
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 25);
}

/**
 * Create dedicated user table/collection in MongoDB Atlas upon registration
 * Table Name Format: user_<mobileNumber>_<userName>
 *
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Created table metadata
 */
async function createUserTable(userData) {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️ [DynamicTableManager] MongoDB connection not ready; skipping dynamic table creation.');
      return null;
    }

    const db = mongoose.connection.db;
    const cleanPhone = sanitizePhone(userData.phone);
    const cleanName = sanitizeName(userData.name);

    // Primary user table name
    const tableName = `user_${cleanPhone}_${cleanName}`;
    const userCol = db.collection(tableName);

    const initialRecord = {
      tableName,
      userName: userData.name,
      mobileNumber: userData.phone,
      cleanMobile: cleanPhone,
      email: userData.email,
      storeName: userData.storeName,
      storeCategory: userData.storeCategory || 'Grocery & Retail',
      address: userData.address || '',
      gstin: userData.gstin || '',
      upiId: userData.upiId || '',
      role: userData.role || 'owner',
      status: 'Active Store Registered',
      welcomeSmsStatus: `Dispatched to ${userData.phone}`,
      createdAt: new Date(),
      lastUpdated: new Date()
    };

    // Upsert the user profile in their dedicated MongoDB collection
    await userCol.updateOne(
      { email: userData.email },
      { $set: initialRecord },
      { upsert: true }
    );

    console.log(`✅ [MongoDB Atlas] Dedicated User Table Created: "${tableName}" for ${userData.name} (${userData.phone})`);

    // Also initialize the user's dedicated messages table
    const messagesTableName = `messages_${cleanPhone}`;
    const msgCol = db.collection(messagesTableName);
    await msgCol.insertOne({
      table: messagesTableName,
      event: 'TABLE_INITIALIZED',
      userName: userData.name,
      mobileNumber: userData.phone,
      content: `Dedicated message log created for ${userData.name}`,
      timestamp: new Date()
    });

    console.log(`✅ [MongoDB Atlas] Dedicated Messages Table Created: "${messagesTableName}"`);

    return {
      success: true,
      tableName,
      messagesTableName,
      mobileNumber: userData.phone,
      userName: userData.name
    };
  } catch (error) {
    console.error('❌ [DynamicTableManager] Error creating user table:', error.message);
    return null;
  }
}

/**
 * Record any new data added into a user's dedicated table in MongoDB Atlas
 *
 * @param {string} userPhone - User's mobile number
 * @param {string} entityType - 'products', 'customers', 'sales', 'suppliers', 'messages'
 * @param {Object} data - The document data to store
 */
async function recordDataInUserTable(userPhone, entityType, data) {
  try {
    if (mongoose.connection.readyState !== 1) return null;

    const db = mongoose.connection.db;
    const cleanPhone = sanitizePhone(userPhone);

    // Dedicated entity collection per user (e.g. products_9849023145, sales_9849023145)
    const specificColName = `${entityType}_${cleanPhone}`;
    const specificCol = db.collection(specificColName);

    const docToInsert = {
      ...data,
      ownerPhone: userPhone,
      cleanPhone: cleanPhone,
      syncedAt: new Date()
    };

    // Remove MongoDB _id if it's already an existing ObjectId to prevent duplicate key error
    if (docToInsert._id) {
      delete docToInsert._id;
    }

    await specificCol.insertOne(docToInsert);
    console.log(`📦 [MongoDB Atlas] Synced ${entityType} record into dedicated table: "${specificColName}"`);

    return specificColName;
  } catch (error) {
    console.warn(`⚠️ [DynamicTableManager] Error writing to user collection for ${entityType}:`, error.message);
    return null;
  }
}

/**
 * List all collections in MongoDB Atlas grouped by global vs user-specific
 */
async function inspectDatabaseTables() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return { connected: false, tables: [] };
    }

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const tableNames = collections.map((c) => c.name);

    const globalTables = [];
    const userTables = [];

    const standardNames = ['users', 'products', 'customers', 'suppliers', 'transactions', 'storeprofiles', 'notifications', 'purchaseorders', 'messages'];

    for (const name of tableNames) {
      const count = await db.collection(name).countDocuments();
      const info = { name, count };
      if (standardNames.includes(name.toLowerCase())) {
        globalTables.push(info);
      } else {
        userTables.push(info);
      }
    }

    return {
      connected: true,
      totalTables: tableNames.length,
      globalTables,
      userTables
    };
  } catch (err) {
    console.error('❌ [DynamicTableManager] Inspection error:', err.message);
    return { connected: false, error: err.message };
  }
}

module.exports = {
  sanitizePhone,
  sanitizeName,
  createUserTable,
  recordDataInUserTable,
  inspectDatabaseTables
};
