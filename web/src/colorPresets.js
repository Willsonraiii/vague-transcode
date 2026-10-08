// Color grading presets catalog for Obito Studio
// Each preset provides an FFmpeg video filter chain and client-side CSS preview filter.

export const COLOR_PRESETS = [
  {
    id: 'original',
    name: 'Original',
    badge: '100% Lossless',
    shortDesc: 'Bit-for-bit stream copy · zero quality loss',
    accentColor: '#38bdf8', // sky blue
    ffmpegFilter: null,
    cssFilter: 'none',
  },
  {
    id: 'vibrant',
    name: 'Vibrant Pop',
    badge: 'TikTok Pop',
    shortDesc: 'Punchy contrast, vivid saturation & crisp edge details',
    accentColor: '#f43f5e', // rose
    ffmpegFilter: 'eq=contrast=1.12:saturation=1.24:brightness=0.01,unsharp=3:3:0.4:3:3:0.0',
    cssFilter: 'contrast(112%) saturate(124%) brightness(101%)',
  },
  {
    id: 'cinematic',
    name: 'Cinematic Warm',
    badge: 'Golden Film',
    shortDesc: 'Rich golden highlights, gentle shadows & soft film curve',
    accentColor: '#f59e0b', // amber
    ffmpegFilter: 'colorbalance=rs=0.05:gs=0.01:bs=-0.04:rm=0.06:gm=0.01:bm=-0.05:rh=0.07:gh=0.02:bh=-0.05,eq=contrast=1.06:saturation=1.08',
    cssFilter: 'sepia(14%) contrast(106%) saturate(108%) hue-rotate(-6deg)',
  },
  {
    id: 'teal_orange',
    name: 'Teal & Orange',
    badge: 'Blockbuster',
    shortDesc: 'Deep teal shadows balanced with radiant warm skin tones',
    accentColor: '#06b6d4', // cyan
    ffmpegFilter: 'colorbalance=rs=-0.05:gs=0.01:bs=0.07:rm=0.05:gm=0.01:bm=-0.04:rh=0.07:gh=0.02:bh=-0.05,eq=contrast=1.10:saturation=1.14',
    cssFilter: 'contrast(110%) saturate(114%) hue-rotate(8deg)',
  },
  {
    id: 'moody_cool',
    name: 'Moody Noir',
    badge: 'Cyberpunk',
    shortDesc: 'Desaturated shadows, crisp contrast & cool blue accents',
    accentColor: '#6366f1', // indigo
    ffmpegFilter: 'colorbalance=rs=-0.06:gs=0.0:bs=0.06:rm=-0.04:gm=0.01:bm=0.05:rh=-0.02:gh=0.01:bh=0.05,eq=contrast=1.16:saturation=0.92',
    cssFilter: 'contrast(116%) saturate(92%) hue-rotate(15deg)',
  },
  {
    id: 'vintage_35mm',
    name: 'Vintage 35mm',
    badge: 'Retro Analog',
    shortDesc: 'Faded matte blacks, nostalgic film warmth & pastel tones',
    accentColor: '#d97706', // warm amber
    ffmpegFilter: 'curves=all=\'0/0.05 0.25/0.28 0.75/0.73 1/0.96\':red=\'0/0 0.5/0.52 1/1\':blue=\'0/0.04 0.5/0.48 1/0.92\',eq=saturation=1.06',
    cssFilter: 'sepia(18%) contrast(98%) saturate(106%) brightness(102%)',
  },
];

export function getPresetById(id) {
  return COLOR_PRESETS.find((p) => p.id === id) || COLOR_PRESETS[0];
}
