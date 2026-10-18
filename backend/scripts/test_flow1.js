(async () => {
  const mongoose = require('mongoose');
  await mongoose.connect('mongodb://127.0.0.1:27018/lms_db?replicaSet=rs0');
  const user = await mongoose.connection.collection('users').findOne({ email: 'flowtest@example.com' });
  console.log('USER_IN_DB:', !!user, 'isEmailVerified:', user?.isEmailVerified);

  // Set known token
  const crypto = require('crypto');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await mongoose.connection.collection('users').updateOne(
    { _id: user._id },
    { $set: { emailVerifyToken: hash, emailVerifyExpires: new Date(Date.now() + 86400000) } }
  );

  const verifyRes = await fetch('http://localhost:5000/api/v1/auth/verify-email/' + rawToken, { method: 'POST' });
  const verifyData = await verifyRes.json();
  console.log('VERIFY_STATUS:', verifyRes.status, verifyData.message);

  const updatedUser = await mongoose.connection.collection('users').findOne({ email: 'flowtest@example.com' });
  console.log('AFTER_VERIFY_IS_EMAIL_VERIFIED:', updatedUser?.isEmailVerified);

  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'flowtest@example.com', password: 'Password@1234' })
  });
  const loginData = await loginRes.json();
  console.log('LOGIN_STATUS:', loginRes.status, 'ROLE:', loginData.data?.user?.role, 'HAS_TOKEN:', !!loginData.data?.accessToken);
  process.exit(0);
})().catch(err => {
  console.error('FLOW1_ERR:', err);
  process.exit(1);
});
