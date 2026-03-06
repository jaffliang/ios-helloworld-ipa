import { $ } from './core/dom.js';
import { getToolboxShell, APP_VIEWS } from './ui/layout.js';
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

export class ToolboxApp {
    constructor(rootSelector = '#app') {
        this.rootSelector = rootSelector;
        this.root = null;

        this.state = {
            activeView: 'home',
            snapshot: null,
            qrResult: null,
            qrExplanation: null,
            noteDraftImage: '',
            notes: [],
            reminders: []
        };

        this.toastTimer = null;
        this.uptimeTimer = null;

        this.handleClick = this.handleClick.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleChange = this.handleChange.bind(this);
    }

    async init() {
        this.root = document.querySelector(this.rootSelector);
        if (!this.root) {
            return;
        }

        this.root.innerHTML = getToolboxShell();
        this.bindEvents();

        await initDeviceService();

        this.state.notes = getAllNotes();
        this.state.reminders = getAllReminders();

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
        this.setActiveView(this.state.activeView);

        this.startUptimeTicker();
    }

    bindEvents() {
        this.root.addEventListener('click', this.handleClick);
        this.root.addEventListener('submit', this.handleSubmit);
        this.root.addEventListener('change', this.handleChange);
    }

    setActiveView(viewId) {
        if (!APP_VIEWS.includes(viewId)) {
            return;
        }

        this.state.activeView = viewId;

        this.root.querySelectorAll('[data-view-panel]').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.viewPanel === viewId);
        });

        this.root.querySelectorAll('[data-view-switch]').forEach(button => {
            button.classList.toggle('active', button.dataset.viewSwitch === viewId);
        });

        const appMain = $('#appMain', this.root);
        if (appMain) {
            appMain.scrollTop = 0;
        }
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
            case 'switch-view': {
                const viewId = actionElement.dataset.view || 'home';
                this.setActiveView(viewId);
                break;
            }

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
        }

        await removeNetworkStatusListener();
    }
}
