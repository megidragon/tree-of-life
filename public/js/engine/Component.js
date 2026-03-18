export class Component {
  constructor(name) {
    this.name = name;
    this.entity = null;
  }

  attach(entity) {
    this.entity = entity;
  }

  update(dt) {}

  render(ctx, camera) {}
}

export class TransformComponent extends Component {
  constructor(x = 0, y = 0, width = 1, height = 1) {
    super('transform');
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}

export class SpriteComponent extends Component {
  constructor(renderFn) {
    super('sprite');
    this.renderFn = renderFn;
  }

  render(ctx, camera) {
    const transform = this.entity.getComponent('transform');
    if (!transform) return;

    ctx.save();
    this.renderFn(ctx, transform.x, transform.y, transform.width, transform.height, camera);
    ctx.restore();
  }
}

export class ColliderComponent extends Component {
  constructor(offsetX = 0, offsetY = 0, width = 0, height = 0) {
    super('collider');
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.width = width;
    this.height = height;
  }

  getBounds() {
    const transform = this.entity.getComponent('transform');
    if (!transform) return null;
    return {
      x: transform.x + this.offsetX,
      y: transform.y + this.offsetY,
      width: this.width || transform.width,
      height: this.height || transform.height,
    };
  }
}
