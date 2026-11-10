import type { Profile } from "./types";

/**
 * Used only when API_URL is not set (local dev before MongoDB exists, or if the API is down).
 * In production the admin panel edits the same data in MongoDB.
 */
export const SEED_PROFILE: Profile = {
  name: "Antiqa Cəlilova",
  initials: "AC",
  roles: {
    az: ["Full Stack Developer", "MERN Stack Developer", "React & Next.js", "Node.js Backend"],
    en: ["Full Stack Developer", "MERN Stack Developer", "React & Next.js", "Node.js Backend"],
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
  openToWork: true,
  skills: ["JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Express.js", "MongoDB", "Tailwind CSS", "Three.js", "Java", "Spring Boot", "Python", "Git"],
  education: [
    {
      title: { az: "Full Stack MERN proqramı", en: "Full Stack MERN Programme" },
      place: "Jet Academy",
      period: "09.2024 – 05.2025",
    },
  ],
  contacts: {
    email: "",
    phone: "+994 70 523 99 28",
    whatsapp: "994705239928",
    telegram: "",
    linkedin: "https://www.linkedin.com/in/entiqe-celilova-138969208",
    github: "https://github.com/codelady-ship",
    instagram: "codelady.abroad",
  },
  cv: { az: "/cv-az.pdf" },
};

export const SEED_REPOS: { url: string; featured?: boolean; backend?: string; title?: string }[] = [
  { url: "https://github.com/codelady-ship/planera", featured: true, title: "Planera — Randevum" },
  { url: "https://github.com/codelady-ship/Ecommerse-app", featured: true, title: "E-Commerce App" },
  { url: "https://github.com/codelady-ship/my-portfolio", title: "Portfolio v1 (React + Three.js)", backend: "https://github.com/codelady-ship/backend-for-my-portfolio" },
  { url: "https://github.com/codelady-ship/React-Routing-task4", title: "React Routing" },
  { url: "https://github.com/codelady-ship/exam-task-react", title: "React Exam Project" },
  { url: "https://github.com/codelady-ship/basic-task-with-Html-Css-Js", title: "Actify — Habit Tracker" },
  { url: "https://github.com/codelady-ship/Food-Wagon-delivery-figma", title: "Food Wagon" },
  { url: "https://github.com/codelady-ship/net-pro-group-fiqma", title: "Net Pro Group" },
  { url: "https://github.com/codelady-ship/AFN-rent-a-car-fiqma", title: "AFN Rent a Car" },
  { url: "https://github.com/codelady-ship/hello-fresh", title: "Hello Fresh" },
  { url: "https://github.com/codelady-ship/fiqma6-responsivlik-task", title: "Responsive Landing" },
  { url: "https://github.com/codelady-ship/rock-paper-scissors", title: "Rock Paper Scissors" },
  { url: "https://github.com/codelady-ship/My-Fitness-App", title: "Fitness App" },
  { url: "https://github.com/codelady-ship/task7-front-end-for-task6-", title: "Fullstack Habit Tracker", backend: "https://github.com/codelady-ship/task6.mongodb" },
];
