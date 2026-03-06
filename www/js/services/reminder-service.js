import { readJSON, writeJSON } from '../core/storage.js';

const REMINDERS_KEY = 'jeff_toolbox_reminders_v1';

function loadReminders() {
    const reminders = readJSON(REMINDERS_KEY, []);
    if (!Array.isArray(reminders)) {
        return [];
    }

    return reminders
        .map(item => ({
            id: String(item.id || ''),
            title: String(item.title || '提醒'),
            dueAt: String(item.dueAt || new Date().toISOString()),
            createdAt: String(item.createdAt || new Date().toISOString()),
            notificationId: Number(item.notificationId || 0),
            scheduled: Boolean(item.scheduled)
        }))
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

export async function addReminder({ title, dueAtLocal }, notifier = {}) {
    const dueAtDate = new Date(dueAtLocal);
    if (Number.isNaN(dueAtDate.getTime())) {
        throw new Error('提醒时间格式不正确');
    }

    if (dueAtDate.getTime() <= Date.now()) {
        throw new Error('提醒时间必须晚于当前时间');
    }

    const reminders = loadReminders();
    const nowIso = new Date().toISOString();
    const notificationId = createNotificationId();

    const reminder = {
        id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        title: String(title || '').trim() || '提醒事项',
        dueAt: dueAtDate.toISOString(),
        createdAt: nowIso,
        notificationId,
        scheduled: false
    };

    if (typeof notifier.schedule === 'function') {
        reminder.scheduled = await notifier.schedule({
            notificationId: reminder.notificationId,
            title: 'Jeff的工具箱提醒',
            body: reminder.title,
            dueAt: reminder.dueAt
        });
    }

    reminders.push(reminder);
    reminders.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    persistReminders(reminders);

    return reminder;
}

export async function removeReminder(reminderId, notifier = {}) {
    const reminders = loadReminders();
    const target = reminders.find(item => item.id === String(reminderId));

    if (target && typeof notifier.cancel === 'function' && target.notificationId) {
        await notifier.cancel(target.notificationId);
    }

    const filtered = reminders.filter(item => item.id !== String(reminderId));
    persistReminders(filtered);
    return filtered;
}
