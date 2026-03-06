import { ToolboxApp } from './toolbox-app.js';

const app = new ToolboxApp('#app');

window.addEventListener('DOMContentLoaded', () => {
    app.init();
});

window.addEventListener('beforeunload', () => {
    app.destroy();
});
