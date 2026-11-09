import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.PORT ??= '3000';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/authentication_app_test';
process.env.JWT_SECRET ??= 'test-only-secret-that-is-long-enough-32';
process.env.JWT_EXPIRES_IN ??= '86400';
process.env.FRONTEND_ORIGINS ??= 'http://localhost:4200,http://localhost:3000';
