export type L10n = { az: string; en: string };

export type Profile = {
  name: string;
  initials: string;
  roles: { az: string[]; en: string[] };
  tagline: L10n;
  about: L10n;
  location: L10n;
  openToWork: boolean;
  skills: string[];
  education: { title: L10n; place: string; period: string }[];
  contacts: {
    email: string;
    phone: string;
    whatsapp: string;
    telegram: string;
    linkedin: string;
    github: string;
    instagram: string;
  };
  cv: Partial<Record<"az" | "en", string>>;
};

export type Project = {
  id: string;
  owner: string;
  name: string;
  title: string;
  summary: L10n;
  description: string;
  repoUrl: string;
  backendUrl: string | null;
  demoUrl: string | null;
  createdAt: string | null;
  pushedAt: string | null;
  stars: number;
  forks: number;
  topics: string[];
  license: string | null;
  languages: { name: string; percent: number }[];
  featured: boolean;
  /** extra repos/links shown on the card and in the demo modal (e.g. a project made of several repos) */
  links?: { label: string; url: string }[];
  /** admin order: higher comes first (after featured); 0 when not set */
  order?: number;
};
