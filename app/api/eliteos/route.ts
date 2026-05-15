import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// ELITEOS API — The bridge between Claude and the webapp
// Claude calls these endpoints to read and write athlete data
// ============================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// CORS headers — allow claude.ai and any origin
function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return res
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }))
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'summary'

  try {
    let data: any = {}

    if (action === 'summary' || action === 'all') {
      // Full system state — what Claude reads every morning
      const today = new Date().toISOString().split('T')[0]
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0]

      const [sessionsRes, recoveryRes, profileRes, intelRes, weatherRes] = await Promise.all([
        supabase.from('sessions').select('*').gte('date', weekAgo).order('date', { ascending: false }),
        supabase.from('recovery').select('*').gte('date', weekAgo).order('date', { ascending: false }),
        supabase.from('athlete_profile').select('*').eq('id', 1).single(),
        supabase.from('intel_log').select('*').eq('dismissed', false).order('timestamp', { ascending: false }).limit(10),
        supabase.from('weather_cache').select('*').eq('id', 1).single()
      ])

      data = {
        date: today,
        profile: profileRes.data,
        sessions_7d: sessionsRes.data || [],
        recovery_7d: recoveryRes.data || [],
        active_alerts: intelRes.data || [],
        weather: weatherRes.data,
        summary: {
          total_sessions_7d: sessionsRes.data?.length || 0,
          total_km_7d: sessionsRes.data?.filter((s: any) => s.distance_km).reduce((a: number, s: any) => a + (s.distance_km || 0), 0).toFixed(1),
          latest_recovery: recoveryRes.data?.[0] || null,
          latest_hrv: recoveryRes.data?.[0]?.hrv_ms || null,
          avg_sleep_7d: recoveryRes.data?.length
            ? (recoveryRes.data.reduce((a: number, r: any) => a + (r.sleep_hrs || 0), 0) / recoveryRes.data.length).toFixed(1)
            : null
        }
      }
    }

    if (action === 'sessions') {
      const limit = parseInt(searchParams.get('limit') || '20')
      const { data: sessions } = await supabase
        .from('sessions').select('*').order('date', { ascending: false }).limit(limit)
      data = { sessions }
    }

    if (action === 'recovery') {
      const limit = parseInt(searchParams.get('limit') || '14')
      const { data: recovery } = await supabase
        .from('recovery').select('*').order('date', { ascending: false }).limit(limit)
      data = { recovery }
    }

    return cors(NextResponse.json({ ok: true, data }))
  } catch (e: any) {
    return cors(NextResponse.json({ ok: false, error: e.message }, { status: 500 }))
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    // ── LOG SESSION ──────────────────────────────────────────
    if (action === 'log_session') {
      const session = body.session
      if (!session?.date || !session?.type || !session?.title) {
        return cors(NextResponse.json({ ok: false, error: 'Missing required fields: date, type, title' }, { status: 400 }))
      }

      const { data, error } = await supabase
        .from('sessions')
        .upsert({ ...session, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        .select().single()

      if (error) throw error

      // Log to intel
      await supabase.from('intel_log').insert({
        category: 'session_logged',
        title: `Session logged: ${session.title}`,
        body: `${session.date} · ${session.type} · ${session.duration_min || '?'}min${session.distance_km ? ` · ${session.distance_km}km` : ''}${session.rpe ? ` · RPE ${session.rpe}` : ''}`,
        severity: 'INFO',
        data: session
      })

      return cors(NextResponse.json({ ok: true, session: data, message: 'Session logged to EliteOS.' }))
    }

    // ── UPDATE RECOVERY ──────────────────────────────────────
    if (action === 'update_recovery') {
      const recovery = body.recovery
      if (!recovery?.date) {
        return cors(NextResponse.json({ ok: false, error: 'Missing date' }, { status: 400 }))
      }

      const { data, error } = await supabase
        .from('recovery')
        .upsert({ ...recovery, updated_at: new Date().toISOString() }, { onConflict: 'date' })
        .select().single()

      if (error) throw error

      // Auto-alert if critical
      if (recovery.alert_level && recovery.alert_level !== 'INFO') {
        await supabase.from('intel_log').insert({
          category: 'intervention',
          title: `${recovery.alert_level}: Recovery intervention`,
          body: recovery.notes || '',
          severity: recovery.alert_level,
          data: { adjustments: recovery.adjustments }
        })
      }

      return cors(NextResponse.json({ ok: true, recovery: data, message: 'Recovery data updated.' }))
    }

    // ── LOG INTEL ────────────────────────────────────────────
    if (action === 'log_intel') {
      const { data, error } = await supabase
        .from('intel_log')
        .insert({ ...body.intel, timestamp: new Date().toISOString() })
        .select().single()
      if (error) throw error
      return cors(NextResponse.json({ ok: true, intel: data }))
    }

    // ── UPDATE PROFILE ───────────────────────────────────────
    if (action === 'update_profile') {
      const { data, error } = await supabase
        .from('athlete_profile')
        .update({ ...body.profile, updated_at: new Date().toISOString() })
        .eq('id', 1).select().single()
      if (error) throw error
      return cors(NextResponse.json({ ok: true, profile: data }))
    }

    // ── UPDATE WEATHER ───────────────────────────────────────
    if (action === 'update_weather') {
      const { data, error } = await supabase
        .from('weather_cache')
        .upsert({ id: 1, ...body.weather, updated_at: new Date().toISOString() })
        .select().single()
      if (error) throw error
      return cors(NextResponse.json({ ok: true, weather: data }))
    }

    // ── DISMISS ALERT ────────────────────────────────────────
    if (action === 'dismiss_alert') {
      await supabase.from('intel_log').update({ dismissed: true }).eq('id', body.id)
      return cors(NextResponse.json({ ok: true }))
    }

    return cors(NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 }))

  } catch (e: any) {
    return cors(NextResponse.json({ ok: false, error: e.message }, { status: 500 }))
  }
}
