const memoryStore = new Map();

function hasLocalStorage() {
    try {
        return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch (_error) {
        return false;
    }
}

function readRaw(key) {
    if (hasLocalStorage()) {
        return window.localStorage.getItem(key);
    }
    return memoryStore.has(key) ? memoryStore.get(key) : null;
}

function writeRaw(key, value) {
    if (hasLocalStorage()) {
        window.localStorage.setItem(key, value);
        return;
    }
    memoryStore.set(key, value);
}

export function readJSON(key, fallbackValue) {
    const raw = readRaw(key);
    if (raw === null || raw === undefined) {
        return fallbackValue;
    }

    try {
        return JSON.parse(raw);
    } catch (_error) {
        return fallbackValue;
    }
}

export function writeJSON(key, value) {
    writeRaw(key, JSON.stringify(value));
}

export function readText(key, fallbackValue = '') {
    const raw = readRaw(key);
    return raw === null || raw === undefined ? fallbackValue : raw;
}

export function writeText(key, value) {
    writeRaw(key, String(value));
}

export function removeKey(key) {
    if (hasLocalStorage()) {
        window.localStorage.removeItem(key);
        return;
    }
    memoryStore.delete(key);
}
