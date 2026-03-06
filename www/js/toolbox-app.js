import { $ } from './core/dom.js';
import { readJSON, writeJSON } from './core/storage.js';
import { getToolboxShell, TOOL_CARD_IDS, getToolCardLabel } from './ui/layout.js';
import {
    renderDevicePanel,
    renderQrPanel,
    renderNoteDraftImage,
    renderNotesPanel,
    renderRemindersPanel
} from './ui/panels.js';
import {
    initDeviceService,
    getDeviceSnapshot,
    addNetworkStatusListener,
    removeNetworkStatusListener,
    refreshUptime,
    triggerHaptics,
    copyText,
    sendTestNotification,
    scheduleReminderNotification,
    cancelReminderNotification
} from './services/device-service.js';
import {
    capturePhotoFromCamera,
    pickPhotoForNote,
    scanQrCodeLive,
    scanQrCodeFromPhotoLibrary,
    readFileAsDataUrl,
    explainQrPayload
} from './services/media-service.js';
import {
    getAllNotes,
    addNote,
    deleteNote
} from './services/notes-service.js';
import {
    getAllReminders,
    addReminder,
    removeReminder
} from './services/reminder-service.js';

const TOOL_LAYOUT_KEY = 'jeff_toolbox_tool_layout_v1';

function getDefaultLayout() {
    return {
        order: [...TOOL_CARD_IDS],
        visibility: Object.fromEntries(TOOL_CARD_IDS.map(id => [id, true]))
    };
}

function normalizeLayout(layout) {
    const defaults = getDefaultLayout();
    if (!layout || typeof layout !== 'object') {
        return defaults;
    }

    const incomingOrder = Array.isArray(layout.order) ? layout.order : [];
    const order = incomingOrder.filter(id => TOOL_CARD_IDS.includes(id));

    for (const id of TOOL_CARD_IDS) {
        if (!order.includes(id)) {
            order.push(id);
        }
    }

    const incomingVisibility = layout.visibility && typeof layout.visibility === 'object'
        ? layout.visibility
        : {};

    const visibility = {};
    for (const id of TOOL_CARD_IDS) {
        visibility[id] = incomingVisibility[id] !== false;
    }

    return { order, visibility };
}

function moveItem(order, fromIndex, toIndex) {
    if (
        fromIndex < 0
        || toIndex < 0
        || fromIndex >= order.length
        || toIndex >= order.length
        || fromIndex === toIndex
    ) {
        return order;
    }

    const cloned = [...order];
    const [item] = cloned.splice(fromIndex, 1);
    cloned.splice(toIndex, 0, item);
    return cloned;
}

export class ToolboxApp {
    constructor(rootSelector = '#app') {
        this.rootSelector = rootSelector;
        this.root = null;

        this.state = {
            snapshot: null,
            qrResult: null,
            qrExplanation: null,
            noteDraftImage: '',
            notes: [],
            reminders: [],
            layout: getDefaultLayout(),
            draggingToolId: ''
        };

        this.toastTimer = null;
        this.uptimeTimer = null;

        this.handleClick = this.handleClick.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleDragStart = this.handleDragStart.bind(this);
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
        this.handleDrop = this.handleDrop.bind(this);
        this.handleDragEnd = this.handleDragEnd.bind(this);
    }

    async init() {
        this.root = document.querySelector(this.rootSelector);
        if (!this.root) {
            return;
        }

        this.root.innerHTML = getToolboxShell();
        this.state.layout = normalizeLayout(readJSON(TOOL_LAYOUT_KEY, getDefaultLayout()));
        this.bindEvents();

        await initDeviceService();

        this.state.notes = getAllNotes();
        this.state.reminders = getAllReminders();

        this.renderLayoutControls();
        this.applyLayoutToDashboard();

        await this.refreshDeviceInfo(false);
        await addNetworkStatusListener(network => {
            if (!this.state.snapshot) {
                return;
            }

            this.state.snapshot = {
                ...this.state.snapshot,
                network
            };
            this.renderDevice();
        });

        this.renderNotes();
        this.renderReminders();
        this.renderQr();
        this.renderNoteDraft();

        this.startUptimeTicker();
    }

    bindEvents() {
        this.root.addEventListener('click', this.handleClick);
        this.root.addEventListener('submit', this.handleSubmit);
        this.root.addEventListener('change', this.handleChange);
        this.root.addEventListener('dragstart', this.handleDragStart);
        this.root.addEventListener('dragover', this.handleDragOver);
        this.root.addEventListener('dragleave', this.handleDragLeave);
        this.root.addEventListener('drop', this.handleDrop);
        this.root.addEventListener('dragend', this.handleDragEnd);
    }

    startUptimeTicker() {
        if (this.uptimeTimer) {
            clearInterval(this.uptimeTimer);
        }

        this.uptimeTimer = setInterval(() => {
            if (!this.state.snapshot) {
                return;
            }

            this.state.snapshot = refreshUptime(this.state.snapshot);
            this.renderDevice();
        }, 1000);
    }

    saveLayout() {
        writeJSON(TOOL_LAYOUT_KEY, this.state.layout);
    }

    renderLayoutControls() {
        const list = $('#toolLayoutList', this.root);
        if (!list) {
            return;
        }

        list.innerHTML = this.state.layout.order
            .map((toolId, index) => {
                const checked = this.state.layout.visibility[toolId] !== false;
                const checkedHtml = checked ? 'checked' : '';
                const isFirst = index === 0;
                const isLast = index === this.state.layout.order.length - 1;

                return `
                    <li class="layout-item" data-tool-id="${toolId}" draggable="true">
                        <span class="layout-handle" title="拖拽排序">⠿</span>
                        <label class="layout-toggle-wrap">
                            <input type="checkbox" class="layout-toggle" data-tool-id="${toolId}" ${checkedHtml}>
                            <span>${getToolCardLabel(toolId)}</span>
                        </label>
                        <div class="layout-item-actions">
                            <button type="button" class="layout-mini-btn" data-action="move-tool-up" data-tool-id="${toolId}" ${isFirst ? 'disabled' : ''}>↑</button>
                            <button type="button" class="layout-mini-btn" data-action="move-tool-down" data-tool-id="${toolId}" ${isLast ? 'disabled' : ''}>↓</button>
                        </div>
                    </li>
                `;
            })
            .join('');
    }

    applyLayoutToDashboard() {
        const dashboard = $('#dashboardGrid', this.root);
        if (!dashboard) {
            return;
        }

        const cards = Array.from(dashboard.querySelectorAll('[data-tool-card]'));
        const cardMap = new Map(cards.map(card => [card.dataset.toolCard, card]));

        for (const toolId of this.state.layout.order) {
            const card = cardMap.get(toolId);
            if (!card) {
                continue;
            }
            dashboard.appendChild(card);
        }

        for (const [toolId, card] of cardMap.entries()) {
            const visible = this.state.layout.visibility[toolId] !== false;
            card.classList.toggle('hidden', !visible);
        }
    }

    moveToolToIndex(toolId, toIndex) {
        const fromIndex = this.state.layout.order.indexOf(toolId);
        if (fromIndex < 0) {
            return;
        }

        this.state.layout.order = moveItem(this.state.layout.order, fromIndex, toIndex);
        this.saveLayout();
        this.renderLayoutControls();
        this.applyLayoutToDashboard();
    }

    moveToolBefore(draggedToolId, targetToolId) {
        const toIndex = this.state.layout.order.indexOf(targetToolId);
        if (toIndex < 0) {
            return;
        }

        this.moveToolToIndex(draggedToolId, toIndex);
    }

    moveToolByStep(toolId, step) {
        const index = this.state.layout.order.indexOf(toolId);
        if (index < 0) {
            return;
        }

        const nextIndex = index + step;
        if (nextIndex < 0 || nextIndex >= this.state.layout.order.length) {
            return;
        }

        this.moveToolToIndex(toolId, nextIndex);
    }

    resetLayout() {
        this.state.layout = getDefaultLayout();
        this.saveLayout();
        this.renderLayoutControls();
        this.applyLayoutToDashboard();
        this.showToast('布局已恢复默认');
    }

    handleDragStart(event) {
        const item = event.target.closest('.layout-item');
        if (!item) {
            return;
        }

        this.state.draggingToolId = item.dataset.toolId || '';
        item.classList.add('dragging');

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', this.state.draggingToolId);
        }
    }

    handleDragOver(event) {
        const targetItem = event.target.closest('.layout-item');
        if (!targetItem || !this.state.draggingToolId) {
            return;
        }

        event.preventDefault();
        targetItem.classList.add('drag-over');
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    handleDragLeave(event) {
        const targetItem = event.target.closest('.layout-item');
        if (!targetItem) {
            return;
        }

        targetItem.classList.remove('drag-over');
    }

    handleDrop(event) {
        const targetItem = event.target.closest('.layout-item');
        if (!targetItem) {
            return;
        }

        event.preventDefault();

        const draggedToolId = this.state.draggingToolId
            || event.dataTransfer?.getData('text/plain')
            || '';
        const targetToolId = targetItem.dataset.toolId || '';

        if (draggedToolId && targetToolId && draggedToolId !== targetToolId) {
            this.moveToolBefore(draggedToolId, targetToolId);
            this.showToast('已调整工具顺序');
        }

        targetItem.classList.remove('drag-over');
    }

    handleDragEnd() {
        this.state.draggingToolId = '';
        this.root.querySelectorAll('.layout-item').forEach(item => {
            item.classList.remove('dragging');
            item.classList.remove('drag-over');
        });
    }

    async refreshDeviceInfo(showToast = true) {
        this.state.snapshot = await getDeviceSnapshot();
        this.renderDevice();

        if (showToast) {
            this.showToast('设备信息已刷新');
        }
    }

    renderDevice() {
        renderDevicePanel($('#devicePanel', this.root), this.state.snapshot);
    }

    renderQr() {
        renderQrPanel(
            $('#qrPanel', this.root),
            this.state.qrResult,
            this.state.qrExplanation,
        );
    }

    renderNoteDraft() {
        renderNoteDraftImage($('#noteDraftImage', this.root), this.state.noteDraftImage);
    }

    renderNotes() {
        renderNotesPanel($('#notesPanel', this.root), this.state.notes);
    }

    renderReminders() {
        renderRemindersPanel($('#remindersPanel', this.root), this.state.reminders);
    }

    async handleClick(event) {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) {
            return;
        }

        const { action } = actionElement.dataset;

        switch (action) {
            case 'refresh-device': {
                await triggerHaptics('light');
                await this.refreshDeviceInfo(true);
                break;
            }

            case 'test-haptics': {
                await triggerHaptics('heavy');
                this.showToast('震动测试完成');
                break;
            }

            case 'test-notification': {
                const ok = await sendTestNotification('Jeff的工具箱', '这是一条测试通知');
                this.showToast(ok ? '测试通知已发送' : '通知不可用，已跳过');
                break;
            }

            case 'copy-device': {
                if (!this.state.snapshot) {
                    this.showToast('设备信息还没加载完成');
                    break;
                }

                const content = [
                    'Jeff的工具箱 - 设备摘要',
                    '=========================',
                    `型号: ${this.state.snapshot.model}`,
                    `系统: ${this.state.snapshot.operatingSystem} ${this.state.snapshot.osVersion}`,
                    `网络: ${this.state.snapshot.network?.typeText || '未知'}`,
                    `电量: ${Math.round((this.state.snapshot.battery?.level || 0) * 100)}%`,
                    `运行时长: ${this.state.snapshot.uptime}`
                ].join('\n');

                const copied = await copyText(content);
                this.showToast(copied ? '设备摘要已复制' : '复制失败');
                break;
            }

            case 'scan-qr-live': {
                const result = await scanQrCodeLive();
                if (!result) {
                    this.showToast('未识别到二维码');
                    return;
                }

                this.state.qrResult = result;
                this.state.qrExplanation = explainQrPayload(result.value);
                this.renderQr();
                await triggerHaptics('medium');
                this.showToast('二维码识别成功');
                break;
            }

            case 'scan-qr-image': {
                const result = await scanQrCodeFromPhotoLibrary();
                if (!result) {
                    this.showToast('图片中未识别到二维码');
                    return;
                }

                this.state.qrResult = result;
                this.state.qrExplanation = explainQrPayload(result.value);
                this.renderQr();
                this.showToast('图片二维码识别成功');
                break;
            }

            case 'copy-qr-result': {
                const value = this.state.qrResult?.value || '';
                if (!value) {
                    this.showToast('暂无二维码结果可复制');
                    return;
                }

                const copied = await copyText(value);
                this.showToast(copied ? '二维码内容已复制' : '复制失败');
                break;
            }

            case 'open-qr-url': {
                const url = actionElement.dataset.url || '';
                if (!url) {
                    return;
                }

                window.open(url, '_blank');
                break;
            }

            case 'note-camera': {
                const imageData = await capturePhotoFromCamera();
                if (!imageData) {
                    this.showToast('拍照失败或已取消');
                    return;
                }

                this.state.noteDraftImage = imageData;
                this.renderNoteDraft();
                this.showToast('已添加拍照图片');
                break;
            }

            case 'note-pick-photo': {
                const imageData = await pickPhotoForNote();
                if (!imageData) {
                    this.showToast('选择图片失败或已取消');
                    return;
                }

                this.state.noteDraftImage = imageData;
                this.renderNoteDraft();
                this.showToast('已添加相册图片');
                break;
            }

            case 'clear-note-image': {
                this.state.noteDraftImage = '';
                this.renderNoteDraft();
                this.showToast('已清除附图');
                break;
            }

            case 'delete-note': {
                const noteId = actionElement.dataset.noteId;
                if (!noteId) {
                    return;
                }

                this.state.notes = deleteNote(noteId);
                this.renderNotes();
                this.showToast('笔记已删除');
                break;
            }

            case 'delete-reminder': {
                const reminderId = actionElement.dataset.reminderId;
                if (!reminderId) {
                    return;
                }

                this.state.reminders = await removeReminder(reminderId, {
                    cancel: cancelReminderNotification
                });
                this.renderReminders();
                this.showToast('提醒已删除');
                break;
            }

            case 'move-tool-up': {
                const toolId = actionElement.dataset.toolId || '';
                this.moveToolByStep(toolId, -1);
                break;
            }

            case 'move-tool-down': {
                const toolId = actionElement.dataset.toolId || '';
                this.moveToolByStep(toolId, 1);
                break;
            }

            case 'reset-layout': {
                this.resetLayout();
                break;
            }

            default:
                break;
        }
    }

    async handleSubmit(event) {
        const form = event.target;

        if (form.id === 'noteForm') {
            event.preventDefault();

            const formData = new FormData(form);
            const noteTitle = String(formData.get('noteTitle') || '').trim();
            const noteContent = String(formData.get('noteContent') || '').trim();

            if (!noteContent && !this.state.noteDraftImage) {
                this.showToast('请输入笔记内容或添加图片');
                return;
            }

            addNote({
                title: noteTitle,
                content: noteContent,
                imageData: this.state.noteDraftImage
            });

            this.state.notes = getAllNotes();
            this.state.noteDraftImage = '';
            form.reset();
            this.renderNotes();
            this.renderNoteDraft();
            this.showToast('笔记已保存（已自动排版）');
            return;
        }

        if (form.id === 'reminderForm') {
            event.preventDefault();

            const formData = new FormData(form);
            const reminderTitle = String(formData.get('reminderTitle') || '').trim();
            const reminderAt = String(formData.get('reminderAt') || '').trim();

            if (!reminderTitle || !reminderAt) {
                this.showToast('请填写完整提醒信息');
                return;
            }

            try {
                const reminder = await addReminder(
                    {
                        title: reminderTitle,
                        dueAtLocal: reminderAt
                    },
                    {
                        schedule: scheduleReminderNotification
                    },
                );

                this.state.reminders = getAllReminders();
                form.reset();
                this.renderReminders();

                const reminderMessage = reminder.scheduled
                    ? '提醒已创建并安排系统通知'
                    : '提醒已创建（系统通知不可用）';
                this.showToast(reminderMessage);
            } catch (error) {
                this.showToast(`创建提醒失败：${error.message || '未知错误'}`);
            }
        }
    }

    async handleChange(event) {
        const target = event.target;

        if (target.classList.contains('layout-toggle')) {
            const toolId = target.dataset.toolId || '';
            if (!TOOL_CARD_IDS.includes(toolId)) {
                return;
            }

            this.state.layout.visibility[toolId] = target.checked;
            this.saveLayout();
            this.applyLayoutToDashboard();
            return;
        }

        if (target.id !== 'noteImageInput') {
            return;
        }

        const file = target.files?.[0];
        if (!file) {
            return;
        }

        try {
            const imageData = await readFileAsDataUrl(file);
            this.state.noteDraftImage = imageData;
            this.renderNoteDraft();
            this.showToast('图片上传成功');
        } catch (error) {
            this.showToast(`图片读取失败：${error.message || '未知错误'}`);
        } finally {
            target.value = '';
        }
    }

    showToast(message, duration = 2200) {
        const toast = $('#toast', this.root);
        if (!toast) {
            return;
        }

        toast.textContent = String(message || '');
        toast.classList.add('show');

        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }

        this.toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    async destroy() {
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
            this.toastTimer = null;
        }

        if (this.uptimeTimer) {
            clearInterval(this.uptimeTimer);
            this.uptimeTimer = null;
        }

        if (this.root) {
            this.root.removeEventListener('click', this.handleClick);
            this.root.removeEventListener('submit', this.handleSubmit);
            this.root.removeEventListener('change', this.handleChange);
            this.root.removeEventListener('dragstart', this.handleDragStart);
            this.root.removeEventListener('dragover', this.handleDragOver);
            this.root.removeEventListener('dragleave', this.handleDragLeave);
            this.root.removeEventListener('drop', this.handleDrop);
            this.root.removeEventListener('dragend', this.handleDragEnd);
        }

        await removeNetworkStatusListener();
    }
}
