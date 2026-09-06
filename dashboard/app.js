const WS_URL =
  "wss://s5p3td5072.execute-api.us-east-1.amazonaws.com/production/";

const rowsEl = document.getElementById("inspectionRows");
const emptyState = document.getElementById("emptyState");
const totalEl = document.getElementById("totalCount");
const okEl = document.getElementById("okCount");
const damagedEl = document.getElementById("damagedCount");
const avgConfidenceEl = document.getElementById("avgConfidence");
const socketDot = document.getElementById("socketDot");
const socketStatus = document.getElementById("socketStatus");

const inspections = [];
let socket;
let reconnectTimer;

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

function updateStats() {
  const total = inspections.length;
  const ok = inspections.filter(
    (i) => String(i.result).toLowerCase() === "good" ||
           String(i.result).toLowerCase() === "ok"
  ).length;
  const damaged = inspections.filter(
    (i) => String(i.result).toLowerCase() === "damaged"
  ).length;

  const average =
    total === 0
      ? 0
      : inspections.reduce(
          (sum, i) => sum + normalizeConfidence(i.confidence),
          0
        ) / total;

  totalEl.textContent = total;
  okEl.textContent = ok;
  damagedEl.textContent = damaged;
  avgConfidenceEl.textContent = `${average.toFixed(1)}%`;
}

function addInspection(data) {
  const inspection = {
    inspectionId: data.inspectionId || data.id || "Unknown",
    result: data.result || data.prediction || "Unknown",
    confidence: normalizeConfidence(data.confidence),
    imageUrl: data.imageUrl || data.imageURL || "",
    timestamp: data.timestamp || new Date().toISOString(),
  };

  inspections.unshift(inspection);

  // Keep the UI lightweight.
  if (inspections.length > 50) inspections.pop();

  renderRows();
  updateStats();
}

function renderRows() {
  emptyState.style.display = inspections.length ? "none" : "block";

  rowsEl.innerHTML = inspections
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

connectWebSocket();
renderRows();
updateStats();

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
