import './ui/styles.css';
import { App } from './core/App.js';

const canvas = document.getElementById('stage');

try {
  const app = new App(canvas);
  app.start();
  // Handy from the console: `sandbox.settings.abilities.frost.crystals.count = 200`
  window.sandbox = app;
} catch (error) {
  console.error(error);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.remove('boot--done');
    boot.innerHTML =
      `<div class="boot__label">WebGL failed to start</div>` +
      `<div class="boot__label" style="opacity:.6;max-width:32ch;text-align:center;line-height:1.8">
        ${String(error?.message ?? error)}
      </div>`;
  }
}
