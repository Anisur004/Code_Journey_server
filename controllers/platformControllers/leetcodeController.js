const axios = require('axios');
const catchAsync = require("../../util/catchAsync");

//function to make graphQl request for leetcode graphql
async function getLeetcodeGraphqlResponse(query, variables) {
    let data = JSON.stringify({
        query: query, variables: variables
    });

    let config = {
        method: 'post', url: 'https://leetcode.com/graphql/', headers: {'Content-Type': 'application/json',}, data: data
    };

    return axios(config);
}


//check if user with this username exists, no need to return user id :)
exports.validateUser = catchAsync(async (req, res, next) => {
    const username = req.params.username;

    const query = `
        query userPublicProfile($username: String!, $year: Int ) {
          matchedUser(username: $username) {
            profile {
              ranking
              userAvatar
            }
            submitStatsGlobal {
                acSubmissionNum {
                    difficulty
                    count
                }
            }
            userCalendar(year: $year) {
              streak
            }
            
          }
        }
    `;
    const response = await getLeetcodeGraphqlResponse(query, {username});

    if (!response.data.data.matchedUser) {
        res.status(400).json({
            status: "fail", message: "No such user found!"
        });
        return;
    }

    res.status(200).json({
        status: "success"
    });
});


//returns user details else than heatmap
exports.getUserDetails = catchAsync(async (req, res, next) => {
    //we will be using graphql to retrieve user details from leetcode
    //leetcode does not have official api
    const username = req.params.username;
    const query = `
        query userPublicProfile($username: String!, $year: Int ) {
          matchedUser(username: $username) {
            profile {
              ranking
              userAvatar
            }
            submitStatsGlobal {
                acSubmissionNum {
                    difficulty
                    count
                }
            }
            userCalendar(year: $year) {
              streak
            }
            languageProblemCount {
              languageName
            }
          }
        }
    `;
    const response = await getLeetcodeGraphqlResponse(query, {username});

    if (!response.data.data.matchedUser) {
        res.status(400).json({
            status: "fail", message: "No such user found!"
        })
    }

    const handler = response.data.data.matchedUser ? username : "";
    const rank = response.data.data.matchedUser?.profile?.ranking || 0;
    const streak = response.data.data.matchedUser?.userCalendar?.streak || 0;
    const languagesUsed = response.data.data.matchedUser?.languageProblemCount.map(language => language.languageName) || [];
    const submissionCount = response.data.data.matchedUser?.submitStatsGlobal?.acSubmissionNum || [];

    res.status(200).json({
        status: "success", data: {
            platformName:"LEETCODE",
            profileLink: `https://leetcode.com/${username}/`, handler, rank, streak, languagesUsed, submissionCount
        }
    });
});


//returns the heatmap data of the user
exports.getUserHeatmap = catchAsync(async (req, res, next) => {
    const username = req.body.username;
    let year = req.body.year;

    if (!username || !year) {
        res.status(400).json({
            status: "fail", message: "username or year not provided"
        });
    }

    const query = `
    query userProfileCalendar($username: String!, $year: Int) {
      matchedUser(username: $username) {
        userCalendar(year: $year) {
          submissionCalendar
        }
      }
    }
    `;

    const response = await getLeetcodeGraphqlResponse(query, {username, year});
    console.log(response.data.data);
    if (!response.data.data.matchedUser) {
        res.status(400).json({
            status: "fail", message: response.data.errors[0].message
        });
    }

    const heatmapData = JSON.parse(response.data.data?.matchedUser?.userCalendar?.submissionCalendar) || [];

    res.status(200).json({
        status: "success", data: {
            platformName:"LEETCODE",
            heatmapData
        }
    });
});