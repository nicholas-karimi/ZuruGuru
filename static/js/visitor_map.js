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
    const id =
      "VISITOR-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(16).slice(2, 8);
    localStorage.setItem("zuru_visitor_id", id);
    return id;
  }

  function initMap() {
    const container = document.getElementById("visitor-map");
    if (!container) return;

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
      zoom: 17.3,
      pitch: 45,
      bearing: -18,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

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
            "heatmap-intensity": 1.2,
            "heatmap-radius": 30,
            "heatmap-opacity": 0.9,
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0,0,0,0)",
              0.2,
              "rgba(56, 189, 248, 0.7)",
              0.4,
              "rgba(34, 197, 94, 0.9)",
              0.7,
              "rgba(234, 179, 8, 0.95)",
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

      const popularList = document.getElementById("popular-list");
      if (popularList) {
        popularList.innerHTML = "";
        pois.forEach((poi) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className =
            "w-100 text-start btn btn-light border-0 mb-2 shadow-sm rounded-3";
          item.innerHTML = `
            <div class="d-flex align-items-center">
              <div class="me-2 rounded-3 overflow-hidden" style="width:40px;height:40px;">
                <img src="${poi.image_url}" alt="${poi.name}" class="w-100 h-100 object-fit-cover" />
              </div>
              <div class="flex-grow-1">
                <div class="small fw-semibold text-konza-dark">${poi.name}</div>
                <div class="small text-konza-muted">${poi.type}</div>
              </div>
            </div>
          `;
          item.addEventListener("click", () => {
            focusOnPoi(poi);
            openPoiModal(poi);
          });
          popularList.appendChild(item);
        });
      }

      pois.forEach((poi) => {
        const el = document.createElement("div");
        el.className = "visitor-dot";
        const marker = new maplibregl.Marker(el).setLngLat([poi.lng, poi.lat]).addTo(map);

        const popup = new maplibregl.Popup({
          offset: 12,
          closeButton: false,
          className: "poi-popup",
        }).setHTML(
          `<div class="small fw-semibold text-konza-dark">${poi.name}</div>
           <div class="small text-konza-muted">${poi.type}</div>`
        );

        marker.getElement().addEventListener("mouseenter", () => {
          popup.addTo(map).setLngLat([poi.lng, poi.lat]);
        });
        marker.getElement().addEventListener("mouseleave", () => {
          popup.remove();
        });
        marker.getElement().addEventListener("click", () => {
          focusOnPoi(poi);
          openPoiModal(poi);
        });
      });

      setupSearch();
    } catch (e) {
      console.error("Failed to load POIs", e);
    }
  }

  function setupSearch() {
    const searchInput = document.getElementById("search-poi");
    if (!searchInput) return;
    searchInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const query = searchInput.value.toLowerCase().trim();
      if (!query) return;
      const poi =
        pois.find((p) => p.name.toLowerCase().includes(query)) ||
        pois.find((p) => p.type.toLowerCase().includes(query));
      if (poi) {
        focusOnPoi(poi);
        openPoiModal(poi);
      }
    });
  }

  function focusOnPoi(poi) {
    map.easeTo({ center: [poi.lng, poi.lat], zoom: 18.5, duration: 900 });
  }

  function createVisitorMarker() {
    const el = document.createElement("div");
    el.className = "visitor-dot";
    visitorMarker = new maplibregl.Marker(el)
      .setLngLat([currentLocation.lng, currentLocation.lat])
      .addTo(map);
  }

  function updateVisitorMarker() {
    if (!visitorMarker) return;
    visitorMarker.setLngLat([currentLocation.lng, currentLocation.lat]);
  }

  function openPoiModal(poi) {
    selectedPoi = poi;
    const modal = document.getElementById("poi-modal");
    document.getElementById("poi-image").src = poi.image_url;
    document.getElementById("poi-title").textContent = poi.name;
    document.getElementById("poi-type").textContent = poi.type;
    document.getElementById("poi-description").textContent = poi.description;
    document.getElementById("poi-fun-fact").textContent = poi.fun_fact;
    modal.classList.remove("d-none");
    modal.classList.add("d-flex");
  }

  function closePoiModal() {
    const modal = document.getElementById("poi-modal");
    modal.classList.add("d-none");
    modal.classList.remove("d-flex");
  }

  function speakNavigation(poi) {
    const text = `Navigating to ${poi.name}. Walk towards the highlighted point on the Konza map.`;
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
    if (
      !confirm(
        "Send an SOS alert to Konza security with your current indoor position?"
      )
    ) {
      return;
    }
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
      alert("SOS sent. Security has been notified.");
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
        () => {}
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
    const sosBtn = document.getElementById("sos-button");
    if (sosBtn) {
      sosBtn.addEventListener("click", triggerSOS);
    }

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
          focusOnPoi(selectedPoi);
          showNavigationBanner(selectedPoi);
        }
      });
    });

    const closeQrBtn = document.getElementById("close-qr");
    if (closeQrBtn) {
      closeQrBtn.addEventListener("click", closeQrOverlay);
    }

    const poiClose = document.getElementById("poi-close");
    if (poiClose) {
      poiClose.addEventListener("click", closePoiModal);
    }

    const poiModal = document.getElementById("poi-modal");
    if (poiModal) {
      poiModal.addEventListener("click", (e) => {
        if (e.target === poiModal) {
          closePoiModal();
        }
      });
    }

    const poiGo = document.getElementById("poi-go");
    if (poiGo) {
      poiGo.addEventListener("click", () => {
        if (!selectedPoi) return;
        speakNavigation(selectedPoi);
        focusOnPoi(selectedPoi);
        showNavigationBanner(selectedPoi);
        closePoiModal();
      });
    }

    const poiMore = document.getElementById("poi-more");
    if (poiMore) {
      poiMore.addEventListener("click", () => {
        if (!selectedPoi) return;
        focusOnPoi(selectedPoi);
        closePoiModal();
      });
    }
  }

  function showNavigationBanner(poi) {
    const existing = document.getElementById("nav-banner");
    if (existing) existing.remove();
    const banner = document.createElement("div");
    banner.id = "nav-banner";
    banner.className =
      "position-absolute top-0 start-50 translate-middle-x mt-3 px-3";
    banner.style.zIndex = 1500;
    banner.innerHTML = `
      <div class="glass-card px-3 py-2 small d-flex align-items-center gap-2">
        <span class="material-symbols-outlined text-konza-green">route</span>
        <span>Navigation started to <strong>${poi.name}</strong>. Follow the highlighted point on the map.</span>
        <button type="button" class="btn btn-sm btn-outline-secondary ms-2" id="nav-banner-close">Done</button>
      </div>
    `;
    document.getElementById("guide-app").appendChild(banner);
    document
      .getElementById("nav-banner-close")
      .addEventListener("click", () => banner.remove());
  }

  async function bootstrapVisitorApp() {
    visitorId = generateVisitorId();
    initMap();
    setupUiEvents();
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

