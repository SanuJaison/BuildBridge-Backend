const AdminAuditLog = require("../models/AdminAuditLog");

async function recordAudit(req, action, targetType = "", targetId = "", details = "") {
  await AdminAuditLog.create({
    admin: req.user._id,
    action,
    targetType,
    targetId: String(targetId || ""),
    details,
    ip: req.ip || "",
  });
}

module.exports = { recordAudit };
