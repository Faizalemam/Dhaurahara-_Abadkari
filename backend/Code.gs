const SHEETS = {
  SETTINGS: "Settings",
  WORKS: "Works",
  ISSUES: "Issues",
  NOTICES: "Notices",
  CONTACTS: "Contacts",
  PRADHANS: "Pradhans",
  SCHOOLS: "Schools",
  SCHOOL_ISSUES: "SchoolIssues"
};

const ISSUE_HEADERS = [
  "Reference","SubmittedAt","Name","Mobile","Category","Location","Description",
  "Status","LatestUpdate","UpdatedAt","Published","Source",
  "PhotoFileId","PhotoName","PhotoURL"
];

const ISSUE_STATUSES = [
  "Pending Verification",
  "Approved",
  "In Progress",
  "Resolved",
  "Rejected"
];

const SCHOOL_HEADERS = [
  "ID","SchoolName","SchoolType","Management","Location","Classes","StudentCount",
  "HeadTeacher","PhotoURL","About","Facilities","Verified","Source","SourceURL",
  "Published","SortOrder","UpdatedAt"
];

const SCHOOL_ISSUE_HEADERS = [
  "ID","SchoolID","IssueTitle","Category","Description","Status","Priority",
  "PhotoURL","Source","SourceURL","Published","UpdatedAt"
];

const SCHOOL_ISSUE_STATUSES = ["Under Verification","Open","In Progress","Resolved"];
const SCHOOL_ISSUE_PRIORITIES = ["High","Medium","Low"];

const PHOTO_FOLDER_NAME = "Dhaurahara Portal - Issue Photos";

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("Dhaurahara Portal")
      .addItem("Setup / Repair Database", "setupProject")
      .addItem("Authorize Photo Storage", "authorizePhotoStorage")
      .addItem("Photo Folder Info", "showPhotoFolderInfo_")
      .addToUi();
  } catch (e) {}
}

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

  const issues = ensureSheet_(ss, SHEETS.ISSUES, ISSUE_HEADERS);

  ensureSheet_(ss, SHEETS.NOTICES, [
    "ID","Title","NoticeDate","Active","Priority","CreatedAt"
  ]);

  ensureSheet_(ss, SHEETS.CONTACTS, [
    "ID","Role","Name","Phone","Public","SortOrder","UpdatedAt"
  ]);

  ensureSheet_(ss, SHEETS.PRADHANS, [
    "ID","Name","TenureFrom","TenureTo","PhotoURL","Notes","Verified","Source","SourceURL"
  ]);

  const schools = ensureSheet_(ss, SHEETS.SCHOOLS, SCHOOL_HEADERS);
  const schoolIssues = ensureSheet_(ss, SHEETS.SCHOOL_ISSUES, SCHOOL_ISSUE_HEADERS);

  applyIssueValidation_(issues);
  applySchoolValidation_(schools, schoolIssues);

  SpreadsheetApp.flush();
  return "Setup completed. Database, school directory, school issues and complaint validation are ready. Run authorizePhotoStorage() separately for Drive photo permission.";
}

function authorizePhotoStorage() {
  const folder = ensurePhotoFolder_();
  return "Photo storage authorized. Folder: " + folder.getUrl();
}

function ensureSheet_(ss, name, headers, sampleRows) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  ensureHeaders_(sh, headers);

  if (sh.getLastRow() === 1 && sampleRows && sampleRows.length) {
    sh.getRange(2, 1, sampleRows.length, sampleRows[0].length).setValues(sampleRows);
  }

  sh.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#0d7a4d")
    .setFontColor("#ffffff");

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
  return sh;
}

function ensureHeaders_(sh, requiredHeaders) {
  const lastCol = Math.max(sh.getLastColumn(), requiredHeaders.length);
  const current = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);

  requiredHeaders.forEach((header, i) => {
    if (current[i] !== header) {
      sh.getRange(1, i + 1).setValue(header);
    }
  });
}

function applyIssueValidation_(sh) {
  const rows = Math.max(2, sh.getMaxRows() - 1);

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ISSUE_STATUSES, true)
    .setAllowInvalid(false)
    .build();

  sh.getRange(2, 8, rows, 1).setDataValidation(statusRule);
  sh.getRange(2, 11, rows, 1).insertCheckboxes();
}

function applySchoolValidation_(schools, schoolIssues) {
  const schoolRows = Math.max(2, schools.getMaxRows() - 1);
  schools.getRange(2, 12, schoolRows, 1).insertCheckboxes();
  schools.getRange(2, 15, schoolRows, 1).insertCheckboxes();

  const issueRows = Math.max(2, schoolIssues.getMaxRows() - 1);
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(SCHOOL_ISSUE_STATUSES, true)
    .setAllowInvalid(false)
    .build();
  const priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(SCHOOL_ISSUE_PRIORITIES, true)
    .setAllowInvalid(false)
    .build();

  schoolIssues.getRange(2, 6, issueRows, 1).setDataValidation(statusRule);
  schoolIssues.getRange(2, 7, issueRows, 1).setDataValidation(priorityRule);
  schoolIssues.getRange(2, 11, issueRows, 1).insertCheckboxes();
}

function showPhotoFolderInfo_() {
  const folder = ensurePhotoFolder_();
  SpreadsheetApp.getUi().alert(
    "Issue Photo Folder",
    "Photos are stored privately for admin review.\n\n" + folder.getUrl(),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
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
      case "schools":
        result = {ok:true, data:getSchools_()};
        break;
      case "track":
        result = trackIssue_(String(e.parameter.reference || ""));
        break;
      case "health":
        result = {
          ok:true,
          message:"Dhaurahara Portal API is running",
          version:"2.2"
        };
        break;
      default:
        result = {ok:false, message:"Unknown action"};
    }
  } catch (err) {
    console.error(err);
    result = {ok:false, message:"Server error"};
  }

  return output_(result, callback);
}

function doPost(e) {
  let payload;

  try {
    const p = (e && e.parameter) || {};

    if (String(p.action || "") !== "submitIssue") {
      return submissionOutput_({ok:false, message:"Invalid action"});
    }

    const name = sanitize_(p.name, 80);
    const mobile = sanitize_(p.mobile, 20);
    const category = sanitize_(p.category, 60);
    const location = sanitize_(p.location, 140);
    const description = sanitize_(p.description, 1200);
    const source = sanitize_(p.source, 30) || "website";

    if (!name || !category || !location || !description) {
      return submissionOutput_({ok:false, message:"Required fields missing"});
    }

    const reference = nextReference_();

    let photo = {fileId:"", fileName:"", fileUrl:""};
    const photoBase64 = String(p.photoBase64 || "").trim();

    if (photoBase64) {
      photo = saveIssuePhoto_(
        reference,
        photoBase64,
        String(p.photoMime || ""),
        String(p.photoName || "issue-photo.jpg")
      );
    }

    const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.ISSUES);
    if (!sh) throw new Error("Issues sheet missing");

    const now = new Date();

    sh.appendRow([
      reference,
      now,
      name,
      mobile,
      category,
      location,
      description,
      "Pending Verification",
      "Submitted for admin review",
      now,
      false,
      source,
      photo.fileId,
      photo.fileName,
      photo.fileUrl
    ]);

    payload = {
      ok:true,
      reference:reference,
      message:"Issue submitted successfully"
    };

  } catch (err) {
    console.error(err);
    payload = {
      ok:false,
      message: safeErrorMessage_(err)
    };
  }

  return submissionOutput_(payload);
}

function submissionOutput_(payload) {
  const json = JSON.stringify({
    source:"dhaurahara-portal",
    ok:Boolean(payload.ok),
    reference:payload.reference || "",
    message:payload.message || ""
  }).replace(/</g, "\\u003c");

  const html =
    "<!doctype html><html><head><meta charset='utf-8'></head><body>" +
    "<script>window.parent.postMessage(" + json + ", '*');</script>" +
    "</body></html>";

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function nextReference_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const tz = Session.getScriptTimeZone() || "Asia/Kolkata";
    const year = Utilities.formatDate(new Date(), tz, "yyyy");
    const key = "ISSUE_SEQUENCE_" + year;
    const props = PropertiesService.getScriptProperties();

    let seq = Number(props.getProperty(key) || 0);

    if (!seq) {
      const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.ISSUES);

      if (sh && sh.getLastRow() > 1) {
        const refs = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().flat();
        const re = new RegExp("^DAP-" + year + "-(\\d{4,})$");

        refs.forEach((ref) => {
          const m = String(ref).trim().match(re);
          if (m) seq = Math.max(seq, Number(m[1]) || 0);
        });
      }
    }

    seq += 1;
    props.setProperty(key, String(seq));

    return "DAP-" + year + "-" + String(seq).padStart(4, "0");

  } finally {
    lock.releaseLock();
  }
}

function saveIssuePhoto_(reference, base64, mimeType, fileName) {
  const allowed = {
    "image/jpeg": true,
    "image/png": true,
    "image/webp": true
  };

  mimeType = String(mimeType || "").toLowerCase();
  if (!allowed[mimeType]) {
    throw new Error("Unsupported photo type");
  }

  if (base64.length > 3000000) {
    throw new Error("Photo is too large");
  }

  let bytes;
  try {
    bytes = Utilities.base64Decode(base64);
  } catch (e) {
    throw new Error("Invalid photo data");
  }

  if (bytes.length > 2300000) {
    throw new Error("Photo is too large");
  }

  const safeName = sanitizeFileName_(fileName || "issue-photo.jpg");
  const finalName = reference + "_" + safeName;

  const blob = Utilities.newBlob(bytes, mimeType, finalName);
  const folder = ensurePhotoFolder_();
  const file = folder.createFile(blob);

  return {
    fileId:file.getId(),
    fileName:file.getName(),
    fileUrl:file.getUrl()
  };
}

function ensurePhotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty("PHOTO_FOLDER_ID");

  if (existingId) {
    try {
      return DriveApp.getFolderById(existingId);
    } catch (e) {}
  }

  const matches = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  const folder = matches.hasNext() ? matches.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
  props.setProperty("PHOTO_FOLDER_ID", folder.getId());
  return folder;
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

function getSchools_() {
  const publishedIssues = rows_(SHEETS.SCHOOL_ISSUES)
    .filter(r => truthy_(r.Published))
    .map(r => ({
      id:safeOut_(r.ID),
      schoolId:safeOut_(r.SchoolID),
      title:safeOut_(r.IssueTitle),
      category:safeOut_(r.Category),
      description:safeOut_(r.Description),
      status:safeOut_(r.Status || "Under Verification"),
      priority:safeOut_(r.Priority),
      photoURL:safeUrl_(r.PhotoURL),
      source:safeOut_(r.Source),
      sourceURL:safeUrl_(r.SourceURL),
      updatedAt:formatDateTime_(r.UpdatedAt)
    }));

  const bySchool = {};
  publishedIssues.forEach(issue => {
    const key = String(issue.schoolId || "").trim();
    if (!key) return;
    (bySchool[key] ||= []).push(issue);
  });

  return rows_(SHEETS.SCHOOLS)
    .filter(r => truthy_(r.Published))
    .sort((a,b) => Number(a.SortOrder || 999) - Number(b.SortOrder || 999))
    .map(r => {
      const id = safeOut_(r.ID);
      return {
        id:id,
        name:safeOut_(r.SchoolName),
        type:safeOut_(r.SchoolType),
        management:safeOut_(r.Management),
        location:safeOut_(r.Location),
        classes:safeOut_(r.Classes),
        studentCount:safeOut_(r.StudentCount),
        headTeacher:safeOut_(r.HeadTeacher),
        photoURL:safeUrl_(r.PhotoURL),
        about:safeOut_(r.About),
        facilities:safeOut_(r.Facilities),
        verified:truthy_(r.Verified),
        source:safeOut_(r.Source),
        sourceURL:safeUrl_(r.SourceURL),
        updatedAt:formatDateTime_(r.UpdatedAt),
        issues:bySchool[String(id)] || []
      };
    });
}

function trackIssue_(reference) {
  const ref = sanitize_(reference, 40).toUpperCase();
  if (!ref) return {ok:false, message:"Reference required"};

  const items = rows_(SHEETS.ISSUES);
  const r = items.find(x => String(x.Reference || "").toUpperCase() === ref);

  if (!r) {
    return {ok:false, message:"Reference number नहीं मिला।"};
  }

  const isPublic = truthy_(r.Published);

  if (!isPublic) {
    return {
      ok:true,
      data:{
        reference:safeOut_(r.Reference),
        status:safeOut_(r.Status || "Pending Verification"),
        updatedAt:formatDateTime_(r.UpdatedAt || r.SubmittedAt),
        privateView:true
      }
    };
  }

  return {
    ok:true,
    data:{
      reference:safeOut_(r.Reference),
      category:safeOut_(r.Category),
      location:safeOut_(r.Location),
      status:safeOut_(r.Status),
      latestUpdate:safeOut_(r.LatestUpdate),
      updatedAt:formatDateTime_(r.UpdatedAt),
      privateView:false
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

function sanitize_(value, maxLen) {
  let s = String(value == null ? "" : value).trim();
  s = s.replace(/[\u0000-\u001F\u007F]/g, " ");
  s = s.replace(/^[=+\-@]/, "'");
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function sanitizeFileName_(value) {
  let s = String(value || "issue-photo.jpg").trim();
  s = s.replace(/[\\\/:*?"<>|#%{}[\]]/g, "-");
  s = s.replace(/\s+/g, "-");
  if (s.length > 90) s = s.slice(-90);
  return s || "issue-photo.jpg";
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
  return v === true ||
    String(v).toLowerCase() === "true" ||
    String(v) === "1" ||
    String(v).toLowerCase() === "yes";
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

function safeErrorMessage_(err) {
  const msg = String(err && err.message || "");
  if (/photo.*large/i.test(msg)) return "Photo बहुत बड़ी है। कृपया छोटी फोटो चुनें।";
  if (/unsupported photo/i.test(msg)) return "केवल JPG, PNG या WEBP फोटो स्वीकार है।";
  if (/invalid photo/i.test(msg)) return "Photo data invalid है। कृपया दोबारा कोशिश करें।";
  return "Submission failed. कृपया दोबारा कोशिश करें।";
}
