import mongoose from 'mongoose';

export const connectDB = async (uri?: string): Promise<void> => {
  const mongoURI = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/moneysaver';
  try {
    await mongoose.connect(mongoURI);
    console.log(`[MongoDB] Connected successfully to ${mongoURI}`);
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
};
