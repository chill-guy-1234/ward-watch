"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, which would crash the static
// export's prerender pass -- so the map only loads in the browser.
const TransportMap = dynamic(() => import("./TransportMap"), {
  ssr: false,
  loading: () => <p className="muted">Loading map…</p>,
});

export default function TransportPage() {
  return (
    <>
      <p className="muted transport-intro">
        Metro (Red, Green, Blue), MMTS suburban rail, major railway
        terminals, bus stands and airports — services running today. Metro
        Phase 2 corridors (airport, Patancheru, Medchal, Shamirpet, Old City)
        are still awaiting central approval with construction targeted
        2028–30, so they are deliberately not drawn here.
      </p>
      <TransportMap />
    </>
  );
}
