export function $(selector, root = document) {
    return root.querySelector(selector);
}

export function $all(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
}

export function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function formatDateTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return '--';
    }

    return date.toLocaleString('zh-CN', {
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatRelativeTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return '--';
    }

    const diffMs = date.getTime() - Date.now();
    const absMs = Math.abs(diffMs);
    const absMinutes = Math.floor(absMs / 60000);

    if (absMinutes < 1) {
        return diffMs >= 0 ? '马上' : '刚刚';
    }

    if (absMinutes < 60) {
        return diffMs >= 0 ? `${absMinutes} 分钟后` : `${absMinutes} 分钟前`;
    }

    const absHours = Math.floor(absMinutes / 60);
    if (absHours < 24) {
        return diffMs >= 0 ? `${absHours} 小时后` : `${absHours} 小时前`;
    }

    const absDays = Math.floor(absHours / 24);
    return diffMs >= 0 ? `${absDays} 天后` : `${absDays} 天前`;
}
