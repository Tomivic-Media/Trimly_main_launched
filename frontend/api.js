import {
  clearDemoSession,
  demoApiFetch,
  isDemoMode,
} from "./demo-data.js?v=20260708m2";

const API_BASE_URL =
  (typeof window !== "undefined" && window.__TRIMLY_API_BASE_URL) ||
  (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? window.location.origin
    : "https://api.trimly.com.ng");
const API_REQUEST_TIMEOUT_MS = 15000;

function uniqueApiBases(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function resolveApiBaseCandidates() {
  if (typeof window === "undefined") {
    return ["https://api.trimly.com.ng"];
  }

  const explicitBase = String(window.__TRIMLY_API_BASE_URL || "").trim();
  if (explicitBase) {
    return [explicitBase];
  }

  const hostname = String(window.location.hostname || "").toLowerCase();
  const origin = String(window.location.origin || "").trim();

  if (["localhost", "127.0.0.1"].includes(hostname)) {
    return [origin];
  }

  if (
    hostname === "trimly.com.ng" ||
    hostname === "www.trimly.com.ng" ||
    hostname === "app.trimly.com.ng" ||
    hostname === "api.trimly.com.ng" ||
    hostname.endsWith(".trimly.com.ng")
  ) {
    return uniqueApiBases([origin, "https://api.trimly.com.ng"]);
  }

  return ["https://api.trimly.com.ng"];
}

const API_BASE_CANDIDATES = resolveApiBaseCandidates();

function isHtmlLikeResponse(response) {
  const contentType = String(response?.headers?.get?.("content-type") || "").toLowerCase();
  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
}

function shouldRetryAlternateApiBase(response, baseUrl, needsAuth = false) {
  if (API_BASE_CANDIDATES.length < 2) return false;
  if (typeof window === "undefined") return false;

  const normalizedBase = String(baseUrl || "").replace(/\/+$/, "");
  const currentOrigin = String(window.location.origin || "").replace(/\/+$/, "");
  if (!normalizedBase || normalizedBase !== currentOrigin) return false;

  if (response?.ok && isHtmlLikeResponse(response)) {
    return true;
  }

  if (![404, 405, 501, 502, 503, 504].includes(Number(response?.status || 0))) {
    return false;
  }

  const contentType = String(response?.headers?.get?.("content-type") || "").toLowerCase();
  return isHtmlLikeResponse(response) || !contentType;
}

async function requestWithApiFallback(path, options = {}, needsAuth = false) {
  let lastError = null;

  for (const baseUrl of API_BASE_CANDIDATES) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}${path}`, options);
      if (shouldRetryAlternateApiBase(response, baseUrl, needsAuth)) {
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Trimly services are temporarily unavailable. Please try again shortly.");
}

function buildFallbackResponse(xhr) {
  const rawHeaders = xhr.getAllResponseHeaders ? xhr.getAllResponseHeaders() : "";
  const headerMap = new Map();
  rawHeaders
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex === -1) return;
      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();
      headerMap.set(key, value);
    });

  return {
    ok: xhr.status >= 200 && xhr.status < 300,
    status: xhr.status,
    statusText: xhr.statusText,
    headers: {
      get(name) {
        return headerMap.get(String(name || "").toLowerCase()) || null;
      },
    },
    async text() {
      return xhr.responseText || "";
    },
    async json() {
      return JSON.parse(xhr.responseText || "null");
    },
  };
}

function fetchWithXhr(url, options = {}, timeoutMs = API_REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest !== "function") {
      reject(new Error("Trimly services are temporarily unavailable. Please try again shortly."));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open(options.method || "GET", url, true);
    xhr.timeout = timeoutMs;
    xhr.withCredentials = options.credentials === "include";

    Object.entries(options.headers || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      xhr.setRequestHeader(key, value);
    });

    xhr.onload = () => resolve(buildFallbackResponse(xhr));
    xhr.onerror = () => reject(new TypeError("Network request failed"));
    xhr.ontimeout = () => {
      const timeoutError = new Error("Request timed out");
      timeoutError.name = "AbortError";
      reject(timeoutError);
    };

    xhr.send(options.body ?? null);
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_REQUEST_TIMEOUT_MS) {
  const runtimeFetch =
    typeof globalThis !== "undefined" && typeof globalThis.fetch === "function"
      ? globalThis.fetch.bind(globalThis)
      : null;

  if (!runtimeFetch) {
    try {
      return await fetchWithXhr(url, options, timeoutMs);
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Trimly is taking too long to respond right now. Please try again shortly.");
      }
      throw new Error("Trimly services are temporarily unavailable. Please try again shortly.");
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await runtimeFetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Trimly is taking too long to respond right now. Please try again shortly.");
    }
    if (error instanceof TypeError) {
      throw new Error("Trimly services are temporarily unavailable. Please try again shortly.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getToken() {
  return localStorage.getItem("trimly_token") || "";
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}, needsAuth = false) {
  if (isDemoMode()) {
    return demoApiFetch(path, options, needsAuth);
  }

  const headers = {
    ...(options.headers || {}),
  };

  if (needsAuth) {
    Object.assign(headers, authHeaders());
  }

  const requestOptions = {
    ...options,
    credentials: options.credentials || "include",
    headers,
  };

  const response = await requestWithApiFallback(path, requestOptions, needsAuth);

  let payload = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    payload = text ? { detail: text } : null;
  }

  if (!response.ok) {
    const detail =
      (payload && (payload.detail || payload.message)) ||
      `Request failed (${response.status})`;

    if (response.status === 401) {
      clearAuthSession();
      throw new Error("Session expired. Please log in again.");
    }

    throw new Error(detail);
  }

  return payload;
}

function setAuthSession(token, role = "", email = "") {
  localStorage.setItem("trimly_token", token);
  if (role) {
    localStorage.setItem("trimly_role", normalizeRole(role));
  }
  if (email) {
    localStorage.setItem("trimly_email", email);
  }
}

function clearAuthSession() {
  localStorage.removeItem("trimly_token");
  localStorage.removeItem("trimly_role");
  localStorage.removeItem("trimly_email");
  clearDemoSession();
}

function normalizeRole(value) {
  const roleValue = String(value || "").trim();
  if (!roleValue) return "";
  if (roleValue.includes(".")) {
    return roleValue.split(".").pop().toLowerCase();
  }
  return roleValue.toLowerCase();
}

function toQuery(params = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.append(key, String(value));
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

function getWebSocketUrl(path) {
  const base = API_BASE_URL.replace(/^http/, "ws");
  return `${base}${path}`;
}

async function registerUser(data) {
  return apiFetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

async function loginUser(email, password) {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);

  return apiFetch("/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

async function adminSessionLogin(email, password) {
  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);

  return apiFetch("/admin/session-login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    credentials: "include",
  });
}

async function adminSessionLogout() {
  return apiFetch("/admin/session-logout", {
    method: "POST",
    credentials: "include",
  });
}

async function forgotPassword(email) {
  return apiFetch("/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

async function resetPassword(token, newPassword) {
  return apiFetch("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      new_password: newPassword,
    }),
  });
}

async function getCurrentUser() {
  return apiFetch("/me", { method: "GET" }, true);
}

async function getCustomerInsights() {
  return apiFetch("/me/customer-insights", { method: "GET" }, true);
}

async function getBarberInsights() {
  return apiFetch("/barber/analytics", { method: "GET" }, true);
}

async function getReferralSummary() {
  return apiFetch("/me/referrals", { method: "GET" }, true);
}

async function getMySessions() {
  return apiFetch("/me/sessions", { method: "GET" }, true);
}

async function revokeSession(sessionId) {
  return apiFetch(`/me/sessions/${sessionId}/revoke`, { method: "POST" }, true);
}

async function revokeOtherSessions() {
  return apiFetch("/me/sessions/revoke-others", { method: "POST" }, true);
}

async function getBarberPayoutReport() {
  return apiFetch("/barber/payout-report", { method: "GET" }, true);
}

async function getAdminPayoutReport() {
  return apiFetch("/admin/payout-report", { method: "GET" }, true);
}

async function updateCurrentUserProfile(data) {
  return apiFetch(
    "/me/profile",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function getGoogleCalendarStatus() {
  return apiFetch("/integrations/google-calendar/status", { method: "GET" }, true);
}

async function startGoogleCalendarConnect() {
  return apiFetch("/integrations/google-calendar/connect", { method: "POST" }, true);
}

async function disconnectGoogleCalendar() {
  return apiFetch("/integrations/google-calendar/connection", { method: "DELETE" }, true);
}

async function changeCurrentUserPassword(data) {
  return apiFetch(
    "/me/change-password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function getBarbers(filters = {}) {
  const payload = await apiFetch(`/barbers${toQuery(filters)}`, { method: "GET" });
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }
  throw new Error("Trimly services are temporarily unavailable. Please try again shortly.");
}

async function getBarberById(barberId) {
  return apiFetch(`/barbers/${barberId}`, { method: "GET" });
}

async function getBarberReviews(barberId) {
  return apiFetch(`/barbers/${barberId}/reviews`, { method: "GET" });
}

async function createBarberProfile(data) {
  return apiFetch(
    "/barber/profile",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function getMyBarberProfile() {
  return apiFetch("/barber/profile/me", { method: "GET" }, true);
}

async function updateBarberProfile(data) {
  return apiFetch(
    "/barber/profile",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function uploadBarberImage(file) {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch(
    "/barber/profile/upload-image",
    {
      method: "POST",
      body: formData,
    },
    true
  );
}

async function getMyBarberKyc() {
  return apiFetch("/barber/kyc/me", { method: "GET" }, true);
}

async function submitBarberKyc(data) {
  return apiFetch(
    "/barber/kyc/submit",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function getAdminBarbers() {
  return apiFetch("/admin/barbers", { method: "GET" }, true);
}

async function getAdminReviews(filters = {}) {
  return apiFetch(`/admin/reviews${toQuery(filters)}`, { method: "GET" }, true);
}

async function moderateReview(reviewId, payload) {
  return apiFetch(
    `/admin/reviews/${reviewId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    true
  );
}

async function verifyBarberKyc(barberId, payload) {
  return apiFetch(
    `/admin/barbers/${barberId}/verify`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    true
  );
}

async function updateBarberAvailability(data) {
  return apiFetch(
    "/barber/profile/availability",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function updateBarberStatus(isAvailable) {
  return apiFetch(
    "/barber/profile/status",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_available: Boolean(isAvailable) }),
    },
    true
  );
}

async function getBarberServices() {
  return apiFetch("/barber/services", { method: "GET" }, true);
}

async function createBarberService(data) {
  return apiFetch(
    "/barber/services",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function updateBarberService(serviceId, data) {
  return apiFetch(
    `/barber/services/${serviceId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function deactivateBarberService(serviceId) {
  return apiFetch(`/barber/services/${serviceId}`, { method: "DELETE" }, true);
}

async function getBarberAvailability(barberId, selectedDate = "", durationMinutes = "") {
  return apiFetch(
    `/barber/${barberId}/availability${toQuery({ date: selectedDate, duration_minutes: durationMinutes })}`,
    { method: "GET" }
  );
}

async function createBooking(data) {
  return apiFetch(
    "/bookings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function createBookingReview(bookingId, data) {
  return apiFetch(
    `/bookings/${bookingId}/review`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function cancelBooking(bookingId) {
  return apiFetch(`/bookings/${bookingId}/cancel`, { method: "POST" }, true);
}

async function initializePayment(bookingId) {
  return apiFetch(`/bookings/${bookingId}/pay`, { method: "POST" }, true);
}

async function verifyPayment(reference) {
  return apiFetch(`/payment/verify/${encodeURIComponent(reference)}`, { method: "GET" }, true);
}

async function verifyPaymentPublic(reference) {
  return apiFetch(`/payment/verify-public/${encodeURIComponent(reference)}`, { method: "GET" });
}

async function getBookings() {
  return apiFetch("/bookings", { method: "GET" }, true);
}

async function getNotifications(limit = 12) {
  return apiFetch(`/notifications${toQuery({ limit })}`, { method: "GET" }, true);
}

async function markNotificationRead(notificationId) {
  return apiFetch(`/notifications/${notificationId}/read`, { method: "PATCH" }, true);
}

async function markAllNotificationsRead() {
  return apiFetch("/notifications/read-all", { method: "PATCH" }, true);
}

async function deleteNotification(notificationId) {
  return apiFetch(`/notifications/${notificationId}`, { method: "DELETE" }, true);
}

async function markBookingCompleted(bookingId) {
  return apiFetch(`/admin/bookings/${bookingId}/mark-completed`, { method: "POST" }, true);
}

async function releaseEscrow(bookingId) {
  return markBookingCompleted(bookingId);
}

async function requestRefund(bookingId) {
  return apiFetch(`/payments/refund-request/${bookingId}`, { method: "POST" }, true);
}

async function adminRefundBooking(bookingId) {
  return apiFetch(`/admin/payments/${bookingId}/refund`, { method: "POST" }, true);
}

async function createDispute(data) {
  return apiFetch(
    "/disputes",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function getMyDisputes() {
  return apiFetch("/disputes/my", { method: "GET" }, true);
}

async function resolveDispute(disputeId, payload) {
  return apiFetch(
    `/admin/disputes/${disputeId}/resolve`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    true
  );
}

async function getAcceptableUsePolicy() {
  return apiFetch("/policies/acceptable-use", { method: "GET" });
}

async function getAdminUsers() {
  return apiFetch("/super-admin/admin-users", { method: "GET" }, true);
}

async function createAdminUser(data) {
  return apiFetch(
    "/super-admin/admin-users",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
    true
  );
}

async function approveAdminUser(userId, approved) {
  return apiFetch(
    `/super-admin/admin-users/${userId}/approve`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    },
    true
  );
}

async function updateBookingStatus(bookingId, newStatus) {
  return apiFetch(
    `/bookings/${bookingId}/status${toQuery({ new_status: newStatus })}`,
    {
      method: "PATCH",
    },
    true
  );
}

async function getBookingMessages(bookingId) {
  return apiFetch(`/chat/messages/${bookingId}`, { method: "GET" }, true);
}

async function sendBookingMessage(bookingId, message, receiverId = null) {
  return apiFetch(
    `/chat/send-message`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: Number(bookingId), content: message, receiver_id: receiverId }),
    },
    true
  );
}

export {
  API_BASE_URL,
  adminSessionLogin,
  adminSessionLogout,
  clearAuthSession,
  createAdminUser,
  createDispute,
  createBarberProfile,
  createBooking,
  createBookingReview,
  cancelBooking,
  forgotPassword,
  getAcceptableUsePolicy,
  getAdminUsers,
  getAdminBarbers,
  getAdminPayoutReport,
  getAdminReviews,
  getBarberAvailability,
  getBarberById,
  getBarberInsights,
  getBarberPayoutReport,
  getBarberReviews,
  getBarberServices,
  getBarbers,
  getBookingMessages,
  getBookings,
  getCustomerInsights,
  getCurrentUser,
  getGoogleCalendarStatus,
  getMySessions,
  getNotifications,
  getMyBarberKyc,
  getMyDisputes,
  getMyBarberProfile,
  getReferralSummary,
  updateCurrentUserProfile,
  changeCurrentUserPassword,
  updateBarberProfile,
  createBarberService,
  updateBarberService,
  deactivateBarberService,
  uploadBarberImage,
  getToken,
  getWebSocketUrl,
  initializePayment,
  loginUser,
  markBookingCompleted,
  markAllNotificationsRead,
  deleteNotification,
  markNotificationRead,
  moderateReview,
  normalizeRole,
  approveAdminUser,
  releaseEscrow,
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
  verifyPaymentPublic,
  adminRefundBooking,
  startGoogleCalendarConnect,
  disconnectGoogleCalendar,
};






