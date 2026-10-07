// Toolbox — central tool registry.
// Add a new tool here and it automatically shows up in search, its
// categories, and becomes eligible for "Random Tool" — no other
// homepage changes needed.
//
// TAGS: give every tool about 10 tags (lowercase, one idea each). Search matches
// the tool's name and tags first (exact tag > start of a tag > inside a tag) and
// only then its description, so tags are what make a tool findable. Include the
// obvious words, synonyms ("colour"), common abbreviations ("fx"), and what
// someone might type when they don't know the tool exists ("how old").

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
    tags: ['investment', 'simulator', 'compound interest', 'returns', 'growth', 'stocks', 'portfolio', 'present value', 'npv', 'annuity', 'perpetuity', 'retirement'],
    categories: ['finance'],
    path: 'InvestmentSimulation/investment.html',
    color: '#3b82f6',
    popular: true
  },
  {
    id: 'devex',
    name: 'DevEx Calculator',
    description: 'Convert Robux to estimated DevEx value, or the reverse.',
    tags: ['devex', 'robux', 'roblox', 'usd', 'nzd', 'payout', 'cash out', 'developer exchange', 'currency', 'money', 'earnings', 'convert'],
    categories: ['roblox', 'finance'],
    path: 'DevExCalculator/devex.html',
    color: '#10b981',
    popular: true
  },
  {
    id: 'sleep',
    name: 'Sleep Stats',
    description: 'Calculate total sleep time and break it into stages.',
    tags: ['sleep', 'sleep stages', 'rem', 'deep sleep', 'light sleep', 'awake', 'bedtime', 'rest', 'hours slept', 'health', 'tracker'],
    categories: ['health'],
    path: 'SleepStats/sleep.html',
    color: '#8b5cf6'
  },
  {
    id: 'percentage-change',
    name: 'Percentage Change',
    description: 'Find the % increase or decrease between two values.',
    tags: ['percentage', 'percent', '%', 'change', 'increase', 'decrease', 'difference', 'growth rate', 'markup', 'discount', 'math', 'calculator'],
    categories: ['math', 'finance'],
    path: 'PercentageChange/percentage-change.html',
    color: '#f59e0b',
    popular: true
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    description: 'Convert length, weight, temperature, speed, area, volume, data, and time.',
    tags: ['unit', 'converter', 'conversion', 'length', 'weight', 'temperature', 'speed', 'area', 'volume', 'metric', 'imperial', 'data size'],
    categories: ['utilities', 'math'],
    path: 'UnitConverter/unit-converter.html',
    color: '#06b6d4',
    popular: true
  },
  {
    id: 'screen-resolution',
    name: 'Screen Resolution',
    description: 'Aspect ratio, total pixels, and megapixels for any resolution.',
    tags: ['screen', 'resolution', 'aspect ratio', 'pixels', 'megapixels', '1920x1080', 'display', 'monitor', 'ratio', 'width height', '4k', 'design'],
    categories: ['utilities', 'design'],
    path: 'ScreenResolution/screen-resolution.html',
    color: '#ec4899'
  },
  {
    id: 'random-number',
    name: 'Random Number Generator',
    description: 'Generate random numbers with a custom range and options.',
    tags: ['random', 'number', 'generator', 'dice', 'roll', 'rng', 'lottery', 'pick a number', 'range', 'coin flip', 'raffle', 'fun'],
    categories: ['random', 'math'],
    path: 'RandomNumber/random-number.html',
    color: '#eab308'
  },
  {
    id: 'timestamp-converter',
    name: 'Timestamp Converter',
    description: 'Convert Unix timestamps to dates and back.',
    tags: ['timestamp', 'unix', 'epoch', 'date', 'time', 'utc', 'datetime', 'convert', 'developer', 'seconds since 1970', 'iso', 'milliseconds'],
    categories: ['developer'],
    path: 'TimestampConverter/timestamp-converter.html',
    color: '#64748b'
  },
  {
    id: 'color-converter',
    name: 'Color Converter & Palette',
    description: 'Convert HEX/RGB/HSL/HSV and generate color palettes.',
    tags: ['color', 'colour', 'hex', 'rgb', 'hsl', 'hsv', 'palette', 'picker', 'shades', 'css', 'converter', 'design'],
    categories: ['design'],
    path: 'ColorConverter/color-converter.html',
    color: '#f43f5e',
    popular: true
  },
  {
    id: 'gamepass-revenue',
    name: 'Gamepass Revenue Calculator',
    description: 'Estimate Robux and DevEx earnings from gamepass sales.',
    tags: ['gamepass', 'game pass', 'robux', 'revenue', 'roblox', 'devex', 'earnings', 'sales', 'income', 'monetization', 'profit', 'calculator'],
    categories: ['roblox', 'finance'],
    path: 'GamepassRevenue/gamepass-revenue.html',
    color: '#22c55e'
  },
  {
    id: 'thumbnail-helper',
    name: 'Thumbnail & Icon Size Helper',
    description: 'Recommended dimensions for Roblox icons, thumbnails, and badges.',
    tags: ['thumbnail', 'icon', 'badge', 'roblox', 'dimensions', 'size', 'aspect ratio', 'image', 'resolution', 'game page', 'pixels', 'design'],
    categories: ['roblox', 'design'],
    path: 'ThumbnailHelper/thumbnail-helper.html',
    color: '#a855f7'
  },
  {
    id: 'udim2-generator',
    name: 'UDim2 Generator',
    description: 'Build Roblox UDim2 position/size values with a live preview.',
    tags: ['udim2', 'roblox', 'lua', 'luau', 'ui', 'gui', 'scale', 'offset', 'position', 'size', 'studio', 'scripting'],
    categories: ['roblox', 'developer', 'design'],
    path: 'UDim2Generator/udim2-generator.html',
    color: '#0ea5e9'
  },
  {
    id: 'number-formatter',
    name: 'Number Formatter',
    description: 'Format big numbers into compact K/M/B/T leaderboard style.',
    tags: ['number', 'format', 'compact', 'leaderboard', 'roblox', 'k m b t', 'abbreviate', 'suffix', 'commas', 'large numbers', 'thousand million', 'scripting'],
    categories: ['roblox', 'math'],
    path: 'NumberFormatter/number-formatter.html',
    color: '#facc15'
  },
  {
    id: 'time-until',
    name: 'Time Until Calculator',
    description: 'Find out exactly how long remains until a target time.',
    tags: ['time until', 'countdown', 'remaining', 'clock', 'how long', 'target time', 'deadline', 'hours left', 'event', 'wait', 'date', 'timer'],
    categories: ['health', 'utilities'],
    path: 'TimeUntil/time-until.html',
    color: '#38bdf8'
  },
  {
    id: 'age-at-date',
    name: 'Age-at-Date Calculator',
    description: 'Work out an exact age on any date, past or future.',
    tags: ['age', 'birthday', 'date of birth', 'years old', 'how old', 'future age', 'past age', 'dob', 'anniversary', 'date', 'calculator', 'life'],
    categories: ['health', 'math'],
    path: 'AgeAtDate/age-at-date.html',
    color: '#fb7185'
  },
  {
    id: 'how-long-is-that',
    name: 'How Long Is That?',
    description: 'Turn a big number of time units into a readable duration, or the reverse.',
    tags: ['duration', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'years', 'how long', 'time conversion', 'readable', 'big numbers', 'math'],
    categories: ['math', 'random'],
    path: 'HowLongIsThat/how-long-is-that.html',
    color: '#c084fc'
  },
  {
    id: 'what-can-i-afford',
    name: 'What Can I Afford?',
    description: 'A simple spending calculator for one item or a list of items.',
    tags: ['afford', 'budget', 'spending', 'tax', 'money', 'shopping', 'items', 'total', 'price', 'cost', 'finance', 'list'],
    categories: ['finance'],
    path: 'WhatCanIAfford/what-can-i-afford.html',
    color: '#4ade80'
  },
  {
    id: 'storage-calculator',
    name: 'Storage Calculator',
    description: 'How many files fit in a given storage capacity, or how much room is left.',
    tags: ['storage', 'disk', 'drive', 'files', 'gb', 'tb', 'capacity', 'space', 'how many files', 'memory', 'free space', 'data'],
    categories: ['utilities', 'math'],
    path: 'StorageCalculator/storage-calculator.html',
    color: '#2dd4bf'
  },
  {
    id: 'download-time',
    name: 'Download Time Calculator',
    description: 'How long a file will take at a given connection speed.',
    tags: ['download', 'download time', 'speed', 'mbps', 'internet', 'file size', 'bandwidth', 'connection', 'upload', 'transfer', 'gb', 'network'],
    categories: ['utilities'],
    path: 'DownloadTime/download-time.html',
    color: '#60a5fa'
  },
  {
    id: 'chance-simulator',
    name: 'Chance Simulator',
    description: 'Theoretical probability vs. real randomized simulation results.',
    tags: ['chance', 'probability', 'odds', 'simulator', 'random', 'luck', 'percent', 'drop rate', 'trials', 'gacha', 'statistics', 'dice'],
    categories: ['random', 'math'],
    path: 'ChanceSimulator/chance-simulator.html',
    color: '#f472b6'
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Format, minify, and validate JSON, with helpful error locations.',
    tags: ['json', 'format', 'minify', 'validate', 'pretty print', 'beautify', 'developer', 'api', 'syntax', 'errors', 'data', 'parser'],
    categories: ['developer'],
    path: 'JsonFormatter/json-formatter.html',
    color: '#34d399'
  },
  {
    id: 'text-diff',
    name: 'Text Difference Tool',
    description: 'Compare two pieces of text and see exactly what changed.',
    tags: ['diff', 'compare', 'text', 'difference', 'changes', 'compare files', 'developer', 'merge', 'before after', 'edits', 'lines', 'code'],
    categories: ['developer'],
    path: 'TextDiff/text-diff.html',
    color: '#fbbf24'
  },
  {
    id: 'regex-tester',
    name: 'Regex Tester',
    description: 'Test regular expressions against text with live match highlighting.',
    tags: ['regex', 'regular expression', 'pattern', 'match', 'developer', 'test', 'highlight', 'capture groups', 'replace', 'string', 'flags', 'search'],
    categories: ['developer'],
    path: 'RegexTester/regex-tester.html',
    color: '#818cf8'
  },
  {
    id: 'how-many-x',
    name: 'How Many X?',
    description: 'A playful "how many of this fit into that" calculator, using your own units.',
    tags: ['how many', 'divide', 'fun', 'comparison', 'ratio', 'fit into', 'units', 'compare sizes', 'silly', 'custom units', 'math', 'random'],
    categories: ['random'],
    path: 'HowManyX/how-many-x.html',
    color: '#fb923c'
  },
  {
    id: 'link-tool',
    name: 'Link Tool',
    description: 'Keep a simple collection of useful links with names and descriptions.',
    tags: ['links', 'link', 'urls', 'url', 'bookmarks', 'websites', 'website', 'collection', 'favorites', 'save', 'list', 'organize'],
    categories: ['utilities'],
    path: 'LinkTool/link-tool.html',
    color: '#f97316'
  },
  {
    id: 'ccu-earnings',
    name: 'CCU Earnings Simulator',
    description: 'Rough estimate of daily/monthly earnings from a steady average CCU.',
    tags: ['ccu', 'concurrent users', 'players', 'earnings', 'robux', 'creator rewards', 'simulator', 'roblox', 'daily', 'monthly', 'income', 'estimate'],
    categories: ['roblox', 'finance'],
    path: 'CCUEarnings/ccu-earnings.html',
    color: '#e879f9'
  },
  {
    id: 'background-remover',
    name: 'Background Remover',
    description: 'Remove the background from a photo entirely in your browser — no uploads, no account.',
    tags: ['background', 'remove background', 'remove.bg', 'transparent', 'png', 'image', 'photo', 'cutout', 'editor', 'no upload', 'private', 'design'],
    categories: ['design', 'utilities'],
    path: 'BackgroundRemover/background-remover.html',
    color: '#2dd4bf',
    popular: true
  },
  {
    id: 'timers',
    name: 'Timers',
    description: 'Stopwatch, countdown timer, alarm, and a repeating interval loop (e.g. 90/20 min cycles).',
    tags: ['timer', 'stopwatch', 'alarm', 'countdown', 'interval', 'loop', 'pomodoro', 'laps', 'alarm clock', 'notifications', 'study', 'workout'],
    categories: ['utilities', 'health'],
    path: 'Timers/timers.html',
    color: '#fbbf24',
    popular: true
  },
  {
    id: 'timezone-chart',
    name: 'Timezone Comparison',
    description: 'Compare local time across timezones on one UTC-aligned timeline, with a reference-time alignment line.',
    tags: ['timezone', 'time zone', 'utc', 'world clock', 'meeting time', 'nzst', 'est', 'gmt', 'compare time', 'convert time', 'schedule', 'international'],
    categories: ['utilities'],
    path: 'TimezoneChart/timezone-chart.html',
    color: '#38bdf8'
  },
  {
    id: 'pattern-maker',
    name: 'Pattern Maker',
    description: 'Generative Sunburst and Halftone pattern tool with full control over shape, color, and variation — export SVG or PNG.',
    tags: ['sunburst', 'pattern', 'svg', 'generative', 'vector', 'rays', 'halftone', 'design', 'background', 'export png', 'art', 'wallpaper'],
    categories: ['design'],
    path: 'PatternMaker/pattern-maker.html',
    color: '#f6a623'
  },
  {
    id: 'currency-converter',
    name: 'Currency Converter',
    description: 'Convert between 270+ currencies: world money, precious metals, crypto and historical currencies like the German Mark.',
    tags: ['currency', 'exchange', 'exchange rate', 'convert', 'forex', 'fx', 'money', 'usd', 'eur', 'nzd', 'gbp', 'bitcoin', 'crypto', 'gold', 'silver'],
    categories: ['finance', 'utilities'],
    path: 'CurrencyConverter/currency-converter.html',
    color: '#14b8a6',
    popular: true
  },
  {
    id: 'robux-cost',
    name: 'Robux Cost Calculator',
    description: 'What it costs to buy any amount of Robux, or how many Robux your money gets you: cheapest pack mix, web vs. mobile, 150+ currencies.',
    tags: ['robux', 'buy robux', 'cost', 'price', 'purchase', 'packs', 'gift card', 'roblox', 'how much', 'budget', 'spend', 'local currency'],
    categories: ['roblox', 'finance'],
    path: 'RobuxCost/robux-cost.html',
    color: '#f87171',
    popular: false
  },
  {
    id: 'habit-tracker',
    name: 'Habit Tracker',
    description: 'Check off daily habits, hit weekly goals, keep streaks and watch your progress fill a calendar. Installable, works offline, syncs across devices.',
    tags: ['habit', 'habits', 'tracker', 'streak', 'routine', 'calendar', 'goals', 'daily', 'workout', 'check off', 'progress', 'reminders', 'sync'],
    categories: ['health', 'utilities'],
    path: 'HabitTracker/habit-tracker.html',
    color: '#a3e635',
    popular: true
  },
];