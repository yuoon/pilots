import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { GoogleMap, Marker, InfoWindow, Polyline, useJsApiLoader } from '@react-google-maps/api'
import { ROUTES, ROUTE_COLORS, BONUS_STOPS, CHALLENGE_ITEMS } from './data'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

const CENTER = { lat: 40.7280, lng: -73.9900 }

const VALID_ROUTE_PARAMS = new Set(['1', '2', 'both'])

function getInitialRouteParam() {
  const value = new URLSearchParams(window.location.search).get('route')
  return VALID_ROUTE_PARAMS.has(value) ? value : 'both'
}

// Route 2 shares two addresses with Route 1 (Strand, Housing Works). Nudge
// Route 2's copy slightly so both markers stay visible when both routes show.
function stopPosition(routeId, stop) {
  if (routeId === 2) {
    return { lat: stop.lat - 0.00007, lng: stop.lng + 0.00014 }
  }
  return { lat: stop.lat, lng: stop.lng }
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
  const params = new URLSearchParams({
    api: '1',
    query: `${stop.lat},${stop.lng}`,
    query_place_id: '',
  })
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
  const fontSize = big ? 14 : 12
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="17" fill="${color}" stroke="white" stroke-width="3"/>
      <text x="20" y="26" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${fontSize * 1.4}" font-weight="700" fill="white">${label}</text>
    </svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size / 2, size / 2),
  }
}

function makeBonusIcon(emoji) {
  const svg = `
    <svg width="30" height="30" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="17" fill="#FDF8F0" stroke="#C9A86A" stroke-width="2.5"/>
      <text x="20" y="27" text-anchor="middle" font-size="18">${emoji}</text>
    </svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(30, 30),
    anchor: new window.google.maps.Point(15, 15),
  }
}

export default function App() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'nyc-book-crawl-map',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const [routeParam, setRouteParam] = useState(getInitialRouteParam)
  const [activeStopId, setActiveStopId] = useState(null)
  const [showBonus, setShowBonus] = useState(true)
  const [shareStatus, setShareStatus] = useState('idle')
  const [checked, setChecked] = useState(() => CHALLENGE_ITEMS.map(() => false))
  const mapRef = useRef(null)

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
        map[stop.id] = { stop, route }
      })
    })
    BONUS_STOPS.forEach(stop => {
      map[stop.id] = { stop, bonus: true }
    })
    return map
  }, [])

  const fitToVisible = useCallback((map, ids, bonus) => {
    if (!window.google) return
    const bounds = new window.google.maps.LatLngBounds()
    let any = false
    ids.forEach(routeId => {
      ROUTES[routeId].stops.forEach(stop => {
        bounds.extend(stopPosition(routeId, stop))
        any = true
      })
    })
    if (bonus) {
      BONUS_STOPS.forEach(stop => {
        bounds.extend({ lat: stop.lat, lng: stop.lng })
        any = true
      })
    }
    if (any) map.fitBounds(bounds, 48)
  }, [])

  const onMapLoad = useCallback(map => {
    mapRef.current = map
    fitToVisible(map, visibleRouteIds, showBonus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mapRef.current) fitToVisible(mapRef.current, visibleRouteIds, showBonus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParam, showBonus, isLoaded])

  const goToStop = useCallback((stop, routeId) => {
    setActiveStopId(stop.id)
    if (mapRef.current) {
      mapRef.current.panTo(routeId ? stopPosition(routeId, stop) : { lat: stop.lat, lng: stop.lng })
      mapRef.current.setZoom(16)
    }
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
          {!GOOGLE_MAPS_API_KEY && <ApiKeyNotice />}
          {GOOGLE_MAPS_API_KEY && loadError && (
            <div style={noticeStyle}>Google Maps failed to load. Check that <code>VITE_GOOGLE_MAPS_API_KEY</code> is valid and enabled for the Maps JavaScript API.</div>
          )}
          {GOOGLE_MAPS_API_KEY && !loadError && !isLoaded && (
            <div style={noticeStyle}>Loading map…</div>
          )}
          {GOOGLE_MAPS_API_KEY && isLoaded && (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={CENTER}
              zoom={13}
              onLoad={onMapLoad}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
                clickableIcons: false,
                styles: MAP_STYLE,
              }}
              onClick={() => setActiveStopId(null)}
            >
              {visibleRouteIds.map(routeId => {
                const route = ROUTES[routeId]
                return (
                  <Polyline
                    key={routeId}
                    path={route.stops.map(stop => stopPosition(routeId, stop))}
                    options={{
                      strokeColor: route.color,
                      strokeOpacity: 0,
                      icons: [{
                        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                        offset: '0',
                        repeat: '12px',
                      }],
                      zIndex: 1,
                    }}
                  />
                )
              })}

              {visibleRouteIds.flatMap(routeId => {
                const route = ROUTES[routeId]
                return route.stops.map(stop => (
                  <Marker
                    key={stop.id}
                    position={stopPosition(routeId, stop)}
                    icon={makeNumberedIcon(route.color, stop.order, { big: activeStopId === stop.id })}
                    zIndex={activeStopId === stop.id ? 1000 : 10}
                    onClick={() => goToStop(stop, routeId)}
                  />
                ))
              })}

              {showBonus && BONUS_STOPS.map(stop => (
                <Marker
                  key={stop.id}
                  position={{ lat: stop.lat, lng: stop.lng }}
                  icon={makeBonusIcon(stop.icon)}
                  zIndex={5}
                  onClick={() => goToStop(stop)}
                />
              ))}

              {active && (
                <InfoWindow
                  position={active.route ? stopPosition(active.route.id, active.stop) : { lat: active.stop.lat, lng: active.stop.lng }}
                  onCloseClick={() => setActiveStopId(null)}
                >
                  <StopDetails entry={active} />
                </InfoWindow>
              )}
            </GoogleMap>
          )}

          {GOOGLE_MAPS_API_KEY && isLoaded && (
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
          )}
        </div>

        <div className="sidebar-pane">
          <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
            {visibleRouteIds.map(routeId => (
              <RouteCard
                key={routeId}
                route={ROUTES[routeId]}
                activeStopId={activeStopId}
                onSelectStop={stop => goToStop(stop, routeId)}
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
    <div style={{ padding: '4px', minWidth: '200px', maxWidth: '240px', fontFamily: 'Inter, system-ui, sans-serif' }}>
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

function ApiKeyNotice() {
  return (
    <div style={noticeStyle}>
      <div style={{ fontWeight: 700, marginBottom: '6px' }}>Google Maps API key needed</div>
      <div>
        Add a key to <code>VITE_GOOGLE_MAPS_API_KEY</code> in a <code>.env</code> file (see <code>.env.example</code>) with the
        Maps JavaScript API enabled, then restart the dev server.
      </div>
    </div>
  )
}

const noticeStyle = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  textAlign: 'center', padding: '32px', fontSize: '13px', color: '#555', background: '#F3EEE0', maxWidth: '360px',
  margin: 'auto', height: 'fit-content', borderRadius: '14px', top: '50%', transform: 'translateY(-50%)',
}

const legendStyle = {
  position: 'absolute', bottom: '12px', right: '12px', zIndex: 10, background: '#fff', borderRadius: '10px',
  padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
}

const shareButtonStyle = {
  marginLeft: 'auto', fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '9999px',
  border: '1px solid #1B3A5C', background: '#1B3A5C', color: '#fff', cursor: 'pointer',
}

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#FDF8F0' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FDF8F0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f5efe0' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfe3ea' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e3ecd9' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
]
