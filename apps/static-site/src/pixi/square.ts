import { Graphics } from "pixi.js";

import { FlexItem } from "./flex-box/flex-box";
import type { UpdateInfo } from "./scene";

export class Square extends FlexItem {
  constructor() {
    super();
  }

  initGraphics() {
    const g = new Graphics();
    g.rect(-25, -25, 50, 50).fill({ color: 0xff0000 });
    this.addChild(g);
  }

  init() {
    this.eventMode = "static";
    this.cursor = "pointer";
    this.on("pointerdown", () => {
      this.scale.set(this.scale.x + 0.1);
    });

    this.initGraphics();
  }

  update({ deltaTime }: UpdateInfo) {
    this.rotation += deltaTime * 0.02;
  }
}
