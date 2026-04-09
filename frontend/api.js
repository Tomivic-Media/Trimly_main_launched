const API_BASE_URL =
  (typeof window !== "undefined" && window.__TRIMLY_API_BASE_URL) ||
  "https://api.trimly.com.ng";

function getToken() {
  return localStorage.getItem("trimly_token") || "";
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}, needsAuth = false) {
  const headers = {
    ...(options.headers || {}),
  };

  if (needsAuth) {
    Object.assign(headers, authHeaders());
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: options.credentials || "include",
    headers,
  });

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
  return apiFetch(`/barbers${toQuery(filters)}`, { method: "GET" });
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

async function getBarberAvailability(barberId, selectedDate = "") {
  return apiFetch(
    `/barber/${barberId}/availability${toQuery({ date: selectedDate })}`,
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
  adminRefundBooking,
};



