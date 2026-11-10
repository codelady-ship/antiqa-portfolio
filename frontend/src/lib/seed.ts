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

export const SEED_REPOS: { url: string; featured?: boolean; backend?: string; title?: string; demo?: string }[] = [
  { url: "https://github.com/codelady-ship/planera", featured: true, title: "Planera — Randevum", demo: "https://randevum-seven.vercel.app" },
  { url: "https://github.com/codelady-ship/Ecommerse-app", featured: true, title: "E-Commerce App", demo: "https://codelady-ship.github.io/Ecommerse-app/" },
  { url: "https://github.com/codelady-ship/my-portfolio", title: "Portfolio v1 (React + Three.js)", demo: "https://my-portfolio-eta-mocha-32.vercel.app", backend: "https://github.com/codelady-ship/backend-for-my-portfolio" },
  { url: "https://github.com/codelady-ship/React-Routing-task4", title: "React Routing", demo: "https://codelady-ship.github.io/React-Routing-task4/" },
  { url: "https://github.com/codelady-ship/exam-task-react", title: "React Exam Project", demo: "https://codelady-ship.github.io/exam-task-react/" },
  { url: "https://github.com/codelady-ship/basic-task-with-Html-Css-Js", title: "Actify — Habit Tracker", demo: "https://codelady-ship.github.io/basic-task-with-Html-Css-Js/" },
  { url: "https://github.com/codelady-ship/Food-Wagon-delivery-figma", title: "Food Wagon", demo: "https://codelady-ship.github.io/Food-Wagon-delivery-figma/foodvaqon.html" },
  { url: "https://github.com/codelady-ship/net-pro-group-fiqma", title: "Net Pro Group", demo: "https://codelady-ship.github.io/net-pro-group-fiqma/netprogroup.html" },
  { url: "https://github.com/codelady-ship/AFN-rent-a-car-fiqma", title: "AFN Rent a Car", demo: "https://codelady-ship.github.io/AFN-rent-a-car-fiqma/rentacar.html" },
  { url: "https://github.com/codelady-ship/hello-fresh", title: "Hello Fresh", demo: "https://codelady-ship.github.io/hello-fresh/hellofresh.html" },
  { url: "https://github.com/codelady-ship/fiqma6-responsivlik-task", title: "Responsive Landing", demo: "https://codelady-ship.github.io/fiqma6-responsivlik-task/fiqma6.html" },
  { url: "https://github.com/codelady-ship/rock-paper-scissors", title: "Rock Paper Scissors", demo: "https://codelady-ship.github.io/rock-paper-scissors/RockPaperScissors.html" },
  { url: "https://github.com/codelady-ship/My-Fitness-App", title: "Fitness App" },
  { url: "https://github.com/codelady-ship/task7-front-end-for-task6-", title: "Fullstack Habit Tracker", backend: "https://github.com/codelady-ship/task6.mongodb" },
];
