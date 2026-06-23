/**
 * FleetMap — Leaflet map with:
 *   • CartoDB Dark Matter tiles
 *   • Native Leaflet controls hidden
 *   • Custom animated zoom +/- buttons
 *   • Custom fit-bounds button
 *   • Animated vehicle pins with popups
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'

let L = null // lazy-loaded

export function FleetMap({ vehicles = [], openAlerts = [], onVehicleClick, height = '100%', style = {} }) {
  const mapRef     = useRef(null)
  const leafletRef = useRef(null)
  const markersRef = useRef({})
  const hasFitBoundsRef = useRef(false)
  const prevGpsCountRef = useRef(0)
  const [zoom, setZoom] = useState(13)

  // ── Init Leaflet once ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!L) {
        const mod = await import('leaflet')
        L = mod.default ?? mod
      }
      if (cancelled || !mapRef.current || leafletRef.current) return

      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const withGPS = vehicles.filter((v) => v.lat != null && v.lng != null)
      const centre = withGPS.length
        ? [
            withGPS.reduce((s, v) => s + v.lat, 0) / withGPS.length,
            withGPS.reduce((s, v) => s + v.lng, 0) / withGPS.length,
          ]
        : [-26.2041, 28.0473]

      const map = L.map(mapRef.current, {
        center:          centre,
        zoom:            13,
        zoomControl:     false,   // hide native zoom
        attributionControl: false, // hide attribution
        scrollWheelZoom: true,
      })

      // Satellite tile layer (Esri World Imagery — no API key required)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DigitalGlobe, GeoEye, i-cubed, USDA FSA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          maxZoom: 19,
        }
      ).addTo(map)

      // Street label overlay on top of satellite (optional — shows road names)
      L.tileLayer(
        'https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.7 }
      ).addTo(map)

      map.on('zoomend', () => setZoom(map.getZoom()))

      leafletRef.current = map
    }

    init()

    return () => {
      cancelled = true
      if (leafletRef.current) {
        leafletRef.current.remove()
        leafletRef.current = null
        markersRef.current = {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync markers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!L || !leafletRef.current) return

    const map      = leafletRef.current
    const alertIds = new Set(openAlerts.map((a) => a.vehicleId).filter(Boolean))
    const withGPS  = vehicles.filter((v) => v.lat != null && v.lng != null)
    const live     = new Set(withGPS.map((v) => v.id))

    // Remove stale
    Object.keys(markersRef.current).forEach((id) => {
      if (!live.has(id)) {
        markersRef.current[id].remove()
        delete markersRef.current[id]
      }
    })

    withGPS.forEach((v) => {
      const hasAlert = alertIds.has(v.id)
      const inMaint  = (v.status || '').toLowerCase() === 'maintenance'
      const isActive = (v.status || '').toLowerCase() === 'active'

      const col = hasAlert || inMaint ? '#ff535f' : isActive ? '#16c988' : '#3a82ff'
      const bg  = hasAlert || inMaint
        ? 'rgba(40,10,18,0.94)'
        : isActive
        ? 'rgba(8,28,20,0.94)'
        : 'rgba(10,18,40,0.94)'

      const pinHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div style="
            background:${bg};
            border:2px solid ${col};
            border-radius:8px;
            padding:4px 10px;
            font-family:system-ui,sans-serif;
            font-size:11px;
            font-weight:800;
            color:${col};
            white-space:nowrap;
            box-shadow:0 2px 12px rgba(0,0,0,0.55),0 0 0 1px ${col}33;
            cursor:pointer;
            letter-spacing:0.05em;
            transform-origin:bottom center;
            animation:fleet-pin-drop 0.3s cubic-bezier(0.34,1.56,0.64,1) both;
          ">${v.unitId || v.id}</div>
          <div style="
            width:8px;height:8px;
            border-radius:50%;
            background:${col};
            box-shadow:0 0 8px ${col};
          "></div>
        </div>
      `

      const icon = L.divIcon({
        html: pinHtml,
        className: '',
        iconAnchor:  [30, 26],
        popupAnchor: [0, -30],
      })

      if (markersRef.current[v.id]) {
        markersRef.current[v.id].setLatLng([v.lat, v.lng]).setIcon(icon)
      } else {
        const marker = L.marker([v.lat, v.lng], { icon })
          .bindPopup(buildPopup(v, hasAlert), {
            maxWidth: 240,
            className: 'fleet-leaflet-popup',
          })
          .on('click', () => onVehicleClick?.(v))
          .addTo(map)
        markersRef.current[v.id] = marker
      }
    })

    // Fit bounds only on initial load or when GPS-enabled vehicle count changes
    const gpsCount = withGPS.length
    if (gpsCount > 0) {
      const shouldFit = !hasFitBoundsRef.current || gpsCount !== prevGpsCountRef.current
      if (shouldFit) {
        try {
          const grp = L.featureGroup(Object.values(markersRef.current))
          map.fitBounds(grp.getBounds().pad(0.28), { maxZoom: 15, animate: true })
          hasFitBoundsRef.current = true
        } catch {
          // ignore
        }
      }
    }
    prevGpsCountRef.current = gpsCount
  }, [vehicles, openAlerts, onVehicleClick])

  // ── Custom control handlers ───────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    leafletRef.current?.zoomIn()
  }, [])

  const handleZoomOut = useCallback(() => {
    leafletRef.current?.zoomOut()
  }, [])

  const handleFit = useCallback(() => {
    if (!leafletRef.current) return
    const markers = Object.values(markersRef.current)
    if (markers.length === 0) return
    try {
      const grp = L.featureGroup(markers)
      leafletRef.current.fitBounds(grp.getBounds().pad(0.28), { maxZoom: 15, animate: true })
    } catch {
      // ignore
    }
  }, [])

  return (
    <>
      <LeafletCSS />
      {/* Container — relative so custom controls overlay the map */}
      <div style={{ position: 'relative', height, width: '100%', ...style }}>

        {/* Leaflet map canvas */}
        <div ref={mapRef} style={{ height: '100%', width: '100%', background: '#0a0e1a' }} />

        {/* ── Custom zoom controls ── */}
        <div style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          zIndex: 500,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {/* Zoom in */}
          <ZoomBtn onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </ZoomBtn>

          {/* Zoom level indicator */}
          <div style={{
            width: '32px',
            height: '22px',
            background: 'rgba(10,14,28,0.88)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 800,
            color: 'rgba(148,163,184,0.7)',
            letterSpacing: '0.04em',
            backdropFilter: 'blur(8px)',
          }}>
            {zoom}
          </div>

          {/* Zoom out */}
          <ZoomBtn onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </ZoomBtn>

          {/* Fit all */}
          <ZoomBtn onClick={handleFit} title="Fit all vehicles" aria-label="Fit all vehicles" style={{ marginTop: '4px' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="1" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="1" y="9" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="9" y="9" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </ZoomBtn>
        </div>

        {/* No-GPS message */}
        {vehicles.filter((v) => v.lat != null && v.lng != null).length === 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '8px',
            color: 'rgba(148,163,184,0.45)',
            pointerEvents: 'none', zIndex: 400,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            <span style={{ fontSize: '11.5px', fontWeight: 600 }}>
              No GPS coordinates — add lat/lng when registering
            </span>
          </div>
        )}
      </div>

      {/* Popup + pin animation styles */}
      <style>{`
        @keyframes fleet-pin-drop {
          from { transform: translateY(-12px) scale(0.8); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        .fleet-leaflet-popup .leaflet-popup-content-wrapper {
          background: rgba(10,14,28,0.96) !important;
          border: 1px solid rgba(58,130,255,0.2) !important;
          border-radius: 12px !important;
          box-shadow: 0 16px 40px rgba(0,0,0,0.65) !important;
          backdrop-filter: blur(12px) !important;
          color: #fff !important;
          padding: 0 !important;
        }
        .fleet-leaflet-popup .leaflet-popup-content {
          margin: 14px 16px !important;
        }
        .fleet-leaflet-popup .leaflet-popup-tip-container {
          display: none !important;
        }
        .fleet-leaflet-popup .leaflet-popup-close-button {
          color: rgba(148,163,184,0.6) !important;
          font-size: 16px !important;
          top: 6px !important;
          right: 8px !important;
        }
        .fleet-leaflet-popup .leaflet-popup-close-button:hover {
          color: #fff !important;
        }
        /* Hide Leaflet native attribution and zoom */
        .leaflet-control-attribution,
        .leaflet-control-zoom {
          display: none !important;
        }
      `}</style>
    </>
  )
}

/* Reusable custom zoom button */
function ZoomBtn({ children, onClick, title, style = {} }) {
  const [pressed, setPressed] = React.useState(false)
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        width: '32px',
        height: '32px',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '8px',
        background: pressed
          ? 'rgba(58,130,255,0.25)'
          : 'rgba(10,14,28,0.88)',
        color: pressed ? '#8ab8ff' : 'rgba(203,214,255,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        transition: 'background 120ms, color 120ms, transform 100ms',
        transform: pressed ? 'scale(0.88)' : 'scale(1)',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/* Build popup HTML */
function buildPopup(v, hasAlert) {
  const health = v.healthScore ?? 100
  const hCol   = health >= 70 ? '#4deba0' : health >= 40 ? '#ffb56e' : '#ff8080'
  const sCol   = (v.status || '').toLowerCase() === 'active' ? '#4deba0' : '#ffb56e'
  return `
    <div style="font-family:system-ui,sans-serif;min-width:180px;">
      <div style="font-size:15px;font-weight:800;color:#fff;margin:0 0 2px">${v.unitId || v.id}</div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:rgba(148,163,184,.65);margin-bottom:10px">${v.vehicleType || '—'} · ${v.category || '—'}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr><td style="color:rgba(148,163,184,.6);padding:3px 0">Driver</td><td style="color:#fff;text-align:right;font-weight:600">${v.driverName || 'Unassigned'}</td></tr>
        <tr><td style="color:rgba(148,163,184,.6);padding:3px 0">Status</td><td style="color:${sCol};text-align:right;font-weight:700">${cap(v.status)}</td></tr>
        <tr><td style="color:rgba(148,163,184,.6);padding:3px 0">Health</td><td style="color:${hCol};text-align:right;font-weight:700">${health}%</td></tr>
        <tr><td style="color:rgba(148,163,184,.6);padding:3px 0">Fuel</td><td style="color:#fff;text-align:right;font-weight:600">${v.fuelLevel != null ? v.fuelLevel + '%' : '—'}</td></tr>
        <tr><td style="color:rgba(148,163,184,.6);padding:3px 0">Site</td><td style="color:#fff;text-align:right;font-weight:600">${v.site || '—'}</td></tr>
        <tr><td style="color:rgba(148,163,184,.6);padding:3px 0;font-size:10px">GPS</td><td style="color:rgba(148,163,184,.5);text-align:right;font-size:10px">${v.lat?.toFixed(4)}, ${v.lng?.toFixed(4)}</td></tr>
      </table>
      ${hasAlert ? '<div style="margin-top:8px;padding:5px 8px;background:rgba(255,83,95,.12);border:1px solid rgba(255,83,95,.3);border-radius:5px;color:#ff8080;font-size:11px;font-weight:700">⚠ Active Alert</div>' : ''}
    </div>
  `
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—' }

/* Inject Leaflet CSS once */
let _css = false
function LeafletCSS() {
  if (typeof document !== 'undefined' && !_css) {
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(l)
    _css = true
  }
  return null
}
