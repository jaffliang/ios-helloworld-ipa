import {
    initDeviceService,
    getDeviceSnapshot,
    addNetworkStatusListener,
    removeNetworkStatusListener,
    refreshUptime,
    triggerHaptics,
    copyText,
    sendTestNotification
} from './services/device-service.js';
import {
    capturePhotoFromCamera,
    scanQrCodeLive,
    explainQrPayload
} from './services/media-service.js';

const DeviceInfo = {
    async init() {
        await initDeviceService();
    },

    async getAllInfo() {
        return getDeviceSnapshot();
    },

    async addNetworkListener(callback) {
        await addNetworkStatusListener(callback);
    },

    async removeNetworkListener() {
        await removeNetworkStatusListener();
    },

    async hapticFeedback(style = 'medium') {
        return triggerHaptics(style);
    },

    async copyToClipboard(text) {
        return copyText(text);
    },

    async sendNotification(title, body) {
        return sendTestNotification(title, body);
    },

    getUptime(snapshot) {
        if (snapshot) {
            return refreshUptime(snapshot).uptime;
        }
        return '';
    },

    async takePhoto() {
        return capturePhotoFromCamera();
    },

    async scanQRCode() {
        const result = await scanQrCodeLive();
        if (!result) {
            return null;
        }

        return {
            ...result,
            explanation: explainQrPayload(result.value)
        };
    }
};

export default DeviceInfo;
