const axios = require("axios");
const { JSDOM } = require("jsdom");
const catchAsync = require("../../util/catchAsync");

//function to get DOM node represented by the given xpath
function getElementByXpath(document, path) {
  return document.evaluate(path, document, null, 9, null).singleNodeValue;
}

//check if user with this username exists, if exists return userid if exists
exports.validateUser = catchAsync(async (req, res, next) => {
  const username = req.params.username;

  try {
    const response = await axios.get(
      `https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=${username}`
    );

    return res.status(200).json({
      status: "success",
      userId: 0,
    });
  } catch (e) {
    res.status(400).json({
      status: "fail",
      message: "no such user!",
    });
  }
});

//returns user details else than heatmap
exports.getUserDetails = catchAsync(async (req, res, next) => {
  //we will be scrapping the profile page for information
  //gfg does not have any official api
  const username = req.params.username;

  let response;
  try {
    response = await axios.get(
      `https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=${username}`
    );
  } catch (e) {
    return res.status(400).json({
      status: "fail",
      message: "no such user!",
    });
  }

  response = response.data.data;

  console.log(response);

  const handler = response.name;
  const institute = response.institute_name;
  const rank = response.institute_rank;
  const campusAmbassador = response.campus_ambassador;
  const streak = response.pod_solved_longest_streak;
  const overallCodingScore = response.score;
  const monthlyCodingScore = response.monthly_score;
  const languagesUsed = "";
  const allCount = response.total_problems_solved;
  const profileLink = "https://auth.geeksforgeeks.org/user/" + username;

  response = await axios.get(profileLink);

  const dom = new JSDOM(response.data);
  const document = dom.window.document;

  const school =
    getElementByXpath(
      document,
      "//div[starts-with(text(), 'SCHOOL')]\n"
    )?.textContent.replace(/\D/g, "") || 0;
  const basic =
    getElementByXpath(
      document,
      "//div[starts-with(text(), 'BASIC')]\n"
    )?.textContent.replace(/\D/g, "") || 0;
  const easy =
    getElementByXpath(
      document,
      "//div[starts-with(text(), 'EASY')]\n"
    )?.textContent.replace(/\D/g, "") || 0;
  const medium =
    getElementByXpath(
      document,
      "//div[starts-with(text(), 'MEDIUM')]\n"
    )?.textContent.replace(/\D/g, "") || 0;
  const hard =
    getElementByXpath(
      document,
      "//div[starts-with(text(), 'HARD')]\n"
    )?.textContent.replace(/\D/g, "") || 0;

  const submissionCount = [
    { difficulty: "All", count: allCount },
    {
      difficulty: "School",
      count: school,
    },
    { difficulty: "Basic", count: basic },
    { difficulty: "Easy", count: easy },
    {
      difficulty: "Medium",
      count: medium,
    },
    { difficulty: "Hard", count: hard },
  ];

  res.status(200).json({
    status: "success",
    data: {
      platformName: "GFG", // profileLink,
      handler,
      institute,
      rank,
      campusAmbassador,
      streak,
      overallCodingScore,
      monthlyCodingScore,
      languagesUsed,
      submissionCount,
      profileLink,
    },
  });
});

//returns the heatmap data of the user
//heatmap data is intended be sent even if year is more than current year
exports.getUserHeatmap = catchAsync(async (req, res, next) => {
  const username = req.body.username;
  let year = req.body.year;

  if (!username || !year) {
    res.status(400).json({
      status: "fail",
      message: "username or userid or year not provided",
    });
  }

  const response = await axios.post(
    "https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/",
    {
      handle: `${username}`,
      requestType: "getYearwiseUserSubmissions",
      year: `${year}`,
      month: "",
    }
  );

  const data = response.data.result;
  const newData = {};

  for (const key in data) {
    const unixTimestamp = new Date(key).getTime() / 1000; // Convert date string to Unix timestamp
    newData[unixTimestamp] = data[key];
  }

  res.status(200).json({
    status: "success",
    data: {
      platformName: "GFG",
      heatmapData: newData,
    },
  });
});
