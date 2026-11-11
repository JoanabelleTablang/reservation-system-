// 1. DOMAIN CLASSES
class Facility {
    constructor(id, name, type) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.bookedSlots = [];
    }

    isTimelineOverlapping(date, startMins, endMins) {
        return this.bookedSlots.some(slot => {
            if (slot.date !== date) return false;
            return (startMins < slot.endMins && endMins > slot.startMins);
        });
    }

    reserveSlot(date, label, startMins, endMins) {
        this.bookedSlots.push({ date, label, startMins, endMins });
    }

    releaseSlot(date, startMins, endMins) {
        this.bookedSlots = this.bookedSlots.filter(slot =>
            !(slot.date === date && slot.startMins === startMins && slot.endMins === endMins)
        );
    }
}

class Reservation {
    constructor(id, facilityInstance, userName, userRole, date, durationLabel, startMins, endMins) {
        this.id = id;
        this.facility = facilityInstance;
        this.userName = userName;
        this.userRole = userRole;
        this.date = date;
        this.durationLabel = durationLabel;
        this.startMins = startMins;
        this.endMins = endMins;
    }
}

// 2. SYSTEM MANAGER CLASS
class ReservationSystem {
    constructor() {
        this.facilities = [];
        this.reservations = [];
        this.searchQuery = "";
    }

    addFacility(facility) {
        this.facilities.push(facility);
    }

    createReservation(facilityId, userName, userRole, date, durationType, customStart, customEnd) {
        const facility = this.facilities.find(f => f.id === facilityId);
        if (!facility) return { success: false, message: "Facility not found." };

        const selectedDate = new Date(date + 'T00:00:00');
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        if (selectedDate < todayDate) {
            return { success: false, message: "Cannot reserve slots for past dates." };
        }

        let startMins = 0;
        let endMins = 0;
        let durationLabel = "";

        if (durationType === "Whole Day") {
            startMins = 480;
            endMins = 1020;
            durationLabel = "Whole Day (08:00 AM - 05:00 PM)";
        } else if (durationType === "Half Day (AM)") {
            startMins = 480;
            endMins = 720;
            durationLabel = "Half Day AM (08:00 AM - 12:00 PM)";
        } else if (durationType === "Half Day (PM)") {
            startMins = 780;
            endMins = 1020;
            durationLabel = "Half Day PM (01:00 PM - 05:00 PM)";
        } else if (durationType === "Custom Time Slot") {
            if (!customStart || !customEnd) {
                return { success: false, message: "Please specify custom start and end times." };
            }

            const parseToMins = (timeStr) => {
                const [h, m] = timeStr.split(':').map(Number);
                return (h * 60) + m;
            };

            startMins = parseToMins(customStart);
            endMins = parseToMins(customEnd);

            if (startMins >= endMins) {
                return { success: false, message: "End time must be later than the start time!" };
            }

            durationLabel = `Custom (${customStart} to ${customEnd})`;
        }

        if (facility.isTimelineOverlapping(date, startMins, endMins)) {
            return { success: false, message: `Conflict detected! ${facility.name} is already booked during this timeframe on ${date}.` };
        }

        const reservationId = 'RES-' + Date.now();
        const newReservation = new Reservation(reservationId, facility, userName, userRole, date, durationLabel, startMins, endMins);

        this.reservations.push(newReservation);
        facility.reserveSlot(date, durationLabel, startMins, endMins);

        this.updateUI();
        return { success: true, message: "Space reserved successfully!" };
    }

    cancelReservation(reservationId) {
        const index = this.reservations.findIndex(r => r.id === reservationId);
        if (index !== -1) {
            const res = this.reservations[index];
            res.facility.releaseSlot(res.date, res.startMins, res.endMins);
            this.reservations.splice(index, 1);
            this.updateUI();
        }
    }

    populateFormOptions() {
        const selectElement = document.getElementById('facilitySelect');
        selectElement.innerHTML = '';
        this.facilities.forEach(facility => {
            const option = document.createElement('option');
            option.value = facility.id;
            option.textContent = `${facility.name} (${facility.type})`;
            selectElement.appendChild(option);
        });
    }

    updateUI() {
        this.renderFacilities();
        this.renderReservationsTable();
    }

    setSearchQuery(query) {
        this.searchQuery = query.toLowerCase();
        this.renderFacilities();
    }

    renderFacilities() {
        const grid = document.getElementById('facilityGrid');
        grid.innerHTML = '';

        const filteredFacilities = this.facilities.filter(f =>
            f.name.toLowerCase().includes(this.searchQuery) ||
            f.type.toLowerCase().includes(this.searchQuery)
        );

        filteredFacilities.forEach(facility => {
            const card = document.createElement('div');

            const isBooked = facility.bookedSlots.length > 0;
            card.className = `facility-card ${isBooked ? 'status-booked' : 'status-available'}`;

            const badgeText = isBooked ? '🔴 Occupied' : '🟢 Available Now';

            let slotsStatusText = '';
            if (isBooked) {
                const formattedSchedules = facility.bookedSlots.map(slot => `• 📅 ${slot.date}<br>&nbsp;&nbsp;⏱️ ${slot.label}`);
                slotsStatusText = `<div class="facility-schedule-list"><strong>Schedules:</strong><br>${formattedSchedules.join('<br>')}</div>`;
            }

            card.innerHTML = `
                <div class="facility-name">${facility.name}</div>
                <small class="status-badge">${badgeText}</small>
                ${slotsStatusText}
            `;
            grid.appendChild(card);
        });
    }

    renderReservationsTable() {
        const tbody = document.getElementById('bookingsTableBody');
        tbody.innerHTML = '';

        if (this.reservations.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="table-empty-state">No active bookings.</td></tr>`;
            return;
        }

        this.reservations.forEach(res => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${res.facility.name}</strong></td>
                <td>${res.userName}</td>
                <td>${res.userRole}</td>
                <td>
                    <span class="table-date-badge">📅 ${res.date}</span>
                    <span class="table-duration-text">⏱️ ${res.durationLabel}</span>
                </td>
                <td></td>
            `;

            const cancelButton = document.createElement('button');
            cancelButton.className = 'btn-danger';
            cancelButton.textContent = 'Cancel';
            cancelButton.addEventListener('click', () => this.cancelReservation(res.id));

            row.cells[row.cells.length - 1].appendChild(cancelButton);
            tbody.appendChild(row);
        });
    }
}

// 4. APP INITIALIZATION & UI LISTENERS
const system = new ReservationSystem();

system.addFacility(new Facility('FAC-1', 'Gymnasium', 'Hall'));
system.addFacility(new Facility('FAC-2', 'Library Study Room', 'Room'));
system.addFacility(new Facility('FAC-3', 'Computer Lab A', 'Lab'));
system.addFacility(new Facility('FAC-4', 'Computer Lab B', 'Lab'));
system.addFacility(new Facility('FAC-5', 'Computer Lab C', 'Lab'));
system.addFacility(new Facility('FAC-6', 'Computer Lab D', 'Lab'));
system.addFacility(new Facility('FAC-7', 'Computer Lab E', 'Lab'));
system.addFacility(new Facility('FAC-8', 'Information Kiosk', 'Space'));

system.populateFormOptions();

// Lock date picker to today and future dates
const dateField = document.getElementById('reservationDate');
const today = new Date().toISOString().split('T')[0];
dateField.value = today;
dateField.setAttribute('min', today);

system.updateUI();

// Mobile Tab Toggle Logic
const tabs = document.querySelectorAll('.tab-btn');
const panels = document.querySelectorAll('.panel');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetPanel = document.getElementById(tab.dataset.tab);
        if (targetPanel) targetPanel.classList.add('active');
    });
});

// Facility Search Filter
document.getElementById('searchFacility').addEventListener('input', function (e) {
    system.setSearchQuery(e.target.value);
});

// Show / Hide Custom Time Fields
document.getElementById('durationType').addEventListener('change', function () {
    const customFields = document.getElementById('customTimeFields');
    if (this.value === "Custom Time Slot") {
        customFields.style.display = "block";
        document.getElementById('startTime').required = true;
        document.getElementById('endTime').required = true;
    } else {
        customFields.style.display = "none";
        document.getElementById('startTime').required = false;
        document.getElementById('endTime').required = false;
    }
});

// Reservation Form Submit
document.getElementById('reservationForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const userName = document.getElementById('userName').value;
    const userRole = document.getElementById('userRole').value;
    const facilityId = document.getElementById('facilitySelect').value;
    const date = document.getElementById('reservationDate').value;
    const durationType = document.getElementById('durationType').value;
    const customStart = document.getElementById('startTime').value;
    const customEnd = document.getElementById('endTime').value;

    const result = system.createReservation(facilityId, userName, userRole, date, durationType, customStart, customEnd);

    if (result.success) {
        document.getElementById('userName').value = '';
        document.getElementById('startTime').value = '';
        document.getElementById('endTime').value = '';
        document.getElementById('durationType').value = 'Whole Day';
        document.getElementById('customTimeFields').style.display = "none";

        if (window.innerWidth <= 900) {
            document.querySelector('[data-tab="statusPanel"]').click();
        }
    } else {
        alert(result.message);
    }
});
