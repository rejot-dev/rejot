import { Graphics, Rectangle } from "pixi.js";

import { GameObject, type InitInfo, type ResizeInfo, type UpdateInfo } from "../scene";

export abstract class FlexItem extends GameObject {
  constructor() {
    super();
  }
}

export function createFlexItem(
  initFn: (this: FlexItem) => void,
  updateFn?: (this: FlexItem, info: UpdateInfo) => void,
): FlexItem {
  const c = class extends FlexItem {
    init() {
      initFn.call(this);
    }

    update(info: UpdateInfo) {
      updateFn?.call(this, info);
    }
  };

  return new c();
}

export const JUSTIFY_CONTENT_OPTIONS = [
  "flex-start",
  "flex-end",
  "center",
  "space-between",
  "space-around",
  "space-evenly",
] as const;

export type FlexOptions = {
  direction: "row" | "column";
  justifyContent:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  alignContent:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly"
    | "stretch";
  wrap: "nowrap" | "wrap" | "wrap-reverse";
};

export type ExtraFlexOptions = {
  drawBounds: boolean;
  debugLogs: boolean;
};

export class FlexBox extends GameObject {
  #children: FlexItem[] = [];
  #options: FlexOptions;
  #extraOptions: ExtraFlexOptions;
  #outline: Graphics | null = null;

  // Store relative values as percentages
  #relativeX: number = 0;
  #relativeY: number = 0;
  #relativeWidth: number = 0;
  #relativeHeight: number = 0;

  // Store initial absolute values
  #initialX: number;
  #initialY: number;
  #initialWidth: number;
  #initialHeight: number;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    options: Partial<FlexOptions>,
    children: FlexItem[],
    extraOptions: Partial<ExtraFlexOptions> = {},
  ) {
    super({
      boundsArea: new Rectangle(x, y, width, height),
    });

    // Store initial values to calculate relative values in init
    this.#initialX = x;
    this.#initialY = y;
    this.#initialWidth = width;
    this.#initialHeight = height;

    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    this.#options = {
      direction: "row",
      justifyContent: "center",
      alignItems: "center",
      alignContent: "center",
      wrap: "nowrap",
      ...options,
    };

    this.#extraOptions = {
      drawBounds: false,
      debugLogs: false,
      ...extraOptions,
    };

    this.#children = children;
  }

  get options(): Readonly<FlexOptions> {
    return this.#options;
  }

  init({ canvasWidth, canvasHeight }: InitInfo) {
    // Calculate relative values based on canvas dimensions
    this.#relativeX = this.#initialX / canvasWidth;
    this.#relativeY = this.#initialY / canvasHeight;
    this.#relativeWidth = this.#initialWidth / canvasWidth;
    this.#relativeHeight = this.#initialHeight / canvasHeight;

    for (const child of this.#children) {
      child.init({ canvasWidth, canvasHeight });
      this.addChild(child);
    }

    if (this.#extraOptions.drawBounds) {
      this.#outline = new Graphics();
      this.addChild(this.#outline);
    }

    this.#updateChildrenPositions();
  }

  override onResize(resizeInfo: ResizeInfo) {
    super.onResize(resizeInfo);

    this.x = this.#relativeX * resizeInfo.width;
    this.y = this.#relativeY * resizeInfo.height;
    this.width = this.#relativeWidth * resizeInfo.width;
    this.height = this.#relativeHeight * resizeInfo.height;

    this.boundsArea = new Rectangle(this.x, this.y, this.width, this.height);

    this.#updateChildrenPositions();
  }

  update({ deltaTime, canvasWidth, canvasHeight }: UpdateInfo) {
    this.#updateChildrenPositions();

    this.#children.forEach((child) => {
      child.update({ deltaTime, canvasWidth, canvasHeight });
    });
  }

  addFlexChild(child: FlexItem) {
    this.#children.push(child);
    this.addChild(child);
  }

  updateOptions(options: Partial<FlexOptions>) {
    this.#options = {
      ...this.#options,
      ...options,
    };
  }

  #calculateInlineSize(): number {
    return this.options.direction === "row"
      ? this.#children.reduce((total, child) => total + child.width, 0)
      : Math.max(...this.#children.map((child) => child.width), 0);
  }

  #calculateCrossSize(): number {
    return this.options.direction === "row"
      ? Math.max(...this.#children.map((child) => child.height), 0)
      : this.#children.reduce((total, child) => total + child.height, 0);
  }

  #updateChildrenPositions() {
    const isRow = this.options.direction === "row";
    const inlineSize = this.#calculateInlineSize();
    const crossSize = this.#calculateCrossSize();

    if (this.#outline) {
      this.#outline.clear();
      this.#outline
        .moveTo(0, 0)
        .lineTo(this.width, 0)
        .lineTo(this.width, this.height)
        .lineTo(0, this.height)
        .lineTo(0, 0)
        .stroke({ color: 0xfeeb77, pixelLine: true });
    }

    if (!this.#children.length) {
      return;
    }

    // Calculate initial positions based on justifyContent
    let mainAxisStart = 0;
    const availableSpace = isRow ? this.width - inlineSize : this.height - crossSize;

    switch (this.options.justifyContent) {
      case "flex-start":
        mainAxisStart = 0;
        break;
      case "flex-end":
        mainAxisStart = availableSpace;
        break;
      case "center":
        mainAxisStart = availableSpace / 2;
        break;
      case "space-between":
        mainAxisStart = 0;
        break;
      case "space-around":
        mainAxisStart = availableSpace / (this.#children.length * 2);
        break;
      case "space-evenly":
        mainAxisStart = availableSpace / (this.#children.length + 1);
        break;
    }

    // Calculate spacing between items for space-* properties
    let spacing = 0;
    if (this.#children.length > 1) {
      switch (this.options.justifyContent) {
        case "space-between":
          spacing = availableSpace / (this.#children.length - 1);
          break;
        case "space-around":
          spacing = availableSpace / this.#children.length;
          break;
        case "space-evenly":
          spacing = availableSpace / (this.#children.length + 1);
          break;
      }
    }

    let currentMain = mainAxisStart;

    for (const child of this.#children) {
      // Calculate cross axis position based on alignItems
      let crossPos = 0;
      const itemCrossSize = isRow ? child.height : child.width;
      const containerCrossSize = isRow ? this.height : this.width;

      switch (this.options.alignItems) {
        case "flex-start":
          crossPos = 0;
          break;
        case "flex-end":
          crossPos = containerCrossSize - itemCrossSize;
          break;
        case "center":
          crossPos = (containerCrossSize - itemCrossSize) / 2;
          break;
        case "stretch":
          crossPos = 0;
          if (isRow) {
            child.height = this.height;
          } else {
            child.width = this.width;
          }
          break;
      }

      // Set position based on direction
      if (isRow) {
        child.position.set(currentMain, crossPos);
        currentMain += child.width + spacing;
      } else {
        child.position.set(crossPos, currentMain);
        currentMain += child.height + spacing;
      }
    }
  }
}
