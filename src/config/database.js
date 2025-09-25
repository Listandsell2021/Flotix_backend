const mongoose = require('mongoose');
const { config } = require('./index');

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB connected: ${connection.connection.host}`);

    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    throw error;
  }
};

module.exports = { connectDB };