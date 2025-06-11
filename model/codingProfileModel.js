const mongoose = require("mongoose");

const codingPlatform = new mongoose.Schema({
    platformName: {
        type: String,
        enum: {values: ['GFG', 'LEETCODE', 'CODEFORCES'], message: "This platform is not supported"},
        required: [true, "Platform must have a name!"],
        minLength: [2, "min length is 2"]
    }, platformHandler: {
        type: String, lowercase: true, required: [true, "must have a handler!"], minLength: [2, "min length is 2"]
    }, platformUserId: {
        type: String
    }
})

const CodingPlatform = mongoose.model('CodingPlatform', codingPlatform);
module.exports = CodingPlatform;

