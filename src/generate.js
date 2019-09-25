import sketch, { UI } from "sketch";
import setApiKey from "./set-api-key";
import generateInterjection from "interjection-js";

const MIN_AOI_WIDTH = 70;
const MIN_AOI_HEIGHT = 32;
const USEFUL_TIPS = [
  "Create Areas of Interest by drawing a Rectangle named AOI inside your Artboard...",
  "The attention is higher on the red areas...",
  "Clarity scoring based on custom demogrpahics would be available soon...",
  "A/B testing small UI tweaks is a common use case of VisualEyes..."
];

const getDemoSVG = (url, width, height) => `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image xlink:href="${url}" width="${width}" height="${height}"/>
  <g>
    <rect x="10" y="10" width="200" height="200" style="fill: rgba(38,166,154,0.3); stroke-width:4; stroke: rgba(38,166,154,1)" />
    <rect x="10" y="10" width="70" height="32" style="fill: rgba(38,166,154,1);" />
    <text x="20" y="32" style="text-align: center; font-family: sans-serif; font-weight: bold; font-size: 18px; fill: white">100%</text>
  </g>
  <g>
    <rect x="50" y="50" width="200" height="200" style="fill: rgba(239,83,80,0.3); stroke-width:4; stroke: rgba(239,83,80,1)" />
    <rect x="50" y="50" width="70" height="32" style="fill: rgba(239,83,80,1);" />
    <text x="60" y="72" style="text-align: center; font-family: sans-serif; font-weight: bold; font-size: 18px; fill: white">100%</text>
  </g>
</svg>
`;

function getRandomTip() {
  return (
    "🧠 TIP: " + USEFUL_TIPS[Math.floor(Math.random() * USEFUL_TIPS.length)]
  );
}

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

function onBoardingAlert() {
  sketch.UI.alert(
    "Welcome on board",
    `🔥 How to generate your Attention Heatmap:\n\t1. Select an Artboard \n\t2. Run the plugin command\n\n📦 How to create Areas of Interest:\n\t1. Create a Rectangle named AOI\n\t2. Select the Artboard\n\t3. Run the plugin command\n\n🔗 Learn more about the usage of our plugin here: https://www.visualeyes.design/learn`,
    "Let's start"
  );
  sketch.Settings.setSettingForKey("first-time", false);
}

function artboardToBase64(artboard) {
  // Set up the Artboard options for the temporary export
  // NSTemporatyDirectory is a Cocoa Function
  // https://developer.apple.com/documentation/foundation/1409211-nstemporarydirectory
  const exportPath = NSTemporaryDirectory() + `VisualEyes/Heatmaps/`;
  const options = {
    formats: "jpg",
    output: exportPath,
    compression: 0.7,
    "use-id-for-name": true
  };

  // Save the image temporary
  sketch.export(artboard, options);
  const url = NSURL.fileURLWithPath(exportPath + "/" + artboard.id + ".jpg"),
    bitmap = NSData.alloc().initWithContentsOfURL(url),
    base64 = bitmap.base64EncodedStringWithOptions(0);

  // Remove the image from the temp folder
  NSFileManager.defaultManager().removeItemAtURL_error(url, nil);

  return base64;
}

function createLayerFromSvg(svg) {
  const svgString = NSString.stringWithString(svg);
  const svgData = svgString.dataUsingEncoding(NSUTF8StringEncoding);
  const svgImporter = MSSVGImporter.svgImporter();
  svgImporter.prepareToImportFromData(svgData);
  const svgLayer = svgImporter.importAsLayer();
  svgLayer.setName("SVG Layer");
  return svgLayer;
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

function sendImage(url, body, apiKey, artboard) {
  fetch(url, {
    method: "POST",
    body,
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
      try {
        if (json.code !== "success") {
          throw new Error("Error during API response deconstruction");
        }
      } finally {
      }

      console.log(json);

      const svg = json.svg;
      const { width, height } = artboard.frame;
      // const svg = getDemoSVG(json.url, width, height);
      drawSVGToArtboard(svg, artboard);

      UI.message(`🎉 ${generateInterjection()}! Your heatmap is ready!`);
    })
    .catch(err => {
      console.log(JSON.stringify(err));
    });
}

function drawSVGToArtboard(svg, artboard) {
  const { width, height } = artboard.frame;

  const svgLayer = createLayerFromSvg(svg, width, height);
  const layers = svgLayer.ungroup();

  new sketch.Group({
    name: `🔥 VisualEyes Layer`,
    layers,
    parent: artboard
  });
}

function getAOIRectangles(artboard) {
  const rectangles = artboard.layers
    .filter(layer => {
      const isRectangle =
        layer.type === "ShapePath" &&
        layer.shapeType === "Rectangle" &&
        layer.name === "AOI";

      if (isRectangle) {
        const { x, y, width, height } = layer.frame;
        const maxWidth = artboard.frame.width;
        const maxHeight = artboard.frame.height;

        const isInsideArtboard =
          x >= 0 && y >= 0 && x + width <= maxWidth && y + height <= maxHeight;

        const isSmall = width < MIN_AOI_WIDTH || height < MIN_AOI_HEIGHT;

        if (isSmall) {
          UI.message(
            `👎 One of your rectangles was not big enough (minimum ${MIN_AOI_WIDTH}x${MIN_AOI_HEIGHT} pixels)`
          );
          layer.hidden = true;
          layer.name = `🚨 Too small (minimum ${MIN_AOI_WIDTH}x${MIN_AOI_HEIGHT})`;
        } else if (!isInsideArtboard) {
          UI.message(
            "😱 One of your rectangles is outside the current Artboard."
          );
          layer.hidden = true;
          layer.name = "🚨 Off the current Artboard";
        }

        layer.hidden = true;

        return isInsideArtboard && !isSmall;
      } else {
        return false;
      }
    })
    .map((rect, index) => ({
      id: rect.id,
      frame: rect.frame
    }));

  return rectangles;
}

function getAOI(rectangles) {
  const aoi = rectangles.map(rect => {
    const { frame, id } = rect;
    return {
      id,
      points: [
        { x: frame.x, y: frame.y, index: 0 },
        { x: frame.x + frame.width, y: frame.y, index: 1 },
        {
          x: frame.x + frame.width,
          y: frame.y + frame.height,
          index: 2
        },
        { x: frame.x, y: frame.y + frame.height, index: 3 }
      ]
    };
  });
  return JSON.stringify(aoi);
}

export default function() {
  const document = sketch.getSelectedDocument();

  if (!document) {
    return;
  }

  getApiKey().then(apiKey => {
    const hasOnboarding = sketch.Settings.settingForKey("first-time");
    if (hasOnboarding) {
      onBoardingAlert();
    }

    const selection = document.selectedLayers;

    // Detect if the selection is an artboard or not
    if (selection.lenght === 0) {
      UI.message("You did not select anything 😳");
    } else {
      // Get the Highest Level Selection. It should be an artboard.
      const artboardLayer = selection.layers[0];

      if (artboardLayer.type !== "Artboard") {
        UI.message("Please select an Αrtboard 🤓");
      } else {
        if (!apiKey) {
          sketch.UI.message("Please enter your VisualEyes API key first");
          return;
        }
        UI.message(getRandomTip());

        const rectangles = getAOIRectangles(artboardLayer);
        const hasAOI = rectangles.length > 0;

        const base64 = artboardToBase64(artboardLayer);

        const formData = new FormData();
        formData.append("isTransparent", "true");
        formData.append("platform", "sketch");
        formData.append("image", "data:image/png;base64," + base64 + "");

        if (hasAOI) {
          const aoi = getAOI(rectangles);
          formData.append("aoi", aoi);
          console.log(aoi);
        }

        const apiURL = "https://api.visualeyes.design/predict/";
        const testingURL = "http://192.168.10.99:8000/predict/";

        sendImage(testingURL, formData, apiKey, artboardLayer);
      }
    }
  });
}
