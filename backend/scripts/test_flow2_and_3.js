(async () => {
  const mongoose = require('mongoose');
  await mongoose.connect('mongodb://127.0.0.1:27018/lms_db?replicaSet=rs0');

  // 1. Login as librarian
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sarah.librarian@library.com', password: 'Librarian@123456' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  console.log('LIBRARIAN_LOGIN:', loginRes.status, 'ROLE:', loginData.data?.user?.role);

  // 2. Search member
  const memberRes = await fetch('http://localhost:5000/api/v1/members?search=student', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const memberData = await memberRes.json();
  const members = memberData.data?.docs || memberData.data || [];
  const member = members[0];
  console.log('MEMBER_FOUND:', member?.name, 'ID:', member?._id, 'fineBalance:', member?.fineBalance);

  // 3. Search book
  const bookRes = await fetch('http://localhost:5000/api/v1/books?limit=1', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const bookData = await bookRes.json();
  const book = (bookData.data?.docs || bookData.data || [])[0];
  const initialAvailable = book.availableCopies;
  console.log('BOOK_FOUND:', book?.title, 'INITIAL_AVAILABLE:', initialAvailable);

  // 4. Issue book
  const issueRes = await fetch('http://localhost:5000/api/v1/circulation/issue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ memberId: member._id, bookId: book._id })
  });
  const issueData = await issueRes.json();
  console.log('ISSUE_STATUS:', issueRes.status, 'TX_ID:', issueData.data?._id);

  const txId = issueData.data?._id;
  const dbTx = await mongoose.connection.collection('transactions').findOne({ _id: new mongoose.Types.ObjectId(txId) });
  console.log('TX_IN_DB:', !!dbTx, 'STATUS:', dbTx?.status);

  const copyAfterIssue = await mongoose.connection.collection('copies').findOne({ _id: dbTx.copy });
  console.log('COPY_STATUS_AFTER_ISSUE:', copyAfterIssue?.status);

  const bookAfterIssue = await mongoose.connection.collection('books').findOne({ _id: new mongoose.Types.ObjectId(book._id) });
  console.log('BOOK_AVAILABLE_AFTER_ISSUE:', bookAfterIssue?.availableCopies, 'DECREMENTED:', bookAfterIssue?.availableCopies === initialAvailable - 1);

  // 5. Flow 3: Return with overdue fine
  // Set dueDate to 5 days ago
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
  await mongoose.connection.collection('transactions').updateOne(
    { _id: new mongoose.Types.ObjectId(txId) },
    { $set: { dueDate: fiveDaysAgo } }
  );

  const returnRes = await fetch('http://localhost:5000/api/v1/circulation/return', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ transactionId: txId, condition: 'good' })
  });
  const returnData = await returnRes.json();
  console.log('RETURN_STATUS:', returnRes.status, 'FINE_ADDED:', returnData.data?.fineAdded);

  const dbFine = await mongoose.connection.collection('fines').findOne({ transaction: new mongoose.Types.ObjectId(txId), type: 'overdue' });
  console.log('FINE_DOC_EXISTS:', !!dbFine, 'AMOUNT:', dbFine?.amount);

  const memberAfterFine = await mongoose.connection.collection('users').findOne({ _id: new mongoose.Types.ObjectId(member._id) });
  console.log('MEMBER_FINE_BALANCE:', memberAfterFine?.fineBalance);

  const copyAfterReturn = await mongoose.connection.collection('copies').findOne({ _id: dbTx.copy });
  console.log('COPY_STATUS_AFTER_RETURN:', copyAfterReturn?.status);

  const bookAfterReturn = await mongoose.connection.collection('books').findOne({ _id: new mongoose.Types.ObjectId(book._id) });
  console.log('BOOK_AVAILABLE_AFTER_RETURN:', bookAfterReturn?.availableCopies, 'RESTORED:', bookAfterReturn?.availableCopies === initialAvailable);

  process.exit(0);
})().catch(err => {
  console.error('FLOW2_3_ERR:', err);
  process.exit(1);
});
