(async () => {
  const mongoose = require('mongoose');
  await mongoose.connect('mongodb://127.0.0.1:27018/lms_db?replicaSet=rs0');

  // Login librarian
  const libLogin = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sarah.librarian@library.com', password: 'Librarian@123456' })
  });
  const libToken = (await libLogin.json()).data?.accessToken;

  // GET /api/v1/fines
  const finesRes = await fetch('http://localhost:5000/api/v1/fines', {
    headers: { Authorization: `Bearer ${libToken}` }
  });
  const finesData = await finesRes.json();
  const finesList = finesData.data?.docs || finesData.data || [];
  console.log('FINES_COUNT:', finesList.length);

  const pendingFine = finesList.find(f => (f.amount - (f.paidAmount || 0)) > 0);
  if (!pendingFine) {
    console.log('No pending fine to collect!');
    process.exit(0);
  }
  console.log('PENDING_FINE_FOUND:', pendingFine._id, 'AMOUNT:', pendingFine.amount, 'MEMBER:', pendingFine.member?.name);

  const memberBefore = await mongoose.connection.collection('users').findOne({ _id: new mongoose.Types.ObjectId(pendingFine.member._id || pendingFine.member) });
  const balanceBefore = memberBefore.fineBalance;
  console.log('MEMBER_BALANCE_BEFORE:', balanceBefore);

  // POST /api/v1/fines/collect
  const collectRes = await fetch('http://localhost:5000/api/v1/fines/collect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${libToken}`
    },
    body: JSON.stringify({
      fineIds: [pendingFine._id],
      amount: pendingFine.amount - (pendingFine.paidAmount || 0),
      paymentMethod: 'cash'
    })
  });
  const collectData = await collectRes.json();
  console.log('COLLECT_STATUS:', collectRes.status, 'RECEIPT:', collectData.data?.receiptNumber, 'MSG:', collectData.message);

  const memberAfter = await mongoose.connection.collection('users').findOne({ _id: new mongoose.Types.ObjectId(pendingFine.member._id || pendingFine.member) });
  console.log('MEMBER_BALANCE_AFTER:', memberAfter.fineBalance, 'DECREMENTED:', memberAfter.fineBalance === balanceBefore - (pendingFine.amount - (pendingFine.paidAmount || 0)));

  const fineAfter = await mongoose.connection.collection('fines').findOne({ _id: new mongoose.Types.ObjectId(pendingFine._id) });
  console.log('FINE_STATUS_AFTER:', fineAfter.status, 'PAID_AMOUNT:', fineAfter.paidAmount);

  process.exit(0);
})().catch(err => {
  console.error('FLOW5_ERR:', err);
  process.exit(1);
});
