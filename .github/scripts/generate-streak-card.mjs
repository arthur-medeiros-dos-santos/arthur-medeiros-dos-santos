const owner = process.env.GITHUB_REPOSITORY_OWNER;
const token = process.env.GITHUB_TOKEN;
const outputPath = process.argv[2] ?? "dist/streak.svg";

if (!owner) {
  throw new Error("GITHUB_REPOSITORY_OWNER is required.");
}

if (!token) {
  throw new Error("GITHUB_TOKEN is required.");
}

const query = `
  query($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "profile-readme-streak-card",
  },
  body: JSON.stringify({ query, variables: { login: owner } }),
});

if (!response.ok) {
  throw new Error(`GitHub GraphQL request failed with ${response.status}.`);
}

const payload = await response.json();

if (payload.errors?.length) {
  throw new Error(payload.errors.map((error) => error.message).join("; "));
}

const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;

if (!calendar) {
  throw new Error(`Could not load contribution calendar for ${owner}.`);
}

const days = calendar.weeks
  .flatMap((week) => week.contributionDays)
  .sort((left, right) => left.date.localeCompare(right.date));

const todayIso = new Date().toISOString().slice(0, 10);
const streakDays = days.at(-1)?.date === todayIso && days.at(-1)?.contributionCount === 0
  ? days.slice(0, -1)
  : days;

let longestStreak = 0;
let currentStreak = 0;
let runningStreak = 0;

for (const day of streakDays) {
  if (day.contributionCount > 0) {
    runningStreak += 1;
    longestStreak = Math.max(longestStreak, runningStreak);
  } else {
    runningStreak = 0;
  }
}

currentStreak = runningStreak;

const totalContributions = calendar.totalContributions;
const today = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
}).format(new Date());

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const svg = `<svg width="450" height="150" viewBox="0 0 450 150" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(owner)} GitHub contribution streak</title>
  <desc id="desc">Current streak, longest streak, and total contributions.</desc>
  <rect width="450" height="150" rx="5" fill="#000000"/>
  <g font-family="Inter, Segoe UI, Arial, sans-serif" text-anchor="middle">
    <text x="98" y="50" fill="#FFB000" font-size="28" font-weight="700">${totalContributions}</text>
    <text x="98" y="82" fill="#FFB000" font-size="13">Total Contributions</text>
    <text x="98" y="108" fill="#FFFFFF" font-size="11">Last 12 months</text>

    <line x1="170" y1="26" x2="170" y2="124" stroke="#FFFFFF" stroke-width="1"/>
    <line x1="280" y1="26" x2="280" y2="124" stroke="#FFFFFF" stroke-width="1"/>

    <circle cx="225" cy="55" r="35" stroke="#FFB000" stroke-width="5"/>
    <text x="225" y="64" fill="#8B6DFF" font-size="28" font-weight="700">${currentStreak}</text>
    <text x="225" y="101" fill="#8B6DFF" font-size="13">Current Streak</text>
    <text x="225" y="124" fill="#FFFFFF" font-size="11">${escapeHtml(today)}</text>

    <text x="352" y="50" fill="#FFB000" font-size="28" font-weight="700">${longestStreak}</text>
    <text x="352" y="82" fill="#FFB000" font-size="13">Longest Streak</text>
    <text x="352" y="108" fill="#FFFFFF" font-size="11">Last 12 months</text>
  </g>
</svg>
`;

await import("node:fs/promises").then(async (fs) => {
  await fs.mkdir(outputPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  await fs.writeFile(outputPath, svg);
});
