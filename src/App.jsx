import { useState, useReducer, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

const ROOMS = [
  { id: 1, name: "Komnata Quest", neighborhood: "Greenpoint", borough: "Brooklyn", lat: 40.7282, lng: -73.9512, difficulty: "Expert", immersive: true, duration: 60, pricePerPerson: 35, themes: ["Horror", "Live Actors"], rooms: ["Suicide Hotel", "Doctor Frankenstein"], rating: 4.9 },
  { id: 2, name: "MyssTic Escape", neighborhood: "Park Slope", borough: "Brooklyn", lat: 40.6710, lng: -73.9782, difficulty: "Medium", immersive: true, duration: 60, pricePerPerson: 28, themes: ["Mystery", "Paranormal"], rooms: ["Ghost Light"], rating: 5.0 },
  { id: 3, name: "The Escape Game Brooklyn", neighborhood: "DUMBO", borough: "Brooklyn", lat: 40.7033, lng: -73.9893, difficulty: "Medium", immersive: true, duration: 60, pricePerPerson: 39, themes: ["Adventure", "Heist"], rooms: ["Gold Rush", "Prison Break"], rating: 5.0 },
  { id: 4, name: "Peddlers and Parchment", neighborhood: "Midwood", borough: "Brooklyn", lat: 40.6237, lng: -73.9637, difficulty: "Easy", immersive: false, duration: 60, pricePerPerson: 25, themes: ["Fantasy", "Family"], rooms: ["The Sorcerer's Study"], rating: 5.0 },
  { id: 5, name: "The Great Escape Room Queens", neighborhood: "Rego Park", borough: "Queens", lat: 40.7282, lng: -73.8620, difficulty: "Medium", immersive: true, duration: 60, pricePerPerson: 30, themes: ["Horror", "Zombie", "Arcade"], rooms: ["Haunted Knickerbocker", "Zombie Room", "Arcade Challenge"], rating: 4.7 },
  { id: 6, name: "BrainXcape", neighborhood: "Financial District", borough: "Manhattan", lat: 40.7074, lng: -74.0113, difficulty: "Expert", immersive: true, duration: 60, pricePerPerson: 38, themes: ["Horror", "Thriller"], rooms: ["Rikers 1932", "Haunted Hotel", "Elevator To Hell"], rating: 4.9 },
  { id: 7, name: "Escape The Room NYC", neighborhood: "Flatiron", borough: "Manhattan", lat: 40.7401, lng: -73.9903, difficulty: "Medium", immersive: true, duration: 60, pricePerPerson: 44, themes: ["Sci-Fi", "Office", "Dinosaurs"], rooms: ["The Office", "Jurassic Escape", "Outbreak", "The Agency"], rating: 4.8 },
  { id: 8, name: "Mission Escape Games", neighborhood: "Garment District", borough: "Manhattan", lat: 40.7530, lng: -73.9968, difficulty: "Hard", immersive: true, duration: 60, pricePerPerson: 36, themes: ["Sci-Fi", "Mystery"], rooms: ["Carbon: 3708", "Hydeout"], rating: 4.8 },
  { id: 9, name: "Escapology NYC", neighborhood: "Midtown", borough: "Manhattan", lat: 40.7587, lng: -73.9787, difficulty: "Medium", immersive: true, duration: 60, pricePerPerson: 40, themes: ["Pirate", "Murder Mystery"], rooms: ["A Pirate's Curse", "Masquerade"], rating: 4.8 },
  { id: 10, name: "PanIQ Room Manhattan", neighborhood: "Midtown", borough: "Manhattan", lat: 40.7484, lng: -73.9878, difficulty: "Expert", immersive: true, duration: 60, pricePerPerson: 35, themes: ["Pirate", "Adventure"], rooms: ["Hades' Plunder"], rating: 4.7 },
  { id: 11, name: "Clue Chase", neighborhood: "Koreatown", borough: "Manhattan", lat: 40.7490, lng: -73.9878, difficulty: "Easy", immersive: false, duration: 60, pricePerPerson: 28, themes: ["Spy", "Historical", "Heist"], rooms: ["Cold War", "Egyptian Tomb", "Robin Hood Heist", "1920s Speakeasy"], rating: 4.7 },
  { id: 12, name: "Exit Escape Room NYC", neighborhood: "Upper East Side", borough: "Manhattan", lat: 40.7680, lng: -73.9640, difficulty: "Medium", immersive: true, duration: 60, pricePerPerson: 32, themes: ["Family", "Thriller"], rooms: ["Sugar Rush", "Train Heist"], rating: 4.6 },
  { id: 13, name: "Escape Room Madness", neighborhood: "Midtown", borough: "Manhattan", lat: 40.7549, lng: -73.9840, difficulty: "Medium", immersive: false, duration: 60, pricePerPerson: 30, themes: ["Mystery", "Adventure"], rooms: ["6 private rooms"], rating: 4.6 },
]

const BOROUGH_COLORS = {
  Brooklyn: '#FF6B6B',
  Manhattan: '#7FB069',
  Queens: '#C5A3D5',
}

const DIFFICULTY_STYLES = {
  Easy:   { bg: '#D1FAE5', text: '#065F46' },
  Medium: { bg: '#FEF3C7', text: '#92400E' },
  Hard:   { bg: '#FFEDD5', text: '#9A3412' },
  Expert: { bg: '#FEE2E2', text: '#991B1B' },
}

const DURATIONS = [45, 60, 75, 90]

function makeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.268 0 0 6.268 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.268 21.732 0 14 0Z" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38],
  })
}

const ICONS = {
  Brooklyn: makeIcon(BOROUGH_COLORS.Brooklyn),
  Manhattan: makeIcon(BOROUGH_COLORS.Manhattan),
  Queens: makeIcon(BOROUGH_COLORS.Queens),
}

function DifficultyBadge({ difficulty }) {
  const s = DIFFICULTY_STYLES[difficulty] || DIFFICULTY_STYLES.Medium
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.text }}>
      {difficulty}
    </span>
  )
}

function BoroughTag({ borough }) {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: BOROUGH_COLORS[borough] || '#888' }}>
      {borough}
    </span>
  )
}

function PopupCard({ room }) {
  return (
    <div style={{ padding: '12px', minWidth: '200px', maxWidth: '240px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', color: '#1A1A1A', lineHeight: 1.3, marginBottom: '4px' }}>{room.name}</div>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>{room.neighborhood}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
        <DifficultyBadge difficulty={room.difficulty} />
        {room.immersive && (
          <span style={{ fontSize: '11px', background: '#F3E8FF', color: '#7C3AED', fontWeight: 500, padding: '2px 8px', borderRadius: '9999px' }}>🎭 Immersive</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#555' }}>
        <span style={{ fontWeight: 600, color: '#1A1A1A' }}>${room.pricePerPerson}/pp</span>
        <span>{room.duration} min</span>
        <span style={{ color: '#F59E0B', fontWeight: 600 }}>★ {room.rating.toFixed(1)}</span>
      </div>
      {room.rooms.length > 0 && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F0F0F0' }}>
          <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>Rooms:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
            {room.rooms.map(r => (
              <span key={r} style={{ fontSize: '11px', background: '#F5F5F5', color: '#555', padding: '2px 6px', borderRadius: '4px' }}>{r}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FlyToRoom({ room }) {
  const map = useMap()
  useEffect(() => {
    if (room) map.flyTo([room.lat, room.lng], 15, { duration: 0.8 })
  }, [room, map])
  return null
}

function OpenMarkerPopup({ selectedRoom, markerRefs }) {
  const map = useMap()
  useEffect(() => {
    if (selectedRoom && markerRefs.current[selectedRoom.id]) {
      setTimeout(() => {
        markerRefs.current[selectedRoom.id]?.openPopup()
      }, 900)
    }
  }, [selectedRoom, map, markerRefs])
  return null
}

const initialFilters = {
  borough: 'All',
  difficulty: 'All',
  immersiveOnly: false,
  durations: [],
  maxPrice: 60,
}

function filtersReducer(state, action) {
  switch (action.type) {
    case 'SET_BOROUGH': return { ...state, borough: action.value }
    case 'SET_DIFFICULTY': return { ...state, difficulty: action.value }
    case 'TOGGLE_IMMERSIVE': return { ...state, immersiveOnly: !state.immersiveOnly }
    case 'TOGGLE_DURATION': {
      const d = action.value
      const durations = state.durations.includes(d)
        ? state.durations.filter(x => x !== d)
        : [...state.durations, d]
      return { ...state, durations }
    }
    case 'SET_MAX_PRICE': return { ...state, maxPrice: action.value }
    default: return state
  }
}

function applyFilters(rooms, filters) {
  return rooms.filter(r => {
    if (filters.borough !== 'All' && r.borough !== filters.borough) return false
    if (filters.difficulty !== 'All' && r.difficulty !== filters.difficulty) return false
    if (filters.immersiveOnly && !r.immersive) return false
    if (filters.durations.length > 0 && !filters.durations.includes(r.duration)) return false
    if (r.pricePerPerson > filters.maxPrice) return false
    return true
  })
}

export default function App() {
  const [filters, dispatch] = useReducer(filtersReducer, initialFilters)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const markerRefs = useRef({})

  const filtered = applyFilters(ROOMS, filters)

  const handleSelectRoom = useCallback((room) => {
    setSelectedRoom(room)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F9F7F4', color: '#1A1A1A', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ flexShrink: 0, padding: '12px 20px', borderBottom: '1px solid #E8E8E8', display: 'flex', alignItems: 'center', gap: '12px', background: '#F9F7F4' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>
          NYC <span style={{ color: '#FF6B6B' }}>Escape Room</span> Explorer
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#999' }}>{ROOMS.length} venues across NYC</div>
      </header>

      {/* Main */}
      <div className="main-layout">
        {/* Map */}
        <div className="map-pane">
          <MapContainer
            center={[40.7300, -73.9650]}
            zoom={11}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map(room => (
              <Marker
                key={room.id}
                position={[room.lat, room.lng]}
                icon={ICONS[room.borough] || ICONS.Manhattan}
                ref={el => { markerRefs.current[room.id] = el }}
                eventHandlers={{ click: () => setSelectedRoom(room) }}
              >
                <Popup>
                  <PopupCard room={room} />
                </Popup>
              </Marker>
            ))}
            {selectedRoom && <FlyToRoom room={selectedRoom} />}
            {selectedRoom && <OpenMarkerPopup selectedRoom={selectedRoom} markerRefs={markerRefs} />}
          </MapContainer>

          {/* Legend */}
          <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 1000, background: '#fff', borderRadius: '10px', padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
            {Object.entries(BOROUGH_COLORS).map(([b, c]) => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 500, marginBottom: '2px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: c, display: 'inline-block' }} />
                {b}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar-pane">
          {/* Filters */}
          <div style={{ flexShrink: 0, padding: '16px', borderBottom: '1px solid #F0F0F0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Borough */}
            <FilterGroup label="Borough">
              {['All', 'Brooklyn', 'Manhattan', 'Queens'].map(b => (
                <PillButton
                  key={b}
                  active={filters.borough === b}
                  onClick={() => dispatch({ type: 'SET_BOROUGH', value: b })}
                  activeStyle={{ background: b === 'All' ? '#1A1A1A' : BOROUGH_COLORS[b], color: '#fff' }}
                >
                  {b}
                </PillButton>
              ))}
            </FilterGroup>

            {/* Difficulty */}
            <FilterGroup label="Difficulty">
              {['All', 'Easy', 'Medium', 'Hard', 'Expert'].map(d => {
                const s = DIFFICULTY_STYLES[d]
                return (
                  <PillButton
                    key={d}
                    active={filters.difficulty === d}
                    onClick={() => dispatch({ type: 'SET_DIFFICULTY', value: d })}
                    activeStyle={d === 'All' ? { background: '#1A1A1A', color: '#fff' } : { background: s.bg, color: s.text, fontWeight: 700 }}
                  >
                    {d}
                  </PillButton>
                )
              })}
            </FilterGroup>

            {/* Row: Immersive + Duration */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: '6px' }}>Immersive Only</div>
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_IMMERSIVE' })}
                  style={{
                    position: 'relative', display: 'inline-flex', height: '24px', width: '44px',
                    alignItems: 'center', borderRadius: '9999px', border: 'none', cursor: 'pointer',
                    background: filters.immersiveOnly ? '#FF6B6B' : '#D1D5DB', transition: 'background 0.2s',
                  }}
                  aria-label="Toggle immersive only"
                >
                  <span style={{
                    display: 'inline-block', width: '18px', height: '18px', borderRadius: '50%',
                    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transform: filters.immersiveOnly ? 'translateX(22px)' : 'translateX(3px)',
                    transition: 'transform 0.2s',
                  }} />
                </button>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: '6px' }}>Duration</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {DURATIONS.map(d => (
                    <PillButton
                      key={d}
                      active={filters.durations.includes(d)}
                      onClick={() => dispatch({ type: 'TOGGLE_DURATION', value: d })}
                      activeStyle={{ background: '#1A1A1A', color: '#fff' }}
                    >
                      {d}m
                    </PillButton>
                  ))}
                </div>
              </div>
            </div>

            {/* Price slider */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: '6px' }}>
                Max Price: <span style={{ color: '#FF6B6B' }}>${filters.maxPrice}/person</span>
              </div>
              <input
                type="range" min={0} max={60} step={1} value={filters.maxPrice}
                onChange={e => dispatch({ type: 'SET_MAX_PRICE', value: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#FF6B6B', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#bbb', marginTop: '2px' }}>
                <span>$0</span><span>$60</span>
              </div>
            </div>

            {/* Count */}
            <div style={{ fontSize: '12px', color: '#888' }}>
              Showing <strong style={{ color: '#1A1A1A' }}>{filtered.length}</strong> of {ROOMS.length} venues
            </div>
          </div>

          {/* Room list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', fontSize: '13px', color: '#bbb', padding: '32px 0' }}>No rooms match your filters.</div>
            )}
            {filtered.map(room => {
              const isSelected = selectedRoom?.id === room.id
              return (
                <RoomCard
                  key={room.id}
                  room={room}
                  isSelected={isSelected}
                  onClick={() => handleSelectRoom(room)}
                />
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#999', marginBottom: '6px' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{children}</div>
    </div>
  )
}

function PillButton({ active, onClick, activeStyle, children }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: '12px', padding: '4px 12px', borderRadius: '9999px', border: '1px solid',
        cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s',
        ...(active
          ? { borderColor: 'transparent', ...activeStyle }
          : { background: hovered ? '#F0F0F0' : 'transparent', color: '#555', borderColor: '#DDD' }),
      }}
    >
      {children}
    </button>
  )
}

function RoomCard({ room, isSelected, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', textAlign: 'left', borderRadius: '12px', border: '1.5px solid',
        padding: '12px', cursor: 'pointer', transition: 'all 0.15s',
        background: isSelected ? '#FFF5F5' : '#fff',
        borderColor: isSelected ? '#FF6B6B' : hovered ? '#DDD' : '#EEE',
        boxShadow: isSelected ? '0 0 0 2px rgba(255,107,107,0.15)' : hovered ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
        <span style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.3, color: '#1A1A1A' }}>{room.name}</span>
        <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>★ {room.rating.toFixed(1)}</span>
      </div>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>{room.neighborhood}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px' }}>
        <BoroughTag borough={room.borough} />
        <DifficultyBadge difficulty={room.difficulty} />
        {room.immersive && (
          <span style={{ fontSize: '11px', background: '#F3E8FF', color: '#7C3AED', fontWeight: 500, padding: '2px 7px', borderRadius: '9999px' }}>🎭</span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: '#555' }}>${room.pricePerPerson}/pp</span>
      </div>
      {room.themes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
          {room.themes.map(t => (
            <span key={t} style={{ fontSize: '10px', background: '#F5F5F5', color: '#888', padding: '2px 6px', borderRadius: '4px' }}>{t}</span>
          ))}
        </div>
      )}
    </button>
  )
}
