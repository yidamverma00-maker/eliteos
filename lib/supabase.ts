import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Session = {
  id?: string
  date: string
  type: 'Run' | 'Strength' | 'Bike' | 'Swim' | 'Rest' | 'Other'
  title: string
  duration_min?: number
  distance_km?: number
  notes?: string
  rpe?: number
  status: 'completed' | 'planned' | 'skipped'
  source?: string
  created_at?: string
}

export type Recovery = {
  id?: string
  date: string
  hrv_ms?: number
  sleep_hrs?: number
  sleep_score?: number
  readiness_score?: number
  rhr_bpm?: number
  strain_score?: number
  recovery_score?: number
  notes?: string
  adjustments?: string[]
  alert_level?: 'INFO' | 'ADVISORY' | 'WARNING' | 'CRITICAL'
  source?: string
}

export type IntelLog = {
  id?: string
  timestamp?: string
  category: string
  title: string
  body?: string
  severity?: string
  data?: any
  dismissed?: boolean
}

export type AthleteProfile = {
  system_mode: string
  current_phase: string
  weekly_mileage_target_km: number
  race_goal?: string
  race_date?: string
  notes?: string
}
