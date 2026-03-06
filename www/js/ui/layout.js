const NAV_ITEMS = [
    { id: 'home', label: '首页', icon: 'nav-index-btn.png' },
    { id: 'device', label: '信息', icon: 'nav-info-btn.png' },
    { id: 'notes', label: '笔记', icon: 'nav-note-btn.png' },
    { id: 'reminders', label: '提醒', icon: 'nav-remind-btn.png' },
    { id: 'scan', label: '扫码', icon: 'nav-scan-btn.png' }
];

const HOME_TOOLS = [
    {
        view: 'device',
        icon: 'index-info-icon.png',
        title: 'Device Detective',
        subtitle: '设备检查',
        tone: 'blue'
    },
    {
        view: 'notes',
        icon: 'index-note-icon.png',
        title: 'Quick Notes',
        subtitle: '笔记记录',
        tone: 'yellow'
    },
    {
        view: 'reminders',
        icon: 'index-remind-icon.png',
        title: 'Reminders',
        subtitle: '提醒事项',
        tone: 'green'
    },
    {
        view: 'scan',
        icon: 'index-scan-icon.png',
        title: 'QR Scanner',
        subtitle: '二维码解析',
        tone: 'mint'
    }
];

function asset(name) {
    return `assets/${name}`;
}

function renderBottomNav() {
    return NAV_ITEMS
        .map(item => `
            <button class="bottom-tab" data-action="switch-view" data-view="${item.id}" data-view-switch="${item.id}">
                <img class="tab-icon-image" src="${asset(item.icon)}" alt="${item.label}">
                <span class="tab-text">${item.label}</span>
            </button>
        `)
        .join('');
}

function renderHomeTools() {
    return HOME_TOOLS
        .map(item => `
            <button class="tool-entry" data-action="switch-view" data-view="${item.view}">
                <span class="tool-icon-wrap tone-${item.tone}">
                    <img class="tool-icon" src="${asset(item.icon)}" alt="${item.title}">
                </span>
                <span class="tool-title">${item.title}</span>
                <span class="tool-subtitle">${item.subtitle}</span>
            </button>
        `)
        .join('');
}

function renderSubpageHeader() {
    return `
        <header class="subpage-header">
            <button type="button" class="subpage-icon-btn" aria-label="菜单">
                <img class="subpage-icon" src="${asset('left-menu-btn.png')}" alt="">
            </button>
            <h2 class="subpage-title">JEFF'S TOOLBOX</h2>
            <button type="button" class="subpage-icon-btn" aria-label="设置">
                <img class="subpage-icon" src="${asset('setting-btn.png')}" alt="">
            </button>
        </header>
    `;
}

export function getToolboxShell() {
    return `
        <div class="phone-shell">
            <main class="app-main" id="appMain">
                <section class="view-panel active home-panel" data-view-panel="home">
                    <section class="home-hero">
                        <img class="hero-image" src="${asset('app-big-icon.png')}" alt="Jeff toolbox">
                    </section>
                    <h1 class="home-title">JEFF'S TOOLBOX</h1>

                    <section class="home-tool-grid">
                        ${renderHomeTools()}
                    </section>
                </section>

                <section class="view-panel" data-view-panel="device">
                    ${renderSubpageHeader()}
                    <section class="sketch-card">
                        <h2 class="section-title">设备信息</h2>
                        <div class="action-grid">
                            <button class="cartoon-button" data-action="refresh-device">刷新信息</button>
                            <button class="cartoon-button" data-action="test-haptics">测试震动</button>
                            <button class="cartoon-button" data-action="test-notification">测试通知</button>
                            <button class="cartoon-button" data-action="copy-device">复制摘要</button>
                        </div>
                        <div id="devicePanel" class="panel-content"></div>
                    </section>
                </section>

                <section class="view-panel" data-view-panel="notes">
                    ${renderSubpageHeader()}

                    <section id="notesListSection" class="notes-mode-section">
                        <h2 class="section-title">笔记列表</h2>
                        <div id="notesPanel" class="panel-content"></div>
                    </section>

                    <section id="noteDetailSection" class="notes-mode-section hidden">
                        <h2 class="section-title">笔记详情</h2>
                        <div id="noteDetailPanel" class="panel-content"></div>
                    </section>

                    <section id="noteEditorSection" class="sketch-card notes-mode-section hidden">
                        <div class="notes-section-head">
                            <h2 class="section-title">新增笔记</h2>
                        </div>
                        <form id="noteForm" class="stack-form">
                            <label>
                                标题
                                <input type="text" name="noteTitle" maxlength="40" placeholder="例如：会议纪要、报销单">
                            </label>
                            <label>
                                内容
                                <textarea name="noteContent" class="note-content-input" rows="12" placeholder="输入文本，保存时自动排版"></textarea>
                            </label>

                            <div class="action-grid compact">
                                <button type="button" class="cartoon-button note-mini-btn" data-action="note-camera">拍照附图</button>
                                <button type="button" class="cartoon-button note-mini-btn" data-action="note-pick-photo">相册附图</button>
                                <label class="upload-button cartoon-button note-mini-btn">
                                    上传图片
                                    <input id="noteImageInput" type="file" accept="image/*" hidden>
                                </label>
                                <button type="button" class="cartoon-button note-mini-btn" data-action="clear-note-image">清除附图</button>
                            </div>

                            <div id="noteDraftImage" class="draft-image hidden"></div>
                            <button type="submit" class="cartoon-button note-save-btn">保存笔记</button>
                        </form>
                    </section>

                    <button
                        type="button"
                        id="floatingNoteAddButton"
                        class="floating-note-btn"
                        data-action="open-note-editor"
                        aria-label="添加笔记"
                    >
                        ＋
                    </button>
                    <button
                        type="button"
                        id="floatingNoteBackButton"
                        class="floating-note-btn floating-note-btn-back hidden"
                        data-action="back-note-list"
                        aria-label="返回列表"
                    >
                        ←
                    </button>
                </section>

                <section class="view-panel" data-view-panel="reminders">
                    ${renderSubpageHeader()}
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
                            <label>
                                \u91cd\u590d\u89c4\u5219
                                <select id="reminderRepeatType" name="repeatType">
                                    <option value="once">\u4ec5\u4e00\u6b21</option>
                                    <option value="daily">\u6bcf\u5929</option>
                                    <option value="weekdays">\u6bcf\u4e2a\u5de5\u4f5c\u65e5</option>
                                    <option value="weekly">\u6307\u5b9a\u661f\u671f\u51e0</option>
                                    <option value="monthly">\u6bcf\u6708</option>
                                    <option value="yearly">\u6bcf\u5e74</option>
                                </select>
                            </label>
                            <div id="reminderWeekdayField" class="reminder-weekday-field hidden">
                                <p class="weekday-field-label">\u9009\u62e9\u661f\u671f</p>
                                <div class="weekday-chip-group">
                                    <label class="weekday-chip">
                                        <input type="checkbox" name="repeatWeekdays" value="1">
                                        <span>\u5468\u4e00</span>
                                    </label>
                                    <label class="weekday-chip">
                                        <input type="checkbox" name="repeatWeekdays" value="2">
                                        <span>\u5468\u4e8c</span>
                                    </label>
                                    <label class="weekday-chip">
                                        <input type="checkbox" name="repeatWeekdays" value="3">
                                        <span>\u5468\u4e09</span>
                                    </label>
                                    <label class="weekday-chip">
                                        <input type="checkbox" name="repeatWeekdays" value="4">
                                        <span>\u5468\u56db</span>
                                    </label>
                                    <label class="weekday-chip">
                                        <input type="checkbox" name="repeatWeekdays" value="5">
                                        <span>\u5468\u4e94</span>
                                    </label>
                                    <label class="weekday-chip">
                                        <input type="checkbox" name="repeatWeekdays" value="6">
                                        <span>\u5468\u516d</span>
                                    </label>
                                    <label class="weekday-chip">
                                        <input type="checkbox" name="repeatWeekdays" value="0">
                                        <span>\u5468\u65e5</span>
                                    </label>
                                </div>
                            </div>
                            <p id="reminderRepeatHint" class="reminder-repeat-hint">\u5f53\u524d\uff1a\u4ec5\u4e00\u6b21</p>
                            <button type="submit" class="cartoon-button">\u521b\u5efa\u63d0\u9192</button>
                        </form>
                    </section>

                    <section class="sketch-card">
                        <h2 class="section-title">\u63d0\u9192\u5217\u8868</h2>
                        <div id="remindersPanel" class="panel-content"></div>
                    </section>
                </section>

                <section class="view-panel" data-view-panel="scan">
                    ${renderSubpageHeader()}
                    <section class="sketch-card">
                        <h2 class="section-title">二维码解释</h2>
                        <div class="action-grid compact">
                            <button class="cartoon-button" data-action="scan-qr-live">实时扫码</button>
                            <button class="cartoon-button" data-action="scan-qr-image">图片识码</button>
                            <button class="cartoon-button" data-action="copy-qr-result">复制结果</button>
                        </div>
                        <div id="qrPanel" class="panel-content"></div>
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

