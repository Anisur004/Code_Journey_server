const express = require("express");
const userController = require("./../controllers/userController"); //this format, instead of using path, helps intellisense
const authController = require("./../controllers/authController");
const router = express.Router();

// get basic details about a user
router.get('/profile/:username', authController.addUserToRequest, userController.getUser); //ok
//for signing up
router.post('/signup', authController.signup); //ok
//for loging in
router.post('/login', authController.login); //ok
//if user forgot password
router.post('/forgotPassword', authController.forgotPassword); //ok
//user can reset password using link he receives in email
router.patch('/resetPassword/:token', authController.resetPassword); //ok
//user can change password using his previous password
router.patch('/updateMyPassword', authController.protect, authController.updateMyPassword); //ok
//user can delete himself
router.post('/deleteMe', authController.protect, userController.deleteMe); //ok
//to add/update a coding platform
router.post('/addCodingPlatform', authController.protect, userController.addCodingPlatform); //ok

module.exports = router;