import sketch, { UI } from "sketch";
import setApiKey from "./set-api-key";
import { MESSAGES, CREDITS_API_URL } from "./constants";

function getApiKey() {
  // Check if user's api Key is stored
  // https://developer.sketch.com/reference/api/#set-a-plugin-setting
  const apiKey = sketch.Settings.settingForKey("api-key");

  if (!apiKey) {
    // It's the 1st time of the this user
    sketch.Settings.setSettingForKey("first-time", true);
    // If the user do not have an API key, then we should create and save one
    try {
      return setApiKey();
    } catch (e) {}
  } else {
    // The user's api key is saved, now we can resolve the promise
    return Promise.resolve(apiKey);
  }
}

function handleError(status) {
  if (status === 400) {
    UI.alert(
      "😱 Oops!",
      "We are deeply sorry, but something went terrible wrong!"
    );
  } else if (status === 401) {
    UI.alert(
      "😓Invalid API key",
      'If you have a valid API key, you can set it at:\n "Plugins / 🔥 Visualeyes / Set your API key".\n\nYou can claim a valid token at <a>https://www.visualeyes.design</a>'
    );
  } else if (status === 402) {
    UI.alert(
      "🛫 Upgrade your Account",
      "In order to access this feature you need to upgrade your account at https://www.visualeyes.design"
    );
  } else if (status === 403) {
    UI.alert("🚨 Request Limit", "Your heatmaps limit has been exceeded");
  } else if (status === 503) {
    UI.alert(
      "🚧 Unde Maintenance",
      "Our elves are working hard to update our services. VisualEyes will be online really soon!!"
    );
  } else {
    UI.alert(
      "😱 Oops!",
      "We are deeply sorry, but something went terrible wrong!"
    );
  }
}

function getCredits(url, apiKey) {
  fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "cache-control": "no-cache"
    }
  })
    .then(res => {
      const { status } = res;
      try {
        if (status === 200) {
          return res.json();
        } else {
          handleError(status);
          throw new Error("API request status error");
        }
      } finally {
      }
    })
    .then(json => {
      UI.message(`🎉 You have ${json.credits} credits left.`);
    })
    .catch(err => {
      console.log(JSON.stringify(err));
    });
}

export default function() {
  getApiKey().then(apiKey => {
    if (!apiKey) {
      sketch.UI.message(MESSAGES.noAPIKey);
      return;
    }

    getCredits(CREDITS_API_URL, apiKey);
  });
}
