const crypto = require("crypto");
const mongoose = require("mongoose");
const validator = require("validator"); //provides various schema validators
const bcryptjs = require("bcryptjs");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        lowercase: true,
        required: [true, "A user must have a username"],
        unique: true,
        minLength: [3, "username too short(min=3)!"], //axv has length 3, dont change
        maxLength: [15, "username too long(max=15)!"],
    },
    email: {
        type: String,
        unique: true,
        lowercase: true,
        required: [true, "Email is must!"],
        validate: [validator.isEmail, "Please provide a valid email!"],
    },
    name: {
        type: String,
        required: [true, "A user must have a username"],
        minLength: [5, "name too short(min=5)!"],
        maxLength: [15, "name too long(max=15)!"],
    },
    profilePhoto: String,
    password: {
        type: String,
        required: [true, "Please create a password!"],
        minlength: 8,
        select: false, //do not select this ever
    },
    passwordConfirm: {
        type: String,
        required: [true, "Please confirm the password!"],
        validate: {
            // This work on SAVE!!
            validator: function (el) {
                return el === this.password;
            },
            message: "Passwords are not the same!",
        },
    },
    passwordChangedAt: {
        type: Date,
    },
    passwordResetToken: String,
    passwordResetExpires: Number,
    active: Boolean,
    codingPlatforms: [
        {
            type: mongoose.Schema.ObjectId,
            ref: "CodingPlatform",
        },
    ],
});

//before saving, encrypt the password and remove confirm password
userSchema.pre("save", async function (next) {
    // no need to do this every time, do only when password in modified
    if (!this.isModified("password")) return next();
    //encrypt the password
    this.password = await bcryptjs.hash(this.password, 12);
    this.passwordConfirm = undefined; //don't save this in the database
    next();
});

//method to check the password
userSchema.methods.correctPassword = async function (
    candidatePassword,
    userPassword
) {
    return await bcryptjs.compare(candidatePassword, userPassword);
};

//returns true if token was created BEFORE change in password
userSchema.methods.changePasswordAfter = function (JWTTimeStamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(
            `${this.passwordChangedAt.getTime() / 1000}`,
            10
        );
        return JWTTimeStamp < changedTimestamp;
    }
    return false;
};

//modify passwordChangedAt when password is changed
userSchema.pre("save", function (next) {
    if (!this.isModified("password") || this.isNew) return next();
    //sometimes saving to database is slow
    // , so ... decreasing 10 second so it not to create any problem while loging in using token
    this.passwordChangedAt = Date.now() - 10000;
    next();
});

//hide inactive users: these users are deleted
userSchema.pre(/^find/, function (next) {
    //this points to current query
    this.find({active: {$ne: false}});
    next();
});

//creates a reset password token to
userSchema.methods.createPasswordResetToken = function () {
    //we cant simply store resetToken as it is into the database due to security issues
    const resetToken = crypto.randomBytes(32).toString("hex");

    //we will store the hashed token instead
    //we will send this original resetToken to user on email
    //when user will give us this token, we will hash this token and compare it with the one stored in the database

    //the next line will update the resetToken
    this.passwordResetToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; //valid for 10 minutes

    //we have not 'saved' this user document yet, that will be done in the resetPassword function
    //that is supposed to call createPasswordResetToken
    return resetToken;
};

const User = mongoose.model("User", userSchema);
module.exports = User;
