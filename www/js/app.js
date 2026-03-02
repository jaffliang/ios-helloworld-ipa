/**
 * 主应用逻辑
 * 整合设备信息、用户交互和数据持久化
 */

import DeviceInfo from './device-info.js';

const App = {
    // 应用状态
    state: {
        deviceInfo: null,
        autoRefresh: false,
        refreshInterval: null,
        preferences: {}
    },

    /**
     * 初始化应用
     */
    async init() {
        console.log('🚀 应用初始化中...');

        try {
            // 设置应用启动时间（用于计算运行时间）
            if (!localStorage.getItem('appStartTime')) {
                localStorage.setItem('appStartTime', Date.now());
            }

            // 加载用户偏好设置
            this.loadPreferences();

            // 初始化设备信息模块
            await DeviceInfo.init();

            // 渲染界面
            this.renderUI();

            // 获取设备信息
            await this.loadDeviceInfo();

            // 监听网络状态变化
            this.setupNetworkListener();

            // 设置自动刷新
            if (this.state.preferences.autoRefresh) {
                this.startAutoRefresh();
            }

            console.log('✅ 应用初始化完成');
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            this.showError('初始化失败，请刷新页面重试');
        }
    },

    /**
     * 加载用户偏好设置
     */
    loadPreferences() {
        const saved = localStorage.getItem('appPreferences');
        if (saved) {
            try {
                this.state.preferences = JSON.parse(saved);
            } catch (error) {
                console.error('加载偏好设置失败:', error);
                this.state.preferences = this.getDefaultPreferences();
            }
        } else {
            this.state.preferences = this.getDefaultPreferences();
        }
    },

    /**
     * 获取默认偏好设置
     */
    getDefaultPreferences() {
        return {
            autoRefresh: false,
            refreshInterval: 30000, // 30秒
            showBattery: true,
            showNetwork: true,
            showUptime: true
        };
    },

    /**
     * 保存偏好设置
     */
    savePreferences() {
        localStorage.setItem('appPreferences', JSON.stringify(this.state.preferences));
    },

    /**
     * 渲染界面
     */
    renderUI() {
        const container = document.getElementById('app');
        if (!container) return;

        container.innerHTML = `
            <div class="header">
                <h1>📱 iOS 设备信息面板</h1>
                <div class="subtitle">查看您的设备详情</div>
            </div>

            <!-- 加载中 -->
            <div id="loading" class="loading">
                <div class="loading-spinner"></div>
                <p style="margin-top: 16px;">正在获取设备信息...</p>
            </div>

            <!-- 设备信息卡片 -->
            <div id="deviceCard" class="cartoon-card card-primary hidden">
                <h2>设备信息</h2>
                <div id="deviceInfoList"></div>
            </div>

            <!-- 电池信息卡片 -->
            <div id="batteryCard" class="cartoon-card card-battery hidden">
                <h2>电池状态</h2>
                <div id="batteryInfo"></div>
            </div>

            <!-- 网络信息卡片 -->
            <div id="networkCard" class="cartoon-card card-network hidden">
                <h2>网络状态</h2>
                <div id="networkInfo"></div>
            </div>

            <!-- 应用信息卡片 -->
            <div id="appCard" class="cartoon-card card-app hidden">
                <h2>应用信息</h2>
                <div id="appInfoList"></div>
            </div>

            <!-- 操作按钮 -->
            <div id="buttonGroup" class="button-group hidden">
                <button class="cartoon-button" onclick="window.App.refreshInfo()">
                    🔄 刷新信息
                </button>
                <button class="cartoon-button" onclick="window.App.testHaptics()">
                    📳 震动测试
                </button>
                <button class="cartoon-button" onclick="window.App.sendTestNotification()">
                    🔔 通知测试
                </button>
                <button class="cartoon-button" onclick="window.App.copyAllInfo()">
                    📋 复制信息
                </button>
                <button class="cartoon-button" onclick="window.App.toggleAutoRefresh()">
                    ⏱️ ${this.state.preferences.autoRefresh ? '停止自动刷新' : '自动刷新'}
                </button>
            </div>

            <!-- 刷新按钮 -->
            <button id="refreshBtn" class="refresh-btn" onclick="window.App.refreshInfo()" title="刷新">
                🔄
            </button>

            <!-- Toast 通知 -->
            <div id="toast" class="toast"></div>
        `;
    },

    /**
     * 加载设备信息
     */
    async loadDeviceInfo() {
        try {
            this.state.deviceInfo = await DeviceInfo.getAllInfo();
            this.updateUI();
        } catch (error) {
            console.error('加载设备信息失败:', error);
            this.showError('加载设备信息失败');
        }
    },

    /**
     * 更新界面
     */
    updateUI() {
        const info = this.state.deviceInfo;
        if (!info) return;

        // 隐藏加载动画
        document.getElementById('loading').classList.add('hidden');

        // 显示卡片
        document.getElementById('deviceCard').classList.remove('hidden');
        document.getElementById('buttonGroup').classList.remove('hidden');

        // 渲染设备信息
        this.renderDeviceInfo(info);

        // 渲染电池信息
        if (this.state.preferences.showBattery) {
            this.renderBatteryInfo(info);
            document.getElementById('batteryCard').classList.remove('hidden');
        }

        // 渲染网络信息
        if (this.state.preferences.showNetwork) {
            this.renderNetworkInfo(info);
            document.getElementById('networkCard').classList.remove('hidden');
        }

        // 渲染应用信息
        this.renderAppInfo(info);
        document.getElementById('appCard').classList.remove('hidden');
    },

    /**
     * 渲染设备信息
     */
    renderDeviceInfo(info) {
        const list = document.getElementById('deviceInfoList');
        const items = DeviceInfo.formatInfoForDisplay(info);

        list.innerHTML = items.map(item => `
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">${item.icon}</span>
                    ${item.label}
                </span>
                <span class="info-value">${item.value}</span>
            </div>
        `).join('');
    },

    /**
     * 渲染电池信息
     */
    renderBatteryInfo(info) {
        const container = document.getElementById('batteryInfo');
        const battery = DeviceInfo.formatBatteryInfo(info);

        container.innerHTML = `
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">🔋</span>
                    电池电量
                </span>
                <span class="battery-level ${battery.levelClass}">
                    ${battery.text}
                </span>
            </div>
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">⚡</span>
                    充电状态
                </span>
                <span class="info-value">${battery.charging ? '🔌 充电中' : '🔋 未充电'}</span>
            </div>
        `;
    },

    /**
     * 渲染网络信息
     */
    renderNetworkInfo(info) {
        const container = document.getElementById('networkInfo');
        const network = DeviceInfo.formatNetworkInfo(info);

        container.innerHTML = `
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">📡</span>
                    连接状态
                </span>
                <span class="network-status ${network.statusClass}">
                    ${network.connected ? '✅ 已连接' : '❌ 未连接'}
                </span>
            </div>
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">🌐</span>
                    网络类型
                </span>
                <span class="info-value">${network.text}</span>
            </div>
        `;
    },

    /**
     * 渲染应用信息
     */
    renderAppInfo(info) {
        const list = document.getElementById('appInfoList');

        list.innerHTML = `
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">📦</span>
                    应用版本
                </span>
                <span class="info-value">v${info.appVersion}</span>
            </div>
            <div class="info-item">
                <span class="info-label">
                    <span class="icon">⏱️</span>
                    运行时间
                </span>
                <span class="info-value uptime" id="uptimeDisplay">${info.uptime}</span>
            </div>
        `;
    },

    /**
     * 设置网络监听器
     */
    async setupNetworkListener() {
        await DeviceInfo.addNetworkListener((networkStatus) => {
            if (this.state.deviceInfo) {
                this.state.deviceInfo.network = networkStatus;
                if (!document.getElementById('networkCard').classList.contains('hidden')) {
                    this.renderNetworkInfo(this.state.deviceInfo);
                }
            }
        });
    },

    /**
     * 刷新信息
     */
    async refreshInfo() {
        await DeviceInfo.hapticFeedback('light');
        await this.loadDeviceInfo();
        this.showToast('✅ 信息已刷新');
    },

    /**
     * 测试震动
     */
    async testHaptics() {
        await DeviceInfo.hapticFeedback('heavy');
        this.showToast('📳 震动测试完成');
    },

    /**
     * 发送测试通知
     */
    async sendTestNotification() {
        await DeviceInfo.sendNotification('设备信息面板', '通知功能正常工作！');
        await DeviceInfo.hapticFeedback('medium');
        this.showToast('🔔 通知已发送');
    },

    /**
     * 复制所有信息
     */
    async copyAllInfo() {
        const info = this.state.deviceInfo;
        if (!info) return;

        const text = `
设备信息面板
==================
设备型号: ${info.model}
操作系统: ${info.operatingSystem} ${info.osVersion}
制造商: ${info.manufacturer}
平台: ${info.platform}
虚拟设备: ${info.isVirtual ? '是' : '否'}

电池状态
==================
电量: ${Math.round((info.battery?.level || 1) * 100)}%
充电状态: ${info.battery?.charging ? '充电中' : '未充电'}

网络状态
==================
连接状态: ${info.network?.connected ? '已连接' : '未连接'}
网络类型: ${info.network?.typeText || '未知'}

应用信息
==================
版本: v${info.appVersion}
运行时间: ${info.uptime}
        `.trim();

        const success = await DeviceInfo.copyToClipboard(text);
        await DeviceInfo.hapticFeedback('light');

        if (success) {
            this.showToast('✅ 已复制到剪贴板');
        } else {
            this.showToast('❌ 复制失败');
        }
    },

    /**
     * 切换自动刷新
     */
    toggleAutoRefresh() {
        this.state.preferences.autoRefresh = !this.state.preferences.autoRefresh;
        this.savePreferences();

        if (this.state.preferences.autoRefresh) {
            this.startAutoRefresh();
            this.showToast('⏱️ 已开启自动刷新');
        } else {
            this.stopAutoRefresh();
            this.showToast('⏹️ 已停止自动刷新');
        }

        // 更新按钮文本
        const button = document.querySelector('#buttonGroup button:last-child');
        if (button) {
            button.textContent = `⏱️ ${this.state.preferences.autoRefresh ? '停止自动刷新' : '自动刷新'}`;
        }
    },

    /**
     * 开始自动刷新
     */
    startAutoRefresh() {
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
        }

        this.state.refreshInterval = setInterval(async () => {
            await this.loadDeviceInfo();
        }, this.state.preferences.refreshInterval);
    },

    /**
     * 停止自动刷新
     */
    stopAutoRefresh() {
        if (this.state.refreshInterval) {
            clearInterval(this.state.refreshInterval);
            this.state.refreshInterval = null;
        }
    },

    /**
     * 更新运行时间显示
     */
    updateUptime() {
        const uptimeDisplay = document.getElementById('uptimeDisplay');
        if (uptimeDisplay && this.state.deviceInfo) {
            this.state.deviceInfo.uptime = DeviceInfo.getUptime();
            uptimeDisplay.textContent = this.state.deviceInfo.uptime;
        }
    },

    /**
     * 显示 Toast 通知
     */
    showToast(message, duration = 2000) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    /**
     * 显示错误信息
     */
    showError(message) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerHTML = `
                <p style="color: #F44336; font-size: 18px;">❌ ${message}</p>
                <button class="cartoon-button" style="margin-top: 16px;" onclick="window.App.refreshInfo()">
                    🔄 重试
                </button>
            `;
        }
    },

    /**
     * 销毁应用
     */
    destroy() {
        this.stopAutoRefresh();
        DeviceInfo.removeNetworkListener();
        console.log('👋 应用已销毁');
    }
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();

    // 每秒更新运行时间
    setInterval(() => {
        App.updateUptime();
    }, 1000);
});

// 导出应用实例到 window（用于 HTML 中的 onclick 事件）
window.App = App;
