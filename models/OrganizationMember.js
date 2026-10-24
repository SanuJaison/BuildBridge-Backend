const mongoose = require("mongoose");
const { schemaOptions } = require("./plugins");

const organizationMemberSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
    status: { type: String, enum: ["invited", "active", "removed"], default: "active" },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    joinedAt: { type: Date },
  },
  schemaOptions
);

organizationMemberSchema.index({ organization: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("OrganizationMember", organizationMemberSchema);
