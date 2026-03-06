const NAV_ITEMS = [
    { id: 'home', label: '\u9996\u9875', icon: '\ud83c\udfe0' },
    { id: 'device', label: '\u8bbe\u5907', icon: '\ud83d\udcf1' },
    { id: 'notes', label: '\u7b14\u8bb0', icon: '\ud83d\udcdd' },
    { id: 'scan', label: '\u626b\u7801', icon: '\ud83d\udd0e' },
    { id: 'reminders', label: '\u63d0\u9192', icon: '\u23f0' },
    { id: 'settings', label: '\u8bbe\u7f6e', icon: '\u2699\ufe0f' }
];

function renderBottomNav() {
    return NAV_ITEMS
        .map(item => `
            <button class="bottom-tab" data-action="switch-view" data-view="${item.id}" data-view-switch="${item.id}">
                <span class="tab-icon">${item.icon}</span>
                <span class="tab-text">${item.label}</span>
            </button>
        `)
        .join('');
}

function renderHomeQuickEntry(viewId, icon, title, subtitle) {
    return `
        <button class="quick-entry" data-action="switch-view" data-view="${viewId}">
            <span class="quick-icon">${icon}</span>
            <span class="quick-title">${title}</span>
            <span class="quick-subtitle">${subtitle}</span>
        </button>
    `;
}

export function getToolboxShell() {
    return `
        <div class="phone-shell">
            <header class="app-header">
                <div class="app-title-wrap">
                    <h1 class="app-title">Jeff\u7684\u5de5\u5177\u7bb1</h1>
                    <p class="app-subtitle">\u4e2a\u4eba\u5de5\u5177\u7bb1</p>
                </div>
            </header>

            <main class="app-main" id="appMain">
                <section class="view-panel active" data-view-panel="home">
                    <section class="hero-card sketch-card">
                        <div class="hero-emoji">\ud83e\uddf0</div>
                        <h2>Jeff\u7684\u5de5\u5177\u7bb1</h2>
                        <p>\u8bbe\u5907\u68c0\u6d4b\u3001\u7b14\u8bb0\u6574\u7406\u3001\u63d0\u9192\u7ba1\u7406\u3001\u4e8c\u7ef4\u7801\u89e3\u6790</p>
                    </section>

                    <section class="quick-grid">
                        ${renderHomeQuickEntry('device', '\ud83d\udcf1', '\u8bbe\u5907\u68c0\u6d4b', '\u67e5\u770b\u8bbe\u5907\u72b6\u6001')}
                        ${renderHomeQuickEntry('notes', '\ud83d\uddd2\ufe0f', '\u5feb\u6377\u7b14\u8bb0', '\u8bb0\u5f55\u56fe\u6587\u4fe1\u606f')}
                        ${renderHomeQuickEntry('reminders', '\ud83d\udd14', '\u63d0\u9192\u4e8b\u9879', '\u6309\u65f6\u63d0\u9192')}
                        ${renderHomeQuickEntry('scan', '\ud83d\udd33', '\u4e8c\u7ef4\u7801', '\u626b\u63cf\u5e76\u89e3\u91ca')}
                        ${renderHomeQuickEntry('settings', '\u2699\ufe0f', '\u5de5\u5177\u8bbe\u7f6e', '\u7ba1\u7406\u5e03\u5c40\u4e0e\u6269\u5c55')}
                    </section>
                </section>

                <section class="view-panel" data-view-panel="device">
                    <section class="sketch-card">
                        <h2 class="section-title">\u8bbe\u5907\u4fe1\u606f</h2>
                        <div class="action-grid">
                            <button class="cartoon-button" data-action="refresh-device">\u5237\u65b0\u4fe1\u606f</button>
                            <button class="cartoon-button" data-action="test-haptics">\u6d4b\u8bd5\u9707\u52a8</button>
                            <button class="cartoon-button" data-action="test-notification">\u6d4b\u8bd5\u901a\u77e5</button>
                            <button class="cartoon-button" data-action="copy-device">\u590d\u5236\u6458\u8981</button>
                        </div>
                        <div id="devicePanel" class="panel-content"></div>
                    </section>
                </section>

                <section class="view-panel" data-view-panel="notes">
                    <section class="sketch-card">
                        <h2 class="section-title">\u7b14\u8bb0\u8bb0\u5f55</h2>
                        <form id="noteForm" class="stack-form">
                            <label>
                                \u6807\u9898
                                <input type="text" name="noteTitle" maxlength="40" placeholder="\u4f8b\u5982\uff1a\u4f1a\u8bae\u7eaa\u8981\u3001\u62a5\u9500\u5355">
                            </label>
                            <label>
                                \u5185\u5bb9
                                <textarea name="noteContent" rows="5" placeholder="\u8f93\u5165\u6587\u672c\uff0c\u4fdd\u5b58\u65f6\u81ea\u52a8\u6392\u7248"></textarea>
                            </label>

                            <div class="action-grid compact">
                                <button type="button" class="cartoon-button" data-action="note-camera">\u62cd\u7167\u9644\u56fe</button>
                                <button type="button" class="cartoon-button" data-action="note-pick-photo">\u76f8\u518c\u9644\u56fe</button>
                                <label class="upload-button cartoon-button">
                                    \u4e0a\u4f20\u56fe\u7247
                                    <input id="noteImageInput" type="file" accept="image/*" hidden>
                                </label>
                                <button type="button" class="cartoon-button" data-action="clear-note-image">\u6e05\u9664\u9644\u56fe</button>
                            </div>

                            <div id="noteDraftImage" class="draft-image hidden"></div>
                            <button type="submit" class="cartoon-button">\u4fdd\u5b58\u7b14\u8bb0</button>
                        </form>
                    </section>

                    <section class="sketch-card">
                        <h2 class="section-title">\u7b14\u8bb0\u5217\u8868</h2>
                        <div id="notesPanel" class="panel-content"></div>
                    </section>
                </section>

                <section class="view-panel" data-view-panel="scan">
                    <section class="sketch-card">
                        <h2 class="section-title">\u4e8c\u7ef4\u7801\u89e3\u91ca</h2>
                        <div class="action-grid compact">
                            <button class="cartoon-button" data-action="scan-qr-live">\u5b9e\u65f6\u626b\u7801</button>
                            <button class="cartoon-button" data-action="scan-qr-image">\u56fe\u7247\u8bc6\u7801</button>
                            <button class="cartoon-button" data-action="copy-qr-result">\u590d\u5236\u7ed3\u679c</button>
                        </div>
                        <div id="qrPanel" class="panel-content"></div>
                    </section>
                </section>

                <section class="view-panel" data-view-panel="reminders">
                    <section class="sketch-card">
                        <h2 class="section-title">\u63d0\u9192\u529f\u80fd</h2>
                        <form id="reminderForm" class="stack-form">
                            <label>
                                \u63d0\u9192\u5185\u5bb9
                                <input type="text" name="reminderTitle" maxlength="60" required placeholder="\u4f8b\u5982\uff1a17:00 \u63d0\u4ea4\u65e5\u62a5">
                            </label>
                            <label>
                                \u63d0\u9192\u65f6\u95f4
                                <input type="datetime-local" name="reminderAt" required>
                            </label>
                            <button type="submit" class="cartoon-button">\u521b\u5efa\u63d0\u9192</button>
                        </form>
                    </section>

                    <section class="sketch-card">
                        <h2 class="section-title">\u63d0\u9192\u5217\u8868</h2>
                        <div id="remindersPanel" class="panel-content"></div>
                    </section>
                </section>

                <section class="view-panel" data-view-panel="settings">
                    <section class="sketch-card">
                        <h2 class="section-title">\u5de5\u5177\u8bbe\u7f6e</h2>
                        <div class="panel-content">
                            <div class="info-item">
                                <span class="info-label">\u4e3b\u9898\u6837\u5f0f</span>
                                <span class="info-value">\u624b\u7ed8\u6e10\u53d8</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">\u5bfc\u822a\u6a21\u5f0f</span>
                                <span class="info-value">\u5e95\u90e8\u6807\u7b7e\u680f</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">\u66f4\u591a\u5de5\u5177</span>
                                <span class="info-value">\u6301\u7eed\u6269\u5c55\u4e2d</span>
                            </div>
                        </div>
                    </section>
                </section>
            </main>

            <nav class="bottom-nav">
                ${renderBottomNav()}
            </nav>
        </div>

        <div id="toast" class="toast"></div>
    `;
}

export const APP_VIEWS = NAV_ITEMS.map(item => item.id);
