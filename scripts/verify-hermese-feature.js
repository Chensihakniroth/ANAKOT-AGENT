// Verify a Hermes feature is truly missing from Anakot before building.
// Usage: node verify-feature.js <feature-slug>
// Example: node verify-feature.js composer-model-selector
//
// Returns 0 if feature is present, 1 if missing, 2 if unsure.

const FEATURE = process.argv[2]
if (!FEATURE) {
  console.error('Usage: node verify-feature.js <feature-slug>')
  process.exit(2)
}

const ANAKOT_SRC = 'D:/School/PROJECT/anakot-agent-home/anakot-agent/apps/desktop/src'
const HERMES_SRC = 'D:/temp-hermes-full/apps/desktop/src'

// Map common feature slugs to search patterns
const SLUG_PATTERNS = {
  'composer-model-selector': ['model-selector', 'modelPicker', 'model-picker', 'composer.*model'],
  'native-notifications': ['native-notifications', 'notification.*kind', 'NATIVE_NOTIFICATION'],
  'keyboard-shortcuts-panel': ['keybind-settings', 'keyboard.*shortcut.*panel', 'rebind'],
  'window-translucency': ['translucency', 'opacity', 'transparent.*window'],
  'context-usage-popover': ['context-usage', 'token.*usage', 'usage.*breakdown'],
  'auto-tts-read-aloud': ['auto-read-aloud', 'read.*aloud', 'tts.*auto'],
  'window-position-persistence': ['window.*state', 'windowState', 'electronStore', 'bounds.*save'],
  'stt-echo-transcripts': ['stt.*echo', 'echoTranscripts', 'stt_echo'],
  'remote-model-options': ['model-options', 'requestModelOptions', 'gateway.*model.*option'],
  'profile-rail-collapse': ['profile-switcher', 'profile.*rail.*collapse', 'collapsed.*profile'],
  'desktop-pets': ['pet-overlay', 'pet.*sprite', 'pet.*bubble', 'pet.generate'],
  'tool-backend-settings': ['toolsets-settings', 'toolset.*config', 'tool.*backend.*settings'],
  'multi-terminal': ['terminal-tabs', 'multi-terminal', 'terminal.*tab'],
  'memory-graph-starmap': ['starmap', 'star-map', 'memory.*graph'],
  'vs-code-terminal-theme': ['VSCODE_TERMINAL', 'vscode-terminal', 'terminal.*theme'],
  'diff-preview': ['diff-preview', 'diff-lines', 'syntax-diff'],
}

function findFiles(searchDir, pattern) {
  try {
    const result = execSync(`find "${searchDir}" -name "*${pattern}*" 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 10000
    })
    return result.trim().split('\n').filter(f => f.length > 0)
  } catch (e) {
    return []
  }
}

function grepFiles(searchDir, pattern) {
  try {
    const result = execSync(`grep -r "${pattern}" "${searchDir}" --include="*.ts" --include="*.tsx" -l 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 15000
    })
    return result.trim().split('\n').filter(f => f.length > 0)
  } catch (e) {
    return []
  }
}

const patterns = SLUG_PATTERNS[FEATURE] || [FEATURE]
let anakotFound = false
let hermesFound = false

for (const pattern of patterns) {
  const anakotFiles = findFiles(ANAKOT_SRC, pattern).concat(grepFiles(ANAKOT_SRC, pattern))
  if (anakotFiles.length > 0) {
    anakotFound = true
    console.log(`✅ Anakot has ${FEATURE} (pattern: ${pattern}):`)
    anakotFiles.slice(0, 5).forEach(f => console.log('  ', f))
    if (anakotFiles.length > 5) console.log(`  ... and ${anakotFiles.length - 5} more`)
    break
  }
}

for (const pattern of patterns) {
  const hermesFiles = findFiles(HERMES_SRC, pattern).concat(grepFiles(HERMES_SRC, pattern))
  if (hermesFiles.length > 0) {
    hermesFound = true
    console.log(`ℹ️  Hermes v0.18.0 has ${FEATURE} (pattern: ${pattern}):`)
    hermesFiles.slice(0, 5).forEach(f => console.log('  ', f.replace(HERMES_SRC, 'HERMES:')))
    if (hermesFiles.length > 5) console.log(`  ... and ${hermesFiles.length - 5} more`)
    break
  }
}

if (!anakotFound && !hermesFound) {
  console.log(`❓ ${FEATURE}: not found in either Anakot or Hermes v0.18.0 reference`)
  console.log('  This may be a Hermes future feature, or the slug needs different search patterns.')
  process.exit(2)
} else if (!anakotFound && hermesFound) {
  console.log(`❌ ${FEATURE}: MISSING from Anakot (Hermes has it)`)
  process.exit(1)
} else if (anakotFound && !hermesFound) {
  console.log(`✅ ${FEATURE}: present in Anakot (Hermes v0.18.0 reference does not have it either — likely a Hermes future feature or Anakot-specific addition)`)
  process.exit(0)
} else {
  console.log(`✅ ${FEATURE}: present in both Anakot and Hermes v0.18.0 reference`)
  process.exit(0)
}
