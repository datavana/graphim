/**
 * Event system
 */
class EventEmitter {
  constructor() {
    this.listeners = {};
  }
  on(event, fn) {
    (this.listeners[event] = this.listeners[event] || []).push(fn);
  }
  off(event, fn) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(f => f !== fn);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach(fn => fn(data));
  }
}