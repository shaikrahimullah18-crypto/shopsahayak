const mongoose = require('mongoose');

/**
 * Robust MongoDB Atlas Connection Handler
 * Supports SRV connection strings, automated reconnects, connection pooling, and graceful teardown
 */
const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    console.warn(
      '\n⚠️ [MongoDB Atlas Warning]: MONGO_URI in .env is either unset or contains placeholders (<username>/<password>).'
    );
    console.warn(
      '👉 Please update your .env with your real MongoDB Atlas connection string to persist data in the cloud.\n'
    );
  }

  try {
    const conn = await mongoose.connect(uri || 'mongodb://localhost:27017/shopsahayak', {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
      maxPoolSize: 10,                // Maintain up to 10 socket connections
      socketTimeoutMS: 45000,         // Close sockets after 45 seconds of inactivity
    });

    console.log(`✅ [MongoDB Atlas] Connected successfully to host: ${conn.connection.host}`);
    console.log(`📦 [MongoDB Atlas] Database Name: ${conn.connection.name}`);

    // Drop legacy non-compound unique indexes to support multi-tenancy
    try { await conn.connection.collection('products').dropIndex('id_1'); } catch (e) {}
    try { await conn.connection.collection('products').dropIndex('sku_1'); } catch (e) {}
    try { await conn.connection.collection('suppliers').dropIndex('id_1'); } catch (e) {}
    try { await conn.connection.collection('customers').dropIndex('id_1'); } catch (e) {}
  } catch (error) {
    console.error(`❌ [MongoDB Atlas Error] Connection failed: ${error.message}`);
    console.error('ℹ️ If using MongoDB Atlas, please check:');
    console.error('  1. IP Access List in Atlas (allow current IP or 0.0.0.0/0 for testing)');
    console.error('  2. Database user credentials (username and password)');
    console.error('  3. Network firewall and DNS resolution');
    
    // In production, exit; in local development, allow fallback or retry
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // Connection Lifecycle Events
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [MongoDB Atlas] Connection disconnected. Attempting reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 [MongoDB Atlas] Successfully reconnected to cluster.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ [MongoDB Atlas] Runtime connection error:', err.message);
  });

  // Graceful Process Termination
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('🛑 [MongoDB Atlas] Connection closed due to application termination (SIGINT).');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await mongoose.connection.close();
    console.log('🛑 [MongoDB Atlas] Connection closed due to application termination (SIGTERM).');
    process.exit(0);
  });
};

module.exports = connectDB;
