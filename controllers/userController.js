const User = require("../model/userModel");
const CodingProfile = require("../model/codingProfileModel");
const catchAsync = require("../util/catchAsync");
const axios = require("axios");
const AppError = require("../util/appError");

exports.addCodingPlatform = catchAsync(async (req, res, next) => {
    let user = await User.findById(req.user._id).populate('codingPlatforms');

    const requestedPlatformName = req.body.platformName;
    const requestedPlatformHandler = req.body.platformHandler;

    const codingProfile = await CodingProfile.create({
        platformName: requestedPlatformName,
        platformHandler: requestedPlatformHandler,
        platformUserId: 0
    });

    // validate the user on platform
    // Ensure only one /api prefix is added
const validatingURL = `${req.protocol}://${req.get('host')}/${requestedPlatformName.toLowerCase()}/validateUser/${requestedPlatformHandler}`;

    let response;
    try {
        response = await axios.get(validatingURL);
        if (response.status !== 200) throw new Error("User does not exist!");
    } catch (e) {
        await CodingProfile.findOneAndDelete({ _id: codingProfile._id });
        return res.status(400).json({
            status: "fail",
            message: "User does not exist!"
        });
    }

    await CodingProfile.findByIdAndUpdate(codingProfile._id, {
        platformUserId: response.data.userId
    });

    let prevPlatform = -1;
    let i = -1;
    for (const cp of user.codingPlatforms) {
        i++;
        if (cp.platformName === requestedPlatformName) {
            prevPlatform = i;
            await CodingProfile.findByIdAndDelete(cp._id);
            break;
        }
    }

    if (prevPlatform !== -1) user.codingPlatforms.splice(prevPlatform, 1);

    user.codingPlatforms.push(codingProfile);
    await user.save({ validateBeforeSave: false });

    user = await User.findById(user._id).populate("codingPlatforms");

    res.status(200).json({
        status: 'success',
        message: `${requestedPlatformName} added to profile!`,
        data: user
    });
});

exports.getUser = catchAsync(async (req, res, next) => {
    const username = req.params.username;

    let user;
    if (req.user && req.user.username === username) {
        user = await User.findOne({ username }).populate("codingPlatforms");
    } else {
        user = await User.findOne({ username }).select("-email").populate("codingPlatforms");
    }

    if (!user) {
        return res.status(400).json({
            status: "fail",
            message: "No such user"
        });
    }

    return res.status(200).json({
        status: 200,
        data: { user }
    });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
    let user = await User.findById(req.user._id).select('+password');

    if (!user || !req.body.password || !(await user.correctPassword(req.body.password, user.password))) {
        return next(new AppError("Incorrect password!", 401));
    }

    for (const platform of user.codingPlatforms) {
        await CodingProfile.findByIdAndDelete(platform);
    }

    await User.findByIdAndDelete(req.user._id);

    return res.status(204).json({
        status: 'success',
        message: "User deleted!",
        data: null
    });
});
