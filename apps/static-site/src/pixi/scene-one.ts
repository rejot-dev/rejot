import { Application, Assets, Graphics } from "pixi.js";

import { createFlexItem, FlexBox, JUSTIFY_CONTENT_OPTIONS } from "./flex-box/flex-box";
import { Paragraph } from "./flex-box/paragraph";
import { type InitInfo, Scene } from "./scene";

export class SceneOne extends Scene {
  constructor(app: Application) {
    super(app);
  }

  async init({ canvasWidth, canvasHeight }: InitInfo): Promise<void> {
    console.log("Scene One Init");

    Assets.addBundle("fonts", {
      Atkinson: "/fonts/atkinson-regular.woff",
    });
    await Assets.loadBundle("fonts");

    const square1 = createFlexItem(
      function () {
        const g = new Graphics();
        g.rect(0, 0, 50, 50).fill({ color: 0xea580c });
        this.addChild(g);
      },
      function (_info) {
        // this.rotation += _info.deltaTime * 0.02;
      },
    );

    const square2 = createFlexItem(
      function () {
        const g = new Graphics();
        g.rect(0, 0, 50, 50).fill({ color: 0x06b6d4 });
        this.addChild(g);
      },
      function (_info) {
        // this.rotation += _info.deltaTime * 0.05;
      },
    );

    const boxesBox = new FlexBox(
      0,
      0,
      canvasWidth / 2,
      canvasHeight,
      { direction: "row" },
      [square1, square2],
      { drawBounds: true, debugLogs: false },
    );

    const paragraph1 = new Paragraph(JUSTIFY_CONTENT_OPTIONS[0], {
      fill: 0xff0000,
    });

    const textBox = new FlexBox(
      0,
      0,
      canvasWidth,
      canvasHeight / 3,
      { direction: "row" },
      [paragraph1],
      {
        drawBounds: false,
        debugLogs: false,
      },
    );
    const miscBox = new FlexBox(0, 0, canvasWidth / 2, canvasHeight / 3, { direction: "row" }, []);

    this.create(miscBox);
    this.create(boxesBox);
    this.create(textBox);

    setInterval(() => {
      const currentJustify = boxesBox.options.justifyContent;
      const idx = JUSTIFY_CONTENT_OPTIONS.indexOf(currentJustify);
      const nextIdx = (idx + 1) % JUSTIFY_CONTENT_OPTIONS.length;
      boxesBox.updateOptions({ justifyContent: JUSTIFY_CONTENT_OPTIONS[nextIdx] });
      paragraph1.setText(JUSTIFY_CONTENT_OPTIONS[nextIdx]);
    }, 1000);
  }
}
