function resolvePlugin(name) {
    return window?.Capacitor?.Plugins?.[name] || null;
}

export function getPlugins() {
    return {
        Device: resolvePlugin('Device'),
        Network: resolvePlugin('Network'),
        Haptics: resolvePlugin('Haptics'),
        LocalNotifications: resolvePlugin('LocalNotifications'),
        Clipboard: resolvePlugin('Clipboard'),
        Camera: resolvePlugin('Camera'),
        BarcodeScanner: resolvePlugin('BarcodeScanner')
    };
}

export function isNativeApp() {
    if (typeof window === 'undefined') {
        return false;
    }

    if (typeof window.Capacitor?.isNativePlatform === 'function') {
        return Boolean(window.Capacitor.isNativePlatform());
    }

    return Boolean(window.Capacitor?.Plugins);
}
