require('dotenv').config();
const mongoose = require('mongoose');
const StoreProfile = require('../models/StoreProfile');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const User = require('../models/User');

const {
  storeProfileData,
  productsData,
  suppliersData,
  customersData,
  transactionsData,
  notificationsData
} = require('../utils/seedData');

/**
 * Seed MongoDB Atlas Database with authentic Kirana store data
 */
const seedDatabase = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    console.error('\n❌ [Seeder Error]: MONGO_URI in .env contains placeholders or is not set.');
    console.error('👉 Please paste your MongoDB Atlas connection string into .env before running the seeder:');
    console.error('   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/shopsahayak?retryWrites=true&w=majority\n');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await mongoose.connect(uri);
    console.log('✅ Connected successfully to MongoDB Atlas.');

    console.log('🧹 Clearing existing collections...');
    await StoreProfile.deleteMany({});
    await Product.deleteMany({});
    await Supplier.deleteMany({});
    await Customer.deleteMany({});
    await Transaction.deleteMany({});
    await Notification.deleteMany({});
    await User.deleteMany({});

    console.log('🌱 Seeding Store Profile...');
    await StoreProfile.create(storeProfileData);

    console.log(`🌱 Seeding ${productsData.length} Products & SKUs...`);
    await Product.insertMany(productsData);

    console.log(`🌱 Seeding ${suppliersData.length} Suppliers...`);
    await Supplier.insertMany(suppliersData);

    console.log(`🌱 Seeding ${customersData.length} Customers & Khata ledgers...`);
    await Customer.insertMany(customersData);

    console.log(`🌱 Seeding ${transactionsData.length} POS Sales Transactions...`);
    await Transaction.insertMany(transactionsData);

    console.log(`🌱 Seeding ${notificationsData.length} Inventory & Store Notifications...`);
    await Notification.insertMany(notificationsData);

    console.log('🌱 Creating default Store Owner user account (Ravi Sharma)...');
    await User.create({
      name: 'Ravi Sharma',
      email: 'ravi.sharma@kiranaos.in',
      password: 'kirana_password_123',
      role: 'owner',
      phone: '+91 98490 23145',
      storeName: 'Sharma Kirana Store'
    });

    console.log('\n======================================================');
    console.log('🎉 [MongoDB Atlas Seed Complete] Sharma Kirana Store is ready!');
    console.log('======================================================');
    console.log('Default credentials:');
    console.log('  Email:    ravi.sharma@kiranaos.in');
    console.log('  Password: kirana_password_123');
    console.log('======================================================\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed with error:', error.message);
    process.exit(1);
  }
};

seedDatabase();
