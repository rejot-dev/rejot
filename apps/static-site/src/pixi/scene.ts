import { Application, Container, Graphics } from "pixi.js";

export async function initScene(canvas: HTMLCanvasElement, scene: new (app: Application) => Scene) {
  const app = new Application();

  const { width, height } = canvas.getBoundingClientRect();

  console.log("Scene Init", {
    width,
    height,
  });

  await app.init({
    canvas,
    width,
    height,
    resizeTo: canvas,
    backgroundAlpha: 0,
    antialias: false,
  });

  const s = new scene(app);
  app.stage.addChild(s);

  app.renderer.on("resize", () => {
    const { width, height } = canvas.getBoundingClientRect();
    s.onResize({ width, height });
  });

  await s.init({ canvasWidth: app.renderer.width, canvasHeight: app.renderer.height });
  return s;
}

export abstract class Scene extends Container<ContainerChild> implements Resizeable {
  app: Application;

  constructor(app: Application) {
    super();
    this.app = app;
  }

  abstract init(info: InitInfo): void | Promise<void>;

  create(object: GameObject) {
    object.init({
      canvasWidth: this.app.renderer.width,
      canvasHeight: this.app.renderer.height,
    });

    this.app.ticker.add((d) => {
      object.update({
        deltaTime: d.deltaTime,
        canvasWidth: this.app.renderer.width,
        canvasHeight: this.app.renderer.height,
      });
    });

    this.addChild(object);
  }

  onResize(resizeInfo: ResizeInfo) {
    for (const child of this.children) {
      if (isResizeable(child)) {
        child.onResize(resizeInfo);
      }
    }
  }
}

export type InitInfo = {
  canvasWidth: number;
  canvasHeight: number;
};

export type UpdateInfo = {
  deltaTime: number;
  canvasWidth: number;
  canvasHeight: number;
};

export type ContainerChild = GameObject | Graphics | Container;

export abstract class GameObject extends Container<ContainerChild> implements Resizeable {
  abstract init(info: InitInfo): void;
  abstract update(info: UpdateInfo): void;

  onResize(resizeInfo: ResizeInfo) {
    for (const child of this.children) {
      if (isResizeable(child)) {
        child.onResize(resizeInfo);
      }
    }
  }
}

export function createGameObject(
  initFn: (this: GameObject) => void,
  updateFn?: (this: GameObject, info: UpdateInfo) => void,
): GameObject {
  const c = class extends GameObject {
    init() {
      initFn.call(this);
    }

    update(info: UpdateInfo) {
      updateFn?.call(this, info);
    }
  };

  return new c();
}

export type ResizeInfo = {
  width: number;
  height: number;
};

export interface Resizeable {
  onResize(resizeInfo: ResizeInfo): void;
}

export function isResizeable(child: unknown): child is Resizeable {
  return typeof child === "object" && child !== null && "onResize" in child;
}
