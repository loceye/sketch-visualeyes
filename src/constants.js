import generateInterjection from "interjection-js";

export const MIN_AOI_WIDTH = 10;
export const MIN_AOI_HEIGHT = 10;
export const LARGE_IMAGE_TIMEOUT = 6000;
export const API_URL = "https://api.visualeyes.design/predict/";
export const CREDITS_API_URL = "https://api.visualeyes.design/credits";
// export const API_URL = "http://192.168.1.4:8000/predict/";

function selectRandomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getRandomTip() {
  return (
    selectRandomFromArray(THINK_EMOJIS) +
    " TIP: " +
    selectRandomFromArray(USEFUL_TIPS)
  );
}

const SUCCESS_EMOJIS = ["🙌", "🚀", "🎉", "👌", "🥰", "🥳"];
const THINK_EMOJIS = ["🧠", "🤔", "💡", "🤓"];

function randomEmoji() {
  return selectRandomFromArray(SUCCESS_EMOJIS);
}

export const USEFUL_TIPS = [
  "The AOI Rectange should be placed at the top Artboard...",
  "Create Areas of Interest by drawing a Rectangle named AOI inside your Artboard...",
  "The attention is higher on the red areas...",
  "Clarity scoring based on custom demogrpahics would be available soon...",
  "A/B testing small UI tweaks is a common use case of VisualEyes..."
];

export const ON_BOARDING = {
  title: "Welcome on board",
  tips: [
    {
      title: "🔥 How to generate your Attention Heatmap:",
      steps: ["Select an Artboard ", "Run the plugin command"]
    },
    {
      title: "📦 How to create Areas of Interest:",
      steps: [
        "Create a Rectangle named AOI",
        "Select the Artboard",
        "Run the plugin command"
      ]
    }
  ],
  footer: {
    text: "🔗 Learn more about the usage of our plugin here:",
    link: "https://www.visualeyes.design/learn`,"
  }
};

export const API_ERRORS = {
  STATUS_400: "😱 We are deeply sorry, but something went terrible wrong!",
  STATUS_401: "🙅‍ Your API key is invalid",
  STATUS_402: "🌈 You should upgrade your account to access this feature",
  STATUS_403: "🚨 Your heatmaps limit has been exceeded",
  STATUS_503:
    "🚧 Our elves are working hard to update our services. VisualEyes will be online really soon!!"
};

export const AOI_ERRORS = {
  size: {
    message: `👎 One of your rectangles was not big enough (minimum ${MIN_AOI_WIDTH}x${MIN_AOI_HEIGHT} pixels)`,
    layerName: `🚨 Too small (minimum ${MIN_AOI_WIDTH}x${MIN_AOI_HEIGHT})`
  },
  placement: {
    message: `😱 One of your rectangles is outside the current Artboard.`,
    layerName: `🚨 Off the current Artboard`
  }
};

export const MESSAGES = {
  apiKeySuccess: randomEmoji() + " Your new API key has been saved.",
  apiKeyCancel: "🏃 Keep using your old API key.",
  noSelection: "🥺 You must select at least one artboard.",
  noAPIKey: "✋Please enter your VisualEyes API key first",
  success: randomEmoji() + ` ${generateInterjection()}! Your heatmap is ready!`,
  successWithAOIPrompt: `🦸‍ You can impress even more your client with Areas of Interest...`,
  onBoardingEnd: "🚢 Re-run the plugin to see the magic!",
  onBoarding: `🔥 How to generate your Attention Heatmap:\n\t1. Select an Artboard \n\t2. Run the plugin command\n\n📦 How to create Areas of Interest:\n\t1. Create a Rectangle named AOI\n\t2. Select the Artboard\n\t3. Run the plugin command\n\n🔗 Learn more about the usage of our plugin here: https://www.visualeyes.design/learn`,
  largeImage:
    "🏃‍♂️ Your image was pretty large. The prediction could take a little longer than usual."
};
