    // ---------------------------
    // STORAGE HELPERS + SEED DATA
    // ---------------------------

    const store = {
    load(key, fallback = []) {
        try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
        console.warn("load failed for", key, e);
        return fallback;
        }
    },
    save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },
    ensureArray(key) {
        const arr = this.load(key, []);
        if (!Array.isArray(arr)) {
        this.save(key, []);
        return [];
        }
        return arr;
    }
    };

    // simple unique id
    function uid(prefix) {
    const rnd = Math.random().toString(36).slice(2, 7);
    const ts = Date.now().toString(36);
    return `${prefix}_${ts}${rnd}`;
    }

    // seed data for first load
    function seedData() {
    if (!localStorage.getItem("departments")) {
        const departments = [
        { id: "dep_cardio", name: "Cardiology" },
        { id: "dep_ent",    name: "ENT" },
        { id: "dep_ortho",  name: "Orthopedics" },
        { id: "dep_neuro",  name: "Neurology" }
        ];
        store.save("departments", departments);
    }

    if (!localStorage.getItem("doctors")) {
        const doctors = [
        { id: "doc_meena",  name: "Dr. R. Meena",  departmentId: "dep_cardio", slots: ["09:00","09:30","10:00","10:30","11:00"] },
        { id: "doc_arun",   name: "Dr. Arun V",    departmentId: "dep_ent",    slots: ["10:00","10:30","11:00","11:30","12:00"] },
        { id: "doc_rahul",  name: "Dr. Rahul S",   departmentId: "dep_ortho",  slots: ["09:00","09:30","10:00","10:30","11:00"] },
        { id: "doc_nisha",  name: "Dr. Nisha K",   departmentId: "dep_neuro",  slots: ["13:00","13:30","14:00","14:30","15:00"] }
        ];
        store.save("doctors", doctors);
    }

    // make sure these exist as arrays
    store.ensureArray("patients");
    store.ensureArray("appointments");
    }

    // convenient getters
    function getDepartments()  { return store.load("departments", []); }
    function getDoctors()      { return store.load("doctors", []); }
    function getPatients()     { return store.load("patients", []); }
    function getAppointments() { return store.load("appointments", []); }

    // convenient setters
    function setPatients(arr)     { store.save("patients", arr); }
    function setAppointments(arr) { store.save("appointments", arr); }

    // lookups for joins
    function byId(list, id) { return list.find(x => x.id === id) || null; }

    // public API (attach to window for easy use)
    window.storageAPI = {
    store,
    uid,
    seedData,
    getDepartments,
    getDoctors,
    getPatients,
    getAppointments,
    setPatients,
    setAppointments,
    byId
    };

    // seed immediately on load
    seedData();
