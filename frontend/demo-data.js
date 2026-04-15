const DEMO_FLAG_KEY = "trimly_demo";
const DEMO_ROLE_KEY = "trimly_demo_role";
const DEMO_STORE_KEY = "trimly_demo_store_v1";

const clone = (v) => JSON.parse(JSON.stringify(v));
const nowIso = () => new Date().toISOString();
function isoAt(offset, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + Number(offset || 0));
  d.setHours(Number(hour || 0), Number(minute || 0), 0, 0);
  return d.toISOString();
}
function dataUri(label, start = "#2f7d5c", end = "#c9a96b") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="${start}"/><stop offset="100%" stop-color="${end}"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><circle cx="980" cy="120" r="160" fill="rgba(255,255,255,0.16)"/><circle cx="180" cy="760" r="220" fill="rgba(255,255,255,0.1)"/><text x="90" y="760" fill="rgba(255,255,255,0.9)" font-family="Arial, sans-serif" font-size="92" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildBaseStore() {
  const barbers = [
    { id: 11, owner_user_id: 601, barber_name: "Kolawole Joseph", shop_name: "Trimly Studio Lekki", location: "Lekki Phase 1, Lagos", bio: "Clean fades, beard sculpting, and premium home-service grooming.", haircut_price: 10000, beard_trim_price: 6500, other_services: "Kids Cut, Dye Touch-up", average_rating: 4.9, review_count: 32, hidden_review_count: 0, is_available: true, available_days: ["monday","tuesday","wednesday","thursday","friday","saturday"], available_start_time: "09:00", available_end_time: "20:00", kyc_status: "verified", profile_image_url: dataUri("KJ", "#244236", "#79c29a"), cover_image_url: dataUri("Trimly Studio", "#244236", "#c9a96b"), portfolio_image_urls: [dataUri("Skin Fade", "#244236", "#9ad7b3"), dataUri("Beard Sculpt", "#3b7e63", "#d6b67d"), dataUri("Home Service", "#355d4d", "#caa767")], services: [{ id: 301, name: "Skin Fade", price: 10000, is_home_service: false, is_active: true }, { id: 302, name: "Beard Sculpt", price: 6500, is_home_service: false, is_active: true }, { id: 303, name: "Home Service Premium", price: 18000, is_home_service: true, is_active: true }] },
    { id: 12, owner_user_id: 0, barber_name: "Femi Oladipo", shop_name: "Mainland Fade House", location: "Yaba, Lagos", bio: "Sharp cuts and student-friendly pricing.", haircut_price: 7500, beard_trim_price: 4000, other_services: "Waves Treatment", average_rating: 4.7, review_count: 18, hidden_review_count: 0, is_available: true, available_days: ["monday","wednesday","thursday","friday","saturday"], available_start_time: "10:00", available_end_time: "19:00", kyc_status: "verified", profile_image_url: dataUri("FO", "#25453b", "#8dd0aa"), cover_image_url: dataUri("Mainland Fade", "#25453b", "#d3b47a"), portfolio_image_urls: [dataUri("Waves", "#274e41", "#dfc48a")], services: [{ id: 304, name: "Low Cut Refresh", price: 7500, is_home_service: false, is_active: true }, { id: 305, name: "Waves Treatment", price: 9000, is_home_service: false, is_active: true }] },
    { id: 13, owner_user_id: 0, barber_name: "Ijeoma Nnaji", shop_name: "Nnaji Grooming Lounge", location: "GRA, Port Harcourt", bio: "Premium grooming with calm studio service.", haircut_price: 12000, beard_trim_price: 5000, other_services: "Loc Retwist", average_rating: 4.8, review_count: 21, hidden_review_count: 0, is_available: true, available_days: ["tuesday","wednesday","thursday","friday","saturday"], available_start_time: "11:00", available_end_time: "20:00", kyc_status: "verified", profile_image_url: dataUri("IN", "#26463d", "#8fc6ac"), cover_image_url: dataUri("Grooming Lounge", "#26463d", "#cfac6a"), portfolio_image_urls: [dataUri("Loc Retwist", "#335d4f", "#e0c28a")], services: [{ id: 306, name: "Signature Cut", price: 12000, is_home_service: false, is_active: true }, { id: 307, name: "Loc Retwist", price: 15000, is_home_service: false, is_active: true }] },
    { id: 14, owner_user_id: 0, barber_name: "Tunde Balogun", shop_name: "Island Clippers", location: "Chevron, Lagos", bio: "House calls and premium grooming tailored for busy schedules.", haircut_price: 9500, beard_trim_price: 4500, other_services: "Home Service, Dye", average_rating: 4.6, review_count: 12, hidden_review_count: 0, is_available: true, available_days: ["monday","tuesday","friday","saturday","sunday"], available_start_time: "09:30", available_end_time: "18:30", kyc_status: "verified", profile_image_url: dataUri("TB", "#2a4b40", "#92caac"), cover_image_url: dataUri("Island Clippers", "#2a4b40", "#d0ab68"), portfolio_image_urls: [dataUri("House Calls", "#305649", "#debd80")], services: [{ id: 308, name: "Classic Fade", price: 9500, is_home_service: false, is_active: true }, { id: 309, name: "Executive Home Visit", price: 16000, is_home_service: true, is_active: true }] },
  ];

  const bookings = [
    { id: 201, barber_id: 11, barber_user_id: 601, barber_name: "Trimly Studio Lekki", barber_location: "Lekki Phase 1, Lagos", customer_id: 501, customer_name: "Amaka Nwosu", customer_email: "amaka.nwosu@trimly.demo", scheduled_time: isoAt(1, 16, 30), service_name: "Home Service Premium, Beard Sculpt", selected_services: [{ id: 303, name: "Home Service Premium", price: 18000, is_home_service: true }, { id: 302, name: "Beard Sculpt", price: 6500, is_home_service: false }], price: 24500, status: "approved", payment_status: "unpaid", barber_earnings: 20825, barber_payout_amount: 20825, escrow_amount: 3675, payout_status: "pending", refund_requested: false, paid_at: null, created_at: isoAt(-1, 14, 10), updated_at: isoAt(-1, 16, 0) },
    { id: 202, barber_id: 12, barber_user_id: 0, barber_name: "Mainland Fade House", barber_location: "Yaba, Lagos", customer_id: 501, customer_name: "Amaka Nwosu", customer_email: "amaka.nwosu@trimly.demo", scheduled_time: isoAt(-4, 11, 0), service_name: "Low Cut Refresh", selected_services: [{ id: 304, name: "Low Cut Refresh", price: 7500, is_home_service: false }], price: 7500, status: "completed", payment_status: "paid", barber_earnings: 6375, barber_payout_amount: 6375, escrow_amount: 1125, payout_status: "released", refund_requested: false, paid_at: isoAt(-5, 18, 5), created_at: isoAt(-6, 9, 20), updated_at: isoAt(-4, 13, 15) },
    { id: 203, barber_id: 14, barber_user_id: 0, barber_name: "Island Clippers", barber_location: "Chevron, Lagos", customer_id: 501, customer_name: "Amaka Nwosu", customer_email: "amaka.nwosu@trimly.demo", scheduled_time: isoAt(-8, 15, 0), service_name: "Executive Home Visit", selected_services: [{ id: 309, name: "Executive Home Visit", price: 16000, is_home_service: true }], price: 16000, status: "cancelled", payment_status: "unpaid", barber_earnings: 0, barber_payout_amount: 0, escrow_amount: 0, payout_status: "cancelled", refund_requested: false, paid_at: null, created_at: isoAt(-10, 10, 0), updated_at: isoAt(-8, 10, 20) },
    { id: 204, barber_id: 13, barber_user_id: 0, barber_name: "Nnaji Grooming Lounge", barber_location: "GRA, Port Harcourt", customer_id: 501, customer_name: "Amaka Nwosu", customer_email: "amaka.nwosu@trimly.demo", scheduled_time: isoAt(3, 13, 0), service_name: "Signature Cut", selected_services: [{ id: 306, name: "Signature Cut", price: 12000, is_home_service: false }], price: 12000, status: "pending", payment_status: "unpaid", barber_earnings: 10200, barber_payout_amount: 10200, escrow_amount: 1800, payout_status: "pending", refund_requested: false, paid_at: null, created_at: isoAt(-1, 12, 40), updated_at: isoAt(-1, 12, 40) },
    { id: 205, barber_id: 11, barber_user_id: 601, barber_name: "Trimly Studio Lekki", barber_location: "Lekki Phase 1, Lagos", customer_id: 502, customer_name: "Tomi Adebayo", customer_email: "tomi.adebayo@trimly.demo", scheduled_time: isoAt(0, 11, 30), service_name: "Skin Fade", selected_services: [{ id: 301, name: "Skin Fade", price: 10000, is_home_service: false }], price: 10000, status: "pending", payment_status: "unpaid", barber_earnings: 8500, barber_payout_amount: 8500, escrow_amount: 1500, payout_status: "pending", refund_requested: false, paid_at: null, created_at: isoAt(0, 8, 45), updated_at: isoAt(0, 8, 45) },
    { id: 206, barber_id: 11, barber_user_id: 601, barber_name: "Trimly Studio Lekki", barber_location: "Lekki Phase 1, Lagos", customer_id: 503, customer_name: "Femi Oladipo", customer_email: "femi.oladipo@trimly.demo", scheduled_time: isoAt(0, 14, 0), service_name: "Home Service Premium", selected_services: [{ id: 303, name: "Home Service Premium", price: 18000, is_home_service: true }], price: 18000, status: "approved", payment_status: "unpaid", barber_earnings: 15300, barber_payout_amount: 15300, escrow_amount: 2700, payout_status: "pending", refund_requested: false, paid_at: null, created_at: isoAt(-1, 17, 30), updated_at: isoAt(0, 7, 10) },
    { id: 207, barber_id: 11, barber_user_id: 601, barber_name: "Trimly Studio Lekki", barber_location: "Lekki Phase 1, Lagos", customer_id: 504, customer_name: "Ijeoma Nnaji", customer_email: "ijeoma.nnaji@trimly.demo", scheduled_time: isoAt(-1, 16, 30), service_name: "Loc Retwist", selected_services: [{ id: 310, name: "Loc Retwist", price: 15000, is_home_service: false }], price: 15000, status: "completed", payment_status: "paid", barber_earnings: 12750, barber_payout_amount: 12750, escrow_amount: 2250, payout_status: "released", refund_requested: false, paid_at: isoAt(-2, 18, 0), created_at: isoAt(-3, 9, 0), updated_at: isoAt(-1, 19, 30) },
    { id: 208, barber_id: 11, barber_user_id: 601, barber_name: "Trimly Studio Lekki", barber_location: "Lekki Phase 1, Lagos", customer_id: 505, customer_name: "Oluwaseun Tijani", customer_email: "oluwaseun.tijani@trimly.demo", scheduled_time: isoAt(0, 17, 0), service_name: "Skin Fade, Beard Sculpt", selected_services: [{ id: 301, name: "Skin Fade", price: 10000, is_home_service: false }, { id: 302, name: "Beard Sculpt", price: 6500, is_home_service: false }], price: 16500, status: "paid", payment_status: "paid", barber_earnings: 14025, barber_payout_amount: 14025, escrow_amount: 2475, payout_status: "managed_by_paystack_split", refund_requested: false, paid_at: isoAt(0, 9, 10), created_at: isoAt(-2, 11, 0), updated_at: isoAt(0, 9, 10) },
  ];

  const reviews = [
    { id: 401, barber_id: 11, customer_name: "Adaeze Obi", service_name: "Skin Fade", rating: 5, review_text: "Clean fade, sharp lines, and very calm studio service.", is_visible: true, admin_note: "", created_at: isoAt(-6, 18, 30) },
    { id: 402, barber_id: 11, customer_name: "Tayo Roberts", service_name: "Home Service Premium", rating: 5, review_text: "Arrived on time and handled the home service professionally.", is_visible: true, admin_note: "", created_at: isoAt(-10, 20, 0) },
    { id: 403, barber_id: 12, customer_name: "Seyi Bello", service_name: "Low Cut Refresh", rating: 4, review_text: "Fast and affordable. Good value for the area.", is_visible: true, admin_note: "", created_at: isoAt(-7, 14, 0) },
  ];

  const notifications = [
    { id: 501, owner_user_id: 501, type: "booking_approved", title: "Booking approved", message: "Trimly Studio Lekki approved your home-service booking. You can pay now.", link: "/static/dashboard.html?booking=201&focus=payment", booking_id: 201, is_read: false, created_at: isoAt(0, 8, 55) },
    { id: 502, owner_user_id: 501, type: "chat_available", title: "Chat is ready", message: "You can now send your address and arrival notes for booking #201.", link: "/static/messages.html?booking=201", booking_id: 201, is_read: false, created_at: isoAt(0, 9, 5) },
    { id: 503, owner_user_id: 601, type: "booking_created", title: "New booking request", message: "Tomi Adebayo requested a Skin Fade for today at 11:30 AM.", link: "/static/dashboard.html?booking=205", booking_id: 205, is_read: false, created_at: isoAt(0, 8, 46) },
    { id: 504, owner_user_id: 601, type: "booking_paid", title: "Payment confirmed", message: "Oluwaseun Tijani paid for booking #208.", link: "/static/dashboard.html?booking=208&focus=payment", booking_id: 208, is_read: false, created_at: isoAt(0, 9, 12) },
    { id: 505, owner_user_id: 601, type: "chat_available", title: "Customer sent directions", message: "Amaka shared estate and parking instructions for booking #201.", link: "/static/messages.html?booking=201", booking_id: 201, is_read: true, created_at: isoAt(0, 9, 18) },
  ];

  const messages = [
    { id: 801, booking_id: 201, sender_user_id: 501, sender_role: "customer", sender_name: "Amaka Nwosu", receiver_id: 601, content: "Hi, this is for the home service tomorrow. The house is inside Victory Park Estate, Chevron. Please use the second gate.", created_at: isoAt(0, 9, 10) },
    { id: 802, booking_id: 201, sender_user_id: 601, sender_role: "barber", sender_name: "Kolawole Joseph", receiver_id: 501, content: "Perfect, thank you. Is there a landmark close to your block and is parking easy once I get inside?", created_at: isoAt(0, 9, 14) },
    { id: 803, booking_id: 201, sender_user_id: 501, sender_role: "customer", sender_name: "Amaka Nwosu", receiver_id: 601, content: "Yes. After the second gate, take the road by the supermarket and stop at Block C7. There is guest parking right beside the generator house.", created_at: isoAt(0, 9, 18) },
  ];

  const disputes = [{ id: 901, booking_id: 203, owner_user_ids: [501], customer_id: 501, barber_id: 14, title: "Cancelled appointment", reason: "Customer requested refund review after a same-day cancellation.", status: "resolved", resolution_note: "No charge was made, so no refund was needed.", created_at: isoAt(-8, 16, 30), updated_at: isoAt(-7, 9, 15) }];
  const sessions = [
    { id: 701, owner_user_id: 501, session_type: "web", user_agent: "Chrome on Windows 11", last_seen_at: nowIso(), is_current: true, revoked_at: null },
    { id: 702, owner_user_id: 501, session_type: "web", user_agent: "Mobile Safari on iPhone", last_seen_at: isoAt(-1, 22, 20), is_current: false, revoked_at: null },
    { id: 703, owner_user_id: 601, session_type: "web", user_agent: "Chrome on Android", last_seen_at: nowIso(), is_current: true, revoked_at: null },
    { id: 704, owner_user_id: 601, session_type: "web", user_agent: "Chrome on macOS", last_seen_at: isoAt(-1, 18, 0), is_current: false, revoked_at: null },
  ];
  return { counters: { booking: 208, notification: 505, message: 803, service: 309, session: 704, dispute: 901 }, users: { customer: { id: 501, role: "customer", full_name: "Amaka Nwosu", email: "amaka.nwosu@trimly.demo", phone: "+234 801 555 0102", loyalty_points: 184, referral_code: "TRIM-AMAKA-24" }, barber: { id: 601, role: "barber", full_name: "Joseph Kolawole", email: "trimlydigitalgrooming@gmail.com", phone: "+234 803 111 0099", loyalty_points: 0, referral_code: "TRIM-JOSEPH-11" } }, referralSummary: { referrals_joined: 12, referrals_rewarded: 8 }, barbers, bookings, reviews, notifications, messages, disputes, sessions, barberKyc: { barber_user_id: 601, status: "verified", bvn_last4: "4421", submitted_at: isoAt(-30, 10, 0), verified_at: isoAt(-24, 12, 0) } };
}

function getStore() {
  const raw = localStorage.getItem(DEMO_STORE_KEY);
  if (!raw) { const fresh = buildBaseStore(); localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(fresh)); return fresh; }
  try { return JSON.parse(raw); } catch (_e) { const fresh = buildBaseStore(); localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(fresh)); return fresh; }
}
function saveStore(store) { localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store)); }
const getDemoRole = () => String(localStorage.getItem(DEMO_ROLE_KEY) || localStorage.getItem("trimly_role") || "").toLowerCase();
const getCurrentUserRecord = (store) => store.users[getDemoRole()] || null;
const getOwnedBarber = (store) => { const user = getCurrentUserRecord(store); return user ? store.barbers.find((b) => Number(b.owner_user_id) === Number(user.id)) || null : null; };
function createNotification(store, payload) { store.counters.notification += 1; store.notifications.unshift({ id: store.counters.notification, is_read: false, created_at: nowIso(), ...payload }); }
function readJsonBody(body) { if (!body) return {}; if (typeof body === "string") { try { return JSON.parse(body); } catch (_e) { return {}; } } if (body instanceof URLSearchParams) return Object.fromEntries(body.entries()); return {}; }
const getBarberByIdFromStore = (store, id) => store.barbers.find((b) => Number(b.id) === Number(id)) || null;
function computeCustomerInsights(store, userId) {
  const bookings = store.bookings.filter((b) => Number(b.customer_id) === Number(userId));
  return { total_appointments: bookings.length, completed_haircuts: bookings.filter((b) => String(b.status) === "completed").length, loyalty_points: Number(store.users.customer?.loyalty_points || 0) };
}
function computeBarberInsights(store, barberId) {
  const bookings = store.bookings.filter((b) => Number(b.barber_id) === Number(barberId));
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const completed = bookings.filter((b) => String(b.status) === "completed");
  const reviews = store.reviews.filter((r) => Number(r.barber_id) === Number(barberId));
  return { today_earnings: completed.filter((b) => String(b.scheduled_time || "").slice(0, 10) === today).reduce((s, b) => s + Number(b.barber_earnings || 0), 0), weekly_earnings: completed.filter((b) => new Date(b.scheduled_time) >= weekAgo).reduce((s, b) => s + Number(b.barber_earnings || 0), 0), awaiting_payout_review: bookings.filter((b) => String(b.status) === "paid").reduce((s, b) => s + Number(b.barber_payout_amount || 0), 0), completed_jobs: completed.length, total_bookings: bookings.length, pending_requests: bookings.filter((b) => String(b.status) === "pending").length, average_rating: reviews.length ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length : 0, review_count: reviews.length };
}
const currentUserResponse = (user) => user ? { id: user.id, role: user.role, full_name: user.full_name, phone: user.phone, logged_in_as: user.email, loyalty_points: user.loyalty_points, referral_code: user.referral_code } : null;
const sortByNewest = (items) => [...items].sort((a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0));
function filterBarbers(store, params) {
  const location = String(params.get("location") || "").toLowerCase();
  const minPrice = Number(params.get("min_price") || 0);
  const maxPrice = Number(params.get("max_price") || 0);
  const available = params.get("available");
  return store.barbers.filter((barber) => (!location || String(barber.location || "").toLowerCase().includes(location)) && (!minPrice || Number(barber.haircut_price || 0) >= minPrice) && (!maxPrice || Number(barber.haircut_price || 0) <= maxPrice) && !(available === "true" && !barber.is_available));
}
function buildAvailabilityForDate(barber, dateValue) {
  const safeDate = dateValue || new Date().toISOString().slice(0, 10);
  const [startHour] = String(barber.available_start_time || "09:00").split(":").map(Number);
  return [0, 2, 4, 6].map((step) => { const d = new Date(`${safeDate}T00:00:00`); d.setHours(startHour + step, 0, 0, 0); return d.toISOString(); });
}
const matchPath = (pathname, pattern) => pathname.match(pattern) || null;

export function isDemoMode() { return localStorage.getItem(DEMO_FLAG_KEY) === "true"; }
export function getDemoSessionInfo() {
  if (!isDemoMode()) return { active: false, role: "", email: "" };
  const store = getStore(); const user = getCurrentUserRecord(store); const role = getDemoRole();
  return { active: true, role, email: user?.email || "", label: role === "barber" ? "Barber Demo" : "Customer Demo" };
}
export function enterDemoMode(role = "customer") {
  const normalizedRole = role === "barber" ? "barber" : "customer";
  const store = buildBaseStore();
  localStorage.setItem(DEMO_FLAG_KEY, "true");
  localStorage.setItem(DEMO_ROLE_KEY, normalizedRole);
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
  localStorage.setItem("trimly_token", `demo-token-${normalizedRole}`);
  localStorage.setItem("trimly_role", normalizedRole);
  localStorage.setItem("trimly_email", store.users[normalizedRole].email);
  if (normalizedRole === "customer") localStorage.setItem("favourites", JSON.stringify([11, 13]));
}
export function clearDemoSession() {
  localStorage.removeItem(DEMO_FLAG_KEY); localStorage.removeItem(DEMO_ROLE_KEY); localStorage.removeItem(DEMO_STORE_KEY); localStorage.removeItem("favourites");
}

export async function demoApiFetch(path, options = {}, needsAuth = false) {
  if (!isDemoMode()) throw new Error("Demo mode is not active.");
  const url = new URL(path, "https://demo.trimly.local");
  const pathname = url.pathname;
  const method = String(options.method || "GET").toUpperCase();
  const store = getStore();
  const currentUser = getCurrentUserRecord(store);
  const ownedBarber = getOwnedBarber(store);
  if (needsAuth && !currentUser) throw new Error("Demo session expired. Start demo mode again.");

  if (pathname === "/me" && method === "GET") return clone(currentUserResponse(currentUser));
  if (pathname === "/me/customer-insights" && method === "GET") return clone(computeCustomerInsights(store, currentUser?.id));
  if (pathname === "/barber/analytics" && method === "GET") return clone(computeBarberInsights(store, ownedBarber?.id));
  if (pathname === "/me/referrals" && method === "GET") return clone({ referral_code: currentUser?.referral_code || "", loyalty_points: currentUser?.loyalty_points || 0, ...store.referralSummary });
  if (pathname === "/me/sessions" && method === "GET") return clone({ items: sortByNewest(store.sessions.filter((s) => Number(s.owner_user_id) === Number(currentUser?.id))) });
  let match = matchPath(pathname, /^\/me\/sessions\/(\d+)\/revoke$/);
  if (match && method === "POST") { const session = store.sessions.find((s) => Number(s.id) === Number(match[1]) && Number(s.owner_user_id) === Number(currentUser?.id)); if (!session) throw new Error("Session not found."); session.revoked_at = nowIso(); saveStore(store); return clone({ success: true }); }
  if (pathname === "/me/sessions/revoke-others" && method === "POST") { store.sessions.forEach((s) => { if (Number(s.owner_user_id) === Number(currentUser?.id) && !s.is_current) s.revoked_at = nowIso(); }); saveStore(store); return clone({ success: true }); }
  if (pathname === "/me/profile" && method === "PATCH") { const payload = readJsonBody(options.body); currentUser.full_name = String(payload.full_name || currentUser.full_name || "").trim() || currentUser.full_name; currentUser.phone = String(payload.phone || "").trim() || currentUser.phone; if (getDemoRole() === "barber" && ownedBarber) ownedBarber.barber_name = currentUser.full_name; saveStore(store); localStorage.setItem("trimly_email", currentUser.email); return clone(currentUserResponse(currentUser)); }
  if (pathname === "/me/change-password" && method === "POST") return clone({ message: "Demo password updated successfully." });
  if (pathname === "/barbers" && method === "GET") return clone(filterBarbers(store, url.searchParams));
  match = matchPath(pathname, /^\/barbers\/(\d+)$/);
  if (match && method === "GET") { const barber = getBarberByIdFromStore(store, match[1]); if (!barber) throw new Error("Barber not found."); return clone(barber); }
  match = matchPath(pathname, /^\/barbers\/(\d+)\/reviews$/);
  if (match && method === "GET") { const barberId = Number(match[1]); const items = store.reviews.filter((r) => Number(r.barber_id) === barberId); const average = items.length ? items.reduce((s, r) => s + Number(r.rating || 0), 0) / items.length : 0; return clone({ items, average_rating: average, review_count: items.length }); }
  if (pathname === "/barber/profile/me" && method === "GET") { if (!ownedBarber) throw new Error("Barber profile not found."); return clone(ownedBarber); }
  if (pathname === "/barber/profile" && method === "PATCH") { if (!ownedBarber) throw new Error("Barber profile not found."); Object.assign(ownedBarber, readJsonBody(options.body)); saveStore(store); return clone(ownedBarber); }
  if (pathname === "/barber/profile/upload-image" && method === "POST") return clone({ url: dataUri("Trimly Upload", "#315749", "#d3b47a") });
  if (pathname === "/barber/kyc/me" && method === "GET") return clone(store.barberKyc);
  if (pathname === "/barber/kyc/submit" && method === "POST") { const payload = readJsonBody(options.body); store.barberKyc = { ...store.barberKyc, ...payload, status: "pending", submitted_at: nowIso(), verified_at: null }; if (ownedBarber) ownedBarber.kyc_status = "pending"; saveStore(store); return clone(store.barberKyc); }
  if (pathname === "/barber/profile/availability" && method === "PATCH") { if (!ownedBarber) throw new Error("Barber profile not found."); const payload = readJsonBody(options.body); ownedBarber.available_days = Array.isArray(payload.available_days) ? payload.available_days : ownedBarber.available_days; ownedBarber.available_start_time = payload.available_start_time || ownedBarber.available_start_time; ownedBarber.available_end_time = payload.available_end_time || ownedBarber.available_end_time; saveStore(store); return clone(ownedBarber); }
  if (pathname === "/barber/profile/status" && method === "PATCH") { if (!ownedBarber) throw new Error("Barber profile not found."); ownedBarber.is_available = Boolean(readJsonBody(options.body).is_available); saveStore(store); return clone(ownedBarber); }
  if (pathname === "/barber/services" && method === "GET") return clone(Array.isArray(ownedBarber?.services) ? ownedBarber.services : []);
  if (pathname === "/barber/services" && method === "POST") { if (!ownedBarber) throw new Error("Barber profile not found."); const payload = readJsonBody(options.body); store.counters.service += 1; const service = { id: store.counters.service, name: String(payload.name || "New Service").trim(), price: Number(payload.price || 0), is_home_service: Boolean(payload.is_home_service), is_active: payload.is_active !== false }; ownedBarber.services.push(service); saveStore(store); return clone(service); }
  match = matchPath(pathname, /^\/barber\/services\/(\d+)$/);
  if (match && method === "PATCH") { if (!ownedBarber) throw new Error("Barber profile not found."); const service = ownedBarber.services.find((s) => Number(s.id) === Number(match[1])); if (!service) throw new Error("Service not found."); Object.assign(service, readJsonBody(options.body)); saveStore(store); return clone(service); }
  if (match && method === "DELETE") { if (!ownedBarber) throw new Error("Barber profile not found."); ownedBarber.services = ownedBarber.services.map((s) => Number(s.id) === Number(match[1]) ? { ...s, is_active: false } : s); saveStore(store); return clone({ success: true }); }
  match = matchPath(pathname, /^\/barber\/(\d+)\/availability$/);
  if (match && method === "GET") { const barber = getBarberByIdFromStore(store, match[1]); if (!barber) throw new Error("Barber not found."); return clone(buildAvailabilityForDate(barber, url.searchParams.get("date"))); }
  if (pathname === "/bookings" && method === "GET") { const items = store.bookings.filter((b) => getDemoRole() === "barber" ? Number(b.barber_user_id) === Number(currentUser?.id) : Number(b.customer_id) === Number(currentUser?.id)); return clone(sortByNewest(items)); }
  if (pathname === "/bookings" && method === "POST") { if (getDemoRole() !== "customer") throw new Error("Only customers can create demo bookings."); const payload = readJsonBody(options.body); const barber = getBarberByIdFromStore(store, payload.barber_id); if (!barber) throw new Error("Barber not found."); store.counters.booking += 1; const selected = Array.isArray(barber.services) ? barber.services.filter((s) => (payload.service_ids || []).map(Number).includes(Number(s.id))) : []; const total = selected.length ? selected.reduce((sum, s) => sum + Number(s.price || 0), 0) : Number(barber.haircut_price || 0); const booking = { id: store.counters.booking, barber_id: Number(barber.id), barber_user_id: Number(barber.owner_user_id || 0), barber_name: barber.shop_name, barber_location: barber.location, customer_id: Number(currentUser.id), customer_name: currentUser.full_name, customer_email: currentUser.email, scheduled_time: payload.scheduled_time || isoAt(2, 15, 0), service_name: String(payload.service_name || "Haircut"), selected_services: selected.map((s) => ({ id: s.id, name: s.name, price: s.price, is_home_service: s.is_home_service })), price: total, status: "pending", payment_status: "unpaid", barber_earnings: Math.round(total * 0.85), barber_payout_amount: Math.round(total * 0.85), escrow_amount: Math.round(total * 0.15), payout_status: "pending", refund_requested: false, paid_at: null, created_at: nowIso(), updated_at: nowIso() }; store.bookings.unshift(booking); createNotification(store, { owner_user_id: Number(barber.owner_user_id || 0), type: "booking_created", title: "New booking request", message: `${currentUser.full_name} requested ${booking.service_name}.`, link: `/static/dashboard.html?booking=${booking.id}`, booking_id: booking.id }); saveStore(store); return clone(booking); }
  match = matchPath(pathname, /^\/bookings\/(\d+)\/cancel$/);
  if (match && method === "POST") { const booking = store.bookings.find((b) => Number(b.id) === Number(match[1])); if (!booking) throw new Error("Booking not found."); booking.status = "cancelled"; booking.updated_at = nowIso(); saveStore(store); return clone(booking); }
  match = matchPath(pathname, /^\/bookings\/(\d+)\/pay$/);
  if (match && method === "POST") { const booking = store.bookings.find((b) => Number(b.id) === Number(match[1])); if (!booking) throw new Error("Booking not found."); const reference = `demo-booking-${booking.id}-${Date.now()}`; booking.payment_reference = reference; booking.updated_at = nowIso(); saveStore(store); return clone({ authorization_url: `/static/payment-status.html?reference=${encodeURIComponent(reference)}&booking=${booking.id}&barber=${booking.barber_id}`, reference }); }
  match = matchPath(pathname, /^\/payment\/verify(?:-public)?\/(.+)$/);
  if (match && method === "GET") {
    const reference = decodeURIComponent(match[1]);
    const booking = store.bookings.find((b) => String(b.payment_reference || "") === reference);
    if (!booking) throw new Error("Demo payment reference not found.");
    booking.payment_status = "paid"; booking.status = "paid"; booking.paid_at = nowIso(); booking.updated_at = nowIso();
    createNotification(store, { owner_user_id: Number(booking.customer_id), type: "booking_paid", title: "Payment confirmed", message: `Your payment for booking #${booking.id} has been confirmed.`, link: `/static/dashboard.html?booking=${booking.id}&focus=payment`, booking_id: booking.id });
    createNotification(store, { owner_user_id: Number(booking.barber_user_id), type: "booking_paid", title: "Customer paid", message: `${booking.customer_name} paid for booking #${booking.id}.`, link: `/static/dashboard.html?booking=${booking.id}&focus=payment`, booking_id: booking.id });
    saveStore(store);
    return clone({ status: "success", reference });
  }
  if (pathname === "/notifications" && method === "GET") { const limit = Number(url.searchParams.get("limit") || 12); const items = sortByNewest(store.notifications.filter((n) => Number(n.owner_user_id) === Number(currentUser?.id))).slice(0, limit); return clone({ items, unread_count: items.filter((n) => !n.is_read).length }); }
  match = matchPath(pathname, /^\/notifications\/(\d+)\/read$/);
  if (match && method === "PATCH") { const item = store.notifications.find((n) => Number(n.id) === Number(match[1]) && Number(n.owner_user_id) === Number(currentUser?.id)); if (!item) throw new Error("Notification not found."); item.is_read = true; saveStore(store); return clone(item); }
  if (pathname === "/notifications/read-all" && method === "PATCH") { store.notifications.forEach((n) => { if (Number(n.owner_user_id) === Number(currentUser?.id)) n.is_read = true; }); saveStore(store); return clone({ success: true }); }
  match = matchPath(pathname, /^\/notifications\/(\d+)$/);
  if (match && method === "DELETE") { store.notifications = store.notifications.filter((n) => !(Number(n.id) === Number(match[1]) && Number(n.owner_user_id) === Number(currentUser?.id))); saveStore(store); return clone({ success: true }); }
  match = matchPath(pathname, /^\/bookings\/(\d+)\/review$/);
  if (match && method === "POST") return clone({ success: true });
  if (pathname === "/disputes/my" && method === "GET") return clone(store.disputes.filter((d) => Array.isArray(d.owner_user_ids) && d.owner_user_ids.includes(Number(currentUser?.id))));
  if (pathname === "/disputes" && method === "POST") { const payload = readJsonBody(options.body); store.counters.dispute += 1; const dispute = { id: store.counters.dispute, booking_id: Number(payload.booking_id || 0), owner_user_ids: [Number(currentUser?.id)], customer_id: Number(currentUser?.id), barber_id: Number(payload.barber_id || 0), title: "Payment or booking concern", reason: String(payload.reason || payload.message || "Customer raised a booking concern."), status: "open", resolution_note: "", created_at: nowIso(), updated_at: nowIso() }; store.disputes.unshift(dispute); saveStore(store); return clone(dispute); }
  match = matchPath(pathname, /^\/bookings\/(\d+)\/status$/);
  if (match && method === "PATCH") { const booking = store.bookings.find((b) => Number(b.id) === Number(match[1])); if (!booking) throw new Error("Booking not found."); const newStatus = String(url.searchParams.get("new_status") || "").toLowerCase(); booking.status = newStatus || booking.status; booking.updated_at = nowIso(); if (["approved","accepted"].includes(booking.status)) createNotification(store, { owner_user_id: Number(booking.customer_id), type: "booking_approved", title: "Booking approved", message: `${booking.barber_name} approved booking #${booking.id}. You can pay now.`, link: `/static/dashboard.html?booking=${booking.id}&focus=payment`, booking_id: booking.id }); saveStore(store); return clone(booking); }
  match = matchPath(pathname, /^\/chat\/messages\/(\d+)$/);
  if (match && method === "GET") return clone(sortByNewest(store.messages.filter((m) => Number(m.booking_id) === Number(match[1]))).reverse());
  if (pathname === "/chat/send-message" && method === "POST") { const payload = readJsonBody(options.body); store.counters.message += 1; const message = { id: store.counters.message, booking_id: Number(payload.booking_id), sender_user_id: Number(currentUser?.id), sender_role: getDemoRole(), sender_name: currentUser?.full_name || "Trimly Demo", receiver_id: Number(payload.receiver_id || 0), content: String(payload.content || "").trim(), created_at: nowIso() }; store.messages.push(message); const booking = store.bookings.find((b) => Number(b.id) === Number(payload.booking_id)); if (booking && message.receiver_id) createNotification(store, { owner_user_id: message.receiver_id, type: "chat_available", title: "New chat message", message: `${currentUser?.full_name || "Trimly user"} sent a message about booking #${booking.id}.`, link: `/static/messages.html?booking=${booking.id}`, booking_id: booking.id }); saveStore(store); return clone(message); }
  if (pathname === "/policies/acceptable-use" && method === "GET") return clone({ title: "Trimly Acceptable Use Policy", content: "Demo mode uses sample content. In production, Trimly requires respectful conduct, lawful payments, and genuine booking activity." });
  if (pathname === "/barber/payout-report" && method === "GET") {
    const items = store.bookings
      .filter((b) => Number(b.barber_user_id) === Number(currentUser?.id))
      .map((b) => ({ booking_id: b.id, customer_name: b.customer_name, amount: b.price, commission_amount: b.escrow_amount, barber_payout_amount: b.barber_payout_amount, payment_status: b.payment_status, booking_status: b.status }));
    return clone({ total_barber_payout: items.reduce((sum, item) => sum + Number(item.barber_payout_amount || 0), 0), items });
  }
  match = matchPath(pathname, /^\/payments\/refund-request\/(\d+)$/);
  if (match && method === "POST") {
    const booking = store.bookings.find((b) => Number(b.id) === Number(match[1]));
    if (!booking) throw new Error("Booking not found.");
    booking.refund_requested = true;
    booking.updated_at = nowIso();
    saveStore(store);
    return clone({ success: true });
  }
  match = matchPath(pathname, /^\/admin\/bookings\/(\d+)\/mark-completed$/);
  if (match && method === "POST") {
    const booking = store.bookings.find((b) => Number(b.id) === Number(match[1]));
    if (!booking) throw new Error("Booking not found.");
    booking.status = "completed";
    booking.updated_at = nowIso();
    saveStore(store);
    return clone({ success: true });
  }
  throw new Error(`Demo mode is not wired for ${method} ${pathname} yet.`);
}
