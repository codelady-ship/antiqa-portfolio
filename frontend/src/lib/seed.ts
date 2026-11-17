import type { Profile } from "./types";

/**
 * Used only when API_URL is not set (local dev before MongoDB exists, or if the API is down).
 * In production the admin panel edits the same data in MongoDB.
 */
export const SEED_PROFILE: Profile = {
  name: "Antiqa Cəlilova",
  initials: "AC",
  roles: {
    az: ["Full Stack Developer", "Backend Developer", "Java 21 · Spring Boot 3", "React & Next.js", "Node.js · Express"],
    en: ["Full Stack Developer", "Backend Developer", "Java 21 · Spring Boot 3", "React & Next.js", "Node.js · Express"],
  },
  tagline: {
    az: "Zərif interfeyslər və etibarlı backend — insanların sevərək istifadə etdiyi veb tətbiqlər qururam.",
    en: "Elegant interfaces and reliable backends — I build web apps people enjoy using.",
  },
  about: {
    az: "Veb texnologiyalarına və rəqəmsal alətlərə böyük maraq duyan Full Stack developerəm. Jet Academy-də Full Stack MERN proqramını bitirmişəm: MongoDB, Express, React və Node.js ilə tam funksional tətbiqlər və RESTful API-lər qurmuşam. Məqsədim fərq yaradan, rahat istifadə olunan məhsullar hazırlamaqdır.",
    en: "I'm a Full Stack developer with a deep interest in web technologies and digital tools. I completed the Full Stack MERN programme at Jet Academy, building full web applications and RESTful APIs with MongoDB, Express, React and Node.js. My goal is to ship useful, user-friendly products that make a difference.",
  },
  location: { az: "Bakı, Azərbaycan", en: "Baku, Azerbaijan" },
  // owner decision 2026-11-15: no "open to work" badge (she works at Aliyev Space)
  openToWork: false,
  skills: ["JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express.js", "MongoDB", "Tailwind CSS", "Three.js", "Java", "Spring Boot", "Python", "Git"],
  education: [
    {
      title: { az: "Java Spring Boot kursu (6 ay)", en: "Java Spring Boot course (6 months)" },
      place: "TexnoEra Academy",
      period: "2025 – 2026",
    },
    {
      title: { az: "Full Stack MERN proqramı", en: "Full Stack MERN Programme" },
      place: "Jet Academy",
      period: "09.2024 – 05.2025",
    },
  ],
  // same as backend/scripts/profile-data.ts (from the CVs)
  experience: [
    {
      title: { az: "Junior Full Stack Developer", en: "Junior Full Stack Developer" },
      place: "Aliyev Space",
      period: { az: "Oktyabr 2026 – indiyədək", en: "Oct 2026 – Present" },
      summary: {
        az: "masapay — restoranlar üçün QR əsaslı, real vaxtda hesab bölmə və ödəniş platforması. Java 21, Spring Boot 3, PostgreSQL, Redis, WebSocket.",
        en: "masapay — a QR-based, real-time bill-splitting and payment platform for restaurants. Java 21, Spring Boot 3, PostgreSQL, Redis, WebSocket.",
      },
    },
    {
      title: { az: "Full Stack Developer və Backend Developer təcrübəçisi", en: "Full Stack Developer & Backend Developer Intern" },
      place: "TexnoEra Academy",
      period: { az: "Oktyabr 2025 – indiyədək", en: "Oct 2025 – Present" },
      summary: {
        az: "Kurs İdarəetmə Sisteminin (Java, Spring Boot, MS SQL) backend hissəsinin təxminən 35%-ni hazırlamışam; buraxılış layihəsi olaraq full-stack təlim platforması qurmuşam.",
        en: "Built about 35% of the backend of a Course Management System (Java, Spring Boot, MS SQL); capstone: a full-stack training platform.",
      },
    },
  ],
  contacts: {
    email: "jalilova.antiqa@gmail.com",
    phone: "+994 70 523 99 28",
    whatsapp: "994705239928",
    telegram: "",
    linkedin: "https://www.linkedin.com/in/entiqe-celilova-138969208",
    github: "https://github.com/codelady-ship",
    instagram: "codelady.abroad",
  },
  // fallback copies of backend/cv/*.pdf; the API CVs (admin upload / upsert-profile) win when present
  cv: { az: "/Antiqa_Calilova_CV_AZ.pdf", en: "/Antiqa_Calilova_CV_EN.pdf" },
};

export const SEED_REPOS: { url: string; featured?: boolean; backend?: string; title?: string; demo?: string; links?: { label: string; url: string }[]; thumb?: false }[] = [
  { url: "https://github.com/codelady-ship/hypedomino", featured: true, title: "HypeDomino" },
  { url: "https://github.com/codelady-ship/masapay", featured: true, title: "masapay" },
  {
    url: "https://github.com/codelady-ship/codelady-skills",
    featured: true,
    title: "Codelady Skills",
    demo: "https://codelady-ship.github.io/codelady-skills/az/",
    links: [],
  },
  { url: "https://github.com/codelady-ship/planera", featured: true, title: "Planera — Randevum", demo: "https://randevum-seven.vercel.app" },
  { url: "https://github.com/codelady-ship/Ecommerse-app", featured: true, title: "E-Commerce App", demo: "https://codelady-ship.github.io/Ecommerse-app/", thumb: false },
  { url: "https://github.com/codelady-ship/my-portfolio", title: "Portfolio v1 (React + Three.js)", demo: "https://my-portfolio-eta-mocha-32.vercel.app", backend: "https://github.com/codelady-ship/backend-for-my-portfolio" },
  { url: "https://github.com/codelady-ship/React-Routing-task4", title: "React Routing", demo: "https://codelady-ship.github.io/React-Routing-task4/", thumb: false },
  { url: "https://github.com/codelady-ship/exam-task-react", title: "React Exam Project", demo: "https://codelady-ship.github.io/exam-task-react/" },
  { url: "https://github.com/codelady-ship/basic-task-with-Html-Css-Js", title: "Actify — Habit Tracker", demo: "https://codelady-ship.github.io/basic-task-with-Html-Css-Js/" },
  { url: "https://github.com/codelady-ship/Food-Wagon-delivery-figma", title: "Food Wagon", demo: "https://codelady-ship.github.io/Food-Wagon-delivery-figma/foodvaqon.html", thumb: false },
  { url: "https://github.com/codelady-ship/net-pro-group-fiqma", title: "Net Pro Group", demo: "https://codelady-ship.github.io/net-pro-group-fiqma/netprogroup.html" },
  { url: "https://github.com/codelady-ship/AFN-rent-a-car-fiqma", title: "AFN Rent a Car", demo: "https://codelady-ship.github.io/AFN-rent-a-car-fiqma/rentacar.html" },
  { url: "https://github.com/codelady-ship/hello-fresh", title: "Hello Fresh", demo: "https://codelady-ship.github.io/hello-fresh/hellofresh.html" },
  { url: "https://github.com/codelady-ship/fiqma6-responsivlik-task", title: "Responsive Landing", demo: "https://codelady-ship.github.io/fiqma6-responsivlik-task/fiqma6.html" },
  { url: "https://github.com/codelady-ship/rock-paper-scissors", title: "Rock Paper Scissors", demo: "https://codelady-ship.github.io/rock-paper-scissors/RockPaperScissors.html" },
  { url: "https://github.com/codelady-ship/My-Fitness-App", title: "Fitness App" },
  { url: "https://github.com/codelady-ship/task7-front-end-for-task6-", title: "Fullstack Habit Tracker", backend: "https://github.com/codelady-ship/task6.mongodb", thumb: false },
];

/** Repos whose live site screenshots as a blank page (SPA loading screen, empty first view): the card shows a pastel initial tile instead. */
const NO_THUMB = new Set(SEED_REPOS.filter((s) => s.thumb === false).map((s) => s.url.toLowerCase()));
export const hasThumb = (repoUrl: string) => !NO_THUMB.has(repoUrl.replace(/\/$/, "").toLowerCase());
