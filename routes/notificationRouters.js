const express = require("express");
const notificationController = require("../controllers/notoficationController");
const router = express.Router();

router.route('/').get(notificationController.getNotifications);

module.exports = router;