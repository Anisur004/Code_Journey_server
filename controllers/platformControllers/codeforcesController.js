const axios = require('axios');
const catchAsync = require("../../util/catchAsync");
const {JSDOM} = require("jsdom");


//function to get DOM node represented by the given xpath
function getElementByXpath(document, path) {
    return document.evaluate(path, document, null, 9, null).singleNodeValue;
}

//check if user with this username exists, if exists return userid if exists
exports.validateUser = catchAsync(async (req, res, next) => {
    const username = req.params.username;
    const response = await axios.get(`https://codeforces.com/api/user.info?handles=${username}`);

    //if there is no such user, we will be redirected. if we are redirected => there is no user
    if (response.status==='FAILED') {
        res.status(400).json({
            status: "fail", message: "no such user!"
        });
        return;
    }

    res.status(200).json({
        status: "success"
    });

});

//function to return user info else than heatmap
exports.getUserDetails = catchAsync(async (req, res, next) => {
    //codeforces has an official api to retrieve user data, but the data returned is very limited
    //for example we don't have endpoint to retrieve the streak or total questions submission
    //will be web scraping
    const username = req.params.username;
    const profileLink = `https://codeforces.com/profile/${username}`;
    const requestOptions = {
        method: "GET",
        redirect: "follow"
      };
    const r = await fetch(profileLink, requestOptions);
    const response = await r.text();
    const dom = new JSDOM(response);
    const document = dom.window.document;

    //todo: read the response to determine if there are no such user, or validate the user using validateUser function
    //if there is no such user, we will be redirected. if we are redirected => there is no user
    // if (response.request._redirectable._redirectCount) {
    //     res.status(400).json({
    //         status: "fail", message: "no such user!"
    //     });
    //     return;
    // }

    const handler = getElementByXpath(document, "//*[@id=\"pageContent\"]/div[2]/div/div[2]/div/h1/a").textContent;

    let rank = getElementByXpath(document, "//*[@id=\"pageContent\"]/div[2]/div/div[2]/ul/li[1]").textContent;
    const regex = /Contest rating:\s+(\d+)/s;
    const match = rank.match(regex);
    rank = match ? match[1] : 0;

    const streak = getElementByXpath(document, "//*[@id=\"pageContent\"]/div[4]/div/div[3]/div[2]/div[1]/div[1]").textContent.replace(/\D/g, "") || 0;
    const submissionCount = [{
        difficulty: "All",
        count: getElementByXpath(document, "//*[@id=\"pageContent\"]/div[4]/div/div[3]/div[1]/div[1]/div[1]").textContent.replace(/\D/g, "") || 0
    }];

    res.status(200).json({
        status: 'success', data: {
            platformName: "CODEFORCES", profileLink, handler, rank, streak, submissionCount
        }
    })
});

//function to return heatmap data of the user
exports.getUserHeatmap = catchAsync(async (req, res, next) => {
    const username = req.body.username;
    const year = req.body.year;

    if (!username || !year) res.status(400).json({
        status: "fail", message: "username or year not provided!"
    });

    let response;
    try {
        response = await axios.get(`https://codeforces.com/api/user.status?handle=${username}&from=1&count=99999999`)
    } catch (e) {
        res.status(400).json({
            status: "fail", message: "user not found!"
        });
    }

    const heatmapRaw = response.data.result.filter(submission => submission.verdict === 'OK').map(submission => submission.creationTimeSeconds);
    // console.log(heatmapRaw);

    const filteredMap = new Map();
    heatmapRaw.forEach((timestamp) => {
        const date = new Date(timestamp * 1000); // Convert Unix timestamp to milliseconds
        if (date.getFullYear() === year) {
            date.setHours(0, 0, 0, 0);
            const key = date.getTime(); // Get the Unix timestamp for the start of the day
            filteredMap.set(key, (filteredMap.get(key) || 0) + 1);
        }
    });

    const heatmap = {};
    for (const [time, count] of filteredMap) {
        heatmap[time / 1000] = count;
    }

    res.status(200).json({
        status: "success", data: {
            platformName: "CODEFORCES",
            heatmapData: heatmap
        }
    });
});
