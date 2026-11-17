const WS_URL =
  "wss://s5p3td5072.execute-api.us-east-1.amazonaws.com/production/";
const FETCH_DATA_URL =
  "https://vdtbxy07nl.execute-api.us-east-1.amazonaws.com/fetch_data";

const rowsEl = document.getElementById("inspectionRows");
const emptyState = document.getElementById("emptyState");
const totalEl = document.getElementById("totalCount");
const okEl = document.getElementById("okCount");
const damagedEl = document.getElementById("damagedCount");
const avgConfidenceEl = document.getElementById("avgConfidence");
const totalPercentEl = document.getElementById("totalPercent");
const okPercentEl = document.getElementById("okPercent");
const damagedPercentEl = document.getElementById("damagedPercent");
const trendCanvas = document.getElementById("inspectionTrendChart");
const socketDot = document.getElementById("socketDot");
const socketStatus = document.getElementById("socketStatus");

// Inspections tab
const allRowsEl = document.getElementById("allInspectionRows");
const allEmptyState = document.getElementById("allEmptyState");
const inspectionsSummary = document.getElementById("inspectionsSummary");
const searchInput = document.getElementById("searchInput");
const refreshBtn = document.getElementById("refreshBtn");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

const PAGE_SIZE = 50;
let resultFilter = "all"; // all | ok | damaged
let searchQuery = "";
let shownCount = PAGE_SIZE;
let historyState = "loading"; // loading | ready | error
let isFetching = false;

const inspections = [];
let socket;
let reconnectTimer;
let trendChart;

function normalizeConfidence(value) {
  let n = Number(value ?? 0);
  if (n <= 1) n *= 100;
  return Math.max(0, Math.min(100, n));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(timestamp) {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}


function normalizeInspection(data = {}) {
  return {
    inspectionId:
      data.inspectionId ||
      data.inspection_id ||
      data.id ||
      data.InspectionId ||
      "Unknown",
    result:
      data.result ||
      data.prediction ||
      data.status ||
      data.classification ||
      "Unknown",
    confidence: normalizeConfidence(
      data.confidence ?? data.score ?? data.probability ?? 0
    ),
    imageUrl:
      data.imageUrl ||
      data.imageURL ||
      data.image_url ||
      data.presignedUrl ||
      data.presigned_url ||
      "",
    timestamp:
      data.timestamp ||
      data.createdAt ||
      data.created_at ||
      data.time ||
      new Date().toISOString(),
    userEmail: data.userEmail || "",
    userName: data.userName || "",
  };
}

function inspectionKey(item) {
  return `${item.inspectionId}|${item.timestamp}`;
}

function isOkResult(result) {
  const value = String(result || "").toLowerCase();
  return value === "good" || value === "ok" || value === "normal";
}

function isDamagedResult(result) {
  return String(result || "").toLowerCase() === "damaged";
}

function sortInspectionsNewestFirst() {
  inspections.sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime() || 0;
    const bTime = new Date(b.timestamp).getTime() || 0;
    return bTime - aTime;
  });
}

function getLastSevenDaysTrend() {
  const labels = [];
  const dayKeys = [];
  const today = new Date();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    dayKeys.push(key);
    labels.push(
      date.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    );
  }

  const okCounts = new Array(7).fill(0);
  const damagedCounts = new Array(7).fill(0);

  inspections.forEach((item) => {
    const date = new Date(item.timestamp);
    if (Number.isNaN(date.getTime())) return;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const index = dayKeys.indexOf(key);
    if (index === -1) return;

    if (isOkResult(item.result)) okCounts[index] += 1;
    if (isDamagedResult(item.result)) damagedCounts[index] += 1;
  });

  return { labels, okCounts, damagedCounts };
}

function updateTrendChart() {
  if (!trendCanvas || typeof Chart === "undefined") return;

  const { labels, okCounts, damagedCounts } = getLastSevenDaysTrend();

  if (!trendChart) {
    trendChart = new Chart(trendCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "OK",
            data: okCounts,
            borderColor: "#249a8a",
            backgroundColor: "#249a8a",
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: "Damaged",
            data: damagedCounts,
            borderColor: "#f04b59",
            backgroundColor: "#f04b59",
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            position: "top",
            align: "start",
            labels: {
              color: "#dce4f1",
              usePointStyle: true,
              boxWidth: 8,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#aebad0" },
            grid: { color: "rgba(145,160,183,.10)" },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: "#aebad0",
              precision: 0,
            },
            grid: { color: "rgba(145,160,183,.12)" },
          },
        },
      },
    });
    return;
  }

  trendChart.data.labels = labels;
  trendChart.data.datasets[0].data = okCounts;
  trendChart.data.datasets[1].data = damagedCounts;
  trendChart.update();
}

function extractInspectionArray(payload) {
  if (Array.isArray(payload)) return payload;

  if (typeof payload === "string") {
    try {
      return extractInspectionArray(JSON.parse(payload));
    } catch {
      return [];
    }
  }

  if (!payload || typeof payload !== "object") return [];

  // Common API Gateway/Lambda response shapes.
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.inspections)) return payload.inspections;
  if (payload.body !== undefined) return extractInspectionArray(payload.body);

  return [];
}

async function fetchPreviousInspections() {
  if (isFetching) return;
  isFetching = true;
  setRefreshing(true);

  try {
    const token = await Auth.getValidIdToken();
    if (!token) return Auth.login();

    const response = await fetch(FETCH_DATA_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      Auth.login(); // token missing/expired -> back to login
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const previous = extractInspectionArray(payload).map(normalizeInspection);
    const existing = new Map(inspections.map((item) => [inspectionKey(item), item]));

    previous.forEach((item) => {
      const key = inspectionKey(item);
      const match = existing.get(key);

      if (match) {
        // Presigned image URLs expire, so take the fresh one.
        if (item.imageUrl) match.imageUrl = item.imageUrl;
      } else {
        inspections.push(item);
        existing.set(key, item);
      }
    });

    sortInspectionsNewestFirst();

    // Keep enough history for the trend while limiting browser memory.
    if (inspections.length > 500) inspections.length = 500;

    historyState = "ready";
    renderRows();
    updateStats();
    updateTrendChart();
    renderAllInspections();
  } catch (error) {
    console.error("Unable to fetch previous inspections:", error);
    historyState = "error";
    renderAllInspections();
  } finally {
    isFetching = false;
    setRefreshing(false);
  }
}

function setRefreshing(busy) {
  if (!refreshBtn) return;
  refreshBtn.disabled = busy;
  refreshBtn.textContent = busy ? "Refreshing…" : "↻ Refresh";
}

function updateStats() {
  const total = inspections.length;
  const ok = inspections.filter((i) => isOkResult(i.result)).length;
  const damaged = inspections.filter((i) => isDamagedResult(i.result)).length;

  const average =
    total === 0
      ? 0
      : inspections.reduce(
          (sum, i) => sum + normalizeConfidence(i.confidence),
          0
        ) / total;

  const okPercent = total ? (ok / total) * 100 : 0;
  const damagedPercent = total ? (damaged / total) * 100 : 0;
  const totalPercent = total ? 100 : 0;

  totalEl.textContent = total.toLocaleString();
  okEl.textContent = ok.toLocaleString();
  damagedEl.textContent = damaged.toLocaleString();
  avgConfidenceEl.textContent = `${average.toFixed(1)}%`;

  if (totalPercentEl) totalPercentEl.textContent = `${totalPercent.toFixed(1)}%`;
  if (okPercentEl) okPercentEl.textContent = `${okPercent.toFixed(1)}%`;
  if (damagedPercentEl) damagedPercentEl.textContent = `${damagedPercent.toFixed(1)}%`;
}

function addInspection(data) {
  const inspection = normalizeInspection(data);
  const key = inspectionKey(inspection);

  if (inspections.some((item) => inspectionKey(item) === key)) {
    return;
  }

  inspections.unshift(inspection);

  // Keep enough history for the trend while limiting browser memory.
  if (inspections.length > 500) inspections.pop();

  renderRows();
  updateStats();
  updateTrendChart();
  renderAllInspections();

  // Live damaged box: pop-up + optional desktop notification
  if (isDamagedResult(inspection.result)) {
    raiseDamageAlert(inspection);
  }
}

function renderRows() {
  emptyState.style.display = inspections.length ? "none" : "block";

  rowsEl.innerHTML = inspections
    .slice(0, 20)
    .map((item, index) => inspectionRowHtml(item, index === 0))
    .join("");
}

// ---------- Inspections tab ----------

function filteredInspections() {
  const query = searchQuery.trim().toLowerCase();

  return inspections.filter((item) => {
    if (resultFilter === "ok" && !isOkResult(item.result)) return false;
    if (resultFilter === "damaged" && !isDamagedResult(item.result)) return false;
    if (query && !String(item.inspectionId).toLowerCase().includes(query)) return false;
    return true;
  });
}

function renderAllInspections() {
  if (!allRowsEl) return;

  const list = filteredInspections();
  const visible = list.slice(0, shownCount);

  allRowsEl.innerHTML = visible
    .map((item) => inspectionRowHtml(item, false))
    .join("");

  let emptyText = "";
  if (!visible.length) {
    if (historyState === "loading") emptyText = "Loading inspections…";
    else if (historyState === "error") emptyText = "Couldn't load inspections. Try Refresh.";
    else if (inspections.length) emptyText = "No inspections match your search or filter.";
    else emptyText = "No inspections yet.";
  }
  allEmptyState.textContent = emptyText;
  allEmptyState.style.display = visible.length ? "none" : "block";

  loadMoreBtn.hidden = list.length <= shownCount;

  if (historyState === "loading" && !inspections.length) {
    inspectionsSummary.textContent = "Loading inspections…";
  } else if (list.length === inspections.length) {
    inspectionsSummary.textContent = `${inspections.length.toLocaleString()} inspections`;
  } else {
    inspectionsSummary.textContent =
      `Showing ${list.length.toLocaleString()} of ${inspections.length.toLocaleString()} inspections`;
  }

  // Alerts, analytics and settings are built from the same data
  renderAlerts();
  if (currentView === "analytics") renderAnalytics();
  if (currentView === "settings") renderSettings();
}

// ---------- Alerts (damaged inspections) ----------

const ALERTS_READ_KEY = "aiInspector.alertsLastRead";
const alertBadge = document.getElementById("alertBadge");
const alertList = document.getElementById("alertList");
const alertsSummary = document.getElementById("alertsSummary");
const markReadBtn = document.getElementById("markReadBtn");
const notifyBtn = document.getElementById("notifyBtn");
const toastStack = document.getElementById("toastStack");

// Everything older than this time counts as "read".
// First visit: existing history is treated as read; only new damage is unread.
let alertsLastRead = (() => {
  try {
    const saved = Number(localStorage.getItem(ALERTS_READ_KEY));
    if (saved) return saved;
    const now = Date.now();
    localStorage.setItem(ALERTS_READ_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
})();

function damagedInspections() {
  return inspections.filter((item) => isDamagedResult(item.result));
}

function isUnread(item) {
  return new Date(item.timestamp).getTime() > alertsLastRead;
}

function unreadCount() {
  return damagedInspections().filter(isUnread).length;
}

function updateAlertBadge() {
  const count = unreadCount();
  if (alertBadge) {
    alertBadge.hidden = count === 0;
    alertBadge.textContent = count > 99 ? "99+" : String(count);
  }

  // Show the count in the browser tab title too
  const title = VIEWS[currentView || "dashboard"]?.title || "Dashboard";
  document.title = `${count ? `(${count}) ` : ""}${title} · AI Inspector`;
}

function renderAlerts() {
  if (!alertList) return;

  const alerts = damagedInspections();
  const unread = alerts.filter(isUnread).length;

  if (!alerts.length) {
    alertList.innerHTML = `<div class="empty-state">${
      historyState === "loading" ? "Loading alerts…" :
      historyState === "error" ? "Couldn't load alerts. Try again shortly." :
      "No damaged boxes so far. 🎉"
    }</div>`;
  } else {
    alertList.innerHTML = alerts
      .slice(0, 100)
      .map((item) => {
        const fresh = isUnread(item);
        const fullId = String(item.inspectionId);
        const shortId = fullId.length > 8 ? `${fullId.slice(0, 6)}…` : fullId;
        const who = item.userName || item.userEmail;

        return `
          <article class="alert-item${fresh ? " unread" : ""}">
            ${
              item.imageUrl
                ? `<a href="${escapeHtml(item.imageUrl)}" target="_blank" rel="noopener">
                     <img class="thumb" src="${escapeHtml(item.imageUrl)}" alt="Damaged box"
                          onerror="this.style.opacity='.25'" />
                   </a>`
                : `<div class="thumb alert-thumb">⚠</div>`
            }
            <div class="alert-body">
              <div class="alert-title">
                <span class="alert-icon">⚠</span>
                Damaged box detected
                ${fresh ? `<span class="new-pill">NEW</span>` : ""}
              </div>
              <div class="alert-meta">
                <span class="alert-id" title="${escapeHtml(fullId)}">${escapeHtml(shortId)}</span>
                <span>· ${item.confidence.toFixed(1)}% confidence</span>
                ${who ? `<span>· by ${escapeHtml(who)}</span>` : ""}
              </div>
            </div>
            <time class="alert-time">${escapeHtml(formatTime(item.timestamp))}</time>
          </article>`;
      })
      .join("");
  }

  if (alertsSummary) {
    alertsSummary.textContent = alerts.length
      ? `${unread} unread · ${alerts.length} total`
      : historyState === "loading" ? "Loading alerts…" : "All clear";
  }
  if (markReadBtn) markReadBtn.disabled = unread === 0;

  updateAlertBadge();
  updateNotifyButton();
}

function markAllAlertsRead() {
  alertsLastRead = Date.now();
  try {
    localStorage.setItem(ALERTS_READ_KEY, String(alertsLastRead));
  } catch {
    /* private mode: read state lasts for this page only */
  }
  renderAlerts();
}

if (markReadBtn) markReadBtn.addEventListener("click", markAllAlertsRead);

// Pop-up in the corner of the dashboard
function showToast(item) {
  if (!toastStack) return;

  const toast = document.createElement("button");
  toast.type = "button";
  toast.className = "toast";
  const fullId = String(item.inspectionId);
  toast.innerHTML = `
    <span class="toast-icon">⚠</span>
    <span class="toast-text">
      <strong>Damaged box detected</strong>
      <small>${escapeHtml(fullId.slice(0, 6))}… · ${item.confidence.toFixed(1)}% confidence</small>
    </span>`;
  toast.addEventListener("click", () => {
    window.location.hash = "#alerts";
    toast.remove();
  });

  toastStack.prepend(toast);
  while (toastStack.children.length > 3) toastStack.lastElementChild.remove();
  setTimeout(() => toast.remove(), 8000);
}

// Desktop notification (only when the dashboard tab is in the background)
function canNotify() {
  return "Notification" in window && window.isSecureContext;
}

function updateNotifyButton() {
  if (!notifyBtn) return;
  notifyBtn.hidden = !canNotify() || Notification.permission !== "default";
}

if (notifyBtn) {
  notifyBtn.addEventListener("click", async () => {
    try {
      await Notification.requestPermission();
    } catch {
      /* ignore */
    }
    updateNotifyButton();
  });
}

function raiseDamageAlert(item) {
  showToast(item);

  if (canNotify() && Notification.permission === "granted" && document.hidden) {
    try {
      const note = new Notification("⚠ Damaged box detected", {
        body: `${String(item.inspectionId).slice(0, 6)}… · ${item.confidence.toFixed(1)}% confidence`,
        tag: String(item.inspectionId),
      });
      note.onclick = () => {
        window.focus();
        window.location.hash = "#alerts";
        note.close();
      };
    } catch {
      /* some mobile browsers don't allow page notifications */
    }
  }
}

if (searchInput) {
  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    shownCount = PAGE_SIZE;
    renderAllInspections();
  });
}

document.querySelectorAll(".pill[data-filter]").forEach((pill) =>
  pill.addEventListener("click", () => {
    resultFilter = pill.dataset.filter;
    shownCount = PAGE_SIZE;
    document
      .querySelectorAll(".pill[data-filter]")
      .forEach((p) => p.classList.toggle("active", p === pill));
    renderAllInspections();
  })
);

if (refreshBtn) refreshBtn.addEventListener("click", fetchPreviousInspections);

if (loadMoreBtn) {
  loadMoreBtn.addEventListener("click", () => {
    shownCount += PAGE_SIZE;
    renderAllInspections();
  });
}

// ---------- Views (Dashboard | Inspections) ----------

const VIEWS = {
  dashboard: {
    el: document.getElementById("dashboardView"),
    title: "Dashboard",
    subtitle: "Real-time overview of inspection activities",
  },
  inspections: {
    el: document.getElementById("inspectionsView"),
    title: "Inspections",
    subtitle: "Every inspection, with search and filters",
  },
  alerts: {
    el: document.getElementById("alertsView"),
    title: "Alerts",
    subtitle: "Damaged boxes flagged by the model",
  },
  analytics: {
    el: document.getElementById("analyticsView"),
    title: "Analytics",
    subtitle: "Trends in inspection volume, damage and model confidence",
  },
  settings: {
    el: document.getElementById("settingsView"),
    title: "Settings",
    subtitle: "Your account, notifications and sign out",
  },
};

let currentView = null;

function showView() {
  const requested = window.location.hash.replace("#", "");
  const name = VIEWS[requested] ? requested : "dashboard";

  Object.entries(VIEWS).forEach(([key, view]) => {
    if (view.el) view.el.hidden = key !== name;
  });

  document.querySelectorAll(".nav-item[data-view]").forEach((link) =>
    link.classList.toggle("active", link.dataset.view === name)
  );

  pageTitle.textContent = VIEWS[name].title;
  pageSubtitle.textContent = VIEWS[name].subtitle;

  // Opening a list tab reloads history so image links are fresh.
  if ((name === "inspections" || name === "alerts") && currentView !== null && currentView !== name) {
    fetchPreviousInspections();
  }

  currentView = name;
  updateAlertBadge(); // also sets the browser tab title

  if (name === "analytics") renderAnalytics();
  if (name === "settings") renderSettings();
}

window.addEventListener("hashchange", showView);

// Tap a shortened ID (phones) to show / hide the full ID.
document.addEventListener("click", (event) => {
  const cell = event.target.closest(".id-cell");
  if (cell) cell.classList.toggle("show-full");
});

// Placeholder nav links (Analytics, Settings) don't navigate yet.
document.querySelectorAll(".nav-item.placeholder").forEach((link) =>
  link.addEventListener("click", (event) => event.preventDefault())
);

function inspectionRowHtml(item, highlight) {
      const isDamaged =
        String(item.result).toLowerCase() === "damaged";

      const resultClass = isDamaged ? "damaged" : "ok";
      const resultLabel = isDamaged ? "DAMAGED" : "OK";
      const confidence = item.confidence.toFixed(1);

      // Phones show the first 6 characters; tap to see the full ID.
      const fullId = String(item.inspectionId);
      const shortId = fullId.length > 8 ? `${fullId.slice(0, 6)}…` : fullId;

      return `
        <tr class="${highlight ? "new-row" : ""}">
          <td class="id-cell" title="${escapeHtml(fullId)}">
            <span class="id-full">${escapeHtml(fullId)}</span>
            <span class="id-short">${escapeHtml(shortId)}</span>
          </td>

          <td>
            ${
              item.imageUrl
                ? `<a href="${escapeHtml(item.imageUrl)}" target="_blank" rel="noopener">
                     <img
                       class="thumb"
                       src="${escapeHtml(item.imageUrl)}"
                       alt="Inspection image"
                       onerror="this.style.opacity='.25'"
                     />
                   </a>`
                : `<div class="thumb"></div>`
            }
          </td>

          <td>
            <span class="result-badge ${resultClass}">
              ${resultLabel}
            </span>
          </td>

          <td class="confidence-cell">
            <div class="confidence-line">
              <span>${confidence}%</span>
              <div class="progress">
                <div style="width:${confidence}%"></div>
              </div>
            </div>
          </td>

          <td>${escapeHtml(formatTime(item.timestamp))}</td>
        </tr>
      `;
}

function setSocketStatus(connected) {
  socketDot.classList.toggle("online", connected);
  socketDot.classList.toggle("offline", !connected);
  socketStatus.textContent = connected ? "Live Updates On" : "Disconnected";
}

async function connectWebSocket() {
  clearTimeout(reconnectTimer);

  // Gets a valid token, renewing it silently if it expired (e.g. tab open > 1 hour).
  const token = await Auth.getValidIdToken();
  if (!token) {
    Auth.login();
    return;
  }

  socketStatus.textContent = "Connecting...";

  // Browsers can't set headers on WebSockets, so the token goes in the query string.
  // The $connect Lambda authorizer reads it from there.
  socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);

  socket.onopen = () => {
    console.log("WebSocket connected");
    setSocketStatus(true);
  };

  socket.onmessage = (event) => {
    console.log("WebSocket message:", event.data);

    try {
      const data = JSON.parse(event.data);

      // Your Stream Lambda sends type: "newInspection"
      if (!data.type || data.type === "newInspection") {
        addInspection(data);
      }
    } catch (error) {
      console.error("Unable to parse WebSocket message:", error);
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket disconnected");
    setSocketStatus(false);

    // Reconnect automatically after 3 seconds.
    reconnectTimer = setTimeout(connectWebSocket, 3000);
  };
}

let signedInUser = {};

function showSignedInUser(user) {
  signedInUser = user || {};
  const nameEl = document.getElementById("userName");
  const avatarEl = document.getElementById("userAvatar");
  const name = user.name || user.email || user["cognito:username"] || "User";

  if (nameEl) nameEl.textContent = name;
  if (avatarEl) {
    avatarEl.textContent = name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", Auth.logout);
}

// ---------- Analytics ----------

// Colors validated for red-green colorblindness on the dark panel (#101e31)
const OK_COLOR = "#249a8a";
const DAMAGED_COLOR = "#f04b59";
const VOLUME_COLOR = "#536dfe";
const TICK_COLOR = "#aebad0";
const GRID_COLOR = "rgba(145,160,183,.12)";
const PANEL_COLOR = "#0f1c2e";

let analyticsDays = 7;
const analyticsCharts = {};

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rangeStart(days) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function hourLabel(hour) {
  const suffix = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${suffix}`;
}

function baseChartOptions(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        align: "start",
        labels: { color: "#dce4f1", usePointStyle: true, boxWidth: 8 },
      },
      tooltip: { backgroundColor: "#0a1421", borderColor: "#2b3f5c", borderWidth: 1 },
    },
    scales: {
      x: { ticks: { color: TICK_COLOR, maxRotation: 0, autoSkip: true }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: TICK_COLOR, precision: 0 }, grid: { color: GRID_COLOR } },
    },
    ...extra,
  };
}

function upsertChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas || typeof Chart === "undefined") return;

  const existing = analyticsCharts[id];
  if (existing) {
    existing.data.labels = config.data.labels;
    config.data.datasets.forEach((ds, i) => {
      existing.data.datasets[i].data = ds.data;
    });
    existing.update();
    return;
  }
  analyticsCharts[id] = new Chart(canvas, config);
}

function renderAnalytics() {
  const days = analyticsDays;
  const start = rangeStart(days);
  const items = inspections.filter((i) => {
    const t = new Date(i.timestamp);
    return !Number.isNaN(t.getTime()) && t >= start;
  });

  // ----- Daily buckets -----
  const keys = [];
  const labels = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    keys.push(dayKey(d));
    labels.push(d.toLocaleDateString([], { month: "short", day: "numeric" }));
  }
  const okDaily = new Array(days).fill(0);
  const damagedDaily = new Array(days).fill(0);
  const hourly = new Array(24).fill(0);
  const confBuckets = new Array(5).fill(0); // <60, 60-70, 70-80, 80-90, 90-100
  const users = new Map();

  items.forEach((item) => {
    const t = new Date(item.timestamp);
    const idx = keys.indexOf(dayKey(t));
    const damaged = isDamagedResult(item.result);
    if (idx !== -1) {
      if (damaged) damagedDaily[idx] += 1;
      else if (isOkResult(item.result)) okDaily[idx] += 1;
    }
    hourly[t.getHours()] += 1;

    const c = item.confidence;
    const bucket = c < 60 ? 0 : c < 70 ? 1 : c < 80 ? 2 : c < 90 ? 3 : 4;
    confBuckets[bucket] += 1;

    const who = item.userEmail || item.userName;
    if (who) {
      const u = users.get(who) || { total: 0, damaged: 0 };
      u.total += 1;
      if (damaged) u.damaged += 1;
      users.set(who, u);
    }
  });

  const rateDaily = keys.map((_, i) => {
    const total = okDaily[i] + damagedDaily[i];
    return total ? Math.round((damagedDaily[i] / total) * 1000) / 10 : null;
  });

  // ----- KPI tiles -----
  const total = items.length;
  const damagedTotal = items.filter((i) => isDamagedResult(i.result)).length;
  const avgConf = total ? items.reduce((s, i) => s + i.confidence, 0) / total : 0;
  const lowConf = items.filter((i) => i.confidence < 70).length;
  const peakHour = hourly.indexOf(Math.max(...hourly));

  document.getElementById("anTotal").textContent = total.toLocaleString();
  document.getElementById("anPerDay").textContent = `${(total / days).toFixed(1)} per day`;
  document.getElementById("anRate").textContent = `${total ? ((damagedTotal / total) * 100).toFixed(1) : "0.0"}%`;
  document.getElementById("anDamaged").textContent = `${damagedTotal} damaged`;
  document.getElementById("anConf").textContent = `${avgConf.toFixed(1)}%`;
  document.getElementById("anLowConf").textContent = `${lowConf} below 70%`;
  document.getElementById("anPeak").textContent = total ? hourLabel(peakHour) : "–";
  document.getElementById("anPeakCount").textContent = total
    ? `${hourly[peakHour]} inspection${hourly[peakHour] === 1 ? "" : "s"}`
    : "no data";

  const endLabel = new Date().toLocaleDateString([], { month: "short", day: "numeric" });
  document.getElementById("analyticsRangeLabel").textContent = `${labels[0]} – ${endLabel}`;

  // ----- Charts -----
  upsertChart("anDailyChart", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "OK", data: okDaily, backgroundColor: OK_COLOR, borderColor: PANEL_COLOR,
          borderWidth: { top: 2 }, borderRadius: 4, borderSkipped: "bottom", stack: "s" },
        { label: "Damaged", data: damagedDaily, backgroundColor: DAMAGED_COLOR, borderColor: PANEL_COLOR,
          borderWidth: { top: 2 }, borderRadius: 4, borderSkipped: "bottom", stack: "s" },
      ],
    },
    options: baseChartOptions({
      scales: {
        x: { stacked: true, ticks: { color: TICK_COLOR, maxRotation: 0, autoSkip: true }, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { color: TICK_COLOR, precision: 0 }, grid: { color: GRID_COLOR } },
      },
    }),
  });

  upsertChart("anRateChart", {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Damage rate (%)", data: rateDaily, borderColor: DAMAGED_COLOR, backgroundColor: DAMAGED_COLOR,
          borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, spanGaps: true, tension: 0.25 },
      ],
    },
    options: baseChartOptions({
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#0a1421", borderColor: "#2b3f5c", borderWidth: 1,
          callbacks: { label: (ctx) => (ctx.parsed.y == null ? "No inspections" : `Damage rate: ${ctx.parsed.y}%`) },
        },
      },
      scales: {
        x: { ticks: { color: TICK_COLOR, maxRotation: 0, autoSkip: true }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { color: TICK_COLOR, callback: (v) => `${v}%` }, grid: { color: GRID_COLOR } },
      },
    }),
  });

  upsertChart("anConfChart", {
    type: "bar",
    data: {
      labels: ["< 60%", "60–70%", "70–80%", "80–90%", "90–100%"],
      datasets: [
        { label: "Inspections", data: confBuckets, backgroundColor: VOLUME_COLOR, borderRadius: 4,
          borderSkipped: "bottom", maxBarThickness: 48 },
      ],
    },
    options: baseChartOptions({ plugins: { legend: { display: false },
      tooltip: { backgroundColor: "#0a1421", borderColor: "#2b3f5c", borderWidth: 1 } } }),
  });

  upsertChart("anHourChart", {
    type: "bar",
    data: {
      labels: Array.from({ length: 24 }, (_, h) => hourLabel(h)),
      datasets: [
        { label: "Inspections", data: hourly, backgroundColor: VOLUME_COLOR, borderRadius: 3,
          borderSkipped: "bottom" },
      ],
    },
    options: baseChartOptions({
      plugins: { legend: { display: false },
        tooltip: { backgroundColor: "#0a1421", borderColor: "#2b3f5c", borderWidth: 1 } },
      scales: {
        x: { ticks: { color: TICK_COLOR, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
        y: { beginAtZero: true, ticks: { color: TICK_COLOR, precision: 0 }, grid: { color: GRID_COLOR } },
      },
    }),
  });

  // ----- Data table for the daily chart -----
  document.getElementById("anDailyTable").innerHTML = keys
    .map((_, i) => `
      <tr><td>${escapeHtml(labels[i])}</td><td>${okDaily[i]}</td><td>${damagedDaily[i]}</td>
      <td>${rateDaily[i] == null ? "–" : `${rateDaily[i]}%`}</td></tr>`)
    .reverse()
    .join("");

  // ----- Top inspectors (only when records include who submitted them) -----
  const usersPanel = document.getElementById("anUsersPanel");
  const ranked = [...users.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  usersPanel.hidden = ranked.length === 0;
  document.getElementById("anUsersTable").innerHTML = ranked
    .map(([who, u]) => `
      <tr><td>${escapeHtml(who)}</td><td>${u.total}</td><td>${u.damaged}</td>
      <td>${((u.damaged / u.total) * 100).toFixed(1)}%</td></tr>`)
    .join("");
}

document.querySelectorAll(".range-pill").forEach((pill) =>
  pill.addEventListener("click", () => {
    analyticsDays = Number(pill.dataset.days);
    document.querySelectorAll(".range-pill").forEach((p) => p.classList.toggle("active", p === pill));
    renderAnalytics();
  })
);

// ---------- Settings ----------

function renderSettings() {
  const name = signedInUser.name || signedInUser.email || "User";
  document.getElementById("settingsName").textContent = name;
  document.getElementById("settingsEmail").textContent = signedInUser.email || "";
  document.getElementById("settingsAvatar").textContent = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  const notifyText = document.getElementById("desktopNotifyText");
  const notifyBtn2 = document.getElementById("settingsNotifyBtn");
  if (!canNotify()) {
    notifyText.textContent = "Available on the HTTPS (CloudFront) site";
    notifyBtn2.hidden = true;
  } else if (Notification.permission === "granted") {
    notifyText.textContent = "On – you'll be notified when this tab is in the background";
    notifyBtn2.hidden = true;
  } else if (Notification.permission === "denied") {
    notifyText.textContent = "Blocked – allow notifications in your browser's site settings";
    notifyBtn2.hidden = true;
  } else {
    notifyText.textContent = "Off";
    notifyBtn2.hidden = false;
  }

  const unread = unreadCount();
  document.getElementById("settingsUnread").textContent =
    unread ? `${unread} unread damage alert${unread === 1 ? "" : "s"}` : "None";
  document.getElementById("settingsMarkRead").disabled = unread === 0;
}

document.getElementById("settingsNotifyBtn").addEventListener("click", async () => {
  try {
    await Notification.requestPermission();
  } catch {
    /* ignore */
  }
  updateNotifyButton();
  renderSettings();
});

document.getElementById("settingsMarkRead").addEventListener("click", () => {
  markAllAlertsRead();
  renderSettings();
});

document.getElementById("settingsSignOut").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "Signing out…";
  try {
    if (socket) {
      socket.onclose = null; // don't auto-reconnect while leaving
      socket.close();
    }
  } catch {
    /* ignore */
  }
  Auth.logout();
});

// Start the dashboard only after the user is signed in.
Auth.requireLogin().then((user) => {
  document.body.classList.remove("auth-pending");
  showSignedInUser(user);

  showView();
  renderRows();
  renderAllInspections();
  updateStats();
  updateTrendChart();
  fetchPreviousInspections();
  connectWebSocket();
});

// Optional demo data. Uncomment to test the UI without AWS.
//
// addInspection({
//   inspectionId: "INS-DEMO-001",
//   result: "Damaged",
//   confidence: 0.973,
//   imageUrl: "https://picsum.photos/120/120?1",
//   timestamp: new Date().toISOString()
// });
//
// addInspection({
//   inspectionId: "INS-DEMO-002",
//   result: "Good",
//   confidence: 0.991,
//   imageUrl: "https://picsum.photos/120/120?2",
//   timestamp: new Date().toISOString()
// });