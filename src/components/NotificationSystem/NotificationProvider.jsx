import React, { createContext, useContext, useState, useCallback } from 'react';
import NotificationSnackbar from './NotificationSnackbar';

// Notification context
const NotificationContext = createContext();

// Status to emoji mapping
const STATUS_EMOJIS = {
    // Shipment statuses
    delivered: '📦✅',
    in_transit: '🚚',
    'in transit': '🚚',
    scheduled: '📅',
    booked: '📋',
    pending: '⏳',
    awaiting_shipment: '📦',
    'awaiting shipment': '📦',
    cancelled: '❌',
    canceled: '❌',
    void: '🚫',
    draft: '📝',
    on_hold: '⏸️',
    'on hold': '⏸️',

    // General notification types
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '🔄',

    // Special cases
    network_error: '🌐❌',
    document_ready: '📄✅',
    copy_success: '📋✅',
    refresh: '🔄',
    update: '🔄',
    check: '✔️',
    time: '⏰',
    location: '📍',
    money: '💰',
    email: '📧',
    phone: '📞',
    truck: '🚛',
    package: '📦',
    airplane: '✈️',
    ship: '🚢',
    train: '🚂',
    warehouse: '🏭',
    home: '🏠',
    office: '🏢',
    globe: '🌍',
    rocket: '🚀',
    fire: '🔥',
    star: '⭐',
    heart: '❤️',
    thumbsup: '👍',
    party: '🎉',
    clock: '🕐',
    calendar: '📆',
    bell: '🔔',
    megaphone: '📢',
    lightbulb: '💡',
    key: '🔑',
    lock: '🔒',
    unlock: '🔓',
    shield: '🛡️',
    trophy: '🏆',
    flag: '🚩',
    bookmark: '🔖',
    tag: '🏷️',
    ticket: '🎫',
    receipt: '🧾',
    chart: '📊',
    trending: '📈',
    down: '📉',
    battery: '🔋',
    plug: '🔌',
    wifi: '📶',
    signal: '📡',
    satellite: '🛰️',
    robot: '🤖',
    gear: '⚙️',
    wrench: '🔧',
    hammer: '🔨',
    pick: '⛏️',
    nut: '🔩',
    magnet: '🧲',
    telescope: '🔭',
    microscope: '🔬',
    test: '🧪',
    pill: '💊',
    dna: '🧬',
    atom: '⚛️',
    radioactive: '☢️',
    biohazard: '☣️',
    recycle: '♻️',
    trash: '🗑️',
    broom: '🧹',
    soap: '🧼',
    sponge: '🧽',
    bucket: '🪣',
    droplet: '💧',
    ocean: '🌊',
    wave: '🌊',
    thermometer: '🌡️',
    sun: '☀️',
    moon: '🌙',
    cloud: '☁️',
    rain: '🌧️',
    snow: '❄️',
    lightning: '⚡',
    tornado: '🌪️',
    fog: '🌫️',
    wind: '💨',
    rainbow: '🌈',
    umbrella: '☂️',
    snowman: '⛄',
    comet: '☄️',
    sparkles: '✨',
    balloon: '🎈',
    tada: '🎉',
    gift: '🎁',
    ribbon: '🎀',
    medal: '🏅',
    crown: '👑',
    diamond: '💎',
    gem: '💎',
    ring: '💍',
    lipstick: '💄',
    kiss: '💋',
    footprints: '👣',
    highfive: '🙏',
    clap: '👏',
    handshake: '🤝',
    thumbsdown: '👎',
    fist: '✊',
    punch: '👊',
    wave_hand: '👋',
    ok_hand: '👌',
    peace: '✌️',
    love: '🤟',
    rock: '🤘',
    point_up: '☝️',
    point_down: '👇',
    point_left: '👈',
    point_right: '👉',
    eyes: '👀',
    eye: '👁️',
    brain: '🧠',
    tooth: '🦷',
    tongue: '👅',
    ear: '👂',
    nose: '👃',
    foot: '🦶',
    leg: '🦵',
    muscle: '💪',
    bone: '🦴',
    heart_organ: '🫀',
    lungs: '🫁',
    speaking: '🗣️',
    silhouette: '👤',
    busts: '👥',
    baby: '👶',
    child: '🧒',
    boy: '👦',
    girl: '👧',
    adult: '🧑',
    man: '👨',
    woman: '👩',
    older_adult: '🧓',
    older_man: '👴',
    older_woman: '👵',
    detective: '🕵️',
    guard: '💂',
    construction: '👷',
    prince: '🤴',
    princess: '👸',
    turban: '👳',
    chinese_cap: '👲',
    hijab: '🧕',
    farmer: '🧑‍🌾',
    cook: '🧑‍🍳',
    student: '🧑‍🎓',
    singer: '🧑‍🎤',
    teacher: '🧑‍🏫',
    factory: '🧑‍🏭',
    technologist: '🧑‍💻',
    office_worker: '🧑‍💼',
    mechanic: '🧑‍🔧',
    scientist: '🧑‍🔬',
    artist: '🧑‍🎨',
    pilot: '🧑‍✈️',
    astronaut: '🧑‍🚀',
    firefighter: '🧑‍🚒',
    spy: '🕵️',
    santa: '🎅',
    angel: '👼',
    superhero: '🦸',
    villain: '🦹',
    wizard: '🧙',
    fairy: '🧚',
    vampire: '🧛',
    mermaid: '🧜',
    elf: '🧝',
    genie: '🧞',
    zombie: '🧟',
    troll: '🧌'
};

// Theme configurations for different notification types
const NOTIFICATION_THEMES = {
    // Success variations
    success: {
        bgcolor: '#dcfce7',
        color: '#166534',
        iconBgcolor: '#10b981',
        borderColor: '#86efac',
        emoji: '✅'
    },
    delivered: {
        bgcolor: '#dcfce7',
        color: '#166534',
        iconBgcolor: '#10b981',
        borderColor: '#86efac',
        emoji: '📦✅'
    },

    // Error variations
    error: {
        bgcolor: '#fee2e2',
        color: '#991b1b',
        iconBgcolor: '#ef4444',
        borderColor: '#fecaca',
        emoji: '❌'
    },
    cancelled: {
        bgcolor: '#fee2e2',
        color: '#991b1b',
        iconBgcolor: '#ef4444',
        borderColor: '#fecaca',
        emoji: '❌'
    },
    canceled: {
        bgcolor: '#fee2e2',
        color: '#991b1b',
        iconBgcolor: '#ef4444',
        borderColor: '#fecaca',
        emoji: '❌'
    },

    // Warning variations
    warning: {
        bgcolor: '#fef3c7',
        color: '#92400e',
        iconBgcolor: '#f59e0b',
        borderColor: '#fde68a',
        emoji: '⚠️'
    },
    on_hold: {
        bgcolor: '#fef3c7',
        color: '#92400e',
        iconBgcolor: '#f59e0b',
        borderColor: '#fde68a',
        emoji: '⏸️'
    },
    'on hold': {
        bgcolor: '#fef3c7',
        color: '#92400e',
        iconBgcolor: '#f59e0b',
        borderColor: '#fde68a',
        emoji: '⏸️'
    },

    // Info variations
    info: {
        bgcolor: '#dbeafe',
        color: '#1e40af',
        iconBgcolor: '#3b82f6',
        borderColor: '#bfdbfe',
        emoji: 'ℹ️'
    },
    in_transit: {
        bgcolor: '#dbeafe',
        color: '#1e40af',
        iconBgcolor: '#3b82f6',
        borderColor: '#bfdbfe',
        emoji: '🚚'
    },
    'in transit': {
        bgcolor: '#dbeafe',
        color: '#1e40af',
        iconBgcolor: '#3b82f6',
        borderColor: '#bfdbfe',
        emoji: '🚚'
    },

    // Neutral variations
    default: {
        bgcolor: '#f3f4f6',
        color: '#374151',
        iconBgcolor: '#9ca3af',
        borderColor: '#e5e7eb',
        emoji: '📢'
    },
    pending: {
        bgcolor: '#f3f4f6',
        color: '#374151',
        iconBgcolor: '#9ca3af',
        borderColor: '#e5e7eb',
        emoji: '⏳'
    },

    // Special variations
    scheduled: {
        bgcolor: '#ede9fe',
        color: '#5b21b6',
        iconBgcolor: '#8b5cf6',
        borderColor: '#ddd6fe',
        emoji: '📅'
    },
    booked: {
        bgcolor: '#ede9fe',
        color: '#5b21b6',
        iconBgcolor: '#8b5cf6',
        borderColor: '#ddd6fe',
        emoji: '📋'
    },
    draft: {
        bgcolor: '#f1f5f9',
        color: '#475569',
        iconBgcolor: '#94a3b8',
        borderColor: '#e2e8f0',
        emoji: '📝'
    }
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [currentNotification, setCurrentNotification] = useState(null);

    // Core notification function
    const showNotification = useCallback((message, type = 'info', options = {}) => {
        const {
            duration = 4000,
            emoji,
            action,
            persist = false,
            position = { vertical: 'bottom', horizontal: 'right' },
            variant = 'filled',
            details,
            title
        } = options;

        // Determine theme based on type
        const theme = NOTIFICATION_THEMES[type] || NOTIFICATION_THEMES[type.toLowerCase()] || NOTIFICATION_THEMES.default;

        // Get emoji - use provided emoji, or status emoji, or theme emoji
        const finalEmoji = emoji || STATUS_EMOJIS[type] || STATUS_EMOJIS[type.toLowerCase()] || theme.emoji;

        const notification = {
            id: Date.now() + Math.random(),
            message,
            type,
            theme,
            emoji: finalEmoji,
            duration: persist ? null : duration,
            action,
            position,
            variant,
            details,
            title,
            timestamp: new Date()
        };

        setCurrentNotification(notification);
        setNotifications(prev => [...prev, notification]);

        // Auto-hide after duration
        if (!persist && duration) {
            setTimeout(() => {
                setCurrentNotification(current =>
                    current?.id === notification.id ? null : current
                );
            }, duration);
        }

        return notification.id;
    }, []);

    // Specialized notification methods
    const showStatusUpdate = useCallback((previousStatus, newStatus, shipmentId) => {
        const message = `Status updated: ${previousStatus} → ${newStatus}`;
        const type = newStatus.toLowerCase().replace(/\s+/g, '_');

        showNotification(message, type, {
            title: 'Status Update',
            details: shipmentId ? `Shipment: ${shipmentId}` : undefined,
            duration: 5000,
            action: shipmentId ? {
                label: 'View',
                onClick: () => window.location.href = `/shipment/${shipmentId}`
            } : undefined
        });
    }, [showNotification]);

    const showBatchResult = useCallback((successCount, errorCount, total) => {
        if (successCount > 0 && errorCount === 0) {
            showNotification(
                `All ${successCount} shipments updated successfully!`,
                'success',
                { emoji: '🎉', duration: 5000 }
            );
        } else if (successCount > 0 && errorCount > 0) {
            showNotification(
                `${successCount} updated, ${errorCount} failed`,
                'warning',
                {
                    emoji: '⚠️',
                    duration: 6000,
                    details: `Total processed: ${total}`
                }
            );
        } else if (errorCount > 0 && successCount === 0) {
            showNotification(
                `Failed to update ${errorCount} shipment(s)`,
                'error',
                { emoji: '❌', duration: 6000 }
            );
        } else {
            showNotification(
                'All shipments checked - no updates needed',
                'info',
                { emoji: '✔️', duration: 4000 }
            );
        }
    }, [showNotification]);

    const hideNotification = useCallback((id) => {
        setCurrentNotification(current =>
            current?.id === id ? null : current
        );
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const clearAll = useCallback(() => {
        setCurrentNotification(null);
        setNotifications([]);
    }, []);

    const value = {
        notifications,
        currentNotification,
        showNotification,
        showStatusUpdate,
        showBatchResult,
        hideNotification,
        clearAll
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
            {currentNotification && (
                <NotificationSnackbar
                    notification={currentNotification}
                    onClose={() => hideNotification(currentNotification.id)}
                />
            )}
        </NotificationContext.Provider>
    );
};

// Custom hook to use notifications
export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within NotificationProvider');
    }
    return context;
};

export default NotificationProvider; 