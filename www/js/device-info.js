/**
 * 设备信息模块
 * 使用 Capacitor API 获取真实的设备信息
 */

const DeviceInfo = {
    // 缓存的设备信息
    cachedInfo: null,
    networkListener: null,

    /**
     * 获取 Capacitor 插件
     */
    getPlugins() {
        // 优先使用全局的 Capacitor.Plugins（Capacitor 自动注入）
        if (window.Capacitor && window.Capacitor.Plugins) {
            return {
                Device: window.Capacitor.Plugins.Device,
                Network: window.Capacitor.Plugins.Network,
                Haptics: window.Capacitor.Plugins.Haptics,
                LocalNotifications: window.Capacitor.Plugins.LocalNotifications,
                Clipboard: window.Capacitor.Plugins.Clipboard
            };
        }
        return null;
    },

    /**
     * 初始化设备信息模块
     */
    async init() {
        try {
            const plugins = this.getPlugins();
            if (plugins && plugins.LocalNotifications) {
                // 请求通知权限
                await plugins.LocalNotifications.requestPermissions();
            }
            console.log('📱 DeviceInfo 模块已初始化');
        } catch (error) {
            console.error('初始化错误:', error);
        }
    },

    /**
     * 获取所有设备信息
     */
    async getAllInfo() {
        try {
            const [deviceInfo, networkStatus] = await Promise.all([
                this.getDeviceInfo(),
                this.getNetworkStatus()
            ]);

            this.cachedInfo = {
                ...deviceInfo,
                network: networkStatus,
                appVersion: this.getAppVersion(),
                uptime: this.getUptime()
            };

            return this.cachedInfo;
        } catch (error) {
            console.error('获取设备信息错误:', error);
            return this.getFallbackInfo();
        }
    },

    /**
     * 获取设备基本信息
     */
    async getDeviceInfo() {
        const plugins = this.getPlugins();
        if (!plugins || !plugins.Device) {
            return this.getFallbackDeviceInfo();
        }

        try {
            const info = await plugins.Device.getInfo();
            const batteryId = await plugins.Device.getBatteryInfo();

            return {
                model: info.model || '未知设备',
                platform: info.platform || '未知平台',
                operatingSystem: info.operatingSystem || '未知系统',
                osVersion: info.osVersion || '未知版本',
                manufacturer: info.manufacturer || '未知厂商',
                isVirtual: info.isVirtual || false,
                battery: {
                    level: batteryId.batteryLevel || 1,
                    charging: batteryId.isCharging || false
                }
            };
        } catch (error) {
            console.error('获取设备基本信息错误:', error);
            return this.getFallbackDeviceInfo();
        }
    },

    /**
     * 获取备用设备信息
     */
    getFallbackDeviceInfo() {
        return {
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
    },

    /**
     * 获取网络状态
     */
    async getNetworkStatus() {
        const plugins = this.getPlugins();
        if (!plugins || !plugins.Network) {
            return this.getFallbackNetworkStatus();
        }

        try {
            const status = await plugins.Network.getStatus();
            return {
                connected: status.connected,
                connectionType: status.connectionType || 'unknown',
                typeText: this.getNetworkTypeText(status.connectionType, status.connected)
            };
        } catch (error) {
            console.error('获取网络状态错误:', error);
            return this.getFallbackNetworkStatus();
        }
    },

    /**
     * 获取备用网络状态
     */
    getFallbackNetworkStatus() {
        return {
            connected: false,
            connectionType: 'none',
            typeText: '无法获取'
        };
    },

    /**
     * 获取网络类型的中文显示
     */
    getNetworkTypeText(type, connected) {
        if (!connected) return '未连接';

        const typeMap = {
            'wifi': 'Wi-Fi',
            'cellular': '蜂窝网络',
            'none': '无网络',
            'unknown': '未知'
        };

        return typeMap[type] || '未知';
    },

    /**
     * 获取应用版本
     */
    getAppVersion() {
        // 从 package.json 读取版本号（需要在构建时注入）
        return '1.0.0';
    },

    /**
     * 获取运行时间
     */
    getUptime() {
        // 计算应用运行时间
        const startTime = localStorage.getItem('appStartTime') || Date.now();
        const elapsed = Date.now() - startTime;

        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}天 ${hours % 24}小时`;
        } else if (hours > 0) {
            return `${hours}小时 ${minutes % 60}分钟`;
        } else if (minutes > 0) {
            return `${minutes}分钟 ${seconds % 60}秒`;
        } else {
            return `${seconds}秒`;
        }
    },

    /**
     * 触发震动反馈
     */
    async hapticFeedback(style = 'medium') {
        const plugins = this.getPlugins();
        if (!plugins || !plugins.Haptics) {
            console.warn('震动反馈不可用');
            return;
        }

        try {
            const impactStyle = {
                'light': plugins.Haptics.ImpactStyle.Light,
                'medium': plugins.Haptics.ImpactStyle.Medium,
                'heavy': plugins.Haptics.ImpactStyle.Heavy
            };

            await plugins.Haptics.impact({
                style: impactStyle[style] || plugins.Haptics.ImpactStyle.Medium
            });
        } catch (error) {
            console.warn('震动反馈不可用:', error);
        }
    },

    /**
     * 发送本地通知
     */
    async sendNotification(title, body) {
        const plugins = this.getPlugins();
        if (!plugins || !plugins.LocalNotifications) {
            console.warn('本地通知不可用');
            return;
        }

        try {
            await plugins.LocalNotifications.schedule({
                notifications: [
                    {
                        title,
                        body,
                        id: Date.now(),
                        schedule: { at: new Date() },
                        sound: 'default'
                    }
                ]
            });
        } catch (error) {
            console.error('发送通知错误:', error);
        }
    },

    /**
     * 复制文本到剪贴板
     */
    async copyToClipboard(text) {
        const plugins = this.getPlugins();
        if (!plugins || !plugins.Clipboard) {
            console.warn('剪贴板不可用');
            return false;
        }

        try {
            await plugins.Clipboard.write({
                string: text
            });
            return true;
        } catch (error) {
            console.error('复制到剪贴板错误:', error);
            return false;
        }
    },

    /**
     * 监听网络状态变化
     */
    async addNetworkListener(callback) {
        const plugins = this.getPlugins();
        if (!plugins || !plugins.Network) {
            console.warn('网络监听不可用');
            return;
        }

        try {
            this.networkListener = await plugins.Network.addListener('networkStatusChange', (status) => {
                callback({
                    connected: status.connected,
                    connectionType: status.connectionType,
                    typeText: this.getNetworkTypeText(status.connectionType, status.connected)
                });
            });
        } catch (error) {
            console.error('添加网络监听器错误:', error);
        }
    },

    /**
     * 移除网络监听器
     */
    async removeNetworkListener() {
        if (this.networkListener) {
            try {
                await this.networkListener.remove();
                this.networkListener = null;
            } catch (error) {
                console.error('移除网络监听器错误:', error);
            }
        }
    },

    /**
     * 获取备用信息（用于降级情况）
     */
    getFallbackInfo() {
        return {
            ...this.getFallbackDeviceInfo(),
            network: this.getFallbackNetworkStatus(),
            appVersion: '1.0.0',
            uptime: '刚刚启动'
        };
    },

    /**
     * 格式化设备信息用于显示
     */
    formatInfoForDisplay(info) {
        return [
            { label: '设备型号', value: info.model, icon: '📱' },
            { label: '操作系统', value: `${info.operatingSystem} ${info.osVersion}`, icon: '💻' },
            { label: '制造商', value: info.manufacturer, icon: '🏭' },
            { label: '平台', value: info.platform, icon: '⚡' },
            { label: '虚拟设备', value: info.isVirtual ? '是' : '否', icon: '🖥️' }
        ];
    },

    /**
     * 格式化电池信息
     */
    formatBatteryInfo(info) {
        const level = Math.round((info.battery?.level || 1) * 100);
        const charging = info.battery?.charging || false;
        const levelClass = level > 50 ? 'high' : level > 20 ? 'medium' : 'low';

        return {
            level,
            charging,
            levelClass,
            text: `${level}% ${charging ? '🔌充电中' : '🔋未充电'}`
        };
    },

    /**
     * 格式化网络信息
     */
    formatNetworkInfo(info) {
        const connected = info.network?.connected || false;
        return {
            connected,
            type: info.network?.connectionType || 'unknown',
            text: info.network?.typeText || '未知',
            statusClass: connected ? 'connected' : 'disconnected'
        };
    }
};

// 导出模块
export default DeviceInfo;
