import { Text, TextStyle, type TextStyleOptions } from "pixi.js";

import type { Resizeable, ResizeInfo } from "../scene";
import { FlexItem } from "./flex-box";

export const DEFAULT_STYLE: Partial<TextStyleOptions> = {
  fontFamily: "Atkinson Regular",
  fontSize: 36,
  fill: 0x000000,
  wordWrap: true,
  wordWrapWidth: 440,
  align: "center",
};

export class Paragraph extends FlexItem implements Resizeable {
  #textString: string;

  #text: Text | undefined;
  #style: Partial<TextStyleOptions>;

  constructor(text: string, style: Partial<TextStyleOptions>) {
    super();

    this.#textString = text;
    this.#style = style;
  }

  setText(text: string) {
    this.#textString = text;
    if (this.#text) {
      this.#text.text = text;
    }
  }

  init() {
    this.#initText();
  }

  #initText() {
    if (this.#text) {
      this.#text.destroy();
    }

    const style = new TextStyle({
      ...DEFAULT_STYLE,
      ...this.#style,
    });

    this.#text = new Text({
      text: this.#textString,
      style,
    });

    this.addChild(this.#text);
  }

  onResize(_resizeInfo: ResizeInfo) {}

  update() {}
}
