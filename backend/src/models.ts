import mongoose, { Schema, type InferSchemaType } from "mongoose";

const localized = { az: { type: String, default: "" }, en: { type: String, default: "" } };

const ProfileSchema = new Schema(
  {
    _id: { type: String, default: "main" },
    name: { type: String, default: "" },
    initials: { type: String, default: "" },
    roles: { az: [String], en: [String] },
    tagline: localized,
    about: localized,
    location: localized,
    openToWork: { type: Boolean, default: true },
    skills: [String],
    education: [{ title: localized, place: String, period: String }],
    // work experience, newest first (shown above education; JSON-LD worksFor / hasOccupation)
    experience: [{ _id: false, title: localized, place: String, period: localized, summary: localized }],
    contacts: {
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      whatsapp: { type: String, default: "" },
      telegram: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },
    // other socials the owner adds in the admin panel (YouTube, X, Behance, …): shown in Contact and About
    socials: { type: [{ _id: false, label: { type: String, default: "" }, url: { type: String, default: "" } }], default: [] },
  },
  { timestamps: true },
);

const ProjectSchema = new Schema(
  {
    repoUrl: { type: String, required: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    // owner overrides (empty = use GitHub data)
    title: { type: String, default: "" },
    summary: localized,
    demoOverride: { type: String, default: "" },
    backendUrl: { type: String, default: "" },
    // the project's own admin panel (https), shown as an "Admin" tab in the project modal
    adminUrl: { type: String, default: "" },
    // one line under it, ONLY for demo-mode admins (e.g. a public demo login); never real credentials
    adminHint: { type: String, default: "" },
    // set when adminUrl is saved/synced: the panel refuses to be framed (X-Frame-Options /
    // CSP frame-ancestors), so the modal offers "open in a new tab" instead of a blank frame
    adminNoFrame: { type: Boolean, default: false },
    // the same for the live demo (the computed live link: override, homepage or GitHub Pages)
    demoNoFrame: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    // shown on the project belt of the home page (a real full-stack project, not a practice task);
    // no default: unset = the site decides from its own list until the seed script has run
    fullStack: { type: Boolean },
    order: { type: Number, default: 0 },
    // "coming soon" badge instead of a live link (a project that is not deployed yet)
    comingSoon: { type: Boolean, default: false },
    // the live link is dead: show the project as code-only (no demo button, no preview)
    demoOff: { type: Boolean, default: false },
    // set by sync from GitHub: a private repo never shows its code link or README on the site
    privateRepo: { type: Boolean, default: false },
    // extra links shown on the card (e.g. related repos)
    links: { type: [{ _id: false, label: { type: String, default: "" }, url: { type: String, default: "" } }], default: [] },
    // GitHub snapshot
    gh: {
      url: String,
      description: String,
      homepage: String,
      hasPages: Boolean,
      createdAt: Date,
      pushedAt: Date,
      stars: Number,
      forks: Number,
      topics: [String],
      license: String,
      defaultBranch: String,
      languages: [{ _id: false, name: String, percent: Number }],
      readmeHtml: String,
    },
    syncedAt: Date,
    syncError: { type: String, default: "" },
  },
  { timestamps: true },
);
ProjectSchema.index({ owner: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

const CvSchema = new Schema(
  {
    _id: { type: String, enum: ["az", "en"] },
    fileName: String,
    mime: { type: String, default: "application/pdf" },
    data: Buffer,
    size: Number,
  },
  { timestamps: true },
);

export type ProfileDoc = InferSchemaType<typeof ProfileSchema>;
export type ProjectDoc = InferSchemaType<typeof ProjectSchema> & { _id: mongoose.Types.ObjectId };

export const Profile = mongoose.models.Profile || mongoose.model("Profile", ProfileSchema);
export const Project = mongoose.models.Project || mongoose.model("Project", ProjectSchema);
export const Cv = mongoose.models.Cv || mongoose.model("Cv", CvSchema);

const LoginAttemptSchema = new Schema({ _id: String, n: { type: Number, default: 0 }, expireAt: { type: Date, required: true } });
LoginAttemptSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });
export const LoginAttempt = mongoose.models.LoginAttempt || mongoose.model("LoginAttempt", LoginAttemptSchema);

let connecting: Promise<typeof mongoose> | null = null;
/** Reuses one connection across serverless invocations. */
export function connectDb() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose);
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  connecting ??= mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 }).catch((e) => {
    connecting = null;
    throw e;
  });
  return connecting;
}
