'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, type Session, type Recovery, type IntelLog, type AthleteProfile } from '@/lib/supabase'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'
import { format, subDays, differenceInDays, parseISO, addDays } from 'date-fns'

// ─── Constants ────────────────────────────────────────────────
const SESSION_COLORS: Record<string, string> = {
  Run: '#00ff88', Strength: '#ff6b35', Bike: '#00d4ff',
  Swim: '#a855f7', Rest: '#1e2d3d', Other: '#fbbf24'
}
const ALERT_COLORS: Record<string, string> = {
  INFO: '#00d4ff', ADVISORY: '#fbbf24', WARNING: '#ff6b35', CRITICAL: '#ff3366'
}
const MODE_COLORS: Record<string, string> = {
  Normal: '#00d4ff', 'Locked-In': '#00ff88', Recovery: '#fbbf24',
  Race: '#ff3366', Rebuild: '#a855f7'
}

// Race calendar — hardcoded for athlete
const RACES = [
  { name: 'HYROX', location: 'September 2025', date: '2025-09-15', type: 'hyrox', color: '#ff6b35', priority: 1 },
  { name: 'BERGMAN PUNE', location: 'Pune', date: '2025-07-20', type: 'obstacle', color: '#fbbf24', priority: 2 },
  { name: 'IRONMAN 70.3', location: 'Moveable Jul/Aug', date: '2025-08-10', type: 'triathlon', color: '#00d4ff', priority: 3 },
]

// Hyrox stations for readiness tracking
const HYROX_STATIONS = [
  { key: 'ski_erg', label: 'Ski Erg' },
  { key: 'sled_push', label: 'Sled Push' },
  { key: 'sled_pull', label: 'Sled Pull' },
  { key: 'burpee_broad', label: 'Burpee Broad Jump' },
  { key: 'rowing', label: 'Rowing' },
  { key: 'farmers_carry', label: 'Farmers Carry' },
  { key: 'sandbag_lunges', label: 'Sandbag Lunges' },
  { key: 'wall_balls', label: 'Wall Balls' },
  { key: 'running', label: '1km Runs' },
]

type Weather = { temp_c: number; humidity_pct: number; feels_like_c: number; condition: string }

function heatStress(feelsLike: number) {
  if (feelsLike >= 41) return { label: 'EXTREME', color: '#ff3366', paceAdj: '-15 sec/km' }
  if (feelsLike >= 35) return { label: 'HIGH', color: '#ff6b35', paceAdj: '-10 sec/km' }
  if (feelsLike >= 28) return { label: 'MODERATE', color: '#fbbf24', paceAdj: '-5 sec/km' }
  return { label: 'OPTIMAL', color: '#00ff88', paceAdj: 'No adjustment' }
}

function daysUntil(dateStr: string) {
  return differenceInDays(parseISO(dateStr), new Date())
}

function readinessColor(score: number | null) {
  if (!score) return '#2a3f55'
  if (score >= 67) return '#00ff88'
  if (score >= 34) return '#fbbf24'
  return '#ff3366'
}

// ─── Main ─────────────────────────────────────────────────────
export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [recovery, setRecovery] = useState<Recovery[]>([])
  const [profile, setProfile] = useState<AthleteProfile | null>(null)
  const [alerts, setAlerts] = useState<IntelLog[]>([])
  const [weather, setWeather] = useState<Weather | null>(null)
  const [activeTab, setActiveTab] = useState<'briefing' | 'training' | 'recovery' | 'hyrox' | 'intel'>('briefing')
  const [loading, setLoading] = useState(true)
  const [apiUrl, setApiUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  const fetchAll = useCallback(async () => {
    const monthAgo = subDays(new Date(), 30).toISOString().split('T')[0]
    const weekAgo = subDays(new Date(), 7).toISOString().split('T')[0]

    const [sRes, rRes, pRes, iRes, wRes] = await Promise.all([
      supabase.from('sessions').select('*').gte('date', monthAgo).order('date', { ascending: false }),
      supabase.from('recovery').select('*').gte('date', weekAgo).order('date', { ascending: false }),
      supabase.from('athlete_profile').select('*').eq('id', 1).single(),
      supabase.from('intel_log').select('*').eq('dismissed', false).order('timestamp', { ascending: false }).limit(20),
      supabase.from('weather_cache').select('*').eq('id', 1).single()
    ])
    setSessions(sRes.data || [])
    setRecovery(rRes.data || [])
    setProfile(pRes.data)
    setAlerts(iRes.data || [])
    setWeather(wRes.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    fetch('/api/weather').then(r => r.json()).then(d => { if (d.ok) setWeather(d.weather) })
    const interval = setInterval(fetchAll, 20000)
    return () => clearInterval(interval)
  }, [fetchAll])

  useEffect(() => {
    if (typeof window !== 'undefined') setApiUrl(`${window.location.origin}/api/eliteos`)
  }, [])

  // Real-time
  useEffect(() => {
    const ch = supabase.channel('eliteos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recovery' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'intel_log' }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchAll])

  const dismissAlert = async (id: string) => {
    await supabase.from('intel_log').update({ dismissed: true }).eq('id', id)
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  // ── Derived ─────────────────────────────────────────────────
  const todaySessions = sessions.filter(s => s.date === today)
  const upcoming = sessions.filter(s => s.date > today && s.status === 'planned').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
  const latestRec = recovery[0]
  const weekSessions = sessions.filter(s => s.date >= subDays(new Date(), 7).toISOString().split('T')[0])
  const totalKm7d = weekSessions.filter(s => s.distance_km).reduce((a, s) => a + (s.distance_km || 0), 0)
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL' || a.severity === 'WARNING')
  const heat = weather ? heatStress(weather.feels_like_c) : null

  const chartDays = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i)
    const ds = d.toISOString().split('T')[0]
    const daySessions = sessions.filter(s => s.date === ds)
    const dayRec = recovery.find(r => r.date === ds)
    return {
      date: format(d, 'EEE'),
      load: daySessions.reduce((a, s) => a + (s.duration_min || 0), 0),
      hrv: dayRec?.hrv_ms || null,
      readiness: dayRec?.readiness_score || null,
      sleep: dayRec?.sleep_hrs || null,
      strain: dayRec?.strain_score || null,
    }
  })

  // Phase detection
  const hyroxDays = daysUntil('2025-09-15')
  const bergmanDays = daysUntil('2025-07-20')
  const phase = hyroxDays <= 21 ? 'TAPER' : hyroxDays <= 42 ? 'PEAK' : hyroxDays <= 84 ? 'BUILD' : 'BASE'
  const phaseColor: Record<string, string> = { BASE: '#00d4ff', BUILD: '#fbbf24', PEAK: '#ff6b35', TAPER: '#ff3366' }

  if (loading) return (
    <div style={{ background: '#080c12', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Mono', monospace" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#00ff88', letterSpacing: '6px', fontSize: '13px', marginBottom: '10px' }}>ELITEOS</div>
        <div style={{ color: '#1a2535', fontSize: '8px', letterSpacing: '3px' }}>LOADING SYSTEMS</div>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '12px' }}>
          {[0,1,2].map(i => <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#00ff88', animation: `blink 1s ${i * 0.3}s infinite` }} />)}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: "'Space Mono', 'Courier New', monospace", background: '#080c12', color: '#c8d6e5', minHeight: '100vh' }}>

      {/* ── TOP BAR ── */}
      <header style={{ borderBottom: '1px solid #0f1e2e', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'rgba(8,12,18,0.98)', backdropFilter: 'blur(20px)', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 10px #00ff88', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#00ff88', fontWeight: 'bold', letterSpacing: '5px', fontSize: '11px' }}>ELITEOS</span>
          </div>
          <div style={{ width: '1px', height: '14px', background: '#0f1e2e' }} />
          {/* Phase badge */}
          <span style={{ fontSize: '8px', padding: '2px 8px', background: `${phaseColor[phase]}12`, border: `1px solid ${phaseColor[phase]}30`, color: phaseColor[phase], borderRadius: '2px', letterSpacing: '2px' }}>
            {phase} PHASE
          </span>
          {profile?.system_mode && (
            <span style={{ fontSize: '8px', padding: '2px 8px', background: `${MODE_COLORS[profile.system_mode]}10`, border: `1px solid ${MODE_COLORS[profile.system_mode]}25`, color: MODE_COLORS[profile.system_mode], borderRadius: '2px', letterSpacing: '2px' }}>
              {profile.system_mode.toUpperCase()}
            </span>
          )}
          {criticalAlerts.length > 0 && (
            <span style={{ fontSize: '8px', padding: '2px 8px', background: '#ff336612', border: '1px solid #ff336630', color: '#ff3366', borderRadius: '2px', letterSpacing: '1px', animation: 'pulse 2s infinite' }}>
              ⚡ {criticalAlerts.length} ALERT{criticalAlerts.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Weather strip */}
          {weather && heat && (
            <div style={{ display: 'flex', gap: '8px', fontSize: '9px', color: '#2a3f55', alignItems: 'center' }}>
              <span>{weather.temp_c}°C</span>
              <span style={{ color: '#0f1e2e' }}>·</span>
              <span>{weather.humidity_pct}%RH</span>
              <span style={{ color: '#0f1e2e' }}>·</span>
              <span style={{ color: heat.color, letterSpacing: '1px' }}>{heat.label}</span>
              <span style={{ color: '#0f1e2e' }}>·</span>
              <span style={{ color: '#4a6080' }}>{heat.paceAdj}</span>
            </div>
          )}
          <div style={{ width: '1px', height: '14px', background: '#0f1e2e' }} />
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {(['briefing', 'training', 'recovery', 'hyrox', 'intel'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: activeTab === tab ? 'rgba(0,255,136,0.07)' : 'transparent', border: activeTab === tab ? '1px solid rgba(0,255,136,0.2)' : '1px solid transparent', color: activeTab === tab ? '#00ff88' : '#2a3f55', padding: '4px 10px', fontSize: '8px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '2px', borderRadius: '2px', transition: 'all 0.15s' }}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── RACE COUNTDOWN STRIP ── */}
      <div style={{ borderBottom: '1px solid #0f1e2e', padding: '8px 20px', display: 'flex', gap: '24px', background: 'rgba(12,18,26,0.6)' }}>
        {RACES.map(race => {
          const days = daysUntil(race.date)
          const weeks = Math.floor(days / 7)
          return (
            <div key={race.name} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ width: '2px', height: '28px', background: race.color, borderRadius: '1px', opacity: 0.7 }} />
              <div>
                <div style={{ fontSize: '8px', color: race.color, letterSpacing: '2px', marginBottom: '1px' }}>{race.name}</div>
                <div style={{ fontSize: '9px', color: '#c8d6e5' }}>
                  {days > 0 ? <><span style={{ color: race.color, fontWeight: 'bold' }}>{weeks}w {days % 7}d</span> <span style={{ color: '#2a3f55' }}>out</span></> : <span style={{ color: '#ff3366' }}>RACE DAY</span>}
                </div>
                <div style={{ fontSize: '7px', color: '#2a3f55' }}>{race.location}</div>
              </div>
            </div>
          )
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {lastSync && <span style={{ fontSize: '8px', color: '#1a2535' }}>Last sync: {lastSync}</span>}
        </div>
      </div>

      <main style={{ padding: '16px 20px', maxWidth: '1500px', margin: '0 auto' }}>

        {/* ══ BRIEFING TAB ══ */}
        {activeTab === 'briefing' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>

            {/* Recovery */}
            <Card title="RECOVERY INTEGRITY">
              {latestRec ? (
                <>
                  {latestRec.alert_level && latestRec.alert_level !== 'INFO' && (
                    <div style={{ marginBottom: '10px', padding: '6px 10px', background: `${ALERT_COLORS[latestRec.alert_level]}10`, border: `1px solid ${ALERT_COLORS[latestRec.alert_level]}30`, borderRadius: '2px', fontSize: '9px', color: ALERT_COLORS[latestRec.alert_level], letterSpacing: '2px' }}>
                      ⚡ {latestRec.alert_level} — {latestRec.notes}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
                    {[
                      { label: 'HRV', val: latestRec.hrv_ms, unit: 'ms', color: '#00ff88' },
                      { label: 'SLEEP', val: latestRec.sleep_hrs, unit: 'hr', color: '#a855f7' },
                      { label: 'READY', val: latestRec.readiness_score, unit: '%', color: readinessColor(latestRec.readiness_score ?? null) },
                      { label: 'RHR', val: latestRec.rhr_bpm, unit: 'bpm', color: '#00d4ff' },
                      { label: 'STRAIN', val: latestRec.strain_score, unit: '', color: '#ff6b35' },
                      { label: 'RECOVERY', val: latestRec.recovery_score, unit: '%', color: '#fbbf24' },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'rgba(8,12,18,0.7)', padding: '8px', borderRadius: '2px', textAlign: 'center' }}>
                        <div style={{ fontSize: '7px', color: '#2a3f55', letterSpacing: '1px', marginBottom: '3px' }}>{m.label}</div>
                        <div style={{ fontSize: '17px', color: m.val ? m.color : '#1a2535', fontWeight: 'bold', lineHeight: 1 }}>{m.val ?? '—'}</div>
                        {m.val && m.unit && <div style={{ fontSize: '7px', color: '#2a3f55', marginTop: '1px' }}>{m.unit}</div>}
                      </div>
                    ))}
                  </div>
                  {(latestRec.adjustments || []).map((adj, i) => (
                    <div key={i} style={{ fontSize: '9px', color: '#a0b4c8', padding: '4px 0', borderBottom: '1px solid #0a1520', display: 'flex', gap: '6px', lineHeight: 1.5 }}>
                      <span style={{ color: '#00d4ff', flexShrink: 0 }}>›</span>{adj}
                    </div>
                  ))}
                  <div style={{ fontSize: '8px', color: '#1a2535', marginTop: '6px' }}>{latestRec.date}</div>
                </>
              ) : (
                <EmptyHint>Sync WHOOP or tell Claude your recovery stats to populate.</EmptyHint>
              )}
            </Card>

            {/* Today */}
            <Card title={`TODAY — ${format(new Date(), 'EEE MMM d')}`}>
              {todaySessions.length === 0 ? (
                <EmptyHint>No sessions today. Log training by telling Claude what you completed.</EmptyHint>
              ) : (
                todaySessions.map((s, i) => <SessionRow key={i} s={s} />)
              )}
              {upcoming.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '7px', color: '#1a2535', letterSpacing: '3px', marginBottom: '8px' }}>QUEUED</div>
                  {upcoming.slice(0, 4).map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: SESSION_COLORS[s.type], marginTop: '4px', flexShrink: 0 }} />
                      <div>
                        <span style={{ fontSize: '9px', color: '#c8d6e5' }}>{s.title}</span>
                        <span style={{ fontSize: '8px', color: '#2a3f55' }}> {s.date.slice(5)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* System state */}
            <Card title="SYSTEM STATE">
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '7px', color: '#2a3f55', letterSpacing: '2px', marginBottom: '6px' }}>WEEKLY LOAD</div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <StatBox label="SESSIONS" val={weekSessions.length.toString()} />
                  <StatBox label="KM RUN" val={totalKm7d.toFixed(1)} />
                  <StatBox label="TYPES" val={Array.from(new Set(weekSessions.map(s => s.type))).length.toString()} />
                </div>
              </div>
              <div style={{ height: '65px', marginBottom: '10px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDays} barSize={10}>
                    <XAxis dataKey="date" tick={{ fontSize: 7, fill: '#1a2535' }} axisLine={false} tickLine={false} />
                    <Bar dataKey="load" fill="#00ff8825" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Mumbai conditions */}
              {weather && heat && (
                <div style={{ padding: '8px', background: 'rgba(8,12,18,0.6)', borderRadius: '2px', border: `1px solid ${heat.color}15` }}>
                  <div style={{ fontSize: '7px', color: '#2a3f55', letterSpacing: '2px', marginBottom: '4px' }}>MUMBAI NOW</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '18px', color: '#c8d6e5', fontWeight: 'bold' }}>{weather.temp_c}°</span>
                      <span style={{ fontSize: '9px', color: '#4a6080' }}> · {weather.humidity_pct}%RH</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '8px', color: heat.color, letterSpacing: '1px' }}>{heat.label}</div>
                      <div style={{ fontSize: '8px', color: '#4a6080' }}>{heat.paceAdj}</div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* HRV chart */}
            <Card title="HRV — 7D TREND">
              <MiniChart data={chartDays} dataKey="hrv" color="#00ff88" />
            </Card>

            {/* Sleep chart */}
            <Card title="SLEEP — 7D">
              <MiniChart data={chartDays} dataKey="sleep" color="#a855f7" />
            </Card>

            {/* Active alerts */}
            <Card title="ACTIVE INTELLIGENCE">
              {alerts.length === 0 ? (
                <EmptyHint>No active alerts. System monitoring patterns.</EmptyHint>
              ) : alerts.slice(0, 4).map(alert => (
                <div key={alert.id} style={{ display: 'flex', gap: '8px', padding: '7px 0', borderBottom: '1px solid #0a1520' }}>
                  <div style={{ width: '2px', background: ALERT_COLORS[alert.severity || 'INFO'], borderRadius: '1px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '8px', color: ALERT_COLORS[alert.severity || 'INFO'], letterSpacing: '1px', marginBottom: '1px' }}>{alert.severity}</div>
                    <div style={{ fontSize: '9px', color: '#c8d6e5' }}>{alert.title}</div>
                    {alert.body && <div style={{ fontSize: '8px', color: '#4a6080', marginTop: '1px' }}>{alert.body}</div>}
                  </div>
                  <button onClick={() => alert.id && dismissAlert(alert.id)} style={{ background: 'none', border: 'none', color: '#1a2535', cursor: 'pointer', fontSize: '11px', padding: '0', alignSelf: 'flex-start' }}>×</button>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ══ TRAINING TAB ══ */}
        {activeTab === 'training' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
            <Card title="SESSION LOG — LAST 30 DAYS">
              {sessions.length === 0 ? <EmptyHint>No sessions. Log your training by telling Claude.</EmptyHint>
                : sessions.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', padding: '9px 0', borderBottom: '1px solid #0a1520' }}>
                    <div style={{ width: '2px', alignSelf: 'stretch', background: SESSION_COLORS[s.type], borderRadius: '1px', flexShrink: 0, opacity: 0.8 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <span style={{ fontSize: '7px', color: SESSION_COLORS[s.type], letterSpacing: '1px', marginRight: '6px' }}>{s.type}</span>
                          <span style={{ fontSize: '10px', color: '#c8d6e5' }}>{s.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '7px', padding: '1px 5px', background: s.status === 'completed' ? '#00ff8808' : '#fbbf2408', color: s.status === 'completed' ? '#00ff8880' : '#fbbf2480', borderRadius: '1px' }}>{s.status}</span>
                          <span style={{ fontSize: '8px', color: '#2a3f55' }}>{s.date}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '8px', color: '#4a6080', marginTop: '2px', display: 'flex', gap: '10px' }}>
                        {s.duration_min && <span>{s.duration_min}min</span>}
                        {s.distance_km && <span>{s.distance_km}km</span>}
                        {s.rpe && <span>RPE {s.rpe}</span>}
                        {s.source && <span style={{ color: '#1a2535' }}>via {s.source}</span>}
                      </div>
                      {s.notes && <div style={{ fontSize: '8px', color: '#2a3f55', marginTop: '2px', fontStyle: 'italic' }}>{s.notes}</div>}
                    </div>
                  </div>
                ))}
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Card title="TYPE BREAKDOWN">
                {['Run', 'Strength', 'Bike', 'Swim', 'Other'].map(type => {
                  const count = sessions.filter(s => s.type === type).length
                  const pct = sessions.length ? (count / sessions.length) * 100 : 0
                  return (
                    <div key={type} style={{ marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', marginBottom: '3px' }}>
                        <span style={{ color: SESSION_COLORS[type] }}>{type}</span>
                        <span style={{ color: '#2a3f55' }}>{count} sessions</span>
                      </div>
                      <div style={{ height: '3px', background: '#0a1520', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: SESSION_COLORS[type], borderRadius: '2px', transition: 'width 0.6s ease', opacity: 0.8 }} />
                      </div>
                    </div>
                  )
                })}
              </Card>

              <Card title="HYROX PREP — PHASE">
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ fontSize: '28px', color: phaseColor[phase], fontWeight: 'bold', letterSpacing: '2px' }}>{phase}</div>
                  <div style={{ fontSize: '8px', color: '#2a3f55', marginTop: '4px', letterSpacing: '2px' }}>CURRENT PHASE</div>
                  <div style={{ fontSize: '9px', color: '#4a6080', marginTop: '8px' }}>
                    {phase === 'BASE' && 'Foundation. Aerobic base + movement quality. Low specificity.'}
                    {phase === 'BUILD' && 'Specific Hyrox conditioning. Station work begins. Load increases.'}
                    {phase === 'PEAK' && 'Full simulation weeks. Max intensity. Precision over volume.'}
                    {phase === 'TAPER' && 'Load reduction. Sharpen speed. Protect the adaptation.'}
                  </div>
                </div>
              </Card>

              <Card title="LOAD CHART — 7D">
                <MiniChart data={chartDays} dataKey="load" color="#ff6b35" unit="min" />
              </Card>
            </div>
          </div>
        )}

        {/* ══ RECOVERY TAB ══ */}
        {activeTab === 'recovery' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
            <Card title="RECOVERY LOG">
              {recovery.length === 0 ? <EmptyHint>No data. Sync WHOOP via Claude: "EliteOS sync WHOOP"</EmptyHint>
                : recovery.map((r, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #0a1520' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '9px', color: '#c8d6e5' }}>{r.date}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {r.source && <span style={{ fontSize: '7px', color: '#1a2535', letterSpacing: '1px' }}>via {r.source}</span>}
                        {r.alert_level && r.alert_level !== 'INFO' && (
                          <span style={{ fontSize: '7px', color: ALERT_COLORS[r.alert_level], letterSpacing: '1px' }}>⚡ {r.alert_level}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      {r.hrv_ms && <MicroStat label="HRV" val={`${r.hrv_ms}ms`} />}
                      {r.sleep_hrs && <MicroStat label="SLEEP" val={`${r.sleep_hrs}hr`} />}
                      {r.readiness_score && <MicroStat label="READY" val={`${r.readiness_score}%`} color={readinessColor(r.readiness_score)} />}
                      {r.rhr_bpm && <MicroStat label="RHR" val={`${r.rhr_bpm}bpm`} />}
                      {r.recovery_score && <MicroStat label="RECOVERY" val={`${r.recovery_score}%`} color={readinessColor(r.recovery_score)} />}
                      {r.strain_score && <MicroStat label="STRAIN" val={`${r.strain_score}`} />}
                    </div>
                    {(r.adjustments || []).map((adj, j) => (
                      <div key={j} style={{ fontSize: '8px', color: '#4a6080', display: 'flex', gap: '5px', paddingTop: '2px' }}>
                        <span style={{ color: '#00d4ff' }}>›</span>{adj}
                      </div>
                    ))}
                  </div>
                ))}
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Card title="READINESS TREND">
                <MiniChart data={chartDays} dataKey="readiness" color="#00d4ff" domain={[0, 100]} />
              </Card>
              <Card title="SLEEP QUALITY">
                <MiniChart data={chartDays} dataKey="sleep" color="#a855f7" domain={[0, 10]} />
              </Card>
              <Card title="WHOOP + GARMIN">
                <div style={{ fontSize: '9px', color: '#4a6080', lineHeight: 1.9 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00ff88' }} />
                    <span style={{ color: '#00ff88' }}>Connected via Claude MCP</span>
                  </div>
                  <div style={{ color: '#2a3f55', marginBottom: '4px', fontSize: '8px', letterSpacing: '1px' }}>SYNC COMMANDS</div>
                  {[
                    '"EliteOS sync WHOOP"',
                    '"EliteOS pull Garmin today"',
                    '"EliteOS morning briefing"',
                  ].map(cmd => (
                    <div key={cmd} style={{ padding: '5px 8px', background: 'rgba(8,12,18,0.7)', borderRadius: '2px', marginBottom: '4px', color: '#a0b4c8', fontStyle: 'italic', fontSize: '9px', border: '1px solid #0f1e2e' }}>{cmd}</div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ══ HYROX TAB ══ */}
        {activeTab === 'hyrox' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>

            {/* Countdown */}
            <Card title="RACE CALENDAR">
              {RACES.map(race => {
                const days = daysUntil(race.date)
                const weeks = Math.floor(days / 7)
                const pct = Math.max(0, Math.min(100, 100 - (days / 180 * 100)))
                return (
                  <div key={race.name} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontSize: '9px', color: race.color, letterSpacing: '2px' }}>{race.name}</span>
                      <span style={{ fontSize: '8px', color: '#4a6080' }}>{days > 0 ? `${weeks}w ${days % 7}d` : 'RACE'}</span>
                    </div>
                    <div style={{ fontSize: '8px', color: '#2a3f55', marginBottom: '4px' }}>{race.location}</div>
                    <div style={{ height: '3px', background: '#0a1520', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: race.color, borderRadius: '2px', opacity: 0.7 }} />
                    </div>
                  </div>
                )
              })}
              <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(8,12,18,0.6)', borderRadius: '2px', border: '1px solid #0f1e2e' }}>
                <div style={{ fontSize: '7px', color: '#2a3f55', letterSpacing: '2px', marginBottom: '4px' }}>AFTER HYROX</div>
                <div style={{ fontSize: '9px', color: '#4a6080', lineHeight: 1.6 }}>
                  Bodybuilding phase planned. Aesthetic focus. Strength maintenance. Low cardio volume.
                </div>
              </div>
            </Card>

            {/* Hyrox stations */}
            <Card title="HYROX STATIONS — PREP STATUS">
              <div style={{ fontSize: '8px', color: '#2a3f55', marginBottom: '10px' }}>
                Tell Claude after Hyrox-specific sessions to track station readiness.
              </div>
              {HYROX_STATIONS.map(station => {
                const stationSessions = sessions.filter(s =>
                  s.notes?.toLowerCase().includes(station.key.replace('_', ' ')) ||
                  s.title?.toLowerCase().includes(station.key.replace('_', ' ')) ||
                  s.title?.toLowerCase().includes(station.label.toLowerCase())
                ).length
                const readiness = Math.min(100, stationSessions * 12 + (stationSessions > 0 ? 20 : 0))
                return (
                  <div key={station.key} style={{ marginBottom: '7px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', marginBottom: '3px' }}>
                      <span style={{ color: readiness > 50 ? '#c8d6e5' : '#4a6080' }}>{station.label}</span>
                      <span style={{ color: readiness > 66 ? '#00ff88' : readiness > 33 ? '#fbbf24' : '#ff3366' }}>{readiness}%</span>
                    </div>
                    <div style={{ height: '2px', background: '#0a1520', borderRadius: '1px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${readiness}%`, background: readiness > 66 ? '#00ff88' : readiness > 33 ? '#fbbf24' : '#ff3366', borderRadius: '1px', transition: 'width 0.5s', opacity: 0.8 }} />
                    </div>
                  </div>
                )
              })}
            </Card>

            {/* Training structure */}
            <Card title="HYROX TRAINING STRUCTURE">
              <div style={{ fontSize: '8px', color: '#2a3f55', lineHeight: 2 }}>
                {[
                  { label: 'FUNCTIONAL STRENGTH', desc: '2x/week — station-specific loading', color: '#ff6b35' },
                  { label: 'RUNNING', desc: '3x/week — Z2 base + tempo', color: '#00ff88' },
                  { label: 'HYROX SIMULATION', desc: '1x/week — full or partial race sim', color: '#fbbf24' },
                  { label: 'RECOVERY / Z1', desc: '1x/week — active, low HR', color: '#00d4ff' },
                ].map(item => (
                  <div key={item.label} style={{ marginBottom: '10px', padding: '8px', background: 'rgba(8,12,18,0.5)', borderRadius: '2px', borderLeft: `2px solid ${item.color}60` }}>
                    <div style={{ fontSize: '8px', color: item.color, letterSpacing: '1px', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ fontSize: '9px', color: '#4a6080' }}>{item.desc}</div>
                  </div>
                ))}
                <div style={{ fontSize: '8px', color: '#1a2535', marginTop: '4px' }}>
                  Heat adaptation: all outdoor runs to preserve Hyrox conditioning in humid conditions.
                </div>
              </div>
            </Card>

            {/* Phase roadmap */}
            <div style={{ gridColumn: '1 / -1' }}>
              <Card title="MULTI-RACE ROADMAP — 2025">
                <div style={{ display: 'flex', gap: '0', position: 'relative', padding: '20px 0 8px' }}>
                  {/* Timeline line */}
                  <div style={{ position: 'absolute', top: '32px', left: '0', right: '0', height: '1px', background: '#0f1e2e' }} />
                  {[
                    { label: 'NOW', sublabel: 'May 2025', phase: phase, color: phaseColor[phase], pos: 0 },
                    { label: 'BERGMAN', sublabel: 'Jul 2025', phase: 'PEAK', color: '#fbbf24', pos: 28 },
                    { label: '70.3', sublabel: 'Aug 2025', phase: 'RACE', color: '#00d4ff', pos: 50 },
                    { label: 'HYROX', sublabel: 'Sep 2025', phase: 'TARGET', color: '#ff6b35', pos: 72 },
                    { label: 'PHYSIQUE', sublabel: 'Oct+ 2025', phase: 'BUILD', color: '#a855f7', pos: 100 },
                  ].map((item, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, margin: '0 auto', position: 'relative', zIndex: 1, boxShadow: `0 0 8px ${item.color}60` }} />
                      <div style={{ fontSize: '8px', color: item.color, letterSpacing: '1px', marginTop: '8px', fontWeight: 'bold' }}>{item.label}</div>
                      <div style={{ fontSize: '7px', color: '#2a3f55', marginTop: '2px' }}>{item.sublabel}</div>
                      <div style={{ fontSize: '7px', color: '#1a2535', marginTop: '2px' }}>{item.phase}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ══ INTEL TAB ══ */}
        {activeTab === 'intel' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
            <Card title="INTELLIGENCE LOG">
              {alerts.length === 0 ? <EmptyHint>No active intelligence. System monitoring.</EmptyHint>
                : alerts.map(alert => (
                  <div key={alert.id} style={{ padding: '10px', background: 'rgba(8,12,18,0.5)', borderRadius: '2px', marginBottom: '6px', border: `1px solid ${ALERT_COLORS[alert.severity || 'INFO']}15`, display: 'flex', gap: '10px' }}>
                    <div style={{ width: '2px', background: ALERT_COLORS[alert.severity || 'INFO'], borderRadius: '1px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontSize: '7px', padding: '1px 5px', background: `${ALERT_COLORS[alert.severity || 'INFO']}12`, color: ALERT_COLORS[alert.severity || 'INFO'], borderRadius: '1px', letterSpacing: '1px' }}>{alert.severity}</span>
                        <span style={{ fontSize: '7px', color: '#1a2535', letterSpacing: '1px' }}>{alert.category}</span>
                        <span style={{ fontSize: '7px', color: '#1a2535' }}>{alert.timestamp ? format(new Date(alert.timestamp), 'MMM d HH:mm') : ''}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#c8d6e5' }}>{alert.title}</div>
                      {alert.body && <div style={{ fontSize: '8px', color: '#4a6080', marginTop: '2px', lineHeight: 1.5 }}>{alert.body}</div>}
                    </div>
                    <button onClick={() => alert.id && dismissAlert(alert.id)} style={{ background: 'none', border: '1px solid #0f1e2e', color: '#1a2535', cursor: 'pointer', fontSize: '9px', padding: '3px 7px', borderRadius: '2px', letterSpacing: '1px', alignSelf: 'flex-start', flexShrink: 0 }}>×</button>
                  </div>
                ))}
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Card title="CLAUDE API BRIDGE">
                <div style={{ fontSize: '9px', color: '#4a6080', lineHeight: 1.9 }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00ff88' }} />
                    <span style={{ color: '#00ff88', fontSize: '9px' }}>API READY</span>
                  </div>
                  <div style={{ background: 'rgba(8,12,18,0.8)', padding: '8px', borderRadius: '2px', border: '1px solid #0f1e2e', wordBreak: 'break-all', fontSize: '8px', color: '#c8d6e5', marginBottom: '8px' }}>
                    {apiUrl || 'Deploy to get URL'}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(apiUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }} style={{ width: '100%', background: copied ? 'rgba(0,255,136,0.08)' : 'transparent', border: `1px solid ${copied ? '#00ff8830' : '#0f1e2e'}`, color: copied ? '#00ff88' : '#2a3f55', padding: '5px', fontSize: '8px', cursor: 'pointer', letterSpacing: '2px', borderRadius: '2px', transition: 'all 0.2s' }}>
                    {copied ? '✓ COPIED' : 'COPY URL'}
                  </button>
                </div>
              </Card>

              <Card title="QUICK COMMANDS">
                <div style={{ fontSize: '8px', color: '#4a6080', lineHeight: 1.9 }}>
                  {[
                    ['Briefing', '"EliteOS morning briefing"'],
                    ['Sync WHOOP', '"EliteOS sync WHOOP"'],
                    ['Sync Garmin', '"EliteOS pull Garmin today"'],
                    ['Log session', '"14km easy 75min RPE 5"'],
                    ['Hyrox plan', '"Plan this week for Hyrox"'],
                    ['Race intel', '"Bergman race strategy"'],
                  ].map(([label, cmd]) => (
                    <div key={label} style={{ marginBottom: '5px' }}>
                      <div style={{ fontSize: '7px', color: '#1a2535', letterSpacing: '1px' }}>{label}</div>
                      <div style={{ color: '#a0b4c8', fontStyle: 'italic' }}>{cmd}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: #080c12; }
        ::-webkit-scrollbar-thumb { background: #0f1e2e; border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes blink { 0%,100%{opacity:0.15} 50%{opacity:1} }
      `}</style>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(14,22,34,0.7)', border: '1px solid #0f1e2e', borderRadius: '3px', padding: '14px' }}>
      <div style={{ fontSize: '7px', letterSpacing: '3px', color: '#1a2535', marginBottom: '12px', textTransform: 'uppercase' }}>{title}</div>
      {children}
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '9px', color: '#1a2535', lineHeight: 1.7, fontStyle: 'italic' }}>{children}</div>
}

function SessionRow({ s }: { s: Session }) {
  return (
    <div style={{ borderLeft: `2px solid ${SESSION_COLORS[s.type] || '#2a3f55'}60`, paddingLeft: '9px', marginBottom: '9px' }}>
      <div style={{ fontSize: '7px', color: SESSION_COLORS[s.type], letterSpacing: '1px', opacity: 0.8 }}>{s.type}</div>
      <div style={{ fontSize: '10px', color: '#c8d6e5' }}>{s.title}</div>
      <div style={{ fontSize: '8px', color: '#4a6080' }}>
        {[s.duration_min && `${s.duration_min}min`, s.distance_km && `${s.distance_km}km`, s.rpe && `RPE ${s.rpe}`].filter(Boolean).join(' · ')}
      </div>
    </div>
  )
}

function StatBox({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ background: 'rgba(8,12,18,0.6)', padding: '6px 10px', borderRadius: '2px', textAlign: 'center' }}>
      <div style={{ fontSize: '7px', color: '#2a3f55', letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontSize: '16px', color: '#c8d6e5', fontWeight: 'bold', lineHeight: 1.2 }}>{val}</div>
    </div>
  )
}

function MicroStat({ label, val, color = '#c8d6e5' }: { label: string; val: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '7px', color: '#1a2535', letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontSize: '11px', color, fontWeight: 'bold' }}>{val}</div>
    </div>
  )
}

function MiniChart({ data, dataKey, color, domain, unit }: { data: any[]; dataKey: string; color: string; domain?: [number, number]; unit?: string }) {
  return (
    <div style={{ height: '80px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 7, fill: '#1a2535' }} axisLine={false} tickLine={false} />
          {domain ? <YAxis hide domain={domain} /> : <YAxis hide domain={['auto', 'auto']} />}
          <Tooltip contentStyle={{ background: '#0a1520', border: '1px solid #0f1e2e', borderRadius: '2px', fontSize: '9px', fontFamily: 'Space Mono, monospace' }} />
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#g-${dataKey})`} connectNulls dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
