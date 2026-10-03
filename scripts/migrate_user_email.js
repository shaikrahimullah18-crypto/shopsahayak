const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const pRes = await db.collection('products').updateMany(
    { $or: [{ userEmail: { $exists: false } }, { userEmail: null }, { userEmail: '' }] },
    { $set: { userEmail: 'ravi.sharma@kiranaos.in' } }
  );
  console.log('Updated legacy products:', pRes.modifiedCount);

  const cRes = await db.collection('customers').updateMany(
    { $or: [{ userEmail: { $exists: false } }, { userEmail: null }, { userEmail: '' }] },
    { $set: { userEmail: 'ravi.sharma@kiranaos.in' } }
  );
  console.log('Updated legacy customers:', cRes.modifiedCount);

  const sRes = await db.collection('suppliers').updateMany(
    { $or: [{ userEmail: { $exists: false } }, { userEmail: null }, { userEmail: '' }] },
    { $set: { userEmail: 'ravi.sharma@kiranaos.in' } }
  );
  console.log('Updated legacy suppliers:', sRes.modifiedCount);

  const tRes = await db.collection('transactions').updateMany(
    { $or: [{ userEmail: { $exists: false } }, { userEmail: null }, { userEmail: '' }] },
    { $set: { userEmail: 'ravi.sharma@kiranaos.in' } }
  );
  console.log('Updated legacy transactions:', tRes.modifiedCount);

  process.exit(0);
}

migrate().catch(e => {
  console.error(e);
  process.exit(1);
});
