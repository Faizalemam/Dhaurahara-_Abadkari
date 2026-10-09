const CONFIG = {
  // Apps Script deploy hone ke baad yahan Web App URL paste karein:
  API_URL: "https://script.google.com/macros/s/AKfycbyvoSrqR0x3ZPXz8hO6keyJRLvY0FswtJziwUFLW_JbkibLIYeBTrl-nijL3YJ7msMvoA/exec"
};

const qs = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];

document.addEventListener("DOMContentLoaded", () => {
  qs("#year").textContent = new Date().getFullYear();

  const savedTheme = localStorage.getItem("dap-theme");
  if (savedTheme === "dark") document.body.classList.add("dark");
  qs("#themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("dap-theme", document.body.classList.contains("dark") ? "dark" : "light");
  });

  qs("#trackBtn").addEventListener("click", trackIssue);
  qs("#trackRef").addEventListener("keydown", e => { if (e.key === "Enter") trackIssue(); });

  setupIssueForm();

  if (isConfigured()) {
    loadPublicData();
  } else {
    qs("#formStatus").textContent = "Backend अभी configure नहीं है। Apps Script Web App URL जोड़ने के बाद submission live हो जाएगा।";
  }
});

function isConfigured() {
  return CONFIG.API_URL && !CONFIG.API_URL.includes("PASTE_YOUR");
}

function jsonp(params) {
  return new Promise((resolve, reject) => {
    if (!isConfigured()) return reject(new Error("Backend not configured"));
    const cb = "dap_cb_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const url = new URL(CONFIG.API_URL);
    Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
    url.searchParams.set("callback", cb);

    const cleanup = () => {
      try { delete window[cb]; } catch(e) {}
      script.remove();
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Request timed out"));
    }, 12000);

    window[cb] = (data) => {
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("Request failed"));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

async function loadPublicData() {
  try {
    const [stats, works, contacts, notices] = await Promise.all([
      jsonp({action:"stats"}),
      jsonp({action:"works"}),
      jsonp({action:"contacts"}),
      jsonp({action:"notices"})
    ]);

    renderStats(stats);
    renderWorks(works);
    renderContacts(contacts);
    renderNotices(notices);
  } catch (e) {
    console.warn(e);
  }
}

function renderStats(res) {
  if (!res || !res.ok) return;
  const s = res.data || {};
  qs("#statWorks").textContent = s.works ?? "—";
  qs("#statCompleted").textContent = s.completed ?? "—";
  qs("#statProgress").textContent = s.inProgress ?? "—";
  qs("#statPending").textContent = s.pendingIssues ?? "—";
}

function statusChip(status) {
  const x = String(status || "").toLowerCase();
  if (x.includes("complete") || x.includes("पूर्ण") || x.includes("resolved") || x.includes("समाधान")) return "ok";
  if (x.includes("progress") || x.includes("प्रगति")) return "warn";
  return "bad";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function renderWorks(res) {
  if (!res || !res.ok) return;
  const items = res.data || [];
  const grid = qs("#worksGrid");
  if (!items.length) {
    grid.innerHTML = '<div class="empty-card">अभी कोई सत्यापित विकास कार्य प्रकाशित नहीं है।</div>';
    return;
  }
  grid.innerHTML = items.map(w => `
    <article class="work-card">
      <div class="work-cover"><h3>${esc(w.title)}</h3></div>
      <div class="work-body">
        <div class="chips">
          <span class="chip ${statusChip(w.status)}">${esc(w.status || "Status pending")}</span>
          <span class="chip source">${esc(w.source || "Source pending")}</span>
        </div>
        <p>${esc(w.description || "")}</p>
        <div class="work-meta">
          <div><small>वित्तीय वर्ष</small><b>${esc(w.financialYear || "—")}</b></div>
          <div><small>लागत</small><b>${esc(w.cost || "—")}</b></div>
          <div><small>स्थान</small><b>${esc(w.location || "—")}</b></div>
          <div><small>कार्यकाल</small><b>${esc(w.tenure || "—")}</b></div>
        </div>
        <button class="share-btn" onclick='shareWork(${JSON.stringify(String(w.title || ""))})'>WhatsApp Share</button>
      </div>
    </article>
  `).join("");
}

function renderContacts(res) {
  if (!res || !res.ok) return;
  const items = res.data || [];
  const grid = qs("#contactsGrid");
  if (!items.length) {
    grid.innerHTML = '<div class="empty-card">संपर्क सत्यापन के बाद यहाँ दिखाई देंगे।</div>';
    return;
  }
  grid.innerHTML = items.map(c => `
    <article class="contact-card">
      <h3>${esc(c.role)}</h3>
      <p>${esc(c.name || "नाम सत्यापन लंबित")}</p>
      ${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : `<p>Public contact pending</p>`}
    </article>
  `).join("");
}

function renderNotices(res) {
  if (!res || !res.ok) return;
  const items = res.data || [];
  if (items.length) qs("#noticeTicker").textContent = items.map(n => n.title).join("   •   ");
}

async function trackIssue() {
  const ref = qs("#trackRef").value.trim().toUpperCase();
  const msg = qs("#trackMessage");
  const box = qs("#trackResult");
  box.classList.add("hidden");

  if (!ref) {
    msg.textContent = "कृपया Reference Number दर्ज करें।";
    return;
  }
  if (!isConfigured()) {
    msg.textContent = "Backend अभी configure नहीं है।";
    return;
  }

  msg.textContent = "Status खोजा जा रहा है…";
  try {
    const res = await jsonp({action:"track", reference:ref});
    if (!res.ok || !res.data) {
      msg.textContent = res.message || "Reference number नहीं मिला।";
      return;
    }
    const d = res.data;
    msg.textContent = "";
    box.innerHTML = `
      <h3>${esc(d.category || "शिकायत")}</h3>
      <dl>
        <div><dt>Reference</dt><dd>${esc(d.reference)}</dd></div>
        <div><dt>Status</dt><dd>${esc(d.status)}</dd></div>
        <div><dt>स्थान</dt><dd>${esc(d.location || "—")}</dd></div>
        <div><dt>Latest Update</dt><dd>${esc(d.latestUpdate || "—")}</dd></div>
        <div><dt>Last Updated</dt><dd>${esc(d.updatedAt || "—")}</dd></div>
      </dl>`;
    box.classList.remove("hidden");
  } catch (e) {
    msg.textContent = "Status load नहीं हो पाया। कृपया बाद में दोबारा कोशिश करें।";
  }
}

function generateRef() {
  const d = new Date();
  const y = d.getFullYear();
  const stamp = `${d.getMonth()+1}`.padStart(2,"0") + `${d.getDate()}`.padStart(2,"0");
  const rand = Math.random().toString(36).slice(2,6).toUpperCase();
  return `DAP-${y}-${stamp}${rand}`;
}

function setupIssueForm() {
  const form = qs("#issueForm");
  form.addEventListener("submit", (e) => {
    if (!isConfigured()) {
      e.preventDefault();
      qs("#formStatus").textContent = "Backend अभी configure नहीं है। पहले Apps Script Web App URL जोड़ें।";
      return;
    }

    const ref = generateRef();
    qs("#referenceField").value = ref;
    form.action = CONFIG.API_URL;
    qs("#submitIssueBtn").disabled = true;
    qs("#formStatus").innerHTML = `भेजा जा रहा है… Reference: <b>${esc(ref)}</b>`;

    setTimeout(() => {
      qs("#formStatus").innerHTML = `✅ शिकायत भेज दी गई। आपका Reference: <b>${esc(ref)}</b><br>Admin verification के बाद status tracking उपलब्ध होगी।`;
      qs("#submitIssueBtn").disabled = false;
      form.reset();
    }, 1800);
  });
}

function shareWork(title) {
  const text = encodeURIComponent(`धौरहरा आबादकारी ग्राम विकास पोर्टल\n\n${title}\n${location.href}`);
  window.open("https://wa.me/?text=" + text, "_blank", "noopener");
}
