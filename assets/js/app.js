const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbyvoSrqR0x3ZPXz8hO6keyJRLvY0FswtJziwUFLW_JbkibLIYeBTrl-nijL3YJ7msMvoA/exec",
  MAX_UPLOAD_MB: 8,
  MAX_IMAGE_WIDTH: 1600,
  JPEG_QUALITY: 0.78
};

const qs = (s) => document.querySelector(s);

document.addEventListener("DOMContentLoaded", () => {
  qs("#year").textContent = new Date().getFullYear();

  const savedTheme = localStorage.getItem("dap-theme");
  if (savedTheme === "dark") document.body.classList.add("dark");

  qs("#themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("dap-theme", document.body.classList.contains("dark") ? "dark" : "light");
  });

  qs("#trackBtn").addEventListener("click", trackIssue);
  qs("#trackRef").addEventListener("keydown", (e) => {
    if (e.key === "Enter") trackIssue();
  });

  setupIssueForm();
  setupSuccessModal();

  if (isConfigured()) {
    loadPublicData();
  } else {
    qs("#formStatus").textContent = "Backend अभी configure नहीं है।";
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

    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set("callback", cb);

    const cleanup = () => {
      try { delete window[cb]; } catch (e) {}
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
      jsonp({ action: "stats" }),
      jsonp({ action: "works" }),
      jsonp({ action: "contacts" }),
      jsonp({ action: "notices" })
    ]);

    renderStats(stats);
    renderWorks(works);
    renderContacts(contacts);
    renderNotices(notices);
  } catch (e) {
    console.warn("Public data load failed:", e);
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
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function renderWorks(res) {
  if (!res || !res.ok) return;
  const items = res.data || [];
  const grid = qs("#worksGrid");

  if (!items.length) {
    grid.innerHTML = '<div class="empty-card">अभी कोई सत्यापित विकास कार्य प्रकाशित नहीं है।</div>';
    return;
  }

  grid.innerHTML = items.map((w) => `
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

  grid.innerHTML = items.map((c) => `
    <article class="contact-card">
      <h3>${esc(c.role)}</h3>
      <p>${esc(c.name || "नाम सत्यापन लंबित")}</p>
      ${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : "<p>Public contact pending</p>"}
    </article>
  `).join("");
}

function renderNotices(res) {
  if (!res || !res.ok) return;
  const items = res.data || [];
  if (items.length) {
    qs("#noticeTicker").textContent = items.map((n) => n.title).join("   •   ");
  }
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
    const res = await jsonp({ action: "track", reference: ref });

    if (!res.ok || !res.data) {
      msg.textContent = res.message || "Reference number नहीं मिला।";
      return;
    }

    const d = res.data;
    msg.textContent = "";

    if (d.privateView) {
      box.innerHTML = `
        <h3>शिकायत प्राप्त हुई</h3>
        <dl>
          <div><dt>Reference</dt><dd>${esc(d.reference)}</dd></div>
          <div><dt>Status</dt><dd>${esc(d.status)}</dd></div>
          <div><dt>Last Updated</dt><dd>${esc(d.updatedAt || "—")}</dd></div>
        </dl>
        <div class="helper">Verification पूरा होने तक निजी विवरण public tracking में नहीं दिखाए जाते।</div>`;
    } else {
      box.innerHTML = `
        <h3>${esc(d.category || "शिकायत")}</h3>
        <dl>
          <div><dt>Reference</dt><dd>${esc(d.reference)}</dd></div>
          <div><dt>Status</dt><dd>${esc(d.status)}</dd></div>
          <div><dt>स्थान</dt><dd>${esc(d.location || "—")}</dd></div>
          <div><dt>Latest Update</dt><dd>${esc(d.latestUpdate || "—")}</dd></div>
          <div><dt>Last Updated</dt><dd>${esc(d.updatedAt || "—")}</dd></div>
        </dl>`;
    }

    box.classList.remove("hidden");
  } catch (e) {
    msg.textContent = "Status load नहीं हो पाया। कृपया बाद में दोबारा कोशिश करें।";
  }
}

function setupIssueForm() {
  const form = qs("#issueForm");
  const fileInput = qs("#issuePhoto");
  const status = qs("#formStatus");

  fileInput.addEventListener("change", () => {
    const file = fileInput.files && fileInput.files[0];
    const info = qs("#photoInfo");

    if (!file) {
      info.textContent = "फोटो Admin review के लिए सुरक्षित Drive folder में रखी जाएगी।";
      return;
    }

    const mb = file.size / (1024 * 1024);
    info.textContent = `${file.name} • ${mb.toFixed(2)} MB`;

    if (mb > CONFIG.MAX_UPLOAD_MB) {
      info.textContent = `फोटो बहुत बड़ी है। अधिकतम ${CONFIG.MAX_UPLOAD_MB} MB रखें।`;
      fileInput.value = "";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!isConfigured()) {
      status.textContent = "Backend अभी configure नहीं है।";
      return;
    }

    if (!form.reportValidity()) return;

    const btn = qs("#submitIssueBtn");
    btn.disabled = true;
    form.classList.add("submitting");
    status.textContent = "शिकायत तैयार की जा रही है…";

    try {
      const file = fileInput.files && fileInput.files[0];

      clearPhotoFields();

      if (file) {
        status.textContent = "फोटो optimize की जा रही है…";
        const photo = await preparePhoto(file);
        qs("#photoBase64").value = photo.base64;
        qs("#photoMime").value = photo.mime;
        qs("#photoName").value = photo.name;
      }

      status.textContent = "शिकायत सुरक्षित रूप से भेजी जा रही है…";
      form.action = CONFIG.API_URL;

      submissionTimer = setTimeout(() => {
        btn.disabled = false;
        form.classList.remove("submitting");
        status.textContent = "Server response में देर हो रही है। कृपया Sheet check करें या दोबारा कोशिश करें।";
      }, 30000);

      HTMLFormElement.prototype.submit.call(form);
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      form.classList.remove("submitting");
      status.textContent = err.message || "फोटो तैयार नहीं हो पाई। JPG/PNG/WEBP फोटो इस्तेमाल करें।";
    }
  });

  window.addEventListener("message", handleSubmissionMessage);
}

let submissionTimer = null;

function handleSubmissionMessage(event) {
  const allowed =
    event.origin === "https://script.google.com" ||
    event.origin.endsWith(".googleusercontent.com");

  if (!allowed) return;

  const data = event.data;
  if (!data || data.source !== "dhaurahara-portal") return;

  if (submissionTimer) {
    clearTimeout(submissionTimer);
    submissionTimer = null;
  }

  const form = qs("#issueForm");
  const btn = qs("#submitIssueBtn");
  const status = qs("#formStatus");

  btn.disabled = false;
  form.classList.remove("submitting");

  if (!data.ok) {
    status.textContent = data.message || "Submission failed. कृपया दोबारा कोशिश करें।";
    return;
  }

  status.innerHTML = `✅ शिकायत दर्ज हो गई। Reference: <b>${esc(data.reference)}</b>`;
  const reference = data.reference;

  form.reset();
  clearPhotoFields();
  qs("#photoInfo").textContent = "फोटो Admin review के लिए सुरक्षित Drive folder में रखी जाएगी।";

  showSuccess(reference);
  loadPublicData();
}

function clearPhotoFields() {
  qs("#photoBase64").value = "";
  qs("#photoMime").value = "";
  qs("#photoName").value = "";
}

async function preparePhoto(file) {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    throw new Error("कृपया JPG, PNG या WEBP फोटो चुनें।");
  }

  if (file.size > CONFIG.MAX_UPLOAD_MB * 1024 * 1024) {
    throw new Error(`फोटो अधिकतम ${CONFIG.MAX_UPLOAD_MB} MB हो सकती है।`);
  }

  const dataUrl = await readAsDataURL(file);
  const image = await loadImage(dataUrl);

  const scale = Math.min(1, CONFIG.MAX_IMAGE_WIDTH / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(image, 0, 0, width, height);

  const outputMime = "image/jpeg";
  const compressed = canvas.toDataURL(outputMime, CONFIG.JPEG_QUALITY);
  const base64 = compressed.split(",")[1];

  if (!base64 || base64.length > 3_000_000) {
    throw new Error("फोटो अभी भी बहुत बड़ी है। कृपया छोटी फोटो चुनें।");
  }

  const safeBase = (file.name || "issue-photo")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 50) || "issue-photo";

  return {
    base64,
    mime: outputMime,
    name: safeBase + ".jpg"
  };
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("फोटो पढ़ी नहीं जा सकी।"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("फोटो format support नहीं हुआ।"));
    img.src = src;
  });
}

function setupSuccessModal() {
  qs("#successClose").addEventListener("click", hideSuccess);
  qs("#successDone").addEventListener("click", hideSuccess);

  qs("#copyReference").addEventListener("click", async () => {
    const ref = qs("#successReference").textContent;
    try {
      await navigator.clipboard.writeText(ref);
      qs("#copyReference").textContent = "Copied";
      setTimeout(() => qs("#copyReference").textContent = "Copy", 1200);
    } catch (e) {
      qs("#copyReference").textContent = "Copy manually";
    }
  });

  qs("#trackThisReference").addEventListener("click", () => {
    const ref = qs("#successReference").textContent;
    hideSuccess();
    qs("#trackRef").value = ref;
    qs("#track").scrollIntoView({ behavior: "smooth" });
    setTimeout(trackIssue, 450);
  });

  qs("#successModal").addEventListener("click", (e) => {
    if (e.target.id === "successModal") hideSuccess();
  });
}

function showSuccess(reference) {
  qs("#successReference").textContent = reference;
  qs("#successModal").classList.add("show");
  qs("#successModal").setAttribute("aria-hidden", "false");
}

function hideSuccess() {
  qs("#successModal").classList.remove("show");
  qs("#successModal").setAttribute("aria-hidden", "true");
}

function shareWork(title) {
  const text = encodeURIComponent(`धौरहरा आबादकारी ग्राम विकास पोर्टल\n\n${title}\n${location.href}`);
  window.open("https://wa.me/?text=" + text, "_blank", "noopener");
}
