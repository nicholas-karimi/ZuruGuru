(function () {
  function isOnPoisPage() {
    return !!document.getElementById("pois-table-body");
  }

  function isOnSecurityPage() {
    return !!document.getElementById("security-map");
  }

  function initPoiAdmin() {
    const form = document.getElementById("poi-form");
    const tableBody = document.getElementById("pois-table-body");
    const statsTodayEl = document.getElementById("stats-today");

    function resetForm() {
      form.reset();
      document.getElementById("poi-id").value = "";
    }

    async function refreshPois() {
      const res = await fetch("/api/pois");
      const pois = await res.json();
      tableBody.innerHTML = "";
      pois.forEach((poi) => {
        const tr = document.createElement("tr");
        tr.classList.add("poi-row");
        tr.dataset.id = poi.id;
        tr.innerHTML = `
          <td>${poi.name}</td>
          <td>${poi.type}</td>
          <td>${poi.lat.toFixed(6)}</td>
          <td>${poi.lng.toFixed(6)}</td>
          <td><button type="button" class="btn btn-sm btn-outline-danger poi-delete">Delete</button></td>
        `;
        tableBody.appendChild(tr);
      });
    }

    async function loadStats() {
      try {
        const res = await fetch("/api/visitor/stats");
        const data = await res.json();
        statsTodayEl.textContent = `Total visitors today: ${data.total_visitors_today}`;
      } catch (e) {
        statsTodayEl.textContent = "Unable to load today's stats.";
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("poi-id").value || null;
      const payload = {
        name: document.getElementById("poi-name").value,
        type: document.getElementById("poi-type").value,
        description: document.getElementById("poi-description").value,
        fun_fact: document.getElementById("poi-fun-fact").value,
        image_url: document.getElementById("poi-image-url").value,
        lat: parseFloat(document.getElementById("poi-lat").value),
        lng: parseFloat(document.getElementById("poi-lng").value),
      };
      try {
        if (id) {
          await fetch(`/api/pois/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          await fetch("/api/pois", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }
        await refreshPois();
        resetForm();
      } catch (e) {
        alert("Failed to save POI.");
      }
    });

    document.getElementById("poi-reset").addEventListener("click", resetForm);

    tableBody.addEventListener("click", async (e) => {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const id = tr.dataset.id;
      if (e.target.classList.contains("poi-delete")) {
        if (!confirm("Delete this POI?")) return;
        try {
          await fetch(`/api/pois/${id}`, { method: "DELETE" });
          await refreshPois();
        } catch (err) {
          alert("Unable to delete POI.");
        }
      } else if (tr.classList.contains("poi-row")) {
        const cells = tr.querySelectorAll("td");
        document.getElementById("poi-id").value = id;
        document.getElementById("poi-name").value = cells[0].textContent.trim();
        document.getElementById("poi-type").value = cells[1].textContent.trim();
        document.getElementById("poi-lat").value = cells[2].textContent.trim();
        document.getElementById("poi-lng").value = cells[3].textContent.trim();

        const res = await fetch("/api/pois");
        const pois = await res.json();
        const poi = pois.find((p) => String(p.id) === String(id));
        if (poi) {
          document.getElementById("poi-description").value =
            poi.description || "";
          document.getElementById("poi-fun-fact").value = poi.fun_fact || "";
          document.getElementById("poi-image-url").value =
            poi.image_url || "";
        }
      }
    });

    refreshPois();
    loadStats();
  }

  function initSecurityDashboard() {
    const wsStatus = document.getElementById("ws-status");
    const sosList = document.getElementById("sos-list");
    const map = new maplibregl.Map({
      container: "security-map",
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: [37.128, -1.588],
      zoom: 17,
      pitch: 45,
      bearing: -20,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    const visitorMarkers = new Map();

    function getOrCreateVisitorMarker(visitorId, lng, lat) {
      let marker = visitorMarkers.get(visitorId);
      if (!marker) {
        const el = document.createElement("div");
        el.className = "visitor-dot";
        marker = new maplibregl.Marker(el).setLngLat([lng, lat]).addTo(map);
        visitorMarkers.set(visitorId, marker);
      } else {
        marker.setLngLat([lng, lat]);
      }
      return marker;
    }

    function addSosMarker(lng, lat) {
      const el = document.createElement("div");
      el.className = "sos-marker";
      new maplibregl.Marker(el).setLngLat([lng, lat]).addTo(map);
    }

    function pushSosCard(alert) {
      const card = document.createElement("div");
      card.className = "glass-card p-2 mb-2";
      card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="fw-semibold small">Visitor: ${alert.visitor_id}</div>
          <span class="badge bg-danger-subtle text-danger small">SOS</span>
        </div>
        <div class="small text-konza-muted mb-1">
          Floor ${alert.floor_id} • ${new Date(
            alert.timestamp
          ).toLocaleTimeString()}
        </div>
        <div class="small">Lat ${alert.lat.toFixed(
          5
        )}, Lng ${alert.lng.toFixed(5)}</div>
      `;
      sosList.prepend(card);
    }

    async function preloadSos() {
      try {
        const res = await fetch("/api/sos");
        const alerts = await res.json();
        alerts.forEach((alert) => pushSosCard(alert));
      } catch (e) {
        console.error("Unable to preload SOS alerts", e);
      }
    }

    function connectWebSocket() {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const wsUrl = `${protocol}://${window.location.host}/ws/live`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        wsStatus.textContent = "connected";
        wsStatus.classList.remove("text-danger", "text-warning");
        wsStatus.classList.add("text-konza-green");
      };

      ws.onclose = () => {
        wsStatus.textContent = "reconnecting…";
        wsStatus.classList.remove("text-konza-green", "text-danger");
        wsStatus.classList.add("text-warning");
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        wsStatus.textContent = "error";
        wsStatus.classList.remove("text-konza-green", "text-warning");
        wsStatus.classList.add("text-danger");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "location") {
            getOrCreateVisitorMarker(data.visitor_id, data.lng, data.lat);
          } else if (data.type === "sos") {
            addSosMarker(data.lng, data.lat);
            pushSosCard(data);
            map.flyTo({
              center: [data.lng, data.lat],
              zoom: 19,
              speed: 1.4,
            });
          }
        } catch (e) {
          console.error("WS message error", e);
        }
      };
    }

    preloadSos();
    connectWebSocket();
  }

  function bootstrapAdmin() {
    if (isOnPoisPage()) {
      initPoiAdmin();
    }
    if (isOnSecurityPage()) {
      initSecurityDashboard();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapAdmin);
  } else {
    bootstrapAdmin();
  }
})();

