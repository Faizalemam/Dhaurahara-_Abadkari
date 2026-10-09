const SHEETS = {
  SETTINGS: "Settings",
  WORKS: "Works",
  ISSUES: "Issues",
  NOTICES: "Notices",
  CONTACTS: "Contacts",
  PRADHANS: "Pradhans"
};

function setupProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ensureSheet_(ss, SHEETS.SETTINGS, [
    "Key","Value"
  ], [
    ["Village","Dhaurahara Abadkari"],
    ["Post","Padari Piparpanti"],
    ["Block","Vishunpura"],
    ["Tehsil","Padrauna"],
    ["District","Kushinagar"],
    ["State","Uttar Pradesh"]
  ]);

  ensureSheet_(ss, SHEETS.WORKS, [
    "ID","Title","Description","Status","FinancialYear","Cost","Location","Tenure",
    "Source","SourceURL","PhotoURL","Published","CreatedAt","UpdatedAt"
  ]);

  ensureSheet_(ss, SHEETS.ISSUES, [
    "Reference","SubmittedAt","Name","Mobile","Category","Location","Description",
    "Status","LatestUpdate","UpdatedAt","Published","Source"
  ]);

  ensureSheet_(ss, SHEETS.NOTICES, [
    "ID","Title","NoticeDate","Active","Priority","CreatedAt"
  ]);

  ensureSheet_(ss, SHEETS.CONTACTS, [
    "ID","Role","Name","Phone","Public","SortOrder","UpdatedAt"
  ]);

  ensureSheet_(ss, SHEETS.PRADHANS, [
    "ID","Name","TenureFrom","TenureTo","PhotoURL","Notes","Verified","Source","SourceURL"
  ]);

  SpreadsheetApp.flush();
  return "Setup completed.";
}

function ensureSheet_(ss, name, headers, sampleRows) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.getRange(1,1,1,headers.length)
      .setFontWeight("bold")
      .setBackground("#0d7a4d")
      .setFontColor("#ffffff");
    sh.setFrozenRows(1);

    if (sampleRows && sampleRows.length) {
      sh.getRange(2,1,sampleRows.length,sampleRows[0].length).setValues(sampleRows);
    }
    sh.autoResizeColumns(1, headers.length);
  }
  return sh;
}

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "").trim();
  const callback = String((e && e.parameter && e.parameter.callback) || "").trim();

  let result;
  try {
    switch (action) {
      case "stats":
        result = {ok:true, data:getStats_()};
        break;
      case "works":
        result = {ok:true, data:getWorks_()};
        break;
      case "contacts":
        result = {ok:true, data:getContacts_()};
        break;
      case "notices":
        result = {ok:true, data:getNotices_()};
        break;
      case "track":
        result = trackIssue_(String(e.parameter.reference || ""));
        break;
      case "health":
        result = {ok:true, message:"Dhaurahara Portal API is running"};
        break;
      default:
        result = {ok:false, message:"Unknown action"};
    }
  } catch (err) {
    result = {ok:false, message:"Server error"};
  }

  return output_(result, callback);
}

function doPost(e) {
  try {
    const p = e.parameter || {};
    if (String(p.action || "") !== "submitIssue") {
      return HtmlService.createHtmlOutput("Invalid action");
    }

    const ref = sanitize_(p.reference, 40) || makeReference_();
    const name = sanitize_(p.name, 80);
    const mobile = sanitize_(p.mobile, 20);
    const category = sanitize_(p.category, 60);
    const location = sanitize_(p.location, 140);
    const description = sanitize_(p.description, 1200);
    const source = sanitize_(p.source, 30) || "website";

    if (!name || !category || !location || !description) {
      return HtmlService.createHtmlOutput("Missing required fields");
    }

    const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.ISSUES);
    if (!sh) throw new Error("Issues sheet missing");

    const now = new Date();
    sh.appendRow([
      ref, now, name, mobile, category, location, description,
      "Pending Verification", "Submitted for admin review", now, false, source
    ]);

    return HtmlService.createHtmlOutput(
      "<!doctype html><meta charset='utf-8'><body style='font-family:Arial;padding:20px'>"+
      "<h3>Submission received</h3><p>Reference: <b>"+escapeHtml_(ref)+"</b></p></body>"
    );
  } catch (err) {
    return HtmlService.createHtmlOutput("Submission failed");
  }
}

function getStats_() {
  const works = getWorks_();
  const issues = rows_(SHEETS.ISSUES);

  return {
    works: works.length,
    completed: works.filter(x => /complete|पूर्ण/i.test(x.status)).length,
    inProgress: works.filter(x => /progress|प्रगति/i.test(x.status)).length,
    pendingIssues: issues.filter(r =>
      truthy_(r.Published) && !/resolved|समाधान/i.test(String(r.Status || ""))
    ).length
  };
}

function getWorks_() {
  return rows_(SHEETS.WORKS)
    .filter(r => truthy_(r.Published))
    .map(r => ({
      id: safeOut_(r.ID),
      title: safeOut_(r.Title),
      description: safeOut_(r.Description),
      status: safeOut_(r.Status),
      financialYear: safeOut_(r.FinancialYear),
      cost: safeOut_(r.Cost),
      location: safeOut_(r.Location),
      tenure: safeOut_(r.Tenure),
      source: safeOut_(r.Source),
      sourceURL: safeUrl_(r.SourceURL),
      photoURL: safeUrl_(r.PhotoURL)
    }));
}

function getContacts_() {
  return rows_(SHEETS.CONTACTS)
    .filter(r => truthy_(r.Public))
    .sort((a,b) => Number(a.SortOrder || 999) - Number(b.SortOrder || 999))
    .map(r => ({
      role: safeOut_(r.Role),
      name: safeOut_(r.Name),
      phone: safePhone_(r.Phone)
    }));
}

function getNotices_() {
  return rows_(SHEETS.NOTICES)
    .filter(r => truthy_(r.Active))
    .sort((a,b) => Number(a.Priority || 999) - Number(b.Priority || 999))
    .slice(0,10)
    .map(r => ({
      title: safeOut_(r.Title),
      date: formatDate_(r.NoticeDate)
    }));
}

function trackIssue_(reference) {
  const ref = sanitize_(reference, 40).toUpperCase();
  if (!ref) return {ok:false, message:"Reference required"};

  const items = rows_(SHEETS.ISSUES);
  const r = items.find(x => String(x.Reference || "").toUpperCase() === ref);

  if (!r || !truthy_(r.Published)) {
    return {ok:false, message:"Reference number नहीं मिला या अभी verification में है।"};
  }

  return {
    ok:true,
    data:{
      reference:safeOut_(r.Reference),
      category:safeOut_(r.Category),
      location:safeOut_(r.Location),
      status:safeOut_(r.Status),
      latestUpdate:safeOut_(r.LatestUpdate),
      updatedAt:formatDateTime_(r.UpdatedAt)
    }
  };
}

function rows_(sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];

  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(String);

  return values
    .filter(row => row.some(v => v !== ""))
    .map(row => {
      const obj = {};
      headers.forEach((h,i) => obj[h] = row[i]);
      return obj;
    });
}

function output_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function makeReference_() {
  const tz = Session.getScriptTimeZone() || "Asia/Kolkata";
  const year = Utilities.formatDate(new Date(), tz, "yyyy");
  const random = Utilities.getUuid().replace(/-/g,"").slice(0,8).toUpperCase();
  return "DAP-" + year + "-" + random;
}

function sanitize_(value, maxLen) {
  let s = String(value == null ? "" : value).trim();
  s = s.replace(/[\u0000-\u001F\u007F]/g, " ");
  s = s.replace(/^[=+\-@]/, "'");
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function safeOut_(v) {
  return sanitize_(v, 2000);
}

function safeUrl_(v) {
  const s = String(v || "").trim();
  return /^https:\/\/[^\s]+$/i.test(s) ? s : "";
}

function safePhone_(v) {
  const s = String(v || "").replace(/[^\d+\-\s()]/g,"").trim();
  return s.slice(0,25);
}

function truthy_(v) {
  return v === true || String(v).toLowerCase() === "true" || String(v) === "1" || String(v).toLowerCase() === "yes";
}

function formatDate_(v) {
  if (!v) return "";
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || "Asia/Kolkata", "dd MMM yyyy");
  }
  return safeOut_(v);
}

function formatDateTime_(v) {
  if (!v) return "";
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || "Asia/Kolkata", "dd MMM yyyy, hh:mm a");
  }
  return safeOut_(v);
}

function escapeHtml_(s) {
  return String(s || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
