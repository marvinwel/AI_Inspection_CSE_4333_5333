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
            borderColor: "#20c875",
            backgroundColor: "#20c875",
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: "Damaged",
            data: damagedCounts,
            borderColor: "#ff4d57",
            backgroundColor: "#ff4d57",
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
  try {
    const response = await fetch(FETCH_DATA_URL, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const previous = extractInspectionArray(payload).map(normalizeInspection);
    const existingKeys = new Set(inspections.map(inspectionKey));

    previous.forEach((item) => {
      const key = inspectionKey(item);
      if (!existingKeys.has(key)) {
        inspections.push(item);
        existingKeys.add(key);
      }
    });

    sortInspectionsNewestFirst();

    // Keep enough history for the trend while limiting browser memory.
    if (inspections.length > 500) inspections.length = 500;

    renderRows();
    updateStats();
    updateTrendChart();
  } catch (error) {
    console.error("Unable to fetch previous inspections:", error);
  }
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
}

function renderRows() {
  emptyState.style.display = inspections.length ? "none" : "block";

  rowsEl.innerHTML = inspections
    .slice(0, 20)
    .map((item, index) => {
      const isDamaged =
        String(item.result).toLowerCase() === "damaged";

      const resultClass = isDamaged ? "damaged" : "ok";
      const resultLabel = isDamaged ? "DAMAGED" : "OK";
      const confidence = item.confidence.toFixed(1);

      return `
        <tr class="${index === 0 ? "new-row" : ""}">
          <td>${escapeHtml(item.inspectionId)}</td>

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
    })
    .join("");
}

function setSocketStatus(connected) {
  socketDot.classList.toggle("online", connected);
  socketDot.classList.toggle("offline", !connected);
  socketStatus.textContent = connected ? "Live Updates On" : "Disconnected";
}

function connectWebSocket() {
  clearTimeout(reconnectTimer);

  socketStatus.textContent = "Connecting...";

  socket = new WebSocket(WS_URL);

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

renderRows();
updateStats();
updateTrendChart();
fetchPreviousInspections();
connectWebSocket();

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
