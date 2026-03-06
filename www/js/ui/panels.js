import { escapeHtml, formatDateTime, formatRelativeTime } from '../core/dom.js';

function renderInfoRow(label, value, icon = '') {
    return `
        <div class="info-item">
            <span class="info-label"><span class="icon">${icon}</span>${escapeHtml(label)}</span>
            <span class="info-value">${escapeHtml(value)}</span>
        </div>
    `;
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
        panelElement.innerHTML = '<p class="empty-text">还没有笔记，先记第一条吧。</p>';
        return;
    }

    panelElement.innerHTML = notes
        .map(note => {
            const imageHtml = note.imageData
                ? `<img class="note-image" src="${escapeHtml(note.imageData)}" alt="note image">`
                : '';

            return `
                <article class="note-card">
                    <div class="note-header">
                        <h3>${escapeHtml(note.title)}</h3>
                        <button class="copy-btn" data-action="delete-note" data-note-id="${escapeHtml(note.id)}">删除</button>
                    </div>
                    <div class="note-meta">更新于 ${escapeHtml(formatDateTime(note.updatedAt))}</div>
                    <pre class="note-content">${escapeHtml(note.content || '(无文本内容)')}</pre>
                    ${imageHtml}
                </article>
            `;
        })
        .join('');
}

export function renderRemindersPanel(panelElement, reminders) {
    if (!panelElement) {
        return;
    }

    if (!Array.isArray(reminders) || reminders.length === 0) {
        panelElement.innerHTML = '<p class="empty-text">还没有提醒事项。</p>';
        return;
    }

    panelElement.innerHTML = reminders
        .map(reminder => `
            <article class="reminder-item">
                <div class="reminder-main">
                    <h3>${escapeHtml(reminder.title)}</h3>
                    <p>${escapeHtml(formatDateTime(reminder.dueAt))}（${escapeHtml(formatRelativeTime(reminder.dueAt))}）</p>
                    <p class="reminder-tag">${reminder.scheduled ? '系统通知已安排' : '仅本地记录'}</p>
                </div>
                <button class="copy-btn" data-action="delete-reminder" data-reminder-id="${escapeHtml(reminder.id)}">删除</button>
            </article>
        `)
        .join('');
}
