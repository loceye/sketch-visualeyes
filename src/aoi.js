import sketch, { UI } from "sketch";
import setApiKey from "./set-api-key";

function getApiKey() {
  // Check if user's api Key is stored
  // https://developer.sketch.com/reference/api/#set-a-plugin-setting
  const apiKey = sketch.Settings.settingForKey("api-key");

  if (!apiKey) {
    // If the user do not have an API key, then we should create and save one
    try {
      return setApiKey();
    } catch (e) {}
  } else {
    // The user's api key is saved, now we can resolve the promise
    return Promise.resolve(apiKey);
  }
}

function drawAOI(rectangles, parent) {
  rectangles.map((rect, index) => {
    const { frame, color, score } = rect;
    const { Style, Text, Group, Rectangle, ShapePath } = sketch;

    const fillColor = color.slice(0, -2) + "20";

    const backgroundShape = new ShapePath({
      name: `Background`,
      frame: frame,
      style: {
        fills: [
          {
            color: fillColor,
            fillType: Style.FillType.Color
          }
        ],
        borders: [
          {
            color,
            thickness: 4,
            position: Style.BorderPosition.Center
          }
        ]
      }
    });

    const scoreRectangle = new Rectangle(frame.x, frame.y, 70, 32);

    const scoreText = new Text({
      text: `${score}%`,
      frame: scoreRectangle,
      style: {
        alignment: Text.VerticalAlignment.center,
        fontSize: 18,
        fontWeight: 9,
        fills: [
          {
            color: "#ffffff",
            fillType: Style.FillType.Color
          }
        ]
      }
    });

    const scoreShape = new ShapePath({
      name: `Score Background`,
      frame: scoreRectangle,
      style: {
        fills: [
          {
            color: color,
            fillType: Style.FillType.Color
          }
        ],
        borders: []
      }
    });

    const group = new Group({
      name: `AOI Group ${index}`,
      layers: [backgroundShape, scoreShape, scoreText],
      parent: parent
    });
    group.adjustToFit();
    group.locked = true;
  });
}

export default function() {
  const document = sketch.getSelectedDocument();
  if (!document) {
    return;
  }

  const selection = document.selectedLayers;

  // Detect if the selection is an artboard or not
  if (selection.lenght === 0) {
    UI.message("You didn't select anything 😳");
  } else {
    // Get the Highest Level Selection
    // Should be an artboard
    const artboardLayer = selection.layers[0];

    if (artboardLayer.type !== "Artboard") {
      UI.message("Please select an Αrtboard 🤓");
    } else {
      const rectangles = artboardLayer.layers
        .filter(layer => {
          const isRectangle =
            layer.type === "ShapePath" &&
            layer.shapeType === "Rectangle" &&
            layer.name === "AOI";

          if (isRectangle) {
            const { x, y, width, height } = layer.frame;
            const maxWidth = artboardLayer.frame.width;
            const maxHeight = artboardLayer.frame.height;

            const isInsideArtboard =
              x >= 0 &&
              y >= 0 &&
              x + width <= maxWidth &&
              y + height <= maxHeight;

            const isSmall = width < 70 || height < 32;

            if (isSmall) {
              UI.message(
                " 👎 One of your rectangles was not big enough (minimum 70x32 pixels)"
              );
              layer.hidden = true;
              layer.name = "🚨 Too small (minimum 70x32)";
            } else if (!isInsideArtboard) {
              UI.message(
                " 😱 One of your rectangles is outside the current Artboard."
              );
              layer.hidden = true;
              layer.name = "🚨 Off the current Artboard";
            }

            return isInsideArtboard && !isSmall;
          } else {
            return false;
          }
        })
        .map((rect, index) => {
          // Extract dominant color
          const BRANDING_COLOR = "#3E21DEff";
          const fills = rect.style.fills;
          const hasFills = fills.length > 0;
          const color = hasFills ? rect.style.fills[0].color : BRANDING_COLOR;
          const frame = rect.frame;

          // Temporary remove the rect in order to extract the plain image
          rect.remove();

          return {
            id: rect.id,
            color,
            frame
          };
        });
      const hasAOI = rectangles.length > 0;

      if (!hasAOI)
        UI.message('You must create at least one rectangel named"AOI" 🧐');

      getApiKey().then(apiKey => {
        if (!apiKey) {
          sketch.UI.message("Please enter your VisualEyes API key first");
          return;
        }
        UI.message("🧠 Please wait for the magic...");

        // Set up the Artboard options for the temporary export
        // NSTemporatyDirectory is a Cocoa Function
        // https://developer.apple.com/documentation/foundation/1409211-nstemporarydirectory
        const artboardID = artboardLayer.id;
        const exportPath = NSTemporaryDirectory() + `VisualEyes/Heatmaps/`;
        const options = {
          formats: "jpg",
          output: exportPath,
          compression: 0.7,
          "use-id-for-name": true
        };

        // Save the image temporary
        sketch.export(artboardLayer, options);
        const url = NSURL.fileURLWithPath(
            exportPath + "/" + artboardID + ".jpg"
          ),
          bitmap = NSData.alloc().initWithContentsOfURL(url),
          base64 = bitmap.base64EncodedStringWithOptions(0);

        // // Remove the image from the temp folder
        NSFileManager.defaultManager().removeItemAtURL_error(url, nil);

        // Now I have the Artboard as a base64 file and I can send it to our API
        const formData = new FormData();
        formData.append("isTransparent", "true");
        formData.append("platform", "sketch");
        formData.append("image", "data:image/png;base64," + base64 + "");
        if (hasAOI) {
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

          formData.append("aoi", JSON.stringify(aoi));
        }

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
            console.log(json);

            // console.log(json);
            if (json.code !== "success") {
              throw new Error("Error during fetching the heatmap");
            }
            const areas = json.aoi;
            const imgURL = json.url;

            const nsURL = NSURL.alloc().initWithString(imgURL);
            const nsimage = NSImage.alloc().initByReferencingURL(nsURL);

            return { nsimage, areas };
          })
          .then(({ nsimage, areas }) => {
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
            shape.locked = true;

            if (hasAOI) {
              rectangles.forEach(rect => {
                rect.score = areas.find(area => area.id === rect.id).score;
              });
              drawAOI(rectangles, artboardLayer);
            }

            UI.message(`🎉 Bazinga!`);
          })
          .catch(err => {
            console.log(`[Error]: ${JSON.stringify(err)}`);
          });
      });
    }
  }
}
