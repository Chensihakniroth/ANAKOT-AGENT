import { atom } from 'nanostores'

import { gatewayRpc } from '@/lib/gateway-rpc'

// Session control — ported from Hermes with real gateway integration
export type SessionControlGoalStatus = 'active' | 'done' | 'paused'
export type SessionControlLoopMode = 'interval' | 'self_paced'
export type SessionControlLoopStatus = 'active' | 'done' | 'paused'
export type SessionControlHeartbeatStatus = 'active' | 'paused'

export interface SessionControlGoalContract {
  boundaries: string
  constraints: string
  outcome: string
  stop_when: string
  verification: string
}

export interface SessionControlGate {
  attempts: number
  command: string
  last_exit_code: number | null
  max_retries: number
  timeout_seconds: number
}

export type SessionControlWaitBarrier =
  | { reason: string; type: 'until'; until_at: number }
  | { reason: string; target: string; type: 'session' }
  | { reason: string; target: number; type: 'pid' }

export interface SessionControlGoal {
  contract: SessionControlGoalContract
  gates: SessionControlGate[]
  last_reason?: string
  last_verdict?: 'blocked' | 'continue' | 'done' | 'skipped' | 'wait'
  max_turns: number
  paused_reason?: string
  status: SessionControlGoalStatus
  subgoals: string[]
  title: string
  turns_used: number
  updated_at?: number
  wait_barrier?: SessionControlWaitBarrier
  created_at?: number
}

export interface SessionControlLoop {
  awaiting_response: boolean
  created_at: number
  current_delay: number
  deferred_by_goal: boolean
  interval_seconds: number
  last_fired_at: number
  last_stop_reason?: string
  max_ticks: number
  mode: SessionControlLoopMode
  next_due_at: number
  paused_reason?: string
  status: SessionControlLoopStatus
  ticks_used: number
}

export interface SessionControlHeartbeat {
  sessionId: string
  status: SessionControlHeartbeatStatus
  last_beat_at: number
}

interface SessionControlState {
  goals: SessionControlGoal[]
  loops: SessionControlLoop[]
  heartbeat?: SessionControlHeartbeat
}

export const $sessionControlState = atom<Record<string, SessionControlState>>({})

// Load session control state from gateway
export async function loadSessionControl(sessionId: string): Promise<SessionControlState | null> {
  try {
    const result = await gatewayRpc<{ state?: SessionControlState }>('session.control.get', { session_id: sessionId })
    if (result.state) {
      $sessionControlState.set({ ...$sessionControlState.get(), [sessionId]: result.state })
      return result.state
    }
  } catch {
    // Ignore
  }
  return $sessionControlState.get()[sessionId] || null
}

// Start a session loop
export async function startSessionLoop(
  sessionId: string,
  options: { interval_seconds?: number; mode?: SessionControlLoopMode; max_ticks?: number }
): Promise<boolean> {
  try {
    const result = await gatewayRpc<{ ok?: boolean }>('session.control.loop.start', {
      session_id: sessionId,
      ...options,
    })
    return result.ok ?? false
  } catch {
    return false
  }
}

// Stop a session loop
export async function stopSessionLoop(sessionId: string, reason?: string): Promise<boolean> {
  try {
    const result = await gatewayRpc<{ ok?: boolean }>('session.control.loop.stop', {
      session_id: sessionId,
      reason,
    })
    return result.ok ?? false
  } catch {
    return false
  }
}

// Pause a session goal
export async function pauseSessionGoal(sessionId: string, goalId: string, reason?: string): Promise<boolean> {
  try {
    const result = await gatewayRpc<{ ok?: boolean }>('session.control.goal.pause', {
      session_id: sessionId,
      goal_id: goalId,
      reason,
    })
    return result.ok ?? false
  } catch {
    return false
  }
}

// Resume a session goal
export async function resumeSessionGoal(sessionId: string, goalId: string): Promise<boolean> {
  try {
    const result = await gatewayRpc<{ ok?: boolean }>('session.control.goal.resume', {
      session_id: sessionId,
      goal_id: goalId,
    })
    return result.ok ?? false
  } catch {
    return false
  }
}
