const { Notification } = require('../models');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /
 * Protected: Paginated in-app notifications, newest first
 */
const getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, isRead, type } = req.query;

  const query = { user: req.user._id };
  if (isRead !== undefined) {
    query.isRead = isRead === 'true' || isRead === true;
  }
  if (type) {
    query.type = type;
  }

  const options = {
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
    sort: { createdAt: -1 },
    lean: true,
  };

  const notifications = await Notification.paginate(query, options);

  return res.status(200).json(
    new ApiResponse(200, notifications, 'Notifications retrieved successfully.')
  );
});

/**
 * GET /unread-count
 * Protected: Real-time count of unread notifications for current member
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    user: req.user._id,
    isRead: false,
  });

  return res.status(200).json(
    new ApiResponse(200, { unreadCount: count }, 'Unread count retrieved.')
  );
});

/**
 * PATCH /:id/read
 * Protected: Mark single notification as read (verifies ownership)
 */
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);
  if (!notification) {
    throw new ApiError(404, 'Notification record not found.');
  }

  if (notification.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not authorized to modify this notification.');
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return res.status(200).json(
    new ApiResponse(200, notification, 'Notification marked as read.')
  );
});

/**
 * PATCH /read-all
 * Protected: Mark all unread notifications for member as read
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const now = new Date();
  const result = await Notification.updateMany(
    {
      user: req.user._id,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt: now,
      },
    }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { modifiedCount: result.modifiedCount },
      'All notifications marked as read.'
    )
  );
});

/**
 * DELETE /:id
 * Protected: Delete own notification
 */
const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findById(id);
  if (!notification) {
    throw new ApiError(404, 'Notification record not found.');
  }

  if (notification.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You are not authorized to delete this notification.');
  }

  await Notification.findByIdAndDelete(id);

  return res.status(200).json(
    new ApiResponse(200, null, 'Notification deleted successfully.')
  );
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
