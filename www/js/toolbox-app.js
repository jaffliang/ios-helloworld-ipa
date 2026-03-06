import { $ } from './core/dom.js';
import { getToolboxShell, APP_VIEWS } from './ui/layout.js';
import {
    renderDevicePanel,
    renderQrPanel,
    renderNoteDraftImage,
    renderNotesPanel,
    renderNoteDetailPanel,
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

const WEEKDAY_LABELS = [
    '\u5468\u65e5',
    '\u5468\u4e00',
    '\u5468\u4e8c',
    '\u5468\u4e09',
    '\u5468\u56db',
    '\u5468\u4e94',
    '\u5468\u516d'
];
const WORKDAY_WEEKDAYS = [1, 2, 3, 4, 5];

function toDateTimeLocalValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
}

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
            activeNoteId: '',
            notesMode: 'list',
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
        this.prepareReminderForm();
        this.setNotesMode('list');
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

        if (viewId === 'notes') {
            this.setNotesMode('list');
        }

        if (viewId === 'reminders') {
            this.state.reminders = getAllReminders();
            this.renderReminders();
            this.prepareReminderForm();
        }

        const appMain = $('#appMain', this.root);
        if (appMain) {
            appMain.scrollTop = 0;
        }
    }

    setNotesMode(mode = 'list', noteId = '') {
        this.state.notesMode = mode;
        if (noteId) {
            this.state.activeNoteId = String(noteId);
        }

        const listSection = $('#notesListSection', this.root);
        const detailSection = $('#noteDetailSection', this.root);
        const editorSection = $('#noteEditorSection', this.root);
        const floatingAddButton = $('#floatingNoteAddButton', this.root);
        const floatingBackButton = $('#floatingNoteBackButton', this.root);

        if (listSection) {
            listSection.classList.toggle('hidden', mode !== 'list');
        }

        if (detailSection) {
            detailSection.classList.toggle('hidden', mode !== 'detail');
        }

        if (editorSection) {
            editorSection.classList.toggle('hidden', mode !== 'editor');
        }

        if (floatingAddButton) {
            floatingAddButton.classList.toggle('hidden', mode !== 'list');
        }

        if (floatingBackButton) {
            floatingBackButton.classList.toggle('hidden', mode === 'list');
        }

        this.renderNoteDetail();
    }

    resetNoteEditor() {
        const form = $('#noteForm', this.root);
        if (form) {
            form.reset();
        }

        this.state.noteDraftImage = '';
        this.renderNoteDraft();
    }

    getNoteById(noteId) {
        if (!noteId) {
            return null;
        }

        return this.state.notes.find(note => note.id === String(noteId)) || null;
    }

    prepareReminderForm() {
        const reminderForm = $('#reminderForm', this.root);
        if (!reminderForm) {
            return;
        }

        const reminderAtInput = reminderForm.querySelector('input[name="reminderAt"]');
        if (reminderAtInput) {
            const minDate = new Date(Date.now() + 60 * 1000);
            minDate.setSeconds(0, 0);
            reminderAtInput.min = toDateTimeLocalValue(minDate);

            if (!reminderAtInput.value) {
                const defaultDate = new Date(Date.now() + 5 * 60 * 1000);
                defaultDate.setSeconds(0, 0);
                reminderAtInput.value = toDateTimeLocalValue(defaultDate);
            }
        }

        const repeatTypeSelect = $('#reminderRepeatType', reminderForm);
        if (repeatTypeSelect && !repeatTypeSelect.value) {
            repeatTypeSelect.value = 'once';
        }

        this.updateReminderRepeatControls();
    }

    getReminderRepeatHintText(repeatType, selectedWeekdays) {
        if (repeatType === 'daily') {
            return '\u5f53\u524d\uff1a\u6bcf\u5929\uff08\u6309\u5f53\u524d\u65f6\u95f4\u91cd\u590d\uff09';
        }

        if (repeatType === 'weekdays') {
            return '\u5f53\u524d\uff1a\u6bcf\u4e2a\u5de5\u4f5c\u65e5\uff08\u5468\u4e00\u5230\u5468\u4e94\uff09';
        }

        if (repeatType === 'weekly') {
            if (!Array.isArray(selectedWeekdays) || selectedWeekdays.length === 0) {
                return '\u5f53\u524d\uff1a\u8bf7\u9009\u62e9\u81f3\u5c11\u4e00\u4e2a\u661f\u671f';
            }

            const labels = selectedWeekdays.map(day => WEEKDAY_LABELS[day]).join('\u3001');
            return `\u5f53\u524d\uff1a\u6bcf\u5468 ${labels}`;
        }

        if (repeatType === 'monthly') {
            return '\u5f53\u524d\uff1a\u6bcf\u6708\uff08\u6309\u9009\u62e9\u65e5\u671f\uff09';
        }

        if (repeatType === 'yearly') {
            return '\u5f53\u524d\uff1a\u6bcf\u5e74\uff08\u6309\u9009\u62e9\u65e5\u671f\uff09';
        }

        return '\u5f53\u524d\uff1a\u4ec5\u4e00\u6b21';
    }

    updateReminderRepeatControls() {
        const reminderForm = $('#reminderForm', this.root);
        if (!reminderForm) {
            return;
        }

        const repeatTypeSelect = $('#reminderRepeatType', reminderForm);
        const repeatType = String(repeatTypeSelect?.value || 'once').toLowerCase();
        const weekdayField = $('#reminderWeekdayField', reminderForm);
        const weekdayInputs = Array.from(reminderForm.querySelectorAll('input[name="repeatWeekdays"]'));
        const reminderAtInput = reminderForm.querySelector('input[name="reminderAt"]');
        const reminderAtDate = reminderAtInput ? new Date(reminderAtInput.value) : new Date();
        const fallbackWeekday = Number.isNaN(reminderAtDate.getTime()) ? 1 : reminderAtDate.getDay();

        if (repeatType === 'weekly') {
            if (weekdayField) {
                weekdayField.classList.remove('hidden');
            }

            const hasChecked = weekdayInputs.some(input => input.checked);
            if (!hasChecked && weekdayInputs.length > 0) {
                const fallbackInput = weekdayInputs.find(input => Number(input.value) === fallbackWeekday) || weekdayInputs[0];
                if (fallbackInput) {
                    fallbackInput.checked = true;
                }
            }
        } else {
            if (weekdayField) {
                weekdayField.classList.add('hidden');
            }

            if (repeatType === 'weekdays') {
                weekdayInputs.forEach(input => {
                    input.checked = WORKDAY_WEEKDAYS.includes(Number(input.value));
                });
            } else {
                weekdayInputs.forEach(input => {
                    input.checked = false;
                });
            }
        }

        const selectedWeekdays = weekdayInputs
            .filter(input => input.checked)
            .map(input => Number(input.value))
            .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
            .sort((a, b) => a - b);

        const repeatHint = $('#reminderRepeatHint', reminderForm);
        if (repeatHint) {
            repeatHint.textContent = this.getReminderRepeatHintText(repeatType, selectedWeekdays);
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
        this.renderNoteDetail();
    }

    renderNoteDetail() {
        const note = this.getNoteById(this.state.activeNoteId);
        renderNoteDetailPanel($('#noteDetailPanel', this.root), note);

        if (this.state.notesMode === 'detail' && !note) {
            this.state.activeNoteId = '';
            this.setNotesMode('list');
        }
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

            case 'open-note-editor': {
                this.state.activeNoteId = '';
                this.resetNoteEditor();
                this.setNotesMode('editor');
                break;
            }

            case 'back-note-list': {
                this.state.activeNoteId = '';
                this.setNotesMode('list');
                break;
            }

            case 'view-note-detail': {
                const noteId = actionElement.dataset.noteId;
                if (!noteId) {
                    return;
                }

                this.state.activeNoteId = String(noteId);
                this.setNotesMode('detail', noteId);
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
                const confirmDeleteNote = window.confirm('确定删除这条笔记吗？此操作不可撤销。');
                if (!confirmDeleteNote) {
                    break;
                }
                this.state.notes = deleteNote(noteId);
                if (this.state.activeNoteId === String(noteId)) {
                    this.state.activeNoteId = '';
                    this.setNotesMode('list');
                }

                this.renderNotes();
                this.showToast('笔记已删除');
                break;
            }

            case 'delete-reminder': {
                const reminderId = actionElement.dataset.reminderId;
                if (!reminderId) {
                    return;
                }
                const confirmDeleteReminder = window.confirm('确定删除这条提醒吗？');
                if (!confirmDeleteReminder) {
                    break;
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
            this.state.activeNoteId = '';
            this.resetNoteEditor();
            this.renderNotes();
            this.setNotesMode('list');
            this.showToast('笔记已保存（已自动排版）');
            return;
        }

        if (form.id === 'reminderForm') {
            event.preventDefault();

            const formData = new FormData(form);
            const reminderTitle = String(formData.get('reminderTitle') || '').trim();
            const reminderAt = String(formData.get('reminderAt') || '').trim();
            const repeatType = String(formData.get('repeatType') || 'once').trim().toLowerCase();
            const repeatWeekdays = formData
                .getAll('repeatWeekdays')
                .map(item => Number(item))
                .filter(item => Number.isInteger(item) && item >= 0 && item <= 6);

            if (!reminderTitle || !reminderAt) {
                this.showToast('\u8bf7\u586b\u5199\u5b8c\u6574\u63d0\u9192\u4fe1\u606f');
                return;
            }

            if (repeatType === 'weekly' && repeatWeekdays.length === 0) {
                this.showToast('\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u661f\u671f');
                return;
            }

            try {
                const reminder = await addReminder(
                    {
                        title: reminderTitle,
                        dueAtLocal: reminderAt,
                        repeatType,
                        repeatWeekdays
                    },
                    {
                        schedule: scheduleReminderNotification
                    },
                );

                this.state.reminders = getAllReminders();
                form.reset();
                this.prepareReminderForm();
                this.renderReminders();

                const reminderMessage = reminder.scheduled
                    ? '\u63d0\u9192\u5df2\u521b\u5efa\u5e76\u5b89\u6392\u7cfb\u7edf\u901a\u77e5'
                    : '\u63d0\u9192\u5df2\u521b\u5efa\uff08\u7cfb\u7edf\u901a\u77e5\u4e0d\u53ef\u7528\uff09';
                this.showToast(reminderMessage);
            } catch (error) {
                this.showToast(`\u521b\u5efa\u63d0\u9192\u5931\u8d25\uff1a${error.message || '\u672a\u77e5\u9519\u8bef'}`);
            }
        }
    }

    async handleChange(event) {
        const target = event.target;
        if (target.id === 'reminderRepeatType' || target.name === 'repeatWeekdays' || target.name === 'reminderAt') {
            this.updateReminderRepeatControls();
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
            this.showToast('\u56fe\u7247\u4e0a\u4f20\u6210\u529f');
        } catch (error) {
            this.showToast(`\u56fe\u7247\u8bfb\u53d6\u5931\u8d25\uff1a${error.message || '\u672a\u77e5\u9519\u8bef'}`);
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

