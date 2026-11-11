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
    contacts: {
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      whatsapp: { type: String, default: "" },
      telegram: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },
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
    featured: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
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
