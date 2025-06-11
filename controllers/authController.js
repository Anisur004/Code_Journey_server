const catchAsync = require("../util/catchAsync");
const jwt = require("jsonwebtoken"); //token token token babe '>'
const AppError = require("../util/appError");
const {promisify} = require('util');
const sendEmail = require("../util/email");
const crypto = require("crypto");
const User = require("../model/userModel");

//returns a jwt token created using given id
const signToken = (id) => {
    return jwt.sign({id: id}, process.env.JWT_SECRET, {expiresIn: process.env.JWT_EXPIRES_IN});
}


//creates a jwt token using user's _id, put it into a cookie and send it as
const createSendToken = (user, status, res) => {
    const token = signToken(user._id);

    //hide password as we are not 'selecting' user == password is still in user object
    user.password = undefined;

    res.status(status).json({
        status: 'success', token, data: {
            user
        }
    });
}

//to sing up the user
exports.signup = catchAsync(async (req, res, next) => {
    //not simply using req.body due to security reasons
    const newUser = await User.create({
        username: req.body.username,
        email: req.body.email,
        name: req.body.name,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm
    });

    //we need a key value for email
    await sendEmail({
        email: newUser.email, subject: "Welcome to CodeJourney! 🚀", message: `
        Dear ${req.body.username || ""},

Welcome aboard! We're thrilled to have you join CodeJourney and embark on your journey to mastering coding skills.

At CodeJourney, we're committed to providing you with the tools and insights you need to excel in your coding endeavors. As a new member, you now have access to a wealth of statistical data from various coding platforms such as LeetCode, GitHub, GeeksforGeeks, and more.

Here's what you can expect from your [Website Name] experience:

1. *Comprehensive Analytics*: Gain valuable insights into your coding performance across multiple platforms. Track your progress, identify areas for improvement, and celebrate your achievements.

2. *Community Engagement*: Form groups and grow together.

4. *Regular Updates and Notifications*: Stay informed about your coding activity with timely updates and notifications. From new achievements to upcoming contests, we'll keep you in the loop so you never miss out on important opportunities.

To get started, simply log in to your account and explore all that CodeJourney has to offer. Whether you're a seasoned coder or just starting out, we're here to support you on your coding journey.

Once again, welcome to CodeJourney! We're excited to see all that you'll accomplish.

Happy coding!

Best regards,
Team CodeJourney
        `
    });

    createSendToken(newUser, 201, res);
});


exports.login = catchAsync(async (req, res, next) => {
    let {username, password} = req.body;

    //check if email and password exists => user entered these fields
    if (!username || !password) {
        return next(new AppError("Please provide username and password", 400));
    }
    username = username.toLowerCase();

    //check if user exists and password is correct
    //we have restricted the default selection of password, so we explicitly select password
    let user = await User.findOne({username}).select('+password').populate("codingPlatforms");
    if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError("Incorrect username or password!", 401));
    }
    user = {...user}._doc;

    //if all ok, send token to client
    createSendToken(user, 200, res);
});

//makes sure that user is logged in == has a valid bearer token
//if all is good, that user is added to the req
exports.protect = catchAsync(async (req, res, next,) => {
    let token;

    // check if there is a token
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError("You are not logged in! Please log in again.", 401));
    }

    // verify the token
    //verify also accepts a callback function, but we will make it return a promise
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // check if user still exists => to check the case if user has jwt token but the user was deleted!
    const freshUser = await User.findOne({_id: decoded.id});
    if (!freshUser) {
        return next(new AppError("The user belonging to this token does not exist.", 401));
    }

    // check if user changed password after jwt was issued
    if (freshUser.changePasswordAfter(decoded.iat)) {
        return next(new AppError("User recently changed their password! Please login again.", 401));
    }

    //grant access to the protected rout
    //also add this user to the request object
    req.user = freshUser;
    next();
});

//to send an email to user when he forget the password
exports.forgotPassword = catchAsync(async (req, res, next) => {
    //protected function will be called before this, so req is supposed to have user
    //get user based on posted email
    const user = await User.findOne({email: req.body.email});
    //link is the link of client page
    const link = req.body.link;
    if (!user) {
        return next(new AppError("No user with that email address.", 404));
    }
    if (!link) {
        return next(new AppError("Link to send not provided!", 400));
    }

    //generate token
    const resetToken = user.createPasswordResetToken();
    //validation is set false because few fields such as password and confirm password is not provided by the user
    //so save without validation
    await user.save({validateBeforeSave: false});

    //send it to user's email
    const resetUrl = `${link}/resetpassword/${resetToken}`;

    //todo: create a nice html to send to user on email
    const message = `Forgot password? Sumbit a patch request with your new password and passwordConfirm to:\n
     ${resetUrl}\n\nPlease ignore this message if you didn't forgot the password!.`;

    try {
        await sendEmail({
            email: user.email, subject: "Reset password token. Valid for 10 min only!", message: message
        });

        res.status(200).json({
            status: 'success', message: 'Link to change password sent to your email!'
        })
    } catch (err) {
        //if failed to send the email, set these fields to undefined
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({validateBeforeSave: false});
        return next(new AppError('There was an error sending you email! Please try again later!', 500));
    }
});

//to reset the password after user forgot it
exports.resetPassword = catchAsync(async (req, res, next) => {
    //1. get user based on token
    //we stored hashed resetToken in database, so hash the resetToken that user gave to compare
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    //get user based on the resetToken and also make sure that token is not expired yet
    const user = await User.findOne({passwordResetToken: hashedToken, passwordResetExpires: {$gt: Date.now()}});


    //2. if token is not expired and there is a user then set new password
    if (!user) return next(new AppError('Token is invalid or has expired. Please request a new one!', 400));
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save(); //pre save functions will check if password and confirm password matches

    //3. updated password changed property of user
    //done in pre('save'.... middleware in userModel

    //4. log the user in, send jwt
    createSendToken(user, 200, res);
});


//user can change his password using current password
exports.updateMyPassword = catchAsync(async (req, res, next) => {
    //1. get user from the collection
    //this is only accessible after user login => req has user object
    const user = await User.findById(req.user._id).select('+password');

    //2. check if posted password is correct
    if (!user || !(await user.correctPassword(req.body.password || "", user.password))) {
        return next(new AppError("Incorrect Incorrect!", 401));
    }

    //3. update password
    user.password = req.body.newPassword;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save(); //pre-save functions in userModel will check if password and confirm password matches

    //4. log in using new password
    createSendToken(user, 200, res);
});


//if there is a bearer token, try to add user to the req. return otherwise
exports.addUserToRequest = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    console.log(token);
    if (!token) {
        next();
        return;
    }

    // verify the token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // check if user still exists => to check the case if user has jwt token but the user was deleted!
    const freshUser = await User.findOne({_id: decoded.id});
    if (!freshUser || freshUser.changePasswordAfter(decoded.iat)) {
        next()
        return
    }
    //also add this user to the request object
    req.user = freshUser;
    next();
}
