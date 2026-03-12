(function () {
  let map;
  let visitorMarker = null;
  let visitorId = null;
  let currentFloor = 0;
  let currentLocation = { lat: -1.588, lng: 37.128 };
  let html5QrCode = null;
  let pois = [];
  let selectedPoi = null;

  function generateVisitorId() {
    const stored = localStorage.getItem("zuru_visitor_id");
    if (stored) return stored;
    const id = "VISITOR-" + Date.now().toString(36) + "-" + Math.random().toString(16).slice(2, 8);
    localStorage.setItem("zuru_visitor_id", id);
    return id;
  }

  function initMap() {
    map = new maplibregl.Map({
      container: "visitor-map",
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OSM contributors</a>',
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

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      addHeatmapLayer();
      loadPois();
      createVisitorMarker();
    });
  }

  async function addHeatmapLayer() {
    try {
      const res = await fetch("/api/visitor/heatmap");
      const data = await res.json();

      const geojson = {
        type: "FeatureCollection",
        features: data.map((p) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [p.lng, p.lat],
          },
          properties: {
            weight: 1,
          },
        })),
      };

      if (map.getSource("visitors-heat")) {
        map.getSource("visitors-heat").setData(geojson);
      } else {
        map.addSource("visitors-heat", {
          type: "geojson",
          data: geojson,
        });

        map.addLayer({
          id: "visitors-heat-layer",
          type: "heatmap",
          source: "visitors-heat",
          paint: {
            "heatmap-weight": 1,
            "heatmap-intensity": 0.8,
            "heatmap-radius": 20,
            "heatmap-opacity": 0.7,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0, 0, 0, 0)",
              0.2,
              "rgba(22, 163, 74, 0.6)",
              0.4,
              "rgba(34, 197, 94, 0.8)",
              0.7,
              "rgba(234, 179, 8, 0.9)",
              1,
              "rgba(220, 38, 38, 1)",
            ],
          },
        });
      }
    } catch (e) {
      console.error("Failed to load heatmap", e);
    }
  }

  async function loadPois() {
    try {
      const res = await fetch("/api/pois");
      pois = await res.json();

      pois.forEach((poi) => {
        const el = document.createElement("div");
        el.className = "visitor-dot";
        new maplibregl.Marker(el)
          .setLngLat([poi.lng, poi.lat])
          .addTo(map)
          .getElement()
          .addEventListener("click", () => openPoiSheet(poi));
      });

      setupSearch();
    } catch (e) {
      console.error("Failed to load POIs", e);
    }
  }

  function setupSearch() {
    const searchInput = document.getElementById("search-poi");
    if (!searchInput) return;
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase().trim();
      if (!query) return;
      const poi = pois.find((p) => p.name.toLowerCase().includes(query));
      if (poi) {
        map.easeTo({ center: [poi.lng, poi.lat], zoom: 18, duration: 1000 });
        openPoiSheet(poi);
      }
    });
  }

  function createVisitorMarker() {
    const el = document.createElement("div");
    el.className = "visitor-dot";
    visitorMarker = new maplibregl.Marker(el).setLngLat([currentLocation.lng, currentLocation.lat]).addTo(map);
  }

  function updateVisitorMarker() {
    if (!visitorMarker) return;
    visitorMarker.setLngLat([currentLocation.lng, currentLocation.lat]);
  }

  function openPoiSheet(poi) {
    selectedPoi = poi;
    const sheet = document.getElementById("poi-sheet");
    document.getElementById("poi-image").src = poi.image_url;
    document.getElementById("poi-title").textContent = poi.name;
    document.getElementById("poi-type").textContent = poi.type;
    document.getElementById("poi-description").textContent = poi.description;
    document.getElementById("poi-fun-fact").textContent = poi.fun_fact;
    sheet.classList.add("open");
  }

  function closePoiSheet() {
    const sheet = document.getElementById("poi-sheet");
    sheet.classList.remove("open");
  }

  function speakNavigation(poi) {
    const text = `Navigating to ${poi.name}.`;
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    window.speechSynthesis.speak(utterance);
  }

  async function postVisitorLocation() {
    try {
      const payload = {
        visitor_id: visitorId,
        floor_id: currentFloor,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        timestamp: new Date().toISOString(),
      };
      await fetch("/api/visitor/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("Failed to post visitor location", e);
    }
  }

  async function triggerSOS() {
    try {
      const payload = {
        visitor_id: visitorId,
        floor_id: currentFloor,
        lat: currentLocation.lat,
        lng: currentLocation.lng,
        timestamp: new Date().toISOString(),
      };
      await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      alert("SOS sent to Konza Security.");
    } catch (e) {
      console.error("Failed to send SOS", e);
      alert("Unable to send SOS. Please try again.");
    }
  }

  function openQrOverlay() {
    const overlay = document.getElementById("qr-overlay");
    overlay.classList.remove("d-none");
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("qr-reader");
    }
    const config = { fps: 10, qrbox: 250 };
    html5QrCode
      .start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          try {
            const data = JSON.parse(decodedText);
            if (typeof data.lat === "number" && typeof data.lng === "number") {
              currentLocation.lat = data.lat;
              currentLocation.lng = data.lng;
              currentFloor = data.floor_id || 0;
              updateVisitorMarker();
              map.flyTo({
                center: [currentLocation.lng, currentLocation.lat],
                zoom: 19,
                speed: 1.2,
              });
              postVisitorLocation();
              alert("Location updated via Konza QR checkpoint.");
            }
          } catch (e) {
            console.error("Invalid QR payload", e);
          } finally {
            closeQrOverlay();
          }
        },
        (err) => {
          // ignore scan errors
        }
      )
      .catch((err) => {
        console.error("QR start failed", err);
      });
  }

  function closeQrOverlay() {
    const overlay = document.getElementById("qr-overlay");
    overlay.classList.add("d-none");
    if (html5QrCode) {
      html5QrCode.stop().catch(() => {});
    }
  }

  function setupUiEvents() {
    const sheet = document.getElementById("poi-sheet");
    sheet.addEventListener("click", (e) => {
      if (e.target.id === "poi-sheet") {
        closePoiSheet();
      }
    });

    document.getElementById("poi-go").addEventListener("click", () => {
      if (!selectedPoi) return;
      speakNavigation(selectedPoi);
      map.flyTo({
        center: [selectedPoi.lng, selectedPoi.lat],
        zoom: 19,
        speed: 1.3,
      });
    });

    document.getElementById("sos-button").addEventListener("click", triggerSOS);

    const navButtons = document.querySelectorAll(".nav-item-btn");
    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        navButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const action = btn.getAttribute("data-action");
        if (action === "scan") {
          openQrOverlay();
        } else if (action === "sos") {
          triggerSOS();
        } else if (action === "navigate" && selectedPoi) {
          speakNavigation(selectedPoi);
        }
      });
    });

    document.getElementById("close-qr").addEventListener("click", closeQrOverlay);
  }

  function bootstrapVisitorApp() {
    visitorId = generateVisitorId();
    initMap();
    setupUiEvents();

    // Periodic heartbeat for location (e.g., last scanned)
    setInterval(() => {
      postVisitorLocation();
    }, 60 * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapVisitorApp);
  } else {
    bootstrapVisitorApp();
  }
})();