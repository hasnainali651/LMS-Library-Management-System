const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const models = require('../src/models');

const policies = [
  { name: 'student', displayName: 'Student Membership', maxBooks: 3, loanDays: 14, renewalLimit: 2, finePerDay: 5, canBorrowReference: false },
  { name: 'faculty', displayName: 'Faculty Membership', maxBooks: 10, loanDays: 30, renewalLimit: 5, finePerDay: 3, canBorrowReference: true },
  { name: 'staff', displayName: 'Staff Membership', maxBooks: 5, loanDays: 21, renewalLimit: 3, finePerDay: 4, canBorrowReference: false },
  { name: 'public', displayName: 'Public Membership', maxBooks: 2, loanDays: 7, renewalLimit: 1, finePerDay: 10, canBorrowReference: false },
];

const main = async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName || !hello.isWritablePrimary) throw new Error('Bootstrap requires a writable MongoDB replica set');
  for (const model of Object.values(models)) {
    if (typeof model.createIndexes === 'function') await model.createIndexes();
  }
  for (const policy of policies) {
    const now = new Date();
    await models.MembershipType.updateOne({ name: policy.name }, { $setOnInsert: {
      ...policy, maxFinePerBook: 500, maxFineBalance: 2000, isActive: true,
      createdAt: now, updatedAt: now,
    } }, { upsert: true, runValidators: true, timestamps: false });
  }
  console.log('Required indexes and missing canonical membership policies created; existing data unchanged.');
  if (await models.User.exists({ role: 'admin' })) {
    console.log('Existing administrator retained; no account modified.');
    return;
  }
  const { BOOTSTRAP_ADMIN_NAME: name, BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_PASSWORD: password } = process.env;
  if (!name || !email || !password) {
    console.error('Onboarding incomplete: no administrator. Supply BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD through secure runtime environment, then rerun bootstrap.');
    process.exitCode = 2;
    return;
  }
  if (password.length < 12) throw new Error('Bootstrap administrator password must be at least 12 characters');
  if (await models.User.exists({ email: email.trim().toLowerCase() })) throw new Error('Bootstrap identity already exists; refusing to change its role or password');
  await models.User.create({ name, email, password, role: 'admin', membershipType: 'staff', isActive: true });
  console.log('Administrator created from explicit runtime input.');
};
main().catch((error) => {
  const known = /^(MONGO_URI|Bootstrap|Bootstrap identity)/.test(error.message);
  console.error(known ? error.message : `Bootstrap failed (${error.name || 'Error'}, code ${error.code || 'unknown'}); no destructive reset performed.`);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
