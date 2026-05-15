import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Mumbai coordinates
const LAT = 19.0760
const LON = 72.8777

export async function GET() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Asia/Kolkata`

    const res = await fetch(url, { next: { revalidate: 1800 } }) // cache 30min
    const json = await res.json()
    const c = json.current

    // WMO weather code to description
    const weatherDesc: Record<number, string> = {
      0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Icy Fog', 51: 'Light Drizzle', 53: 'Drizzle',
      61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
      80: 'Showers', 81: 'Showers', 82: 'Heavy Showers',
      95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Severe Storm'
    }

    const weather = {
      date: new Date().toISOString().split('T')[0],
      temp_c: c.temperature_2m,
      humidity_pct: c.relative_humidity_2m,
      feels_like_c: c.apparent_temperature,
      heat_index: c.apparent_temperature,
      condition: weatherDesc[c.weather_code] || 'Unknown',
      wind_kmh: c.wind_speed_10m
    }

    // Cache in Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.from('weather_cache').upsert({ id: 1, ...weather, updated_at: new Date().toISOString() })

    return NextResponse.json({ ok: true, weather })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
