/**
 * The FFMPEG method — script generator.
 *
 * The method creators run a true x265 re-encode: 10-bit HLG HEVC, high bitrate,
 * TikTok's timescale, clean mux. A browser tab cannot do that step (the browser
 * ffmpeg build has no working libx265 — it deadlocks on the first frame; tested
 * 28 Sept 2026), so this module builds the exact command for a probed file and
 * wraps it in drag-and-drop scripts (Windows .bat / macOS .command / Linux .sh)
 * that auto-install ffmpeg when missing and run the method at native speed.
 *
 * Timescale convention measured from delivered files:
 *   60fps → 19200 (320×60) · 30fps → 15360 (512×30) · other → 19200
 * Colour: HDR source → 10-bit bt2020 / HLG (arib-std-b67) / bt2020nc
 *         SDR source → 8-bit bt709 (we never fake HDR tags on SDR content)
 */

export function methodTimescale(fps) {
  if (fps >= 55) return 19200;      // 60/120 fps: measured on creator deliveries
  if (fps >= 28) return 15360;      // 30 fps: measured on TikTok's own encode
  return 19200;                     // 24 etc: 19200 divides cleanly anyway
}

/** ffmpeg argument list for a probed file (input/output paths are placeholders). */
export function methodArgs(p, opts = {}) {
  const preset = opts.preset || 'faster';
  const bitrate = opts.bitrate || '20M';
  const hdr = !!p.hdr;
  const ts = methodTimescale(p.fps || 60);
  const a = [
    '-i', 'INPUT',
    '-map', '0:v:0', '-map', '0:a:0?',
    '-map_metadata', '-1',
    '-vf', "scale=w='min(iw,1080)':h='min(ih,1920)':force_original_aspect_ratio=decrease:force_divisible_by=2",
    '-c:v', 'libx265', '-preset', preset, '-tag:v', 'hvc1',
  ];
  if (hdr) {
    a.push('-pix_fmt', 'p010le',
      '-x265-params', 'profile=main10:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc',
      '-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc');
  } else {
    a.push('-pix_fmt', 'yuv420p',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709');
  }
  a.push('-b:v', bitrate,
    '-video_track_timescale', String(ts),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
    '-movflags', '+faststart',
    'OUTPUT');
  return a;
}

/** Human-readable command for copy/paste (quoted paths, line-free). */
export function methodCommand(p, opts = {}) {
  return 'ffmpeg -hide_banner -y ' +
    methodArgs(p, opts).map(x => /[^A-Za-z0-9_.,:=+?'()-]/.test(x) ? `'${x}'` : x).join(' ')
      .replace('INPUT', 'input.mp4').replace('OUTPUT', 'input-method.mp4');
}

/** The args with real filenames substituted, single line, for scripts. */
const scriptArgs = (p, opts, inputRef, outputRef) =>
  methodArgs(p, opts).map(x =>
    x === 'INPUT' ? inputRef : x === 'OUTPUT' ? outputRef : x.includes(' ') ? `"${x}"` : x).join(' ');

/** swap literal preset/bitrate tokens for script variables (%PRESET% / ${PRESET}) */
const varify = (line, preset, bitrate, isWin) => {
  const PRE = isWin ? '%PRESET%' : '"${PRESET}"';
  const BR  = isWin ? '%BITRATE%' : '"${BITRATE}"';
  return line.split(' ').map(t => t === preset ? PRE : t === bitrate ? BR : t).join(' ');
};

export function methodScript(p, opts = {}, platform = 'win') {
  const base = methodArgs(p, opts);
  if (platform === 'win') {
    const cmd = scriptArgs(p, opts, '"%~1"', '"%~dpn1-method.mp4"');
    return [
      '@echo off',
      'setlocal',
      'REM ============================================================',
      `REM  Vague - FFMPEG method  (video: ${p.fileName || 'your video'})`,
      'REM  True x265 re-encode: ' + (p.hdr ? '10-bit HLG HDR' : 'bt709') +
        `, ${(p.fps || 60) | 0} fps, TikTok timescale ${methodTimescale(p.fps || 60)}`,
      'REM  Drag your video ONTO this file. Output appears next to it.',
      'REM ============================================================',
      'set PRESET=' + (opts.preset || 'faster'),
      'set BITRATE=' + (opts.bitrate || '20M'),
      'if "%~1"=="" (',
      '  echo Drag a video file ONTO this script - or run:  method.bat "video.mp4"',
      '  pause',
      '  exit /b 1',
      ')',
      'where ffmpeg >nul 2>&1',
      'if errorlevel 1 (',
      '  echo ffmpeg not found - installing it with winget...',
      '  winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements',
      '  echo.',
      '  echo If that worked: close this window, then drag your video on again.',
      '  pause',
      '  exit /b 1',
      ')',
      'echo Encoding with the method recipe - this takes a few minutes...',
      'ffmpeg -hide_banner -y ' + varify(cmd, opts.preset || 'faster', opts.bitrate || '20M', true),
      'if errorlevel 1 (',
      '  echo.',
      '  echo Encoding failed - scroll up for the ffmpeg message.',
      '  pause',
      '  exit /b 1',
      ')',
      'echo.',
      'echo Done. Next to your video: "%~dpn1-method.mp4"',
      'echo Upload it with TikTok Studio in a browser. Done.',
      'pause',
      '',
    ].join('\r\n');
  }
  // macOS / Linux
  const isMac = platform === 'mac';
  const shell = isMac ? 'zsh' : 'bash';
  const root = isMac ? '${INPUT:r}' : '${INPUT%.*}';
  const installer = isMac
    ? 'command -v ffmpeg >/dev/null || { echo "ffmpeg not found - installing with Homebrew..."; brew install ffmpeg || { echo "Install ffmpeg first: https://ffmpeg.org/download.html"; exit 1; }; }'
    : 'command -v ffmpeg >/dev/null || { echo "ffmpeg not found - install it first, e.g.:"; echo "  sudo apt install ffmpeg    (Debian/Ubuntu)"; echo "  sudo dnf install ffmpeg    (Fedora)"; exit 1; }';
  const cmd = scriptArgs(p, opts, '"$INPUT"', `"${root}-method.mp4"`);
  return [
    '#!/' + shell,
    '# ============================================================',
    `#  Vague - FFMPEG method  (video: ${p.fileName || 'your video'})`,
    '#  True x265 re-encode: ' + (p.hdr ? '10-bit HLG HDR' : 'bt709') +
      `, ${(p.fps || 60) | 0} fps, TikTok timescale ${methodTimescale(p.fps || 60)}`,
    isMac ? '#  Drag your video ONTO this file in Finder (first run: right-click → Open).'
          : '#  Run it in a terminal:  ./method.sh video.mp4',
    '# ============================================================',
    'INPUT="${1:-}"',
    'if [[ -z "$INPUT" ]]; then echo "Drag a video file onto this script, or run it with the filename."; exit 1; fi',
    installer,
    'PRESET=' + (opts.preset || 'faster'),
    'BITRATE=' + (opts.bitrate || '20M'),
    'echo "Encoding with the method recipe - this takes a few minutes..."',
    'ffmpeg -hide_banner -y ' + varify(cmd, opts.preset || 'faster', opts.bitrate || '20M', false),
    'echo',
    `echo "Done: ${root}-method.mp4"`,
    'echo "Upload it with TikTok Studio in a browser."',
    '',
  ].join('\n');
}
