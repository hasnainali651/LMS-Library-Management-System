(async () => {
  // 1. Login as admin
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@library.com', password: 'Admin@123456' })
  });
  const adminToken = (await loginRes.json()).data?.accessToken;
  console.log('ADMIN_LOGIN_STATUS:', loginRes.status);

  // 2. Clear Redis cache key first to test fresh call
  const Redis = require('ioredis');
  const redis = new Redis('redis://127.0.0.1:6379');
  await redis.del('analytics:dashboard');

  // 3. First call
  const res1 = await fetch('http://localhost:5000/api/v1/analytics/dashboard', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const data1 = await res1.json();
  console.log('FIRST_CALL_MSG:', data1.message);
  console.log('KPIS:', data1.data?.kpis);

  // 4. Verify Redis key exists
  const cacheVal = await redis.get('analytics:dashboard');
  console.log('REDIS_KEY_EXISTS:', !!cacheVal);

  // 5. Second call (must be cached)
  const res2 = await fetch('http://localhost:5000/api/v1/analytics/dashboard', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const data2 = await res2.json();
  console.log('SECOND_CALL_MSG:', data2.message, 'IS_CACHED:', data2.message.includes('(cached)'));

  // 6. Circulation trends
  const trendsRes = await fetch('http://localhost:5000/api/v1/analytics/circulation/trends', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const trendsData = await trendsRes.json();
  const trends = trendsData.data || [];
  console.log('TRENDS_DAYS_COUNT:', trends.length, 'TODAY_ISSUED:', trends[trends.length - 1]?.issued, 'TODAY_RETURNED:', trends[trends.length - 1]?.returned);

  await redis.quit();
  process.exit(0);
})().catch(err => {
  console.error('FLOW6_ERR:', err);
  process.exit(1);
});
