// ===========================
// SPA ROUTER
// ===========================
function handleRouting() {
  const route = (window.location.hash || "#home").replace("#", "");

  // Hide all sections
  document.querySelectorAll(".view-section").forEach(sec => sec.classList.add("d-none"));

  // Show active section
  const activeSection = document.getElementById(route + "Page");
  if (activeSection) activeSection.classList.remove("d-none");

  // Update active state (both sidebar and mobile)
  document.querySelectorAll("[data-route]").forEach(link => {
    const isActive = link.dataset.route === route;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  // Close mobile collapse after navigation (if open)
  closeMobileNav();

  // View-specific hooks
  if (route === "home") {
    renderAppointmentsTable();
    updateDashboardStats();           // keep stat cards fresh
    initSearch();
    initTableActions();
    const btn = document.getElementById("btnExportCsv");
    if (btn) btn.onclick = exportAppointmentsCSV;
  } else if (route === "appointment") {
    initAppointmentForm();
  } else if (route === "records") {
    renderPatientsTable();
    initPatientSearch();
    initPatientActions();
  }
}

function setupRouting() {
  // “New Registration” button → go to Register view
  const newRegBtn = document.getElementById("btnNewReg");
  if (newRegBtn) {
    newRegBtn.addEventListener("click", () => { window.location.hash = "register"; });
  }

  // Wire up mobile nav interactions
  wireMobileNav();

  // Router
  window.addEventListener("hashchange", handleRouting);
}

// ===========================
// MOBILE NAV HELPERS
// ===========================
function wireMobileNav() {
  const mobileNav = document.getElementById("mobileNav");
  if (!mobileNav) return;

  // When a mobile link is clicked, navigate (hash) and close the collapse
  mobileNav.querySelectorAll("a[data-route]").forEach(a => {
    a.addEventListener("click", () => {
      closeMobileNav();
    });
  });
}

function closeMobileNav() {
  const el = document.getElementById("mobileNav");
  if (!el) return;
  const isShown = el.classList.contains("show");
  if (isShown) {
    const inst = bootstrap.Collapse.getOrCreateInstance(el, { toggle: false });
    inst.hide();
  }
}

// ===========================
// TOAST HELPER
// ===========================
function toast(msg) {
  const el = document.getElementById('toast');
  const body = document.getElementById('toastBody');
  if (!el || !body) { alert(msg); return; }
  body.textContent = msg;
  new bootstrap.Toast(el).show();
}

// ===========================
// DASHBOARD STATS (HOME)
// ===========================
function updateDashboardStats() {
  const appts = storageAPI.getAppointments();
  const patients = storageAPI.getPatients();
  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const total = appts.length;
  const todayCount = appts.filter(a => a.date === todayStr).length;
  const upcoming = appts.filter(a => a.date > todayStr).length; // ISO compare

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setText("totalAppts", total);
  setText("upcomingAppts", upcoming);
  setText("todayAppts", todayCount);
  setText("totalPatients", patients.length);
}

// ===========================
// SUBMITTING STATE (new)
// ===========================
function withSubmittingState(form, run) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const resetBtn  = form.querySelector('button[type="reset"]');

  const originalHTML = submitBtn ? submitBtn.innerHTML : null;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Processing…`;
  }
  if (resetBtn) resetBtn.disabled = true;
  Array.from(form.elements).forEach(el => { if (el !== submitBtn && el !== resetBtn) el.disabled = true; });

  const finish = () => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalHTML;
    }
    if (resetBtn) resetBtn.disabled = false;
    Array.from(form.elements).forEach(el => { if (el !== submitBtn && el !== resetBtn) el.disabled = false; });
  };

  try {
    const maybePromise = run();
    Promise.resolve(maybePromise).finally(finish);
  } catch (e) {
    finish();
    throw e;
  }
}

// ===========================
// PATIENT REGISTRATION
// ===========================
function handlePatientForm() {
  const form = document.getElementById("patientForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const firstName = document.getElementById("firstName").value.trim();
    const lastName  = document.getElementById("lastName").value.trim();
    const age       = document.getElementById("age").value;
    const gender    = document.getElementById("gender").value;
    const address   = document.getElementById("address").value.trim();
    const city      = document.getElementById("city").value.trim();
    const state     = document.getElementById("state").value.trim();
    const pincode   = document.getElementById("pincode").value.trim();
    const bloodGroup= document.getElementById("bloodGroup").value.trim();
    const contact   = document.getElementById("contact").value.trim();
    const email     = document.getElementById("email").value.trim();

    // Validation
    if (!validator.name(firstName)) return toast("Enter a valid first name");
    if (!validator.age(age))        return toast("Enter valid age");
    if (!validator.gender(gender))  return toast("Select gender");
    if (!validator.contact(contact))return toast("Enter 10-digit contact");
    if (!validator.email(email || "")) return toast("Enter a valid email");
    if (!/^\d{6}$/.test(pincode))   return toast("Enter valid 6-digit pincode");
    if (!bloodGroup)                return toast("Select blood group");

    withSubmittingState(form, () => {
      const fullAddress = `${address}, ${city}, ${state} - ${pincode}`;

      const patients = storageAPI.getPatients();
      const newPatient = {
        id: storageAPI.uid("p"),
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        age,
        gender,
        contact,
        email,
        address: fullAddress,
        city,
        state,
        pincode,
        bloodGroup,
        createdAt: new Date().toISOString(),
      };

      patients.push(newPatient);
      storageAPI.setPatients(patients);
      localStorage.setItem("lastRegisteredPatientId", newPatient.id);

      toast(`Patient Registered! ID: ${newPatient.id}`);
      form.reset();
      window.location.hash = "appointment";
    });
  });
}

// ===========================
// APPOINTMENT BOOKING
// ===========================
function initAppointmentForm() {
  const ps = document.getElementById("patientSelect");
  const ds = document.getElementById("deptSelect");
  const drs = document.getElementById("doctorSelect");
  const ts = document.getElementById("timeSelect");
  const dateInput = document.getElementById("apptDate");
  if (!ps || !ds || !drs || !ts || !dateInput) return;

  fillPatients(ps);
  fillDepartments(ds);

  // preselect last registered patient
  const lastPid = localStorage.getItem("lastRegisteredPatientId");
  if (lastPid) ps.value = lastPid;

  ds.onchange = () => {
    fillDoctors(drs, ds.value);
    ts.innerHTML = `<option value="">Select time</option>`;
  };
  drs.onchange = () => fillTimeSlots(ts, drs.value);

  // set min date = today
  const today = new Date();
  today.setHours(0,0,0,0);
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  dateInput.min = `${y}-${m}-${d}`;

  handleApptFormSubmit();
}

function fillPatients(selectEl) {
  const patients = storageAPI.getPatients();
  selectEl.innerHTML =
    `<option value="">Select patient</option>` +
    patients.map(p => `<option value="${p.id}">${p.name} (${p.age}/${p.gender})</option>`).join("");
}
function fillDepartments(selectEl) {
  const deps = storageAPI.getDepartments();
  selectEl.innerHTML =
    `<option value="">Select department</option>` +
    deps.map(d => `<option value="${d.id}">${d.name}</option>`).join("");
}
function fillDoctors(selectEl, departmentId) {
  const docs = storageAPI.getDoctors().filter(doc => doc.departmentId === departmentId);
  selectEl.innerHTML =
    `<option value="">Select doctor</option>` +
    docs.map(d => `<option value="${d.id}">${d.name}</option>`).join("");
}
function fillTimeSlots(selectEl, doctorId) {
  const doc = storageAPI.getDoctors().find(d => d.id === doctorId);
  selectEl.innerHTML = `<option value="">Select time</option>`;
  if (!doc) return;
  selectEl.innerHTML += doc.slots.map(t => `<option value="${t}">${t}</option>`).join("");
}
function isFutureDate(dateStr) {
  const picked = new Date(dateStr + "T00:00:00");
  const today = new Date();
  picked.setHours(0,0,0,0);
  today.setHours(0,0,0,0);
  return picked.getTime() >= today.getTime();
}
function isSlotTaken(doctorId, dateStr, timeStr) {
  const appts = storageAPI.getAppointments();
  return appts.some(a => a.doctorId === doctorId && a.date === dateStr && a.time === timeStr);
}
function handleApptFormSubmit() {
  const form = document.getElementById("apptForm");
  if (!form) return;

  form.onsubmit = (e) => {
    e.preventDefault();

    const patientId = document.getElementById("patientSelect").value;
    const deptId    = document.getElementById("deptSelect").value;
    const doctorId  = document.getElementById("doctorSelect").value;
    const dateStr   = document.getElementById("apptDate").value;
    const timeStr   = document.getElementById("timeSelect").value;

    if (!patientId) return toast("Select patient");
    if (!deptId)    return toast("Select department");
    if (!doctorId)  return toast("Select doctor");
    if (!dateStr)   return toast("Select date");
    if (!isFutureDate(dateStr)) return toast("Date must be today or future");
    if (!timeStr)   return toast("Select a time slot");
    if (isSlotTaken(doctorId, dateStr, timeStr)) return toast("This slot is already booked for the doctor");

    withSubmittingState(form, () => {
      const appts = storageAPI.getAppointments();
      const newAppt = {
        id: storageAPI.uid("a"),
        patientId, departmentId: deptId, doctorId,
        date: dateStr, time: timeStr,
        createdAt: new Date().toISOString(),
      };
      appts.push(newAppt);
      storageAPI.setAppointments(appts);

      toast("Appointment booked!");
      form.reset();
      window.location.hash = "home"; // routing will refresh stats
    });
  };
}

// ===========================
// STATUS BADGES (helpers)
// ===========================
function getApptStatus(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + "T00:00:00"); d.setHours(0,0,0,0);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() > today.getTime()) return "Upcoming";
  return "Completed";
}
function badgeHTML(status) {
  const cls = status === "Upcoming" ? "bg-primary"
    : status === "Today" ? "bg-warning text-dark"
    : "bg-secondary";
  return `<span class="badge ${cls}">${status}</span>`;
}

// ===========================
// HOME: APPOINTMENTS TABLE
// ===========================
function renderAppointmentsTable(filterText = "") {
  const tbody = document.querySelector("#apptTable tbody");
  if (!tbody) return;

  const appts = storageAPI.getAppointments();
  const patients = storageAPI.getPatients();
  const doctors = storageAPI.getDoctors();
  const deps = storageAPI.getDepartments();

  const rows = appts.map((a, i) => {
    const p = storageAPI.byId(patients, a.patientId);
    const d = storageAPI.byId(doctors, a.doctorId);
    const dep = storageAPI.byId(deps, a.departmentId);
    return {
      num: i + 1,
      patient: p ? p.name : "Unknown",
      department: dep ? dep.name : "Unknown",
      doctor: d ? d.name : "Unknown",
      date: a.date,
      time: a.time,
      id: a.id,
      status: getApptStatus(a.date)
    };
  });

  const search = filterText.toLowerCase();
  const filtered = rows.filter(r =>
    r.patient.toLowerCase().includes(search) ||
    r.department.toLowerCase().includes(search) ||
    r.doctor.toLowerCase().includes(search) ||
    r.date.includes(search)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No appointments found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>${r.num}</td>
      <td>${r.patient}</td>
      <td>${r.department}</td>
      <td>${r.doctor}</td>
      <td>${r.date}</td>
      <td>${r.time}</td>
      <td>${badgeHTML(r.status)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${r.id}" title="Edit">
          <i class="bi bi-pencil-square"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${r.id}" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}
function initSearch() {
  const box = document.getElementById("searchBox");
  if (!box) return;
  box.oninput = (e) => renderAppointmentsTable(e.target.value);
}

// CSV Export
function exportAppointmentsCSV() {
  const appts = storageAPI.getAppointments();
  const patients = storageAPI.getPatients();
  const doctors = storageAPI.getDoctors();
  const deps = storageAPI.getDepartments();

  const rows = appts.map(a => {
    const p = storageAPI.byId(patients, a.patientId);
    const d = storageAPI.byId(doctors, a.doctorId);
    const dep = storageAPI.byId(deps, a.departmentId);
    return {
      AppointmentID: a.id,
      Patient: p ? p.name : "",
      Contact: p ? p.contact : "",
      Department: dep ? dep.name : "",
      Doctor: d ? d.name : "",
      Date: a.date,
      Time: a.time,
      Status: getApptStatus(a.date)
    };
  });

  const headers = Object.keys(rows[0] || {
    AppointmentID:"", Patient:"", Contact:"", Department:"", Doctor:"", Date:"", Time:"", Status:""
  });

  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appointments_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Edit/Delete actions (appointments)
function initTableActions() {
  const table = document.getElementById("apptTable");
  if (!table) return;

  table.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === "edit") openEditModal(id);
    else if (action === "delete") openDeleteModal(id);
  });
}
function openEditModal(id) {
  const appt = storageAPI.getAppointments().find(a => a.id === id);
  if (!appt) return toast("Appointment not found");

  document.getElementById("editId").value = id;
  document.getElementById("editDate").value = appt.date;

  const doc = storageAPI.getDoctors().find(d => d.id === appt.doctorId);
  const timeSelect = document.getElementById("editTime");
  if (!doc) {
    timeSelect.innerHTML = `<option value="">No slots</option>`;
  } else {
    timeSelect.innerHTML = doc.slots.map(t => `<option value="${t}">${t}</option>`).join("");
    timeSelect.value = appt.time;
  }

  const modal = new bootstrap.Modal(document.getElementById("editModal"));
  modal.show();

  document.getElementById("saveEditBtn").onclick = () => saveEditChanges(modal);
}
function saveEditChanges(modal) {
  const id = document.getElementById("editId").value;
  const date = document.getElementById("editDate").value;
  const time = document.getElementById("editTime").value;

  if (!isFutureDate(date)) return toast("Date must be today or future");

  const appts = storageAPI.getAppointments();
  const index = appts.findIndex(a => a.id === id);
  if (index === -1) return toast("Appointment not found");

  const current = appts[index];
  const clash = appts.some(a =>
    a.doctorId === current.doctorId && a.id !== id && a.date === date && a.time === time
  );
  if (clash) return toast("Slot already booked for that doctor");

  appts[index].date = date;
  appts[index].time = time;
  storageAPI.setAppointments(appts);

  modal.hide();
  renderAppointmentsTable();
  updateDashboardStats(); // refresh counts after edit
  toast("Appointment updated!");
}
function openDeleteModal(id) {
  document.getElementById("deleteId").value = id;
  const modal = new bootstrap.Modal(document.getElementById("deleteModal"));
  modal.show();

  document.getElementById("confirmDeleteBtn").onclick = () => {
    const appts = storageAPI.getAppointments();
    const newList = appts.filter(a => a.id !== id);
    storageAPI.setAppointments(newList);
    modal.hide();
    renderAppointmentsTable();
    updateDashboardStats(); // refresh counts after delete
    toast("Appointment deleted!");
  };
}

// ===========================
// RECORDS: PATIENTS TABLE
// ===========================
function renderPatientsTable(filterText = "") {
  // If no filter passed, respect the live value in the input (if present)
  if (!filterText) {
    const input = document.getElementById("patientSearch");
    if (input && typeof input.value === "string") {
      filterText = input.value;
    }
  }

  const tbody = document.querySelector("#patientTable tbody");
  if (!tbody) return;

  const pts = storageAPI.getPatients();
  const q = (filterText || "").trim().toLowerCase();

  const filtered = pts.filter(p => {
    const blob = `${p.name} ${p.contact} ${p.email || ""} ${p.address || ""}`.toLowerCase();
    return blob.includes(q);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No patients found</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${p.name}</td>
      <td>${p.age}/${p.gender}</td>
      <td>${p.contact}</td>
      <td>${p.email || "-"}</td>
      <td>${p.address || "-"}</td>
      <td class="d-flex gap-1">
        <button class="btn btn-sm btn-outline-primary" data-paction="edit" data-id="${p.id}" title="Edit">
          <i class="bi bi-pencil-square"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" data-paction="delete" data-id="${p.id}" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary" data-paction="bookings" data-id="${p.id}" title="View Bookings">
          <i class="bi bi-journal-text"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

// Re-entry-safe Records search
function initPatientSearch() {
  const box = document.getElementById("patientSearch");
  if (!box) return;

  if (box._onInput) box.removeEventListener("input", box._onInput);
  if (box._onChange) box.removeEventListener("change", box._onChange);

  const handler = () => renderPatientsTable(box.value || "");

  box.addEventListener("input", handler);
  box.addEventListener("change", handler);

  box._onInput = handler;
  box._onChange = handler;

  handler(); // initial render using current query
}

function initPatientActions() {
  const table = document.getElementById("patientTable");
  if (!table) return;

  table.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-paction]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.paction;
    if (action === "edit") openPatientEditModal(id);
    else if (action === "delete") deletePatient(id);
    else if (action === "bookings") openPatientBookingsModal(id);
  });
}

// ===== Enhanced Edit Patient – mirrors Registration fields =====
function openPatientEditModal(id) {
  const pts = storageAPI.getPatients();
  const p = pts.find(x => x.id === id);
  if (!p) return toast("Patient not found");

  // Detect which edit modal fields exist (new detailed vs legacy single-name)
  const hasDetailedFields = !!document.getElementById("editFirstName");

  if (hasDetailedFields) {
    // Fallbacks for older records:
    const firstName = p.firstName || (p.name ? p.name.split(" ")[0] : "");
    const lastName  = p.lastName  || (p.name ? p.name.split(" ").slice(1).join(" ") : "");

    const addressLine = (p.address || "").replace(/\s*-\s*\d{6}\s*$/, ""); // strip trailing "- pincode"
    const city  = p.city  || "";
    const state = p.state || "";
    const pincode =
      p.pincode ||
      ((p.address || "").match(/\b(\d{6})\b/)?.[1] || "");

    document.getElementById("editPid").value = p.id;
    document.getElementById("editFirstName").value = firstName;
    document.getElementById("editLastName").value  = lastName;
    document.getElementById("editAge").value = p.age || "";
    document.getElementById("editGender").value = p.gender || "";
    document.getElementById("editAddress").value = addressLine || "";
    document.getElementById("editCity").value  = city;
    document.getElementById("editState").value = state;
    document.getElementById("editPincode").value = pincode;
    document.getElementById("editBloodGroup").value = p.bloodGroup || "";
    document.getElementById("editContact").value = p.contact || "";
    document.getElementById("editEmail").value   = p.email || "";
  } else {
    // Legacy modal (single Name + Address fields)
    document.getElementById("editPid").value    = p.id;
    document.getElementById("editName").value   = p.name || "";
    document.getElementById("editAge").value    = p.age || "";
    document.getElementById("editGender").value = p.gender || "";
    document.getElementById("editContact").value= p.contact || "";
    document.getElementById("editEmail").value  = p.email || "";
    document.getElementById("editAddress").value= p.address || "";
  }

  const modal = new bootstrap.Modal(document.getElementById("patientEditModal"));
  modal.show();

  document.getElementById("savePatientEditBtn").onclick = () => savePatientEdit(modal);
}

function savePatientEdit(modal) {
  const hasDetailedFields = !!document.getElementById("editFirstName");

  if (hasDetailedFields) {
    const id         = document.getElementById("editPid").value;
    const firstName  = document.getElementById("editFirstName").value.trim();
    const lastName   = document.getElementById("editLastName").value.trim();
    const age        = document.getElementById("editAge").value;
    const gender     = document.getElementById("editGender").value;
    const address    = document.getElementById("editAddress").value.trim();
    const city       = document.getElementById("editCity").value.trim();
    const state      = document.getElementById("editState").value.trim();
    const pincode    = document.getElementById("editPincode").value.trim();
    const bloodGroup = document.getElementById("editBloodGroup").value.trim();
    const contact    = document.getElementById("editContact").value.trim();
    const email      = document.getElementById("editEmail").value.trim();

    // Validation
    if (!validator.name(firstName)) return toast("Enter a valid first name");
    if (!validator.age(age))        return toast("Age must be greater than 0");
    if (!validator.gender(gender))  return toast("Select gender");
    if (!validator.contact(contact))return toast("Contact must be 10 digits");
    if (!validator.email(email || "")) return toast("Enter a valid email");
    if (!/^\d{6}$/.test(pincode))   return toast("Enter a valid 6-digit pincode");
    if (!bloodGroup)                return toast("Select blood group");

    const fullName    = `${firstName} ${lastName}`.trim();
    const fullAddress = `${address}, ${city}, ${state} - ${pincode}`;

    const pts = storageAPI.getPatients();
    const idx = pts.findIndex(p => p.id === id);
    if (idx === -1) return toast("Patient not found");

    pts[idx] = {
      ...pts[idx],
      firstName,
      lastName,
      name: fullName,
      age,
      gender,
      contact,
      email,
      address: fullAddress,
      city,
      state,
      pincode,
      bloodGroup
    };

    storageAPI.setPatients(pts);
  } else {
    // Legacy modal save
    const id      = document.getElementById("editPid").value;
    const name    = document.getElementById("editName").value;
    const age     = document.getElementById("editAge").value;
    const gender  = document.getElementById("editGender").value;
    const contact = document.getElementById("editContact").value;
    const email   = document.getElementById("editEmail").value;
    const address = document.getElementById("editAddress").value;

    if (!validator.name(name))         return toast("Invalid name");
    if (!validator.age(age))           return toast("Age must be greater than 0");
    if (!validator.gender(gender))     return toast("Select gender");
    if (!validator.contact(contact))   return toast("Contact must be 10 digits");
    if (!validator.email(email || "")) return toast("Invalid email");

    const pts = storageAPI.getPatients();
    const idx = pts.findIndex(p => p.id === id);
    if (idx === -1) return toast("Patient not found");

    pts[idx] = { ...pts[idx], name, age, gender, contact, email, address };
    storageAPI.setPatients(pts);
  }

  const q = document.getElementById("patientSearch")?.value || "";
  renderPatientsTable(q);
  if (location.hash === "#home") {
    renderAppointmentsTable();
    updateDashboardStats(); // keep counts in sync if visible
  }
  modal.hide();
  toast("Patient updated!");
}

function openPatientBookingsModal(patientId) {
  const bookingsDiv = document.getElementById("bookingsList");
  const appts = storageAPI.getAppointments().filter(a => a.patientId === patientId);
  const docs = storageAPI.getDoctors();
  const deps = storageAPI.getDepartments();

  if (appts.length === 0) {
    bookingsDiv.innerHTML = `<div class="text-muted">No appointments for this patient.</div>`;
  } else {
    bookingsDiv.innerHTML = appts.map(a => {
      const doc = storageAPI.byId(docs, a.doctorId);
      const dep = storageAPI.byId(deps, a.departmentId);
      return `
        <div class="border rounded p-2 mb-2">
          <div><strong>Date:</strong> ${a.date} &nbsp; <strong>Time:</strong> ${a.time}</div>
          <div><strong>Department:</strong> ${dep ? dep.name : "-"} &nbsp; <strong>Doctor:</strong> ${doc ? doc.name : "-"}</div>
          <div class="small text-muted">Appt ID: ${a.id}</div>
        </div>
      `;
    }).join("");
  }

  const modal = new bootstrap.Modal(document.getElementById("patientBookingsModal"));
  modal.show();
}

function deletePatient(id) {
  if (!confirm("Delete this patient and their appointments?")) return;

  const pts = storageAPI.getPatients().filter(p => p.id !== id);
  storageAPI.setPatients(pts);

  const appts = storageAPI.getAppointments().filter(a => a.patientId !== id);
  storageAPI.setAppointments(appts);

  const q = document.getElementById("patientSearch")?.value || "";
  renderPatientsTable(q);
  if (location.hash === "#home") {
    renderAppointmentsTable();
    updateDashboardStats(); // keep counts in sync if visible
  }
  toast("Patient and their appointments deleted.");
}

// ===========================
// BOOT
// ===========================
window.addEventListener("DOMContentLoaded", () => {
  setupRouting();
  handleRouting();     // show initial view
  handlePatientForm(); // wire registration form
});
