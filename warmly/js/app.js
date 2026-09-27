const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

let state = seedIfEmpty();

function switchTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  $$(".panel").forEach((p) => p.classList.toggle("show", p.id === `panel-${name}`));
}

function fmt(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function showMail(title, body, kicker) {
  $("#mailKicker").textContent = kicker || "Calendar update";
  $("#mailTitle").textContent = title;
  $("#mailBody").textContent = body;
  $("#mailModal").classList.add("show");
}

function renderWeek() {
  const live = state.bookings.filter((b) => b.status !== "cancelled");
  $("#stOk").textContent = live.filter((b) => b.status === "confirmed").length;
  $("#stShift").textContent = live.filter((b) => b.status === "reschedule").length;
  $("#stSeat").textContent = `${state.seats.filter((s) => s.on).length} / 5`;
  const list = $("#bookList");
  if (!live.length) {
    list.innerHTML = `<div class="empty">Nobody this week. Send the public booking page.</div>`;
    return;
  }
  list.innerHTML = live
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((b) => {
      const next = upcomingSlots(state.host, busySet(state), 10).find((s) => s.at !== b.at);
      return `<article class="item">
        <div>
          <b>${b.guest}</b>
          <div class="meta">${b.topic} · ${b.host} · ${fmt(b.at)}</div>
          <div class="hint">“${b.note}”</div>
        </div>
        <div class="meta">${b.email}<br />${b.status === "reschedule" ? "Guest wants to move" : "Confirmed"}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn ghost" data-ics="${b.id}">Calendar</button>
          <button class="btn ghost" data-shift="${b.id}" ${next ? "" : "disabled"}>Move to next slot</button>
          <button class="btn ghost" data-cancel="${b.id}">Cancel</button>
        </div>
      </article>`;
    })
    .join("");
  list.onclick = (e) => {
    const shift = e.target.closest("[data-shift]");
    const cancel = e.target.closest("[data-cancel]");
    const ics = e.target.closest("[data-ics]");
    if (shift) {
      const b = state.bookings.find((x) => x.id === shift.dataset.shift);
      const next = upcomingSlots(state.host, busySet(state), 10).find((s) => s.at !== b.at);
      if (!next) return;
      const old = fmt(b.at);
      b.at = next.at;
      b.status = "confirmed";
      save(state);
      showMail(
        `Reschedule confirmed · ${b.guest}`,
        `Previous time ${old} cancelled.\nNew time ${fmt(b.at)} (${state.host.tz})\nTopic: ${b.topic}\n\nBoth calendars updated. No extra email thread.\n— Warmly`,
        "Self-serve reschedule"
      );
      renderWeek();
    }
    if (cancel) {
      const b = state.bookings.find((x) => x.id === cancel.dataset.cancel);
      b.status = "cancelled";
      save(state);
      showMail(`Cancelled · ${b.guest}`, `${fmt(b.at)} “${b.topic}” removed from the calendar. The slot is open again.`, "Cancel");
      renderWeek();
    }
    if (ics) {
      const b = state.bookings.find((x) => x.id === ics.dataset.ics);
      showMail(
        "Calendar event",
        `BEGIN:VEVENT\nSUMMARY:${b.topic} with ${b.guest}\nDTSTART:${b.at}\nDESCRIPTION:${b.note}\nSTATUS:${b.status}\nEND:VEVENT`,
        "ICS preview"
      );
    }
  };
}

function renderPage() {
  const h = state.host;
  const f = $("#hostForm");
  f.name.value = h.name;
  f.bio.value = h.bio;
  f.email.value = h.email;
  f.tz.value = h.tz;
  f.topics.value = h.topics.join(", ");
  $("#miniPreview").innerHTML = `
    <div class="who-row"><div class="avatar"></div><div><p class="host-name">${h.name}</p><p class="one-liner">${h.bio}</p></div></div>
    <div class="topics">${h.topics.map((t, i) => `<span class="chip ${i === 0 ? "on" : ""}">${t}</span>`).join("")}</div>
    <p class="hint">Timezone ${h.tz} · a note is required on the public page</p>
    <a class="btn" href="book.html">Open full booking page</a>
  `;
}

function renderSeats() {
  $("#seats").innerHTML = state.seats
    .map(
      (s, i) => `<div class="seat">
      <div class="avatar sm ${i % 2 ? "two" : ""}"></div>
      <div style="flex:1">
        <b>${s.name}</b>
        <div class="meta">${s.role}</div>
      </div>
      <button class="btn ghost" data-seat="${i}">${s.on ? "Occupied" : "Add seat"}</button>
    </div>`
    )
    .join("");
  $("#seats").onclick = (e) => {
    const b = e.target.closest("[data-seat]");
    if (!b) return;
    const s = state.seats[+b.dataset.seat];
    if (s.on && s.name === "Ke Lin") return;
    if (!s.on) {
      const name = prompt("Seat name", "New teammate");
      if (!name) return;
      s.name = name;
      s.role = "Teammate";
      s.on = true;
    } else {
      s.on = false;
      s.name = "Open seat";
      s.role = "Waiting";
    }
    save(state);
    renderSeats();
    renderWeek();
  };
}

$$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
$("#hostForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  state.host.name = f.name.value.trim();
  state.host.bio = f.bio.value.trim();
  state.host.email = f.email.value.trim();
  state.host.tz = f.tz.value;
  state.host.topics = f.topics.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
  save(state);
  renderPage();
});
$("#mailClose").addEventListener("click", () => $("#mailModal").classList.remove("show"));
$("#mailOk").addEventListener("click", () => $("#mailModal").classList.remove("show"));

renderWeek();
renderPage();
renderSeats();
