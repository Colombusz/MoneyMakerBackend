import mongoose from 'mongoose';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/moneysaver_test';

export const setupTestDB = () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGO_URI);
    }
  });

  afterEach(async () => {
    if (mongoose.connection.readyState === 1) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
};
