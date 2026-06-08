import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Config ─────────────────────────────────────────────────────────────────────
const CORS_PROXY = 'https://api.allorigins.win/raw?url='
const TMDB_BASE = 'https://api.themoviedb.org/3'
const CLAUDE_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const SESSION_SIZE = 10
const MAX_LIVES = 3
const QUESTION_TIME = 10
const XP_CORRECT = 10
const XP_FAST = 5
const FAST_THRESHOLD = 3 // seconds

// ── Fallback classic films ─────────────────────────────────────────────────────
const CLASSICS = [
  { title: 'Citizen Kane', year: 1941, director: 'Orson Welles', dp: 'Gregg Toland', cast: ['Orson Welles', 'Joseph Cotten', 'Dorothy Comingore', 'Agnes Moorehead', 'Ruth Warrick'], genres: ['Drama', 'Mystery'], country: 'USA', runtime: 119, tagline: "It's terrific!" },
  { title: 'Vertigo', year: 1958, director: 'Alfred Hitchcock', dp: 'Robert Burks', cast: ['James Stewart', 'Kim Novak', 'Barbara Bel Geddes', 'Tom Helmore', 'Henry Jones'], genres: ['Mystery', 'Thriller', 'Romance'], country: 'USA', runtime: 128, tagline: 'Only Hitchcock could have made it!' },
  { title: '2001: A Space Odyssey', year: 1968, director: 'Stanley Kubrick', dp: 'Geoffrey Unsworth', cast: ['Keir Dullea', 'Gary Lockwood', 'William Sylvester', 'Douglas Rain', 'Leonard Rossiter'], genres: ['Science Fiction'], country: 'USA/UK', runtime: 149, tagline: 'The Ultimate Trip' },
  { title: 'The Godfather', year: 1972, director: 'Francis Ford Coppola', dp: 'Gordon Willis', cast: ['Marlon Brando', 'Al Pacino', 'James Caan', 'Robert Duvall', 'Diane Keaton'], genres: ['Crime', 'Drama'], country: 'USA', runtime: 175, tagline: "An offer you can't refuse." },
  { title: 'Chinatown', year: 1974, director: 'Roman Polanski', dp: 'John A. Alonzo', cast: ['Jack Nicholson', 'Faye Dunaway', 'John Huston', 'Diane Ladd', 'Darrell Zwerling'], genres: ['Crime', 'Mystery', 'Thriller'], country: 'USA', runtime: 130, tagline: "Forget it Jake, it's Chinatown." },
  { title: 'Apocalypse Now', year: 1979, director: 'Francis Ford Coppola', dp: 'Vittorio Storaro', cast: ['Martin Sheen', 'Marlon Brando', 'Robert Duvall', 'Frederic Forrest', 'Dennis Hopper'], genres: ['Drama', 'War'], country: 'USA', runtime: 153, tagline: 'The Horror' },
  { title: 'Blade Runner', year: 1982, director: 'Ridley Scott', dp: 'Jordan Cronenweth', cast: ['Harrison Ford', 'Rutger Hauer', 'Sean Young', 'Edward James Olmos', 'Daryl Hannah'], genres: ['Science Fiction', 'Thriller'], country: 'USA', runtime: 117, tagline: "Man has made his match... now it's his problem." },
  { title: 'Do the Right Thing', year: 1989, director: 'Spike Lee', dp: 'Ernest Dickerson', cast: ['Danny Aiello', 'Ossie Davis', 'Ruby Dee', 'Richard Edson', 'Giancarlo Esposito'], genres: ['Drama'], country: 'USA', runtime: 120, tagline: "It's the hottest day of the summer." },
  { title: "Schindler's List", year: 1993, director: 'Steven Spielberg', dp: 'Janusz Kamiński', cast: ['Liam Neeson', 'Ben Kingsley', 'Ralph Fiennes', 'Caroline Goodall', 'Jonathan Sagall'], genres: ['Drama', 'History', 'War'], country: 'USA', runtime: 195, tagline: 'Whoever saves one life, saves the world entire.' },
  { title: 'Parasite', year: 2019, director: 'Bong Joon-ho', dp: 'Hong Kyung-pyo', cast: ['Song Kang-ho', 'Lee Sun-kyun', 'Cho Yeo-jeong', 'Choi Woo-shik', 'Park So-dam'], genres: ['Thriller', 'Comedy', 'Drama'], country: 'South Korea', runtime: 132, tagline: 'Act like you own the place.' },
]

// ── localStorage helpers ───────────────────────────────────────────────────────
function ls(key, fallback = null) {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback } catch { return fallback }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── API layer ──────────────────────────────────────────────────────────────────
async function fetchLetterboxdFilms(username) {
  const url = `https://letterboxd.com/${encodeURIComponent(username)}/rss/`
  const res = await fetch(CORS_PROXY + encodeURIComponent(url))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'text/xml')
  if (xml.querySelector('parsererror')) throw new Error('Invalid RSS feed')
  const items = [...xml.querySelectorAll('item')]
  const films = []
  for (const item of items) {
    const raw = item.querySelector('title')?.textContent?.trim() || ''
    const match = raw.match(/^(.+?)\s*\((\d{4})\)\s*$/)
    if (match) films.push({ title: match[1].trim(), year: parseInt(match[2]) })
  }
  return films
}

async function fetchTMDBFilm(title, year, apiKey) {
  const cacheKey = `cineaste_tmdb_${title}_${year}`
  const cached = ls(cacheKey)
  if (cached) return cached

  try {
    const sRes = await fetch(`${TMDB_BASE}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}&year=${year}&language=en-US`)
    if (!sRes.ok) return null
    const sData = await sRes.json()
    const id = sData.results?.[0]?.id
    if (!id) return null

    const dRes = await fetch(`${TMDB_BASE}/movie/${id}?api_key=${apiKey}&append_to_response=credits&language=en-US`)
    if (!dRes.ok) return null
    const d = await dRes.json()

    const result = {
      title: d.title || title,
      year: parseInt(d.release_date?.split('-')[0]) || year,
      posterPath: d.poster_path || null,
      director: d.credits?.crew?.find(c => c.job === 'Director')?.name || null,
      dp: d.credits?.crew?.find(c => c.job === 'Director of Photography')?.name || null,
      cast: d.credits?.cast?.slice(0, 5).map(c => c.name) || [],
      genres: d.genres?.map(g => g.name) || [],
      country: d.production_countries?.[0]?.name || null,
      runtime: d.runtime || null,
      tagline: d.tagline || null,
      overview: d.overview || null,
      collection: d.belongs_to_collection?.name || null,
    }
    lsSet(cacheKey, result)
    return result
  } catch {
    return null
  }
}

async function generateQuestions(films, claudeKey) {
  const cacheKey = `cineaste_qs_${films.map(f => `${f.title}${f.year}`).join('|')}`
  const cached = ls(cacheKey)
  if (cached) return cached

  const filmList = films.map(f => ({
    title: f.title,
    year: f.year,
    director: f.director || null,
    dp: f.dp || null,
    cast: f.cast || [],
    genres: f.genres || [],
    country: f.country || null,
    runtime: f.runtime || null,
    tagline: f.tagline || null,
    collection: f.collection || null,
  }))

  const prompt = `You are the question engine for "Cineaste", a Duolingo-style film literacy game.

Given ${filmList.length} films from a user's Letterboxd watch history, generate quiz questions.

Films:
${JSON.stringify(filmList, null, 2)}

Generate ${Math.min(filmList.length * 3, 30)} questions total, mixing 5 types:

WHO_DIRECTED — "Who directed [Film]?" · 3 wrong answers: plausible directors from same era/genre/nationality
YEAR_RELEASED — "When was [Film] released?" · 3 wrong answers: years within ±4 years
ACTOR_MATCH — "Which actor appeared in [Film]?" · 1 real cast member + 3 plausible but wrong actors (same genre/era)
FILM_FROM_CLUE — cryptic 2-sentence description hinting at the film without naming it · wrong options MUST be other films from THIS list (use exact titles)
CONNECT_THE_DOTS — "What do [Film A] and [Film B] have in common?" using two films from THIS list · answer is a real shared connection (same director / actor / cinematographer / country / studio) · 3 wrong connections

Rules:
- Wrong distractors must be plausible and educational, not obviously wrong
- funFact must be a specific, surprising, non-obvious detail (not a plot summary)
- Prioritize FILM_FROM_CLUE and CONNECT_THE_DOTS — they teach the most
- Vary correctIndex across all 4 positions (0,1,2,3)

Return ONLY a valid JSON array (no markdown fences, no extra text):
[
  {
    "filmTitle": "exact film title from the list",
    "type": "WHO_DIRECTED",
    "question": "full question string",
    "options": ["option A", "option B", "option C", "option D"],
    "correctIndex": 0,
    "funFact": "One fascinating, specific fact."
  }
]`

  const res = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Claude API error ${res.status}`)
  }

  const data = await res.json()
  let text = data.content?.[0]?.text?.trim() || ''
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const questions = JSON.parse(text)
  lsSet(cacheKey, questions)
  return questions
}

// ── Shared visual atoms ────────────────────────────────────────────────────────
function FilmGrain() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 opacity-[0.025] mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '300px',
      }}
    />
  )
}

const SERIF = "'Playfair Display', Georgia, serif"

const TYPE_META = {
  WHO_DIRECTED:     { label: 'Director',     color: '#D4AF37' },
  YEAR_RELEASED:    { label: 'Release Year', color: '#60a5fa' },
  ACTOR_MATCH:      { label: 'Cast',         color: '#a78bfa' },
  FILM_FROM_CLUE:   { label: 'Mystery Film', color: '#34d399' },
  CONNECT_THE_DOTS: { label: 'Connection',   color: '#fb923c' },
}

function TypeBadge({ type }) {
  const m = TYPE_META[type] || { label: type, color: '#9ca3af' }
  return (
    <span
      className="text-[10px] font-bold tracking-[0.15em] uppercase px-2.5 py-1 rounded-md"
      style={{ color: m.color, background: m.color + '18', border: `1px solid ${m.color}35` }}
    >
      {m.label}
    </span>
  )
}

function HeartIcon({ filled }) {
  return (
    <motion.svg viewBox="0 0 20 18" className="w-5 h-5" initial={false}
      animate={{ scale: filled ? 1 : 0.75, opacity: filled ? 1 : 0.2 }}>
      <path
        d="M10 16.5S1 11 1 5.5A4.5 4.5 0 0 1 10 3.24 4.5 4.5 0 0 1 19 5.5C19 11 10 16.5 10 16.5z"
        fill={filled ? '#ef4444' : 'none'}
        stroke={filled ? '#ef4444' : '#6b7280'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </motion.svg>
  )
}

function LivesDisplay({ lives }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: MAX_LIVES }, (_, i) => (
        <HeartIcon key={i} filled={i < lives} />
      ))}
    </div>
  )
}

function TimerBar({ questionKey, onExpire }) {
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const expiredRef = useRef(false)
  const [pct, setPct] = useState(100)

  useEffect(() => {
    startRef.current = performance.now()
    expiredRef.current = false
    setPct(100)

    const tick = (now) => {
      const elapsed = (now - startRef.current) / 1000
      const remaining = Math.max(0, 1 - elapsed / QUESTION_TIME)
      setPct(remaining * 100)
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else if (!expiredRef.current) {
        expiredRef.current = true
        onExpire()
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [questionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const color = pct > 50 ? '#D4AF37' : pct > 25 ? '#f97316' : '#ef4444'
  return (
    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.05s linear' }} />
    </div>
  )
}

function AnswerButton({ option, index, state, onClick }) {
  const letter = ['A', 'B', 'C', 'D'][index]
  const isIdle = state === 'idle'

  const styles = {
    idle:    { border: 'rgba(255,255,255,0.1)',  bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.85)' },
    correct: { border: '#34d399',                bg: 'rgba(52,211,153,0.12)',  text: '#86efac' },
    wrong:   { border: '#ef4444',                bg: 'rgba(239,68,68,0.12)',   text: '#fca5a5' },
    missed:  { border: 'rgba(52,211,153,0.35)',  bg: 'rgba(52,211,153,0.06)', text: 'rgba(134,239,172,0.6)' },
  }
  const s = styles[state] || styles.idle

  return (
    <motion.button
      onClick={isIdle ? onClick : undefined}
      animate={state === 'wrong' ? { x: [0, -10, 10, -10, 10, -5, 5, 0] } : { x: 0 }}
      transition={state === 'wrong' ? { duration: 0.45 } : { duration: 0.1 }}
      whileHover={isIdle ? { scale: 1.01 } : {}}
      whileTap={isIdle ? { scale: 0.98 } : {}}
      className="w-full text-left px-4 py-3.5 rounded-2xl flex items-center gap-3"
      style={{
        border: `1.5px solid ${s.border}`,
        background: s.bg,
        color: s.text,
        cursor: isIdle ? 'pointer' : 'default',
      }}
    >
      <span className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold"
        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
        {letter}
      </span>
      <span className="text-sm leading-snug flex-1">{option}</span>
      <AnimatePresence>
        {state === 'correct' && (
          <motion.span key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-400">✓</motion.span>
        )}
        {state === 'missed' && (
          <motion.span key="m" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-500/50">✓</motion.span>
        )}
        {state === 'wrong' && (
          <motion.span key="w" initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-red-400">✗</motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ── Screens ────────────────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[10px] text-white/40 uppercase tracking-[0.15em] mb-2">{label}</label>
      {children}
      {hint && <p className="text-white/30 text-xs mt-1.5">{hint}</p>}
    </div>
  )
}

function OnboardingScreen({ onStart }) {
  const [username, setUsername] = useState(ls('cineaste_username') || '')
  const [tmdbKey, setTmdbKey] = useState(ls('cineaste_tmdb') || '')
  const [claudeKey, setClaudeKey] = useState(ls('cineaste_claude') || '')
  const [mode, setMode] = useState('normal')

  const streak = ls('cineaste_streak', 0)
  const totalXP = ls('cineaste_xp', 0)
  const sessions = ls('cineaste_sessions', 0)
  const hasHistory = streak > 0 || totalXP > 0 || sessions > 0

  function handleStart(e) {
    e.preventDefault()
    if (mode === 'normal') {
      lsSet('cineaste_username', username.trim())
      lsSet('cineaste_tmdb', tmdbKey.trim())
      lsSet('cineaste_claude', claudeKey.trim())
    }
    onStart({ username: username.trim(), tmdbKey: tmdbKey.trim(), claudeKey: claudeKey.trim(), mode })
  }

  const canStart = !!claudeKey.trim() && (mode === 'sample' || !!username.trim())

  const inputCls = "w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-amber-400/40 text-sm"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: '#0a0a0a' }}>
      <FilmGrain />

      <motion.div initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
        className="text-center mb-10">
        <div className="text-xs text-white/25 tracking-[0.3em] uppercase mb-5">A Film Literacy Game</div>
        <h1 style={{ fontFamily: SERIF, color: '#D4AF37', fontSize: '3.5rem', lineHeight: 1, letterSpacing: '-0.02em' }}>
          Cineaste
        </h1>
        <div className="mt-4 flex items-center justify-center gap-3">
          <div className="h-px w-12" style={{ background: 'linear-gradient(to right, transparent, #D4AF37)' }} />
          <span className="text-white/20 text-[10px] tracking-[0.3em] uppercase">Spaced Repetition</span>
          <div className="h-px w-12" style={{ background: 'linear-gradient(to left, transparent, #D4AF37)' }} />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
        className="w-full max-w-md">
        <div className="rounded-3xl border border-white/8 p-7" style={{ background: '#111111' }}>
          <p className="text-white/45 text-sm leading-relaxed mb-7">
            Turn your watch history into a personalized film curriculum.
            You watched it — now actually <em className="text-white/65 not-italic font-medium">know</em> it.
          </p>

          <div className="flex rounded-xl overflow-hidden mb-6 p-1 gap-1" style={{ background: '#0a0a0a' }}>
            {[['normal', 'My Letterboxd'], ['sample', 'Sample Mode']].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className="flex-1 py-2.5 text-xs font-semibold tracking-wide rounded-lg transition-all"
                style={{ background: mode === m ? '#D4AF37' : 'transparent', color: mode === m ? '#000' : 'rgba(255,255,255,0.35)' }}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleStart} className="space-y-4">
            {mode === 'normal' && (
              <>
                <Field label="Letterboxd Username">
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="yourusername" className={inputCls} autoComplete="off" />
                </Field>
                <Field label="TMDB API Key"
                  hint={<>Enriches film metadata (optional) — <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="text-amber-400/60 hover:text-amber-400">get free key</a></>}>
                  <input type="password" value={tmdbKey} onChange={e => setTmdbKey(e.target.value)}
                    placeholder="Your TMDB v3 API key" className={inputCls} />
                </Field>
              </>
            )}
            <Field label="Claude API Key"
              hint={<>Required for question generation — <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-amber-400/60 hover:text-amber-400">get key</a> · stays in your browser</>}>
              <input type="password" value={claudeKey} onChange={e => setClaudeKey(e.target.value)}
                placeholder="sk-ant-..." className={inputCls} />
            </Field>

            <motion.button type="submit" disabled={!canStart}
              whileHover={canStart ? { scale: 1.01 } : {}}
              whileTap={canStart ? { scale: 0.97 } : {}}
              className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide mt-1 transition-opacity"
              style={{ background: '#D4AF37', color: '#0a0a0a', opacity: canStart ? 1 : 0.3 }}>
              {mode === 'sample' ? '▶  Start Sample Quiz' : '▶  Load My Films'}
            </motion.button>
          </form>
        </div>
      </motion.div>

      {hasHistory && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-8 flex gap-10">
          {[
            { label: 'Day Streak', val: streak },
            { label: 'Total XP', val: totalXP.toLocaleString() },
            { label: 'Sessions', val: sessions },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div style={{ fontFamily: SERIF, color: '#D4AF37', fontSize: '1.75rem', fontWeight: 700 }}>{s.val}</div>
              <div className="text-white/25 text-[10px] uppercase tracking-widest mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

function LoadingScreen({ status, filmCount }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#0a0a0a' }}>
      <FilmGrain />
      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
        className="text-5xl mb-6">🎬</motion.div>
      <p className="text-white/55 text-sm text-center max-w-xs leading-relaxed">{status}</p>
      {filmCount > 0 && (
        <p className="text-white/25 text-xs mt-2">{filmCount} film{filmCount !== 1 ? 's' : ''} found</p>
      )}
      <div className="mt-8 flex gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: '#D4AF37' }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
        ))}
      </div>
    </div>
  )
}

function QuizScreen({ questions, onComplete }) {
  const [idx, setIdx] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [xp, setXp] = useState(0)
  const [selected, setSelected] = useState(null)
  const [phase, setPhase] = useState('question') // 'question' | 'feedback'
  const [answers, setAnswers] = useState([])
  const questionStartRef = useRef(performance.now())
  const answeredRef = useRef(false)

  const q = questions[idx]
  const isLast = idx + 1 >= questions.length

  useEffect(() => {
    answeredRef.current = false
    setSelected(null)
    setPhase('question')
    questionStartRef.current = performance.now()
  }, [idx])

  const handleAnswer = useCallback((optionIdx) => {
    if (answeredRef.current) return
    answeredRef.current = true

    const elapsed = (performance.now() - questionStartRef.current) / 1000
    const correct = optionIdx === q.correctIndex
    const fast = correct && elapsed < FAST_THRESHOLD

    let gained = 0
    let newLives = lives
    if (correct) {
      gained = XP_CORRECT + (fast ? XP_FAST : 0)
      setXp(prev => prev + gained)
    } else {
      newLives = lives - 1
      setLives(newLives)
    }

    setSelected(optionIdx)
    setAnswers(prev => [...prev, { correct, fast, gained, filmTitle: q.filmTitle }])
    setTimeout(() => setPhase('feedback'), 650)
  }, [q, lives])

  function handleTimeExpire() {
    if (!answeredRef.current) handleAnswer(-1)
  }

  function handleNext() {
    if (isLast || lives <= 0) {
      onComplete({ xp, answers, questionsAnswered: idx + 1 })
    } else {
      setIdx(i => i + 1)
    }
  }

  function getButtonState(i) {
    if (selected === null) return 'idle'
    if (i === q.correctIndex) return selected === i ? 'correct' : 'missed'
    if (i === selected) return 'wrong'
    return 'idle'
  }

  const progress = (idx / questions.length) * 100
  const lastAnswer = answers[answers.length - 1]
  const isDead = lives <= 0

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a' }}>
      <FilmGrain />

      {/* Top bar */}
      <div className="px-5 pt-6 pb-3 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <LivesDisplay lives={lives} />
          <motion.div key={xp} initial={{ scale: 1.3 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
            style={{ color: '#D4AF37', fontFamily: SERIF }} className="text-sm font-bold">
            {xp} <span className="text-white/25 font-normal text-xs">XP</span>
          </motion.div>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div className="h-full rounded-full" style={{ background: '#D4AF37' }}
            animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-white/20">{idx + 1} / {questions.length}</span>
          <span className="text-[10px] text-white/20">{questions.length - idx - 1} left</span>
        </div>
      </div>

      <div className="flex-1 px-5 pb-8 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          {phase === 'question' && (
            <motion.div key={`q-${idx}`}
              initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }} transition={{ duration: 0.22 }}
              className="space-y-5"
            >
              {selected === null && (
                <TimerBar questionKey={idx} onExpire={handleTimeExpire} />
              )}
              <div>
                <TypeBadge type={q.type} />
                <div className="text-white/25 text-xs mt-2.5 uppercase tracking-widest">{q.filmTitle}</div>
              </div>
              <h2 className="text-xl font-semibold text-white leading-snug" style={{ fontFamily: SERIF }}>
                {q.question}
              </h2>
              <div className="space-y-2.5">
                {q.options.map((opt, i) => (
                  <AnswerButton key={i} option={opt} index={i}
                    state={getButtonState(i)}
                    onClick={() => handleAnswer(i)} />
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'feedback' && (
            <motion.div key={`fb-${idx}`}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                className="text-center py-5">
                {lastAnswer?.correct ? (
                  <>
                    <div className="text-4xl mb-2">✓</div>
                    <p className="font-semibold text-base" style={{ color: '#34d399' }}>
                      Correct{lastAnswer.fast ? <span className="text-amber-400 ml-2">⚡ Fast!</span> : ''}
                    </p>
                    {lastAnswer.gained > 0 && (
                      <p className="text-white/30 text-sm mt-1">+{lastAnswer.gained} XP</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-4xl mb-2">✗</div>
                    <p className="font-semibold text-base text-red-400">Not quite</p>
                    <p className="text-white/40 text-sm mt-1">
                      Answer: <span className="text-white/65">{q.options[q.correctIndex]}</span>
                    </p>
                  </>
                )}
              </motion.div>

              <div className="rounded-2xl px-5 py-4"
                style={{ background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.18)' }}>
                <div className="text-[10px] text-amber-400/50 uppercase tracking-[0.2em] mb-2">Did you know</div>
                <p className="text-white/70 text-sm leading-relaxed">{q.funFact}</p>
              </div>

              <motion.button onClick={handleNext}
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-2xl font-bold text-sm"
                style={{ background: '#D4AF37', color: '#0a0a0a' }}>
                {isLast || isDead ? 'See Results' : 'Continue →'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function SessionSummaryScreen({ sessionData, onRestart, onMenu }) {
  const { xp, answers, questionsAnswered } = sessionData
  const correct = answers.filter(a => a.correct).length
  const accuracy = answers.length ? Math.round((correct / answers.length) * 100) : 0
  const fastBonuses = answers.filter(a => a.fast).length
  const filmsLearned = [...new Set(answers.filter(a => a.correct).map(a => a.filmTitle))].slice(0, 3)

  useEffect(() => {
    lsSet('cineaste_xp', (ls('cineaste_xp', 0)) + xp)
    lsSet('cineaste_sessions', (ls('cineaste_sessions', 0)) + 1)
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    const last = ls('cineaste_last')
    if (last !== today) {
      lsSet('cineaste_streak', last === yesterday ? (ls('cineaste_streak', 0)) + 1 : 1)
    }
    lsSet('cineaste_last', today)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const grade = accuracy >= 80 ? { emoji: '🎬', label: 'Cinephile' }
    : accuracy >= 60 ? { emoji: '🎭', label: 'Film Lover' }
    : { emoji: '📽️', label: 'Getting There' }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: '#0a0a0a' }}>
      <FilmGrain />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">

        <div className="text-center mb-8">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
            className="text-6xl mb-3">{grade.emoji}</motion.div>
          <h1 style={{ fontFamily: SERIF, color: '#fff', fontSize: '2rem', fontWeight: 700 }}>
            Session Complete
          </h1>
          <p className="text-white/35 text-sm mt-1">{grade.label}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'XP Earned',  val: `+${xp}`,        col: '#D4AF37' },
            { label: 'Accuracy',   val: `${accuracy}%`,  col: accuracy >= 70 ? '#34d399' : '#f97316' },
            { label: 'Streak',     val: `${ls('cineaste_streak', 1)}d`, col: '#60a5fa' },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
              className="text-center rounded-2xl border border-white/8 py-4 px-2"
              style={{ background: '#111' }}>
              <div style={{ fontFamily: SERIF, color: s.col, fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>{s.val}</div>
              <div className="text-white/30 text-[10px] uppercase tracking-widest mt-1.5">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {filmsLearned.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="rounded-2xl border border-white/8 p-5 mb-5" style={{ background: '#111' }}>
            <div className="text-[10px] text-white/25 uppercase tracking-[0.2em] mb-3">Today you learned</div>
            <div className="space-y-2">
              {filmsLearned.map(title => (
                <div key={title} className="flex items-center gap-2 text-sm text-white/65">
                  <span className="text-amber-400/50">▸</span>
                  <span style={{ fontFamily: SERIF }}>{title}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {fastBonuses > 0 && (
          <p className="text-center text-amber-400/50 text-xs mb-5">
            ⚡ {fastBonuses} fast answer bonus{fastBonuses !== 1 ? 'es' : ''}
          </p>
        )}

        <div className="space-y-3">
          <motion.button onClick={onRestart} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
            className="w-full py-4 rounded-2xl font-bold text-sm"
            style={{ background: '#D4AF37', color: '#0a0a0a' }}>
            Play Again
          </motion.button>
          <button onClick={onMenu}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold border border-white/10 text-white/40 hover:text-white/60 transition-colors"
            style={{ background: 'transparent' }}>
            ← Back to Menu
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function ErrorScreen({ message, onBack }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#0a0a0a' }}>
      <FilmGrain />
      <div className="w-full max-w-sm text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-red-400/75 text-sm leading-relaxed mb-6 max-w-xs mx-auto">{message}</p>
        <motion.button onClick={onBack} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}
          className="px-8 py-3.5 rounded-2xl font-bold text-sm"
          style={{ background: '#D4AF37', color: '#0a0a0a' }}>
          ← Go Back
        </motion.button>
      </div>
    </div>
  )
}

// ── Root App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState('onboarding')
  const [config, setConfig] = useState(null)
  const [loadStatus, setLoadStatus] = useState('')
  const [filmCount, setFilmCount] = useState(0)
  const [questions, setQuestions] = useState([])
  const [sessionData, setSessionData] = useState(null)
  const [error, setError] = useState(null)

  async function startGame(cfg) {
    setConfig(cfg)
    setPhase('loading')
    setError(null)
    setFilmCount(0)

    try {
      let films = []

      if (cfg.mode === 'sample') {
        films = CLASSICS
        setFilmCount(CLASSICS.length)
        setLoadStatus(`Loaded ${CLASSICS.length} classic films`)
        await new Promise(r => setTimeout(r, 600))
      } else {
        setLoadStatus('Fetching your Letterboxd films…')
        try {
          const raw = await fetchLetterboxdFilms(cfg.username)
          if (raw.length === 0) throw new Error('No films found — profile may be private or username incorrect')
          films = raw
          setFilmCount(raw.length)
          setLoadStatus(`Found ${raw.length} films on your Letterboxd`)
          await new Promise(r => setTimeout(r, 300))
        } catch (e) {
          setLoadStatus(`Letterboxd unavailable (${e.message}) — using 10 classic films instead`)
          films = CLASSICS
          setFilmCount(CLASSICS.length)
          await new Promise(r => setTimeout(r, 1800))
        }

        if (cfg.tmdbKey && films.length) {
          const batch = films.slice(0, 15)
          const enriched = []
          for (let i = 0; i < batch.length; i++) {
            setLoadStatus(`Enriching metadata… ${i + 1} / ${batch.length}`)
            const data = await fetchTMDBFilm(batch[i].title, batch[i].year, cfg.tmdbKey)
            enriched.push(data ? { ...batch[i], ...data } : batch[i])
          }
          films = [...enriched, ...films.slice(15)]
        }
      }

      if (!cfg.claudeKey) {
        throw new Error('A Claude API key is required to generate quiz questions. Please go back and add yours from console.anthropic.com.')
      }

      const batch = shuffle(films).slice(0, SESSION_SIZE)
      setLoadStatus('Generating personalized questions with Claude…')
      const generated = await generateQuestions(batch, cfg.claudeKey)

      if (!generated?.length) throw new Error('No questions were generated. Please try again.')

      setQuestions(shuffle(generated).slice(0, SESSION_SIZE))
      setPhase('playing')
    } catch (e) {
      setError(e.message)
      setPhase('error')
    }
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'onboarding' && (
        <motion.div key="ob" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <OnboardingScreen onStart={startGame} />
        </motion.div>
      )}
      {phase === 'loading' && (
        <motion.div key="ld" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <LoadingScreen status={loadStatus} filmCount={filmCount} />
        </motion.div>
      )}
      {phase === 'error' && (
        <motion.div key="er" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <ErrorScreen message={error} onBack={() => setPhase('onboarding')} />
        </motion.div>
      )}
      {phase === 'playing' && (
        <motion.div key="pl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <QuizScreen questions={questions} onComplete={data => { setSessionData(data); setPhase('summary') }} />
        </motion.div>
      )}
      {phase === 'summary' && (
        <motion.div key="su" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <SessionSummaryScreen
            sessionData={sessionData}
            onRestart={() => startGame(config)}
            onMenu={() => setPhase('onboarding')}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
