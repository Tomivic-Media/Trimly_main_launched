import {
  adminSessionLogin,
  adminSessionLogout,
  adminRefundBooking,
  approveAdminUser,
  cancelBooking,
  clearAuthSession,
  createAdminUser,
  createDispute,
  createBarberProfile,
  createBooking,
  createBookingReview,
  forgotPassword,
  getAcceptableUsePolicy,
  getAdminBarbers,
  getAdminPayoutReport,
  getAdminReviews,
  getAdminUsers,
  getBarberAvailability,
  getBarberById,
  getBarberInsights,
  getBarberPayoutReport,
  getBarberReviews,
  getBarberServices,
  getBarbers,
  getBookings,
  getCustomerInsights,
  getCurrentUser,
  initializePayment,
  getBookingMessages,
  getMyBarberKyc,
  getMyDisputes,
  getMyBarberProfile,
  getMySessions,
  getReferralSummary,
  uploadBarberImage,
  updateCurrentUserProfile,
  changeCurrentUserPassword,
  createBarberService,
  deactivateBarberService,
  updateBarberProfile,
  updateBarberService,
  getNotifications,
  getToken,
  getWebSocketUrl,
  loginUser,
  markAllNotificationsRead,
  markNotificationRead,
    moderateReview,
    normalizeRole,
    markBookingCompleted,
    registerUser,
  requestRefund,
  revokeOtherSessions,
  revokeSession,
  resolveDispute,
  resetPassword,
  sendBookingMessage,
  setAuthSession,
  submitBarberKyc,
  verifyBarberKyc,
  updateBarberAvailability,
  updateBarberStatus,
  updateBookingStatus,
  verifyPayment,
} from "./api.js?v=20260403c";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const state = {
  currentRole: localStorage.getItem("trimly_role") || "",
  currentEmail: localStorage.getItem("trimly_email") || "",
  barberProfile: null,
  barberKyc: null,
  barberBookings: [],
  disputes: [],
  notifications: [],
  adminBarbers: [],
  barberPortfolioDraft: [],
  barberServices: [],
  adminReviews: [],
  currentUser: null,
  calendarView: "day",
  calendarDate: toDateInput(new Date()),
  chatPollInterval: null,
  barberAlertPollInterval: null,
  barberUrgentUnreadIds: null,
};

const BARBER_SOUND_PREF_KEY = "trimly_barber_notification_sound";
const BARBER_HIGHLIGHT_PREF_KEY = "trimly_barber_notification_highlight";
const LANGUAGE_PREF_KEY = "trimly_language";
const TIME_FORMAT_PREF_KEY = "trimly_time_format";

document.addEventListener("DOMContentLoaded", () => {
  bindGlobalUi();
  routePage();
});

function routePage() {
  const page = document.body.dataset.page;
  switch (page) {
    case "landing":
      initLandingPage();
      break;
    case "barbers":
      initBarbersPage();
      break;
    case "barber-profile":
      initBarberProfilePage();
      break;
    case "booking":
      initBookingPage();
      break;
    case "login":
      initLoginPage();
      break;
    case "admin-login":
      initAdminLoginPage();
      break;
    case "admin-dashboard":
      initAdminDashboardPage();
      break;
    case "register":
      initRegisterPage();
      break;
    case "dashboard":
      initDashboardPage();
      break;
    case "setup-barber":
      initSetupBarberPage();
      break;
    case "settings":
      initSettingsPage();
      break;
    case "reset-password":
      initResetPasswordPage();
      break;
    case "messages":
    case "messages-barber":
      initMessagesPage();
      break;
    case "payment-status":
      initPaymentStatusPage();
      break;
    default:
      break;
  }
}

function bindGlobalUi() {
  hydrateAuthActions();
  bindMobileMenu();
  bindPasswordToggles();

  const yearEl = document.querySelector("[data-current-year]");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

function bindMobileMenu() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-nav-menu]");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    menu.classList.toggle("is-open");
  });
}

function hydrateAuthActions() {
  const wrappers = document.querySelectorAll("[data-auth-actions]");
  if (!wrappers.length) return;

  const token = getToken();
  wrappers.forEach((wrapper) => {
    if (!token) {
      wrapper.innerHTML = `
        <a class="btn btn-ghost" href="/static/login.html">Login</a>
        <a class="btn btn-primary" href="/static/register.html">Register</a>
        <a class="auth-admin-link" href="/static/admin-login.html">Admin Login</a>
      `;
      return;
    }

    wrapper.innerHTML = `
      <div class="notification-shell" data-notification-shell>
        <button class="notification-bell" type="button" data-notification-toggle aria-label="Open notifications">
          <span class="notification-bell-icon">&#128276;</span>
          <span class="notification-badge hidden" data-notification-badge>0</span>
        </button>
        <div class="notification-popover" data-notification-popover>
          <div class="notification-popover-head">
            <strong>Notifications</strong>
            <button class="btn btn-ghost btn-sm" type="button" data-notification-read-all>Read all</button>
          </div>
          <div class="notification-popover-list" data-notification-list>
            <div class="loading">Loading notifications...</div>
          </div>
          <a class="notification-popover-footer" data-notification-view-all href="${["admin", "super_admin"].includes(normalizeRole(localStorage.getItem("trimly_role") || "")) ? "/admin" : "/static/dashboard.html"}">View all</a>
        </div>
      </div>
      <a class="btn btn-icon" href="/static/settings.html" aria-label="Open settings" title="Settings">&#9881;</a>
      <a class="btn btn-ghost" href="${["admin", "super_admin"].includes(normalizeRole(localStorage.getItem("trimly_role") || "")) ? "/admin" : "/static/dashboard.html"}">Dashboard</a>
      <button class="btn btn-primary" data-logout-btn>Logout</button>
    `;

    const logoutBtn = wrapper.querySelector("[data-logout-btn]");
    logoutBtn?.addEventListener("click", async () => {
      const role = normalizeRole(localStorage.getItem("trimly_role") || "");
      if (["admin", "super_admin"].includes(role)) {
        try {
          await adminSessionLogout();
        } catch (_error) {
          // Clear local session even if cookie logout fails.
        }
      }
      clearAuthSession();
      toast("Signed out");
      window.location.href = "/";
    });

    hydrateHeaderNotifications(wrapper).catch(() => {
      // Keep header usable even if notifications fail.
    });
  });
}



function renderEmptyStateCard(title, copy, actionHref = "", actionLabel = "") {
  return `
    <div class="empty-state-card">
      <strong>${escapeHtml(title)}</strong>
      <p class="muted">${escapeHtml(copy)}</p>
      ${
        actionHref && actionLabel
          ? `<div class="empty-state-actions"><a class="btn btn-primary btn-sm" href="${escapeHtml(actionHref)}">${escapeHtml(actionLabel)}</a></div>`
          : ""
      }
    </div>
  `;
}

async function hydrateHeaderNotifications(scope = document) {
  const shell = scope.querySelector("[data-notification-shell]");
  const toggle = scope.querySelector("[data-notification-toggle]");
  const badge = scope.querySelector("[data-notification-badge]");
  const popover = scope.querySelector("[data-notification-popover]");
  const list = scope.querySelector("[data-notification-list]");
  const readAllBtn = scope.querySelector("[data-notification-read-all]");

  if (!shell || !toggle || !badge || !popover || !list || !readAllBtn) return;

  if (toggle.dataset.bound !== "true") {
    toggle.dataset.bound = "true";
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      popover.classList.toggle("open");
    });

    document.addEventListener("click", (event) => {
      if (!shell.contains(event.target)) {
        popover.classList.remove("open");
      }
    });
  }

  list.innerHTML = `<div class="loading">Loading notifications...</div>`;

  try {
    const response = await getNotifications(5);
    const items = Array.isArray(response?.items) ? response.items : [];
    const unreadCount = Number(response?.unread_count || 0);
    const hasUrgentUnread = shouldHighlightUrgentRequests() &&
      items.some((item) => isUrgentNotification(item) && !item.is_read);
    badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    badge.classList.toggle("hidden", unreadCount === 0);
    toggle.classList.toggle("notification-bell-urgent", hasUrgentUnread);
    badge.classList.toggle("notification-badge-urgent", hasUrgentUnread);
    readAllBtn.disabled = unreadCount === 0;
    list.innerHTML = renderHeaderNotificationsList(items);
    bindHeaderNotificationActions(shell);
  } catch (error) {
    list.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    badge.classList.add("hidden");
    toggle.classList.remove("notification-bell-urgent");
    badge.classList.remove("notification-badge-urgent");
    readAllBtn.disabled = true;
  }

  if (readAllBtn.dataset.bound === "true") return;
  readAllBtn.dataset.bound = "true";
  readAllBtn.addEventListener("click", async () => {
    readAllBtn.disabled = true;
    try {
      await markAllNotificationsRead();
      await hydrateHeaderNotifications(scope);
      toast("Notifications marked as read");
    } catch (error) {
      toast(error.message, true);
      readAllBtn.disabled = false;
    }
  });
}

function renderHeaderNotificationsList(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return `<p class="muted">No notifications yet.</p>`;
  }

  return notifications
    .map(
      (item) => `
        <article class="notification-popover-item ${item.is_read ? "" : "unread"} ${notificationPriorityClass(item)}">
          <div class="notification-popover-copy">
            <div class="notification-heading-row">
              <strong>${escapeHtml(item.title || "Notification")}</strong>
              ${renderNotificationPriorityPill(item)}
            </div>
            <p>${escapeHtml(item.message || "")}</p>
            <span class="muted">${escapeHtml(formatDateTime(item.created_at))}</span>
          </div>
          <div class="notification-popover-actions">
            ${renderNotificationOpenActions(item, true)}
            ${
              item.is_read
                ? ""
                : `<button class="btn btn-ghost btn-sm" type="button" data-header-notification-read="${Number(item.id)}">Read</button>`
            }
          </div>
        </article>
      `
    )
    .join("");
}

function bindHeaderNotificationActions(scope = document) {
  scope.querySelectorAll("[data-header-notification-read]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const notificationId = Number(button.dataset.headerNotificationRead || 0);
      if (!notificationId) return;
      button.disabled = true;
      try {
        await markNotificationRead(notificationId);
        await hydrateHeaderNotifications(scope);
      } catch (error) {
        toast(error.message, true);
        button.disabled = false;
      }
    });
  });
}

function resolveMediaSource(source) {
  const value = String(source || "").trim();
  if (!value) return "";
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/") ||
    value.startsWith("data:image/")
  ) {
    return value;
  }
  return "";
}

function barberMediaSources(barber) {
  const sources = [
    resolveMediaSource(barber.profile_image_url),
    ...(Array.isArray(barber.portfolio_image_urls) ? barber.portfolio_image_urls.map(resolveMediaSource) : []),
  ].filter(Boolean);
  return [...new Set(sources)];
}

function barberInitials(barber) {
  const source = String(barber.barberName || barber.shopName || "Trimly Barber").trim();
  return (
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "TB"
  );
}

function barberImageMarkup(barber, className, altText, placeholderClass = "barber-image-placeholder") {
  const source = resolveMediaSource(barber.image);
  if (source) {
    return `<img class="${className}" src="${source}" alt="${escapeHtml(altText)}" />`;
  }

  return `
    <div class="${className} ${placeholderClass}" aria-label="${escapeHtml(altText)}">
      <span>${escapeHtml(barberInitials(barber))}</span>
    </div>
  `;
}

function mapBarber(barber, index = 0) {
  const rawPrice = Number(barber.haircut_price || 0);
  const availableDays = Array.isArray(barber.available_days)
    ? barber.available_days.map((day) => String(day).toLowerCase())
    : [];
  const mediaSources = barberMediaSources(barber);

  return {
    id: Number(barber.id),
    shopName: barber.shop_name || barber.barber_name || `Barber #${barber.id}`,
    barberName: barber.barber_name || barber.shop_name || `Barber #${barber.id}`,
    rating: Number(barber.average_rating || 0),
    reviewCount: Number(barber.review_count || 0),
    hiddenReviewCount: Number(barber.hidden_review_count || 0),
    price: Number.isFinite(rawPrice) ? rawPrice : 0,
    beardTrimPrice: Number(barber.beard_trim_price || 0),
    location: barber.location || "Unknown",
    bio: barber.bio || "Professional grooming services.",
    image: resolveMediaSource(barber.cover_image_url) || mediaSources[0] || "",
    profileImage: resolveMediaSource(barber.profile_image_url) || mediaSources[0] || "",
    coverImage: resolveMediaSource(barber.cover_image_url) || mediaSources[0] || "",
    portfolioImages: mediaSources,
    available: Boolean(barber.is_available),
    availableDays,
    availableStartTime: normalizeTimeForInput(barber.available_start_time),
    availableEndTime: normalizeTimeForInput(barber.available_end_time),
    otherServices: barber.other_services || "",
  };
}

function priceText(amount) {
  return `NGN ${Number(amount || 0).toLocaleString()}`;
}

function splitServiceList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function barberCardTemplate(barber, ctaLabel = "View Profile") {
  const ctaHref =
    ctaLabel === "Book Now"
      ? `/static/booking.html?barber=${barber.id}`
      : `/static/barber-profile.html?id=${barber.id}`;
  const ratingLabel = barber.reviewCount
    ? `${barber.rating.toFixed(1)} (${barber.reviewCount} review${barber.reviewCount === 1 ? "" : "s"})`
    : "New barber";
  const ratingStars = barber.reviewCount ? renderStars(barber.rating) : "";

  return `
    <article class="card barber-card">
      ${barberImageMarkup(barber, "barber-photo", barber.shopName)}
      <div class="barber-body">
        <h3>${escapeHtml(barber.shopName)}</h3>
        <p class="muted">${escapeHtml(barber.location)}</p>
        <div class="barber-meta">
          <span>${escapeHtml(ratingLabel)}</span>
          <span>${priceText(barber.price)}</span>
        </div>
        ${
          barber.reviewCount
            ? `<div class="barber-rating-line"><span class="review-stars" aria-label="${escapeHtml(
                `${barber.rating.toFixed(1)} out of 5 stars`
              )}">${renderStars(barber.rating)}</span><span class="muted">${escapeHtml(
                `${barber.reviewCount} verified rating${barber.reviewCount === 1 ? "" : "s"}`
              )}</span></div>`
            : `<p class="muted barber-review-meta">Be one of the first to rate this barber.</p>`
        }
        <p class="muted barber-review-meta">${escapeHtml(
          barber.reviewCount
            ? `Average rating calculated from completed booking reviews`
            : "Be one of the first to book this barber"
        )}</p>
        <a class="btn btn-primary btn-block" href="${ctaHref}">${ctaLabel}</a>
      </div>
    </article>
  `;
}

function renderStars(rating) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
  return Array.from({ length: 5 }, (_, index) => (index < rounded ? "★" : "☆")).join("");
}

function renderReviewCards(reviews = [], emptyText = "No customer reviews yet.") {
  if (!Array.isArray(reviews) || !reviews.length) {
    return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }

  return reviews
    .map(
      (review) => `
        <article class="review-card ${review.is_visible === false ? "review-card-muted" : ""}">
          <div class="review-card-head">
            <div>
              <strong>${escapeHtml(review.customer_name || "Trimly Customer")}</strong>
              <p class="muted">${escapeHtml(review.service_name || "Haircut")}</p>
            </div>
            <div class="review-rating-block">
              <span class="review-stars">${escapeHtml(renderStars(review.rating))}</span>
              <small class="muted">${escapeHtml(formatDateTime(review.created_at))}</small>
            </div>
          </div>
          <p>${escapeHtml(review.review_text || "Customer left a rating without written feedback.")}</p>
          ${
            review.admin_note
              ? `<p class="review-admin-note"><strong>Admin note:</strong> ${escapeHtml(review.admin_note)}</p>`
              : ""
          }
        </article>
      `
    )
    .join("");
}

async function initLandingPage() {
  const featuredEl = document.getElementById("featuredBarbers");
  const heroForm = document.getElementById("heroSearchForm");
  const heroInput = document.getElementById("heroSearchInput");

  heroForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = (heroInput?.value || "").trim();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    window.location.href = `/static/barbers.html${params.toString() ? `?${params}` : ""}`;
  });

  if (!featuredEl) return;

  featuredEl.innerHTML = `<div class="loading">Loading featured barbers...</div>`;
  try {
    const barbers = await getBarbers({});
    const featured = barbers.slice(0, 3).map((item, index) => mapBarber(item, index));

    if (!featured.length) {
      featuredEl.innerHTML = `<p class="muted">No featured barbers yet.</p>`;
      return;
    }

    featuredEl.innerHTML = featured.map((barber) => barberCardTemplate(barber, "Book Now")).join("");
    bindFavoriteButtons(featuredEl);
  } catch (error) {
    featuredEl.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function initBarbersPage() {
  const barbersGrid = document.getElementById("barbersGrid");
  const searchInput = document.getElementById("listSearch");
  const locationInput = document.getElementById("listLocation");
  const minPriceInput = document.getElementById("listMinPrice");
  const maxPriceInput = document.getElementById("listMaxPrice");
  const filterForm = document.getElementById("barberFilterForm");

  if (!barbersGrid) return;

  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get("q") || "";
  if (searchInput) searchInput.value = initialQuery;

  async function loadBarbers() {
    barbersGrid.innerHTML = `<div class="loading">Finding barbers...</div>`;

    try {
      const filters = {
        location: (locationInput?.value || "").trim(),
        min_price: minPriceInput?.value || "",
        max_price: maxPriceInput?.value || "",
        available: true,
      };

      const apiBarbers = await getBarbers(filters);
      let mapped = apiBarbers.map((item, index) => mapBarber(item, index));

      const query = (searchInput?.value || "").trim().toLowerCase();
      if (query) {
        mapped = mapped.filter((barber) => {
          return (
            barber.shopName.toLowerCase().includes(query) ||
            barber.barberName.toLowerCase().includes(query) ||
            barber.location.toLowerCase().includes(query)
          );
        });
      }

      if (!mapped.length) {
        barbersGrid.innerHTML = `<p class="muted">No barbers match your filters.</p>`;
        return;
      }

      barbersGrid.innerHTML = mapped.map((barber) => barberCardTemplate(barber, "View Profile")).join("");
      bindFavoriteButtons(barbersGrid);
    } catch (error) {
      barbersGrid.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    }
  }

  filterForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    loadBarbers();
  });

  searchInput?.addEventListener("input", () => {
    loadBarbers();
  });

  await loadBarbers();
}

async function initBarberProfilePage() {
  const profileView = document.getElementById("barberProfileView");
  const params = new URLSearchParams(window.location.search);
  const barberId = params.get("id");

  if (!profileView) return;
  if (!barberId) {
    profileView.innerHTML = `<p class="error">Barber profile not found.</p>`;
    return;
  }

  profileView.innerHTML = `<div class="loading">Loading profile...</div>`;

  try {
    const [barberResponse, reviewResponse] = await Promise.all([
      getBarberById(barberId),
      getBarberReviews(barberId).catch(() => ({ items: [], average_rating: 0, review_count: 0 })),
    ]);
    const barber = mapBarber(barberResponse, Number(barberId));
    const today = toDateInput(new Date());
    const availability = await getBarberAvailability(barberId, today).catch(() => []);
    const availableTimes = normalizeAvailability(availability);
    const reviews = Array.isArray(reviewResponse?.items) ? reviewResponse.items : [];
    const reviewAverage = Number(reviewResponse?.average_rating || barber.rating || 0);
    const reviewCount = Number(reviewResponse?.review_count || barber.reviewCount || 0);
    const availableDaysLabel = barber.availableDays.length
      ? barber.availableDays.map((day) => capitalize(day)).join(", ")
      : "Every day";
    const publicProfileUrl = `${window.location.origin}/static/barber-profile.html?id=${barber.id}`;
    const directBookingUrl = `${window.location.origin}/static/booking.html?barber=${barber.id}`;
    const serviceChips = [
      `${priceText(barber.price)} Haircut`,
      barber.beardTrimPrice ? `${priceText(barber.beardTrimPrice)} Beard Trim` : "",
      ...splitServiceList(barber.otherServices),
    ].filter(Boolean);
    const nextSlots = availableTimes.slice(0, 6);
    const reliabilityItems = [
      barber.available ? "Currently online for bookings" : "Profile currently offline",
      barber.availableDays.length ? `Works on ${availableDaysLabel}` : "Availability updates regularly",
      barber.portfolioImages.length ? `${barber.portfolioImages.length} portfolio photo${barber.portfolioImages.length === 1 ? "" : "s"} uploaded` : "Portfolio coming soon",
      reviewCount ? `${reviewCount} verified customer review${reviewCount === 1 ? "" : "s"}` : "Waiting for first customer review",
    ];
    const portfolioGallery = barber.portfolioImages.length
      ? `
        <div class="portfolio-gallery-grid">
          ${barber.portfolioImages
            .map(
              (image, index) => `
                <a class="portfolio-gallery-card" href="${escapeHtml(image)}" target="_blank" rel="noopener noreferrer">
                  <img src="${escapeHtml(image)}" alt="${escapeHtml(`${barber.shopName} portfolio ${index + 1}`)}" />
                </a>
              `
            )
            .join("")}
        </div>
      `
      : `<p class="muted">This barber has not uploaded a haircut portfolio yet.</p>`;
    const reviewSection = `
      <section class="profile-review-panel">
        <div class="panel-head-row">
          <div>
            <h3>Customer Reviews</h3>
            <p class="muted">${reviewCount ? `${reviewCount} review${reviewCount === 1 ? "" : "s"} from completed bookings` : "No public reviews yet."}</p>
          </div>
          <span class="pill ${reviewCount ? "pill-success" : ""}">${reviewCount ? `${reviewAverage.toFixed(1)} / 5` : "New Barber"}</span>
        </div>
        <div class="review-card-list">
          ${renderReviewCards(reviews.slice(0, 4), "No customer reviews yet. Be the first to book and leave feedback.")}
        </div>
      </section>
    `;

    profileView.innerHTML = `
      <section class="profile-layout premium-profile-layout">
        <div class="profile-visual-shell">
          ${barberImageMarkup({ ...barber, image: barber.coverImage || barber.profileImage || barber.image }, "profile-photo", barber.shopName, "profile-photo-placeholder")}
          <div class="profile-floating-rating">
            <strong>${reviewCount ? reviewAverage.toFixed(1) : "New"}</strong>
            <span>${reviewCount ? `${reviewCount} review${reviewCount === 1 ? "" : "s"}` : "No reviews yet"}</span>
          </div>
        </div>
        <div class="profile-content">
          <span class="profile-kicker">${escapeHtml(barber.barberName || "Trimly Barber")}</span>
          <h1>${escapeHtml(barber.shopName)}</h1>
          <p class="muted profile-location-line">${escapeHtml(barber.location)}</p>
          <p class="profile-bio-lead">${escapeHtml(barber.bio)}</p>

          <div class="profile-stat-grid">
            <article class="profile-stat-card">
              <small>Haircut</small>
              <strong>${priceText(barber.price)}</strong>
            </article>
            <article class="profile-stat-card">
              <small>Beard Trim</small>
              <strong>${barber.beardTrimPrice ? priceText(barber.beardTrimPrice) : "On request"}</strong>
            </article>
            <article class="profile-stat-card">
              <small>Availability</small>
              <strong>${barber.available ? "Open now" : "Offline"}</strong>
            </article>
          </div>

          <div class="pill-row">
            <span class="pill">${escapeHtml(renderStars(reviewAverage || barber.rating || 0))}</span>
            <span class="pill">Days: ${escapeHtml(availableDaysLabel)}</span>
            <span class="pill ${barber.available ? "pill-success" : ""}">
              ${barber.available ? "Booking open" : "Booking paused"}
            </span>
          </div>

          <section class="profile-section-block">
            <div class="panel-head-row">
              <h3>Services</h3>
              <span class="pill">${serviceChips.length} listed</span>
            </div>
            <div class="pill-row">
              ${serviceChips.map((service) => `<span class="pill">${escapeHtml(service)}</span>`).join("")}
            </div>
          </section>

          <section class="profile-section-block">
            <div class="panel-head-row">
              <div>
                <h3>Next Available Times</h3>
                <p class="muted">Pick a nearby slot or jump straight into the booking page.</p>
              </div>
              <span class="pill">Today</span>
            </div>
            <div class="time-grid">
              ${
                nextSlots.length
                  ? nextSlots.map((value) => `<span class="time-chip">${escapeHtml(value)}</span>`).join("")
                  : `<span class="muted">No open slots returned right now.</span>`
              }
            </div>
          </section>

          <div class="profile-action-row">
            <a class="btn btn-primary" href="/static/booking.html?barber=${barber.id}">Book This Barber</a>
            <button class="btn btn-ghost" type="button" data-copy-link="${escapeHtml(directBookingUrl)}">Copy Booking Link</button>
          </div>

          <section class="profile-cta-panel">
            <div>
              <strong>Ready to book ${escapeHtml(barber.shopName)}?</strong>
              <p class="muted">Choose a slot, send your request, and pay only after approval.</p>
            </div>
            <a class="btn btn-primary" href="/static/booking.html?barber=${barber.id}">Start Booking</a>
          </section>
        </div>
      </section>

      <section class="profile-content-grid">
        <article class="profile-side-card">
          <div class="panel-head-row">
            <h3>Why book here</h3>
            <span class="pill">Trust</span>
          </div>
          <div class="profile-trust-list">
            ${reliabilityItems.map((item) => `<div class="profile-trust-item">${escapeHtml(item)}</div>`).join("")}
          </div>
        </article>
        <article class="profile-side-card">
          <div class="panel-head-row">
            <h3>Share this barber page</h3>
            <span class="pill">Invite bookings</span>
          </div>
          <div class="share-link-panel profile-share-panel">
            <p class="muted">This is the public link a barber can send to people so they can view the profile and book directly.</p>
            <div class="share-link-list">
              <div class="share-link-row">
                <span class="muted">Public profile</span>
                <a href="${escapeHtml(publicProfileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(publicProfileUrl)}</a>
              </div>
              <div class="share-link-row">
                <span class="muted">Direct booking</span>
                <a href="${escapeHtml(directBookingUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(directBookingUrl)}</a>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section class="profile-portfolio-panel">
        <div class="panel-head-row">
          <h3>Haircut Portfolio</h3>
          <span class="pill">${barber.portfolioImages.length} photo${barber.portfolioImages.length === 1 ? "" : "s"}</span>
        </div>
        ${portfolioGallery}
      </section>

      ${reviewSection}
    `;
    bindCopyLinkButtons(profileView);
  } catch (error) {
    profileView.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function initBookingPage() {
  const token = getToken();
  if (!token) {
    const next = encodeURIComponent("/static/booking.html" + window.location.search);
    window.location.href = "/static/login.html?next=" + next;
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const barberId = params.get("barber");
  const existingBookingId = Number(params.get("booking") || 0);

  const bookingForm = document.getElementById("bookingForm");
  const bookingNotice = document.getElementById("bookingNotice");
  const paymentActions = document.getElementById("bookingPaymentActions");
  const dateInput = document.getElementById("bookingDate");
  const timeSelect = document.getElementById("bookingTime");
  const barberSummary = document.getElementById("bookingBarberSummary");

  if (!bookingForm || !dateInput || !timeSelect || !barberSummary || !barberId) {
    return;
  }

  const now = new Date();
  dateInput.min = toDateInput(now);
  dateInput.value = toDateInput(now);

  async function loadTimeSlots() {
    bookingNotice.textContent = "";
    const selectedDate = dateInput.value;
    if (!selectedDate) return;

    timeSelect.disabled = true;
    timeSelect.innerHTML = `<option>Loading...</option>`;

    try {
      const availability = await getBarberAvailability(barberId, selectedDate).catch(() => []);
      const times = normalizeAvailability(availability);
      hydrateTimeSelect(timeSelect, times);

      if (!times.length) {
        bookingNotice.textContent = "No slots available for this date. Try another day.";
        bookingNotice.className = "notice";
      }
    } catch (error) {
      timeSelect.innerHTML = `<option value="">Unavailable</option>`;
      bookingNotice.textContent = error.message;
      bookingNotice.className = "notice error";
    } finally {
      timeSelect.disabled = false;
    }
  }

  try {
    const barber = mapBarber(await getBarberById(barberId), Number(barberId));
    barberSummary.innerHTML = `
      <strong>${escapeHtml(barber.shopName)}</strong>
      <span>${escapeHtml(barber.location)}</span>
      <span>${priceText(barber.price)} / cut</span>
      <span class="pill ${barber.available ? "pill-success" : ""}">
        ${barber.available ? "Online" : "Offline"}
      </span>
    `;

    if (!barber.available) {
      bookingNotice.textContent = "This barber is currently offline and not accepting bookings.";
      bookingNotice.className = "notice error";
      bookingForm.querySelector("button[type='submit']").disabled = true;
      return;
    }

    await loadTimeSlots();
    if (existingBookingId && paymentActions) {
      await renderBookingPaymentActions(existingBookingId, paymentActions);
    }
  } catch (error) {
    bookingNotice.textContent = error.message;
    bookingNotice.className = "notice error";
    return;
  }

  dateInput.addEventListener("change", () => {
    loadTimeSlots();
  });

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedDate = dateInput.value;
    const selectedTime = timeSelect.value;

    if (!selectedDate || !selectedTime) {
      bookingNotice.textContent = "Please select both date and time.";
      bookingNotice.className = "notice error";
      return;
    }

    const localDate = new Date(`${selectedDate}T${selectedTime}:00`);
    const scheduledTime = localDate.toISOString();

    const submitBtn = bookingForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Confirming...";

    if (paymentActions) {
      paymentActions.innerHTML = "";
    }

    try {
      const bookingResult = await createBooking({
        barber_id: Number(barberId),
        scheduled_time: scheduledTime,
        service_name: "Haircut",
      });

      bookingNotice.textContent =
        "Booking request sent. Payment unlocks after the barber approves your appointment.";
      bookingNotice.className = "notice success";
      await loadTimeSlots();
      await renderBookingPaymentActions(bookingResult.id, paymentActions);

      const nextParams = new URLSearchParams(window.location.search);
      nextParams.set("barber", String(barberId));
      nextParams.set("booking", String(bookingResult.id));
      window.history.replaceState({}, "", "/static/booking.html?" + nextParams.toString());
    } catch (error) {
      bookingNotice.textContent = error.message;
      bookingNotice.className = "notice error";
      if (paymentActions) {
        paymentActions.innerHTML = "";
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Confirm Booking";
    }
  });
}

function bindPasswordToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    const targetId = button.dataset.passwordToggle;
    const input = targetId ? document.getElementById(targetId) : null;
    if (input) {
      updatePasswordToggleUi(button, input.type !== "password");
    }

    button.addEventListener("click", () => {
      const targetId = button.dataset.passwordToggle;
      const input = targetId ? document.getElementById(targetId) : null;
      if (!input) return;

      const nextType = input.type === "password" ? "text" : "password";
      input.type = nextType;
      updatePasswordToggleUi(button, nextType !== "password");
    });
  });
}

function updatePasswordToggleUi(button, isVisible) {
  if (!button) return;
  button.dataset.visible = isVisible ? "true" : "false";
  button.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
  button.setAttribute("title", isVisible ? "Hide password" : "Show password");
  button.textContent = isVisible ? "Hide" : "Show";
}

window.trimlyTogglePasswordInline = function trimlyTogglePasswordInline(targetId, button) {
  const input = targetId ? document.getElementById(targetId) : null;
  if (!input || !button) return false;

  const nextType = input.type === "password" ? "text" : "password";
  input.type = nextType;
  updatePasswordToggleUi(button, nextType !== "password");
  return false;
};

function scrubCredentialParamsFromUrl() {
  const url = new URL(window.location.href);
  let changed = false;
  ["email", "password"].forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });
  if (changed) {
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }
}

function initLoginPage() {
  const loginForm = document.getElementById("loginForm");
  const notice = document.getElementById("authNotice");
  if (!loginForm || !notice) return;
  scrubCredentialParamsFromUrl();

  const params = new URLSearchParams(window.location.search);
  const presetEmail = params.get("email");
  if (presetEmail && loginForm.elements.email) {
    loginForm.elements.email.value = presetEmail;
  }

  const submitBtn = loginForm.querySelector("button[type='submit']");

  const handleLogin = async () => {
    notice.textContent = "";

    const form = new FormData(loginForm);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    try {
      const data = await loginUser(email, password);
      let role = "";
      let authEmail = email;

      setAuthSession(data.access_token);

      try {
        const current = await getCurrentUser();
        role = normalizeRole(current.role);
        authEmail = current.logged_in_as || email;
      } catch (_error) {
        role = normalizeRole(localStorage.getItem("trimly_role") || "customer");
      }

      setAuthSession(data.access_token, role, authEmail);

      const urlParams = new URLSearchParams(window.location.search);
      const next = urlParams.get("next") || "/static/dashboard.html";

      if (role === "barber") {
        const hasProfile = await checkBarberProfileExists();
        if (!hasProfile && !next.includes("setup-barber.html")) {
          window.location.href = "/static/setup-barber.html";
          return;
        }
      }

      window.location.href = next;
    } catch (error) {
      notice.textContent = error.message;
      notice.className = "notice error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
    }
  };

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleLogin();
  });

  submitBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    void handleLogin();
  });
}

function initAdminLoginPage() {
  const adminForm = document.getElementById("adminLoginForm");
  const notice = document.getElementById("adminAuthNotice");
  if (!adminForm || !notice) return;
  scrubCredentialParamsFromUrl();

  const submitBtn = adminForm.querySelector("button[type='submit']");

  const handleAdminLogin = async () => {
    notice.textContent = "";

    const form = new FormData(adminForm);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in...";

    try {
      const data = await adminSessionLogin(email, password);
      setAuthSession(data.access_token);

      const current = await getCurrentUser();
      const role = normalizeRole(current.role);
      const authEmail = current.logged_in_as || email;

      if (!["admin", "super_admin"].includes(role)) {
        clearAuthSession();
        throw new Error("This login is restricted to administrator accounts.");
      }

      setAuthSession(data.access_token, role, authEmail);
      toast("Admin access granted");
      window.location.href = "/admin";
    } catch (error) {
      notice.textContent = error.message;
      notice.className = "notice error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Login as Admin";
    }
  };

  adminForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleAdminLogin();
  });

  submitBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    void handleAdminLogin();
  });
}

async function initAdminDashboardPage() {
  stopBarberAlertPolling();
  const token = getToken();
  if (!token) {
    window.location.href = "/static/admin-login.html";
    return;
  }

  try {
    const me = await getCurrentUser();
    const role = normalizeRole(me.role);
    if (!["admin", "super_admin"].includes(role)) {
      clearAuthSession();
      window.location.href = "/static/admin-login.html";
      return;
    }

    state.currentRole = role;
    state.currentEmail = me.logged_in_as || "";
    localStorage.setItem("trimly_role", role);
    localStorage.setItem("trimly_email", state.currentEmail);

    const emailEl = document.getElementById("adminDashboardEmail");
    const roleEl = document.getElementById("adminDashboardRole");
    const titleEl = document.getElementById("adminDashboardTitle");
    if (emailEl) emailEl.textContent = state.currentEmail;
    if (roleEl) roleEl.textContent = role === "super_admin" ? "Super Admin" : "Admin";
    if (titleEl) {
      titleEl.textContent =
        role === "super_admin"
          ? `Welcome back, ${me.full_name}. Manage admins, trust, and marketplace payouts.`
          : `Welcome back, ${me.full_name}. Review compliance and payouts.`;
    }
    hydrateAuthActions();

    const adminTools = document.getElementById("adminDashboard");
    if (adminTools) {
      adminTools.classList.remove("hidden");
    }

    const managementPanel = document.getElementById("superAdminManagement");
    if (managementPanel) {
      managementPanel.classList.toggle("hidden", role !== "super_admin");
    }

    await hydrateAdminDashboard();
    if (role === "super_admin") {
      await hydrateSuperAdminUsers();
    }
  } catch (_error) {
    clearAuthSession();
    window.location.href = "/static/admin-login.html";
  }
}

function initRegisterPage() {
  const registerForm = document.getElementById("registerForm");
  const notice = document.getElementById("authNotice");
  if (!registerForm || !notice) return;
  const referralInput = document.getElementById("referral_code");
  const referralHint = document.getElementById("referralHint");
  const params = new URLSearchParams(window.location.search);
  const prefilledReferralCode = String(params.get("ref") || "").trim().toUpperCase();

  if (referralInput && prefilledReferralCode) {
    referralInput.value = prefilledReferralCode;
  }
  if (referralHint && prefilledReferralCode) {
    referralHint.textContent = `Referral code ${prefilledReferralCode} will be applied when you create your account.`;
    referralHint.className = "notice success";
  }

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    notice.textContent = "";

    const form = new FormData(registerForm);
    const payload = {
      full_name: String(form.get("full_name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
      role: String(form.get("role") || "customer"),
      phone: String(form.get("phone") || ""),
      accepted_terms: Boolean(form.get("accepted_terms")),
      referral_code: String(form.get("referral_code") || "").trim().toUpperCase() || null,
    };

    const submitBtn = registerForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating...";

    try {
      await registerUser(payload);
      notice.textContent = "Registration successful. Please login.";
      notice.className = "notice success";
      setTimeout(() => {
        window.location.href = `/static/login.html?email=${encodeURIComponent(payload.email)}`;
      }, 800);
    } catch (error) {
      notice.textContent = error.message;
      notice.className = "notice error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create account";
    }
  });
}

async function initDashboardPage() {
  const token = getToken();
  if (!token) {
    const next = encodeURIComponent("/static/dashboard.html");
    window.location.href = `/static/login.html?next=${next}`;
    return;
  }

  const roleBadge = document.getElementById("dashboardRole");
  const emailEl = document.getElementById("dashboardEmail");
  const greetingEl = document.getElementById("customerGreeting");
  const customerSection = document.getElementById("customerDashboard");
  const barberSection = document.getElementById("barberDashboard");
  const adminSection = document.getElementById("adminDashboard");
  const allBookingsPanel = document.getElementById("allBookingsPanel");
  const sharedDisputesPanel = document.getElementById("sharedDisputesPanel");

  if (!roleBadge || !emailEl || !customerSection || !barberSection || !adminSection) return;

  let role = normalizeRole(localStorage.getItem("trimly_role") || "");
  let email = localStorage.getItem("trimly_email") || "";
  let fullName = "";

  try {
    const me = await getCurrentUser();
    state.currentUser = me;
    role = normalizeRole(me.role) || role;
    email = me.logged_in_as || email;
    fullName = me.full_name || "";
    state.currentRole = role;
    state.currentEmail = email;
    if (role) localStorage.setItem("trimly_role", role);
    if (email) localStorage.setItem("trimly_email", email);
  } catch (_error) {
    if (!role) role = "customer";
  }

  hydrateAuthActions();

  const displayName = fullName || deriveDisplayName(email);
  if (greetingEl) {
    greetingEl.textContent = `Welcome back, ${displayName}. Ready for your next cut?`;
  }

  roleBadge.textContent =
    role === "barber" ? "Barber" : role === "admin" ? "Admin" : "Customer";
  emailEl.textContent = email || "Signed in";

  if (role === "barber") {
    const hasProfile = await checkBarberProfileExists();
    if (!hasProfile) {
      stopBarberAlertPolling();
      window.location.href = "/static/setup-barber.html";
      return;
    }

    customerSection.classList.add("hidden");
    barberSection.classList.remove("hidden");
    adminSection.classList.add("hidden");
    allBookingsPanel?.classList.remove("hidden");
    sharedDisputesPanel?.classList.remove("hidden");
    await hydrateBarberDashboard();
    bindBarberStatusToggle();
    bindAvailabilitySettings();
    bindCalendarControls();
    await hydrateSharedDisputes();
  } else if (["admin", "super_admin"].includes(role)) {
    stopBarberAlertPolling();
    window.location.href = "/admin";
  } else {
    stopBarberAlertPolling();
    barberSection.classList.add("hidden");
    adminSection.classList.add("hidden");
    customerSection.classList.remove("hidden");
    allBookingsPanel?.classList.add("hidden");
    sharedDisputesPanel?.classList.remove("hidden");
    await hydrateCustomerDashboard();
    await hydrateSharedDisputes();
  }
}

async function initSettingsPage() {
  stopBarberAlertPolling();
  const token = getToken();
  if (!token) {
    const next = encodeURIComponent("/static/settings.html");
    window.location.href = `/static/login.html?next=${next}`;
    return;
  }

  try {
    const me = await getCurrentUser();
    const role = normalizeRole(me.role);
    const email = me.logged_in_as || "";
    state.currentUser = me;
    state.currentRole = role;
    state.currentEmail = email;
    localStorage.setItem("trimly_role", role);
    localStorage.setItem("trimly_email", email);
    hydrateAuthActions();

    const emailEl = document.getElementById("settingsEmail");
    const roleEl = document.getElementById("settingsRole");
    const titleEl = document.getElementById("settingsTitle");
    const subtitleEl = document.getElementById("settingsSubtitle");

    if (emailEl) emailEl.textContent = email;
    if (roleEl) roleEl.textContent = role === "super_admin" ? "Super Admin" : capitalize(role || "customer");
    if (titleEl) {
      titleEl.textContent =
        role === "barber"
          ? "Shape your Trimly profile, alerts, and availability."
          : role === "super_admin"
            ? "Manage your account and preferences separately from the admin console."
            : "Control your Trimly account, alerts, and preferences.";
    }
    if (subtitleEl) {
      subtitleEl.textContent =
        role === "barber"
          ? "Keep your public page polished, your links ready to share, and your customer experience sharp."
          : "Everything personal lives here so your main dashboard can stay focused on bookings and activity.";
    }

    if (role === "barber") {
      try {
        state.barberProfile = await getMyBarberProfile();
      } catch (_error) {
        state.barberProfile = null;
      }
      try {
        state.barberServices = await getBarberServices();
      } catch (_error) {
        state.barberServices = Array.isArray(state.barberProfile?.services) ? state.barberProfile.services : [];
      }
      if (state.barberProfile) {
        state.barberProfile.services = Array.isArray(state.barberServices) ? [...state.barberServices] : [];
      }
      try {
        state.barberKyc = await getMyBarberKyc();
      } catch (_error) {
        state.barberKyc = null;
      }
    }

    hydrateSettingsPanel();
    if (role === "barber") {
      const profileForm = document.getElementById("barberProfileForm");
      const profileNotice = document.getElementById("barberProfileNotice");
      const profileImageFileInput = document.getElementById("barber_profile_image_file");
      const profileImagePreview = document.getElementById("barberProfileImagePreview");
      const coverImageFileInput = document.getElementById("barber_cover_image_file");
      const coverImagePreview = document.getElementById("barberCoverImagePreview");
      const portfolioList = document.getElementById("barberPortfolioList");
      const portfolioFileInput = document.getElementById("barberPortfolioFileInput");
      const portfolioUrlInput = document.getElementById("barberPortfolioUrlInput");
      const addPortfolioBtn = document.getElementById("addBarberPortfolioUrl");
      const uploadPortfolioBtn = document.getElementById("uploadBarberPortfolioFiles");

      hydrateBarberProfileEditor(
        profileForm,
        profileNotice,
        profileImageFileInput,
        profileImagePreview,
        coverImageFileInput,
        coverImagePreview,
        portfolioList,
        portfolioFileInput,
        portfolioUrlInput,
        addPortfolioBtn,
        uploadPortfolioBtn
      );
    }
  } catch (_error) {
    clearAuthSession();
    const next = encodeURIComponent("/static/settings.html");
    window.location.href = `/static/login.html?next=${next}`;
  }
}

async function initSetupBarberPage() {
  const token = getToken();
  if (!token) {
    const next = encodeURIComponent("/static/setup-barber.html");
    window.location.href = `/static/login.html?next=${next}`;
    return;
  }

  const form = document.getElementById("setupBarberForm");
  const notice = document.getElementById("setupBarberNotice");
  const kycBlock = document.getElementById("barberKycBlock");
  const kycForm = document.getElementById("barberKycForm");
  const kycNotice = document.getElementById("barberKycNotice");
  const kycStatus = document.getElementById("setupKycStatus");
  if (!form || !notice) return;

  let role = normalizeRole(localStorage.getItem("trimly_role") || "");

  try {
    const me = await getCurrentUser();
    role = normalizeRole(me.role) || role;
  } catch (_error) {
    // Use cached auth values when /me fails.
  }

  if (role !== "barber") {
    window.location.href = "/static/dashboard.html";
    return;
  }

  const hasProfile = await checkBarberProfileExists();
  if (hasProfile) {
    form.classList.add("hidden");
    notice.textContent = "Your barber profile is already live. Complete KYC below if needed.";
    notice.className = "notice success";
    if (kycBlock) kycBlock.classList.remove("hidden");
    await hydrateSetupKycForm();
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    notice.textContent = "";

    const formData = new FormData(form);

    const city = String(formData.get("city") || "").trim();
    const area = String(formData.get("area") || "").trim();
    const address = String(formData.get("address") || "").trim();

    const selectedDays = Array.from(
      form.querySelectorAll("input[name='available_days']:checked")
    ).map((checkbox) => checkbox.value);

    const payload = {
      shop_name: String(formData.get("shop_name") || "").trim(),
      location: [city, area, address].filter(Boolean).join(", "),
      bio: String(formData.get("bio") || "").trim(),
      haircut_price: Number(formData.get("haircut_price") || 0),
      beard_trim_price: Number(formData.get("beard_price") || 0) || null,
      other_services: String(formData.get("other_services") || "").trim() || null,
      barber_name: String(formData.get("barber_name") || "").trim(),
      profile_image_url: null,
      cover_image_url: null,
      portfolio_image_urls: [],
      available_days: selectedDays,
      available_start_time: String(formData.get("start_time") || ""),
      available_end_time: String(formData.get("end_time") || ""),
      is_available: true,
    };

    if (!payload.available_days.length) {
      notice.textContent = "Select at least one available day.";
      notice.className = "notice error";
      return;
    }

    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    try {
      const profileImageFile = formData.get("profile_image");
      if (profileImageFile && typeof profileImageFile === "object" && profileImageFile.name) {
        const uploadedProfile = await uploadBarberImage(profileImageFile);
        payload.profile_image_url = String(uploadedProfile?.url || "").trim() || null;
        payload.cover_image_url = payload.profile_image_url;
      }

      const portfolioFiles = Array.from(formData.getAll("portfolio_images") || []).filter(
        (file) => file && typeof file === "object" && file.name
      );
      if (portfolioFiles.length) {
        const uploads = await Promise.all(portfolioFiles.map((file) => uploadBarberImage(file)));
        payload.portfolio_image_urls = uploads
          .map((item) => String(item?.url || "").trim())
          .filter(Boolean);
        if (!payload.cover_image_url && payload.portfolio_image_urls.length) {
          payload.cover_image_url = payload.portfolio_image_urls[0];
        }
      }

      await createBarberProfile(payload);
      notice.textContent = "Profile created successfully. Submit KYC to complete onboarding.";
      notice.className = "notice success";
      form.classList.add("hidden");
      await checkBarberProfileExists();
      if (kycBlock) kycBlock.classList.remove("hidden");
      await hydrateSetupKycForm();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (error) {
      notice.textContent = error.message;
      notice.className = "notice error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Barber Profile";
    }
  });

  async function hydrateSetupKycForm() {
    if (!kycBlock || !kycForm || !kycNotice) return;
    kycBlock.classList.remove("hidden");

    try {
      const profile = state.barberProfile || (await getMyBarberProfile());
      state.barberProfile = profile;
      if (kycStatus) {
        kycStatus.textContent = capitalize(profile.kyc_status || "pending");
        kycStatus.className = `status-badge status-${String(profile.kyc_status || "pending").toLowerCase()}`;
      }

      try {
        const kyc = await getMyBarberKyc();
        state.barberKyc = kyc;
        populateKycForm(kycForm, kyc);
      } catch (_error) {
        state.barberKyc = null;
      }
    } catch (_error) {
      // keep setup page usable if profile lookup briefly fails
    }

    if (kycForm.dataset.bound === "true") return;
    kycForm.dataset.bound = "true";
    kycForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitBtn = kycForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting...";
      kycNotice.textContent = "";

      try {
        const payload = Object.fromEntries(new FormData(kycForm).entries());
        const result = await submitBarberKyc(payload);
        state.barberKyc = result;
        kycNotice.textContent = "KYC submitted successfully. Your account is now pending admin review.";
        kycNotice.className = "notice success";
        if (kycStatus) {
          kycStatus.textContent = "Pending";
          kycStatus.className = "status-badge status-pending";
        }
        setTimeout(() => {
          window.location.href = "/static/dashboard.html";
        }, 900);
      } catch (error) {
        kycNotice.textContent = error.message;
        kycNotice.className = "notice error";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit KYC";
      }
    });
  }
}

async function hydrateCustomerDashboard() {
  const upcomingCardEl = document.getElementById("customerUpcomingCard");
  const trendingEl = document.getElementById("customerTrending");
  const nearbyEl = document.getElementById("customerNearby");
  const bookAgainEl = document.getElementById("customerBookAgain");
  const recentActivityEl = document.getElementById("customerRecentActivity");
  const disputesEl = document.getElementById("customerDisputesList");
  const disputeCountEl = document.getElementById("customerDisputeCount");
  const searchForm = document.getElementById("customerSearchForm");
  const searchInput = document.getElementById("customerBarberSearch");
  const styleButtons = document.querySelectorAll(".style-chip");
  const quickBookAgain = document.getElementById("quickBookAgain");
  const notificationsEl = document.getElementById("customerNotificationsList");
  const notificationCountEl = document.getElementById("customerNotificationCount");
  const readAllNotificationsBtn = document.getElementById("customerReadAllNotifications");

  const statTotalAppointments = document.getElementById("statTotalAppointments");
  const statFavoriteBarbers = document.getElementById("statFavoriteBarbers");
  const statCompletedHaircuts = document.getElementById("statCompletedHaircuts");
  const statLoyaltyPoints = document.getElementById("statLoyaltyPoints");

  if (!upcomingCardEl || !trendingEl || !nearbyEl || !bookAgainEl || !recentActivityEl || !disputesEl) {
    return;
  }

  if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = (searchInput.value || "").trim();
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      window.location.href = `/static/barbers.html${params.toString() ? `?${params}` : ""}`;
    });
  }

  styleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const style = button.dataset.style || "";
      const params = new URLSearchParams();
      if (style) params.set("q", style);
      window.location.href = `/static/barbers.html?${params.toString()}`;
    });
  });

  upcomingCardEl.innerHTML = `<div class="loading">Loading upcoming appointment...</div>`;
  trendingEl.innerHTML = `<div class="loading">Loading trending barbers...</div>`;
  nearbyEl.innerHTML = `<div class="loading">Loading nearby barbers...</div>`;
  bookAgainEl.innerHTML = `<div class="loading">Loading last booking...</div>`;
  recentActivityEl.innerHTML = `<div class="loading">Loading activity...</div>`;
  disputesEl.innerHTML = `<div class="loading">Loading disputes...</div>`;

  try {
    const [bookings, apiBarbers, disputes, customerInsights] = await Promise.all([
      getBookings(),
      getBarbers({ available: true }).catch(() => []),
      getMyDisputes().catch(() => []),
      getCustomerInsights().catch(() => null),
    ]);
    state.disputes = Array.isArray(disputes) ? disputes : [];

    const mappedBarbers = apiBarbers.map((item, index) => mapBarber(item, index));
    const barberMap = new Map(mappedBarbers.map((barber) => [Number(barber.id), barber]));

    const now = new Date();
    const upcoming = bookings
      .filter((booking) => {
        const when = new Date(booking.scheduled_time);
        return when >= now && ["pending", "approved", "accepted"].includes(String(booking.status));
      })
      .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

    const past = bookings
      .filter((booking) => {
        const when = new Date(booking.scheduled_time);
        return when < now || ["completed", "cancelled", "rejected"].includes(String(booking.status));
      })
      .sort((a, b) => new Date(b.scheduled_time) - new Date(a.scheduled_time));

    const favorites = (() => {
      try {
        const raw = JSON.parse(localStorage.getItem("favourites") || "[]");
        return Array.isArray(raw) ? raw : [];
      } catch (_error) {
        return [];
      }
    })();

    if (statTotalAppointments) {
      statTotalAppointments.textContent = String(customerInsights?.total_appointments ?? bookings.length);
    }
    if (statFavoriteBarbers) statFavoriteBarbers.textContent = String(favorites.length);
    if (statCompletedHaircuts) {
      statCompletedHaircuts.textContent = String(
        customerInsights?.completed_haircuts ?? bookings.filter((booking) => String(booking.status) === "completed").length
      );
    }
    if (statLoyaltyPoints) {
      statLoyaltyPoints.textContent = String(customerInsights?.loyalty_points ?? 0);
    }

    upcomingCardEl.innerHTML = renderUpcomingAppointmentCard(upcoming[0], barberMap);

    const trending = [...mappedBarbers].sort((a, b) => b.rating - a.rating).slice(0, 4);
    trendingEl.innerHTML = trending.length
      ? trending.map((barber) => barberCardTemplate(barber, "Book Now")).join("")
      : renderEmptyStateCard("No trending barbers yet", "We do not have any verified barbers live in this area yet. Check back soon or browse the full marketplace.", "/static/barbers.html", "Browse Barbers");

    const nearby = mappedBarbers.slice(0, 5);
    nearbyEl.innerHTML = nearby.length
      ? nearby
          .map((barber) => {
            const distanceKm = (0.7 + ((barber.id * 1.35) % 8)).toFixed(1);
            return nearbyBarberTemplate(barber, distanceKm);
          })
          .join("")
      : renderEmptyStateCard("No nearby barbers right now", "Once more verified barbers come online, they will appear here for quick booking.", "/static/barbers.html", "See Marketplace");

    const lastBooking = past[0] || upcoming[0];
    bookAgainEl.innerHTML = renderBookAgainCard(lastBooking, barberMap);

    if (quickBookAgain) {
      quickBookAgain.href = lastBooking
        ? `/static/booking.html?barber=${Number(lastBooking.barber_id)}`
        : "/static/barbers.html";
    }

    recentActivityEl.innerHTML = renderRecentActivityList(bookings, barberMap, state.disputes);
    disputesEl.innerHTML = renderDisputeList(state.disputes, "No disputes raised.");
    if (disputeCountEl) {
      disputeCountEl.textContent = `${state.disputes.filter((item) =>
        ["open", "investigating"].includes(String(item.status || "").toLowerCase())
      ).length} open`;
    }
    bindInlinePaymentButtons(document);
    bindDashboardBookingActions();
    focusDashboardTarget();
  } catch (error) {
    const message = escapeHtml(error.message);
    upcomingCardEl.innerHTML = `<p class="error">${message}</p>`;
    trendingEl.innerHTML = `<p class="error">${message}</p>`;
    nearbyEl.innerHTML = `<p class="error">${message}</p>`;
    bookAgainEl.innerHTML = `<p class="error">${message}</p>`;
    recentActivityEl.innerHTML = `<p class="error">${message}</p>`;
    disputesEl.innerHTML = `<p class="error">${message}</p>`;
  }

  await hydrateNotificationsPanel({
    listEl: notificationsEl,
    countEl: notificationCountEl,
    readAllBtn: readAllNotificationsBtn,
    emptyText: "You have no notifications yet. Booking updates will show here.",
  });
}

function nearbyBarberTemplate(barber, distanceKm) {
  return `
    <article class="nearby-card">
      <div class="nearby-left">
        ${barberImageMarkup(barber, "nearby-avatar", barber.shopName, "avatar-placeholder")}
        <div class="nearby-meta">
          <h4>${escapeHtml(barber.shopName)}</h4>
          <p class="muted">${escapeHtml(barber.location)} - ${distanceKm} km</p>
        </div>
      </div>
      <a class="btn btn-ghost" href="/static/booking.html?barber=${barber.id}">Book</a>
    </article>
  `;
}

function renderUpcomingAppointmentCard(booking, barberMap) {
  if (!booking) {
    return `
      <p class="muted">No upcoming appointment yet.</p>
      <div class="upcoming-actions">
        <a class="btn btn-primary" href="/static/barbers.html">Find a Barber</a>
      </div>
    `;
  }

  const barber = barberMap.get(Number(booking.barber_id));
  const barberName = barber ? barber.shopName : booking.barber_name || `Barber #${booking.barber_id}`;
  const barberLocation = barber ? barber.location : booking.barber_location || "Location unavailable";

  return `
    <article data-booking-card-id="${Number(booking.id)}">
      <h4>${escapeHtml(barberName)}</h4>
      <div class="upcoming-meta">
        <span class="muted">${escapeHtml(barberLocation)}</span>
        <span>${formatDateTime(booking.scheduled_time)}</span>
        <span class="status-badge status-${escapeHtml(String(booking.status).toLowerCase())}">${escapeHtml(
      String(booking.status)
    )}</span>
      </div>
      <div class="upcoming-actions">
        <a class="btn btn-ghost" href="/static/barber-profile.html?id=${Number(booking.barber_id)}">View</a>
        ${renderPaymentAction(booking)}
        ${renderMessageAction(booking)}
        ${renderCustomerBookingActions(booking, state.disputes)}
        <a class="btn btn-primary" href="/static/booking.html?barber=${Number(
          booking.barber_id
        )}&booking=${Number(booking.id)}">Reschedule</a>
      </div>
    </article>
  `;
}

function renderBookAgainCard(booking, barberMap) {
  if (!booking) {
    return renderEmptyStateCard("No previous bookings yet", "After your first appointment, your favorite barbers and quick rebook options will show up here.", "/static/barbers.html", "Find Barbers");
  }

  const barber = barberMap.get(Number(booking.barber_id));
  const barberName = barber ? barber.shopName : booking.barber_name || `Barber #${booking.barber_id}`;
  const barberLocation = barber ? barber.location : booking.barber_location || "Location unavailable";
  return `
    <article class="book-again-card">
      <div class="book-again-card-head">
        ${barberImageMarkup(
          barber || { barberName, shopName: barberName, image: "" },
          "book-again-avatar",
          barberName,
          "avatar-placeholder"
        )}
        <div>
          <strong>${escapeHtml(barberName)}</strong>
          <p class="muted">${escapeHtml(barberLocation)}</p>
        </div>
      </div>
      <p class="muted">Last appointment: ${formatDateTime(booking.scheduled_time)}</p>
      <div class="upcoming-actions" style="margin-top:10px;">
        <a class="btn btn-primary" href="/static/booking.html?barber=${Number(booking.barber_id)}">Book Again</a>
        <a class="btn btn-ghost" href="/static/barber-profile.html?id=${Number(booking.barber_id)}">View Profile</a>
      </div>
    </article>
  `;
}

function renderRecentActivityList(bookings, barberMap, disputes = []) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return renderEmptyStateCard("No activity yet", "Your bookings, payments, and completed cuts will show up here once you start using Trimly.", "/static/barbers.html", "Book a Barber");
  }

  const sorted = [...bookings].sort(
    (a, b) => new Date(b.scheduled_time) - new Date(a.scheduled_time)
  );

  return sorted
    .slice(0, 6)
    .map((booking) => {
      const barber = barberMap.get(Number(booking.barber_id));
      const barberName = barber ? barber.shopName : booking.barber_name || `Barber #${booking.barber_id}`;
      const statusValue = String(booking.status || "pending").toLowerCase();

      return `
        <article class="activity-row" data-booking-card-id="${Number(booking.id)}">
          <div class="activity-left">
            ${barberImageMarkup(
              barber || { barberName, shopName: barberName, image: "" },
              "activity-avatar",
              barberName,
              "avatar-placeholder"
            )}
            <div>
              <strong>${escapeHtml(barberName)}</strong>
              <p class="muted">${formatDateTime(booking.scheduled_time)}</p>
            </div>
          </div>
          <div class="booking-tags booking-tags-expanded">
            <span class="status-badge status-${escapeHtml(statusValue)}">${escapeHtml(statusValue)}</span>
            <span class="pill">${priceText(booking.price)}</span>
            ${renderPaymentAction(booking)}
            ${renderMessageAction(booking)}
            ${renderCustomerBookingActions(booking, disputes)}
          </div>
        </article>
      `;
    })
    .join("");
}

async function hydrateBarberDashboard() {
  const pendingEl = document.getElementById("barberPending");
  const allEl = document.getElementById("barberAll");
  const todayEl = document.getElementById("barberTodayList");
  const recentClientsEl = document.getElementById("barberRecentClients");
  const disputesEl = document.getElementById("barberDisputesList");
  const kycBadge = document.getElementById("barberKycBadge");
  const kycSummary = document.getElementById("barberKycSummary");
  const kycForm = document.getElementById("barberKycDashboardForm");
  const kycNotice = document.getElementById("barberKycNotice");
  const profileForm = document.getElementById("barberProfileForm");
  const profileNotice = document.getElementById("barberProfileNotice");
  const profileImageFileInput = document.getElementById("barber_profile_image_file");
  const profileImagePreview = document.getElementById("barberProfileImagePreview");
  const coverImageFileInput = document.getElementById("barber_cover_image_file");
  const coverImagePreview = document.getElementById("barberCoverImagePreview");
  const portfolioList = document.getElementById("barberPortfolioList");
  const portfolioFileInput = document.getElementById("barberPortfolioFileInput");
  const portfolioUrlInput = document.getElementById("barberPortfolioUrlInput");
  const addPortfolioBtn = document.getElementById("addBarberPortfolioUrl");
  const uploadPortfolioBtn = document.getElementById("uploadBarberPortfolioFiles");
  const sharePanel = document.getElementById("barberSharePanel");
  const shareProfileInput = document.getElementById("barberPublicProfileLink");
  const shareBookingInput = document.getElementById("barberDirectBookingLink");
  const notificationsEl = document.getElementById("barberNotificationsList");
  const notificationCountEl = document.getElementById("barberNotificationCount");
  const readAllNotificationsBtn = document.getElementById("barberReadAllNotifications");
  const soundToggle = document.getElementById("barberNotificationSoundToggle");
  const highlightToggle = document.getElementById("barberNotificationHighlightToggle");

  const earningsTodayValue = document.getElementById("earningsTodayValue");
  const earningsWeekValue = document.getElementById("earningsWeekValue");
  const earningsTotalValue = document.getElementById("earningsPendingEscrowValue");
  const jobsValue = document.getElementById("jobsValue");
  const checklistEl = document.getElementById("barberOnboardingChecklist");
  const checklistProgressEl = document.getElementById("barberChecklistProgress");
  const profileHealthEl = document.getElementById("barberProfileHealth");
  const profileRatingEl = document.getElementById("barberProfileRating");
  const profileReviewCountEl = document.getElementById("barberProfileReviewCount");
  const profilePortfolioCountEl = document.getElementById("barberProfilePortfolioCount");
  const profileShareReadinessEl = document.getElementById("barberProfileShareReadiness");

  if (
    !pendingEl ||
    !allEl ||
    !todayEl ||
    !recentClientsEl ||
    !disputesEl ||
    !earningsTodayValue ||
    !earningsWeekValue ||
    !earningsTotalValue ||
    !jobsValue
  ) {
    return;
  }

  pendingEl.innerHTML = `<div class="loading">Loading requests...</div>`;
  allEl.innerHTML = `<div class="loading">Loading bookings...</div>`;
  todayEl.innerHTML = `<div class="loading">Loading today's appointments...</div>`;
  recentClientsEl.innerHTML = `<div class="loading">Loading recent clients...</div>`;
  disputesEl.innerHTML = `<div class="loading">Loading disputes...</div>`;

  try {
    const [bookings, disputes, barberInsights] = await Promise.all([
      getBookings(),
      getMyDisputes().catch(() => []),
      getBarberInsights().catch(() => null),
    ]);
    state.barberBookings = Array.isArray(bookings) ? bookings : [];
    state.disputes = Array.isArray(disputes) ? disputes : [];

    try {
      state.barberProfile = await getMyBarberProfile();
    } catch (_error) {
      // keep existing cached profile
    }

    try {
      state.barberKyc = await getMyBarberKyc();
    } catch (_error) {
      state.barberKyc = null;
    }

    const now = new Date();
    const todayKey = toDateInput(now);
    const weekStart = startOfWeek(now);

    const pending = state.barberBookings.filter((booking) => String(booking.status) === "pending");
    const completed = state.barberBookings.filter((booking) => String(booking.status) === "completed");
    const paidAwaitingRelease = state.barberBookings.filter(
      (booking) =>
        String(booking.status) === "paid" &&
        !["refunded", "refund_requested"].includes(String(booking.payout_status || "").toLowerCase())
    );

    const todayAppointments = state.barberBookings
      .filter((booking) => toDateInput(new Date(booking.scheduled_time)) === todayKey)
      .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

    const todayEarnings = completed
      .filter((booking) => toDateInput(new Date(booking.scheduled_time)) === todayKey)
      .reduce((sum, booking) => sum + Number(booking.barber_earnings || 0), 0);

    const weeklyEarnings = completed
      .filter((booking) => new Date(booking.scheduled_time) >= weekStart)
      .reduce((sum, booking) => sum + Number(booking.barber_earnings || 0), 0);

    const totalEarnings = completed.reduce(
      (sum, booking) => sum + Number(booking.barber_earnings || 0),
      0
    );

    earningsTodayValue.textContent = priceText(barberInsights?.today_earnings ?? todayEarnings);
    earningsWeekValue.textContent = priceText(barberInsights?.weekly_earnings ?? weeklyEarnings);
    earningsTotalValue.textContent = priceText(
      barberInsights?.awaiting_payout_review ??
        paidAwaitingRelease.reduce((sum, booking) => sum + Number(booking.barber_payout_amount || 0), 0)
    );
    jobsValue.textContent = String(barberInsights?.completed_jobs ?? completed.length);

    pendingEl.innerHTML = renderBarberRequestList(pending);
    todayEl.innerHTML = renderTodayAppointmentList(todayAppointments);
    allEl.innerHTML = renderBookingList(state.barberBookings, "No bookings yet.", state.disputes);
    recentClientsEl.innerHTML = renderRecentClientsList(completed);
    disputesEl.innerHTML = renderDisputeList(state.disputes, "No disputes raised.");
    if (checklistEl && checklistProgressEl && profileHealthEl && profileRatingEl && profileReviewCountEl && profilePortfolioCountEl && profileShareReadinessEl) {
      const checklist = buildBarberChecklist(state.barberProfile, state.barberKyc);
      const completedItems = checklist.filter((item) => item.done).length;
      checklistProgressEl.textContent = `${completedItems} / ${checklist.length} done`;
      checklistEl.innerHTML = checklist
        .map(
          (item) => `
            <article class="checklist-item ${item.done ? "done" : ""}">
              <strong>${escapeHtml(item.title)}</strong>
              <p class="muted">${escapeHtml(item.copy)}</p>
            </article>
          `
        )
        .join("");
      profileHealthEl.textContent = completedItems >= 4 ? "Strong" : completedItems >= 2 ? "Improving" : "Needs work";
      const effectiveReviewCount = barberInsights?.review_count ?? Number(state.barberProfile?.review_count || 0);
      const effectiveAverageRating = barberInsights?.average_rating ?? Number(state.barberProfile?.average_rating || 0);
      profileRatingEl.textContent = effectiveReviewCount
        ? `${Number(effectiveAverageRating).toFixed(1)} / 5`
        : "New";
      profileReviewCountEl.textContent = String(effectiveReviewCount);
      profilePortfolioCountEl.textContent = String(
        Array.isArray(state.barberProfile?.portfolio_image_urls) ? state.barberProfile.portfolio_image_urls.length : 0
      );
      profileShareReadinessEl.textContent = completedItems >= 4 ? "Ready to share" : "Finish setup";
    }
    hydrateBarberKycPanel(kycBadge, kycSummary, kycForm, kycNotice);
    hydrateBarberProfileEditor(
      profileForm,
      profileNotice,
      profileImageFileInput,
      profileImagePreview,
      coverImageFileInput,
      coverImagePreview,
      portfolioList,
      portfolioFileInput,
      portfolioUrlInput,
      addPortfolioBtn,
      uploadPortfolioBtn
    );
    hydrateBarberSharePanel(sharePanel, shareProfileInput, shareBookingInput);

    bindDashboardBookingActions();
    renderBarberCalendar();
    focusDashboardTarget();
  } catch (error) {
    pendingEl.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    allEl.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    todayEl.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    recentClientsEl.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    disputesEl.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }

  await hydrateNotificationsPanel({
    listEl: notificationsEl,
    countEl: notificationCountEl,
    readAllBtn: readAllNotificationsBtn,
    emptyText: "No alerts yet. New booking requests and payment updates will appear here.",
  });
  hydrateBarberNotificationPreferences(soundToggle, highlightToggle);
  await hydrateBarberAlertPanels({
    pendingEl,
    notificationsEl,
    notificationCountEl,
    readAllNotificationsBtn,
    silent: true,
  });
  ensureBarberAlertPolling({
    pendingEl,
    notificationsEl,
    notificationCountEl,
    readAllNotificationsBtn,
  });
}

async function hydrateSharedDisputes() {
  const sharedDisputesEl = document.getElementById("sharedDisputesList");
  if (!sharedDisputesEl) return;

  try {
    const disputes = await getMyDisputes();
    state.disputes = Array.isArray(disputes) ? disputes : [];
    sharedDisputesEl.innerHTML = renderDisputeList(state.disputes, "No disputes raised.");
  } catch (error) {
    sharedDisputesEl.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function hydrateNotificationsPanel({ listEl, countEl, readAllBtn, emptyText }) {
  if (!listEl || !countEl || !readAllBtn) return;

  listEl.innerHTML = `<div class="loading">Loading notifications...</div>`;

  try {
    const response = await getNotifications(8);
    const items = Array.isArray(response?.items) ? response.items : [];
    const unreadCount = Number(response?.unread_count || 0);
    state.notifications = items;
    listEl.innerHTML = renderNotificationsList(items, emptyText);
    countEl.textContent = `${unreadCount} unread`;
    readAllBtn.disabled = unreadCount === 0;
    bindNotificationActions(listEl, async () =>
      hydrateNotificationsPanel({ listEl, countEl, readAllBtn, emptyText })
    );
  } catch (error) {
    listEl.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    countEl.textContent = "0 unread";
    readAllBtn.disabled = true;
  }

  if (readAllBtn.dataset.bound === "true") return;
  readAllBtn.dataset.bound = "true";
  readAllBtn.addEventListener("click", async () => {
    readAllBtn.disabled = true;
    try {
      await markAllNotificationsRead();
      toast("Notifications marked as read");
      await hydrateNotificationsPanel({ listEl, countEl, readAllBtn, emptyText });
    } catch (error) {
      toast(error.message, true);
      readAllBtn.disabled = false;
    }
  });
}

function renderNotificationsList(notifications, emptyText = "No notifications yet.") {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }

  return notifications
    .map(
      (item) => `
        <article class="notification-item ${item.is_read ? "" : "unread"} ${notificationPriorityClass(item)}">
          <div class="notification-copy">
            <div class="notification-heading-row">
              <strong>${escapeHtml(item.title || "Notification")}</strong>
              <div class="notification-pill-row">
                ${renderNotificationPriorityPill(item)}
                ${item.is_read ? `<span class="pill">Read</span>` : `<span class="pill pill-success">Unread</span>`}
              </div>
            </div>
            <p class="notification-message">${escapeHtml(item.message || "")}</p>
            <span class="muted notification-time">${escapeHtml(formatDateTime(item.created_at))}</span>
          </div>
          <div class="action-row">
            ${renderNotificationOpenActions(item, false)}
            ${
              item.is_read
                ? ""
                : `<button class="btn btn-ghost" type="button" data-notification-read="${Number(item.id)}">Mark read</button>`
            }
          </div>
        </article>
      `
    )
    .join("");
}

function bindNotificationActions(container = document, refreshCallback = null) {
  container.querySelectorAll("[data-notification-read]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const notificationId = Number(button.dataset.notificationRead || 0);
      if (!notificationId) return;
      button.disabled = true;
      try {
        await markNotificationRead(notificationId);
        if (typeof refreshCallback === "function") {
          await refreshCallback();
        }
      } catch (error) {
        toast(error.message, true);
        button.disabled = false;
      }
    });
  });
}

function isUrgentNotification(item) {
  return String(item?.type || "").toLowerCase() === "booking_created";
}

function isChatNotification(item) {
  const type = String(item?.type || "").toLowerCase();
  const link = String(item?.link || "");
  return type === "chat_available" || link.includes("/static/messages.html");
}

function isPaymentNotification(item) {
  return String(item?.type || "").toLowerCase() === "booking_paid";
}

function notificationPriorityClass(item) {
  return isUrgentNotification(item) && shouldHighlightUrgentRequests() ? "notification-urgent" : "";
}

function renderNotificationPriorityPill(item) {
  if (isUrgentNotification(item) && shouldHighlightUrgentRequests()) {
    return `<span class="pill pill-alert">Urgent</span>`;
  }
  if (isChatNotification(item)) {
    return `<span class="pill pill-chat">Chat Ready</span>`;
  }
  return "";
}

function getNotificationOpenLabel(item) {
  if (isChatNotification(item)) return "Open Chat";
  if (isPaymentNotification(item)) return "View Booking";
  return "Open";
}

function getNotificationBookingLink(item) {
  const bookingId = Number(item?.booking_id || 0);
  if (!bookingId) return "";
  const focus = isChatNotification(item) ? "chat" : isPaymentNotification(item) ? "payment" : "booking";
  return `/static/dashboard.html?booking=${bookingId}&focus=${focus}`;
}

function renderNotificationOpenActions(item, compact = false) {
  const sizeClass = compact ? " btn-sm" : "";
  const actions = [];
  const bookingLink = getNotificationBookingLink(item);
  const primaryLink = isPaymentNotification(item) ? bookingLink || item?.link : item?.link;
  if (primaryLink) {
    actions.push(
      `<a class="btn btn-ghost${sizeClass}" href="${escapeHtml(primaryLink)}">${escapeHtml(getNotificationOpenLabel(item))}</a>`
    );
  }
  if (bookingLink && isChatNotification(item)) {
    actions.push(
      `<a class="btn btn-ghost${sizeClass}" href="${escapeHtml(bookingLink)}">View Booking</a>`
    );
  }
  return actions.join("");
}

function isAdminActivityNotification(item) {
  const type = String(item?.type || "").toLowerCase();
  return [
    "barber_kyc_submitted",
    "barber_review_action",
    "dispute_opened",
    "dispute_resolved_admin",
    "refund_requested",
    "booking_refunded_admin",
    "escrow_released_admin",
    "review_created_admin",
    "review_moderated_admin",
  ].includes(type);
}

function getAdminActivityTone(item) {
  const type = String(item?.type || "").toLowerCase();
  if (type.includes("dispute") || type.includes("refund")) return "warning";
  if (type.includes("approved") || type.includes("verified") || type.includes("released")) return "success";
  return "neutral";
}

function renderAdminActivityList(notifications) {
  const items = Array.isArray(notifications) ? notifications.filter(isAdminActivityNotification).slice(0, 8) : [];
  if (!items.length) {
    return `<p class="muted">No recent admin activity yet. Approvals, disputes, refunds, and payout events will show here.</p>`;
  }

  return items
    .map(
      (item) => `
        <article class="admin-activity-item admin-activity-${escapeHtml(getAdminActivityTone(item))}">
          <div class="admin-activity-marker" aria-hidden="true"></div>
          <div class="admin-activity-copy">
            <div class="notification-heading-row">
              <strong>${escapeHtml(item.title || "Activity")}</strong>
              <span class="muted notification-time">${escapeHtml(formatDateTime(item.created_at))}</span>
            </div>
            <p class="notification-message">${escapeHtml(item.message || "")}</p>
            <div class="action-row">
              ${item.link ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(item.link)}">Open</a>` : ""}
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function focusDashboardTarget() {
  const params = new URLSearchParams(window.location.search);
  const bookingId = Number(params.get("booking") || 0);
  const disputeId = Number(params.get("dispute") || 0);
  const focus = String(params.get("focus") || "").toLowerCase();

  if (focus === "kyc") {
    return highlightAndScroll(document.getElementById("barberKycPanel"));
  }

  if (disputeId) {
    return (
      highlightAndScroll(document.querySelector(`[data-dispute-card-id="${disputeId}"]`)) ||
      highlightAndScroll(document.getElementById("customerDisputesList")) ||
      highlightAndScroll(document.getElementById("barberDisputesList"))
    );
  }

  if (bookingId) {
    return (
      highlightAndScroll(document.querySelector(`[data-booking-card-id="${bookingId}"]`)) ||
      highlightAndScroll(document.querySelector(`#customerUpcomingCard [data-booking-card-id="${bookingId}"]`)) ||
      highlightAndScroll(document.getElementById("customerRecentActivitySection")) ||
      highlightAndScroll(document.getElementById("barberPending"))
    );
  }

  return false;
}

function focusAdminTarget() {
  const params = new URLSearchParams(window.location.search);
  const barberId = Number(params.get("barber") || 0);
  const disputeId = Number(params.get("dispute") || 0);
  const bookingId = Number(params.get("booking") || 0);
  const focus = String(params.get("focus") || "").toLowerCase();

  if (barberId) {
    return (
      highlightAndScroll(document.querySelector(`[data-admin-barber-card-id="${barberId}"]`)) ||
      highlightAndScroll(document.getElementById("adminApprovedBarbersPanel")) ||
      highlightAndScroll(document.getElementById("adminFlaggedBarbersPanel"))
    );
  }

  if (disputeId || focus === "dispute") {
    return (
      highlightAndScroll(document.querySelector(`[data-admin-dispute-card-id="${disputeId}"]`)) ||
      highlightAndScroll(document.getElementById("adminDisputesList"))
    );
  }

  if (bookingId && focus === "refund") {
    return (
      highlightAndScroll(document.querySelector(`[data-admin-booking-card-id="${bookingId}"]`)) ||
      highlightAndScroll(document.getElementById("adminRefundPanel"))
    );
  }

  if (bookingId) {
    return (
      highlightAndScroll(document.querySelector(`[data-admin-booking-card-id="${bookingId}"]`)) ||
      highlightAndScroll(document.getElementById("adminEscrowPanel")) ||
      highlightAndScroll(document.getElementById("adminRefundPanel"))
    );
  }

  return false;
}

function highlightAndScroll(element) {
  if (!element) return false;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.classList.add("focus-glow");
  window.setTimeout(() => element.classList.remove("focus-glow"), 2400);
  return true;
}

async function hydrateAdminDashboard() {
  const barberQueueEl = document.getElementById("adminBarberQueue");
  const approvedBarbersEl = document.getElementById("adminApprovedBarbers");
  const flaggedBarbersEl = document.getElementById("adminFlaggedBarbers");
  const notificationsEl = document.getElementById("adminNotificationsList");
  const notificationCountEl = document.getElementById("adminNotificationCount");
  const readAllNotificationsBtn = document.getElementById("adminReadAllNotifications");
  const activityEl = document.getElementById("adminActivityList");
  const activityCountEl = document.getElementById("adminActivityCount");
  const disputesEl = document.getElementById("adminDisputesList");
  const escrowEl = document.getElementById("adminEscrowList");
  const refundEl = document.getElementById("adminRefundList");
  const reviewEl = document.getElementById("adminReviewList");
  const reviewCountEl = document.getElementById("adminReviewCount");
  const barberCountEl = document.getElementById("adminBarberCount");
  const approvedBarberCountEl = document.getElementById("adminApprovedBarberCount");
  const flaggedBarberCountEl = document.getElementById("adminFlaggedBarberCount");
  const disputeCountEl = document.getElementById("adminDisputeCount");
  const escrowCountEl = document.getElementById("adminEscrowCount");
  const refundCountEl = document.getElementById("adminRefundCount");
  const totalBarbersStatEl = document.getElementById("adminStatTotalBarbers");
  const verifiedBarbersStatEl = document.getElementById("adminStatVerifiedBarbers");
  const pendingBarbersStatEl = document.getElementById("adminStatPendingBarbers");
  const flaggedBarbersStatEl = document.getElementById("adminStatFlaggedBarbers");
  const openDisputesStatEl = document.getElementById("adminStatOpenDisputes");
  const escrowPendingStatEl = document.getElementById("adminStatEscrowPending");

  if (!barberQueueEl || !approvedBarbersEl || !flaggedBarbersEl || !disputesEl || !escrowEl || !refundEl || !reviewEl) return;

  barberQueueEl.innerHTML = `<div class="loading">Loading barber queue...</div>`;
  approvedBarbersEl.innerHTML = `<div class="loading">Loading approved barbers...</div>`;
  flaggedBarbersEl.innerHTML = `<div class="loading">Loading flagged barbers...</div>`;
  disputesEl.innerHTML = `<div class="loading">Loading disputes...</div>`;
  escrowEl.innerHTML = `<div class="loading">Loading payout queue...</div>`;
  refundEl.innerHTML = `<div class="loading">Loading refund requests...</div>`;
  reviewEl.innerHTML = `<div class="loading">Loading reviews...</div>`;

  try {
    const [barbers, disputes, bookings, reviews] = await Promise.all([
      getAdminBarbers(),
      getMyDisputes(),
      getBookings(),
      getAdminReviews(),
    ]);

    state.adminBarbers = Array.isArray(barbers) ? barbers : [];
    state.disputes = Array.isArray(disputes) ? disputes : [];
    state.barberBookings = Array.isArray(bookings) ? bookings : [];
    state.adminReviews = Array.isArray(reviews?.items) ? reviews.items : [];

    const {
      pendingBarbers,
      approvedBarbers,
      flaggedBarbers,
      filteredAll,
    } = applyAdminBarberFilters(state.adminBarbers);
    const openDisputes = state.disputes.filter((item) =>
      ["open", "investigating"].includes(String(item.status || "").toLowerCase())
    );
    const escrowQueue = state.barberBookings.filter(
      (booking) =>
        String(booking.status || "").toLowerCase() === "paid" &&
        !["refunded", "refund_requested"].includes(String(booking.payout_status || "").toLowerCase())
    );
    const refundQueue = state.barberBookings.filter((booking) => booking.refund_requested);

    barberQueueEl.innerHTML = renderAdminBarberQueue(pendingBarbers, "pending");
    approvedBarbersEl.innerHTML = renderAdminBarberQueue(approvedBarbers, "approved");
    flaggedBarbersEl.innerHTML = renderAdminBarberQueue(flaggedBarbers, "flagged");
    disputesEl.innerHTML = renderAdminDisputeList(openDisputes);
    escrowEl.innerHTML = renderAdminEscrowList(escrowQueue);
    refundEl.innerHTML = renderAdminRefundList(refundQueue);
    reviewEl.innerHTML = renderAdminReviewList(state.adminReviews);

    if (barberCountEl) barberCountEl.textContent = `${pendingBarbers.length} pending`;
    if (approvedBarberCountEl) approvedBarberCountEl.textContent = `${approvedBarbers.length} approved`;
    if (flaggedBarberCountEl) flaggedBarberCountEl.textContent = `${flaggedBarbers.length} flagged`;
    if (disputeCountEl) disputeCountEl.textContent = `${openDisputes.length} open`;
    if (escrowCountEl) escrowCountEl.textContent = `${escrowQueue.length} awaiting completion`;
    if (refundCountEl) refundCountEl.textContent = `${refundQueue.length} requested`;
    if (totalBarbersStatEl) totalBarbersStatEl.textContent = `${state.adminBarbers.length}`;
    if (verifiedBarbersStatEl) verifiedBarbersStatEl.textContent = `${approvedBarbers.length}`;
    if (pendingBarbersStatEl) pendingBarbersStatEl.textContent = `${pendingBarbers.length}`;
    if (flaggedBarbersStatEl) flaggedBarbersStatEl.textContent = `${flaggedBarbers.length}`;
    if (openDisputesStatEl) openDisputesStatEl.textContent = `${openDisputes.length}`;
    if (escrowPendingStatEl) escrowPendingStatEl.textContent = `${escrowQueue.length}`;
    if (reviewCountEl) reviewCountEl.textContent = `${state.adminReviews.length} reviews`;

    bindAdminDashboardActions();
    bindAdminBarberFilters();
    focusAdminTarget();
  } catch (error) {
    const message = `<p class="error">${escapeHtml(error.message)}</p>`;
    barberQueueEl.innerHTML = message;
    approvedBarbersEl.innerHTML = message;
    flaggedBarbersEl.innerHTML = message;
    disputesEl.innerHTML = message;
    escrowEl.innerHTML = message;
    refundEl.innerHTML = message;
    reviewEl.innerHTML = message;
  }

  await hydrateNotificationsPanel({
    listEl: notificationsEl,
    countEl: notificationCountEl,
    readAllBtn: readAllNotificationsBtn,
    emptyText: "No admin alerts yet. KYC, disputes, refunds, and payout items will show here.",
  });

  await hydrateAdminActivityFeed(activityEl, activityCountEl);
}

async function hydrateAdminActivityFeed(listEl, countEl) {
  if (!listEl || !countEl) return;
  listEl.innerHTML = `<div class="loading">Loading activity...</div>`;
  try {
    const response = await getNotifications(20);
    const items = Array.isArray(response?.items) ? response.items.filter(isAdminActivityNotification).slice(0, 8) : [];
    countEl.textContent = `${items.length} events`;
    listEl.innerHTML = renderAdminActivityList(items);
  } catch (error) {
    countEl.textContent = "0 events";
    listEl.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

function renderSettingsSessionList(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return `<p class="muted">No active sessions recorded yet.</p>`;
  }

  return sessions
    .map(
      (session) => `
        <article class="notification-item ${session.revoked_at ? "" : "unread"}">
          <div class="notification-copy">
            <div class="notification-heading-row">
              <strong>${escapeHtml(session.session_type === "admin" ? "Admin Session" : "Web Session")}</strong>
              <div class="notification-pill-row">
                ${session.is_current ? `<span class="pill pill-success">Current</span>` : ""}
                ${session.revoked_at ? `<span class="pill">Revoked</span>` : `<span class="pill">Active</span>`}
              </div>
            </div>
            <p class="notification-message">${escapeHtml(session.user_agent || "Unknown device")}</p>
            <span class="muted notification-time">Last seen ${escapeHtml(formatDateTime(session.last_seen_at))}</span>
          </div>
          <div class="action-row">
            ${
              !session.is_current && !session.revoked_at
                ? `<button class="btn btn-ghost btn-sm" type="button" data-revoke-session-id="${Number(session.id)}">Revoke</button>`
                : ""
            }
          </div>
        </article>
      `
    )
    .join("");
}

function renderSettingsPayoutList(report) {
  const items = Array.isArray(report?.items) ? report.items.slice(0, 6) : [];
  if (!items.length) {
    return `<p class="muted">No payment records yet.</p>`;
  }

  return items
    .map(
      (item) => `
        <article class="booking-item">
          <div>
            <strong>Booking #${Number(item.booking_id)}</strong>
            <p class="muted">${escapeHtml(item.customer_name || item.barber_name || "Trimly booking")}</p>
            <p class="request-service">Amount ${priceText(item.amount)} - Commission ${priceText(item.commission_amount)} - Share ${priceText(item.barber_payout_amount)}</p>
          </div>
          <div class="booking-tags">
            <span class="pill">${escapeHtml(String(item.payment_status || ""))}</span>
            <span class="pill">${escapeHtml(String(item.booking_status || ""))}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderBarberServicesList(services = []) {
  if (!Array.isArray(services) || !services.length) {
    return `<p class="muted">No services added yet. Add your haircut and add-on services so customers can book exactly what they need.</p>`;
  }

  return services
    .map(
      (service) => `
        <article class="service-editor-card" data-service-card-id="${Number(service.id)}">
          <div class="service-editor-head">
            <strong>${escapeHtml(service.name || "Service")}</strong>
            <div class="service-editor-pills">
              ${service.is_home_service ? `<span class="pill pill-chat">Home Service</span>` : ""}
              <span class="pill ${service.is_active ? "pill-success" : ""}">${service.is_active ? "Active" : "Inactive"}</span>
            </div>
          </div>
          <form class="service-editor-form" data-service-edit-form="${Number(service.id)}">
            <div class="form-grid form-grid-2">
              <div>
                <label for="service_name_${Number(service.id)}">Service Name</label>
                <input
                  id="service_name_${Number(service.id)}"
                  name="name"
                  class="input"
                  type="text"
                  maxlength="80"
                  value="${escapeHtml(service.name || "")}"
                  ${service.is_home_service ? "readonly" : ""}
                  required
                />
              </div>
              <div>
                <label for="service_price_${Number(service.id)}">Price (NGN)</label>
                <input
                  id="service_price_${Number(service.id)}"
                  name="price"
                  class="input"
                  type="number"
                  min="0"
                  step="100"
                  value="${Number(service.price || 0)}"
                  required
                />
              </div>
            </div>
            <label class="checkbox-row">
              <input name="is_active" type="checkbox" ${service.is_active ? "checked" : ""} />
              <span>Visible to customers</span>
            </label>
            <div class="service-editor-actions">
              <button class="btn btn-primary" type="submit">Save Service</button>
              <button class="btn btn-ghost" type="button" data-deactivate-service-id="${Number(service.id)}">Deactivate</button>
            </div>
          </form>
        </article>
      `
    )
    .join("");
}

async function refreshBarberSettingsState() {
  if (state.currentRole !== "barber") return;

  try {
    state.barberProfile = await getMyBarberProfile();
  } catch (_error) {
    state.barberProfile = null;
  }

  try {
    state.barberServices = await getBarberServices();
  } catch (_error) {
    state.barberServices = Array.isArray(state.barberProfile?.services) ? state.barberProfile.services : [];
  }

  if (state.barberProfile) {
    state.barberProfile.services = Array.isArray(state.barberServices) ? [...state.barberServices] : [];
  }
}

function rehydrateBarberSettingsEditors() {
  const profileForm = document.getElementById("barberProfileForm");
  if (!profileForm || state.currentRole !== "barber") return;

  hydrateBarberProfileEditor(
    profileForm,
    document.getElementById("barberProfileNotice"),
    document.getElementById("barber_profile_image_file"),
    document.getElementById("barberProfileImagePreview"),
    document.getElementById("barber_cover_image_file"),
    document.getElementById("barberCoverImagePreview"),
    document.getElementById("barberPortfolioList"),
    document.getElementById("barberPortfolioFileInput"),
    document.getElementById("barberPortfolioUrlInput"),
    document.getElementById("addBarberPortfolioUrl"),
    document.getElementById("uploadBarberPortfolioFiles")
  );
}

function hydrateSettingsPanel() {
  const profileForm = document.getElementById("settingsProfileForm");
  const profileNotice = document.getElementById("settingsProfileNotice");
  const preferencesForm = document.getElementById("settingsPreferencesForm");
  const preferencesNotice = document.getElementById("settingsPreferencesNotice");
  const passwordForm = document.getElementById("settingsPasswordForm");
  const passwordNotice = document.getElementById("settingsPasswordNotice");
  const barberShortcuts = document.getElementById("barberSettingsShortcuts");
  const barberBusinessCard = document.getElementById("settingsBarberBusinessCard");
  const barberServicesCard = document.getElementById("settingsBarberServicesCard");
  const barberServiceCountEl = document.getElementById("settingsBarberServiceCount");
  const barberServiceForm = document.getElementById("barberServiceCreateForm");
  const barberServiceNotice = document.getElementById("barberServiceNotice");
  const barberServicesList = document.getElementById("barberServicesList");
  const barberSettingsStatus = document.getElementById("settingsBarberStatus");
  const barberSettingsAvailability = document.getElementById("settingsBarberAvailability");
  const barberSettingsKyc = document.getElementById("settingsBarberKyc");
  const barberSettingsShareProfile = document.getElementById("settingsBarberShareProfile");
  const barberSettingsShareBooking = document.getElementById("settingsBarberShareBooking");
  const barberSettingsShareShell = document.getElementById("settingsBarberShareShell");
  const barberProfileStudioPanel = document.getElementById("barberProfileStudioPanel");
  const profilePreviewLink = document.getElementById("settingsProfilePreviewLink");
  const loyaltyPill = document.getElementById("settingsLoyaltyPointsPill");
  const referralCodeEl = document.getElementById("settingsReferralCode");
  const referralJoinedEl = document.getElementById("settingsReferralJoined");
  const referralRewardedEl = document.getElementById("settingsReferralRewarded");
  const referralShareLink = document.getElementById("settingsReferralShareLink");
  const copyReferralLinkBtn = document.getElementById("copyReferralLinkBtn");
  const sessionsListEl = document.getElementById("settingsSessionsList");
  const sessionsNotice = document.getElementById("settingsSessionsNotice");
  const revokeOtherSessionsBtn = document.getElementById("revokeOtherSessionsBtn");
  const insightAppointmentsEl = document.getElementById("settingsInsightAppointments");
  const insightCompletedEl = document.getElementById("settingsInsightCompleted");
  const insightFavoritesEl = document.getElementById("settingsInsightFavorites");
  const insightLoyaltyEl = document.getElementById("settingsInsightLoyalty");
  const barberAnalyticsCard = document.getElementById("settingsBarberAnalyticsCard");
  const barberTotalBookingsEl = document.getElementById("settingsBarberTotalBookings");
  const barberCompletedJobsEl = document.getElementById("settingsBarberCompletedJobs");
  const barberPendingRequestsEl = document.getElementById("settingsBarberPendingRequests");
  const barberAverageRatingEl = document.getElementById("settingsBarberAverageRating");
  const payoutCard = document.getElementById("settingsPayoutReportCard");
  const payoutSummaryEl = document.getElementById("settingsPayoutSummary");
  const payoutListEl = document.getElementById("settingsPayoutList");

  if (barberShortcuts) {
    barberShortcuts.classList.toggle("hidden", state.currentRole !== "barber");
  }
  if (barberBusinessCard) {
    barberBusinessCard.classList.toggle("hidden", state.currentRole !== "barber");
  }
  if (barberServicesCard) {
    barberServicesCard.classList.toggle("hidden", state.currentRole !== "barber");
  }
  if (barberProfileStudioPanel) {
    barberProfileStudioPanel.classList.toggle("hidden", state.currentRole !== "barber");
  }
  if (barberAnalyticsCard) {
    barberAnalyticsCard.classList.toggle("hidden", state.currentRole !== "barber");
  }
  if (payoutCard) {
    payoutCard.classList.toggle("hidden", !["barber", "admin", "super_admin"].includes(state.currentRole));
  }

  if (state.currentRole === "barber" && state.barberProfile) {
    const profile = state.barberProfile;
    if (barberSettingsStatus) {
      barberSettingsStatus.textContent = profile.is_available ? "Online and accepting bookings" : "Offline";
    }
    if (barberSettingsAvailability) {
      const days = Array.isArray(profile.available_days) ? profile.available_days.map(capitalize).join(", ") : "";
      const start = normalizeTimeForInput(profile.available_start_time) || "--:--";
      const end = normalizeTimeForInput(profile.available_end_time) || "--:--";
      barberSettingsAvailability.textContent = days ? `${days} - ${start} - ${end}` : "Availability not set yet";
    }
    if (barberSettingsKyc) {
      barberSettingsKyc.textContent = capitalize(profile.kyc_status || "pending");
      barberSettingsKyc.className = `status-badge status-${String(profile.kyc_status || "pending").toLowerCase()}`;
    }
    if (barberSettingsShareShell && barberSettingsShareProfile && barberSettingsShareBooking) {
      const profileUrl = `${window.location.origin}/static/barber-profile.html?id=${Number(profile.id)}`;
      const bookingUrl = `${window.location.origin}/static/booking.html?barber=${Number(profile.id)}`;
      barberSettingsShareProfile.value = profileUrl;
      barberSettingsShareBooking.value = bookingUrl;
      const copyButtons = barberSettingsShareShell.querySelectorAll("[data-copy-link]");
      if (copyButtons[0]) copyButtons[0].dataset.copyLink = profileUrl;
      if (copyButtons[1]) copyButtons[1].dataset.copyLink = bookingUrl;
      bindCopyLinkButtons(barberSettingsShareShell);
    }
    if (profilePreviewLink) {
      profilePreviewLink.href = `/static/barber-profile.html?id=${Number(profile.id)}`;
    }
  }

  if (state.currentRole === "barber") {
    const services = Array.isArray(state.barberServices)
      ? state.barberServices
      : Array.isArray(state.barberProfile?.services)
        ? state.barberProfile.services
        : [];
    const activeCount = services.filter((service) => service && service.is_active).length;

    if (barberServiceCountEl) {
      barberServiceCountEl.textContent = `${activeCount} active`;
    }

    if (barberServicesList) {
      barberServicesList.innerHTML = renderBarberServicesList(services);

      barberServicesList.querySelectorAll("[data-service-edit-form]").forEach((form) => {
        if (form.dataset.bound === "true") return;
        form.dataset.bound = "true";
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const serviceId = Number(form.dataset.serviceEditForm || 0);
          if (!serviceId) return;

          const submitBtn = form.querySelector("button[type='submit']");
          submitBtn.disabled = true;
          try {
            await updateBarberService(serviceId, {
              name: String(form.elements.name.value || "").trim(),
              price: Number(form.elements.price.value || 0),
              is_active: Boolean(form.elements.is_active.checked),
            });
            await refreshBarberSettingsState();
            hydrateSettingsPanel();
            rehydrateBarberSettingsEditors();
            if (barberServiceNotice) {
              barberServiceNotice.textContent = "Service updated successfully.";
              barberServiceNotice.className = "notice success";
            }
          } catch (error) {
            if (barberServiceNotice) {
              barberServiceNotice.textContent = error.message;
              barberServiceNotice.className = "notice error";
            }
          } finally {
            submitBtn.disabled = false;
          }
        });
      });

      barberServicesList.querySelectorAll("[data-deactivate-service-id]").forEach((button) => {
        if (button.dataset.bound === "true") return;
        button.dataset.bound = "true";
        button.addEventListener("click", async () => {
          const serviceId = Number(button.dataset.deactivateServiceId || 0);
          if (!serviceId) return;
          button.disabled = true;
          try {
            await deactivateBarberService(serviceId);
            await refreshBarberSettingsState();
            hydrateSettingsPanel();
            rehydrateBarberSettingsEditors();
            if (barberServiceNotice) {
              barberServiceNotice.textContent = "Service removed from customer view.";
              barberServiceNotice.className = "notice success";
            }
          } catch (error) {
            if (barberServiceNotice) {
              barberServiceNotice.textContent = error.message;
              barberServiceNotice.className = "notice error";
            }
            button.disabled = false;
          }
        });
      });
    }
  }

  if (barberServiceForm && state.currentRole === "barber" && barberServiceForm.dataset.bound !== "true") {
    barberServiceForm.dataset.bound = "true";
    barberServiceForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitBtn = barberServiceForm.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      if (barberServiceNotice) {
        barberServiceNotice.textContent = "";
        barberServiceNotice.className = "notice";
      }

      try {
        await createBarberService({
          name: String(barberServiceForm.elements.name.value || "").trim(),
          price: Number(barberServiceForm.elements.price.value || 0),
          is_home_service: Boolean(barberServiceForm.elements.is_home_service.checked),
          is_active: true,
        });
        barberServiceForm.reset();
        await refreshBarberSettingsState();
        hydrateSettingsPanel();
        rehydrateBarberSettingsEditors();
        if (barberServiceNotice) {
          barberServiceNotice.textContent = "Service added successfully.";
          barberServiceNotice.className = "notice success";
        }
      } catch (error) {
        if (barberServiceNotice) {
          barberServiceNotice.textContent = error.message;
          barberServiceNotice.className = "notice error";
        }
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  Promise.all([
    getReferralSummary().catch(() => null),
    getMySessions().catch(() => null),
    state.currentRole === "customer" ? getCustomerInsights().catch(() => null) : Promise.resolve(null),
    state.currentRole === "barber" ? getBarberInsights().catch(() => null) : Promise.resolve(null),
    state.currentRole === "barber"
      ? getBarberPayoutReport().catch(() => null)
      : ["admin", "super_admin"].includes(state.currentRole)
        ? getAdminPayoutReport().catch(() => null)
        : Promise.resolve(null),
  ]).then(([referralSummary, sessionResponse, customerInsights, barberInsights, payoutReport]) => {
    const referralCode = referralSummary?.referral_code || state.currentUser?.referral_code || "";
    if (loyaltyPill) loyaltyPill.textContent = `${Number(referralSummary?.loyalty_points ?? state.currentUser?.loyalty_points ?? 0)} pts`;
    if (referralCodeEl) referralCodeEl.textContent = referralCode || "Not ready";
    if (referralJoinedEl) referralJoinedEl.textContent = String(Number(referralSummary?.referrals_joined || 0));
    if (referralRewardedEl) referralRewardedEl.textContent = String(Number(referralSummary?.referrals_rewarded || 0));
    if (referralShareLink) {
      referralShareLink.value = referralCode
        ? `${window.location.origin}/static/register.html?ref=${encodeURIComponent(referralCode)}`
        : "";
    }
    if (copyReferralLinkBtn && referralShareLink?.value) {
      copyReferralLinkBtn.dataset.copyLink = referralShareLink.value;
      bindCopyLinkButtons(copyReferralLinkBtn.parentElement || document);
    }

    if (sessionsListEl) {
      sessionsListEl.innerHTML = renderSettingsSessionList(sessionResponse?.items || []);
      sessionsListEl.querySelectorAll("[data-revoke-session-id]").forEach((button) => {
        if (button.dataset.bound === "true") return;
        button.dataset.bound = "true";
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            await revokeSession(Number(button.dataset.revokeSessionId || 0));
            sessionsNotice.textContent = "Session revoked successfully.";
            sessionsNotice.className = "notice success";
            hydrateSettingsPanel();
          } catch (error) {
            sessionsNotice.textContent = error.message;
            sessionsNotice.className = "notice error";
            button.disabled = false;
          }
        });
      });
    }

    if (revokeOtherSessionsBtn && revokeOtherSessionsBtn.dataset.bound !== "true") {
      revokeOtherSessionsBtn.dataset.bound = "true";
      revokeOtherSessionsBtn.addEventListener("click", async () => {
        revokeOtherSessionsBtn.disabled = true;
        try {
          await revokeOtherSessions();
          sessionsNotice.textContent = "Other devices signed out.";
          sessionsNotice.className = "notice success";
          hydrateSettingsPanel();
        } catch (error) {
          sessionsNotice.textContent = error.message;
          sessionsNotice.className = "notice error";
        } finally {
          revokeOtherSessionsBtn.disabled = false;
        }
      });
    }

    if (insightAppointmentsEl) insightAppointmentsEl.textContent = String(Number(customerInsights?.total_appointments || 0));
    if (insightCompletedEl) insightCompletedEl.textContent = String(Number(customerInsights?.completed_haircuts || 0));
    if (insightFavoritesEl) insightFavoritesEl.textContent = String(Number(customerInsights?.favorite_barbers || 0));
    if (insightLoyaltyEl) insightLoyaltyEl.textContent = String(Number(customerInsights?.loyalty_points ?? state.currentUser?.loyalty_points ?? 0));

    if (barberTotalBookingsEl) barberTotalBookingsEl.textContent = String(Number(barberInsights?.total_bookings || 0));
    if (barberCompletedJobsEl) barberCompletedJobsEl.textContent = String(Number(barberInsights?.completed_jobs || 0));
    if (barberPendingRequestsEl) barberPendingRequestsEl.textContent = String(Number(barberInsights?.pending_requests || 0));
    if (barberAverageRatingEl) barberAverageRatingEl.textContent = Number(barberInsights?.average_rating || 0).toFixed(1);

    if (payoutSummaryEl) payoutSummaryEl.textContent = priceText(payoutReport?.total_barber_payout || 0);
    if (payoutListEl) payoutListEl.innerHTML = renderSettingsPayoutList(payoutReport);
  });

  if (profileForm && state.currentUser) {
    profileForm.elements.full_name.value = state.currentUser.full_name || "";
    profileForm.elements.email.value = state.currentUser.logged_in_as || state.currentEmail || "";
    profileForm.elements.phone.value = state.currentUser.phone || "";

    if (profileForm.dataset.bound !== "true") {
      profileForm.dataset.bound = "true";
      profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitBtn = profileForm.querySelector("button[type='submit']");
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";
        profileNotice.textContent = "";

        try {
          const payload = {
            full_name: String(profileForm.elements.full_name.value || "").trim(),
            phone: String(profileForm.elements.phone.value || "").trim() || null,
          };
          const updated = await updateCurrentUserProfile(payload);
          state.currentUser = updated;
          state.currentEmail = updated.logged_in_as || state.currentEmail;
          localStorage.setItem("trimly_email", state.currentEmail);
          const greetingEl = document.getElementById("customerGreeting");
          const dashboardEmail = document.getElementById("dashboardEmail");
          if (dashboardEmail) dashboardEmail.textContent = state.currentEmail;
          if (greetingEl && state.currentRole !== "barber") {
            greetingEl.textContent = `Welcome back, ${updated.full_name}. Ready for your next cut?`;
          }
          profileNotice.textContent = "Profile updated successfully.";
          profileNotice.className = "notice success";
          toast("Profile updated");
        } catch (error) {
          profileNotice.textContent = error.message;
          profileNotice.className = "notice error";
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Save Profile";
        }
      });
    }
  }

  if (preferencesForm) {
    preferencesForm.elements.language.value = getLanguagePreference();
    preferencesForm.elements.time_format.value = getTimeFormatPreference();

    if (preferencesForm.dataset.bound !== "true") {
      preferencesForm.dataset.bound = "true";
      preferencesForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        localStorage.setItem(LANGUAGE_PREF_KEY, String(preferencesForm.elements.language.value || "en"));
        localStorage.setItem(TIME_FORMAT_PREF_KEY, String(preferencesForm.elements.time_format.value || "12h"));
        preferencesNotice.textContent =
          "Preferences saved. Time format updates immediately. Language selection is saved while full translations are rolling out.";
        preferencesNotice.className = "notice success";
        await refreshDashboardByRole();
      });
    }
  }

  if (passwordForm) {
    passwordForm.reset();
    if (passwordForm.dataset.bound !== "true") {
      passwordForm.dataset.bound = "true";
      passwordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitBtn = passwordForm.querySelector("button[type='submit']");
        submitBtn.disabled = true;
        submitBtn.textContent = "Updating...";
        passwordNotice.textContent = "";

        try {
          const currentPassword = String(passwordForm.elements.current_password.value || "");
          const newPassword = String(passwordForm.elements.new_password.value || "");
          const confirmPassword = String(passwordForm.elements.confirm_password.value || "");
          if (newPassword !== confirmPassword) {
            throw new Error("New password and confirmation do not match");
          }
          const response = await changeCurrentUserPassword({
            current_password: currentPassword,
            new_password: newPassword,
          });
          passwordNotice.textContent = response.message || "Password updated successfully.";
          passwordNotice.className = "notice success";
          passwordForm.reset();
          toast("Password updated");
        } catch (error) {
          passwordNotice.textContent = error.message;
          passwordNotice.className = "notice error";
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Change Password";
        }
      });
    }
  }
}

function hydrateBarberNotificationPreferences(soundToggle, highlightToggle) {
  const prefs = getBarberNotificationPreferences();
  if (soundToggle) {
    soundToggle.checked = prefs.soundEnabled;
    if (soundToggle.dataset.bound !== "true") {
      soundToggle.dataset.bound = "true";
      soundToggle.addEventListener("change", () => {
        setBarberNotificationPreference(BARBER_SOUND_PREF_KEY, soundToggle.checked);
        toast(soundToggle.checked ? "Urgent request sound enabled" : "Urgent request sound muted");
      });
    }
  }

  if (highlightToggle) {
    highlightToggle.checked = prefs.highlightEnabled;
    if (highlightToggle.dataset.bound !== "true") {
      highlightToggle.dataset.bound = "true";
      highlightToggle.addEventListener("change", async () => {
        setBarberNotificationPreference(BARBER_HIGHLIGHT_PREF_KEY, highlightToggle.checked);
        await hydrateHeaderNotifications(document);
        await hydrateBarberAlertPanels({
          pendingEl: document.getElementById("barberPending"),
          notificationsEl: document.getElementById("barberNotificationsList"),
          notificationCountEl: document.getElementById("barberNotificationCount"),
          readAllNotificationsBtn: document.getElementById("barberReadAllNotifications"),
          silent: true,
        });
        toast(highlightToggle.checked ? "Urgent request highlight enabled" : "Urgent request highlight disabled");
      });
    }
  }
}

function hydrateBarberProfileEditor(
  form,
  notice,
  profileImageFileInput,
  profileImagePreview,
  coverImageFileInput,
  coverImagePreview,
  portfolioList,
  portfolioFileInput,
  portfolioUrlInput,
  addPortfolioBtn,
  uploadPortfolioBtn
) {
  if (
    !form ||
    !notice ||
    !portfolioList ||
    !portfolioUrlInput ||
    !addPortfolioBtn ||
    !uploadPortfolioBtn ||
    !state.barberProfile
  ) {
    return;
  }

  const profile = state.barberProfile;
  state.barberPortfolioDraft = Array.isArray(profile.portfolio_image_urls)
    ? [...profile.portfolio_image_urls]
    : [];

  form.elements.barber_name.value = profile.barber_name || "";
  form.elements.shop_name.value = profile.shop_name || "";
  form.elements.location.value = profile.location || "";
  form.elements.profile_image_url.value = profile.profile_image_url || "";
  if (form.elements.cover_image_url) {
    form.elements.cover_image_url.value = profile.cover_image_url || "";
  }
  form.elements.haircut_price.value = Number(profile.haircut_price || 0);
  form.elements.beard_trim_price.value =
    profile.beard_trim_price === null || profile.beard_trim_price === undefined ? "" : Number(profile.beard_trim_price);
  form.elements.other_services.value = profile.other_services || "";
  form.elements.bio.value = profile.bio || "";

  renderBarberProfileImagePreview(profileImagePreview, form.elements.profile_image_url.value);
  renderBarberProfileImagePreview(coverImagePreview, form.elements.cover_image_url?.value || "");
  renderBarberPortfolioDraft(portfolioList, form.elements.cover_image_url?.value || "");

  if (profileImageFileInput && profileImageFileInput.dataset.bound !== "true") {
    profileImageFileInput.dataset.bound = "true";
    profileImageFileInput.addEventListener("change", async () => {
      const file = profileImageFileInput.files?.[0];
      if (!file) return;
      profileImageFileInput.disabled = true;
      notice.textContent = "Uploading profile image...";
      notice.className = "notice";
      try {
        const response = await uploadBarberImage(file);
        const imageUrl = String(response?.url || "").trim();
        if (!imageUrl) throw new Error("Image upload failed");
        form.elements.profile_image_url.value = imageUrl;
        renderBarberProfileImagePreview(profileImagePreview, imageUrl);
        notice.textContent = "Profile image uploaded. Save your profile to publish it.";
        notice.className = "notice success";
      } catch (error) {
        notice.textContent = error.message;
        notice.className = "notice error";
      } finally {
        profileImageFileInput.disabled = false;
        profileImageFileInput.value = "";
      }
    });
  }

  if (coverImageFileInput && coverImageFileInput.dataset.bound !== "true") {
    coverImageFileInput.dataset.bound = "true";
    coverImageFileInput.addEventListener("change", async () => {
      const file = coverImageFileInput.files?.[0];
      if (!file) return;
      coverImageFileInput.disabled = true;
      notice.textContent = "Uploading cover image...";
      notice.className = "notice";
      try {
        const response = await uploadBarberImage(file);
        const imageUrl = String(response?.url || "").trim();
        if (!imageUrl) throw new Error("Cover image upload failed");
        form.elements.cover_image_url.value = imageUrl;
        renderBarberProfileImagePreview(coverImagePreview, imageUrl);
        renderBarberPortfolioDraft(portfolioList, imageUrl);
        notice.textContent = "Cover image uploaded. Save your profile to publish it.";
        notice.className = "notice success";
      } catch (error) {
        notice.textContent = error.message;
        notice.className = "notice error";
      } finally {
        coverImageFileInput.disabled = false;
        coverImageFileInput.value = "";
      }
    });
  }

  if (addPortfolioBtn.dataset.bound !== "true") {
    addPortfolioBtn.dataset.bound = "true";
    addPortfolioBtn.addEventListener("click", () => {
      const value = String(portfolioUrlInput.value || "").trim();
      if (!value) return;
      if (state.barberPortfolioDraft.includes(value)) {
        toast("That portfolio photo is already added", true);
        return;
      }
      state.barberPortfolioDraft.push(value);
      portfolioUrlInput.value = "";
      renderBarberPortfolioDraft(portfolioList, form.elements.cover_image_url?.value || "");
    });
  }

  if (portfolioFileInput && uploadPortfolioBtn.dataset.bound !== "true") {
    uploadPortfolioBtn.dataset.bound = "true";
    uploadPortfolioBtn.addEventListener("click", async () => {
      const files = Array.from(portfolioFileInput.files || []);
      if (!files.length) {
        toast("Choose one or more photos first", true);
        return;
      }

      uploadPortfolioBtn.disabled = true;
      notice.textContent = "Uploading portfolio photos...";
      notice.className = "notice";
      try {
        const uploads = await Promise.all(files.map((file) => uploadBarberImage(file)));
        const urls = uploads
          .map((item) => String(item?.url || "").trim())
          .filter(Boolean)
          .filter((url) => !state.barberPortfolioDraft.includes(url));
        state.barberPortfolioDraft.push(...urls);
        renderBarberPortfolioDraft(portfolioList, form.elements.cover_image_url?.value || "");
        notice.textContent = "Portfolio photos uploaded. Save your profile to publish them.";
        notice.className = "notice success";
      } catch (error) {
        notice.textContent = error.message;
        notice.className = "notice error";
      } finally {
        uploadPortfolioBtn.disabled = false;
        portfolioFileInput.value = "";
      }
    });
  }

  if (portfolioList.dataset.bound !== "true") {
    portfolioList.dataset.bound = "true";
    portfolioList.addEventListener("click", (event) => {
      const removeTarget = event.target.closest("[data-remove-portfolio-index]");
      const moveTarget = event.target.closest("[data-move-portfolio-index]");
      const coverTarget = event.target.closest("[data-cover-portfolio-index]");
      if (removeTarget) {
        const index = Number(removeTarget.dataset.removePortfolioIndex || -1);
        if (index < 0) return;
        const removedUrl = state.barberPortfolioDraft.splice(index, 1)[0];
        if (form.elements.cover_image_url?.value === removedUrl) {
          form.elements.cover_image_url.value = state.barberPortfolioDraft[0] || "";
          renderBarberProfileImagePreview(coverImagePreview, form.elements.cover_image_url.value);
        }
        renderBarberPortfolioDraft(portfolioList, form.elements.cover_image_url?.value || "");
        return;
      }
      if (moveTarget) {
        const index = Number(moveTarget.dataset.movePortfolioIndex || -1);
        const direction = String(moveTarget.dataset.movePortfolioDirection || "");
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (index < 0 || targetIndex < 0 || targetIndex >= state.barberPortfolioDraft.length) return;
        [state.barberPortfolioDraft[index], state.barberPortfolioDraft[targetIndex]] = [
          state.barberPortfolioDraft[targetIndex],
          state.barberPortfolioDraft[index],
        ];
        renderBarberPortfolioDraft(portfolioList, form.elements.cover_image_url?.value || "");
        return;
      }
      if (coverTarget) {
        const index = Number(coverTarget.dataset.coverPortfolioIndex || -1);
        const coverUrl = state.barberPortfolioDraft[index];
        if (!coverUrl) return;
        form.elements.cover_image_url.value = coverUrl;
        renderBarberProfileImagePreview(coverImagePreview, coverUrl);
        renderBarberPortfolioDraft(portfolioList, coverUrl);
      }
    });
  }

  if (form.dataset.bound !== "true") {
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";
      notice.textContent = "";

      try {
        const payload = {
          barber_name: String(form.elements.barber_name.value || "").trim() || null,
          shop_name: String(form.elements.shop_name.value || "").trim(),
          location: String(form.elements.location.value || "").trim(),
          profile_image_url: String(form.elements.profile_image_url.value || "").trim() || null,
          cover_image_url: String(form.elements.cover_image_url?.value || "").trim() || null,
          haircut_price: Number(form.elements.haircut_price.value || 0),
          beard_trim_price: form.elements.beard_trim_price.value === "" ? null : Number(form.elements.beard_trim_price.value),
          other_services: String(form.elements.other_services.value || "").trim() || null,
          bio: String(form.elements.bio.value || "").trim() || null,
          portfolio_image_urls: [...state.barberPortfolioDraft],
        };

        if (!payload.shop_name || !payload.location || !payload.haircut_price) {
          throw new Error("Shop name, location, and haircut price are required");
        }

        state.barberProfile = await updateBarberProfile(payload);
        state.barberPortfolioDraft = Array.isArray(state.barberProfile.portfolio_image_urls)
          ? [...state.barberProfile.portfolio_image_urls]
          : [];
        renderBarberProfileImagePreview(profileImagePreview, state.barberProfile.profile_image_url);
        renderBarberProfileImagePreview(coverImagePreview, state.barberProfile.cover_image_url);
        renderBarberPortfolioDraft(portfolioList, state.barberProfile.cover_image_url);
        notice.textContent = "Barber profile updated successfully.";
        notice.className = "notice success";
        toast("Profile updated");
      } catch (error) {
        notice.textContent = error.message;
        notice.className = "notice error";
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Profile Changes";
      }
    });
  }
}

function hydrateBarberSharePanel(panel, profileInput, bookingInput) {
  if (!panel || !profileInput || !bookingInput || !state.barberProfile?.id) return;

  const profileUrl = `${window.location.origin}/static/barber-profile.html?id=${Number(state.barberProfile.id)}`;
  const bookingUrl = `${window.location.origin}/static/booking.html?barber=${Number(state.barberProfile.id)}`;

  profileInput.value = profileUrl;
  bookingInput.value = bookingUrl;
  const copyButtons = panel.querySelectorAll("[data-copy-link]");
  if (copyButtons[0]) copyButtons[0].dataset.copyLink = profileUrl;
  if (copyButtons[1]) copyButtons[1].dataset.copyLink = bookingUrl;
  bindCopyLinkButtons(panel);
}

function bindCopyLinkButtons(scope = document) {
  scope.querySelectorAll("[data-copy-link]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const value = String(button.dataset.copyLink || "").trim();
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        toast("Link copied");
      } catch (_error) {
        toast("Could not copy link. You can copy it manually.", true);
      }
    });
  });
}

function renderBarberProfileImagePreview(container, imageUrl) {
  if (!container) return;
  const source = resolveMediaSource(imageUrl);
  if (!source) {
    const label = String(imageUrl || "").trim();
    container.innerHTML = label
      ? `<p class="muted">This image entry is not usable yet. Please upload the profile image again so customers can see it.</p>`
      : `<p class="muted">No profile image uploaded yet. Add one so customers can recognize your work instantly.</p>`;
    return;
  }

  container.innerHTML = `
    <img src="${escapeHtml(source)}" alt="Profile preview" />
    <span class="muted">This image is ready for customers to see on your public Trimly page.</span>
  `;
}

function renderBarberPortfolioDraft(container, coverImageUrl = "") {
  if (!container) return;
  if (!Array.isArray(state.barberPortfolioDraft) || state.barberPortfolioDraft.length === 0) {
    container.innerHTML = `<p class="muted">No portfolio photos added yet. Upload haircut photos so customers can see your work.</p>`;
    return;
  }

  container.innerHTML = state.barberPortfolioDraft
    .map(
      (url, index) => {
        const source = resolveMediaSource(url);
        return `
        <article class="portfolio-chip-card">
          ${
            source
              ? `<img class="portfolio-chip-image" src="${escapeHtml(source)}" alt="Portfolio preview ${index + 1}" />`
              : `<div class="portfolio-chip-image portfolio-chip-image--invalid"><span>Needs re-upload</span></div>`
          }
          <div class="portfolio-chip-copy">
            ${
              source
                ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Open photo</a>`
                : `<p class="muted">${escapeHtml(String(url || "").trim() || "Unknown image entry")}</p>`
            }
          </div>
          <div class="portfolio-chip-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-cover-portfolio-index="${index}">
              ${String(coverImageUrl || "") === String(url || "") ? "Cover Image" : "Make Cover"}
            </button>
            <button class="btn btn-ghost btn-sm" type="button" data-move-portfolio-index="${index}" data-move-portfolio-direction="up">Move Up</button>
            <button class="btn btn-ghost btn-sm" type="button" data-move-portfolio-index="${index}" data-move-portfolio-direction="down">Move Down</button>
            <button class="btn btn-ghost btn-sm" type="button" data-remove-portfolio-index="${index}">Remove</button>
          </div>
        </article>
      `;
      }
    )
    .join("");
}

async function hydrateBarberAlertPanels({
  pendingEl,
  notificationsEl,
  notificationCountEl,
  readAllNotificationsBtn,
  silent = false,
} = {}) {
  if (!pendingEl || !notificationsEl || !notificationCountEl || !readAllNotificationsBtn) return;

  try {
    const [bookings, notificationResponse] = await Promise.all([
      getBookings(),
      getNotifications(8),
    ]);

    state.barberBookings = Array.isArray(bookings) ? bookings : state.barberBookings;
    const pending = state.barberBookings.filter((booking) => String(booking.status) === "pending");
    pendingEl.innerHTML = renderBarberRequestList(pending);
    pendingEl.querySelectorAll("[data-booking-action]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        const bookingId = button.dataset.bookingId;
        const status = button.dataset.bookingAction;
        if (!bookingId || !status) return;

        button.disabled = true;
        try {
          await updateBookingStatus(Number(bookingId), status);
          toast(`Booking ${status}`);
          await hydrateBarberDashboard();
          renderBarberCalendar();
        } catch (error) {
          toast(error.message, true);
        } finally {
          button.disabled = false;
        }
      });
    });

    const items = Array.isArray(notificationResponse?.items) ? notificationResponse.items : [];
    const unreadCount = Number(notificationResponse?.unread_count || 0);
    state.notifications = items;
    notificationsEl.innerHTML = renderNotificationsList(
      items,
      "No alerts yet. New booking requests and payment updates will appear here."
    );
    notificationCountEl.textContent = `${unreadCount} unread`;
    readAllNotificationsBtn.disabled = unreadCount === 0;
    bindNotificationActions(notificationsEl, async () =>
      hydrateBarberAlertPanels({ pendingEl, notificationsEl, notificationCountEl, readAllNotificationsBtn, silent: true })
    );

    const urgentUnreadIds = new Set(
      items
        .filter((item) => isUrgentNotification(item) && !item.is_read)
        .map((item) => Number(item.id))
        .filter(Boolean)
    );
    if (!silent && shouldPlayBarberNotificationSound() && state.barberUrgentUnreadIds instanceof Set) {
      const hasNewUrgent = Array.from(urgentUnreadIds).some((id) => !state.barberUrgentUnreadIds.has(id));
      if (hasNewUrgent) {
        playNotificationChime();
      }
    }
    state.barberUrgentUnreadIds = urgentUnreadIds;
    await hydrateHeaderNotifications(document);
  } catch (_error) {
    // Keep manual dashboard load as source of truth if lightweight alert refresh fails.
  }
}

function ensureBarberAlertPolling(context) {
  if (state.barberAlertPollInterval) return;
  state.barberAlertPollInterval = window.setInterval(() => {
    if (document.hidden || document.body.dataset.page !== "dashboard" || state.currentRole !== "barber") return;
    hydrateBarberAlertPanels({ ...context, silent: false });
  }, 20000);
}

function stopBarberAlertPolling() {
  if (state.barberAlertPollInterval) {
    window.clearInterval(state.barberAlertPollInterval);
    state.barberAlertPollInterval = null;
  }
  state.barberUrgentUnreadIds = null;
}

function getBarberNotificationPreferences() {
  return {
    soundEnabled: localStorage.getItem(BARBER_SOUND_PREF_KEY) !== "false",
    highlightEnabled: localStorage.getItem(BARBER_HIGHLIGHT_PREF_KEY) !== "false",
  };
}

function setBarberNotificationPreference(key, value) {
  localStorage.setItem(key, value ? "true" : "false");
}

function getLanguagePreference() {
  return localStorage.getItem(LANGUAGE_PREF_KEY) || "en";
}

function getTimeFormatPreference() {
  return localStorage.getItem(TIME_FORMAT_PREF_KEY) || "12h";
}

function shouldHighlightUrgentRequests() {
  if (normalizeRole(state.currentRole || localStorage.getItem("trimly_role") || "") !== "barber") {
    return true;
  }
  return getBarberNotificationPreferences().highlightEnabled;
}

function shouldPlayBarberNotificationSound() {
  return normalizeRole(state.currentRole || localStorage.getItem("trimly_role") || "") === "barber" &&
    getBarberNotificationPreferences().soundEnabled;
}

function playNotificationChime() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const audioContext = new AudioContextCtor();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(988, audioContext.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.28);
    oscillator.addEventListener("ended", () => {
      audioContext.close().catch(() => {});
    });
  } catch (_error) {
    // Ignore unsupported autoplay/audio context failures.
  }
}

async function hydrateSuperAdminUsers() {
  const form = document.getElementById("createAdminUserForm");
  const notice = document.getElementById("createAdminUserNotice");
  const list = document.getElementById("adminUsersList");
  const count = document.getElementById("adminUserCount");
  if (!form || !notice || !list || !count) return;

  try {
    const users = await getAdminUsers();
    count.textContent = `${Array.isArray(users) ? users.length : 0} accounts`;
    list.innerHTML = renderAdminUsersList(users);
    bindSuperAdminActions();
  } catch (error) {
    list.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }

  if (form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating...";
    notice.textContent = "";

    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      await createAdminUser(payload);
      notice.textContent = "Admin-class user created. Super admin approval is still required before login.";
      notice.className = "notice success";
      form.reset();
      await hydrateSuperAdminUsers();
    } catch (error) {
      notice.textContent = error.message;
      notice.className = "notice error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Admin Account";
    }
  });
}

function hydrateBarberKycPanel(badge, summary, form, notice) {
  if (!badge || !summary || !form || !notice) return;

  const status = String(state.barberProfile?.kyc_status || "pending").toLowerCase();
  badge.textContent = capitalize(status);
  badge.className = `status-badge status-${status}`;

  if (state.barberKyc) {
    populateKycForm(form, state.barberKyc);
  }

  summary.innerHTML = `
    <div class="compliance-summary">
      <p><strong>Status:</strong> ${escapeHtml(capitalize(status))}</p>
      <p><strong>Submitted:</strong> ${escapeHtml(state.barberProfile?.kyc_submitted_at ? formatDateTime(state.barberProfile.kyc_submitted_at) : "Not yet")}</p>
      <p><strong>Verification:</strong> ${
        status === "verified"
          ? "You can approve bookings and receive payments."
          : status === "rejected"
            ? escapeHtml(state.barberProfile?.rejection_reason || "Your KYC was rejected. Update the form and resubmit.")
            : "Awaiting admin review before you can approve bookings or appear in search."
      }</p>
    </div>
  `;

  form.classList.toggle("hidden", status === "verified");
  if (form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    notice.textContent = "";

    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      state.barberKyc = await submitBarberKyc(payload);
      state.barberProfile = {
        ...(state.barberProfile || {}),
        kyc_status: "pending",
        kyc_submitted_at: new Date().toISOString(),
        rejection_reason: null,
      };
      hydrateBarberKycPanel(badge, summary, form, notice);
      notice.textContent = "KYC submitted successfully. It is now pending admin review.";
      notice.className = "notice success";
    } catch (error) {
      notice.textContent = error.message;
      notice.className = "notice error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit KYC";
    }
  });
}

function bindBarberStatusToggle() {
  const toggle = document.getElementById("barberStatusToggle");
  const label = document.getElementById("barberStatusLabel");
  const notice = document.getElementById("barberStatusNotice");
  if (!toggle || !label || !notice) return;

  const isOnline = Boolean(state.barberProfile?.is_available);
  setBarberStatusUi(toggle, label, isOnline);

  if (toggle.dataset.bound === "true") return;
  toggle.dataset.bound = "true";

  toggle.addEventListener("change", async () => {
    const nextValue = Boolean(toggle.checked);
    toggle.disabled = true;

    try {
      const updatedProfile = await updateBarberStatus(nextValue);
      state.barberProfile = updatedProfile;
      setBarberStatusUi(toggle, label, Boolean(updatedProfile.is_available));
      notice.textContent = nextValue
        ? "You are now online and visible in search results."
        : "You are offline. Customers cannot book you right now.";
      notice.className = "notice success";
      toast(nextValue ? "Status updated: Online" : "Status updated: Offline");
    } catch (error) {
      toggle.checked = !nextValue;
      notice.textContent = error.message;
      notice.className = "notice error";
      toast(error.message, true);
    } finally {
      toggle.disabled = false;
    }
  });
}

function setBarberStatusUi(toggle, label, isOnline) {
  toggle.checked = isOnline;
  label.textContent = isOnline ? "Online (Accepting bookings)" : "Offline (Not accepting bookings)";
}

function bindAvailabilitySettings() {
  const form = document.getElementById("availabilityForm");
  const notice = document.getElementById("availabilityNotice");
  if (!form || !notice) return;

  const startInput = form.querySelector("#start");
  const endInput = form.querySelector("#end");
  const dayCheckboxes = form.querySelectorAll("#availabilityDays input[type='checkbox']");

  if (state.barberProfile) {
    if (startInput) startInput.value = normalizeTimeForInput(state.barberProfile.available_start_time) || "09:00";
    if (endInput) endInput.value = normalizeTimeForInput(state.barberProfile.available_end_time) || "18:00";

    const availableDays = Array.isArray(state.barberProfile.available_days)
      ? state.barberProfile.available_days.map((day) => String(day).toLowerCase())
      : [];

    dayCheckboxes.forEach((checkbox) => {
      checkbox.checked = availableDays.includes(String(checkbox.value).toLowerCase());
    });
  }

  if (form.dataset.bound === "true") return;
  form.dataset.bound = "true";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedDays = Array.from(dayCheckboxes)
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => String(checkbox.value).toLowerCase())
      .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

    const start = String(startInput?.value || "");
    const end = String(endInput?.value || "");

    if (!selectedDays.length) {
      notice.textContent = "Select at least one available day.";
      notice.className = "notice error";
      return;
    }

    if (!start || !end || start >= end) {
      notice.textContent = "Start time must be before end time.";
      notice.className = "notice error";
      return;
    }

    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    try {
      const updatedProfile = await updateBarberAvailability({
        available_days: selectedDays,
        available_start_time: start,
        available_end_time: end,
      });

      state.barberProfile = {
        ...(state.barberProfile || {}),
        ...updatedProfile,
      };

      notice.textContent = "Availability updated successfully.";
      notice.className = "notice success";
      toast("Availability saved");
    } catch (error) {
      notice.textContent = error.message;
      notice.className = "notice error";
      toast(error.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Save Availability";
    }
  });
}

function bindCalendarControls() {
  const dateInput = document.getElementById("calendarDate");
  const viewButtons = document.querySelectorAll("[data-calendar-view]");
  if (!dateInput || !viewButtons.length) return;

  if (!dateInput.value) {
    dateInput.value = state.calendarDate;
  } else {
    state.calendarDate = dateInput.value;
  }

  updateCalendarViewButtons();

  if (dateInput.dataset.bound !== "true") {
    dateInput.dataset.bound = "true";
    dateInput.addEventListener("change", () => {
      state.calendarDate = dateInput.value || toDateInput(new Date());
      renderBarberCalendar();
    });
  }

  viewButtons.forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const targetView = button.dataset.calendarView;
      if (!targetView) return;
      state.calendarView = targetView;
      updateCalendarViewButtons();
      renderBarberCalendar();
    });
  });

  renderBarberCalendar();
}

function updateCalendarViewButtons() {
  document.querySelectorAll("[data-calendar-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.calendarView === state.calendarView);
  });
}

function renderBarberCalendar() {
  const grid = document.getElementById("barberCalendarGrid");
  const details = document.getElementById("calendarAppointmentDetails");
  if (!grid || !details) return;

  const bookings = Array.isArray(state.barberBookings) ? state.barberBookings : [];
  const selectedDate = parseDateValue(state.calendarDate);

  if (!selectedDate) {
    grid.innerHTML = `<div class="calendar-empty">Select a valid date to view appointments.</div>`;
    details.innerHTML = `<p class="muted">Click an appointment block to view details.</p>`;
    return;
  }

  if (!bookings.length) {
    grid.className = `calendar-grid ${state.calendarView}`;
    grid.innerHTML = `<div class="calendar-empty">No appointments yet.</div>`;
    details.innerHTML = `<p class="muted">Click an appointment block to view details.</p>`;
    return;
  }

  if (state.calendarView === "week") {
    const weekStart = startOfWeek(selectedDate);
    const days = Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx));

    grid.className = "calendar-grid week";
    grid.innerHTML = days
      .map((day) => {
        const dayKey = toDateInput(day);
        const dayBookings = bookings
          .filter((booking) => toDateInput(new Date(booking.scheduled_time)) === dayKey)
          .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

        return `
          <article class="calendar-cell">
            <strong class="calendar-day-title">${escapeHtml(
              day.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
            )}</strong>
            ${
              dayBookings.length
                ? dayBookings.map((booking) => calendarEventTemplate(booking)).join("")
                : `<span class="muted">No appointments</span>`
            }
          </article>
        `;
      })
      .join("");
  } else {
    const dayKey = toDateInput(selectedDate);
    const dayBookings = bookings
      .filter((booking) => toDateInput(new Date(booking.scheduled_time)) === dayKey)
      .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

    grid.className = "calendar-grid day";
    grid.innerHTML = `
      <article class="calendar-cell">
        <strong class="calendar-day-title">${escapeHtml(
          selectedDate.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })
        )}</strong>
        ${
          dayBookings.length
            ? dayBookings.map((booking) => calendarEventTemplate(booking)).join("")
            : `<div class="calendar-empty">No appointments for this day.</div>`
        }
      </article>
    `;
  }

  details.innerHTML = `<p class="muted">Click an appointment block to view details.</p>`;

  grid.querySelectorAll("[data-calendar-booking-id]").forEach((eventEl) => {
    eventEl.addEventListener("click", () => {
      const bookingId = Number(eventEl.dataset.calendarBookingId || 0);
      const booking = bookings.find((item) => Number(item.id) === bookingId);
      if (!booking) return;
      details.innerHTML = renderCalendarAppointmentDetails(booking);
    });
  });
}

function calendarEventTemplate(booking) {
  const customerName = booking.customer_name || `Customer #${booking.customer_id}`;
  const statusValue = String(booking.status || "pending").toLowerCase();
  return `
    <button class="calendar-event" type="button" data-calendar-booking-id="${Number(booking.id)}">
      <strong>${escapeHtml(customerName)}</strong>
      <span>${escapeHtml(booking.service_name || "Haircut")}</span>
      <span>${escapeHtml(formatTime(booking.scheduled_time))} - ${priceText(booking.price)}</span>
      <span class="status-badge status-${escapeHtml(statusValue)}">${escapeHtml(statusValue)}</span>
    </button>
  `;
}

function renderCalendarAppointmentDetails(booking) {
  const customerName = booking.customer_name || `Customer #${booking.customer_id}`;
  const customerPhone = booking.customer_phone || "Not provided";
  const statusValue = String(booking.status || "pending").toLowerCase();

  return `
    <h4>Appointment Details</h4>
    <p><strong>Customer:</strong> ${escapeHtml(customerName)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(customerPhone)}</p>
    <p><strong>Service:</strong> ${escapeHtml(booking.service_name || "Haircut")}</p>
    <p><strong>Time:</strong> ${escapeHtml(formatDateTime(booking.scheduled_time))}</p>
    <p><strong>Price:</strong> ${priceText(booking.price)}</p>
    <p>
      <strong>Status:</strong>
      <span class="status-badge status-${escapeHtml(statusValue)}">${escapeHtml(statusValue)}</span>
    </p>
  `;
}

function renderBarberRequestList(bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return `<p class="muted">No new booking requests.</p>`;
  }

  const urgentClass = shouldHighlightUrgentRequests() ? " booking-item-urgent" : "";
  const urgentChip = shouldHighlightUrgentRequests()
    ? `<span class="request-priority-chip">New request</span>`
    : "";

  return bookings
    .map((booking) => {
      const customerName = booking.customer_name || `Customer #${booking.customer_id}`;
      return `
        <article class="booking-item${urgentClass}" data-booking-card-id="${Number(booking.id)}">
          <div>
            ${urgentChip}
            <strong>${escapeHtml(customerName)}</strong>
            <p class="muted">${formatDateTime(booking.scheduled_time)}</p>
            <p class="request-service">${escapeHtml(booking.service_name || "Haircut")} - ${priceText(
        booking.price
      )}</p>
          </div>
          <div class="action-row">
            <button class="btn btn-primary" data-booking-id="${booking.id}" data-booking-action="approved">Accept</button>
            <button class="btn btn-ghost" data-booking-id="${booking.id}" data-booking-action="rejected">Reject</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTodayAppointmentList(bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return `<p class="muted">No appointments scheduled for today.</p>`;
  }

  return bookings
    .map((booking) => {
      const customerName = booking.customer_name || `Customer #${booking.customer_id}`;
      const statusValue = String(booking.status || "pending").toLowerCase();
      return `
        <article class="booking-item" data-booking-card-id="${Number(booking.id)}">
          <div>
            <strong>${escapeHtml(customerName)}</strong>
            <p class="muted">${escapeHtml(formatTime(booking.scheduled_time))} - ${escapeHtml(
        booking.service_name || "Haircut"
      )}</p>
          </div>
          <div class="booking-tags booking-tags-expanded">
            <span class="status-badge status-${escapeHtml(statusValue)}">${escapeHtml(statusValue)}</span>
            <span class="pill">${priceText(booking.price)}</span>
            ${renderMessageAction(booking)}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRecentClientsList(completedBookings) {
  if (!Array.isArray(completedBookings) || completedBookings.length === 0) {
    return `<p class="muted">No completed clients yet.</p>`;
  }

  const sorted = [...completedBookings].sort(
    (a, b) => new Date(b.scheduled_time) - new Date(a.scheduled_time)
  );

  const uniqueClients = [];
  const seenClientIds = new Set();

  sorted.forEach((booking) => {
    const key = String(booking.customer_id || booking.id);
    if (seenClientIds.has(key)) return;
    seenClientIds.add(key);
    uniqueClients.push(booking);
  });

  return uniqueClients
    .slice(0, 6)
    .map((booking) => {
      const customerName = booking.customer_name || `Customer #${booking.customer_id}`;
      return `
        <article class="client-row">
          <div>
            <strong>${escapeHtml(customerName)}</strong>
            <p class="muted">${escapeHtml(booking.customer_phone || "No phone")} - ${escapeHtml(
        booking.service_name || "Haircut"
      )}</p>
          </div>
          <span class="pill">${escapeHtml(formatDateTime(booking.scheduled_time))}</span>
        </article>
      `;
    })
    .join("");
}

function renderBookingList(bookings, emptyText, disputes = []) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }

  return bookings
    .slice()
    .sort((a, b) => new Date(b.scheduled_time) - new Date(a.scheduled_time))
    .map((booking) => {
      const customerName = booking.customer_name || `Customer #${booking.customer_id}`;
      const statusValue = String(booking.status || "pending").toLowerCase();
      return `
        <article class="booking-item" data-booking-card-id="${Number(booking.id)}">
          <div>
            <strong>${escapeHtml(customerName)}</strong>
            <p class="muted">${formatDateTime(booking.scheduled_time)}</p>
            <p class="request-service">${escapeHtml(booking.service_name || "Haircut")}</p>
          </div>
          <div class="booking-tags booking-tags-expanded">
            <span class="status-badge status-${escapeHtml(statusValue)}">${escapeHtml(statusValue)}</span>
            <span class="pill">${priceText(booking.price)}</span>
            ${renderMessageAction(booking)}
            ${state.currentRole === "barber" ? renderBarberBookingActions(booking, disputes) : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCustomerBookingActions(booking, disputes = []) {
  const statusValue = String(booking?.status || "").toLowerCase();
  const paymentStatus = String(booking?.payment_status || "").toLowerCase();
  const hasOpenDispute = disputes.some(
    (item) =>
      Number(item.booking_id) === Number(booking.id) &&
      ["open", "investigating"].includes(String(item.status || "").toLowerCase())
  );

  const actions = [];
  if (["pending", "approved", "paid"].includes(statusValue)) {
    actions.push(
      `<button class="btn btn-ghost" type="button" data-cancel-booking-id="${Number(booking.id)}">Cancel</button>`
    );
  }
  if (paymentStatus === "paid" && !booking.refund_requested && ["cancelled", "paid", "completed", "disputed"].includes(statusValue)) {
    actions.push(
      `<button class="btn btn-ghost" type="button" data-refund-booking-id="${Number(booking.id)}">Request Refund</button>`
    );
  }
  if (!hasOpenDispute && ["completed", "no_show", "cancelled"].includes(statusValue)) {
    actions.push(
      `<button class="btn btn-ghost" type="button" data-dispute-booking-id="${Number(booking.id)}">Raise Dispute</button>`
    );
  }
  if (statusValue === "completed" && !booking.review_exists) {
    actions.push(
      `<button class="btn btn-primary" type="button" data-review-booking-id="${Number(booking.id)}" data-review-barber-name="${escapeHtml(
        booking.barber_name || "your barber"
      )}">Leave Review</button>`
    );
  }
  return actions.join("");
}

function buildBarberChecklist(profile, kyc) {
  const portfolioCount = Array.isArray(profile?.portfolio_image_urls) ? profile.portfolio_image_urls.length : 0;
  const hasAvailability = Boolean(
    Array.isArray(profile?.available_days) &&
      profile.available_days.length &&
      profile?.available_start_time &&
      profile?.available_end_time
  );
  return [
    {
      title: "Profile basics",
      done: Boolean(profile?.shop_name && profile?.location && profile?.haircut_price),
      copy: "Shop name, location, and haircut price should be complete.",
    },
    {
      title: "Portfolio uploaded",
      done: portfolioCount >= 3,
      copy: portfolioCount >= 3 ? `${portfolioCount} haircut photos uploaded.` : "Add at least 3 haircut photos customers can view.",
    },
    {
      title: "Availability set",
      done: hasAvailability,
      copy: hasAvailability ? "Working days and hours are set." : "Set your working days and hours so customers can request real slots.",
    },
    {
      title: "KYC submitted",
      done: Boolean(kyc) || Boolean(profile?.kyc_submitted_at),
      copy: kyc ? "KYC details submitted." : "Submit KYC and payout details for verification.",
    },
    {
      title: "Marketplace ready",
      done: String(profile?.kyc_status || "").toLowerCase() === "verified" && Boolean(profile?.is_available),
      copy:
        String(profile?.kyc_status || "").toLowerCase() === "verified" && Boolean(profile?.is_available)
          ? "You are verified and currently visible to customers."
          : "Go verified and online before sharing your booking link publicly.",
    },
  ];
}

function renderBarberBookingActions(booking, disputes = []) {
  const statusValue = String(booking?.status || "").toLowerCase();
  const paymentStatus = String(booking?.payment_status || "").toLowerCase();
  const hasOpenDispute = disputes.some(
    (item) =>
      Number(item.booking_id) === Number(booking.id) &&
      ["open", "investigating"].includes(String(item.status || "").toLowerCase())
  );

  const actions = [];
  if (["pending", "approved", "paid"].includes(statusValue)) {
    actions.push(
      `<button class="btn btn-ghost" type="button" data-cancel-booking-id="${Number(booking.id)}">Cancel</button>`
    );
  }
  if (paymentStatus === "paid" && !booking.refund_requested && ["cancelled", "paid", "completed", "disputed"].includes(statusValue)) {
    actions.push(
      `<button class="btn btn-ghost" type="button" data-refund-booking-id="${Number(booking.id)}">Request Refund</button>`
    );
  }
  if (!hasOpenDispute && ["completed", "no_show", "cancelled"].includes(statusValue)) {
    actions.push(
      `<button class="btn btn-ghost" type="button" data-dispute-booking-id="${Number(booking.id)}">Raise Dispute</button>`
    );
  }
  return actions.join("");
}

function renderDisputeList(disputes, emptyText) {
  if (!Array.isArray(disputes) || disputes.length === 0) {
    return `<p class="muted">${escapeHtml(emptyText)}</p>`;
  }

  return disputes
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(
      (item) => `
        <article class="booking-item" data-dispute-card-id="${Number(item.id)}">
          <div>
            <strong>Booking #${Number(item.booking_id)}</strong>
            <p class="muted">${escapeHtml(item.reason || "No reason provided")}</p>
            <p class="request-service">${escapeHtml(formatDateTime(item.created_at))}</p>
          </div>
          <div class="booking-tags booking-tags-expanded">
            <span class="status-badge status-${escapeHtml(String(item.status || "open").toLowerCase())}">
              ${escapeHtml(String(item.status || "open"))}
            </span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAdminBarberQueue(barbers, section = "pending") {
  if (!Array.isArray(barbers) || barbers.length === 0) {
    const emptyMessages = {
      pending: "No barber profiles are waiting for review.",
      approved: "No approved barbers yet.",
      flagged: "No suspended or rejected barbers right now.",
    };
    return `<p class="muted">${escapeHtml(emptyMessages[section] || "No barber profiles found.")}</p>`;
  }

  const isSuperAdmin = state.currentRole === "super_admin";

  return barbers
    .map(
      (barber) => `
        <article class="admin-review-card" data-admin-barber-card-id="${Number(barber.barber_id)}">
          <div class="admin-review-main">
            <strong>${escapeHtml(barber.shop_name || barber.barber_name || `Barber #${barber.barber_id}`)}</strong>
            <p class="muted">${escapeHtml(barber.barber_name || "Unnamed barber")} - ${escapeHtml(
              barber.location || "No location"
            )}</p>
            <div class="admin-review-details admin-review-summary">
              <p><strong>Email:</strong> ${escapeHtml(barber.email || "No email")}</p>
              <p><strong>Phone:</strong> ${escapeHtml(barber.phone_number || "No phone")}</p>
              <p><strong>Shop Address:</strong> ${escapeHtml(barber.shop_address || "No address submitted")}</p>
              <p><strong>Haircut Price:</strong> ${Number(barber.haircut_price || 0) > 0 ? priceText(barber.haircut_price) : "Not set"}</p>
              <p><strong>Rating:</strong> ${barber.review_count ? `${Number(barber.average_rating || 0).toFixed(1)} / 5` : "No reviews yet"}</p>
              <p><strong>Review Count:</strong> ${Number(barber.review_count || 0)} public${Number(barber.hidden_review_count || 0) ? ` - ${Number(barber.hidden_review_count || 0)} hidden` : ""}</p>
              <p><strong>KYC Submitted:</strong> ${escapeHtml(
                barber.kyc_submitted_at ? formatDateTime(barber.kyc_submitted_at) : "Not submitted"
              )}</p>
              <p><strong>Verified:</strong> ${escapeHtml(
                barber.verified_at ? formatDateTime(barber.verified_at) : "Not verified yet"
              )}</p>
            </div>
            <p class="request-service">${escapeHtml(barber.bio || "No bio added yet.")}</p>
            ${
              barber.other_services
                ? `<p class="request-service"><strong>Other Services:</strong> ${escapeHtml(barber.other_services)}</p>`
                : ""
            }
            ${
              barber.rejection_reason
                ? `<p class="request-service"><strong>Review Note:</strong> ${escapeHtml(barber.rejection_reason)}</p>`
                : ""
            }
            <div class="admin-review-links">
              ${
                Number(barber.barber_id) > 0
                  ? `<button class="btn btn-ghost btn-sm" type="button" data-open-admin-barber="${Number(barber.barber_id)}">View Full Profile</button>`
                  : `<span class="pill">Awaiting profile setup</span>`
              }
              ${
                barber.profile_image_url
                  ? `<a href="${escapeHtml(barber.profile_image_url)}" target="_blank" rel="noopener noreferrer">Open profile image</a>`
                  : ""
              }
              ${
                barber.shop_photo_url
                  ? `<a href="${escapeHtml(barber.shop_photo_url)}" target="_blank" rel="noopener noreferrer">Open shop photo</a>`
                  : ""
              }
              ${
                Array.isArray(barber.portfolio_image_urls) && barber.portfolio_image_urls.length
                  ? barber.portfolio_image_urls
                      .slice(0, 3)
                      .map(
                        (url, index) =>
                          `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Portfolio ${index + 1}</a>`
                      )
                      .join("")
                  : ""
              }
            </div>
          </div>
          <div class="admin-review-meta">
            <span class="status-badge status-${escapeHtml(String(barber.kyc_status || "pending").toLowerCase())}">
              ${escapeHtml(String(barber.kyc_status || "pending"))}
            </span>
            ${renderAdminBarberActions(barber, section, isSuperAdmin)}
            <p class="muted admin-review-note">
              ${
                isSuperAdmin
                  ? "Super admin can approve even when KYC is incomplete."
                  : "Admin approval requires submitted KYC."
              }
            </p>
          </div>
        </article>
      `
    )
    .join("");
}

function applyAdminBarberFilters(barbers = []) {
  const searchValue = String(document.getElementById("adminBarberSearch")?.value || "").trim().toLowerCase();
  const statusValue = String(document.getElementById("adminBarberStatusFilter")?.value || "all").toLowerCase();
  const cityValue = String(document.getElementById("adminBarberCityFilter")?.value || "").trim().toLowerCase();

  const filteredAll = (Array.isArray(barbers) ? barbers : []).filter((barber) => {
    const status = String(barber.kyc_status || "").toLowerCase();
    const matchesSearch = !searchValue || [
      barber.barber_name,
      barber.shop_name,
      barber.location,
      barber.email,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(searchValue));
    const matchesStatus = statusValue === "all" || status === statusValue;
    const matchesCity = !cityValue || String(barber.location || "").toLowerCase().includes(cityValue);
    return matchesSearch && matchesStatus && matchesCity;
  });

  return {
    filteredAll,
    pendingBarbers: filteredAll.filter((barber) => String(barber.kyc_status || "").toLowerCase() === "pending"),
    approvedBarbers: filteredAll.filter((barber) => String(barber.kyc_status || "").toLowerCase() === "verified"),
    flaggedBarbers: filteredAll.filter((barber) =>
      ["rejected", "suspended"].includes(String(barber.kyc_status || "").toLowerCase())
    ),
  };
}

function renderAdminReviewList(reviews = []) {
  if (!Array.isArray(reviews) || !reviews.length) {
    return renderEmptyStateCard("No customer reviews yet", "Public reviews will appear here after completed bookings are rated.");
  }

  return reviews
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(
      (review) => `
        <article class="admin-review-card" data-admin-review-id="${Number(review.id)}">
          <div class="admin-review-main">
            <strong>${escapeHtml(review.customer_name || "Trimly Customer")}</strong>
            <p class="muted">Booking #${Number(review.booking_id)} - ${escapeHtml(review.service_name || "Haircut")}</p>
            <p class="request-service">${escapeHtml(renderStars(review.rating))} - ${escapeHtml(review.review_text || "No written feedback supplied.")}</p>
            ${
              review.admin_note
                ? `<p class="admin-review-note"><strong>Admin note:</strong> ${escapeHtml(review.admin_note)}</p>`
                : ""
            }
          </div>
          <div class="admin-review-meta">
            <span class="status-badge status-${review.is_visible ? "completed" : "rejected"}">
              ${review.is_visible ? "Visible" : "Hidden"}
            </span>
            <div class="action-row">
              <button class="btn btn-ghost btn-sm" type="button" data-admin-review-action="${review.is_visible ? "hide" : "show"}" data-admin-review-id="${Number(review.id)}">
                ${review.is_visible ? "Hide Review" : "Show Review"}
              </button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAdminBarberActions(barber, section, isSuperAdmin) {
  const barberId = Number(barber.barber_id);
  if (!barberId) return "";
  if (barberId <= 0 || String(barber.kyc_status || "").toLowerCase() === "pending_setup") {
    return `
      <div class="action-row">
        <span class="pill">Waiting for barber profile setup</span>
      </div>
    `;
  }

  if (section === "approved") {
    return `
      <div class="action-row">
        <button class="btn btn-ghost" type="button" data-admin-barber-action="pending" data-admin-barber-id="${barberId}">Move to Pending</button>
        <button class="btn btn-ghost" type="button" data-admin-barber-action="suspended" data-admin-barber-id="${barberId}">Suspend</button>
      </div>
    `;
  }

  if (section === "flagged") {
    return `
      <div class="action-row">
        <button class="btn btn-primary" type="button" data-admin-barber-action="verified" data-admin-barber-id="${barberId}">
          ${isSuperAdmin && !barber.kyc_submitted_at ? "Override Approve" : "Approve"}
        </button>
        <button class="btn btn-ghost" type="button" data-admin-barber-action="pending" data-admin-barber-id="${barberId}">Move to Pending</button>
      </div>
    `;
  }

  return `
    <div class="action-row">
      <button class="btn btn-primary" type="button" data-admin-barber-action="verified" data-admin-barber-id="${barberId}">
        ${isSuperAdmin && !barber.kyc_submitted_at ? "Override Approve" : "Approve"}
      </button>
      <button class="btn btn-ghost" type="button" data-admin-barber-action="rejected" data-admin-barber-id="${barberId}">Reject</button>
      <button class="btn btn-ghost" type="button" data-admin-barber-action="suspended" data-admin-barber-id="${barberId}">Suspend</button>
    </div>
  `;
}

function resolveAdminBarberSection(barber) {
  const status = String(barber?.kyc_status || "").toLowerCase();
  if (status === "verified") return "approved";
  if (["rejected", "suspended"].includes(status)) return "flagged";
  return "pending";
}

function renderAdminBarberDrawer(barber) {
  if (!barber) {
    return `<p class="muted">Barber profile not found.</p>`;
  }

  const section = resolveAdminBarberSection(barber);
  const isSuperAdmin = state.currentRole === "super_admin";
  const availableDays = Array.isArray(barber.available_days) && barber.available_days.length
    ? barber.available_days.map(capitalize).join(", ")
    : "Not set";
  const availableHours =
    barber.available_start_time && barber.available_end_time
      ? `${formatTime(barber.available_start_time)} - ${formatTime(barber.available_end_time)}`
      : "Not set";
  const bankSummary =
    [barber.bank_name, barber.account_name, barber.bank_account_number].filter(Boolean).join(" - ") || "Not submitted";
  const profileLinks = [
    barber.profile_image_url
      ? `<a href="${escapeHtml(barber.profile_image_url)}" target="_blank" rel="noopener noreferrer">Open profile image</a>`
      : "",
    barber.shop_photo_url
      ? `<a href="${escapeHtml(barber.shop_photo_url)}" target="_blank" rel="noopener noreferrer">Open shop photo</a>`
      : "",
    ...(Array.isArray(barber.portfolio_image_urls) ? barber.portfolio_image_urls : [])
      .slice(0, 6)
      .map(
        (url, index) =>
          `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Portfolio ${index + 1}</a>`
      ),
  ].filter(Boolean);

  return `
    <div class="drawer-profile-grid">
      <div class="drawer-profile-main">
        <div class="drawer-profile-hero">
          <div>
            <h4>${escapeHtml(barber.shop_name || barber.barber_name || `Barber #${barber.barber_id}`)}</h4>
            <p class="muted">${escapeHtml(barber.barber_name || "Unnamed barber")} - ${escapeHtml(barber.location || "No location")}</p>
          </div>
          <span class="status-badge status-${escapeHtml(String(barber.kyc_status || "pending").toLowerCase())}">
            ${escapeHtml(String(barber.kyc_status || "pending"))}
          </span>
        </div>
        <div class="admin-review-details">
          <p><strong>Email:</strong> ${escapeHtml(barber.email || "No email")}</p>
          <p><strong>Phone:</strong> ${escapeHtml(barber.phone_number || "No phone")}</p>
          <p><strong>Shop Address:</strong> ${escapeHtml(barber.shop_address || "No address submitted")}</p>
          <p><strong>Location:</strong> ${escapeHtml(barber.location || "No location")}</p>
          <p><strong>Haircut Price:</strong> ${priceText(barber.haircut_price)}</p>
          <p><strong>Beard Trim:</strong> ${barber.beard_trim_price ? priceText(barber.beard_trim_price) : "Not set"}</p>
          <p><strong>Other Services:</strong> ${escapeHtml(barber.other_services || "Not set")}</p>
          <p><strong>Availability:</strong> ${escapeHtml(availableDays)}</p>
          <p><strong>Hours:</strong> ${escapeHtml(availableHours)}</p>
          <p><strong>Live Status:</strong> ${escapeHtml(barber.is_available ? "Online" : "Offline")}</p>
          <p><strong>Public Rating:</strong> ${Number(barber.review_count || 0) ? `${Number(barber.average_rating || 0).toFixed(1)} / 5` : "No reviews yet"}</p>
          <p><strong>Review Count:</strong> ${Number(barber.review_count || 0)} visible${Number(barber.hidden_review_count || 0) ? ` - ${Number(barber.hidden_review_count || 0)} hidden` : ""}</p>
          <p><strong>KYC Submitted:</strong> ${escapeHtml(barber.kyc_submitted_at ? formatDateTime(barber.kyc_submitted_at) : "Not submitted")}</p>
          <p><strong>Verified:</strong> ${escapeHtml(barber.verified_at ? formatDateTime(barber.verified_at) : "Not verified yet")}</p>
          <p><strong>Bank Details:</strong> ${escapeHtml(bankSummary)}</p>
        </div>
        <div class="drawer-detail-block">
          <strong>Bio</strong>
          <p class="muted">${escapeHtml(barber.bio || "No bio added yet.")}</p>
        </div>
        ${
          barber.rejection_reason
            ? `<div class="drawer-detail-block"><strong>Admin Note</strong><p class="muted">${escapeHtml(barber.rejection_reason)}</p></div>`
            : ""
        }
        <div class="drawer-detail-block">
          <strong>Review Actions</strong>
          ${renderAdminBarberActions(barber, section, isSuperAdmin)}
          <p class="muted admin-review-note">
            ${
              isSuperAdmin
                ? "Super admin can approve even if KYC has not been submitted."
                : "Admin approval still requires submitted KYC."
            }
          </p>
        </div>
      </div>
      <div class="drawer-profile-side">
        <div class="drawer-link-list">
          ${profileLinks.length ? profileLinks.join("") : `<p class="muted">No profile or portfolio links uploaded yet.</p>`}
        </div>
      </div>
    </div>
  `;
}

function openAdminBarberDrawer(barberId) {
  const barber = state.adminBarbers.find((item) => Number(item.barber_id) === Number(barberId));
  const drawer = document.getElementById("adminBarberDrawer");
  const backdrop = document.getElementById("adminBarberDrawerBackdrop");
  const body = document.getElementById("adminBarberDrawerBody");
  const title = document.getElementById("adminBarberDrawerTitle");
  if (!drawer || !backdrop || !body || !title) return;

  title.textContent = barber?.shop_name || barber?.barber_name || "Barber details";
  body.innerHTML = renderAdminBarberDrawer(barber);
  drawer.classList.remove("hidden");
  backdrop.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("drawer-open");
  bindAdminDashboardActions(drawer);
}

function closeAdminBarberDrawer() {
  const drawer = document.getElementById("adminBarberDrawer");
  const backdrop = document.getElementById("adminBarberDrawerBackdrop");
  if (!drawer || !backdrop) return;
  drawer.classList.add("hidden");
  backdrop.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("drawer-open");
}

function renderAdminDisputeList(disputes) {
  if (!Array.isArray(disputes) || disputes.length === 0) {
    return renderEmptyStateCard("No open disputes", "New customer or barber disputes will appear here when they need review.");
  }

  return disputes
    .map(
      (item) => `
        <article class="admin-review-card" data-admin-dispute-card-id="${Number(item.id)}">
          <div>
            <strong>Booking #${Number(item.booking_id)}</strong>
            <p class="muted">${escapeHtml(item.reason || "No reason supplied")}</p>
            <p class="request-service">Raised ${escapeHtml(formatDateTime(item.created_at))}</p>
          </div>
          <div class="action-row">
            <button class="btn btn-primary" type="button" data-admin-resolve-dispute="${Number(item.id)}" data-resolution="resolved">Resolve</button>
            <button class="btn btn-ghost" type="button" data-admin-resolve-dispute="${Number(item.id)}" data-resolution="rejected">Reject</button>
            <button class="btn btn-ghost" type="button" data-admin-resolve-dispute="${Number(item.id)}" data-resolution="refunded">Refund</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAdminEscrowList(bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return renderEmptyStateCard("No bookings awaiting completion", "Once customers pay and services are completed, those records will appear here for admin follow-up.");
  }

  return bookings
    .map(
      (booking) => `
        <article class="admin-review-card" data-admin-booking-card-id="${Number(booking.id)}">
          <div>
            <strong>Booking #${Number(booking.id)}</strong>
            <p class="muted">${escapeHtml(booking.customer_name || "Customer")} - ${escapeHtml(
              booking.barber_name || `Barber #${booking.barber_id}`
            )}</p>
            <p class="request-service">Amount ${priceText(booking.price)} - Barber Share ${priceText(
              booking.barber_payout_amount || 0
            )}</p>
          </div>
          <div class="action-row">
            <button class="btn btn-primary" type="button" data-mark-completed-id="${Number(booking.id)}">Mark Completed</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAdminRefundList(bookings) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return renderEmptyStateCard("No refund requests pending", "Any refund requests raised by customers or admins will show up here.");
  }

  return bookings
    .map(
      (booking) => `
        <article class="admin-review-card" data-admin-booking-card-id="${Number(booking.id)}">
          <div>
            <strong>Booking #${Number(booking.id)}</strong>
            <p class="muted">${escapeHtml(booking.customer_name || "Customer")} - ${escapeHtml(
              booking.barber_name || `Barber #${booking.barber_id}`
            )}</p>
            <p class="request-service">Status ${escapeHtml(String(booking.status || ""))} - ${priceText(booking.price)}</p>
          </div>
          <div class="action-row">
            <button class="btn btn-primary" type="button" data-admin-refund-booking="${Number(booking.id)}">Mark Refunded</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAdminUsersList(users) {
  if (!Array.isArray(users) || users.length === 0) {
    return `<p class="muted">No admin-class accounts yet.</p>`;
  }

  return users
    .map(
      (user) => `
        <article class="admin-review-card">
          <div>
            <strong>${escapeHtml(user.full_name || user.email)}</strong>
            <p class="muted">${escapeHtml(user.email)}</p>
            <p class="request-service">${escapeHtml(String(user.role || "admin"))}</p>
          </div>
          <div class="admin-review-meta">
            <span class="status-badge status-${user.admin_approved ? "completed" : "pending"}">
              ${user.admin_approved ? "approved" : "pending"}
            </span>
            <div class="action-row">
              <button class="btn btn-primary" type="button" data-admin-user-approve="${Number(user.id)}">Approve</button>
              <button class="btn btn-ghost" type="button" data-admin-user-revoke="${Number(user.id)}">Revoke</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function populateKycForm(form, data) {
  if (!form || !data) return;
  Object.entries(data).forEach(([key, value]) => {
    const input = form.elements.namedItem(key);
    if (input && value !== null && value !== undefined) {
      input.value = String(value);
    }
  });
}

function bindDashboardBookingActions(container = document) {
  container.querySelectorAll("[data-cancel-booking-id]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const bookingId = Number(button.dataset.cancelBookingId || 0);
      if (!bookingId) return;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Cancelling...";
      try {
        await cancelBooking(bookingId);
        toast("Booking cancelled");
        await refreshDashboardByRole();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });

  container.querySelectorAll("[data-refund-booking-id]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const bookingId = Number(button.dataset.refundBookingId || 0);
      if (!bookingId) return;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Submitting...";
      try {
        await requestRefund(bookingId);
        toast("Refund request submitted");
        await refreshDashboardByRole();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });

  container.querySelectorAll("[data-dispute-booking-id]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const bookingId = Number(button.dataset.disputeBookingId || 0);
      if (!bookingId) return;
      const reason = window.prompt("Tell Trimly why you are raising this dispute.");
      if (!reason || !reason.trim()) return;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Submitting...";
      try {
        await createDispute({ booking_id: bookingId, reason: reason.trim() });
        toast("Dispute raised successfully");
        await refreshDashboardByRole();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });

  bindBookingReviewActions(container);
}

function bindBookingReviewActions(container = document) {
  const modal = document.getElementById("reviewModal");
  const backdrop = document.getElementById("reviewModalBackdrop");
  const closeBtn = document.getElementById("reviewModalClose");
  const cancelBtn = document.getElementById("reviewModalCancel");
  const form = document.getElementById("reviewForm");
  const bookingIdInput = document.getElementById("reviewBookingId");
  const subtitle = document.getElementById("reviewModalSubtitle");
  const notice = document.getElementById("reviewNotice");
  const reviewText = document.getElementById("reviewText");
  const ratingPicker = document.getElementById("reviewRatingPicker");

  if (!modal || !backdrop || !closeBtn || !cancelBtn || !form || !bookingIdInput || !notice || !ratingPicker) {
    return;
  }

  const closeModal = () => {
    modal.classList.add("hidden");
    backdrop.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    notice.textContent = "";
    notice.className = "notice";
    form.reset();
    delete form.dataset.selectedRating;
    syncReviewRatingButtons(ratingPicker, 0);
  };

  if (closeBtn.dataset.bound !== "true") {
    closeBtn.dataset.bound = "true";
    closeBtn.addEventListener("click", closeModal);
  }
  if (cancelBtn.dataset.bound !== "true") {
    cancelBtn.dataset.bound = "true";
    cancelBtn.addEventListener("click", closeModal);
  }
  if (backdrop.dataset.bound !== "true") {
    backdrop.dataset.bound = "true";
    backdrop.addEventListener("click", closeModal);
  }

  if (ratingPicker.dataset.bound !== "true") {
    ratingPicker.dataset.bound = "true";
    ratingPicker.addEventListener("click", (event) => {
      const button = event.target.closest("[data-review-rating]");
      if (!button) return;
      const rating = Number(button.dataset.reviewRating || 0);
      form.dataset.selectedRating = String(rating);
      syncReviewRatingButtons(ratingPicker, rating);
    });
  }

  container.querySelectorAll("[data-review-booking-id]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      bookingIdInput.value = String(button.dataset.reviewBookingId || "");
      subtitle.textContent = `Share a quick review for ${button.dataset.reviewBarberName || "your barber"}.`;
      modal.classList.remove("hidden");
      backdrop.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      reviewText.focus();
    });
  });

  if (form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const bookingId = Number(bookingIdInput.value || 0);
    const rating = Number(form.dataset.selectedRating || 0);
    if (!bookingId) return;
    if (!rating) {
      notice.textContent = "Choose a star rating before submitting.";
      notice.className = "notice error";
      return;
    }

    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";
    notice.textContent = "";

    try {
      await createBookingReview(bookingId, {
        rating,
        review_text: String(reviewText.value || "").trim() || null,
      });
      notice.textContent = "Review submitted. Thanks for helping other customers book with confidence.";
      notice.className = "notice success";
      toast("Review submitted");
      await refreshDashboardByRole();
      setTimeout(closeModal, 700);
    } catch (error) {
      notice.textContent = error.message;
      notice.className = "notice error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Review";
    }
  });
}

function syncReviewRatingButtons(container, rating) {
  container.querySelectorAll("[data-review-rating]").forEach((button) => {
    const value = Number(button.dataset.reviewRating || 0);
    button.classList.toggle("active", value === rating);
  });
}

function bindAdminDashboardActions(container = document) {
  const drawerClose = document.getElementById("adminBarberDrawerClose");
  const drawerBackdrop = document.getElementById("adminBarberDrawerBackdrop");
  if (drawerClose && drawerClose.dataset.bound !== "true") {
    drawerClose.dataset.bound = "true";
    drawerClose.addEventListener("click", closeAdminBarberDrawer);
  }
  if (drawerBackdrop && drawerBackdrop.dataset.bound !== "true") {
    drawerBackdrop.dataset.bound = "true";
    drawerBackdrop.addEventListener("click", closeAdminBarberDrawer);
  }
  if (document.body.dataset.adminDrawerBound !== "true") {
    document.body.dataset.adminDrawerBound = "true";
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAdminBarberDrawer();
    });
  }

  container.querySelectorAll("[data-open-admin-barber]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const barberId = Number(button.dataset.openAdminBarber || 0);
      if (!barberId) return;
      openAdminBarberDrawer(barberId);
    });
  });

  container.querySelectorAll("[data-admin-barber-action]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const barberId = Number(button.dataset.adminBarberId || 0);
      const action = String(button.dataset.adminBarberAction || "").toLowerCase();
      if (!barberId) return;
      button.disabled = true;
      try {
        let payload = { action };
        if (["rejected", "suspended", "pending"].includes(action)) {
          const promptLabel =
            action === "rejected"
              ? "Add a rejection reason for this barber."
              : action === "suspended"
                ? "Add a suspension note for this barber."
                : "Add a note for moving this barber back to pending review.";
          const reason = window.prompt(promptLabel, "");
          if (reason === null) {
            button.disabled = false;
            return;
          }
          payload = { action, rejection_reason: reason.trim() || null };
        }

        await verifyBarberKyc(barberId, payload);
        const successText =
          action === "verified"
            ? "Barber approved"
            : action === "rejected"
              ? "Barber rejected"
              : action === "suspended"
                ? "Barber suspended"
                : "Barber moved back to pending";
        toast(successText);
        closeAdminBarberDrawer();
        await hydrateAdminDashboard();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  });

  container.querySelectorAll("[data-admin-resolve-dispute]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const disputeId = Number(button.dataset.adminResolveDispute || 0);
      const resolution = String(button.dataset.resolution || "");
      if (!disputeId || !resolution) return;
      const adminNote = window.prompt("Optional admin note for this dispute.", "") || null;
      button.disabled = true;
      try {
        await resolveDispute(disputeId, { resolution, admin_note: adminNote });
        toast(`Dispute ${resolution}`);
        await hydrateAdminDashboard();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  });

  container.querySelectorAll("[data-mark-completed-id]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const bookingId = Number(button.dataset.markCompletedId || 0);
      if (!bookingId) return;
      button.disabled = true;
      try {
        await markBookingCompleted(bookingId);
        toast("Booking marked completed");
        await hydrateAdminDashboard();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  });

  container.querySelectorAll("[data-admin-refund-booking]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const bookingId = Number(button.dataset.adminRefundBooking || 0);
      if (!bookingId) return;
      button.disabled = true;
      try {
        await adminRefundBooking(bookingId);
        toast("Booking marked refunded");
        await hydrateAdminDashboard();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  });

  container.querySelectorAll("[data-admin-review-action]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const reviewId = Number(button.dataset.adminReviewId || 0);
      const action = String(button.dataset.adminReviewAction || "");
      if (!reviewId || !action) return;
      const adminNote = window.prompt(
        action === "hide"
          ? "Optional: leave a moderation note for why this review is being hidden."
          : "Optional: leave a note for restoring this review."
      );
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = action === "hide" ? "Hiding..." : "Updating...";
      try {
        await moderateReview(reviewId, { action, admin_note: adminNote || null });
        toast(action === "hide" ? "Review hidden" : "Review restored");
        await hydrateAdminDashboard();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
}

function bindAdminBarberFilters() {
  const form = document.getElementById("adminBarberFilterForm");
  const resetBtn = document.getElementById("adminBarberFilterReset");
  const searchInput = document.getElementById("adminBarberSearch");
  const statusInput = document.getElementById("adminBarberStatusFilter");
  const cityInput = document.getElementById("adminBarberCityFilter");
  if (!form || !resetBtn || !searchInput || !statusInput || !cityInput) return;

  const rerender = () => {
    const queueEl = document.getElementById("adminBarberQueue");
    const approvedEl = document.getElementById("adminApprovedBarbers");
    const flaggedEl = document.getElementById("adminFlaggedBarbers");
    const barberCountEl = document.getElementById("adminBarberCount");
    const approvedBarberCountEl = document.getElementById("adminApprovedBarberCount");
    const flaggedBarberCountEl = document.getElementById("adminFlaggedBarberCount");
    const totalBarbersStatEl = document.getElementById("adminStatTotalBarbers");
    const verifiedBarbersStatEl = document.getElementById("adminStatVerifiedBarbers");
    const pendingBarbersStatEl = document.getElementById("adminStatPendingBarbers");
    const flaggedBarbersStatEl = document.getElementById("adminStatFlaggedBarbers");
    if (!queueEl || !approvedEl || !flaggedEl) return;

    const { pendingBarbers, approvedBarbers, flaggedBarbers, filteredAll } = applyAdminBarberFilters(state.adminBarbers);
    queueEl.innerHTML = renderAdminBarberQueue(pendingBarbers, "pending");
    approvedEl.innerHTML = renderAdminBarberQueue(approvedBarbers, "approved");
    flaggedEl.innerHTML = renderAdminBarberQueue(flaggedBarbers, "flagged");
    if (barberCountEl) barberCountEl.textContent = `${pendingBarbers.length} pending`;
    if (approvedBarberCountEl) approvedBarberCountEl.textContent = `${approvedBarbers.length} approved`;
    if (flaggedBarberCountEl) flaggedBarberCountEl.textContent = `${flaggedBarbers.length} flagged`;
    if (totalBarbersStatEl) totalBarbersStatEl.textContent = `${filteredAll.length}`;
    if (verifiedBarbersStatEl) verifiedBarbersStatEl.textContent = `${approvedBarbers.length}`;
    if (pendingBarbersStatEl) pendingBarbersStatEl.textContent = `${pendingBarbers.length}`;
    if (flaggedBarbersStatEl) flaggedBarbersStatEl.textContent = `${flaggedBarbers.length}`;
    bindAdminDashboardActions();
  };

  if (form.dataset.bound !== "true") {
    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => event.preventDefault());
    [searchInput, statusInput, cityInput].forEach((input) => {
      input.addEventListener("input", rerender);
      input.addEventListener("change", rerender);
    });
    resetBtn.addEventListener("click", () => {
      form.reset();
      rerender();
    });
  }
}

function bindSuperAdminActions(container = document) {
  container.querySelectorAll("[data-admin-user-approve]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const userId = Number(button.dataset.adminUserApprove || 0);
      if (!userId) return;
      button.disabled = true;
      try {
        await approveAdminUser(userId, true);
        toast("Admin account approved");
        await hydrateSuperAdminUsers();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  });

  container.querySelectorAll("[data-admin-user-revoke]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const userId = Number(button.dataset.adminUserRevoke || 0);
      if (!userId) return;
      button.disabled = true;
      try {
        await approveAdminUser(userId, false);
        toast("Admin approval removed");
        await hydrateSuperAdminUsers();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function refreshDashboardByRole() {
  if (state.currentRole === "barber") {
    await hydrateBarberDashboard();
    await hydrateSharedDisputes();
    return;
  }
  if (["admin", "super_admin"].includes(state.currentRole)) {
    await hydrateAdminDashboard();
    return;
  }
  await hydrateCustomerDashboard();
  await hydrateSharedDisputes();
}

function hydrateTimeSelect(select, times) {
  const options = times.length ? times : [];

  if (!options.length) {
    select.innerHTML = `<option value="">No slots available</option>`;
    return;
  }

  select.innerHTML = options
    .map((time) => `<option value="${time}">${time}</option>`)
    .join("");
}

function normalizeAvailability(availability) {
  if (!Array.isArray(availability)) return [];

  const unique = new Set();
  availability.forEach((slot) => {
    const date = new Date(slot);
    if (Number.isNaN(date.getTime())) return;
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    unique.add(`${hh}:${mm}`);
  });

  return [...unique].sort();
}

async function renderBookingPaymentActions(bookingId, container) {
  if (!container) return;

  container.innerHTML = `<div class="loading">Checking booking status...</div>`;

  try {
    const bookings = await getBookings();
    const booking = Array.isArray(bookings)
      ? bookings.find((item) => Number(item.id) === Number(bookingId))
      : null;

    if (!booking) {
      container.innerHTML = `
        <div class="panel payment-status-card">
          <div class="payment-status-head">
            <div class="payment-status-copy">
              <strong>Booking created</strong>
              <p class="payment-helper">We could not reload this booking yet. Open your dashboard to track approval.</p>
            </div>
            <span class="status-badge status-pending">Pending</span>
          </div>
          <div class="payment-action-row">
            <a class="btn btn-ghost" href="/static/dashboard.html">Open Dashboard</a>
          </div>
        </div>
      `;
      return;
    }

    const statusValue = String(booking.status || "pending").toLowerCase();
    const paymentStatus = String(booking.payment_status || "unpaid").toLowerCase();

    if (paymentStatus === "paid") {
      container.innerHTML = `
        <div class="panel payment-status-card">
          <div class="payment-status-head">
            <div class="payment-status-copy">
              <strong>Payment received</strong>
              <p class="payment-helper">Your appointment is locked in and already paid for.</p>
            </div>
            <span class="status-badge status-completed">Paid</span>
          </div>
          <div class="payment-action-row">
            <a class="btn btn-ghost" href="/static/dashboard.html">View Booking</a>
          </div>
        </div>
      `;
      return;
    }

    if (["rejected", "cancelled"].includes(statusValue)) {
      container.innerHTML = `
        <div class="panel payment-status-card">
          <div class="payment-status-head">
            <div class="payment-status-copy">
              <strong>Payment unavailable</strong>
              <p class="payment-helper">This booking is ${escapeHtml(statusValue)} and can no longer be paid for.</p>
            </div>
            <span class="status-badge status-${escapeHtml(statusValue)}">${escapeHtml(statusValue)}</span>
          </div>
          <div class="payment-action-row">
            <a class="btn btn-ghost" href="/static/barber-profile.html?id=${Number(booking.barber_id)}">Choose Another Slot</a>
          </div>
        </div>
      `;
      return;
    }

    if (["approved", "accepted"].includes(statusValue)) {
      container.innerHTML = `
        <div class="panel payment-status-card">
          <div class="payment-status-head">
            <div class="payment-status-copy">
              <strong>Booking approved</strong>
              <p class="payment-helper">Your barber has approved this appointment. You can pay now to secure it.</p>
            </div>
            <span class="status-badge status-approved">Approved</span>
          </div>
          <div class="payment-action-row">
            <button class="btn btn-primary" type="button" data-pay-booking-id="${Number(booking.id)}">Pay Now</button>
            <button class="btn btn-ghost" type="button" data-refresh-booking-id="${Number(booking.id)}">Refresh Status</button>
          </div>
        </div>
      `;

      const payBtn = container.querySelector("[data-pay-booking-id]");
      payBtn?.addEventListener("click", async () => {
        payBtn.disabled = true;
        payBtn.textContent = "Redirecting...";
        try {
          const payment = await initializePayment(booking.id);
          if (!payment || !payment.payment_url) {
            throw new Error("Paystack did not return a payment link");
          }
          window.location.href = payment.payment_url;
        } catch (error) {
          toast(error.message, true);
          payBtn.disabled = false;
          payBtn.textContent = "Pay Now";
        }
      });
    } else {
      container.innerHTML = `
        <div class="panel payment-status-card">
          <div class="payment-status-head">
            <div class="payment-status-copy">
              <strong>Waiting for barber approval</strong>
              <p class="payment-helper">Your booking is pending. Pay Now will appear here as soon as the barber approves.</p>
            </div>
            <span class="status-badge status-pending">Pending</span>
          </div>
          <div class="payment-action-row">
            <button class="btn btn-ghost" type="button" data-refresh-booking-id="${Number(booking.id)}">Check Approval</button>
            <a class="btn btn-ghost" href="/static/dashboard.html">View Dashboard</a>
          </div>
        </div>
      `;
    }

    const refreshBtn = container.querySelector("[data-refresh-booking-id]");
    refreshBtn?.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Refreshing...";
      await renderBookingPaymentActions(bookingId, container);
    });
  } catch (error) {
    container.innerHTML = `<p class="muted">Unable to load payment status: ${escapeHtml(error.message)}</p>`;
  }
}

async function checkBarberProfileExists() {
  try {
    const profile = await getMyBarberProfile();
    state.barberProfile = profile;
    return true;
  } catch (error) {
    const message = String(error.message || "").toLowerCase();
    if (message.includes("not found")) {
      state.barberProfile = null;
      return false;
    }
    throw error;
  }
}

function normalizeTimeForInput(value) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{2}:\d{2}$/.test(text)) return text;
  const match = text.match(/(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function deriveDisplayName(email) {
  const source = String(email || "trimly user");
  const localPart = source.includes("@") ? source.split("@")[0] : source;
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseDateValue(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWeek(value) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function toDateInput(date) {
  const tzDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return tzDate.toISOString().split("T")[0];
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: getTimeFormatPreference() !== "24h",
  });
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: getTimeFormatPreference() !== "24h",
  });
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toast(message, isError = false) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;

  toastEl.textContent = message;
  toastEl.className = `toast ${isError ? "error" : "show"}`;

  if (!isError) {
    toastEl.classList.add("show");
  }

  setTimeout(() => {
    toastEl.classList.remove("show", "error");
  }, 2800);
}










function getFavoriteIds() {
  try {
    const raw = JSON.parse(localStorage.getItem("favourites") || "[]");
    return Array.isArray(raw)
      ? raw.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];
  } catch (_error) {
    return [];
  }
}

function saveFavoriteIds(ids) {
  localStorage.setItem("favourites", JSON.stringify(ids));
}

function toggleFavoriteBarber(barberId) {
  const normalizedId = Number(barberId);
  const next = getFavoriteIds();
  const index = next.indexOf(normalizedId);

  if (index >= 0) {
    next.splice(index, 1);
    saveFavoriteIds(next);
    return false;
  }

  next.push(normalizedId);
  saveFavoriteIds(next);
  return true;
}

function bindFavoriteButtons(container = document) {
  container.querySelectorAll("[data-favorite-toggle]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";

    button.addEventListener("click", () => {
      const barberId = Number(button.dataset.barberId || 0);
      const barberName = button.dataset.barberName || "Barber";
      const isSaved = toggleFavoriteBarber(barberId);

      button.classList.toggle("active", isSaved);
      button.textContent = isSaved
        ? button.classList.contains("favorite-profile-btn")
          ? "Saved to Favorites"
          : "Saved"
        : button.classList.contains("favorite-profile-btn")
          ? "Save Barber"
          : "Save";

      toast(isSaved ? `${barberName} saved` : `${barberName} removed from favorites`);
    });
  });
}

function renderMessageAction(booking) {
  const statusValue = String(booking?.status || "").toLowerCase();
  if (statusValue !== "approved") {
    return "";
  }

  const label = state.currentRole === "barber" ? "Chat Customer" : "Chat Barber";
  return `<a class="btn btn-ghost" href="/static/messages.html?booking=${Number(booking.id)}">${label}</a>`;
}

function renderPaymentAction(booking) {
  const statusValue = String(booking?.status || "").toLowerCase();
  const paymentStatus = String(booking?.payment_status || "").toLowerCase();

  if (!["approved", "accepted"].includes(statusValue) || paymentStatus === "paid") {
    return "";
  }

  return `<button class="btn btn-primary" type="button" data-pay-booking-id="${Number(
    booking.id
  )}">Pay Now</button>`;
}

function bindInlinePaymentButtons(container = document) {
  container.querySelectorAll("[data-pay-booking-id]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";

    button.addEventListener("click", async () => {
      const bookingId = Number(button.dataset.payBookingId || 0);
      if (!bookingId) return;

      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "Redirecting...";

      try {
        const payment = await initializePayment(bookingId);
        const paymentUrl = payment?.authorization_url || payment?.payment_url;
        if (!paymentUrl) {
          throw new Error("Paystack did not return a payment link");
        }
        window.location.href = paymentUrl;
      } catch (error) {
        toast(error.message, true);
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
}

function renderChatBubble(message) {
  const mine = String(message.sender_role || "").toLowerCase() === String(state.currentRole || "").toLowerCase();
  return `
    <article class="chat-bubble ${mine ? "mine" : ""}">
      <div class="chat-bubble-meta">
        <strong>${escapeHtml(message.sender_name || "Trimly User")}</strong>
        <span>${escapeHtml(formatDateTime(message.created_at))}</span>
      </div>
      <p>${escapeHtml(message.content || message.message || "")}</p>
    </article>
  `;
}

function closeChatSocket() {
  if (state.chatSocket) {
    try {
      state.chatSocket.close();
    } catch (_error) {
      // Ignore close errors while navigating.
    }
    state.chatSocket = null;
  }

  if (state.chatPollInterval) {
    clearInterval(state.chatPollInterval);
    state.chatPollInterval = null;
  }
}

async function initResetPasswordPage() {
  const requestForm = document.getElementById("resetRequestForm");
  const resetForm = document.getElementById("resetPasswordForm");
  const notice = document.getElementById("resetNotice");
  const emailInput = document.getElementById("resetEmail");
  const tokenInput = document.getElementById("resetToken");
  const subtitle = document.getElementById("resetSubtitle");

  if (!requestForm || !resetForm || !notice || !emailInput || !tokenInput) return;

  const params = new URLSearchParams(window.location.search);
  const token = String(params.get("token") || "").trim();

  if (token) {
    tokenInput.value = token;
    requestForm.classList.add("hidden");
    resetForm.classList.remove("hidden");
    if (subtitle) {
      subtitle.textContent = "Choose a new password for your Trimly account.";
    }
  } else {
    requestForm.classList.remove("hidden");
    resetForm.classList.add("hidden");
  }

  requestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    notice.textContent = "";

    const email = String(emailInput.value || "").trim();
    const submitBtn = requestForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    try {
      const response = await forgotPassword(email);
      notice.textContent = response.message || "If an account exists for that email, a reset link has been sent.";
      notice.className = "notice success";
    } catch (error) {
      notice.textContent = error.message;
      notice.className = "notice error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send Reset Link";
    }
  });

  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    notice.textContent = "";

    const form = new FormData(resetForm);
    const resetToken = String(form.get("token") || "").trim();
    const newPassword = String(form.get("new_password") || "");
    const confirmPassword = String(form.get("confirm_password") || "");

    if (!resetToken) {
      notice.textContent = "Reset token is missing. Open the link from your email again.";
      notice.className = "notice error";
      return;
    }

    if (!newPassword || newPassword !== confirmPassword) {
      notice.textContent = "Passwords do not match.";
      notice.className = "notice error";
      return;
    }

    const submitBtn = resetForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Resetting...";

    try {
      await resetPassword(resetToken, newPassword);
      notice.textContent = "Password reset successful. Redirecting to login...";
      notice.className = "notice success";
      setTimeout(() => {
        window.location.href = "/static/login.html";
      }, 900);
    } catch (error) {
      notice.textContent = error.message;
      notice.className = "notice error";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Reset Password";
    }
  });
}

async function initPaymentStatusPage() {
  const token = getToken();
  if (!token) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/static/login.html?next=${next}`;
    return;
  }

  const title = document.getElementById("paymentStatusTitle");
  const copy = document.getElementById("paymentStatusCopy");
  const actions = document.getElementById("paymentStatusActions");
  if (!title || !copy || !actions) return;

  const params = new URLSearchParams(window.location.search);
  const reference = String(params.get("reference") || params.get("trxref") || "").trim();
  const bookingId = Number(params.get("booking") || 0);
  const barberId = Number(params.get("barber") || 0);

  if (!reference) {
    title.textContent = "Payment reference missing";
    copy.textContent = "We could not verify this payment. Please return to your dashboard and try again.";
    actions.innerHTML = `<a class="btn btn-primary" href="/static/dashboard.html">Back to Dashboard</a>`;
    return;
  }

  title.textContent = "Verifying payment...";
  copy.textContent = "Please wait while we confirm your Paystack payment.";
  actions.innerHTML = `<a class="btn btn-ghost" href="/static/dashboard.html">Back to Dashboard</a>`;

  try {
    await verifyPayment(reference);
    title.textContent = "Payment successful";
    copy.textContent = "Your appointment has been paid for and secured successfully.";
    actions.innerHTML = `
      <a class="btn btn-primary" href="/static/dashboard.html">View Dashboard</a>
      <a class="btn btn-ghost" href="/static/booking.html?barber=${barberId || ""}&booking=${bookingId || ""}">Open Booking</a>
    `;
  } catch (error) {
    let confirmedViaBooking = false;

    if (bookingId) {
      try {
        const bookings = await getBookings();
        const booking = Array.isArray(bookings)
          ? bookings.find((item) => Number(item.id) === bookingId)
          : null;
        const paymentStatus = String(booking?.payment_status || "").toLowerCase();
        const bookingStatus = String(booking?.status || "").toLowerCase();
        confirmedViaBooking =
          paymentStatus === "paid" ||
          bookingStatus === "paid" ||
          bookingStatus === "completed";
      } catch (_bookingLookupError) {
        confirmedViaBooking = false;
      }
    }

    if (confirmedViaBooking) {
      title.textContent = "Payment successful";
      copy.textContent =
        "Your payment went through successfully. We confirmed it from your booking status.";
      actions.innerHTML = `
        <a class="btn btn-primary" href="/static/dashboard.html">View Dashboard</a>
        <a class="btn btn-ghost" href="/static/booking.html?barber=${barberId || ""}&booking=${bookingId || ""}">Open Booking</a>
      `;
      return;
    }

    title.textContent = "Payment not confirmed";
    copy.textContent = error.message || "We could not confirm your payment yet.";
    actions.innerHTML = `
      <a class="btn btn-primary" href="/static/dashboard.html">Back to Dashboard</a>
      <a class="btn btn-ghost" href="/static/booking.html?barber=${barberId || ""}&booking=${bookingId || ""}">Return to Booking</a>
    `;
  }
}

async function initFavoritesPage() {
  const grid = document.getElementById("favoritesGrid");
  const emptyState = document.getElementById("favoritesEmptyState");
  if (!grid || !emptyState) return;

  const favoriteIds = getFavoriteIds();
  if (!favoriteIds.length) {
    emptyState.classList.remove("hidden");
    grid.innerHTML = "";
    return;
  }

  grid.innerHTML = `<div class="loading">Loading saved barbers...</div>`;
  try {
    const barbers = await getBarbers({});
    const mapped = barbers
      .map((item, index) => mapBarber(item, index))
      .filter((barber) => favoriteIds.includes(Number(barber.id)));

    if (!mapped.length) {
      emptyState.classList.remove("hidden");
      grid.innerHTML = "";
      saveFavoriteIds([]);
      return;
    }

    emptyState.classList.add("hidden");
    grid.innerHTML = mapped.map((barber) => barberCardTemplate(barber, "Book Now")).join("");
    bindFavoriteButtons(grid);
  } catch (error) {
    grid.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function initMessagesPage() {
  const token = getToken();
  if (!token) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/static/login.html?next=${next}`;
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const bookingId = Number(params.get("booking") || 0);
  const header = document.getElementById("messagesHeading");
  const subtitle = document.getElementById("messagesSubtitle");
  const list = document.getElementById("messagesList");
  const form = document.getElementById("messageComposerForm");
  const input = document.getElementById("messageInput");
  const notice = document.getElementById("messageNotice");

  if (!bookingId || !header || !subtitle || !list || !form || !input || !notice) {
    return;
  }

  closeChatSocket();
  if (state.chatPollInterval) {
    clearInterval(state.chatPollInterval);
    state.chatPollInterval = null;
  }

  try {
    const me = await getCurrentUser();
    state.currentRole = normalizeRole(me.role);
    state.currentEmail = me.logged_in_as || state.currentEmail;
    state.currentUserId = 0;

    const bookings = await getBookings();
    const booking = bookings.find((item) => Number(item.id) === bookingId);
    if (!booking) {
      throw new Error("Booking chat not found");
    }

    const statusValue = String(booking.status || "pending").toLowerCase();
    if (statusValue !== "approved") {
      throw new Error("Chat is only available for approved bookings.");
    }

    state.currentUserId = state.currentRole === "barber"
      ? Number(booking.barber_user_id || 0)
      : Number(booking.customer_id || 0);
    state.chatReceiverId = state.currentRole === "barber"
      ? Number(booking.customer_id || 0)
      : Number(booking.barber_user_id || 0);

    const counterpart = state.currentRole === "barber"
      ? booking.customer_name || booking.customer_email || `Customer #${booking.customer_id}`
      : booking.barber_name || `Barber #${booking.barber_id}`;

    header.textContent = `Booking Chat #${bookingId}`;
    subtitle.textContent = `Chat with ${counterpart} about ${booking.service_name || "Haircut"}.`;

    await refreshChatMessages(bookingId, list);

    state.chatPollInterval = setInterval(() => {
      refreshChatMessages(bookingId, list).catch(() => {
        // Keep polling quiet; the notice handles visible errors during send.
      });
    }, 3000);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = String(input.value || "").trim();
      if (!text) return;

      const submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      const draft = text;
      input.value = "";

      try {
        await sendBookingMessage(bookingId, draft, state.chatReceiverId || null);
        notice.textContent = "";
        notice.className = "notice";
        try {
          await refreshChatMessages(bookingId, list);
        } catch (_refreshError) {
          notice.textContent = "Message sent. Updating the thread...";
          notice.className = "notice";
        }
      } catch (error) {
        input.value = draft;
        notice.textContent = error.message;
        notice.className = "notice error";
      } finally {
        submitBtn.disabled = false;
      }
    });
  } catch (error) {
    list.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    notice.textContent = error.message;
    notice.className = "notice error";
  }
}

async function refreshChatMessages(bookingId, list) {
  const messages = await getBookingMessages(bookingId);
  if (!messages.length) {
    list.innerHTML = `
      <div class="chat-empty-state">
        <strong>Start conversation with your barber</strong>
        <p class="muted">Messages for this booking will appear here once the chat begins.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = messages.map(renderChatBubble).join("");
  list.scrollTop = list.scrollHeight;
}


























