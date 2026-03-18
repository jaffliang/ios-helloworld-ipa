import { readJSON, writeJSON } from '../core/storage.js';

const REMINDERS_KEY = 'jeff_toolbox_reminders_v1';
const VALID_REPEAT_TYPES = new Set(['once', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly']);
const WORKDAY_WEEKDAYS = [1, 2, 3, 4, 5];

function normalizeRepeatType(value) {
    const parsed = String(value || 'once').trim().toLowerCase();
    return VALID_REPEAT_TYPES.has(parsed) ? parsed : 'once';
}

function normalizeWeekdays(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    const weekdays = value
        .map(item => Number(item))
        .filter(item => Number.isInteger(item) && item >= 0 && item <= 6);

    return Array.from(new Set(weekdays)).sort((a, b) => a - b);
}

function normalizeNotificationIds(item) {
    const fromArray = Array.isArray(item?.notificationIds) ? item.notificationIds : [];
    const fromSingle = item?.notificationId ? [item.notificationId] : [];
    const merged = [...fromArray, ...fromSingle]
        .map(id => Number(id))
        .filter(id => Number.isInteger(id) && id > 0);

    return Array.from(new Set(merged));
}

function parseDate(value, fallback = new Date()) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return new Date(fallback);
    }
    return date;
}

function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
}

function getTimeParts(date) {
    return {
        hour: date.getHours(),
        minute: date.getMinutes()
    };
}

function getNextDateByWeekdays(weekdays, timeParts, nowDate) {
    if (!Array.isArray(weekdays) || weekdays.length === 0) {
        return null;
    }

    let nextDate = null;
    weekdays.forEach(weekday => {
        const candidate = new Date(nowDate);
        const offset = (weekday - candidate.getDay() + 7) % 7;
        candidate.setDate(candidate.getDate() + offset);
        candidate.setHours(timeParts.hour, timeParts.minute, 0, 0);
        if (candidate.getTime() <= nowDate.getTime()) {
            candidate.setDate(candidate.getDate() + 7);
        }

        if (!nextDate || candidate.getTime() < nextDate.getTime()) {
            nextDate = candidate;
        }
    });

    return nextDate;
}

function getNextMonthlyDate(startDate, nowDate) {
    const day = Math.min(startDate.getDate(), 28);
    const timeParts = getTimeParts(startDate);
    let year = nowDate.getFullYear();
    let month = nowDate.getMonth();

    let candidate = new Date(
        year,
        month,
        day,
        timeParts.hour,
        timeParts.minute,
        0,
        0
    );

    if (candidate.getTime() <= nowDate.getTime()) {
        month += 1;
        if (month > 11) {
            month = 0;
            year += 1;
        }

        candidate = new Date(
            year,
            month,
            day,
            timeParts.hour,
            timeParts.minute,
            0,
            0
        );
    }

    return candidate;
}

function getNextYearlyDate(startDate, nowDate) {
    const month = startDate.getMonth();
    const day = startDate.getDate();
    const timeParts = getTimeParts(startDate);
    let year = nowDate.getFullYear();

    let candidate = new Date(
        year,
        month,
        Math.min(day, daysInMonth(year, month)),
        timeParts.hour,
        timeParts.minute,
        0,
        0
    );

    if (candidate.getTime() <= nowDate.getTime()) {
        year += 1;
        candidate = new Date(
            year,
            month,
            Math.min(day, daysInMonth(year, month)),
            timeParts.hour,
            timeParts.minute,
            0,
            0
        );
    }

    return candidate;
}

function resolveRepeatWeekdays(repeatType, weekdays, startDate) {
    if (repeatType === 'weekdays') {
        return [...WORKDAY_WEEKDAYS];
    }

    if (repeatType === 'weekly') {
        const normalized = normalizeWeekdays(weekdays);
        if (normalized.length > 0) {
            return normalized;
        }
        return [startDate.getDay()];
    }

    return [];
}

function getNextDueDate(startDate, repeatType, repeatWeekdays, nowDate = new Date()) {
    if (repeatType === 'once') {
        return startDate.getTime() > nowDate.getTime() ? new Date(startDate) : null;
    }

    const timeParts = getTimeParts(startDate);

    if (repeatType === 'daily') {
        const candidate = new Date(nowDate);
        candidate.setHours(timeParts.hour, timeParts.minute, 0, 0);
        if (candidate.getTime() <= nowDate.getTime()) {
            candidate.setDate(candidate.getDate() + 1);
        }
        return candidate;
    }

    if (repeatType === 'weekdays' || repeatType === 'weekly') {
        return getNextDateByWeekdays(repeatWeekdays, timeParts, nowDate);
    }

    if (repeatType === 'monthly') {
        return getNextMonthlyDate(startDate, nowDate);
    }

    if (repeatType === 'yearly') {
        return getNextYearlyDate(startDate, nowDate);
    }

    return null;
}

function normalizeReminder(item, nowDate = new Date()) {
    const createdAt = String(item?.createdAt || new Date().toISOString());
    const startAtDate = parseDate(item?.startAt || item?.dueAt || createdAt, nowDate);
    const repeatType = normalizeRepeatType(item?.repeatType);
    const repeatWeekdays = resolveRepeatWeekdays(repeatType, item?.repeatWeekdays, startAtDate);
    const rawDueAt = parseDate(item?.dueAt || item?.startAt || createdAt, startAtDate);
    const nextDueDate = repeatType === 'once'
        ? rawDueAt
        : (getNextDueDate(startAtDate, repeatType, repeatWeekdays, nowDate) || startAtDate);
    const notificationIds = normalizeNotificationIds(item);

    return {
        id: String(item?.id || ''),
        title: String(item?.title || '\u63d0\u9192'),
        startAt: startAtDate.toISOString(),
        dueAt: nextDueDate.toISOString(),
        repeatType,
        repeatWeekdays,
        createdAt,
        notificationIds,
        notificationId: notificationIds[0] || 0,
        scheduled: Boolean(item?.scheduled)
    };
}

function loadReminders() {
    const reminders = readJSON(REMINDERS_KEY, []);
    if (!Array.isArray(reminders)) {
        return [];
    }

    return reminders
        .map(item => normalizeReminder(item, new Date()))
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

function persistReminders(reminders) {
    writeJSON(REMINDERS_KEY, reminders);
}

function createNotificationId() {
    return Math.floor((Date.now() + Math.floor(Math.random() * 1000)) % 2000000000);
}

export function getAllReminders() {
    return loadReminders();
}

export async function addReminder({ title, dueAtLocal, repeatType, repeatWeekdays }, notifier = {}) {
    const dueAtDate = new Date(dueAtLocal);
    if (Number.isNaN(dueAtDate.getTime())) {
        throw new Error('\u63d0\u9192\u65f6\u95f4\u683c\u5f0f\u4e0d\u6b63\u786e');
    }

    const normalizedRepeatType = normalizeRepeatType(repeatType);
    const normalizedRepeatWeekdays = resolveRepeatWeekdays(normalizedRepeatType, repeatWeekdays, dueAtDate);
    const nowDate = new Date();
    const nextDueDate = getNextDueDate(dueAtDate, normalizedRepeatType, normalizedRepeatWeekdays, nowDate);

    if (!nextDueDate) {
        throw new Error('\u63d0\u9192\u65f6\u95f4\u5fc5\u987b\u665a\u4e8e\u5f53\u524d\u65f6\u95f4');
    }

    const reminders = loadReminders();
    const nowIso = nowDate.toISOString();
    const notificationCount = normalizedRepeatType === 'weekly'
        ? normalizedRepeatWeekdays.length
        : (normalizedRepeatType === 'weekdays' ? WORKDAY_WEEKDAYS.length : 1);
    const notificationIds = Array.from({ length: Math.max(1, notificationCount) }, () => createNotificationId());

    const reminder = {
        id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        title: String(title || '').trim() || '\u63d0\u9192\u4e8b\u9879',
        startAt: dueAtDate.toISOString(),
        dueAt: nextDueDate.toISOString(),
        repeatType: normalizedRepeatType,
        repeatWeekdays: normalizedRepeatWeekdays,
        createdAt: nowIso,
        notificationIds,
        notificationId: notificationIds[0] || 0,
        scheduled: false
    };

    if (typeof notifier.schedule === 'function') {
        const scheduleResult = await notifier.schedule({
            notificationId: reminder.notificationId,
            notificationIds: reminder.notificationIds,
            title: 'Jeff\u7684\u5de5\u5177\u7bb1\u63d0\u9192',
            body: reminder.title,
            dueAt: reminder.dueAt,
            startAt: reminder.startAt,
            repeatType: reminder.repeatType,
            repeatWeekdays: reminder.repeatWeekdays
        });

        if (typeof scheduleResult === 'boolean') {
            reminder.scheduled = scheduleResult;
        } else if (scheduleResult && typeof scheduleResult === 'object') {
            reminder.scheduled = Boolean(scheduleResult.scheduled);
            const scheduledIds = normalizeNotificationIds(scheduleResult);
            if (reminder.scheduled && scheduledIds.length > 0) {
                reminder.notificationIds = scheduledIds;
                reminder.notificationId = scheduledIds[0];
            }
        }
    }

    reminders.push(reminder);
    reminders.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    persistReminders(reminders);

    return reminder;
}

export async function removeReminder(reminderId, notifier = {}) {
    const reminders = loadReminders();
    const target = reminders.find(item => item.id === String(reminderId));
    const cancelIds = Array.isArray(target?.notificationIds) && target.notificationIds.length > 0
        ? target.notificationIds
        : (target?.notificationId ? [target.notificationId] : []);

    if (target && typeof notifier.cancel === 'function' && cancelIds.length > 0) {
        await notifier.cancel(cancelIds);
    }

    const filtered = reminders.filter(item => item.id !== String(reminderId));
    persistReminders(filtered);
    return filtered;
}
