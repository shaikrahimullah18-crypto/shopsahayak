const Notification = require('../models/Notification');

/**
 * @desc    Get all notifications
 * @route   GET /api/notifications
 * @access  Public
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount: notifications.filter((n) => !n.read).length,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark single notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Public
 */
exports.markNotificationRead = async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { id: req.params.id },
      { read: true },
      { new: true }
    );

    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, data: notif });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   POST /api/notifications/mark-all-read
 * @access  Public
 */
exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany({}, { read: true });
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};
