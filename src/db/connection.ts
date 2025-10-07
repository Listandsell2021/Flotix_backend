import mongoose from 'mongoose';
import { config } from '../config';

export const connectDB = async (): Promise<void> => {
  try {
    // Build MongoDB URI with database name
    const mongoURI = config.MONGODB_URI.includes('?')
      ? config.MONGODB_URI.replace('?', `/${config.DB_NAME}?`)
      : `${config.MONGODB_URI}/${config.DB_NAME}`;

    const connection = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB connected: ${connection.connection.host}`);
    console.log(`📊 Database: ${connection.connection.name}`);

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