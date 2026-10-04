// Toolbox — central tool registry.
// Add a new tool here and it automatically shows up in search, its
// categories, and becomes eligible for "Random Tool" — no other
// homepage changes needed.

window.TOOLBOX_CATEGORIES = [
  { key: 'finance',   label: 'Finance',      emoji: '💰' },
  { key: 'roblox',    label: 'Roblox',       emoji: '🎮' },
  { key: 'health',    label: 'Health & Life',emoji: '😴' },
  { key: 'math',      label: 'Math & Numbers', emoji: '🧮' },
  { key: 'developer', label: 'Developer',    emoji: '💻' },
  { key: 'design',    label: 'Design',       emoji: '🎨' },
  { key: 'random',    label: 'Random & Fun', emoji: '🎲' },
  { key: 'utilities', label: 'Utilities',    emoji: '🛠️' }
];

window.TOOLBOX_TOOLS = [
  {
    id: 'investment',
    name: 'Investment Simulation',
    description: 'Model best/average/worst-case investment growth over time, or find the present value of future money.',
    keywords: ['investment', 'simulator', 'returns', 'growth', 'compound', 'stocks', 'portfolio', 'present value', 'pv', 'npv', 'discount', 'annuity', 'perpetuity', 'bond'],
    categories: ['finance'],
    path: 'InvestmentSimulation/investment.html',
    color: '#3b82f6',
    popular: true
  },
  {
    id: 'devex',
    name: 'DevEx Calculator',
    description: 'Convert Robux to estimated DevEx value, or the reverse.',
    keywords: ['robux', 'devex', 'roblox', 'usd', 'currency', 'nzd', 'payout'],
    categories: ['roblox', 'finance'],
    path: 'DevExCalculator/devex.html',
    color: '#10b981',
    popular: true
  },
  {
    id: 'sleep',
    name: 'Sleep Stats',
    description: 'Calculate total sleep time and break it into stages.',
    keywords: ['sleep', 'stages', 'rem', 'deep', 'light', 'awake', 'bedtime'],
    categories: ['health'],
    path: 'SleepStats/sleep.html',
    color: '#8b5cf6'
  },
  {
    id: 'percentage-change',
    name: 'Percentage Change',
    description: 'Find the % increase or decrease between two values.',
    keywords: ['percentage', 'percent', 'change', 'increase', 'decrease', '%'],
    categories: ['math', 'finance'],
    path: 'PercentageChange/percentage-change.html',
    color: '#f59e0b',
    popular: true
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    description: 'Convert length, weight, temperature, speed, area, volume, data, and time.',
    keywords: ['unit', 'convert', 'conversion', 'length', 'weight', 'temperature', 'speed', 'metric', 'imperial', 'data'],
    categories: ['utilities', 'math'],
    path: 'UnitConverter/unit-converter.html',
    color: '#06b6d4',
    popular: true
  },
  {
    id: 'screen-resolution',
    name: 'Screen Resolution',
    description: 'Aspect ratio, total pixels, and megapixels for any resolution.',
    keywords: ['screen', 'resolution', 'aspect ratio', 'pixels', '1920x1080', 'megapixels'],
    categories: ['utilities', 'design'],
    path: 'ScreenResolution/screen-resolution.html',
    color: '#ec4899'
  },
  {
    id: 'random-number',
    name: 'Random Number Generator',
    description: 'Generate random numbers with a custom range and options.',
    keywords: ['random', 'number', 'generator', 'dice', 'roll', 'rng'],
    categories: ['random', 'math'],
    path: 'RandomNumber/random-number.html',
    color: '#eab308'
  },
  {
    id: 'timestamp-converter',
    name: 'Timestamp Converter',
    description: 'Convert Unix timestamps to dates and back.',
    keywords: ['timestamp', 'unix', 'epoch', 'date', 'utc', 'time'],
    categories: ['developer'],
    path: 'TimestampConverter/timestamp-converter.html',
    color: '#64748b'
  },
  {
    id: 'color-converter',
    name: 'Color Converter & Palette',
    description: 'Convert HEX/RGB/HSL/HSV and generate color palettes.',
    keywords: ['color', 'colour', 'hex', 'rgb', 'hsl', 'hsv', 'palette', 'design'],
    categories: ['design'],
    path: 'ColorConverter/color-converter.html',
    color: '#f43f5e',
    popular: true
  },
  {
    id: 'gamepass-revenue',
    name: 'Gamepass Revenue Calculator',
    description: 'Estimate Robux and DevEx earnings from gamepass sales.',
    keywords: ['gamepass', 'robux', 'revenue', 'roblox', 'devex', 'earnings', 'sales'],
    categories: ['roblox', 'finance'],
    path: 'GamepassRevenue/gamepass-revenue.html',
    color: '#22c55e'
  },
  {
    id: 'thumbnail-helper',
    name: 'Thumbnail & Icon Size Helper',
    description: 'Recommended dimensions for Roblox icons, thumbnails, and badges.',
    keywords: ['thumbnail', 'icon', 'badge', 'roblox', 'dimensions', 'size', 'aspect ratio'],
    categories: ['roblox', 'design'],
    path: 'ThumbnailHelper/thumbnail-helper.html',
    color: '#a855f7'
  },
  {
    id: 'udim2-generator',
    name: 'UDim2 Generator',
    description: 'Build Roblox UDim2 position/size values with a live preview.',
    keywords: ['udim2', 'roblox', 'lua', 'ui', 'gui', 'scale', 'offset'],
    categories: ['roblox', 'developer', 'design'],
    path: 'UDim2Generator/udim2-generator.html',
    color: '#0ea5e9'
  },
  {
    id: 'number-formatter',
    name: 'Number Formatter',
    description: 'Format big numbers into compact K/M/B/T leaderboard style.',
    keywords: ['number', 'format', 'roblox', 'compact', 'leaderboard', 'k', 'm', 'b', 't'],
    categories: ['roblox', 'math'],
    path: 'NumberFormatter/number-formatter.html',
    color: '#facc15'
  },
  {
    id: 'time-until',
    name: 'Time Until Calculator',
    description: 'Find out exactly how long remains until a target time.',
    keywords: ['time', 'until', 'countdown', 'remaining', 'clock'],
    categories: ['health', 'utilities'],
    path: 'TimeUntil/time-until.html',
    color: '#38bdf8'
  },
  {
    id: 'age-at-date',
    name: 'Age-at-Date Calculator',
    description: 'Work out an exact age on any date, past or future.',
    keywords: ['age', 'birthday', 'date of birth', 'years old', 'how old'],
    categories: ['health', 'math'],
    path: 'AgeAtDate/age-at-date.html',
    color: '#fb7185'
  },
  {
    id: 'how-long-is-that',
    name: 'How Long Is That?',
    description: 'Turn a big number of time units into a readable duration, or the reverse.',
    keywords: ['duration', 'seconds', 'days', 'how long', 'time conversion'],
    categories: ['math', 'random'],
    path: 'HowLongIsThat/how-long-is-that.html',
    color: '#c084fc'
  },
  {
    id: 'what-can-i-afford',
    name: 'What Can I Afford?',
    description: 'A simple spending calculator for one item or a list of items.',
    keywords: ['afford', 'budget', 'spending', 'tax', 'money', 'shopping'],
    categories: ['finance'],
    path: 'WhatCanIAfford/what-can-i-afford.html',
    color: '#4ade80'
  },
  {
    id: 'storage-calculator',
    name: 'Storage Calculator',
    description: 'How many files fit in a given storage capacity, or how much room is left.',
    keywords: ['storage', 'disk', 'drive', 'files', 'gb', 'tb', 'capacity'],
    categories: ['utilities', 'math'],
    path: 'StorageCalculator/storage-calculator.html',
    color: '#2dd4bf'
  },
  {
    id: 'download-time',
    name: 'Download Time Calculator',
    description: 'How long a file will take at a given connection speed.',
    keywords: ['download', 'time', 'speed', 'mbps', 'internet', 'file size'],
    categories: ['utilities'],
    path: 'DownloadTime/download-time.html',
    color: '#60a5fa'
  },
  {
    id: 'chance-simulator',
    name: 'Chance Simulator',
    description: 'Theoretical probability vs. real randomized simulation results.',
    keywords: ['chance', 'probability', 'odds', 'simulator', 'random', 'luck'],
    categories: ['random', 'math'],
    path: 'ChanceSimulator/chance-simulator.html',
    color: '#f472b6'
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Format, minify, and validate JSON, with helpful error locations.',
    keywords: ['json', 'format', 'minify', 'validate', 'developer'],
    categories: ['developer'],
    path: 'JsonFormatter/json-formatter.html',
    color: '#34d399'
  },
  {
    id: 'text-diff',
    name: 'Text Difference Tool',
    description: 'Compare two pieces of text and see exactly what changed.',
    keywords: ['diff', 'compare', 'text', 'difference', 'changes'],
    categories: ['developer'],
    path: 'TextDiff/text-diff.html',
    color: '#fbbf24'
  },
  {
    id: 'regex-tester',
    name: 'Regex Tester',
    description: 'Test regular expressions against text with live match highlighting.',
    keywords: ['regex', 'regular expression', 'pattern', 'match', 'developer'],
    categories: ['developer'],
    path: 'RegexTester/regex-tester.html',
    color: '#818cf8'
  },
  {
    id: 'how-many-x',
    name: 'How Many X?',
    description: 'A playful "how many of this fit into that" calculator, using your own units.',
    keywords: ['how many', 'divide', 'fun', 'comparison', 'ratio'],
    categories: ['random'],
    path: 'HowManyX/how-many-x.html',
    color: '#fb923c'
  },
  {
    id: 'link-tool',
    name: 'Link Tool',
    description: 'Keep a simple collection of useful links with names and descriptions.',
    keywords: ['links', 'link', 'urls', 'url', 'bookmarks', 'websites', 'website'],
    categories: ['utilities'],
    path: 'LinkTool/link-tool.html',
    color: '#f97316'
  },
  {
    id: 'ccu-earnings',
    name: 'CCU Earnings Simulator',
    description: 'Rough estimate of daily/monthly earnings from a steady average CCU.',
    keywords: ['ccu', 'concurrent', 'players', 'earnings', 'robux', 'creator rewards', 'simulator', 'roblox'],
    categories: ['roblox', 'finance'],
    path: 'CCUEarnings/ccu-earnings.html',
    color: '#e879f9'
  },
  {
    id: 'background-remover',
    name: 'Background Remover',
    description: 'Remove the background from a photo entirely in your browser — no uploads, no account.',
    keywords: ['background', 'remove', 'remove.bg', 'transparent', 'png', 'image', 'photo', 'cutout'],
    categories: ['design', 'utilities'],
    path: 'BackgroundRemover/background-remover.html',
    color: '#2dd4bf',
    popular: true
  },
  {
    id: 'timers',
    name: 'Timers',
    description: 'Stopwatch, countdown timer, alarm, and a repeating interval loop (e.g. 90/20 min cycles).',
    keywords: ['timer', 'stopwatch', 'alarm', 'countdown', 'interval', 'loop', 'pomodoro'],
    categories: ['utilities', 'health'],
    path: 'Timers/timers.html',
    color: '#fbbf24',
    popular: true
  },
  {
    id: 'timezone-chart',
    name: 'Timezone Comparison',
    description: 'Compare local time across timezones on one UTC-aligned timeline, with a reference-time alignment line.',
    keywords: ['timezone', 'time zone', 'utc', 'world clock', 'meeting time', 'nzst', 'est', 'gmt'],
    categories: ['utilities'],
    path: 'TimezoneChart/timezone-chart.html',
    color: '#38bdf8'
  },
  {
    id: 'pattern-maker',
    name: 'Pattern Maker',
    description: 'Generative Sunburst and Halftone pattern tool with full control over shape, color, and variation — export SVG or PNG.',
    keywords: ['sunburst', 'pattern', 'svg', 'generative', 'vector', 'rays', 'halftone', 'design'],
    categories: ['design'],
    path: 'PatternMaker/pattern-maker.html',
    color: '#f6a623'
  },
  {
    id: 'currency-converter',
    name: 'Currency Converter',
    description: 'Convert between 270+ currencies: world money, precious metals, crypto and historical currencies like the German Mark.',
    keywords: ['currency', 'exchange', 'exchange rate', 'convert', 'forex', 'fx', 'money', 'usd', 'eur', 'nzd', 'gbp', 'bitcoin', 'crypto', 'gold', 'silver'],
    categories: ['finance', 'utilities'],
    path: 'CurrencyConverter/currency-converter.html',
    color: '#14b8a6',
    popular: true
  },
  {
    id: 'robux-cost',
    name: 'Robux Cost Calculator',
    description: 'What it costs to buy any amount of Robux, or how many Robux your money gets you: cheapest pack mix, web vs. mobile, 150+ currencies.',
    keywords: ['robux', 'buy', 'cost', 'price', 'purchase', 'packs', 'gift card', 'roblox', 'how much', 'how many', 'budget', 'spend', 'usd', 'nzd', 'aud', 'gbp', 'eur', 'currency'],
    categories: ['roblox', 'finance'],
    path: 'RobuxCost/robux-cost.html',
    color: '#f87171',
    popular: false
  },
  {
    id: 'habit-tracker',
    name: 'Habit Tracker',
    description: 'Check off daily habits, hit weekly goals, keep streaks and watch your progress fill a calendar. Installable, works offline, syncs across devices.',
    keywords: ['habit', 'habits', 'tracker', 'streak', 'routine', 'calendar', 'goals', 'daily', 'workout', 'check off', 'progress', 'sync'],
    categories: ['health', 'utilities'],
    path: 'HabitTracker/habit-tracker.html',
    color: '#a3e635',
    popular: true
  },
];