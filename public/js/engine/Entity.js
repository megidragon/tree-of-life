export class Entity {
  static _nextId = 0;

  constructor(type = 'entity') {
    this.id = Entity._nextId++;
    this.type = type;
    this.components = new Map();
    this.tags = new Set();
    this.active = true;
    this.zIndex = 0;
  }

  addComponent(component) {
    component.attach(this);
    this.components.set(component.name, component);
    return this;
  }

  getComponent(name) {
    return this.components.get(name);
  }

  hasComponent(name) {
    return this.components.has(name);
  }

  removeComponent(name) {
    this.components.delete(name);
    return this;
  }

  addTag(tag) {
    this.tags.add(tag);
    return this;
  }

  hasTag(tag) {
    return this.tags.has(tag);
  }

  update(dt) {
    if (!this.active) return;
    for (const component of this.components.values()) {
      component.update(dt);
    }
  }

  render(ctx, camera) {
    if (!this.active) return;
    for (const component of this.components.values()) {
      component.render(ctx, camera);
    }
  }
}
