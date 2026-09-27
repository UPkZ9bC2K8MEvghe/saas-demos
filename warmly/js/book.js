const $ = (s) => document.querySelector(s);
let state = seedIfEmpty();
let topic = state.host.topics[0];
let picked = null;
let editId = new URLSearchParams(location.search).get("edit");

function fmt(iso) {
  const d = new Date(iso);
  return `${d.toLocaleString("en-US", { month: "short", day: "numeric" })} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function draw() {
  const h = state.host;
  const busy = busySet(state);
  const slots = upcomingSlots(h, busy, 8);
  const editing = state.bookings.find((b) => b.id === editId);
  $("#card").innerHTML = `
    <div class="who-row">
      <div class="avatar"></div>
      <div>
        <p class="host-name">${h.name}</p>
        <p class="one-liner">${h.bio}</p>
        <p class="meta">${h.tz} · pick a topic, write what you want to cover, then pick a time</p>
      </div>
    </div>
    ${editing ? `<p class="hint">You're rescheduling. Previous time ${fmt(editing.at)}. Pick a new slot — no new booking flow.</p>` : ""}
    <div class="topics" id="topics">
      ${h.topics.map((t) => `<button type="button" class="chip ${t === topic ? "on" : ""}" data-t="${t}">${t}</button>`).join("")}
    </div>
    <div class="slots" id="slots">
      ${slots
        .slice(0, 8)
        .map(
          (s) =>
            `<button type="button" class="slot ${picked === s.at ? "on" : ""}" data-at="${s.at}">${fmt(s.at)}</button>`
        )
        .join("")}
    </div>
    <form id="bookForm" style="margin-top:16px">
      <label>Your name</label>
      <input name="guest" required value="${editing ? editing.guest : ""}" />
      <label>Email</label>
      <input name="email" type="email" required value="${editing ? editing.email : ""}" />
      <label>What do you want to talk about? (required — keeps the thread going)</label>
      <textarea name="note" required placeholder="e.g. Want to hear how you split pricing. Not closing today.">${editing ? editing.note : ""}</textarea>
      <button class="btn" style="margin-top:14px" type="submit">${editing ? "Confirm new time" : "Book and send calendars"}</button>
    </form>
    <p class="hint" style="margin-top:10px">After confirm you get a reschedule link. No need to ask ${h.name} for a new one.</p>
  `;
  $("#topics").onclick = (e) => {
    const b = e.target.closest("[data-t]");
    if (!b) return;
    topic = b.dataset.t;
    draw();
  };
  $("#slots").onclick = (e) => {
    const b = e.target.closest("[data-at]");
    if (!b) return;
    picked = b.dataset.at;
    draw();
  };
  $("#bookForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!picked) {
      alert("Pick a time first");
      return;
    }
    const guest = e.target.guest.value.trim();
    const email = e.target.email.value.trim();
    const note = e.target.note.value.trim();
    if (editing) {
      editing.at = picked;
      editing.topic = topic;
      editing.note = note;
      editing.status = "confirmed";
      editing.guest = guest;
      editing.email = email;
    } else {
      state.bookings.push({
        id: crypto.randomUUID(),
        guest,
        email,
        topic,
        note,
        at: picked,
        status: "confirmed",
        host: h.name,
      });
    }
    save(state);
    const last = editing || state.bookings[state.bookings.length - 1];
    $("#card").innerHTML = `
      <p class="kicker">On the calendar</p>
      <h2 class="host-name">${fmt(last.at)}</h2>
      <p>With ${h.name} · ${last.topic}</p>
      <p class="hint">“${last.note}”</p>
      <p class="meta">Confirmation generated (demo). Need to move? Use the link below. No new booking round.</p>
      <p><a class="btn" href="book.html?edit=${last.id}">Reschedule yourself</a>
      <a class="btn ghost" href="app.html">Host view</a></p>
    `;
  });
}

draw();
