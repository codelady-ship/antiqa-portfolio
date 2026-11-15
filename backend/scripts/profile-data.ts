// Profile content written by scripts/upsert-profile.ts. Every value here must come from a source the owner
// published or approved (sources are listed next to each field). Contact email stays empty on purpose.
// Validated with the same ProfileInput schema as PUT /api/profile before anything is written.

export const PROFILE = {
  // frontend/src/lib/seed.ts
  name: "Antiqa Cəlilova",
  initials: "AC",
  // LinkedIn headline "Backend Developer | Java 21 · Spring Boot 3 …"; current role Junior Full Stack Developer @ Aliyev Space
  // (LinkedIn, Oct 2026); React/Next.js and Node.js from seed.ts. The hero rotates these one at a time, so keep them short.
  roles: {
    az: ["Backend Developer", "Java 21 · Spring Boot 3", "Junior Full Stack Developer", "React & Next.js", "Node.js · Express"],
    en: ["Backend Developer", "Java 21 · Spring Boot 3", "Junior Full Stack Developer", "React & Next.js", "Node.js · Express"],
  },
  // backend focus (LinkedIn headline) + frontend stack (seed.ts, CV skills)
  tagline: {
    az: "Java və Spring Boot ilə etibarlı backend, React və Next.js ilə rahat interfeyslər qururam.",
    en: "I build reliable backends with Java and Spring Boot, and clean interfaces with React and Next.js.",
  },
  // LinkedIn: Junior Full Stack Developer @ Aliyev Space from Oct 2026. English CV (Backend Java, 2026-11-14): Masapay,
  // Java 21 / Spring Boot 3, PostgreSQL, Redis, WebSocket, tests, documentation-minded. seed.ts: Jet Academy MERN.
  // CV education: TexnoEra Academy backend training (Java, Spring Boot), 2025 – 2026.
  about: {
    az: "Backend yönümlü Full Stack developerəm. 2026-cı ilin oktyabrından Aliyev Space-də Junior Full Stack Developer kimi çalışıram: restoranlar üçün real vaxtda hesab bölmə və ödəniş platforması olan Masapay üzərində Java 21, Spring Boot 3, PostgreSQL, Redis və WebSocket ilə işləyirəm. Jet Academy-də Full Stack MERN proqramını bitirmişəm, TexnoEra Academy-də isə Java və Spring Boot üzrə backend təlimi keçirəm. Səliqəli REST API-lər, testlər və aydın sənədləşmə mənim üçün önəmlidir.",
    en: "I'm a backend-focused Full Stack developer. Since October 2026 I have been working as a Junior Full Stack Developer at Aliyev Space on Masapay, a real-time bill-splitting and payment platform for restaurants, using Java 21, Spring Boot 3, PostgreSQL, Redis and WebSocket. I completed the Full Stack MERN programme at Jet Academy and I'm in backend training (Java, Spring Boot) at TexnoEra Academy. I care about clean REST APIs, tests and clear documentation.",
  },
  // seed.ts; English CV header "Baku, Azerbaijan"
  location: { az: "Bakı, Azərbaycan", en: "Baku, Azerbaijan" },
  // seed.ts
  openToWork: true,
  // seed.ts (minus Python, which no CV or the old portfolio lists) + English CV skills section.
  // The home marquee shows the first 10.
  skills: [
    "Java",
    "Spring Boot",
    "PostgreSQL",
    "Redis",
    "TypeScript",
    "React",
    "Next.js",
    "Node.js",
    "Express.js",
    "MongoDB",
    "Spring Security",
    "REST API",
    "WebSocket",
    "Docker",
    "JUnit 5",
    "GitHub Actions",
    "JavaScript",
    "Tailwind CSS",
    "Three.js",
    "MS SQL",
    "Git",
  ],
  // English CV "Education & Training"; the Jet Academy period is from seed.ts and the old portfolio (09.2024 – 05.2025)
  education: [
    {
      title: { az: "Backend təlimi (Java, Spring Boot)", en: "Backend Development Training (Java, Spring Boot)" },
      place: "TexnoEra Academy",
      period: "2025 – 2026",
    },
    {
      title: { az: "Full Stack MERN proqramı", en: "Full Stack MERN Programme" },
      place: "Jet Academy",
      period: "09.2024 – 05.2025",
    },
    {
      title: { az: "Magistr, Ətraf mühitin mühafizəsi və neft sənayesi", en: "MSc, Environmental Protection and Oil Industry" },
      place: "Azerbaijan State Oil and Industry University",
      period: "2021 – 2023",
    },
    {
      title: { az: "Bakalavr, Kimya və biologiya müəllimliyi", en: "BSc, Chemistry and Biology Teaching" },
      place: "Ganja State University",
      period: "2016 – 2021",
    },
  ],
  // owner-approved values; email intentionally empty until the owner decides
  contacts: {
    email: "",
    phone: "+994 70 523 99 28",
    whatsapp: "994705239928",
    telegram: "",
    linkedin: "https://www.linkedin.com/in/entiqe-celilova-138969208",
    github: "https://github.com/codelady-ship",
    instagram: "codelady.abroad",
  },
};

/** CV PDFs (stored under their file name, like the admin upload). Only the already-public AZ CV is in the repo;
 *  pass other paths with --cv-az / --cv-en. An empty path skips that language. */
export const CV_DEFAULTS: Record<"az" | "en", string> = {
  az: "../frontend/public/cv-az.pdf",
  en: "",
};
