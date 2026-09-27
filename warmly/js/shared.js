const KEY = "warmly.v2";

function defaultState() {
  return {
    host: {
      name: "Ke Lin",
      bio: "Helps independent consultants open the first call instead of filling a grid.",
      email: "ke@warmly.test",
      tz: "America/New_York",
      topics: ["Intro · 20 min", "Proposal · 40 min", "Follow-up · 25 min"],
      hours: { 1: ["09:00", "10:00", "14:30"], 2: ["09:00", "16:00"], 3: ["10:00", "14:00"], 4: ["09:00", "11:00", "15:00"], 5: ["09:00", "16:00"] },
    },
    seats: [
      { name: "Ke Lin", role: "Host · you", on: true },
      { name: "Jordan Shaw", role: "Sales", on: true },
      { name: "Open seat", role: "Waiting", on: false },
      { name: "Open seat", role: "Waiting", on: false },
      { name: "Open seat", role: "Waiting", on: false },
    ],
    bookings: [],
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.host) return s;
  } catch (_) {}
  return defaultState();
}
function save(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function seedIfEmpty() {
  const s = load();
  if (s.bookings.length) return s;
  const day = (offset, hm, extra) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const [h, m] = hm.split(":");
    d.setHours(+h, +m, 0, 0);
    return { at: d.toISOString(), ...extra };
  };
  s.bookings = [
    day(1, "10:00", {
      id: crypto.randomUUID(),
      guest: "Chen Yu",
      email: "yu@studio.test",
      topic: "Intro · 20 min",
      note: "Want to hear how you price independent designers. Not buying today.",
      status: "confirmed",
      host: "Ke Lin",
    }),
    day(2, "14:30", {
      id: crypto.randomUUID(),
      guest: "Maya Chen",
      email: "maya@northline.test",
      topic: "Proposal · 40 min",
      note: "The pricing page from last email — want to go deeper.",
      status: "confirmed",
      host: "Jordan Shaw",
    }),
    day(3, "09:00", {
      id: crypto.randomUUID(),
      guest: "Ivo",
      email: "ivo@helix.test",
      topic: "Follow-up · 25 min",
      note: "Need Friday afternoon. Timezones don't line up.",
      status: "reschedule",
      host: "Ke Lin",
    }),
  ];
  save(s);
  return s;
}

function busySet(state) {
  return new Set(state.bookings.filter((b) => b.status !== "cancelled").map((b) => b.at));
}

function upcomingSlots(host, busy, days = 7) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const wd = d.getDay();
    const hours = host.hours[wd] || [];
    hours.forEach((hm) => {
      const [h, m] = hm.split(":");
      const t = new Date(d);
      t.setHours(+h, +m, 0, 0);
      if (t <= now) return;
      const iso = t.toISOString();
      if (!busy.has(iso)) out.push({ at: iso, label: `${d.getMonth() + 1}/${d.getDate()} ${hm}` });
    });
  }
  return out;
}
