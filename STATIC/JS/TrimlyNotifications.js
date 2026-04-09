/* ===============================
   TRIMLY GLOBAL NOTIFICATION SYSTEM
   =============================== */

const NOTIFICATION_KEY = "trimly_notifications";
const ALL_NOTIFICATIONS_KEY = "trimly_all_notifications";
const NOTIFICATION_SETTINGS_KEY = "trimly_notification_settings";

/* ---------- CORE STORAGE ---------- */
function getNotifications() {
  return JSON.parse(localStorage.getItem(NOTIFICATION_KEY)) || [];
}

function getAllNotifications() {
  return JSON.parse(localStorage.getItem(ALL_NOTIFICATIONS_KEY)) || [];
}

function saveNotifications(notifications) {
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
  updateNotificationBadge();
}

function saveAllNotifications(notifications) {
  localStorage.setItem(ALL_NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

/* ---------- NOTIFICATION SETTINGS ---------- */
function isNotificationEnabled(type) {
  const settings = JSON.parse(
    localStorage.getItem(NOTIFICATION_SETTINGS_KEY)
  ) || {
    bookingConfirm: true,
    bookingReminder: true,
    promotions: true,
    messages: true,
    payments: true,
  };

  switch (type) {
    case "booking":
      return settings.bookingConfirm;
    case "reminder":
      return settings.bookingReminder;
    case "promotion":
      return settings.promotions;
    case "message":
      return settings.messages;
    case "payment":
    case "status":
      return true; // Always show payment and status updates
    default:
      return true;
  }
}

/* ---------- CREATE NOTIFICATION ---------- */
function createNotification(data) {
  if (!isNotificationEnabled(data.type)) return;

  const notifications = getAllNotifications();

  // Create notification object
  const notification = {
    ...data,
    id: Date.now(),
    read: false,
    time: Date.now(),
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: new Date().toLocaleDateString(),
  };

  // Add to all notifications
  notifications.unshift(notification);

  // Keep only last 100 notifications
  if (notifications.length > 100) {
    notifications.pop();
  }

  saveAllNotifications(notifications);

  // Add to unread notifications
  const unreadNotifications = getNotifications();
  unreadNotifications.unshift(notification);
  saveNotifications(unreadNotifications);

  showToast(data.title, data.message);
  updateNotificationBadge();

  return notification;
}

/* ---------- MARK AS READ ---------- */
function markNotificationAsRead(id) {
  const notifications = getAllNotifications();
  const notificationIndex = notifications.findIndex((n) => n.id === id);

  if (notificationIndex !== -1) {
    notifications[notificationIndex].read = true;
    saveAllNotifications(notifications);
  }

  // Remove from unread notifications
  const unreadNotifications = getNotifications();
  const updatedUnread = unreadNotifications.filter((n) => n.id !== id);
  saveNotifications(updatedUnread);
}

function markAllNotificationsRead() {
  // Mark all as read in all notifications
  const notifications = getAllNotifications();
  notifications.forEach((n) => (n.read = true));
  saveAllNotifications(notifications);

  // Clear unread notifications
  saveNotifications([]);
}

/* ---------- CLEAR ALL NOTIFICATIONS ---------- */
function clearAllNotifications() {
  saveNotifications([]);
  saveAllNotifications([]);
  updateNotificationBadge();
}

/* ---------- RED CIRCLE BADGE UPDATE ---------- */
function updateNotificationBadge() {
  const badges = document.querySelectorAll(".notification-badge");
  if (!badges.length) return;

  const unreadCount = getNotifications().filter((n) => !n.read).length;

  badges.forEach((badge) => {
    // Update text content with proper formatting
    if (unreadCount > 9) {
      badge.textContent = "9+";
      badge.setAttribute("data-count", "9+");
    } else if (unreadCount > 0) {
      badge.textContent = unreadCount.toString();
      badge.setAttribute("data-count", unreadCount.toString());
    } else {
      badge.textContent = "0";
      badge.setAttribute("data-count", "0");
    }

    // Show/hide badge with CSS classes
    if (unreadCount > 0) {
      badge.classList.add("has-notifications");
      badge.style.display = "flex";
    } else {
      badge.classList.remove("has-notifications");
      badge.style.display = "none";
    }
  });

  return unreadCount;
}

/* ---------- TOAST ---------- *//*
function showToast(title, message) {
  // Check if toast container exists, if not create it
  let toast = document.getElementById("notification-toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "notification-toast";
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      max-width: 300px;
      display: none;
      animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);

    // Add CSS animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  toast.innerHTML = `
    <strong style="display: block; margin-bottom: 4px; font-size: 14px;">${title}</strong>
    <div style="font-size: 13px; opacity: 0.9;">${message}</div>
  `;

  toast.style.display = "block";

  // Update badge immediately to show new notification
  updateNotificationBadge();

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease";
    setTimeout(() => {
      toast.style.display = "none";
      toast.style.animation = "";
    }, 300);
  }, 4000);
} */

/* ===============================
   NOTIFICATION TYPES
   =============================== */

/* 1️⃣ Booking Confirmation */
function notifyBookingConfirmed(bookingId, barberName) {
  createNotification({
    type: "booking",
    title: "🎉 Booking Confirmed",
    message: `Your booking with ${barberName} has been confirmed.`,
    meta: { bookingId, barberName },
    link: "booking.html",
  });
}

/* 2️⃣ Booking Reminder */
function notifyBookingReminder(barberName, time) {
  createNotification({
    type: "reminder",
    title: "⏰ Upcoming Booking",
    message: `Your appointment with ${barberName} is at ${time}.`,
    meta: { barberName, time },
    link: "booking.html",
  });
}

/* 3️⃣ Payment Successful */
function notifyPaymentSuccess(amount, barberName) {
  createNotification({
    type: "payment",
    title: "✅ Payment Successful",
    message: `₦${amount.toLocaleString()} paid to ${barberName}.`,
    meta: { amount, barberName },
    link: "booking.html",
  });
}

/* 4️⃣ Booking Status Change */
function notifyBookingStatusChange(status, bookingId) {
  createNotification({
    type: "status",
    title: "📋 Booking Update",
    message: `Booking #${bookingId} is now ${status}.`,
    meta: { bookingId, status },
    link: "booking.html",
  });
}

/* 5️⃣ New Message */
function notifyNewMessage(barberName, barberId) {
  const currentChat = new URLSearchParams(window.location.search).get(
    "barberId"
  );

  if (currentChat !== barberId) {
    createNotification({
      type: "message",
      title: "💬 New Message",
      message: `${barberName} sent you a message.`,
      meta: { barberId, barberName },
      link: `message.html?barberId=${barberId}`,
    });
  }
}

/* 6️⃣ Promotion/Offer */
function notifyPromotion(offer, barberName) {
  createNotification({
    type: "promotion",
    title: "🎁 Special Offer",
    message: `${offer} at ${barberName}!`,
    meta: { offer, barberName },
    link: "Home.html",
  });
}

/* ---------- INITIALIZE ---------- */
function initTrimlyNotifications() {
  // Initialize default settings if not exists
  if (!localStorage.getItem(NOTIFICATION_SETTINGS_KEY)) {
    localStorage.setItem(
      NOTIFICATION_SETTINGS_KEY,
      JSON.stringify({
        bookingConfirm: true,
        bookingReminder: true,
        promotions: true,
        messages: true,
        payments: true,
      })
    );
  }

  // Initialize with sample notifications if empty (for demo)
  if (
    !localStorage.getItem(ALL_NOTIFICATIONS_KEY) ||
    !localStorage.getItem(NOTIFICATION_KEY)
  ) {
    const sampleNotifications = [
      {
        id: 1,
        type: "booking",
        title: "🎉 Booking Confirmed",
        message: "Your booking with Ariyo Barbing Services has been confirmed.",
        time: Date.now() - 3600000, // 1 hour ago
        read: false,
        timestamp: "10:30 AM",
        date: "Today",
        link: "booking.html",
      },
      {
        id: 2,
        type: "promotion",
        title: "🎁 Special Offer",
        message: "Get 20% off on your next booking!",
        time: Date.now() - 86400000, // 1 day ago
        read: true,
        timestamp: "2:20 PM",
        date: "Yesterday",
        link: "Home.html",
      },
      {
        id: 3,
        type: "message",
        title: "💬 New Message",
        message: "John sent you a message.",
        time: Date.now() - 172800000, // 2 days ago
        read: true,
        timestamp: "11:15 AM",
        date: "2 days ago",
        link: "message.html",
      },
      {
        id: 4,
        type: "payment",
        title: "✅ Payment Successful",
        message: "₦5,000 paid to Elite Barbers.",
        time: Date.now() - 259200000, // 3 days ago
        read: true,
        timestamp: "4:45 PM",
        date: "3 days ago",
        link: "booking.html",
      },
    ];

    localStorage.setItem(
      ALL_NOTIFICATIONS_KEY,
      JSON.stringify(sampleNotifications)
    );
    localStorage.setItem(
      NOTIFICATION_KEY,
      JSON.stringify([sampleNotifications[0]])
    ); // Only first one as unread
  }

  updateNotificationBadge();

  // Add click handler to notification icon
  const notificationIcon = document.querySelector(".notifications");
  if (notificationIcon) {
    notificationIcon.addEventListener("click", function (e) {
      e.preventDefault();

      // Don't mark all as read when clicked - only when viewing dropdown
      // Mark all as read only when they click on specific notifications

      // Show dropdown
      showNotificationDropdown();
    });
  }
}

/* ---------- NOTIFICATION DROPDOWN ---------- */
let showAllNotifications = false; // Toggle state for show all/top notifications

function showNotificationDropdown() {
  // Remove existing dropdown if any
  const existingDropdown = document.querySelector(".notification-dropdown");
  if (existingDropdown) {
    existingDropdown.remove();
    return;
  }

  // Get all notifications
  const allNotifications = getAllNotifications();

  // Determine how many to show based on toggle state
  let notificationsToShow;
  if (showAllNotifications) {
    // Show all notifications
    notificationsToShow = allNotifications;
  } else {
    // Show only top 2 notifications
    notificationsToShow = allNotifications.slice(0, 2);
  }

  const unreadCount = getNotifications().filter((n) => !n.read).length;

  const dropdown = document.createElement("div");
  dropdown.className = "notification-dropdown";
  dropdown.style.cssText = `
    position: absolute;
    top: 60px;
    right: 20px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.12);
    width: 360px;
    max-height: 500px;
    overflow-y: auto;
    z-index: 1000;
    padding: 16px 0;
  `;

  dropdown.innerHTML = `
    <div style="padding: 0 16px 12px 16px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
      <strong style="font-size: 16px;">Notifications</strong>
      ${
        unreadCount > 0
          ? `<span style="background: #ff4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${unreadCount} new</span>`
          : ""
      }
    </div>
    ${
      allNotifications.length > 0
        ? notificationsToShow
            .map(
              (notif) => `
      <div class="notification-item" data-id="${
        notif.id
      }" style="padding: 12px 16px; border-bottom: 1px solid #f5f5f5; cursor: pointer; ${
                !notif.read ? "background: #f8f9ff;" : ""
              }">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="font-size: 20px;">${
            notif.type === "booking"
              ? "🎉"
              : notif.type === "message"
              ? "💬"
              : notif.type === "promotion"
              ? "🎁"
              : "📋"
          }</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${
              notif.title
            }</div>
            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">${
              notif.message
            }</div>
            <div style="font-size: 11px; color: #999; display: flex; justify-content: space-between;">
              <span>${notif.date === "Today" ? "Today" : notif.date} ${
                notif.timestamp
              }</span>
              ${
                !notif.read
                  ? '<span style="color: #ff4444; font-weight: 600;">NEW</span>'
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    `
            )
            .join("")
        : `
      <div style="padding: 32px 16px; text-align: center; color: #999;">
        <div style="font-size: 48px; margin-bottom: 12px;">🔔</div>
        <div>No notifications yet</div>
      </div>
    `
    }
    ${
      allNotifications.length > 2
        ? `
      <div style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <button id="toggleNotifications" style="flex: 1; background: none; border: 1px solid #ddd; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; color: #666;">
          ${
            showAllNotifications
              ? "See Top Notifications"
              : "View All Notifications"
          }
        </button>
        <button id="clearAllNotifications" style="background: none; border: 1px solid #ff4444; color: #ff4444; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px;">
          Clear All
        </button>
      </div>
    `
        : allNotifications.length > 0
        ? `
      <div style="padding: 12px 16px; text-align: center;">
        <button id="clearAllNotifications" style="background: none; border: 1px solid #ff4444; color: #ff4444; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px;">
          Clear All Notifications
        </button>
      </div>
    `
        : ""
    }
  `;

  document.body.appendChild(dropdown);

  // Click handler for notification items
  dropdown.querySelectorAll(".notification-item").forEach((item) => {
    item.addEventListener("click", function () {
      const id = parseInt(this.getAttribute("data-id"));
      markNotificationAsRead(id);

      // Find the notification to get its link
      const notification = allNotifications.find((n) => n.id === id);
      if (notification && notification.link) {
        window.location.href = notification.link;
      }

      dropdown.remove();
    });
  });

  // Toggle view all/see top button
  const toggleBtn = document.getElementById("toggleNotifications");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      showAllNotifications = !showAllNotifications;
      dropdown.remove();
      setTimeout(() => showNotificationDropdown(), 10);
    });
  }

  // Clear all notifications button
  const clearAllBtn = document.getElementById("clearAllNotifications");
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (confirm("Are you sure you want to clear all notifications?")) {
        clearAllNotifications();
        dropdown.remove();
      }
    });
  }

  // Close dropdown when clicking outside
  setTimeout(() => {
    const closeDropdown = (e) => {
      if (!dropdown.contains(e.target) && !e.target.closest(".notifications")) {
        dropdown.remove();
        document.removeEventListener("click", closeDropdown);
        showAllNotifications = false; // Reset to default state
      }
    };
    document.addEventListener("click", closeDropdown);
  }, 100);
}

/* ---------- AUTO INIT ---------- */
document.addEventListener("DOMContentLoaded", initTrimlyNotifications);

/* ---------- EXPORT FOR GLOBAL USE ---------- */
window.TrimlyNotifications = {
  createNotification,
  markAllNotificationsRead,
  markNotificationAsRead,
  updateNotificationBadge,
  notifyBookingConfirmed,
  notifyBookingReminder,
  notifyPaymentSuccess,
  notifyBookingStatusChange,
  notifyNewMessage,
  notifyPromotion,
  getAllNotifications,
  getUnreadCount: () => getNotifications().filter((n) => !n.read).length,
  clearAllNotifications,
  init: initTrimlyNotifications,
};

