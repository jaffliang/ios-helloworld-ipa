import { escapeHtml, formatChinaDateTime, formatDateTime, formatRelativeTime } from '../core/dom.js';

function renderInfoRow(label, value, icon = '') {
    return `
        <div class="info-item">
            <span class="info-label"><span class="icon">${icon}</span>${escapeHtml(label)}</span>
            <span class="info-value">${escapeHtml(value)}</span>
        </div>
    `;
}

function getNotePreview(note) {
    const text = String(note?.content || '')
        .replace(/\s+/g, ' ')
        .trim();

    if (text) {
        if (text.length <= 52) {
            return text;
        }
        return `${text.slice(0, 52)}...`;
    }

    if (note?.imageData) {
        return '图片笔记（点击查看详情）';
    }

    return '暂无正文内容';
}

const WEEKDAY_LABELS = [
    '\u5468\u65e5',
    '\u5468\u4e00',
    '\u5468\u4e8c',
    '\u5468\u4e09',
    '\u5468\u56db',
    '\u5468\u4e94',
    '\u5468\u516d'
];

function getReminderRepeatLabel(reminder) {
    const repeatType = String(reminder?.repeatType || 'once').toLowerCase();
    if (repeatType === 'daily') {
        return '\u6bcf\u5929';
    }

    if (repeatType === 'weekdays') {
        return '\u5de5\u4f5c\u65e5\uff08\u5468\u4e00-\u5468\u4e94\uff09';
    }

    if (repeatType === 'weekly') {
        const weekdays = Array.isArray(reminder?.repeatWeekdays)
            ? reminder.repeatWeekdays
                .map(item => Number(item))
                .filter(item => Number.isInteger(item) && item >= 0 && item <= 6)
                .sort((a, b) => a - b)
            : [];
        if (weekdays.length === 0) {
            return '\u6307\u5b9a\u661f\u671f';
        }

        const label = weekdays.map(item => WEEKDAY_LABELS[item]).join('\u3001');
        return `\u6bcf\u5468 ${label}`;
    }

    if (repeatType === 'monthly') {
        return '\u6bcf\u6708';
    }

    if (repeatType === 'yearly') {
        return '\u6bcf\u5e74';
    }

    return '\u4ec5\u4e00\u6b21';
}

export function renderDevicePanel(panelElement, snapshot) {
    if (!panelElement) {
        return;
    }

    if (!snapshot) {
        panelElement.innerHTML = '<p class="empty-text">正在加载设备信息...</p>';
        return;
    }

    const batteryLevel = Math.round((snapshot.battery?.level || 0) * 100);
    const networkStatus = snapshot.network?.connected ? '已连接' : '未连接';
    const charging = snapshot.battery?.charging ? '充电中' : '未充电';

    panelElement.innerHTML = [
        renderInfoRow('设备型号', snapshot.model, '📱'),
        renderInfoRow('系统版本', `${snapshot.operatingSystem} ${snapshot.osVersion}`, '💻'),
        renderInfoRow('设备厂商', snapshot.manufacturer, '🏭'),
        renderInfoRow('运行平台', snapshot.platform, '⚙️'),
        renderInfoRow('虚拟设备', snapshot.isVirtual ? '是' : '否', '🧪'),
        renderInfoRow('电量', `${batteryLevel}% (${charging})`, '🔋'),
        renderInfoRow('网络状态', `${networkStatus} / ${snapshot.network?.typeText || '未知'}`, '📶'),
        renderInfoRow('运行时长', snapshot.uptime, '⏱️')
    ].join('');
}

export function renderQrPanel(panelElement, qrResult, qrExplanation) {
    if (!panelElement) {
        return;
    }

    if (!qrResult) {
        panelElement.innerHTML = '<p class="empty-text">尚未识别二维码。</p>';
        return;
    }

    const actionHtml = qrExplanation?.actionType === 'url'
        ? `<button class="copy-btn" data-action="open-qr-url" data-url="${escapeHtml(qrExplanation.actionValue)}">打开链接</button>`
        : '';

    panelElement.innerHTML = `
        ${renderInfoRow('原始结果', qrResult.value, '🧾')}
        ${renderInfoRow('二维码格式', qrResult.format || 'QR_CODE', '🏷️')}
        ${renderInfoRow('数据类型', qrResult.valueType || 'UNKNOWN', '🧩')}
        ${renderInfoRow('解释类型', qrExplanation?.type || '文本', '🔍')}
        ${renderInfoRow('解释摘要', qrExplanation?.headline || '无', '💡')}
        ${renderInfoRow('解释详情', qrExplanation?.detail || '无', '📘')}
        <div class="panel-actions">${actionHtml}</div>
    `;
}

export function renderNoteDraftImage(panelElement, imageData) {
    if (!panelElement) {
        return;
    }

    if (!imageData) {
        panelElement.classList.add('hidden');
        panelElement.innerHTML = '';
        return;
    }

    panelElement.classList.remove('hidden');
    panelElement.innerHTML = `
        <p class="draft-label">附图预览</p>
        <img src="${escapeHtml(imageData)}" alt="Draft note image">
    `;
}

export function renderNotesPanel(panelElement, notes) {
    if (!panelElement) {
        return;
    }

    if (!Array.isArray(notes) || notes.length === 0) {
        panelElement.innerHTML = '<p class="empty-text">还没有笔记，点击右侧 + 新增第一条吧。</p>';
        return;
    }

    panelElement.innerHTML = notes
        .map(note => `
            <article class="note-list-item" data-action="view-note-detail" data-note-id="${escapeHtml(note.id)}">
                <div class="note-list-head">
                    <h3>${escapeHtml(note.title)}</h3>
                    <span class="note-list-time">${escapeHtml(formatDateTime(note.updatedAt))}</span>
                </div>
                <p class="note-list-preview">${escapeHtml(getNotePreview(note))}</p>
            </article>
        `)
        .join('');
}

export function renderNoteDetailPanel(panelElement, note) {
    if (!panelElement) {
        return;
    }

    if (!note) {
        panelElement.innerHTML = '<p class="empty-text">未找到笔记，可能已被删除。</p>';
        return;
    }

    const imageHtml = note.imageData
        ? `<img class="note-image" src="${escapeHtml(note.imageData)}" alt="note image">`
        : '';

    const bodyText = String(note.content || '').trim() || '(无正文内容)';

    panelElement.innerHTML = `
        <article class="note-card note-detail-card">
            <div class="note-header">
                <h3>${escapeHtml(note.title)}</h3>
                <button class="copy-btn" data-action="delete-note" data-note-id="${escapeHtml(note.id)}">删除笔记</button>
            </div>
            <div class="note-meta">更新于 ${escapeHtml(formatDateTime(note.updatedAt))}</div>
            <pre class="note-content note-detail-content">${escapeHtml(bodyText)}</pre>
            ${imageHtml}
        </article>
    `;
}

export function renderRemindersPanel(panelElement, reminders) {
    if (!panelElement) {
        return;
    }

    if (!Array.isArray(reminders) || reminders.length === 0) {
        panelElement.innerHTML = '<p class="empty-text">\u8fd8\u6ca1\u6709\u63d0\u9192\u4e8b\u9879\u3002</p>';
        return;
    }

    panelElement.innerHTML = reminders
        .map(reminder => `
            <article class="reminder-item">
                <div class="reminder-main">
                    <h3>${escapeHtml(reminder.title)}</h3>
                    <p>\u4e0b\u6b21\uff1a${escapeHtml(formatChinaDateTime(reminder.dueAt))}\uff08${escapeHtml(formatRelativeTime(reminder.dueAt))}\uff09</p>
                    <p class="reminder-tag reminder-repeat-tag">${escapeHtml(getReminderRepeatLabel(reminder))}</p>
                    <p class="reminder-tag">${reminder.scheduled ? '\u7cfb\u7edf\u901a\u77e5\u5df2\u5b89\u6392' : '\u4ec5\u672c\u5730\u8bb0\u5f55'}</p>
                </div>
                <button class="copy-btn" data-action="delete-reminder" data-reminder-id="${escapeHtml(reminder.id)}">\u5220\u9664</button>
            </article>
        `)
        .join('');
}

