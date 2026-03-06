import { getPlugins } from './capacitor-bridge.js';
import { readText, writeText } from '../core/storage.js';

const APP_START_KEY = 'jeff_toolbox_start_time';

let networkListener = null;

function ensureAppStartTime() {
    const existing = Number(readText(APP_START_KEY, '0'));
    if (existing > 0) {
        return existing;
    }

    const now = Date.now();
    writeText(APP_START_KEY, String(now));
    return now;
}

function getUptimeText(startTime = ensureAppStartTime()) {
    const elapsedMs = Math.max(0, Date.now() - startTime);
    const seconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}天 ${hours % 24}小时`;
    }

    if (hours > 0) {
        return `${hours}小时 ${minutes % 60}分钟`;
    }

    if (minutes > 0) {
        return `${minutes}分钟 ${seconds % 60}秒`;
    }

    return `${seconds}秒`;
}

function toNetworkText(connectionType, connected) {
    if (!connected) {
        return '未连接';
    }

    const map = {
        wifi: 'Wi-Fi',
        cellular: '蜂窝网络',
        none: '无网络',
        unknown: '未知'
    };

    return map[connectionType] || '未知';
}

export async function initDeviceService() {
    ensureAppStartTime();
    const { LocalNotifications } = getPlugins();

    if (LocalNotifications && typeof LocalNotifications.requestPermissions === 'function') {
        try {
            await LocalNotifications.requestPermissions();
        } catch (error) {
            console.warn('Local notification permission request failed:', error);
        }
    }
}

export async function getDeviceSnapshot() {
    const { Device, Network } = getPlugins();

    const fallbackDevice = {
        model: 'iOS 设备',
        platform: 'ios',
        operatingSystem: 'iOS',
        osVersion: '未知',
        manufacturer: 'Apple',
        isVirtual: false,
        battery: {
            level: 1,
            charging: false
        }
    };

    let deviceInfo = fallbackDevice;
    if (Device && typeof Device.getInfo === 'function') {
        try {
            const info = await Device.getInfo();
            let batteryInfo = { batteryLevel: 1, isCharging: false };
            if (typeof Device.getBatteryInfo === 'function') {
                batteryInfo = await Device.getBatteryInfo();
            }

            deviceInfo = {
                model: info.model || fallbackDevice.model,
                platform: info.platform || fallbackDevice.platform,
                operatingSystem: info.operatingSystem || fallbackDevice.operatingSystem,
                osVersion: info.osVersion || fallbackDevice.osVersion,
                manufacturer: info.manufacturer || fallbackDevice.manufacturer,
                isVirtual: Boolean(info.isVirtual),
                battery: {
                    level: typeof batteryInfo.batteryLevel === 'number' ? batteryInfo.batteryLevel : 1,
                    charging: Boolean(batteryInfo.isCharging)
                }
            };
        } catch (error) {
            console.warn('Failed to load Device plugin info:', error);
        }
    }

    let network = {
        connected: false,
        connectionType: 'none',
        typeText: '未连接'
    };

    if (Network && typeof Network.getStatus === 'function') {
        try {
            const status = await Network.getStatus();
            network = {
                connected: Boolean(status.connected),
                connectionType: status.connectionType || 'unknown',
                typeText: toNetworkText(status.connectionType, status.connected)
            };
        } catch (error) {
            console.warn('Failed to load Network plugin info:', error);
        }
    }

    return {
        ...deviceInfo,
        network,
        appVersion: '1.0.0',
        uptime: getUptimeText()
    };
}

export async function addNetworkStatusListener(callback) {
    const { Network } = getPlugins();
    if (!Network || typeof Network.addListener !== 'function') {
        return;
    }

    await removeNetworkStatusListener();

    try {
        networkListener = await Network.addListener('networkStatusChange', status => {
            callback({
                connected: Boolean(status.connected),
                connectionType: status.connectionType || 'unknown',
                typeText: toNetworkText(status.connectionType, status.connected)
            });
        });
    } catch (error) {
        console.warn('Failed to add network listener:', error);
    }
}

export async function removeNetworkStatusListener() {
    if (!networkListener) {
        return;
    }

    try {
        await networkListener.remove();
    } catch (error) {
        console.warn('Failed to remove network listener:', error);
    } finally {
        networkListener = null;
    }
}

export function refreshUptime(snapshot) {
    if (!snapshot) {
        return snapshot;
    }

    return {
        ...snapshot,
        uptime: getUptimeText()
    };
}

export async function triggerHaptics(style = 'medium') {
    const { Haptics } = getPlugins();
    if (!Haptics) {
        return false;
    }

    const styleMap = {
        light: 'LIGHT',
        medium: 'MEDIUM',
        heavy: 'HEAVY'
    };

    try {
        if (typeof Haptics.impact === 'function') {
            const mappedStyle = styleMap[String(style).toLowerCase()] || styleMap.medium;
            await Haptics.impact({ style: mappedStyle });
            return true;
        }

        if (typeof Haptics.vibrate === 'function') {
            await Haptics.vibrate();
            return true;
        }
    } catch (error) {
        console.warn('Haptic feedback failed:', error);
    }

    return false;
}

export async function copyText(text) {
    const { Clipboard } = getPlugins();
    if (!Clipboard || typeof Clipboard.write !== 'function') {
        return false;
    }

    try {
        await Clipboard.write({ string: String(text) });
        return true;
    } catch (error) {
        console.warn('Clipboard write failed:', error);
        return false;
    }
}

export async function sendTestNotification(title, body) {
    const { LocalNotifications } = getPlugins();
    if (!LocalNotifications || typeof LocalNotifications.schedule !== 'function') {
        return false;
    }

    try {
        await LocalNotifications.schedule({
            notifications: [
                {
                    id: Math.floor(Date.now() % 2000000000),
                    title,
                    body,
                    schedule: { at: new Date() },
                    sound: 'default'
                }
            ]
        });
        return true;
    } catch (error) {
        console.warn('Instant notification failed:', error);
        return false;
    }
}

function normalizeNotificationIdList(notificationIds, fallbackNotificationId, minCount = 1) {
    const raw = [];
    if (Array.isArray(notificationIds)) {
        raw.push(...notificationIds);
    }
    if (fallbackNotificationId) {
        raw.push(fallbackNotificationId);
    }

    const deduped = Array.from(new Set(
        raw
            .map(id => Number(id))
            .filter(id => Number.isInteger(id) && id > 0)
    ));

    while (deduped.length < minCount) {
        deduped.push(Math.floor((Date.now() + Math.floor(Math.random() * 1000)) % 2000000000));
    }

    return deduped;
}

function normalizeRepeatWeekdays(weekdays) {
    if (!Array.isArray(weekdays)) {
        return [];
    }

    const parsed = weekdays
        .map(item => Number(item))
        .filter(item => Number.isInteger(item) && item >= 0 && item <= 6);

    return Array.from(new Set(parsed)).sort((a, b) => a - b);
}

function toPluginWeekday(weekday) {
    return weekday === 0 ? 1 : weekday + 1;
}

function buildRecurringNotifications({
    notificationIds,
    title,
    body,
    dueAt,
    startAt,
    repeatType,
    repeatWeekdays
}) {
    const parsedDueAt = new Date(dueAt);
    const dueAtDate = Number.isNaN(parsedDueAt.getTime()) ? new Date() : parsedDueAt;

    const parsedStartAt = new Date(startAt || dueAt);
    const timeSource = Number.isNaN(parsedStartAt.getTime()) ? dueAtDate : parsedStartAt;
    const hour = timeSource.getHours();
    const minute = timeSource.getMinutes();
    const normalizedRepeatType = String(repeatType || 'once').trim().toLowerCase();

    if (normalizedRepeatType === 'weekdays' || normalizedRepeatType === 'weekly') {
        const weekdays = normalizedRepeatType === 'weekdays'
            ? [1, 2, 3, 4, 5]
            : normalizeRepeatWeekdays(repeatWeekdays);
        const safeWeekdays = weekdays.length > 0 ? weekdays : [timeSource.getDay()];
        const safeIds = normalizeNotificationIdList(notificationIds, 0, safeWeekdays.length);

        return safeWeekdays.map((weekday, index) => ({
            id: safeIds[index],
            title,
            body,
            schedule: {
                on: {
                    weekday: toPluginWeekday(weekday),
                    hour,
                    minute
                },
                repeats: true
            },
            sound: 'default'
        }));
    }

    const safeIds = normalizeNotificationIdList(notificationIds, 0, 1);
    const everyMap = {
        daily: 'day',
        monthly: 'month',
        yearly: 'year'
    };
    const schedule = everyMap[normalizedRepeatType]
        ? {
            at: dueAtDate,
            repeats: true,
            every: everyMap[normalizedRepeatType]
        }
        : {
            at: dueAtDate
        };

    return [
        {
            id: safeIds[0],
            title,
            body,
            schedule,
            sound: 'default'
        }
    ];
}

export async function scheduleReminderNotification({
    notificationId,
    notificationIds,
    title,
    body,
    dueAt,
    startAt,
    repeatType,
    repeatWeekdays
}) {
    const { LocalNotifications } = getPlugins();
    if (!LocalNotifications || typeof LocalNotifications.schedule !== 'function') {
        return {
            scheduled: false,
            notificationIds: normalizeNotificationIdList(notificationIds, notificationId, 1)
        };
    }

    try {
        if (typeof LocalNotifications.requestPermissions === 'function') {
            await LocalNotifications.requestPermissions();
        }

        const notifications = buildRecurringNotifications({
            notificationIds: normalizeNotificationIdList(notificationIds, notificationId, 1),
            title,
            body,
            dueAt,
            startAt,
            repeatType,
            repeatWeekdays
        });

        await LocalNotifications.schedule({ notifications });
        return {
            scheduled: true,
            notificationIds: notifications.map(item => item.id)
        };
    } catch (error) {
        console.warn('Reminder scheduling failed:', error);
        return {
            scheduled: false,
            notificationIds: normalizeNotificationIdList(notificationIds, notificationId, 1)
        };
    }
}

export async function cancelReminderNotification(notificationIdsOrSingle) {
    const notificationIds = Array.isArray(notificationIdsOrSingle)
        ? notificationIdsOrSingle
        : [notificationIdsOrSingle];
    const parsedIds = notificationIds
        .map(id => Number(id))
        .filter(id => Number.isInteger(id) && id > 0);

    if (parsedIds.length === 0) {
        return false;
    }

    const { LocalNotifications } = getPlugins();
    if (!LocalNotifications || typeof LocalNotifications.cancel !== 'function') {
        return false;
    }

    try {
        await LocalNotifications.cancel({
            notifications: parsedIds.map(id => ({ id }))
        });
        return true;
    } catch (error) {
        console.warn('Reminder cancel failed:', error);
        return false;
    }
}
