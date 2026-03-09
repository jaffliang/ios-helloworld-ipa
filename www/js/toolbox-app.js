import { $, formatChinaDateTime } from './core/dom.js';
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
const REMINDER_TIME_FIELD_IDS = new Set([
    'reminderAtYear',
    'reminderAtMonthOnce',
    'reminderAtDayOnce',
    'reminderAtHour',
    'reminderAtMinute',
    'reminderAtTimeHour',
    'reminderAtTimeMinute',
    'reminderAtMonthlyDay',
    'reminderAtMonthlyHour',
    'reminderAtMonthlyMinute',
    'reminderAtMonth',
    'reminderAtYearDay',
    'reminderAtYearlyHour',
    'reminderAtYearlyMinute'
]);

function pad2(value) {
    return String(value).padStart(2, '0');
}

function setSelectOptions(select, items, preferredValue = '') {
    if (!select) {
        return;
    }

    const current = preferredValue !== '' ? String(preferredValue) : String(select.value || '');
    select.innerHTML = items
        .map(item => `<option value="${String(item.value)}">${String(item.label)}</option>`)
        .join('');

    const hasCurrent = items.some(item => String(item.value) === current);
    if (hasCurrent) {
        select.value = current;
    } else if (items.length > 0) {
        select.value = String(items[0].value);
    }
}

function buildRangeOptions(start, end, labelFormatter = value => String(value), valueFormatter = value => String(value)) {
    const options = [];
    for (let value = start; value <= end; value += 1) {
        options.push({
            value: valueFormatter(value),
            label: labelFormatter(value)
        });
    }
    return options;
}

function toIntInRange(value, min, max) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        return null;
    }

    return parsed;
}

function buildTimeValue(hourValue, minuteValue) {
    const hour = toIntInRange(hourValue, 0, 23);
    const minute = toIntInRange(minuteValue, 0, 59);
    if (hour === null || minute === null) {
        return null;
    }

    return `${pad2(hour)}:${pad2(minute)}`;
}

function toLocalDateTimeString(year, month, day, timeValue) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${timeValue}`;
}

function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
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

        const now = new Date();
        const defaultDate = new Date(Date.now() + 5 * 60 * 1000);
        defaultDate.setSeconds(0, 0);

        const yearOptions = buildRangeOptions(
            now.getFullYear(),
            now.getFullYear() + 5,
            value => `${value}年`,
            value => String(value)
        );
        const monthOptions = buildRangeOptions(
            1,
            12,
            value => `${value}月`,
            value => String(value)
        );
        const hourOptions = buildRangeOptions(
            0,
            23,
            value => `${pad2(value)}时`,
            value => String(value)
        );
        const minuteOptions = buildRangeOptions(
            0,
            59,
            value => `${pad2(value)}分`,
            value => String(value)
        );

        setSelectOptions($('#reminderAtYear', reminderForm), yearOptions, defaultDate.getFullYear());
        setSelectOptions($('#reminderAtMonthOnce', reminderForm), monthOptions, defaultDate.getMonth() + 1);
        setSelectOptions($('#reminderAtHour', reminderForm), hourOptions, defaultDate.getHours());
        setSelectOptions($('#reminderAtMinute', reminderForm), minuteOptions, defaultDate.getMinutes());

        setSelectOptions($('#reminderAtTimeHour', reminderForm), hourOptions, defaultDate.getHours());
        setSelectOptions($('#reminderAtTimeMinute', reminderForm), minuteOptions, defaultDate.getMinutes());

        setSelectOptions($('#reminderAtMonthlyHour', reminderForm), hourOptions, defaultDate.getHours());
        setSelectOptions($('#reminderAtMonthlyMinute', reminderForm), minuteOptions, defaultDate.getMinutes());

        setSelectOptions($('#reminderAtMonth', reminderForm), monthOptions, now.getMonth() + 1);
        setSelectOptions($('#reminderAtYearlyHour', reminderForm), hourOptions, defaultDate.getHours());
        setSelectOptions($('#reminderAtYearlyMinute', reminderForm), minuteOptions, defaultDate.getMinutes());

        this.syncReminderDayOptions(reminderForm, {
            onceDay: defaultDate.getDate(),
            monthlyDay: now.getDate(),
            yearlyDay: now.getDate()
        });

        const repeatTypeSelect = $('#reminderRepeatType', reminderForm);
        if (repeatTypeSelect && !repeatTypeSelect.value) {
            repeatTypeSelect.value = 'once';
        }

        this.updateReminderRepeatControls();
    }

    getReminderTimeMode(repeatType) {
        if (repeatType === 'monthly') {
            return 'monthly';
        }

        if (repeatType === 'yearly') {
            return 'yearly';
        }

        if (repeatType === 'once') {
            return 'once';
        }

        return 'time';
    }

    syncReminderDayOptions(reminderForm, preferred = {}) {
        const onceYear = toIntInRange($('#reminderAtYear', reminderForm)?.value, 2000, 9999) || new Date().getFullYear();
        const onceMonth = toIntInRange($('#reminderAtMonthOnce', reminderForm)?.value, 1, 12) || 1;
        const onceMaxDay = daysInMonth(onceYear, onceMonth);

        const monthlyMaxDay = 31;
        const yearlyMonth = toIntInRange($('#reminderAtMonth', reminderForm)?.value, 1, 12) || 1;
        const yearlyMaxDay = yearlyMonth === 2 ? 29 : daysInMonth(2025, yearlyMonth);

        const dayLabelFormatter = value => `${value}日`;
        setSelectOptions(
            $('#reminderAtDayOnce', reminderForm),
            buildRangeOptions(1, onceMaxDay, dayLabelFormatter, value => String(value)),
            preferred.onceDay ?? $('#reminderAtDayOnce', reminderForm)?.value
        );
        setSelectOptions(
            $('#reminderAtMonthlyDay', reminderForm),
            buildRangeOptions(1, monthlyMaxDay, dayLabelFormatter, value => String(value)),
            preferred.monthlyDay ?? $('#reminderAtMonthlyDay', reminderForm)?.value
        );
        setSelectOptions(
            $('#reminderAtYearDay', reminderForm),
            buildRangeOptions(1, yearlyMaxDay, dayLabelFormatter, value => String(value)),
            preferred.yearlyDay ?? $('#reminderAtYearDay', reminderForm)?.value
        );
    }

    getOnceDateTimeFromForm(reminderForm) {
        const year = toIntInRange($('#reminderAtYear', reminderForm)?.value, 2000, 9999);
        const month = toIntInRange($('#reminderAtMonthOnce', reminderForm)?.value, 1, 12);
        const day = toIntInRange($('#reminderAtDayOnce', reminderForm)?.value, 1, 31);
        const timeValue = buildTimeValue(
            $('#reminderAtHour', reminderForm)?.value,
            $('#reminderAtMinute', reminderForm)?.value
        );

        if (year === null || month === null || day === null || !timeValue) {
            return '';
        }

        const maxDay = daysInMonth(year, month);
        if (day > maxDay) {
            return '';
        }

        return toLocalDateTimeString(year, month, day, timeValue);
    }

    updateReminderTimeFieldState(reminderForm, repeatType) {
        const mode = this.getReminderTimeMode(repeatType);

        const onceField = $('#reminderAtOnceField', reminderForm);
        const timeField = $('#reminderAtTimeField', reminderForm);
        const monthlyField = $('#reminderAtMonthlyField', reminderForm);
        const yearlyField = $('#reminderAtYearlyField', reminderForm);

        if (onceField) {
            onceField.classList.toggle('hidden', mode !== 'once');
        }
        if (timeField) {
            timeField.classList.toggle('hidden', mode !== 'time');
        }
        if (monthlyField) {
            monthlyField.classList.toggle('hidden', mode !== 'monthly');
        }
        if (yearlyField) {
            yearlyField.classList.toggle('hidden', mode !== 'yearly');
        }

        const onceRequired = mode === 'once';
        ['reminderAtYear', 'reminderAtMonthOnce', 'reminderAtDayOnce', 'reminderAtHour', 'reminderAtMinute']
            .forEach(id => {
                const element = $(`#${id}`, reminderForm);
                if (element) {
                    element.required = onceRequired;
                }
            });

        const timeRequired = mode === 'time';
        ['reminderAtTimeHour', 'reminderAtTimeMinute']
            .forEach(id => {
                const element = $(`#${id}`, reminderForm);
                if (element) {
                    element.required = timeRequired;
                }
            });

        const monthlyRequired = mode === 'monthly';
        ['reminderAtMonthlyDay', 'reminderAtMonthlyHour', 'reminderAtMonthlyMinute']
            .forEach(id => {
                const element = $(`#${id}`, reminderForm);
                if (element) {
                    element.required = monthlyRequired;
                }
            });

        const yearlyRequired = mode === 'yearly';
        ['reminderAtMonth', 'reminderAtYearDay', 'reminderAtYearlyHour', 'reminderAtYearlyMinute']
            .forEach(id => {
                const element = $(`#${id}`, reminderForm);
                if (element) {
                    element.required = yearlyRequired;
                }
            });
    }

    buildReminderDueAtLocal(formData, repeatType) {
        const now = new Date();

        if (repeatType === 'once') {
            const year = toIntInRange(formData.get('reminderAtYear'), 2000, 9999);
            const month = toIntInRange(formData.get('reminderAtMonthOnce'), 1, 12);
            const day = toIntInRange(formData.get('reminderAtDayOnce'), 1, 31);
            const timeValue = buildTimeValue(formData.get('reminderAtHour'), formData.get('reminderAtMinute'));
            if (year === null || month === null || day === null || !timeValue) {
                throw new Error('\u8bf7\u9009\u62e9\u63d0\u9192\u65f6\u95f4');
            }

            const maxDay = daysInMonth(year, month);
            if (day > maxDay) {
                throw new Error(`\u8be5\u6708\u4efd\u7684\u6709\u6548\u65e5\u671f\u4e3a 1-${maxDay}`);
            }

            const onceDateTime = toLocalDateTimeString(year, month, day, timeValue);
            if (new Date(onceDateTime).getTime() <= now.getTime()) {
                throw new Error('\u5355\u6b21\u63d0\u9192\u65f6\u95f4\u5fc5\u987b\u665a\u4e8e\u5f53\u524d\u65f6\u95f4');
            }

            return onceDateTime;
        }

        if (repeatType === 'daily' || repeatType === 'weekdays' || repeatType === 'weekly') {
            const timeValue = buildTimeValue(formData.get('reminderAtTimeHour'), formData.get('reminderAtTimeMinute'));
            if (!timeValue) {
                throw new Error('\u8bf7\u9009\u62e9\u6709\u6548\u7684\u63d0\u9192\u65f6\u95f4');
            }

            return toLocalDateTimeString(
                now.getFullYear(),
                now.getMonth() + 1,
                now.getDate(),
                timeValue
            );
        }

        if (repeatType === 'monthly') {
            const day = toIntInRange(formData.get('reminderAtMonthlyDay'), 1, 31);
            const timeValue = buildTimeValue(formData.get('reminderAtMonthlyHour'), formData.get('reminderAtMonthlyMinute'));

            if (day === null) {
                throw new Error('\u6bcf\u6708\u65e5\u671f\u9700\u5728 1-31 \u4e4b\u95f4');
            }

            if (!timeValue) {
                throw new Error('\u8bf7\u9009\u62e9\u6709\u6548\u7684\u63d0\u9192\u65f6\u95f4');
            }

            return toLocalDateTimeString(now.getFullYear(), 1, day, timeValue);
        }

        if (repeatType === 'yearly') {
            const month = toIntInRange(formData.get('reminderAtMonth'), 1, 12);
            const day = toIntInRange(formData.get('reminderAtYearDay'), 1, 31);
            const timeValue = buildTimeValue(formData.get('reminderAtYearlyHour'), formData.get('reminderAtYearlyMinute'));

            if (month === null) {
                throw new Error('\u8bf7\u9009\u62e9\u6709\u6548\u7684\u6708\u4efd');
            }

            const maxDay = month === 2 ? 29 : daysInMonth(2025, month);
            if (day === null || day > maxDay) {
                throw new Error(`\u8be5\u6708\u4efd\u7684\u6709\u6548\u65e5\u671f\u4e3a 1-${maxDay}`);
            }

            if (!timeValue) {
                throw new Error('\u8bf7\u9009\u62e9\u6709\u6548\u7684\u63d0\u9192\u65f6\u95f4');
            }

            const referenceYear = month === 2 && day === 29 ? 2024 : now.getFullYear();
            return toLocalDateTimeString(referenceYear, month, day, timeValue);
        }

        throw new Error('\u4e0d\u652f\u6301\u7684\u91cd\u590d\u89c4\u5219');
    }

    updateReminderTimeHint(reminderForm = $('#reminderForm', this.root)) {
        if (!reminderForm) {
            return;
        }

        const hint = $('#reminderTimeHint', reminderForm);
        if (!hint) {
            return;
        }

        const repeatTypeSelect = $('#reminderRepeatType', reminderForm);
        const repeatType = String(repeatTypeSelect?.value || 'once').toLowerCase();
        const mode = this.getReminderTimeMode(repeatType);

        if (mode === 'once') {
            const onceDateTime = this.getOnceDateTimeFromForm(reminderForm);
            const formatted = formatChinaDateTime(onceDateTime);
            hint.textContent = formatted === '--'
                ? '\u5f53\u524d\uff1a\u8bf7\u9009\u62e9\u63d0\u9192\u65f6\u95f4\uff08\u5317\u4eac\u65f6\u95f4\uff09'
                : `\u5f53\u524d\uff1a${formatted}\uff08\u5317\u4eac\u65f6\u95f4\uff09`;
            return;
        }

        if (mode === 'time') {
            const timeValue = buildTimeValue(
                $('#reminderAtTimeHour', reminderForm)?.value,
                $('#reminderAtTimeMinute', reminderForm)?.value
            );
            hint.textContent = timeValue
                ? `\u5f53\u524d\uff1a${timeValue}\uff08\u6bcf\u5929/\u6309\u661f\u671f\uff0c\u5317\u4eac\u65f6\u95f4\uff09`
                : '\u5f53\u524d\uff1a\u8bf7\u9009\u62e9\u63d0\u9192\u65f6\u95f4\uff08\u5317\u4eac\u65f6\u95f4\uff09';
            return;
        }

        if (mode === 'monthly') {
            const day = toIntInRange($('#reminderAtMonthlyDay', reminderForm)?.value, 1, 31);
            const timeValue = buildTimeValue(
                $('#reminderAtMonthlyHour', reminderForm)?.value,
                $('#reminderAtMonthlyMinute', reminderForm)?.value
            );
            if (day !== null && timeValue) {
                hint.textContent = `\u5f53\u524d\uff1a\u6bcf\u6708 ${day}\u65e5 ${timeValue}\uff08\u5317\u4eac\u65f6\u95f4\uff09`;
            } else {
                hint.textContent = '\u5f53\u524d\uff1a\u8bf7\u9009\u62e9\u6bcf\u6708\u65e5\u671f\u548c\u65f6\u95f4\uff08\u5317\u4eac\u65f6\u95f4\uff09';
            }
            return;
        }

        const month = toIntInRange($('#reminderAtMonth', reminderForm)?.value, 1, 12);
        const day = toIntInRange($('#reminderAtYearDay', reminderForm)?.value, 1, 31);
        const timeValue = buildTimeValue(
            $('#reminderAtYearlyHour', reminderForm)?.value,
            $('#reminderAtYearlyMinute', reminderForm)?.value
        );
        const maxDay = month === null ? 31 : (month === 2 ? 29 : daysInMonth(2025, month));
        if (month !== null && day !== null && day <= maxDay && timeValue) {
            hint.textContent = `\u5f53\u524d\uff1a\u6bcf\u5e74 ${month}\u6708${day}\u65e5 ${timeValue}\uff08\u5317\u4eac\u65f6\u95f4\uff09`;
        } else {
            hint.textContent = '\u5f53\u524d\uff1a\u8bf7\u9009\u62e9\u6bcf\u5e74\u6708\u65e5\u548c\u65f6\u95f4\uff08\u5317\u4eac\u65f6\u95f4\uff09';
        }
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
        this.syncReminderDayOptions(reminderForm);
        this.updateReminderTimeFieldState(reminderForm, repeatType);

        const weekdayField = $('#reminderWeekdayField', reminderForm);
        const weekdayInputs = Array.from(reminderForm.querySelectorAll('input[name="repeatWeekdays"]'));
        const onceInputDate = new Date(this.getOnceDateTimeFromForm(reminderForm));
        const fallbackWeekday = Number.isNaN(onceInputDate.getTime()) ? new Date().getDay() : onceInputDate.getDay();

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

        this.updateReminderTimeHint(reminderForm);
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
            const repeatType = String(formData.get('repeatType') || 'once').trim().toLowerCase();
            const repeatWeekdays = formData
                .getAll('repeatWeekdays')
                .map(item => Number(item))
                .filter(item => Number.isInteger(item) && item >= 0 && item <= 6);

            if (!reminderTitle) {
                this.showToast('\u8bf7\u586b\u5199\u5b8c\u6574\u63d0\u9192\u4fe1\u606f');
                return;
            }

            if (repeatType === 'weekly' && repeatWeekdays.length === 0) {
                this.showToast('\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u661f\u671f');
                return;
            }

            try {
                const dueAtLocal = this.buildReminderDueAtLocal(formData, repeatType);
                const reminder = await addReminder(
                    {
                        title: reminderTitle,
                        dueAtLocal,
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
        if (
            target.id === 'reminderRepeatType'
            || target.name === 'repeatWeekdays'
            || REMINDER_TIME_FIELD_IDS.has(target.id)
        ) {
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

