import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { ROUTES, ROUTE_COLORS, BONUS_STOPS, CHALLENGE_ITEMS } from './data'

const CENTER = [40.7280, -73.9900]

const VALID_ROUTE_PARAMS = new Set(['1', '2', 'both'])

function getInitialRouteParam() {
  const value = new URLSearchParams(window.location.search).get('route')
  return VALID_ROUTE_PARAMS.has(value) ? value : 'both'
}

// Route 2 shares two addresses with Route 1 (Strand, Housing Works). Nudge
// Route 2's copy slightly so both markers stay visible when both routes show.
function stopPosition(routeId, stop) {
  if (routeId === 2) {
    return [stop.lat - 0.00007, stop.lng + 0.00014]
  }
  return [stop.lat, stop.lng]
}

function buildDirectionsUrl(route) {
  const stops = route.stops
  const origin = `${stops[0].lat},${stops[0].lng}`
  const destination = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`
  const waypoints = stops.slice(1, -1).map(s => `${s.lat},${s.lng}`).join('|')
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'walking' })
  if (waypoints) params.set('waypoints', waypoints)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

function buildStopMapsUrl(stop) {
  const params = new URLSearchParams({ api: '1', query: `${stop.lat},${stop.lng}` })
  return `https://www.google.com/maps/search/?${params.toString()}`
}

function buildShareUrl(routeParam) {
  const url = new URL(window.location.href)
  url.search = ''
  if (routeParam !== 'both') url.searchParams.set('route', routeParam)
  return url.toString()
}

function makeNumberedIcon(color, label, { big } = {}) {
  const size = big ? 34 : 28
  const fontSize = big ? 15 : 13
  const html = `
    <svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="17" fill="${color}" stroke="white" stroke-width="3"/>
      <text x="20" y="26" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${fontSize * 1.4}" font-weight="700" fill="white">${label}</text>
    </svg>`
  return L.divIcon({
    className: '',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

function makeBonusIcon(emoji) {
  const html = `
    <svg width="30" height="30" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="17" fill="#FDF8F0" stroke="#C9A86A" stroke-width="2.5"/>
      <text x="20" y="27" text-anchor="middle" font-size="18">${emoji}</text>
    </svg>`
  return L.divIcon({
    className: '',
    html,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  })
}

function FitBounds({ visibleRouteIds, showBonus }) {
  const map = useMap()
  useEffect(() => {
    const points = []
    visibleRouteIds.forEach(routeId => {
      ROUTES[routeId].stops.forEach(stop => points.push(stopPosition(routeId, stop)))
    })
    if (showBonus) BONUS_STOPS.forEach(stop => points.push([stop.lat, stop.lng]))
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [48, 48] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRouteIds.join(','), showBonus, map])
  return null
}

function FlyToActive({ activeStopId, position, markerRefs }) {
  const map = useMap()
  useEffect(() => {
    if (activeStopId && position) {
      map.flyTo(position, 16, { duration: 0.8 })
      setTimeout(() => markerRefs.current[activeStopId]?.openPopup(), 850)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStopId])
  return null
}

export default function App() {
  const [routeParam, setRouteParam] = useState(getInitialRouteParam)
  const [activeStopId, setActiveStopId] = useState(null)
  const [showBonus, setShowBonus] = useState(true)
  const [shareStatus, setShareStatus] = useState('idle')
  const [checked, setChecked] = useState(() => CHALLENGE_ITEMS.map(() => false))
  const markerRefs = useRef({})

  const visibleRouteIds = routeParam === 'both' ? [1, 2] : [Number(routeParam)]

  useEffect(() => {
    const url = new URL(window.location.href)
    if (routeParam === 'both') url.searchParams.delete('route')
    else url.searchParams.set('route', routeParam)
    window.history.replaceState({}, '', url)
  }, [routeParam])

  const stopIndex = useMemo(() => {
    const map = {}
    Object.values(ROUTES).forEach(route => {
      route.stops.forEach(stop => {
        map[stop.id] = { stop, route, position: stopPosition(route.id, stop) }
      })
    })
    BONUS_STOPS.forEach(stop => {
      map[stop.id] = { stop, bonus: true, position: [stop.lat, stop.lng] }
    })
    return map
  }, [])

  const goToStop = useCallback(stop => {
    setActiveStopId(stop.id)
  }, [])

  const handleShare = useCallback(async () => {
    const url = buildShareUrl(routeParam)
    const routeName = routeParam === 'both' ? 'Both Routes' : ROUTES[routeParam].name
    const shareData = { title: `NYC Book Crawl — ${routeName}`, text: 'A literary walking tour of Lower Manhattan indie bookstores.', url }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // user cancelled — nothing to do
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('copied')
      setTimeout(() => setShareStatus('idle'), 2000)
    } catch {
      // clipboard unavailable — nothing to do
    }
  }, [routeParam])

  const active = activeStopId ? stopIndex[activeStopId] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#FDF8F0', color: '#1A1A1A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ flexShrink: 0, padding: '12px 20px', borderBottom: '1px solid #E9E0CC', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', background: '#FDF8F0' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>
          📖 NYC <span style={{ color: '#1B3A5C' }}>Book</span> <span style={{ color: '#2E6B4F' }}>Crawl</span>
        </div>
        <RouteTabs routeParam={routeParam} setRouteParam={setRouteParam} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#555', cursor: 'pointer' }}>
          <input type="checkbox" checked={showBonus} onChange={e => setShowBonus(e.target.checked)} />
          Bonus stops
        </label>
        <button onClick={handleShare} style={shareButtonStyle}>
          {shareStatus === 'copied' ? '✓ Link copied' : '🔗 Share'}
        </button>
      </header>

      <div className="main-layout">
        <div className="map-pane">
          <MapContainer center={CENTER} zoom={13} style={{ width: '100%', height: '100%' }} scrollWheelZoom={true}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {visibleRouteIds.map(routeId => (
              <Polyline
                key={routeId}
                positions={ROUTES[routeId].stops.map(stop => stopPosition(routeId, stop))}
                pathOptions={{ color: ROUTES[routeId].color, weight: 4, dashArray: '2 10', lineCap: 'round' }}
              />
            ))}

            {visibleRouteIds.flatMap(routeId => {
              const route = ROUTES[routeId]
              return route.stops.map(stop => (
                <Marker
                  key={stop.id}
                  position={stopPosition(routeId, stop)}
                  icon={makeNumberedIcon(route.color, stop.order, { big: activeStopId === stop.id })}
                  ref={el => { markerRefs.current[stop.id] = el }}
                  eventHandlers={{ click: () => goToStop(stop) }}
                >
                  <Popup>
                    <StopDetails entry={{ stop, route }} />
                  </Popup>
                </Marker>
              ))
            })}

            {showBonus && BONUS_STOPS.map(stop => (
              <Marker
                key={stop.id}
                position={[stop.lat, stop.lng]}
                icon={makeBonusIcon(stop.icon)}
                ref={el => { markerRefs.current[stop.id] = el }}
                eventHandlers={{ click: () => goToStop(stop) }}
              >
                <Popup>
                  <StopDetails entry={{ stop, bonus: true }} />
                </Popup>
              </Marker>
            ))}

            <FitBounds visibleRouteIds={visibleRouteIds} showBonus={showBonus} />
            {active && <FlyToActive activeStopId={activeStopId} position={active.position} markerRefs={markerRefs} />}
          </MapContainer>

          <div style={legendStyle}>
            {visibleRouteIds.map(routeId => (
              <div key={routeId} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 600, marginBottom: '2px' }}>
                <span style={{ width: '14px', height: '3px', borderRadius: '2px', background: ROUTES[routeId].color, display: 'inline-block' }} />
                {ROUTES[routeId].subtitle}: {ROUTES[routeId].name}
              </div>
            ))}
            {showBonus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#999', marginTop: '2px' }}>
                <span>⭐</span> Bonus stops
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-pane">
          <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
            {visibleRouteIds.map(routeId => (
              <RouteCard
                key={routeId}
                route={ROUTES[routeId]}
                activeStopId={activeStopId}
                onSelectStop={stop => goToStop(stop)}
              />
            ))}

            <SectionCard title="Tips & Bonus Stops">
              {BONUS_STOPS.map(stop => (
                <div key={stop.id} style={{ display: 'flex', gap: '8px', marginBottom: '10px', fontSize: '12px', color: '#555' }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{stop.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1A1A1A' }}>{stop.name}</div>
                    <div>{stop.note}</div>
                  </div>
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Book Crawl Challenge">
              {CHALLENGE_ITEMS.map((item, i) => (
                <label key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: checked[i] ? '#999' : '#333', marginBottom: '8px', cursor: 'pointer', textDecoration: checked[i] ? 'line-through' : 'none' }}>
                  <input
                    type="checkbox"
                    checked={checked[i]}
                    onChange={() => setChecked(c => c.map((v, idx) => idx === i ? !v : v))}
                    style={{ marginTop: '2px' }}
                  />
                  {item}
                </label>
              ))}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}

function RouteTabs({ routeParam, setRouteParam }) {
  const options = [
    { value: '1', label: 'Route 1', color: ROUTE_COLORS[1] },
    { value: '2', label: 'Route 2', color: ROUTE_COLORS[2] },
    { value: 'both', label: 'Both', color: '#7A6A4F' },
  ]
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {options.map(opt => {
        const active = routeParam === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setRouteParam(opt.value)}
            style={{
              fontSize: '12px', padding: '5px 12px', borderRadius: '9999px', border: '1px solid',
              cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
              borderColor: active ? 'transparent' : '#DDD',
              background: active ? opt.color : 'transparent',
              color: active ? '#fff' : '#555',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function RouteCard({ route, activeStopId, onSelectStop }) {
  return (
    <div style={{ marginBottom: '18px', border: `1.5px solid ${route.color}22`, borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ background: route.color, color: '#fff', padding: '10px 14px' }}>
        <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{route.subtitle}</div>
        <div style={{ fontSize: '15px', fontWeight: 700 }}>{route.name}</div>
        <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '4px' }}>🚶 {route.totalWalk} · ⏱ {route.suggestedTime}</div>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <a
          href={buildDirectionsUrl(route)}
          target="_blank"
          rel="noreferrer"
          style={{ display: 'inline-block', fontSize: '11px', fontWeight: 600, color: route.color, marginBottom: '10px', textDecoration: 'none' }}
        >
          Open full walking route in Google Maps ↗
        </a>
        {route.stops.map(stop => {
          const isActive = activeStopId === stop.id
          return (
            <div key={stop.id}>
              <button
                onClick={() => onSelectStop(stop)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', gap: '10px', padding: '8px', borderRadius: '10px',
                  border: 'none', cursor: 'pointer', background: isActive ? `${route.color}14` : 'transparent',
                }}
              >
                <span style={{
                  flexShrink: 0, width: '22px', height: '22px', borderRadius: '50%', background: route.color, color: '#fff',
                  fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{stop.order}</span>
                <span>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#1A1A1A' }}>
                    {stop.name}
                    {stop.isStart && <span style={badgeStyle('#2E6B4F')}>START</span>}
                    {stop.isFinish && <span style={badgeStyle('#B0413E')}>FINISH</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: '#999' }}>{stop.address}</div>
                  {stop.description && <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{stop.description}</div>}
                </span>
              </button>
              {stop.walkToNext && (
                <div style={{ fontSize: '10.5px', color: '#aaa', margin: '2px 0 2px 40px' }}>
                  🚶 {stop.walkToNext.duration} walk ({stop.walkToNext.distance}) to next stop
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function badgeStyle(color) {
  return { fontSize: '9px', fontWeight: 700, color, background: `${color}1A`, borderRadius: '9999px', padding: '1px 6px', marginLeft: '6px', verticalAlign: 'middle' }
}

function SectionCard({ title, children }) {
  return (
    <div style={{ marginBottom: '18px', border: '1px solid #E9E0CC', borderRadius: '14px', padding: '12px 14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7A6A4F', marginBottom: '10px' }}>{title}</div>
      {children}
    </div>
  )
}

function StopDetails({ entry }) {
  const { stop, route, bonus } = entry
  return (
    <div style={{ padding: '2px', minWidth: '190px', maxWidth: '230px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1A1A1A', marginBottom: '2px' }}>{stop.name}</div>
      {!bonus && <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>{stop.address}</div>}
      {stop.description && <div style={{ fontSize: '12px', color: '#555', marginBottom: '6px' }}>{stop.description}</div>}
      {bonus && <div style={{ fontSize: '12px', color: '#555', marginBottom: '6px' }}>{stop.note}</div>}
      {stop.hours && (
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px' }}>
          {stop.hours.map(([days, hours]) => (
            <div key={days}>{days}: {hours}</div>
          ))}
        </div>
      )}
      {stop.walkToNext && (
        <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px' }}>🚶 {stop.walkToNext.duration} to next stop ({stop.walkToNext.distance})</div>
      )}
      {!bonus && (
        <a href={buildStopMapsUrl(stop)} target="_blank" rel="noreferrer" style={{ fontSize: '11px', fontWeight: 600, color: route ? route.color : '#1B3A5C', textDecoration: 'none' }}>
          Open in Google Maps ↗
        </a>
      )}
    </div>
  )
}

const legendStyle = {
  position: 'absolute', bottom: '12px', right: '12px', zIndex: 1000, background: '#fff', borderRadius: '10px',
  padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
}

const shareButtonStyle = {
  marginLeft: 'auto', fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '9999px',
  border: '1px solid #1B3A5C', background: '#1B3A5C', color: '#fff', cursor: 'pointer',
}
