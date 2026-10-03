const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markNotificationRead,
  markAllRead
} = require('../controllers/notificationController');

router.get('/', getNotifications);
router.patch('/:id/read', markNotificationRead);
router.post('/mark-all-read', markAllRead);

module.exports = router;
