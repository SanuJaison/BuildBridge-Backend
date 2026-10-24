const Message = require("../models/Message");
const Inquiry = require("../models/Inquiry");
const { inquiryAccess } = require("./inquiryAccess");

async function addSystemMessage(conversation, body, readBy = []) {
  if (!conversation) return null;
  const message = await Message.create({
    conversation: conversation._id,
    body,
    system: true,
    readBy,
  });
  conversation.lastMessageText = body;
  conversation.lastMessageAt = new Date();
  conversation.lastMessageSender = null;
  await conversation.save();
  return message;
}

async function conversationAccess(conversation, user) {
  if (!user || !conversation) return false;
  const isParticipant = (conversation.participants || []).some(
    (participant) => String(participant._id || participant) === String(user._id)
  );
  if (isParticipant) return true;
  if (!conversation.inquiry) return false;
  const inquiryId = conversation.inquiry._id || conversation.inquiry;
  const inquiry = await Inquiry.findById(inquiryId).select("customer provider providerUser");
  if (!inquiry) return false;
  return Boolean(await inquiryAccess(inquiry, user));
}

module.exports = { addSystemMessage, conversationAccess };
