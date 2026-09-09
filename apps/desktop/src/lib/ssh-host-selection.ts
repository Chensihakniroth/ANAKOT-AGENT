/**
 * SSH host selection utilities.
 *
 * Manages the state of an SSH host selection: picking a host, then
 * enriching it with resolved SSH config (user, port, identity file).
 *
 * When the user switches hosts, all derived fields are cleared to
 * prevent stale credentials leaking across connections. Enrichment
 * is additive — values the user has already entered are preserved.
 */

export interface SshHostState {
  /** Selected hostname or IP. */
  sshHost: string
  /** Remote username. Empty string means "use default". */
  sshUser: string
  /** Remote port. null means "use default (22)". */
  sshPort: number | null
  /** Path to the SSH identity/private key file. */
  sshKeyPath: string
}

/**
 * Resolved SSH config for a host, typically parsed from ~/.ssh/config.
 */
export interface ResolvedSshHost {
  identityFile?: string | null
  port?: number | null
  user?: string | null
}

/**
 * Selects a host, clearing any previously-derived fields.
 *
 * Returns the same state when re-selecting the same host (no-op).
 */
export function selectSshHost<T extends SshHostState>(state: T, host: string): T {
  if (state.sshHost === host) return state

  return {
    ...state,
    sshHost: host,
    sshUser: '',
    sshPort: null,
    sshKeyPath: ''
  }
}

/**
 * Enriches an already-selected host with resolved SSH config data.
 *
 * Only fills in fields that are currently empty — preserves any
 * values the user has already entered. Does nothing if the resolved
 * host doesn't match the currently selected host.
 */
export function enrichSelectedSshHost<T extends SshHostState>(
  state: T,
  host: string,
  resolved: ResolvedSshHost
): T {
  if (state.sshHost !== host) return state

  return {
    ...state,
    sshUser: state.sshUser || resolved.user || '',
    sshPort: state.sshPort ?? (resolved.port && resolved.port !== 22 ? resolved.port : null),
    sshKeyPath: state.sshKeyPath || resolved.identityFile || ''
  }
}