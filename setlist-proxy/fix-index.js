const mongoose = require('mongoose');
require('dotenv').config();

async function fixIndex() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const indexes = await usersCollection.indexes();
    console.log('📋 Current indexes:', indexes.map(idx => idx.name));

    try {
      await usersCollection.dropIndex('username_1');
      console.log('✅ Dropped username_1 index');
    } catch (err) {
      if (err.code === 27) {
        console.log('ℹ️  username_1 index does not exist (already removed)');
      } else {
        console.log('❌ Error dropping index:', err.message);
      }
    }

    const newIndexes = await usersCollection.indexes();
    console.log('📋 Indexes after cleanup:', newIndexes.map(idx => idx.name));

    await mongoose.disconnect();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixIndex();