import { getPlugins } from './capacitor-bridge.js';

function normalizeBarcode(rawBarcode) {
    if (!rawBarcode) {
        return null;
    }

    const value = rawBarcode.displayValue || rawBarcode.rawValue || '';
    if (!value) {
        return null;
    }

    return {
        value,
        rawValue: rawBarcode.rawValue || value,
        format: rawBarcode.format || 'QR_CODE',
        valueType: rawBarcode.valueType || 'UNKNOWN'
    };
}

async function ensureScannerPermission(scanner) {
    if (!scanner || typeof scanner.requestPermissions !== 'function') {
        return true;
    }

    try {
        const permission = await scanner.requestPermissions();
        return permission?.camera === 'granted' || permission?.camera === 'limited';
    } catch (error) {
        console.warn('Barcode permission request failed:', error);
        return false;
    }
}

export async function capturePhotoFromCamera() {
    const { Camera } = getPlugins();
    if (!Camera || typeof Camera.getPhoto !== 'function') {
        return null;
    }

    try {
        if (typeof Camera.requestPermissions === 'function') {
            await Camera.requestPermissions({ permissions: ['camera'] });
        }

        const result = await Camera.getPhoto({
            quality: 88,
            allowEditing: false,
            resultType: 'dataUrl',
            source: 'CAMERA',
            correctOrientation: true
        });

        return result?.dataUrl || result?.webPath || null;
    } catch (error) {
        console.warn('capturePhotoFromCamera failed:', error);
        return null;
    }
}

export async function pickPhotoForNote() {
    const { Camera } = getPlugins();
    if (!Camera || typeof Camera.getPhoto !== 'function') {
        return null;
    }

    try {
        if (typeof Camera.requestPermissions === 'function') {
            await Camera.requestPermissions({ permissions: ['photos'] });
        }

        const result = await Camera.getPhoto({
            quality: 88,
            allowEditing: false,
            resultType: 'dataUrl',
            source: 'PHOTOS',
            correctOrientation: true
        });

        return result?.dataUrl || result?.webPath || null;
    } catch (error) {
        console.warn('pickPhotoForNote failed:', error);
        return null;
    }
}

export async function scanQrCodeLive() {
    const { BarcodeScanner } = getPlugins();
    if (!BarcodeScanner || typeof BarcodeScanner.scan !== 'function') {
        return null;
    }

    try {
        if (typeof BarcodeScanner.isSupported === 'function') {
            const support = await BarcodeScanner.isSupported();
            if (!support?.supported) {
                return null;
            }
        }

        const granted = await ensureScannerPermission(BarcodeScanner);
        if (!granted) {
            return null;
        }

        const scanResult = await BarcodeScanner.scan({
            formats: ['QR_CODE']
        });

        return normalizeBarcode(scanResult?.barcodes?.[0]);
    } catch (error) {
        console.warn('scanQrCodeLive failed:', error);
        return null;
    }
}

export async function scanQrCodeFromPhotoLibrary() {
    const { BarcodeScanner, Camera } = getPlugins();
    if (!BarcodeScanner || !Camera) {
        return null;
    }

    if (typeof BarcodeScanner.readBarcodesFromImage !== 'function') {
        return null;
    }

    try {
        const granted = await ensureScannerPermission(BarcodeScanner);
        if (!granted) {
            return null;
        }

        const photo = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: 'uri',
            source: 'PHOTOS',
            correctOrientation: true
        });

        const imagePath = photo?.path || photo?.webPath;
        if (!imagePath) {
            return null;
        }

        const result = await BarcodeScanner.readBarcodesFromImage({
            path: imagePath,
            formats: ['QR_CODE']
        });

        return normalizeBarcode(result?.barcodes?.[0]);
    } catch (error) {
        console.warn('scanQrCodeFromPhotoLibrary failed:', error);
        return null;
    }
}

export function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = event => {
            resolve(String(event.target?.result || ''));
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file.'));
        };

        reader.readAsDataURL(file);
    });
}

function explainWifiPayload(value) {
    const content = value.slice(5).replace(/;;$/, ';');
    const segments = content.split(';').filter(Boolean);
    const data = {};

    for (const segment of segments) {
        const [rawKey, ...rest] = segment.split(':');
        const key = rawKey || '';
        data[key] = rest.join(':');
    }

    return {
        type: 'Wi-Fi',
        headline: data.S || '无线网络配置',
        detail: `加密: ${data.T || '未知'}${data.P ? '，包含密码字段' : '，无密码字段'}`,
        actionType: 'text',
        actionValue: value
    };
}

function explainUrlPayload(value) {
    try {
        const url = new URL(value);
        return {
            type: '链接',
            headline: url.host,
            detail: `路径: ${url.pathname || '/'}`,
            actionType: 'url',
            actionValue: value
        };
    } catch (_error) {
        return null;
    }
}

export function explainQrPayload(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return {
            type: '空内容',
            headline: '二维码内容为空',
            detail: '没有可解释的数据。',
            actionType: 'none',
            actionValue: ''
        };
    }

    const urlExplanation = explainUrlPayload(raw);
    if (urlExplanation) {
        return urlExplanation;
    }

    if (/^WIFI:/i.test(raw)) {
        return explainWifiPayload(raw);
    }

    if (/^mailto:/i.test(raw)) {
        return {
            type: '邮箱',
            headline: raw.replace(/^mailto:/i, ''),
            detail: '可用于快速发邮件。',
            actionType: 'text',
            actionValue: raw
        };
    }

    if (/^tel:/i.test(raw)) {
        return {
            type: '电话',
            headline: raw.replace(/^tel:/i, ''),
            detail: '可用于快速拨号。',
            actionType: 'text',
            actionValue: raw
        };
    }

    if (/^SMSTO:/i.test(raw)) {
        return {
            type: '短信',
            headline: '短信二维码',
            detail: raw,
            actionType: 'text',
            actionValue: raw
        };
    }

    if (/^BEGIN:VCARD/i.test(raw)) {
        return {
            type: '联系人',
            headline: 'vCard 联系人信息',
            detail: '检测到联系人二维码，可复制后导入通讯录。',
            actionType: 'text',
            actionValue: raw
        };
    }

    return {
        type: '文本',
        headline: raw.length > 24 ? `${raw.slice(0, 24)}...` : raw,
        detail: `共 ${raw.length} 个字符`,
        actionType: 'text',
        actionValue: raw
    };
}
