import sketch, { UI } from "sketch";
import setApiKey from "./set-api-key";
import {
  MESSAGES,
  API_URL,
  getRandomTip,
  MIN_AOI_HEIGHT,
  MIN_AOI_WIDTH,
  LARGE_IMAGE_TIMEOUT,
  AOI_ERRORS
} from "./constants";

let timeoutID = "";

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
  sketch.UI.alert("Welcome on board", MESSAGES.onBoarding, "Let's start");
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

      clearTimeout(timeoutID);
      const svg = json.svg;
      const { width, height } = artboard.frame;
      drawSVGToArtboard(svg, artboard);

      const hasUsedAOI =
        sketch.Settings.settingForKey("has-used-aoi") === "true";
      if (hasUsedAOI) {
        UI.message(MESSAGES.success);
      } else {
        UI.message(MESSAGES.successWithAOIPrompt);
      }
    })
    .catch(err => {
      console.log(JSON.stringify(err));
    });
}

function drawSVGToArtboard(svg, artboard) {
  const { width, height } = artboard.frame;

  const svgLayer = createLayerFromSvg(svg, width, height);
  const layers = svgLayer.ungroup();

  const group = new sketch.Group({
    name: `🔥 VisualEyes Layer`,
    layers,
    parent: artboard
  });
  group.adjustToFit();
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
          UI.message(AOI_ERRORS.size.message);
          layer.hidden = true;
          layer.name = AOI_ERRORS.size.layerName;
        } else if (!isInsideArtboard) {
          UI.message(AOI_ERRORS.placement.message);
          layer.hidden = true;
          layer.name = AOI_ERRORS.placement.layerName;
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
    if (!apiKey) {
      sketch.UI.message(MESSAGES.noAPIKey);
      return;
    }

    const hasOnboarding = sketch.Settings.settingForKey("first-time");
    if (hasOnboarding) {
      onBoardingAlert();
    }

    const selection = document.selectedLayers;

    // Detect if the selection is an artboard or not
    if (selection.lenght === 0) {
      UI.message(MESSAGES.noSelection);
    } else {
      // Get the Highest Level Selection. It should be an artboard.
      const artboardLayer = selection.layers[0];

      if (artboardLayer.type !== "Artboard") {
        UI.message(MESSAGES.noSelection);
      } else {
        UI.message(getRandomTip());
        timeoutID = setTimeout(
          () => UI.message(MESSAGES.largeImage),
          LARGE_IMAGE_TIMEOUT
        );

        const rectangles = getAOIRectangles(artboardLayer);
        const hasAOI = rectangles.length > 0;

        const hasUsedAOI =
          sketch.Settings.settingForKey("has-used-aoi") === "true";

        if (!hasUsedAOI && hasAOI) {
          // console.log(
          //   "This cool guy has just used our AOI feature. Let's not spam him anymore!"
          // );
          sketch.Settings.setSettingForKey("has-used-aoi", "true");
        }

        const base64 = artboardToBase64(artboardLayer);

        const formData = new FormData();
        formData.append("isTransparent", "true");
        formData.append("platform", "sketch");
        formData.append("svg", "true");
        formData.append("image", "data:image/png;base64," + base64 + "");

        if (hasAOI) {
          const aoi = getAOI(rectangles);
          formData.append("aoi", aoi);
        }

        sendImage(API_URL, formData, apiKey, artboardLayer);
      }
    }
  });
}
