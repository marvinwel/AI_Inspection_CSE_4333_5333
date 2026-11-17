// AI Inspector - web app (plain JavaScript, no build step).
// Uses auth.js (Cognito) and your API Gateway endpoints.

const INSPECT_URL =
  "https://vdtbxy07nl.execute-api.us-east-1.amazonaws.com/inspect";
const FETCH_DATA_URL =
  "https://vdtbxy07nl.execute-api.us-east-1.amazonaws.com/fetch_data";

const MAX_IMAGE_WIDTH = 1280; // resize photos before upload
const JPEG_QUALITY = 0.7;

// ------------------------------------------------
// State
// ------------------------------------------------

let user = null;
let inspections = [];       // newest first
let loadState = "loading";  // loading | ready | error
let isLoading = false;
let lastLoaded = 0;

let historyFilter = "all";  // all | good | damaged
let historyQuery = "";

let currentResult = null;   // inspection shown on the Result page
let resultBackTo = "#history";

let stream = null;          // live camera stream
let facingMode = "environment";
let photoBlob = null;       // photo waiting to be analyzed
let photoUrl = null;

const $ = (id) => document.getElementById(id);

// ------------------------------------------------
// Helpers
// ------------------------------------------------

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toPercent(value) {
  let n = Number(value ?? 0);
  if (n <= 1) n *= 100;
  return Math.round(Math.max(0, Math.min(100, n)));
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortId(id) {
  const text = String(id || "");
  return text.length > 8 ? `${text.slice(0, 6)}…` : text;
}

function isDamaged(item) {
  return String(item.result || "").toLowerCase() === "damaged";
}

function isGood(item) {
  const r = String(item.result || "").toLowerCase();
  return r === "good" || r === "ok" || r === "normal";
}

function normalize(data = {}) {
  return {
    id: data.inspectionId || data.id || "Unknown",
    result: data.result || "Unknown",
    confidence: toPercent(data.confidence),
    timestamp: data.timestamp || new Date().toISOString(),
    imageKey: data.imageKey || "",
    imageUrl: data.imageUrl || data.imageURL || "",
  };
}

function toast(message, ms = 3000) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), ms);
}

function svgIcon(name) {
  return `<svg><use href="#i-${name}"/></svg>`;
}

// ------------------------------------------------
// API (every call carries the Cognito ID token)
// ------------------------------------------------

async function authFetch(url, options = {}) {
  const token = await Auth.getValidIdToken();
  if (!token) {
    Auth.login();
    throw new Error("Please sign in again.");
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });

  if (response.status === 401 || response.status === 403) {
    Auth.login();
    throw new Error("Your session expired. Please sign in again.");
  }

  return response;
}

async function loadInspections(force = false) {
  if (isLoading) return;
  if (!force && Date.now() - lastLoaded < 10000) return; // at most every 10s

  isLoading = true;
  try {
    const response = await authFetch(FETCH_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const items = Array.isArray(data) ? data : data.items || [];

    inspections = items
      .map(normalize)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    loadState = "ready";
    lastLoaded = Date.now();
  } catch (error) {
    console.error("Fetch inspections failed:", error);
    if (!inspections.length) loadState = "error";
  } finally {
    isLoading = false;
    renderAll();
  }
}

async function submitInspection(blob) {
  const response = await authFetch(INSPECT_URL, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Inspection failed (${response.status}) ${text}`.trim());
  }

  return normalize(await response.json());
}

// ------------------------------------------------
// Rendering
// ------------------------------------------------

function rowHtml(item, dark) {
  const damaged = isDamaged(item);
  const thumb = item.imageUrl
    ? `<img class="thumb" src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy"
         onerror="this.style.opacity='.25'" />`
    : `<span class="thumb">${svgIcon("cube")}</span>`;

  return `
    <button type="button" class="row" data-id="${escapeHtml(item.id)}">
      ${thumb}
      <span class="row-main">
        <span class="row-id" title="${escapeHtml(item.id)}">${escapeHtml(shortId(item.id))}</span>
        <span class="row-date">${escapeHtml(formatDate(item.timestamp))}</span>
      </span>
      <span class="row-right">
        <span class="badge ${damaged ? "damaged" : "good"}">${damaged ? "Damaged" : "Good"}</span>
        <span class="row-conf">${item.confidence}%</span>
      </span>
      ${dark ? `<svg class="chevron"><use href="#i-back"/></svg>` : ""}
    </button>`;
}

function renderHome() {
  const total = inspections.length;
  const ready = loadState !== "loading" || total;

  $("homeTotal").textContent = ready ? total : "–";
  $("homeGood").textContent = ready ? inspections.filter(isGood).length : "–";
  $("homeDamaged").textContent = ready ? inspections.filter(isDamaged).length : "–";

  const recent = inspections.slice(0, 3);
  $("recentList").innerHTML = recent.length
    ? recent.map((item) => rowHtml(item, false)).join("")
    : `<div class="empty">${
        loadState === "loading" ? "Loading…" :
        loadState === "error" ? "Couldn't load inspections." : "No inspections yet."
      }</div>`;
}

function renderHistory() {
  const query = historyQuery.trim().toLowerCase();

  const visible = inspections.filter((item) => {
    if (historyFilter === "good" && !isGood(item)) return false;
    if (historyFilter === "damaged" && !isDamaged(item)) return false;
    if (query) {
      const haystack = `${item.id} ${item.result}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const list = $("historyList");

  if (loadState === "error" && !inspections.length) {
    list.innerHTML = `
      <div class="retry">
        ${svgIcon("offline")}
        <p>Unable to load inspection history.</p>
        <button type="button" class="btn-primary" id="retryBtn">Try Again</button>
      </div>`;
    $("retryBtn").onclick = () => {
      loadState = "loading";
      renderHistory();
      loadInspections(true);
    };
    return;
  }

  list.innerHTML = visible.length
    ? visible.map((item) => rowHtml(item, true)).join("")
    : `<div class="empty light">${
        loadState === "loading" ? "Loading inspections…" : "No inspections found."
      }</div>`;
}

function startOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function renderStats() {
  const weekStart = startOfWeek();
  const week = inspections.filter((i) => new Date(i.timestamp) >= weekStart);

  const total = week.length;
  const good = week.filter(isGood).length;
  const damaged = week.filter(isDamaged).length;
  const pct = (n) => (total ? ((n / total) * 100).toFixed(1) : "0.0");

  $("weekTotal").textContent = total;
  $("weekGood").textContent = good;
  $("weekDamaged").textContent = damaged;
  $("weekGoodPct").textContent = `Good ${pct(good)}%`;
  $("weekDamagedPct").textContent = `Damaged ${pct(damaged)}%`;

  $("bdGood").textContent = good;
  $("bdDamaged").textContent = damaged;
  $("bdGoodPct").textContent = `${pct(good)}%`;
  $("bdDamagedPct").textContent = `${pct(damaged)}%`;

  // Daily bars, Monday to Sunday
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const daily = days.map((name, index) => {
    const start = new Date(weekStart);
    start.setDate(weekStart.getDate() + index);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const items = week.filter((i) => {
      const d = new Date(i.timestamp);
      return d >= start && d < end;
    });

    return {
      name,
      good: items.filter(isGood).length,
      damaged: items.filter(isDamaged).length,
    };
  });

  const max = Math.max(1, ...daily.map((d) => d.good + d.damaged));

  $("bars").innerHTML = daily
    .map(
      (d) => `
      <div class="bar-col">
        <div class="bar-group">
          <div class="bar green-bg" style="height:${(d.good / max) * 90}px"></div>
          <div class="bar red-bg" style="height:${(d.damaged / max) * 90}px"></div>
        </div>
        <span class="bar-day">${d.name}</span>
      </div>`
    )
    .join("");
}

function renderResult() {
  const item = currentResult;
  if (!item) return;

  const damaged = isDamaged(item);
  const page = $("view-result");
  page.classList.toggle("is-damaged", damaged);
  page.classList.toggle("is-good", !damaged);

  $("resultIcon").innerHTML = svgIcon(damaged ? "warning" : "check");
  $("resultTitle").textContent = damaged ? "DAMAGED BOX" : "GOOD BOX";
  $("resultConfidence").textContent = `${item.confidence}%`;
  $("resultId").textContent = item.id;
  $("resultDate").textContent = formatDate(item.timestamp);
  $("detailResult").textContent = damaged ? "Damaged" : "Good";
  $("detailConfidence").textContent = `${item.confidence}%`;
  $("resultBack").setAttribute("href", resultBackTo);

  const img = $("resultImage");
  const src = item.localUrl || item.imageUrl;
  if (src) {
    img.src = src;
    img.hidden = false;
    $("resultNoImage").hidden = true;
    img.onerror = () => {
      img.hidden = true;
      $("resultNoImage").hidden = false;
    };
  } else {
    img.hidden = true;
    $("resultNoImage").hidden = false;
  }
}

function renderProfile() {
  const name = user?.name || user?.email?.split("@")[0] || "Operator";
  $("homeName").textContent = name;
  $("profileName").textContent = name;
  $("profileEmail").textContent = user?.email || "";
  $("profileAvatar").textContent = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "OP";

  const hour = new Date().getHours();
  $("greetingText").textContent =
    hour < 12 ? "Good morning," : hour < 18 ? "Good afternoon," : "Good evening,";
  $("todayDate").textContent = new Date().toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderAll() {
  renderHome();
  renderHistory();
  renderStats();
}

// Tapping any inspection row opens its result
document.addEventListener("click", (event) => {
  const row = event.target.closest(".row[data-id]");
  if (!row) return;

  const item = inspections.find((i) => i.id === row.dataset.id);
  if (!item) return;

  currentResult = item;
  resultBackTo = window.location.hash || "#home";
  window.location.hash = "#result";
});

// ------------------------------------------------
// Camera + photos
// ------------------------------------------------

function cameraSupported() {
  return !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
}

async function startCamera() {
  stopCamera();

  if (photoBlob) return; // showing a chosen photo

  if (!cameraSupported()) {
    showFallback(
      "Live camera needs HTTPS. Tap the button to take a photo with your camera, or choose one from your gallery."
    );
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 } },
      audio: false,
    });

    // The user may have left the page while the permission prompt was open
    if (currentView() !== "inspect" || photoBlob) {
      stopCamera();
      return;
    }

    const video = $("cameraVideo");
    video.srcObject = stream;
    video.hidden = false;
    $("cameraFallback").hidden = true;
    $("flipBtn").hidden = false;
  } catch (error) {
    console.warn("Camera unavailable:", error);
    showFallback(
      "Camera access was blocked. Tap the button to take a photo, or choose one from your gallery."
    );
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  const video = $("cameraVideo");
  video.srcObject = null;
}

function showFallback(text) {
  $("cameraVideo").hidden = true;
  $("flipBtn").hidden = true;
  $("fallbackText").textContent = text;
  $("cameraFallback").hidden = false;
}

// Resize to MAX_IMAGE_WIDTH and convert to JPEG
function drawToJpeg(source, width, height) {
  const scale = Math.min(1, MAX_IMAGE_WIDTH / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))),
      "image/jpeg",
      JPEG_QUALITY
    )
  );
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a supported image."));
    };
    img.src = url;
  });
}

function setPhoto(blob) {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoBlob = blob;
  photoUrl = URL.createObjectURL(blob);

  stopCamera();
  const preview = $("photoPreview");
  preview.src = photoUrl;
  preview.hidden = false;
  $("cameraVideo").hidden = true;
  $("cameraFallback").hidden = true;
  $("flipBtn").hidden = true;

  $("captureRow").hidden = true;
  $("previewRow").hidden = false;
  $("inspectError").hidden = true;
}

function clearPhoto() {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoBlob = null;
  photoUrl = null;

  $("photoPreview").hidden = true;
  $("photoPreview").removeAttribute("src");
  $("captureRow").hidden = false;
  $("previewRow").hidden = true;
  $("inspectError").hidden = true;
}

async function capture() {
  // No live camera: open the phone's camera app instead
  if (!stream) {
    $("cameraInput").click();
    return;
  }

  const video = $("cameraVideo");
  if (!video.videoWidth) return;

  try {
    const blob = await drawToJpeg(video, video.videoWidth, video.videoHeight);
    setPhoto(blob);
  } catch (error) {
    showInspectError(error.message);
  }
}

async function handleFile(input) {
  const file = input.files?.[0];
  input.value = ""; // allow choosing the same file again
  if (!file) return;

  try {
    const img = await loadImage(file);
    const blob = await drawToJpeg(img, img.naturalWidth, img.naturalHeight);
    setPhoto(blob);
  } catch (error) {
    showInspectError(error.message);
  }
}

function showInspectError(message) {
  const el = $("inspectError");
  el.textContent = message;
  el.hidden = false;
}

async function analyze() {
  if (!photoBlob) return;

  const button = $("analyzeBtn");
  button.disabled = true;
  button.innerHTML = `<span class="spinner"></span> Analyzing…`;
  $("retakeBtn").disabled = true;
  $("inspectError").hidden = true;

  try {
    const result = await submitInspection(photoBlob);

    // Keep the local photo for the result page (the S3 link isn't signed yet)
    result.localUrl = photoUrl;
    photoUrl = null; // don't revoke it; the result page uses it
    photoBlob = null;

    inspections.unshift(result);
    renderAll();
    lastLoaded = 0; // fetch fresh data (with image link) next time

    currentResult = result;
    resultBackTo = "#inspect";
    clearPhoto();
    window.location.hash = "#result";
  } catch (error) {
    console.error(error);
    showInspectError(error.message || "Inspection failed. Please try again.");
  } finally {
    button.disabled = false;
    button.textContent = "Analyze";
    $("retakeBtn").disabled = false;
  }
}

$("shutterBtn").addEventListener("click", capture);
$("cameraInput").addEventListener("change", (e) => handleFile(e.target));
$("galleryInput").addEventListener("change", (e) => handleFile(e.target));
$("analyzeBtn").addEventListener("click", analyze);
$("retakeBtn").addEventListener("click", () => {
  clearPhoto();
  startCamera();
});
$("flipBtn").addEventListener("click", () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  startCamera();
});

// ------------------------------------------------
// History controls
// ------------------------------------------------

$("historySearch").addEventListener("input", (event) => {
  historyQuery = event.target.value;
  renderHistory();
});

document.querySelectorAll(".pill[data-filter]").forEach((pill) =>
  pill.addEventListener("click", () => {
    historyFilter = pill.dataset.filter;
    document
      .querySelectorAll(".pill[data-filter]")
      .forEach((p) => p.classList.toggle("active", p === pill));
    renderHistory();
  })
);

$("signOutBtn").addEventListener("click", () => {
  stopCamera();
  Auth.logout();
});

// ------------------------------------------------
// Navigation (#home, #history, #inspect, #stats, #profile, #result)
// ------------------------------------------------

const VIEWS = ["home", "history", "inspect", "stats", "profile", "result"];

function currentView() {
  const name = window.location.hash.replace("#", "");
  return VIEWS.includes(name) ? name : "home";
}

function route() {
  let name = currentView();

  // Result page needs an inspection to show
  if (name === "result" && !currentResult) {
    window.location.replace("#home");
    return;
  }

  VIEWS.forEach((view) => {
    $(`view-${view}`).hidden = view !== name;
  });

  document
    .querySelectorAll(".tabbar a")
    .forEach((a) => a.classList.toggle("active", a.dataset.tab === name));

  document.body.classList.toggle("no-tabbar", name === "result");
  window.scrollTo(0, 0);

  if (name === "inspect") {
    startCamera();
  } else {
    stopCamera();
  }

  if (name === "result") renderResult();
  if (name === "home" || name === "history" || name === "stats") loadInspections();
}

window.addEventListener("hashchange", route);

// Stop the camera when the tab is hidden, restart when back
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopCamera();
  else if (currentView() === "inspect") startCamera();
});

// ------------------------------------------------
// Start (only after sign-in)
// ------------------------------------------------

Auth.requireLogin().then((claims) => {
  user = claims || {};
  document.body.classList.remove("auth-pending");

  renderProfile();
  renderAll();
  route();
  loadInspections(true);
});
