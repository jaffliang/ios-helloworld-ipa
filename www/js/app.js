/**
 * Main application controller.
 */

import DeviceInfo from './device-info.js';

const App = {
    state: {
        deviceInfo: null,
        refreshInterval: null,
        preferences: {},
        latestPhoto: null,
        latestScan: null
    },

    async init() {
        console.log('Initializing app...');

        try {
            if (!localStorage.getItem('appStartTime')) {
                localStorage.setItem('appStartTime', Date.now());
            }

            this.loadPreferences();
            await DeviceInfo.init();
            this.renderUI();
            await this.loadDeviceInfo();
            await this.setupNetworkListener();

            if (this.state.preferences.autoRefresh) {
                this.startAutoRefresh();
            }

            this.updateAutoRefreshButtonLabel();
            console.log('App initialized.');
        } catch (error) {
            console.error('App init failed:', error);
            this.showError('Initialization failed. Please try again.');
        }
    },

    loadPreferences() {
        const saved = localStorage.getItem('appPreferences');
        if (!saved) {
            this.state.preferences = this.getDefaultPreferences();
            return;
        }

        try {
            this.state.preferences = JSON.parse(saved);
        } catch (error) {
            console.error('Failed to parse preferences:', error);
            this.state.preferences = this.getDefaultPreferences();
        }
    },

    getDefaultPreferences() {
        return {
            autoRefresh: false,
            refreshInterval: 30000,
            showBattery: true,
            showNetwork: true,
            showUptime: true
        };
    },

    savePreferences() {
        localStorage.setItem('appPreferences', JSON.stringify(this.state.preferences));
    },

    renderUI() {
        const container = document.getElementById('app');
        if (!container) {
            return;
        }

        container.innerHTML = `
            <div class="header">
                <h1>iOS Device Info Panel</h1>
                <div class="subtitle">Capacitor Demo with native features</div>
            </div>

            <div id="loading" class="loading">
                <div class="loading-spinner"></div>
                <p style="margin-top: 16px;">Loading device data...</p>
            </div>

            <div id="deviceCard" class="cartoon-card card-primary hidden">
                <h2>Device Info</h2>
                <div id="deviceInfoList"></div>
            </div>

            <div id="batteryCard" class="cartoon-card card-battery hidden">
                <h2>Battery</h2>
                <div id="batteryInfo"></div>
            </div>

            <div id="networkCard" class="cartoon-card card-network hidden">
                <h2>Network</h2>
                <div id="networkInfo"></div>
            </div>

            <div id="appCard" class="cartoon-card card-app hidden">
                <h2>App</h2>
                <div id="appInfoList"></div>
            </div>

            <div id="mediaCard" class="cartoon-card card-media hidden">
                <h2>Camera & QR</h2>
                <div id="mediaNote" class="media-note">Use the buttons below to take a photo or scan a QR code.</div>
                <img id="photoPreview" class="photo-preview hidden" alt="Photo preview">
                <div id="scanResultBox" class="scan-result hidden"></div>
            </div>

            <div id="buttonGroup" class="button-group hidden">
                <button class="cartoon-button" onclick="window.App.refreshInfo()">Refresh Info</button>
                <button class="cartoon-button" onclick="window.App.testHaptics()">Test Haptics</button>
                <button class="cartoon-button" onclick="window.App.sendTestNotification()">Test Notification</button>
                <button class="cartoon-button" onclick="window.App.copyAllInfo()">Copy All Info</button>
                <button class="cartoon-button" onclick="window.App.takePhoto()">Take Photo</button>
                <button class="cartoon-button" onclick="window.App.scanQRCode()">Scan QR</button>
                <button id="autoRefreshButton" class="cartoon-button" onclick="window.App.toggleAutoRefresh()"></button>
            </div>

            <button id="refreshBtn" class="refresh-btn" onclick="window.App.refreshInfo()" title="Refresh">↻</button>
            <div id="toast" class="toast"></div>
        `;
    },

    async loadDeviceInfo() {
        try {
            this.state.deviceInfo = await DeviceInfo.getAllInfo();
            this.updateUI();
        } catch (error) {
            console.error('Failed to load device info:', error);
            this.showError('Failed to load device info.');
        }
    },

    updateUI() {
        const info = this.state.deviceInfo;
        if (!info) {
            return;
        }

        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
        }

        document.getElementById('deviceCard')?.classList.remove('hidden');
        document.getElementById('buttonGroup')?.classList.remove('hidden');
        document.getElementById('mediaCard')?.classList.remove('hidden');

        this.renderDeviceInfo(info);

        if (this.state.preferences.showBattery) {
            this.renderBatteryInfo(info);
            document.getElementById('batteryCard')?.classList.remove('hidden');
        }

        if (this.state.preferences.showNetwork) {
            this.renderNetworkInfo(info);
            document.getElementById('networkCard')?.classList.remove('hidden');
        }

        this.renderAppInfo(info);
        document.getElementById('appCard')?.classList.remove('hidden');

        this.renderMediaPanel();
        this.updateAutoRefreshButtonLabel();
    },

    renderDeviceInfo(info) {
        const list = document.getElementById('deviceInfoList');
        if (!list) {
            return;
        }

        const items = [
            { label: 'Model', value: info.model, icon: '📱' },
            { label: 'Operating System', value: `${info.operatingSystem} ${info.osVersion}`, icon: '💻' },
            { label: 'Manufacturer', value: info.manufacturer, icon: '🏭' },
            { label: 'Platform', value: info.platform, icon: '⚙️' },
            { label: 'Virtual Device', value: info.isVirtual ? 'Yes' : 'No', icon: '🖥️' }
        ];
        list.innerHTML = items
            .map(
                item => `
                    <div class="info-item">
                        <span class="info-label">
                            <span class="icon">${item.icon}</span>
                            ${item.label}
                        </span>
                        <span class="info-value">${this.escapeHtml(String(item.value))}</span>
                    </div>
                `,
            )
            .join('');
    },

    renderBatteryInfo(info) {
        const container = document.getElementById('batteryInfo');
        if (!container) {
            return;
        }

        const level = Math.round((info.battery?.level || 0) * 100);
        const charging = Boolean(info.battery?.charging);
        const levelClass = level > 50 ? 'high' : level > 20 ? 'medium' : 'low';
        const statusText = `${level}% ${charging ? 'Charging' : 'Not Charging'}`;

        container.innerHTML = `
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">🔋</span>
                    Battery Level
                </span>
                <span class="battery-level ${levelClass}">
                    ${this.escapeHtml(statusText)}
                </span>
            </div>
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">⚡</span>
                    Charging
                </span>
                <span class="info-value">${charging ? 'Yes' : 'No'}</span>
            </div>
        `;
    },

    renderNetworkInfo(info) {
        const container = document.getElementById('networkInfo');
        if (!container) {
            return;
        }

        const connected = Boolean(info.network?.connected);
        const networkText = info.network?.typeText || info.network?.connectionType || 'Unknown';
        const statusClass = connected ? 'connected' : 'disconnected';
        container.innerHTML = `
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">📶</span>
                    Status
                </span>
                <span class="network-status ${statusClass}">
                    ${connected ? 'Connected' : 'Disconnected'}
                </span>
            </div>
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">🌐</span>
                    Type
                </span>
                <span class="info-value">${this.escapeHtml(networkText)}</span>
            </div>
        `;
    },

    renderAppInfo(info) {
        const list = document.getElementById('appInfoList');
        if (!list) {
            return;
        }

        list.innerHTML = `
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">⚙️</span>
                    Version
                </span>
                <span class="info-value">v${this.escapeHtml(info.appVersion)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">⏱</span>
                    Uptime
                </span>
                <span class="info-value uptime" id="uptimeDisplay">${this.escapeHtml(info.uptime)}</span>
            </div>
        `;
    },

    renderMediaPanel() {
        const note = document.getElementById('mediaNote');
        const preview = document.getElementById('photoPreview');
        const scanResultBox = document.getElementById('scanResultBox');

        if (preview) {
            if (this.state.latestPhoto) {
                preview.src = this.state.latestPhoto;
                preview.classList.remove('hidden');
            } else {
                preview.classList.add('hidden');
                preview.removeAttribute('src');
            }
        }

        if (scanResultBox) {
            if (this.state.latestScan) {
                const scanValue = this.escapeHtml(this.state.latestScan.value || '');
                const scanFormat = this.escapeHtml(this.state.latestScan.format || 'QR_CODE');
                const scanType = this.escapeHtml(this.state.latestScan.valueType || 'UNKNOWN');

                scanResultBox.innerHTML = `
                    <div class="info-item">
                        <span class="info-label"><span class="icon">🔎</span>Result</span>
                        <span class="info-value scan-value">${scanValue}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><span class="icon">🏷</span>Format</span>
                        <span class="info-value">${scanFormat}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label"><span class="icon">🧩</span>Type</span>
                        <span class="info-value">${scanType}</span>
                    </div>
                    <div class="media-actions">
                        <button class="copy-btn" onclick="window.App.copyScanResult()">Copy QR Result</button>
                    </div>
                `;
                scanResultBox.classList.remove('hidden');
            } else {
                scanResultBox.innerHTML = '';
                scanResultBox.classList.add('hidden');
            }
        }

        if (note) {
            if (this.state.latestScan) {
                note.textContent = 'QR code scanned successfully.';
            } else if (this.state.latestPhoto) {
                note.textContent = 'Photo captured successfully.';
            } else {
                note.textContent = 'Use the buttons below to take a photo or scan a QR code.';
            }
        }
    },

    updateAutoRefreshButtonLabel() {
        const button = document.getElementById('autoRefreshButton');
        if (!button) {
            return;
        }

        button.textContent = this.state.preferences.autoRefresh
            ? 'Stop Auto Refresh'
            : 'Start Auto Refresh';
    },

    async setupNetworkListener() {
        await DeviceInfo.addNetworkListener(networkStatus => {
            if (!this.state.deviceInfo) {
                return;
            }
            this.state.deviceInfo.network = networkStatus;
            if (!document.getElementById('networkCard')?.classList.contains('hidden')) {
                this.renderNetworkInfo(this.state.deviceInfo);
            }
        });
    },

    async refreshInfo() {
        await DeviceInfo.hapticFeedback('light');
        await this.loadDeviceInfo();
        this.showToast('Info refreshed.');
    },

    async testHaptics() {
        await DeviceInfo.hapticFeedback('heavy');
        this.showToast('Haptics test done.');
    },

    async sendTestNotification() {
        await DeviceInfo.sendNotification('Device Info Panel', 'This is a local notification test.');
        await DeviceInfo.hapticFeedback('medium');
        this.showToast('Notification sent.');
    },

    async copyAllInfo() {
        const info = this.state.deviceInfo;
        if (!info) {
            return;
        }

        const text = [
            'Device Info',
            '==========',
            `Model: ${info.model}`,
            `OS: ${info.operatingSystem} ${info.osVersion}`,
            `Manufacturer: ${info.manufacturer}`,
            `Platform: ${info.platform}`,
            `Virtual: ${info.isVirtual ? 'Yes' : 'No'}`,
            '',
            'Battery',
            '=======',
            `Level: ${Math.round((info.battery?.level || 1) * 100)}%`,
            `Charging: ${info.battery?.charging ? 'Yes' : 'No'}`,
            '',
            'Network',
            '=======',
            `Connected: ${info.network?.connected ? 'Yes' : 'No'}`,
            `Type: ${info.network?.typeText || 'Unknown'}`,
            '',
            'App',
            '===',
            `Version: v${info.appVersion}`,
            `Uptime: ${info.uptime}`
        ].join('\n');

        const success = await DeviceInfo.copyToClipboard(text);
        await DeviceInfo.hapticFeedback('light');
        this.showToast(success ? 'Copied to clipboard.' : 'Copy failed.');
    },

    async takePhoto() {
        const photo = await DeviceInfo.takePhoto();
        if (!photo) {
            this.showToast('Photo was not captured.');
            return;
        }

        this.state.latestPhoto = photo;
        this.renderMediaPanel();
        await DeviceInfo.hapticFeedback('light');
        this.showToast('Photo captured.');
    },

    async scanQRCode() {
        const scanResult = await DeviceInfo.scanQRCode();
        if (!scanResult || !scanResult.value) {
            this.state.latestScan = null;
            this.renderMediaPanel();
            this.showToast('No QR code detected.');
            return;
        }

        this.state.latestScan = scanResult;
        this.renderMediaPanel();
        await DeviceInfo.hapticFeedback('medium');
        this.showToast('QR code scanned.');
    },

    async copyScanResult() {
        const value = this.state.latestScan?.value;
        if (!value) {
            this.showToast('No scan result to copy.');
            return;
        }

        const copied = await DeviceInfo.copyToClipboard(value);
        this.showToast(copied ? 'QR result copied.' : 'Copy failed.');
    },

    toggleAutoRefresh() {
        this.state.preferences.autoRefresh = !this.state.preferences.autoRefresh;
        this.savePreferences();

        if (this.state.preferences.autoRefresh) {
            this.startAutoRefresh();
            this.showToast('Auto refresh enabled.');
        } else {
            this.stopAutoRefresh();
            this.showToast('Auto refresh disabled.');
        }

        this.updateAutoRefreshButtonLabel();
    },

    startAutoRefresh() {
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
        }

        this.state.refreshInterval = setInterval(async () => {
            await this.loadDeviceInfo();
        }, this.state.preferences.refreshInterval);
    },

    stopAutoRefresh() {
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
            this.state.refreshInterval = null;
        }
    },

    updateUptime() {
        const uptimeDisplay = document.getElementById('uptimeDisplay');
        if (!uptimeDisplay || !this.state.deviceInfo) {
            return;
        }

        this.state.deviceInfo.uptime = DeviceInfo.getUptime();
        uptimeDisplay.textContent = this.state.deviceInfo.uptime;
    },

    showToast(message, duration = 2000) {
        const toast = document.getElementById('toast');
        if (!toast) {
            return;
        }

        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    showError(message) {
        const loading = document.getElementById('loading');
        if (!loading) {
            return;
        }

        loading.innerHTML = `
            <p style="color: #F44336; font-size: 18px;">${this.escapeHtml(message)}</p>
            <button class="cartoon-button" style="margin-top: 16px;" onclick="window.App.refreshInfo()">
                Retry
            </button>
        `;
    },

    escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    },

    destroy() {
        this.stopAutoRefresh();
        DeviceInfo.removeNetworkListener();
        console.log('App destroyed.');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();

    setInterval(() => {
        App.updateUptime();
    }, 1000);
});

window.App = App;
