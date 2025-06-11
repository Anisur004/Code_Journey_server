const express = require("express");
const codeforcesController = require("../controllers/platformControllers/codeforcesController");
const router = express.Router();

router.route('/validateuser/:username').get(codeforcesController.validateUser);
router.route('/userdetails/:username').get(codeforcesController.getUserDetails);
router.route('/userheatmap').post(codeforcesController.getUserHeatmap);

module.exports = router;