const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { schemaOptions } = require("./plugins");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
    },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ["customer", "provider", "admin"], default: "customer", index: true },
    avatar: { type: String, default: "" },
    phone: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    bio: { type: String, trim: true, maxlength: 600, default: "" },
    website: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    suspensionReason: { type: String, default: "" },
    emailNotifications: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    resetPasswordHash: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    isDemo: { type: Boolean, default: false },
  },
  schemaOptions
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
