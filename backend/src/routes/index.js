const express = require('express');
const authRoutes = require('./auth.routes');
const bookRoutes = require('./book.routes');
const userRoutes = require('./user.routes');
const memberRoutes = require('./member.routes');
const membershipTypeRoutes = require('./membershipType.routes');
const circulationRoutes = require('./circulation.routes');
const fineRoutes = require('./fine.routes');
const reservationRoutes = require('./reservation.routes');
const notificationRoutes = require('./notification.routes');
const searchRoutes = require('./search.routes');
const aiRoutes = require('./ai.routes');
const analyticsRoutes = require('./analytics.routes');
const { getPublicSettings, getSystemStatus, getReadiness } = require('../controllers/system.controller');
const { protect } = require('../middleware/auth');
const { isAdmin } = require('../middleware/roles');

const router = express.Router();

const { getAuditLogs } = require('../controllers/auditLog.controller');

router.get('/health', getReadiness);

router.get('/settings/public', getPublicSettings);
router.get('/admin/system', protect, isAdmin, getSystemStatus);
router.get('/audit-logs', protect, isAdmin, getAuditLogs);

router.use('/auth', authRoutes);
router.use('/books', bookRoutes);
router.use('/users', userRoutes);
router.use('/members', memberRoutes);
router.use('/membership-types', membershipTypeRoutes);
router.use('/circulation', circulationRoutes);
router.use('/fines', fineRoutes);
router.use('/reservations', reservationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/search', searchRoutes);
router.use('/ai', aiRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
