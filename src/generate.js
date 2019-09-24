import sketch, { UI } from "sketch";
import setApiKey from "./set-api-key";

const demoSVG = `
<svg width="600" height="600" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  
<image xlink:href="https://www.facebook.com/profile/pic.php?cuid=AYipK0zCmDWDwi30QXbBaeIaeLmky6ebzvwZ2TyycR1-C5qq4aCobuv3UYmn25fxW5UrpHJYi-7rKaM2P6MuFPe2yTGsrTvXIt_CXBnnVhXP4zJUmcHvYucuxRxkbF5qSJtKTMp7LbBjCt6zh4QUdKYDBgcuK3QVnVuc-jpgscS_9w" width="600" height="600"/>
<g name="AOI 1">
<rect x="10" y="10" width="200" height="200" style="fill: rgba(38,166,154,0.3); stroke-width:4; stroke: rgba(38,166,154,1)" />
<rect x="10" y="10" width="70" height="32" style="fill: rgba(38,166,154,1);" />
 <text x="20" y="32" style="text-align: center; font-family: sans-serif; font-weight: bold; font-size: 18px; fill: white">100%</text>
 </g>
 <g name="AOI 2">
 <rect x="50" y="50" width="200" height="200" style="fill: rgba(239,83,80,0.3); stroke-width:4; stroke: rgba(239,83,80,1)" />
<rect x="50" y="50" width="70" height="32" style="fill: rgba(239,83,80,1);" />
<text x="60" y="72" style="text-align: center; font-family: sans-serif; font-weight: bold; font-size: 18px; fill: white">100%</text>
</g>
</svg>
`;

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

function onBoardingPrompt() {
  return new Promise((resolve, reject) => {
    sketch.UI.getInputFromUser(
      "Welcome on board",
      {
        description:
          "Learn more about the usage of our plugin here: https://www.visualeyes.design/learn",
        okButton: "Show me around",
        cancelButton: "Not now"
      },
      (err, value) => {
        if (err) {
          // User cancelled on boading process
          return resolve(false);
        }
        // User accepted on boading processs
        return resolve(true);
      }
    );
  });
}

function artboardToBase64(artboardId) {
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
  sketch.export(artboardLayer, options);
  const url = NSURL.fileURLWithPath(exportPath + "/" + artboardId + ".jpg"),
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

export default function() {
  const document = sketch.getSelectedDocument();

  if (!document) {
    return;
  }
  const hasOnboarding = sketch.Settings.settingForKey("first-time");
  if (hasOnboarding || true) {
    onBoardingPrompt().then(answer => {
      console.log(answer);

      const selection = document.selectedLayers;

      // Detect if the selection is an artboard or not
      if (selection.lenght === 0) {
        UI.message("You did not select anything 😳");
      } else {
        // Get the Highest Level Selection
        // Should be an artboard
        const artboardLayer = selection.layers[0];
        const svgLayer = createLayerFromSvg(demoSVG);

        const layers = svgLayer.ungroup();
        console.log(svgLayer.ungroup);
        new sketch.Group({
          name: `🔥 VisualEyes`,
          layers,
          parent: artboardLayer
        });
        return;

        if (artboardLayer.type !== "Artboard") {
          UI.message("Please select an Αrtboard 🤓");
        } else {
          getApiKey().then(apiKey => {
            if (!apiKey) {
              sketch.UI.message("Please enter your VisualEyes API key first");
              return;
            }
            UI.message("🧠 Please wait for the magic...");

            const artboardID = artboardLayer.id;
            const base64 = artboardToBase64(artboardID);

            const formData = new FormData();
            formData.append("isTransparent", "true");
            formData.append("platform", "sketch");
            formData.append("image", "data:image/png;base64," + base64 + "");

            const apiURL = "https://api.visualeyes.design/predict/";

            fetch(apiURL, {
              method: "POST",
              body: formData,
              headers: {
                Authorization: `Token ${apiKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
                "cache-control": "no-cache"
              }
            })
              .then(res => {
                const { status } = res;
                // console.log(res);
                if (status === 200) {
                  // console.log("Successful");
                } else if (status === 400) {
                  UI.message(
                    `😱 We are deeply sorry, but something went terrible wrong!`
                  );
                } else if (status === 401) {
                  UI.alert(
                    "Invalid API key",
                    'If you have a valid API key, you can set it at:\n "Plugins / 🔥 Visualeyes / Set your API key".\n\nYou can claim a valid token at https://www.visualeyes.design'
                  );
                } else if (status === 402) {
                  UI.alert(
                    "Upgrade your Account",
                    "🛫 In order to access this feature you need to upgrade your account at https://www.visualeyes.design"
                  );
                } else if (status === 403) {
                  UI.message(`🚨 Your heatmaps limit has been exceeded`);
                }
                return res.json();
              })
              .then(json => {
                // console.log(json);
                if (json.code !== "success") {
                  throw new Error("Error during fetching the heatmap");
                }
                const imgURL = json.url;

                const nsURL = NSURL.alloc().initWithString(imgURL);
                const nsimage = NSImage.alloc().initByReferencingURL(nsURL);

                return nsimage;
              })
              .then(nsimage => {
                const x = 0;
                const y = 0;
                const { width, height } = artboardLayer.frame;
                const rect = new sketch.Rectangle(x, y, width, height);

                const { name } = artboardLayer;

                const shape = new sketch.ShapePath({
                  name: `Heatmap of "${name}" Artboard`,
                  frame: rect,
                  style: {
                    fills: [
                      {
                        fill: "Pattern",
                        pattern: {
                          patternType: sketch.Style.PatternFillType.Fill,
                          image: nsimage
                        }
                      }
                    ]
                  },
                  parent: artboardLayer
                });

                UI.message(`🎉 Bazinga!`);
              })
              .catch(err => {
                console.log(`[Error]: ${JSON.stringify(err)}`);
              });
          });
        }
      }
    });
  } else {
    console.log("Do the default behavior");
  }
}
