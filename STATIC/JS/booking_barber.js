// Global variables
let bookings = [];
let services = [];
let currentTab = "all";
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedBooking = null;

// Initialize bookings page
function initBookings() {
  console.log("Initializing bookings...");

  // Initialize date
  document.getElementById("todayDate").textContent =
    new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  // Load data
  loadBookings();
  loadServices();
  setupEventListeners();
  setupCalendar();
  updateStats();
}

// Helper function to get initials
function getInitials(name) {
  if (!name || name === "Unknown Client" || typeof name !== "string") {
    return "??";
  }

  // Clean up the name (remove extra spaces)
  const cleanName = name.trim();
  if (cleanName.length === 0) return "??";

  // Split by spaces and get first letters
  const words = cleanName.split(" ").filter((word) => word.length > 0);

  if (words.length === 0) return "??";

  if (words.length === 1) {
    // Single word: take first 2 letters
    return words[0].substring(0, 2).toUpperCase();
  }

  // Multiple words: take first letter of first two words
  return (words[0][0] + words[1][0]).toUpperCase();
}

function loadBookings() {
  console.log("Loading bookings from localStorage...");

  try {
    const storedBookings = localStorage.getItem("bookings");
    console.log("Stored bookings:", storedBookings);

    if (storedBookings) {
      bookings = JSON.parse(storedBookings);
      console.log(`Parsed ${bookings.length} bookings from localStorage`);

      // Debug: log each booking
      bookings.forEach((booking, index) => {
        console.log(`Booking ${index + 1}:`, {
          id: booking.id,
          client: booking.client,
          initials: booking.clientInitials,
          service: booking.service,
          date: booking.date,
        });
      });
    } else {
      console.log("No bookings found in localStorage, creating sample data...");
      createSampleBookings();
    }
  } catch (error) {
    console.error("Error loading bookings:", error);
    console.log("Creating sample bookings due to error...");
    createSampleBookings();
  }

  // Ensure all bookings have required fields
  bookings.forEach((booking) => {
    // Ensure client name exists
    if (!booking.client || booking.client.trim() === "") {
      console.warn("Booking missing client name:", booking.id);
      booking.client = "Unknown Client";
    }

    // Ensure initials exist
    if (!booking.clientInitials || booking.clientInitials === "??") {
      booking.clientInitials = getInitials(booking.client);
    }

    // Ensure other required fields
    booking.service = booking.service || "Unknown Service";
    booking.phone = booking.phone || "No phone";
    booking.time = booking.time || "No time";
    booking.price = booking.price || 0;
    booking.status = booking.status || "pending";
    booking.date = booking.date || new Date().toISOString().split("T")[0];
    booking.notes = booking.notes || "";
  });

  updateBookingsTable();
  updateCalendar();
  updateStats();
}

function createSampleBookings() {
  console.log("Creating fresh sample bookings...");

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const todayStr = today.toISOString().split("T")[0];
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  bookings = [
    {
      id: 1,
      client: "John Doe",
      phone: "+1 (555) 123-4567",
      service: "Haircut & Beard Trim",
      date: todayStr,
      time: "10:00 AM",
      price: 8000,
      status: "confirmed",
      notes: "Regular customer, prefers fade on sides",
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      client: "Michael Smith",
      phone: "+1 (555) 987-6543",
      service: "Beard Trim Only",
      date: todayStr,
      time: "2:30 PM",
      price: 3000,
      status: "pending",
      notes: "First time customer",
      createdAt: new Date().toISOString(),
    },
    {
      id: 3,
      client: "Robert Johnson",
      phone: "+1 (555) 456-7890",
      service: "Full Service (Haircut, Beard, Shave)",
      date: tomorrowStr,
      time: "11:00 AM",
      price: 12000,
      status: "confirmed",
      notes: "Special occasion - wedding",
      createdAt: new Date().toISOString(),
    },
    {
      id: 4,
      client: "James Wilson",
      phone: "+1 (555) 234-5678",
      service: "Haircut",
      date: nextWeekStr,
      time: "3:00 PM",
      price: 5000,
      status: "completed",
      notes: "Completed successfully",
      createdAt: new Date().toISOString(),
    },
    {
      id: 5,
      client: "David Brown",
      phone: "+1 (555) 876-5432",
      service: "Kids Haircut",
      date: nextWeekStr,
      time: "4:30 PM",
      price: 4000,
      status: "cancelled",
      notes: "Client rescheduled",
      createdAt: new Date().toISOString(),
    },
  ];

  // Add initials to each booking
  bookings.forEach((booking) => {
    booking.clientInitials = getInitials(booking.client);
  });

  try {
    localStorage.setItem("bookings", JSON.stringify(bookings));
    console.log("Saved sample bookings to localStorage");
  } catch (error) {
    console.error("Error saving sample bookings:", error);
  }
}

function loadServices() {
  console.log("Loading services...");

  // Default services
  const defaultServices = [
    { name: "Haircut", price: 5000, duration: 30 },
    { name: "Beard Trim", price: 3000, duration: 15 },
    { name: "Haircut & Beard Trim", price: 7000, duration: 45 },
    { name: "Kids Haircut", price: 4000, duration: 25 },
    {
      name: "Full Service (Haircut, Beard, Shave)",
      price: 12000,
      duration: 60,
    },
  ];

  try {
    const storedData = localStorage.getItem("onboardingData");
    if (storedData) {
      const onboardingData = JSON.parse(storedData);
      services = onboardingData.services || defaultServices;
      console.log("Loaded services from localStorage");
    } else {
      services = defaultServices;
      // Save default services to localStorage
      localStorage.setItem(
        "onboardingData",
        JSON.stringify({
          services: defaultServices,
          availability: {
            days: [
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
            ],
            startTime: "09:00",
            endTime: "18:00",
          },
        })
      );
      console.log("Created default services and saved to localStorage");
    }
  } catch (error) {
    console.error("Error loading services:", error);
    services = defaultServices;
  }

  console.log(`Loaded ${services.length} services`);

  // Populate service dropdowns
  const serviceFilter = document.getElementById("serviceFilter");
  const bookingService = document.getElementById("bookingService");

  if (!serviceFilter || !bookingService) {
    console.error("Service dropdowns not found!");
    return;
  }

  // Clear existing options except the first one
  while (serviceFilter.options.length > 1) serviceFilter.remove(1);
  while (bookingService.options.length > 1) bookingService.remove(1);

  // Add "All Services" option to filter
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Services";
  serviceFilter.appendChild(allOption);

  services.forEach((service) => {
    if (!service.name) return;

    // Add to filter dropdown
    const filterOption = document.createElement("option");
    filterOption.value = service.name;
    filterOption.textContent = service.name;
    serviceFilter.appendChild(filterOption);

    // Add to booking form dropdown
    const bookingOption = document.createElement("option");
    bookingOption.value = service.name;
    bookingOption.textContent = `${service.name} - ₦${service.price || 0} (${
      service.duration || 0
    } min)`;
    bookingOption.dataset.price = service.price || 0;
    bookingOption.dataset.duration = service.duration || 0;
    bookingService.appendChild(bookingOption);
  });
}

function updateBookingsTable() {
  console.log("Updating bookings table...");
  const tbody = document.getElementById("bookingsTableBody");

  if (!tbody) {
    console.error("Bookings table body not found!");
    return;
  }

  tbody.innerHTML = "";

  let filteredBookings = [...bookings];

  // Apply tab filter
  const today = new Date().toISOString().split("T")[0];

  console.log(`Current tab: ${currentTab}, Today's date: ${today}`);
  console.log(`Total bookings: ${bookings.length}`);

  switch (currentTab) {
    case "today":
      filteredBookings = filteredBookings.filter((b) => b.date === today);
      console.log(`Today's bookings: ${filteredBookings.length}`);
      break;
    case "upcoming":
      filteredBookings = filteredBookings.filter(
        (b) => new Date(b.date) > new Date(today)
      );
      console.log(`Upcoming bookings: ${filteredBookings.length}`);
      break;
    case "pending":
      filteredBookings = filteredBookings.filter((b) => b.status === "pending");
      console.log(`Pending bookings: ${filteredBookings.length}`);
      break;
    case "confirmed":
      filteredBookings = filteredBookings.filter(
        (b) => b.status === "confirmed"
      );
      console.log(`Confirmed bookings: ${filteredBookings.length}`);
      break;
    case "completed":
      filteredBookings = filteredBookings.filter(
        (b) => b.status === "completed"
      );
      console.log(`Completed bookings: ${filteredBookings.length}`);
      break;
    case "cancelled":
      filteredBookings = filteredBookings.filter(
        (b) => b.status === "cancelled"
      );
      console.log(`Cancelled bookings: ${filteredBookings.length}`);
      break;
    default:
      console.log(`All bookings: ${filteredBookings.length}`);
  }

  // Apply other filters
  const dateFilter = document.getElementById("dateFilter")?.value || "all";
  const serviceFilter =
    document.getElementById("serviceFilter")?.value || "all";
  const statusFilter = document.getElementById("statusFilter")?.value || "all";
  const sortFilter =
    document.getElementById("sortFilter")?.value || "date-desc";

  if (dateFilter !== "all") {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    filteredBookings = filteredBookings.filter((booking) => {
      const bookingDate = new Date(booking.date);
      switch (dateFilter) {
        case "today":
          return booking.date === today;
        case "week":
          return bookingDate >= startOfWeek;
        case "month":
          return bookingDate >= startOfMonth;
        default:
          return true;
      }
    });
  }

  if (serviceFilter !== "all") {
    filteredBookings = filteredBookings.filter(
      (b) => b.service === serviceFilter
    );
  }

  if (statusFilter !== "all") {
    filteredBookings = filteredBookings.filter(
      (b) => b.status === statusFilter
    );
  }

  // Apply sorting
  filteredBookings.sort((a, b) => {
    switch (sortFilter) {
      case "date-asc":
        return new Date(a.date) - new Date(b.date);
      case "price-desc":
        return (b.price || 0) - (a.price || 0);
      case "price-asc":
        return (a.price || 0) - (b.price || 0);
      case "date-desc":
      default:
        return new Date(b.date) - new Date(a.date);
    }
  });

  if (filteredBookings.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="far fa-calendar-times"></i>
                    <h3>No bookings found</h3>
                    <p>Try changing your filters or create a new booking</p>
                    <button class="btn btn-primary" onclick="openNewBookingModal()" style="margin-top: 15px;">
                        <i class="fas fa-plus-circle"></i> Create Booking
                    </button>
                </td>
            </tr>
        `;
    console.log("No bookings to display after filtering");
    return;
  }

  console.log(`Displaying ${filteredBookings.length} bookings in table`);

  filteredBookings.forEach((booking, index) => {
    console.log(`Booking ${index + 1} for table:`, {
      client: booking.client,
      initials: booking.clientInitials,
      service: booking.service,
      date: booking.date,
    });

    const row = document.createElement("tr");
    row.className = "booking-row";
    row.onclick = () => openBookingDetails(booking.id);

    const bookingDate = new Date(booking.date);
    const formattedDate = bookingDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const initials = booking.clientInitials || getInitials(booking.client);

    row.innerHTML = `
            <td>
                <div class="booking-client">
                    <div class="booking-avatar">${initials}</div>
                    <div class="booking-client-info">
                        <h4>${booking.client}</h4>
                        <p>${booking.phone}</p>
                    </div>
                </div>
            </td>
            <td class="booking-service">${booking.service}</td>
            <td>
                <div class="booking-date-time">
                    <span class="booking-date">${formattedDate}</span>
                    <span class="booking-time">${booking.time}</span>
                </div>
            </td>
            <td class="booking-price">₦${(
              booking.price || 0
            ).toLocaleString()}</td>
            <td>
                <span class="booking-status status-${booking.status}">
                    ${
                      (booking.status || "pending").charAt(0).toUpperCase() +
                      (booking.status || "pending").slice(1)
                    }
                </span>
            </td>
            <td>
                <div class="booking-actions">
                    <button class="btn-icon btn-sm" onclick="event.stopPropagation(); editBooking(${
                      booking.id
                    });" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-sm" onclick="event.stopPropagation(); deleteBooking(${
                      booking.id
                    });" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

    tbody.appendChild(row);
  });

  console.log(`Successfully displayed ${filteredBookings.length} bookings`);
}

function updateStats() {
  const today = new Date().toISOString().split("T")[0];

  const totalBookings = bookings.length;
  const todayBookings = bookings.filter((b) => b.date === today).length;
  const confirmedBookings = bookings.filter(
    (b) => b.status === "confirmed"
  ).length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.price || 0), 0);

  document.getElementById("totalBookings").textContent = totalBookings;
  document.getElementById("todayBookings").textContent = todayBookings;
  document.getElementById("confirmedBookings").textContent = confirmedBookings;
  document.getElementById("totalRevenue").textContent =
    totalRevenue.toLocaleString();
}

function setupCalendar() {
  updateCalendar();

  // Month navigation
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");

  if (prevMonthBtn) {
    prevMonthBtn.onclick = () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      updateCalendar();
    };
  }

  if (nextMonthBtn) {
    nextMonthBtn.onclick = () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      updateCalendar();
    };
  }
}

function updateCalendar() {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const calendarMonth = document.getElementById("calendarMonth");
  const calendarDays = document.getElementById("calendarDays");

  if (!calendarMonth || !calendarDays) {
    console.error("Calendar elements not found!");
    return;
  }

  calendarMonth.textContent = `${monthNames[currentMonth]} ${currentYear}`;
  calendarDays.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDay = firstDay.getDay();

  const today = new Date();
  const isTodayMonth =
    today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  // Empty cells for days before the first
  for (let i = 0; i < startingDay; i++) {
    const emptyDay = document.createElement("div");
    emptyDay.className = "calendar-day other-month";
    calendarDays.appendChild(emptyDay);
  }

  // Days of the month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(
      2,
      "0"
    )}-${String(d).padStart(2, "0")}`;
    const dayElement = document.createElement("div");
    dayElement.className = "calendar-day";

    if (isTodayMonth && d === today.getDate()) {
      dayElement.classList.add("today");
    }

    // Get bookings for this day
    const dayBookings = bookings.filter((b) => b.date === dateKey);

    // Create day content
    const dayNumber = document.createElement("div");
    dayNumber.className = "day-number";
    dayNumber.textContent = d;

    const dayBookingsContainer = document.createElement("div");
    dayBookingsContainer.className = "day-bookings";

    // Add up to 2 bookings
    const displayedBookings = dayBookings.slice(0, 2);
    displayedBookings.forEach((booking) => {
      const bookingElement = document.createElement("div");
      bookingElement.className = `day-booking booking-${booking.status}`;

      // Extract time from booking (handle different time formats)
      let timeDisplay = "N/A";
      if (booking.time) {
        const timeMatch = booking.time.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
        timeDisplay = timeMatch ? timeMatch[1] : booking.time.substring(0, 5);
      }

      bookingElement.textContent = `${timeDisplay}`;
      bookingElement.title = `${booking.client} - ${booking.service}`;
      dayBookingsContainer.appendChild(bookingElement);
    });

    // Show "+X more" if there are more bookings
    if (dayBookings.length > 2) {
      const moreElement = document.createElement("div");
      moreElement.className = "day-booking";
      moreElement.textContent = `+${dayBookings.length - 2} more`;
      moreElement.style.background = "var(--light-gray)";
      moreElement.style.color = "var(--dark-gray)";
      dayBookingsContainer.appendChild(moreElement);
    }

    dayElement.appendChild(dayNumber);
    dayElement.appendChild(dayBookingsContainer);

    // Add click event
    if (dayBookings.length > 0) {
      dayElement.onclick = () => {
        // Filter to show only this day's bookings
        currentTab = "all";
        document
          .querySelectorAll(".booking-tab")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelector('.booking-tab[data-tab="all"]')
          .classList.add("active");

        // Set date filter to show this day
        document.getElementById("dateFilter").value = "custom";

        // Update table
        updateBookingsTable();
        showToast(
          `Showing ${dayBookings.length} booking(s) for ${dateKey}`,
          "info"
        );
      };
    }

    calendarDays.appendChild(dayElement);
  }
}

function goToToday() {
  const today = new Date();
  currentMonth = today.getMonth();
  currentYear = today.getFullYear();
  updateCalendar();
  showToast("Calendar view set to today", "info");
}

function openNewBookingModal() {
  console.log("Opening new booking modal...");
  const modal = document.getElementById("newBookingModal");
  const dateInput = document.getElementById("bookingDate");
  const timeSelect = document.getElementById("bookingTime");

  if (!modal || !dateInput || !timeSelect) {
    console.error("Modal elements not found!");
    return;
  }

  // Set default date to today
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  dateInput.value = todayStr;
  dateInput.min = todayStr;

  // Clear time slots and repopulate
  timeSelect.innerHTML = '<option value="">Select time</option>';
  populateTimeSlots(todayStr);

  // Update time slots when date changes
  dateInput.onchange = function () {
    populateTimeSlots(this.value);
  };

  // Reset form but keep date
  document.getElementById("bookingClient").value = "";
  document.getElementById("bookingPhone").value = "";
  document.getElementById("bookingService").value = "";
  document.getElementById("bookingNotes").value = "";
  document.getElementById("bookingStatus").value = "confirmed";

  modal.style.display = "flex";
}

function populateTimeSlots(dateStr) {
  const timeSelect = document.getElementById("bookingTime");
  if (!timeSelect) return;

  timeSelect.innerHTML = '<option value="">Select time</option>';

  // Default working hours (9 AM to 6 PM)
  const startTime = "09:00";
  const endTime = "18:00";

  const timeSlots = [];
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  let currentHour = startHour;
  let currentMinute = startMinute;

  while (
    currentHour < endHour ||
    (currentHour === endHour && currentMinute < endMinute)
  ) {
    const timeString = `${String(currentHour).padStart(2, "0")}:${String(
      currentMinute
    ).padStart(2, "0")}`;
    const displayTime = formatTime(timeString);

    // Check if this time slot is already booked
    const isBooked = bookings.some((b) => {
      if (b.date !== dateStr) return false;
      if (!b.time) return false;

      // Extract hour and minute from stored time (could be "10:00 AM" or "10:00")
      const timeMatch = b.time.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) return false;

      const [_, hour, minute] = timeMatch;
      const bookingTime = `${String(parseInt(hour)).padStart(
        2,
        "0"
      )}:${minute}`;
      return bookingTime === timeString;
    });

    if (!isBooked) {
      timeSlots.push({ value: timeString, display: displayTime });
    }

    currentMinute += 30;
    if (currentMinute >= 60) {
      currentHour++;
      currentMinute -= 60;
    }
  }

  timeSlots.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot.value;
    option.textContent = slot.display;
    timeSelect.appendChild(option);
  });

  if (timeSlots.length === 0) {
    timeSelect.innerHTML = '<option value="">No available slots</option>';
    timeSelect.disabled = true;
  } else {
    timeSelect.disabled = false;
  }
}

function formatTime(timeString) {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes} ${ampm}`;
}

function createBooking() {
  console.log("Creating booking...");

  const client = document.getElementById("bookingClient").value.trim();
  const phone = document.getElementById("bookingPhone").value.trim();
  const service = document.getElementById("bookingService").value;
  const date = document.getElementById("bookingDate").value;
  const time = document.getElementById("bookingTime").value;
  const notes = document.getElementById("bookingNotes").value.trim();
  const status = document.getElementById("bookingStatus").value;

  // Validation
  if (!client || !phone || !service || !date || !time) {
    showToast("Please fill in all required fields", "error");
    return;
  }

  if (client === "Unknown Client" || client === "") {
    showToast("Please enter a valid client name", "error");
    return;
  }

  // Get service price
  const selectedService = services.find((s) => s.name === service);
  const price = selectedService ? selectedService.price : 5000;

  // Generate new ID
  const newId =
    bookings.length > 0 ? Math.max(...bookings.map((b) => b.id)) + 1 : 1;

  const newBooking = {
    id: newId,
    client: client,
    clientInitials: getInitials(client),
    phone: phone,
    service: service,
    date: date,
    time: formatTime(time),
    price: price,
    status: status,
    notes: notes,
    createdAt: new Date().toISOString(),
  };

  bookings.push(newBooking);

  try {
    localStorage.setItem("bookings", JSON.stringify(bookings));
    console.log("New booking saved:", newBooking);
  } catch (error) {
    console.error("Error saving booking:", error);
    showToast("Error saving booking", "error");
    return;
  }

  closeNewBookingModal();
  loadBookings(); // Reload to update everything
  showToast(`Booking created for ${client}`, "success");
}

function closeNewBookingModal() {
  const modal = document.getElementById("newBookingModal");
  if (modal) modal.style.display = "none";
}

function openBookingDetails(bookingId) {
  selectedBooking = bookings.find((b) => b.id === bookingId);
  if (!selectedBooking) {
    showToast("Booking not found", "error");
    return;
  }

  const modal = document.getElementById("bookingDetailsModal");
  const content = document.getElementById("bookingDetailsContent");
  const actions = document.getElementById("bookingDetailsActions");

  if (!modal || !content || !actions) {
    console.error("Booking details modal elements not found!");
    return;
  }

  const bookingDate = new Date(selectedBooking.date);
  const formattedDate = bookingDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  content.innerHTML = `
        <div style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 1.4rem;">${
                  selectedBooking.client
                }</h3>
                <span class="booking-status status-${
                  selectedBooking.status
                }" style="padding: 8px 16px; font-size: 0.9rem;">
                    ${
                      selectedBooking.status.charAt(0).toUpperCase() +
                      selectedBooking.status.slice(1)
                    }
                </span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                <div>
                    <div style="font-size: 0.9rem; color: var(--gray); margin-bottom: 4px;">Phone Number</div>
                    <div style="font-weight: 600; font-size: 1.1rem;">${
                      selectedBooking.phone
                    }</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: var(--gray); margin-bottom: 4px;">Service</div>
                    <div style="font-weight: 600; font-size: 1.1rem;">${
                      selectedBooking.service
                    }</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: var(--gray); margin-bottom: 4px;">Date</div>
                    <div style="font-weight: 600; font-size: 1.1rem;">${formattedDate}</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: var(--gray); margin-bottom: 4px;">Time</div>
                    <div style="font-weight: 600; font-size: 1.1rem;">${
                      selectedBooking.time
                    }</div>
                </div>
            </div>
            
            <div style="margin-bottom: 24px;">
                <div style="font-size: 0.9rem; color: var(--gray); margin-bottom: 4px;">Price</div>
                <div style="font-weight: 700; font-size: 1.8rem; color: var(--secondary);">₦${(
                  selectedBooking.price || 0
                ).toLocaleString()}</div>
            </div>
            
            ${
              selectedBooking.notes
                ? `
                <div>
                    <div style="font-size: 0.9rem; color: var(--gray); margin-bottom: 8px;">Notes</div>
                    <div style="background: var(--light-gray); padding: 16px; border-radius: var(--radius);">
                        ${selectedBooking.notes}
                    </div>
                </div>
            `
                : ""
            }
        </div>
    `;

  // Set up actions based on status
  if (selectedBooking.status === "pending") {
    actions.innerHTML = `
            <button class="btn btn-success" onclick="updateBookingStatus('confirmed')">
                <i class="fas fa-check-circle"></i> Confirm
            </button>
            <button class="btn btn-danger" onclick="updateBookingStatus('cancelled')">
                <i class="fas fa-times-circle"></i> Cancel
            </button>
            <button class="btn btn-secondary" onclick="closeBookingDetailsModal()">
                Close
            </button>
        `;
  } else if (selectedBooking.status === "confirmed") {
    actions.innerHTML = `
            <button class="btn btn-success" onclick="updateBookingStatus('completed')">
                <i class="fas fa-check-double"></i> Mark as Completed
            </button>
            <button class="btn btn-warning" onclick="editBooking(${selectedBooking.id})">
                <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn btn-secondary" onclick="closeBookingDetailsModal()">
                Close
            </button>
        `;
  } else {
    actions.innerHTML = `
            <button class="btn btn-secondary" onclick="closeBookingDetailsModal()">
                Close
            </button>
        `;
  }

  modal.style.display = "flex";
}

function closeBookingDetailsModal() {
  const modal = document.getElementById("bookingDetailsModal");
  if (modal) modal.style.display = "none";
  selectedBooking = null;
}

function editBooking(bookingId) {
  // For now, just open the booking details
  openBookingDetails(bookingId);
  showToast("Edit feature coming soon", "info");
}

function deleteBooking(bookingId) {
  if (confirm("Are you sure you want to delete this booking?")) {
    bookings = bookings.filter((b) => b.id !== bookingId);

    try {
      localStorage.setItem("bookings", JSON.stringify(bookings));
      loadBookings(); // Reload to update everything
      showToast("Booking deleted", "warning");
    } catch (error) {
      console.error("Error deleting booking:", error);
      showToast("Error deleting booking", "error");
    }
  }
}

function updateBookingStatus(newStatus) {
  if (!selectedBooking) return;

  selectedBooking.status = newStatus;

  try {
    localStorage.setItem("bookings", JSON.stringify(bookings));
    closeBookingDetailsModal();
    loadBookings(); // Reload to update everything
    showToast(`Booking marked as ${newStatus}`, "success");
  } catch (error) {
    console.error("Error updating booking status:", error);
    showToast("Error updating booking status", "error");
  }
}

function clearFilters() {
  document.getElementById("dateFilter").value = "all";
  document.getElementById("serviceFilter").value = "all";
  document.getElementById("statusFilter").value = "all";
  document.getElementById("sortFilter").value = "date-desc";
  updateBookingsTable();
  showToast("Filters cleared", "info");
}

function printBookings() {
  console.log("Printing bookings...");

  // Create a print-friendly version
  const printContent = `
        <html>
        <head>
            <title>Bookings Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; margin-bottom: 10px; }
                .report-info { margin-bottom: 20px; color: #666; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; font-weight: bold; }
                .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
                .status-confirmed { background: #d1fae5; color: #10b981; }
                .status-pending { background: #fef3c7; color: #f59e0b; }
                .status-cancelled { background: #fee2e2; color: #ef4444; }
                .status-completed { background: #dbeafe; color: #3b82f6; }
                @media print {
                    body { margin: 0; padding: 10px; }
                    .no-print { display: none; }
                }
                .footer { margin-top: 30px; text-align: right; font-style: italic; color: #666; }
            </style>
        </head>
        <body>
            <h1>Bookings Report</h1>
            <div class="report-info">
                <p>Generated: ${new Date().toLocaleString()}</p>
                <p>Total Bookings: ${bookings.length}</p>
                <p>Total Revenue: ₦${bookings
                  .reduce((sum, b) => sum + (b.price || 0), 0)
                  .toLocaleString()}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Client</th>
                        <th>Service</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Price</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${bookings
                      .map(
                        (booking) => `
                        <tr>
                            <td>${booking.client}</td>
                            <td>${booking.service}</td>
                            <td>${new Date(
                              booking.date
                            ).toLocaleDateString()}</td>
                            <td>${booking.time}</td>
                            <td>₦${booking.price.toLocaleString()}</td>
                            <td><span class="status status-${booking.status}">${
                          booking.status.charAt(0).toUpperCase() +
                          booking.status.slice(1)
                        }</span></td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
            <div class="footer">
                <p>Generated by Trimly Booking System</p>
            </div>
        </body>
        </html>
    `;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();

  // Wait for content to load before printing
  printWindow.onload = function () {
    printWindow.print();
    printWindow.close();
  };

  showToast("Preparing print preview...", "info");
}

function exportBookings() {
  console.log("Exporting bookings...");

  // Create CSV content
  const headers = [
    "Client",
    "Phone",
    "Service",
    "Date",
    "Time",
    "Price",
    "Status",
    "Notes",
  ];
  const csvContent = [
    headers.join(","),
    ...bookings.map((booking) =>
      [
        `"${(booking.client || "").replace(/"/g, '""')}"`,
        `"${(booking.phone || "").replace(/"/g, '""')}"`,
        `"${(booking.service || "").replace(/"/g, '""')}"`,
        booking.date,
        `"${(booking.time || "").replace(/"/g, '""')}"`,
        booking.price || 0,
        booking.status || "pending",
        `"${(booking.notes || "").replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ].join("\n");

  // Create download link
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `bookings_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("Bookings exported to CSV", "success");
}

function setupEventListeners() {
  console.log("Setting up event listeners...");

  // Sidebar toggle
  const sidebar = document.getElementById("sidebar");
  const hamburgerBtn = document.getElementById("hamburger-btn");
  const overlay = document.getElementById("mobile-overlay");
  const toggleIcon = document.querySelector(".sidebar-toggle-icon");

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener("click", toggleSidebar);
  }

  if (toggleIcon) {
    toggleIcon.addEventListener("click", toggleSidebar);
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("mobile-open");
      overlay.style.opacity = "0";
      setTimeout(() => (overlay.style.display = "none"), 300);
    });
  }

  // Tab switching
  document.querySelectorAll(".booking-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".booking-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.getAttribute("data-tab");
      updateBookingsTable();
    });
  });

  // Filter changes
  const filters = ["dateFilter", "serviceFilter", "statusFilter", "sortFilter"];
  filters.forEach((filterId) => {
    const element = document.getElementById(filterId);
    if (element) {
      element.addEventListener("change", updateBookingsTable);
    }
  });

  // Modal close on outside click
  window.addEventListener("click", (event) => {
    const modals = ["newBookingModal", "bookingDetailsModal"];
    modals.forEach((modalId) => {
      const modal = document.getElementById(modalId);
      if (modal && event.target === modal) {
        if (modalId === "newBookingModal") closeNewBookingModal();
        if (modalId === "bookingDetailsModal") closeBookingDetailsModal();
      }
    });
  });

  // Close modals with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeNewBookingModal();
      closeBookingDetailsModal();
    }
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("mobile-overlay");
  const isMobile = window.innerWidth <= 1024;

  if (isMobile) {
    sidebar.classList.toggle("mobile-open");
    if (sidebar.classList.contains("mobile-open")) {
      if (overlay) {
        overlay.style.display = "block";
        setTimeout(() => (overlay.style.opacity = "1"), 10);
      }
    } else {
      if (overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => (overlay.style.display = "none"), 300);
      }
    }
  } else {
    sidebar.classList.toggle("collapsed");
  }
}

function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) {
    console.error("Toast element not found!");
    return;
  }

  toast.textContent = message;
  toast.className = `toast ${type}`;

  let icon = "fas fa-info-circle";
  if (type === "success") icon = "fas fa-check-circle";
  if (type === "error") icon = "fas fa-exclamation-circle";
  if (type === "warning") icon = "fas fa-exclamation-triangle";

  toast.innerHTML = `<i class="${icon}"></i> ${message}`;

  // Show toast
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  // Hide toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, initializing bookings...");

  // First, clear any corrupted localStorage data
  try {
    const testData = localStorage.getItem("bookings");
    if (testData) {
      const parsed = JSON.parse(testData);
      if (!Array.isArray(parsed)) {
        console.log("Corrupted bookings data found, clearing...");
        localStorage.removeItem("bookings");
      }
    }
  } catch (error) {
    console.log("Error checking localStorage, clearing bookings data...");
    localStorage.removeItem("bookings");
  }

  // Then initialize
  initBookings();
});

// Make functions available globally for onclick attributes
window.openNewBookingModal = openNewBookingModal;
window.closeNewBookingModal = closeNewBookingModal;
window.createBooking = createBooking;
window.openBookingDetails = openBookingDetails;
window.closeBookingDetailsModal = closeBookingDetailsModal;
window.editBooking = editBooking;
window.deleteBooking = deleteBooking;
window.updateBookingStatus = updateBookingStatus;
window.clearFilters = clearFilters;
window.loadBookings = loadBookings;
window.printBookings = printBookings;
window.exportBookings = exportBookings;
window.goToToday = goToToday;
