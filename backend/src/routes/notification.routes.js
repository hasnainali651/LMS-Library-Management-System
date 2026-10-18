const express = require('express');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notification.controller');

const { protect } = require('../middleware/auth');

const router = express.Router();

// All notification endpoints are protected
router.use(protect);

// 1. Static endpoints (mounted before parameter routes)
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);

// 2. Parameterized endpoints
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
