const TOOL_CARD_META = [
    { id: 'device', className: 'card-device', title: '设备信息', panelId: 'devicePanel' },
    { id: 'qr', className: 'card-qr', title: '二维码解释', panelId: 'qrPanel' },
    { id: 'note-editor', className: 'card-note-editor', title: '笔记记录', panelId: null },
    { id: 'notes', className: 'card-notes', title: '笔记列表', panelId: 'notesPanel' },
    { id: 'reminder', className: 'card-reminder', title: '提醒功能', panelId: 'remindersPanel' },
    { id: 'roadmap', className: 'card-roadmap', title: '后续扩展', panelId: null }
];

function renderToolCard(cardMeta) {
    if (cardMeta.id === 'device') {
        return `
            <section class="cartoon-card ${cardMeta.className}" data-tool-card="${cardMeta.id}">
                <h2>${cardMeta.title}</h2>
                <div id="devicePanel" class="panel-content"></div>
            </section>
        `;
    }

    if (cardMeta.id === 'qr') {
        return `
            <section class="cartoon-card ${cardMeta.className}" data-tool-card="${cardMeta.id}">
                <h2>${cardMeta.title}</h2>
                <div class="button-grid compact">
                    <button class="cartoon-button" data-action="scan-qr-live">实时扫码</button>
                    <button class="cartoon-button" data-action="scan-qr-image">从相册识别</button>
                    <button class="cartoon-button" data-action="copy-qr-result">复制结果</button>
                </div>
                <div id="qrPanel" class="panel-content"></div>
            </section>
        `;
    }

    if (cardMeta.id === 'note-editor') {
        return `
            <section class="cartoon-card ${cardMeta.className}" data-tool-card="${cardMeta.id}">
                <h2>${cardMeta.title}</h2>
                <form id="noteForm" class="stack-form">
                    <label>
                        标题
                        <input type="text" name="noteTitle" maxlength="40" placeholder="例如：报销单、快递单、会议纪要">
                    </label>
                    <label>
                        内容
                        <textarea name="noteContent" rows="5" placeholder="输入文本，保存时会自动排版"></textarea>
                    </label>

                    <div class="button-grid compact">
                        <button type="button" class="cartoon-button" data-action="note-camera">拍照附图</button>
                        <button type="button" class="cartoon-button" data-action="note-pick-photo">相册附图</button>
                        <label class="upload-button cartoon-button">
                            上传图片
                            <input id="noteImageInput" type="file" accept="image/*" hidden>
                        </label>
                        <button type="button" class="cartoon-button" data-action="clear-note-image">清除附图</button>
                    </div>

                    <div id="noteDraftImage" class="draft-image hidden"></div>
                    <button type="submit" class="cartoon-button">保存笔记</button>
                </form>
            </section>
        `;
    }

    if (cardMeta.id === 'notes') {
        return `
            <section class="cartoon-card ${cardMeta.className}" data-tool-card="${cardMeta.id}">
                <h2>${cardMeta.title}</h2>
                <div id="notesPanel" class="panel-content"></div>
            </section>
        `;
    }

    if (cardMeta.id === 'reminder') {
        return `
            <section class="cartoon-card ${cardMeta.className}" data-tool-card="${cardMeta.id}">
                <h2>${cardMeta.title}</h2>
                <form id="reminderForm" class="stack-form">
                    <label>
                        提醒内容
                        <input type="text" name="reminderTitle" maxlength="60" required placeholder="例如：下午 5 点提交日报">
                    </label>
                    <label>
                        提醒时间
                        <input type="datetime-local" name="reminderAt" required>
                    </label>
                    <button type="submit" class="cartoon-button">创建提醒</button>
                </form>
                <div id="remindersPanel" class="panel-content"></div>
            </section>
        `;
    }

    return `
        <section class="cartoon-card ${cardMeta.className}" data-tool-card="${cardMeta.id}">
            <h2>${cardMeta.title}</h2>
            <div class="roadmap-box">
                <p>当前已模块化，后续新增工具可直接添加新 service + 新 panel。</p>
                <p>推荐方向：文件管理、语音速记、链接收藏、快捷计算器。</p>
            </div>
        </section>
    `;
}

export function getToolboxShell() {
    return `
        <header class="hero">
            <h1>Jeff的工具箱</h1>
            <p class="hero-subtitle">设备信息、二维码解释、笔记记录、提醒管理</p>
        </header>

        <section class="cartoon-card card-actions">
            <h2>常用控件</h2>
            <div class="button-grid">
                <button class="cartoon-button" data-action="refresh-device">刷新设备信息</button>
                <button class="cartoon-button" data-action="test-haptics">测试震动</button>
                <button class="cartoon-button" data-action="test-notification">测试通知</button>
                <button class="cartoon-button" data-action="copy-device">复制设备摘要</button>
            </div>
        </section>

        <section class="cartoon-card card-layout">
            <h2>控件布局</h2>
            <p class="layout-tip">拖拽排序工具卡片，或勾选控制显示。设置会自动保存。</p>
            <ul id="toolLayoutList" class="layout-list"></ul>
            <div class="button-grid compact">
                <button class="cartoon-button" data-action="reset-layout">恢复默认布局</button>
            </div>
        </section>

        <main class="dashboard-grid" id="dashboardGrid">
            ${TOOL_CARD_META.map(renderToolCard).join('')}
        </main>

        <div id="toast" class="toast"></div>
    `;
}

export const TOOL_CARD_IDS = TOOL_CARD_META.map(item => item.id);

export function getToolCardLabel(toolId) {
    const matched = TOOL_CARD_META.find(item => item.id === toolId);
    return matched ? matched.title : toolId;
}
