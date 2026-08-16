"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  BLUE,
  CATEGORY_META,
  FILTER_ORDER,
  GREEN,
  HUBS,
  MMTS_ROUTES,
  MMTS_STATIONS,
  RED,
  type Category,
  type Stop,
} from "./data";

type Selected = { name: string; label: string; cat: Category; info?: string };

// Leaflet layers carry no user data slot in its types, so track category
// alongside the layer rather than mutating the instance.
type Tracked = { layer: L.Layer; cat: Category };

const HYDERABAD_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function hubIcon(cat: Category) {
  const { color, badge } = CATEGORY_META[cat];
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20C24 5.37 18.63 0 12 0z" fill="${color}"/><circle cx="12" cy="11" r="7.5" fill="white" opacity="0.92"/><text x="12" y="15" text-anchor="middle" font-size="8" font-weight="700" fill="${color}" font-family="sans-serif">${badge}</text></svg>`,
    className: "",
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -32],
  });
}

export default function TransportMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const trackedRef = useRef<Tracked[]>([]);
  const [active, setActive] = useState<Set<Category>>(
    () => new Set(FILTER_ORDER)
  );
  const [selected, setSelected] = useState<Selected | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: false });
    mapRef.current = map;
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // CARTO Voyager only. The original prototype also offered Google's
    // mt1.google.com tiles -- that endpoint is undocumented and using it
    // outside the paid Maps API breaks their terms, so it's dropped rather
    // than kept as a toggle.
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { attribution: HYDERABAD_ATTRIBUTION, maxZoom: 19 }
    ).addTo(map);

    const tracked: Tracked[] = [];

    const addLine = (stops: Stop[], cat: Category) => {
      const line = L.polyline(
        stops.map((s) => [s.lat, s.lng] as [number, number]),
        { color: CATEGORY_META[cat].color, weight: 5, opacity: 0.85 }
      );
      tracked.push({ layer: line, cat });
    };

    const addStations = (stops: Stop[], cat: Category) => {
      for (const s of stops) {
        const marker = L.circleMarker([s.lat, s.lng], {
          radius: 7,
          color: CATEGORY_META[cat].color,
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 3,
        });
        marker.on("click", () =>
          setSelected({
            name: s.n,
            label: CATEGORY_META[cat].label,
            cat,
            info: s.info,
          })
        );
        marker.bindTooltip(s.n, { direction: "top", offset: [0, -8] });
        tracked.push({ layer: marker, cat });
      }
    };

    addLine(RED, "red");
    addLine(GREEN, "green");
    addLine(BLUE, "blue");
    addStations(RED, "red");
    addStations(GREEN, "green");
    addStations(BLUE, "blue");

    for (const route of MMTS_ROUTES) {
      const line = L.polyline(route, {
        color: CATEGORY_META.mmts.color,
        weight: 4,
        opacity: 0.75,
        dashArray: "6 4",
      });
      tracked.push({ layer: line, cat: "mmts" });
    }
    addStations(
      MMTS_STATIONS.map((s) => ({
        ...s,
        info: s.info ?? "MMTS suburban rail · South Central Railway",
      })),
      "mmts"
    );

    for (const h of HUBS) {
      const marker = L.marker([h.lat, h.lng], { icon: hubIcon(h.cat) });
      marker.on("click", () =>
        setSelected({
          name: h.n,
          label: CATEGORY_META[h.cat].label,
          cat: h.cat,
          info: h.info,
        })
      );
      marker.bindTooltip(h.n, { direction: "top", offset: [0, -30] });
      tracked.push({ layer: marker, cat: h.cat });
    }

    for (const t of tracked) t.layer.addTo(map);
    trackedRef.current = tracked;

    const allPoints: [number, number][] = [
      ...RED, ...GREEN, ...BLUE, ...MMTS_STATIONS, ...HUBS,
    ].map((s) => [s.lat, s.lng]);
    map.fitBounds(L.latLngBounds(allPoints).pad(0.05));

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    const settle = setTimeout(onResize, 300);

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(settle);
      map.remove();
      mapRef.current = null;
      trackedRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const { layer, cat } of trackedRef.current) {
      const shouldShow = active.has(cat);
      if (shouldShow && !map.hasLayer(layer)) layer.addTo(map);
      if (!shouldShow && map.hasLayer(layer)) map.removeLayer(layer);
    }
    if (selected && !active.has(selected.cat)) setSelected(null);
  }, [active, selected]);

  function toggle(cat: Category) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  const allOn = active.size === FILTER_ORDER.length;

  return (
    <div className="transport">
      <div className="transport-filters">
        <button
          className={`body-filter-btn${allOn ? " active" : ""}`}
          onClick={() =>
            setActive(allOn ? new Set() : new Set(FILTER_ORDER))
          }
        >
          {allOn ? "Clear all" : "Show all"}
        </button>
        {FILTER_ORDER.map((cat) => {
          const on = active.has(cat);
          const meta = CATEGORY_META[cat];
          return (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              aria-pressed={on}
              className="transport-filter-btn"
              style={{
                borderColor: meta.color,
                background: on ? meta.color : "transparent",
                color: on ? "#fff" : "var(--fg)",
              }}
            >
              {meta.label.replace("Metro — ", "").replace(" suburban rail", "")}
            </button>
          );
        })}
      </div>

      <div className="transport-map-wrap">
        <div ref={containerRef} className="transport-map" />
        {selected && (
          <div className="transport-info">
            <div className="transport-info-head">
              <strong>{selected.name}</strong>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close details"
                className="chat-modal-close"
              >
                ×
              </button>
            </div>
            {selected.info && <p className="muted">{selected.info}</p>}
            <span
              className="transport-badge"
              style={{
                borderColor: CATEGORY_META[selected.cat].color,
                color: CATEGORY_META[selected.cat].color,
              }}
            >
              {selected.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
