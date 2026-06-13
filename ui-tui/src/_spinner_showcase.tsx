/**
 * Spinner Showcase — renders every spinner variant in a real Ink terminal.
 * Hardcoded frames to avoid ESM unicode-animations import issues in bundled mode.
 *
 * Run: node scripts/run_spinner_demo.mjs
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp } from '@anakot/ink';
import { DARK_THEME } from './theme.js';

const ACCENT = '#FFBF00';
const TEXT = '#FFF8DC';
const MUTED = '#CC9B1F';

// Hardcoded frames from unicode-animations (single char extracted)
const SPINNERS: Record<string, { frames: string[]; interval: number }> = {
  braille:    { frames: ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'], interval: 80 },
  waverows:   { frames: ['⠖','⡠','⣠','⣄','⠢','⠙','⠉','⠊','⠜'], interval: 80 },
  helix:      { frames: ['⢌','⣉','⣉','⡱','⢎','⣉','⣉','⡱','⢎'], interval: 80 },
  breathe:    { frames: ['⠀','⠂','⠌','⡑','⢕','⢝','⣫','⣟'], interval: 80 },
  orbit:      { frames: ['⠃','⠉','⠘','⠰','⢠','⣀','⡄','⠆'], interval: 80 },
  dna:        { frames: ['⠋','⠉','⠙','⠚','⠒','⠂','⠂','⠒','⠲'], interval: 80 },
  snake:      { frames: ['⣁','⣉','⡉','⠉','⠈','⠀','⠐','⠒','⠖'], interval: 80 },
  pulse:      { frames: ['⠀','⠰','⢾','⣏','⡁'], interval: 80 },
  fillsweep:  { frames: ['⣀','⣤','⣶','⣿','⣿','⣿','⣶','⣤'], interval: 80 },
  cascade:    { frames: ['⠀','⠀','⠁','⠋','⠞','⡴','⣠','⢀'], interval: 80 },
  scan:       { frames: ['⠀','⡇','⣿','⢸'], interval: 80 },
  diagswipe:  { frames: ['⠁','⠋','⠟','⡿','⣿','⣿','⣿','⣿','⣾','⣴','⣠','⢀','⠀'], interval: 80 },
  rain:       { frames: ['⢁','⠂','⠄','⡈','⠐','⠠','⢁','⠂'], interval: 80 },
  columns:    { frames: ['⡀','⡄','⡆','⡇','⣇','⣧','⣷','⣿','⣿','⣿','⣿','⣿','⣿'], interval: 80 },
  sparkle:    { frames: ['⡡','⠊','⢔','⡁','⢔','⠨'], interval: 80 },
};

function AnimatedSpinner({ label, frames, interval, color }: { label: string; frames: string[]; interval: number; color: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % frames.length), interval);
    return () => clearInterval(id);
  }, [frames, interval]);

  return (
    <Box>
      <Text color={color}>{frames[frame]}</Text>
      <Text color={TEXT}>  {label}</Text>
    </Box>
  );
}

function SpinnerShowcase() {
  const { exit } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => exit(), 12000);
    return () => clearTimeout(timer);
  }, [exit]);

  const thinkNames = ['waverows', 'helix', 'breathe', 'orbit', 'dna', 'snake', 'pulse'];
  const toolNames = ['fillsweep', 'cascade', 'scan', 'diagswipe', 'rain', 'columns', 'sparkle'];

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={DARK_THEME.color.primary}>
          ╔══════════════════════════════════════════════╗
        </Text>
        <Text bold color={DARK_THEME.color.primary}>
          ║   ANAKOT TUI — Spinner Showcase              ║
        </Text>
        <Text bold color={DARK_THEME.color.primary}>
          ╚══════════════════════════════════════════════╝
        </Text>
        <Text color={MUTED}>Each spinner animates live • auto-exits in 12s</Text>
      </Box>

      <Text bold color={ACCENT}>── InlineLoader (braille) ──</Text>
      <AnimatedSpinner label="scanning skills" frames={SPINNERS.braille.frames} interval={SPINNERS.braille.interval} color={ACCENT} />

      <Box marginTop={1}>
        <Text bold color={ACCENT}>── THINK spinners ──</Text>
      </Box>
      {thinkNames.map(name => (
        <AnimatedSpinner key={name} label={name} frames={SPINNERS[name].frames} interval={SPINNERS[name].interval} color={ACCENT} />
      ))}

      <Box marginTop={1}>
        <Text bold color={ACCENT}>── TOOL spinners ──</Text>
      </Box>
      {toolNames.map(name => (
        <AnimatedSpinner key={name} label={name} frames={SPINNERS[name].frames} interval={SPINNERS[name].interval} color={ACCENT} />
      ))}

      <Box marginTop={1}>
        <Text color={MUTED}>ℹ Edit SPINNERS in _spinner_showcase.tsx to test custom frames.</Text>
      </Box>
    </Box>
  );
}

export default SpinnerShowcase;
