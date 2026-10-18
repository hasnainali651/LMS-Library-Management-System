const mongoose = require('mongoose');

const connectDB = async () => {
  const connection = await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    autoIndex: process.env.NODE_ENV === 'development',
  });
  const hello = await connection.connection.db.admin().command({ hello: 1 });
  if ((!hello.setName && hello.msg !== 'isdbgrid') || !hello.logicalSessionTimeoutMinutes) {
    throw new Error('MongoDB replica-set transaction support is required');
  }
  console.log('MongoDB connected with transaction support');
  return connection;
};
module.exports = connectDB;
