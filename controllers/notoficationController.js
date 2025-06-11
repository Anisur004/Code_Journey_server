const axios = require('axios');
const catchAsync = require("../util/catchAsync");
const {JSDOM} = require("jsdom");

// function to convert unix time stamps to IST
function getIST(unixTimestamp) {
    const unixTimestampMs = unixTimestamp * 1000;
    const date = new Date(unixTimestampMs);
    return date.toLocaleString('en-US', {timeZone: 'Asia/Kolkata'});
}

//function to return the difference between timing in minutes
function getDuration(startTimeStr, endTimeStr) {
    const startTime = new Date(startTimeStr);
    const endTime = new Date(endTimeStr);
    const timeDifferenceMs = endTime - startTime;
    return timeDifferenceMs / (1000 * 60);
}


function getNextOrCurrentDateForWeekday(inputWeekday,) {
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const today = new Date();
    const currentWeekday = today.getDay();
    const inputWeekdayIndex = weekdays.indexOf(inputWeekday);
    const daysUntilNextWeekday = (inputWeekdayIndex + 7 - currentWeekday) % 7;
    const nextOrCurrentDate = new Date(today);
    nextOrCurrentDate.setDate(today.getDate() + daysUntilNextWeekday);
    return nextOrCurrentDate;
}


//function to return the element node represented by this xpath
function getElementByXpath(document, path) {
    return document.evaluate(path, document, null, 9, null).singleNodeValue;
}

//function that will return notifications from all the platforms
exports.getNotifications = catchAsync(async (req, res, next) => {

    let response = {};

    // get from codeforces
    let codeforces = [];
    try {
        response = await axios.get("https://codeforces.com/api/contest.list?gym=false");
        const codeforcesRaw = response.data.result?.filter(contest => contest.phase === 'BEFORE');
        codeforces = codeforcesRaw.map(contest => {
            return {
                title: contest.name, start: getIST(contest.startTimeSeconds), duration: contest.durationSeconds / 60, //to minutes
                link: "https://codeforces.com/contests/"
            }
        });
    } catch (e) {
        //pass
    }


    response = {};
    let gfg = [];
    try {
        response = await axios.get("https://practiceapi.geeksforgeeks.org/api/vr/events/?sub_type=upcoming&type=contest");
        gfg = response.data.results?.upcoming?.map(contest => {
            return {
                title: contest.name,
                start: new Date(contest.start_time),
                duration: getDuration(contest.start_time, contest.end_time),
                link: "https://www.geeksforgeeks.org/events"
            }
        });
    } catch (e) {
        //pass
    }

    response = {};
    let error = null;
    let leetcode = [];
    try {
        response = await axios.get(`https://leetcode.com/contest/`, {
            headers: {
                'User-Agent': 'Mozilla/5.0', 'Connection': 'keep-alive', 'Content-Type': 'application/json'
            }
        });
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        const contestDiv = getElementByXpath(document, "//*[@id=\"__next\"]/div[1]/div[4]/div/div/div[2]/div/div/div[1]/div/div");

        for (const contestElement of contestDiv.childNodes) {
            const title = contestElement.querySelector("span").textContent;
            const dateRaw = contestElement.textContent.replace(title, "");
            const weekday = dateRaw.split(" ")[0];
            const nextCurDate = getNextOrCurrentDateForWeekday(weekday.toLowerCase());
            const date = nextCurDate.getFullYear() + "-" + (nextCurDate.getMonth() + 1) + "-" + nextCurDate.getDate();
            leetcode.push({
                title,
                start: new Date(date + dateRaw.replace(weekday, "")),
                duration: null,
                link: 'https://leetcode.com/' + contestElement.querySelector("a").getAttribute("href")
            });
        }
    } catch (e) {
        error = e
    }


    res.status(200).json({
        status: "success", data: {
            codeforces, gfg, leetcode, error
        }
    })


});

