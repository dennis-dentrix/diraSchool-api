import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import School from '../features/schools/School.model.js';
import User from '../features/users/User.model.js';
import Class from '../features/classes/Class.model.js';
import Student from '../features/students/Student.model.js';
import Attendance from '../features/attendance/Attendance.model.js';
import Subject from '../features/subjects/Subject.model.js';
import Exam from '../features/exams/Exam.model.js';
import Result from '../features/results/Result.model.js';
import FeeStructure from '../features/fees/FeeStructure.model.js';
import Payment from '../features/fees/Payment.model.js';
import ReportCard from '../features/report-cards/ReportCard.model.js';
import AuditLog from '../features/audit/AuditLog.model.js';
import SchoolSettings from '../features/settings/SchoolSettings.model.js';
import Timetable from '../features/timetable/Timetable.model.js';
import Book from '../features/library/Book.model.js';
import BookLoan from '../features/library/BookLoan.model.js';
import TransportRoute from '../features/transport/TransportRoute.model.js';

let mongoServer;

// Start in-memory replica set before all tests (replica set required for transactions)
export const setup = async () => {
  // Disconnect any lingering connection from a previous test file.
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 30000 });

  // Pre-create collections so they exist before any transaction tries to create them.
  // MongoDB cannot implicitly create a collection inside a transaction.
  await School.createCollection();
  await User.createCollection();
  await Class.createCollection();
  await Student.createCollection();
  await Attendance.createCollection();
  await Subject.createCollection();
  await Exam.createCollection();
  await Result.createCollection();
  await FeeStructure.createCollection();
  await Payment.createCollection();
  await ReportCard.createCollection();
  await AuditLog.createCollection();
  await SchoolSettings.createCollection();
  await Timetable.createCollection();
  await Book.createCollection();
  await BookLoan.createCollection();
  await TransportRoute.createCollection();
};

// Drop all collections between tests — clean slate per test file
export const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

// Disconnect and stop server after all tests
export const teardown = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongoServer.stop();
};
