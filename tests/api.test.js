process.env.NODE_ENV = "test";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { after, before, describe, test } = require("node:test");
const mongoose = require("mongoose");
const request = require("supertest");

const env = require("../config/env");
const { createApp } = require("../app");
const { signToken } = require("../utils/tokens");
const Category = require("../models/Category");
const ProviderProfile = require("../models/ProviderProfile");
const Upload = require("../models/Upload");
const User = require("../models/User");

function deriveTestUri(uri) {
  const parsed = new URL(uri);
  const database = (parsed.pathname || "").replace(/^\//, "");
  if (database.endsWith("_test")) return uri;
  parsed.pathname = `/${database || "buildbridge"}_test`;
  return parsed.toString();
}

const TEST_MONGO_URI = deriveTestUri(env.mongoUri);
const CUSTOMER_PASSWORD = "Customer@12345";
const PROVIDER_PASSWORD = "Provider@12345";

let app;
let category;
let subcategory;
let admin;
let adminToken;
let providerOne;
let providerOneUser;
let providerOneToken;
let providerTwo;
let providerTwoUser;
let providerTwoToken;
let customerOne;
let customerTwo;
let inquiryId;
let reviewId;
const uploadedFiles = [];

function as(token) {
  return { Authorization: `Bearer ${token}` };
}

function text(length) {
  return "x".repeat(length);
}

async function registerCustomer(name, email) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ name, email, password: CUSTOMER_PASSWORD, role: "customer" });
  assert.equal(response.status, 201, response.text);
  return {
    id: response.body.user.id,
    email,
    token: response.body.token,
  };
}

async function registerProviderUser(name, email, displayName, slug) {
  const user = await User.create({
    name,
    email,
    password: PROVIDER_PASSWORD,
    role: "provider",
  });
  const profile = await ProviderProfile.create({
    user: user._id,
    type: "freelancer",
    displayName,
    slug,
    headline: `${displayName} headline`,
    bio: text(140),
    primaryCategory: category._id,
    skills: ["React", "Node.js"],
    location: "Remote",
    status: "published",
  });
  return { user, profile, token: signToken(user) };
}

async function createInquiry(title) {
  const response = await request(app)
    .post("/api/inquiries")
    .set(as(customerOne.token))
    .send({
      providerId: String(providerOne._id),
      category: String(category._id),
      subcategory: String(subcategory._id),
      title,
      description:
        "Our team needs a complete integration-tested engagement covering discovery, delivery and handover.",
      budgetMin: 2000,
      budgetMax: 5000,
      timeline: "4 weeks",
      communicationPreference: "in_app",
    });
  assert.equal(response.status, 201, response.text);
  return response.body.inquiry.id || response.body.inquiry._id;
}

describe("BuildBridge API integration", () => {
  before(async () => {
    await mongoose.connect(TEST_MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    assert.ok(
      mongoose.connection.name.endsWith("_test"),
      `Refusing to run against non-test database "${mongoose.connection.name}"`
    );
    await mongoose.connection.dropDatabase();
    app = createApp();

    category = await Category.create({
      name: "Integration Testing",
      slug: "integration-testing",
      description: "Category used by the automated API suite.",
      icon: "code",
      isActive: true,
    });
    subcategory = await Category.create({
      name: "API Automation",
      slug: "api-automation",
      parent: category._id,
      isActive: true,
    });

    admin = await User.create({
      name: "Integration Admin",
      email: "integration.admin@buildbridge.test",
      password: "AdminTest@12345",
      role: "admin",
    });
    adminToken = signToken(admin);

    const first = await registerProviderUser(
      "Provider One",
      "provider.one@buildbridge.test",
      "Test Provider One",
      "test-provider-one"
    );
    providerOneUser = first.user;
    providerOne = first.profile;
    providerOneToken = first.token;

    const second = await registerProviderUser(
      "Provider Two",
      "provider.two@buildbridge.test",
      "Test Provider Two",
      "test-provider-two"
    );
    providerTwoUser = second.user;
    providerTwo = second.profile;
    providerTwoToken = second.token;

    customerOne = await registerCustomer("Customer One", "customer.one@buildbridge.test");
    customerTwo = await registerCustomer("Customer Two", "customer.two@buildbridge.test");
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      assert.ok(mongoose.connection.name.endsWith("_test"), "Test cleanup target was not a test database");
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
    for (const storedName of uploadedFiles) {
      try {
        fs.unlinkSync(path.join(env.uploadDir, storedName));
      } catch {
        // The file was already removed by the endpoint under test.
      }
    }
  });

  test("public signup cannot create an administrator", async () => {
    const beforeCount = await User.countDocuments({ role: "admin" });
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Privilege Escalation",
        email: "privilege.escalation@buildbridge.test",
        password: "Escalate@12345",
        role: "admin",
      })
      .expect(400);

    assert.match(response.body.message, /highlighted fields/i);
    assert.equal(await User.countDocuments({ role: "admin" }), beforeCount);
    assert.equal(await User.exists({ email: "privilege.escalation@buildbridge.test" }), null);
  });

  test("registers a customer with a signed token and HttpOnly cookie", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Session User",
        email: "session.user@buildbridge.test",
        password: "SessionUser@12345",
        role: "customer",
      })
      .expect(201);

    assert.ok(response.body.token);
    assert.equal(response.body.user.email, "session.user@buildbridge.test");
    assert.equal(response.body.user.role, "customer");

    const cookies = [].concat(response.headers["set-cookie"] || []);
    assert.ok(
      cookies.some((cookie) => cookie.startsWith("bb_token=") && /HttpOnly/i.test(cookie)),
      "Expected an HttpOnly bb_token cookie"
    );

    await request(app).get("/api/auth/me").expect(401);
    const me = await request(app).get("/api/auth/me").set(as(response.body.token)).expect(200);
    assert.equal(me.body.user.email, "session.user@buildbridge.test");
    assert.equal(me.body.user.password, undefined);
  });

  test("rejects incorrect credentials and completes a password reset", async () => {
    const email = "password.reset@buildbridge.test";
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Password Reset", email, password: "OriginalPassword@1", role: "customer" })
      .expect(201);

    await request(app)
      .post("/api/auth/login")
      .send({ email, password: "WrongPassword@1" })
      .expect(401);

    const forgot = await request(app).post("/api/auth/forgot-password").send({ email }).expect(200);
    assert.ok(forgot.body.devResetToken, "Test environment should expose the reset token");

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: forgot.body.devResetToken, password: "ReplacementPassword@1" })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({ email, password: "OriginalPassword@1" })
      .expect(401);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "ReplacementPassword@1" })
      .expect(200);
    assert.ok(login.body.token);
  });

  test("enforces administrator-only areas and protects administrator accounts", async () => {
    await request(app).get("/api/admin/stats").set(as(customerOne.token)).expect(403);
    await request(app).get("/api/admin/stats").expect(401);

    const stats = await request(app).get("/api/admin/stats").set(as(adminToken)).expect(200);
    assert.ok(stats.body.counts);
    assert.equal(typeof stats.body.counts.customers, "number");

    const selfEdit = await request(app)
      .patch(`/api/admin/users/${admin._id}`)
      .set(as(adminToken))
      .send({ status: "suspended" })
      .expect(403);
    assert.match(selfEdit.body.message, /Administrator accounts/i);
    assert.equal((await User.findById(admin._id)).status, "active");

    const audit = await request(app).get("/api/admin/audit-logs").set(as(adminToken)).expect(200);
    assert.ok(Array.isArray(audit.body.items));
  });

  test("blocks publishing an incomplete provider profile", async () => {
    const registration = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Incomplete Provider",
        email: "incomplete.provider@buildbridge.test",
        password: "Incomplete@12345",
        role: "provider",
        providerType: "freelancer",
      })
      .expect(201);

    assert.equal(registration.body.user.role, "provider");
    assert.equal(registration.body.providerProfile.status, "draft");

    const publish = await request(app)
      .post("/api/provider/publish")
      .set(as(registration.body.token))
      .expect(400);
    assert.match(publish.body.message, /profile|publish|complete|headline|bio|category|skills|location/i);
  });

  test("serves public marketplace data and platform settings", async () => {
    const settings = await request(app).get("/api/settings/public").expect(200);
    assert.equal(typeof settings.body.branding.siteName, "string");

    const providers = await request(app).get("/api/providers").expect(200);
    assert.ok(providers.body.items.some((item) => item.slug === "test-provider-one"));
    assert.equal(providers.body.total >= 2, true);

    const detail = await request(app).get("/api/providers/test-provider-one").expect(200);
    assert.equal(detail.body.provider.displayName, "Test Provider One");
    assert.equal(detail.body.isSaved, false);
    assert.equal(detail.body.provider.status, "published");

    await request(app).get("/api/providers/not-a-real-provider").expect(404);
  });

  test("lets an administrator update branding settings", async () => {
    const current = await request(app).get("/api/admin/settings").set(as(adminToken)).expect(200);
    const branding = { ...current.body.branding, siteName: "BuildBridge Test Suite" };
    const saved = await request(app)
      .put("/api/admin/settings")
      .set(as(adminToken))
      .send(branding)
      .expect(200);
    assert.equal(saved.body.branding.siteName, "BuildBridge Test Suite");

    const publicSettings = await request(app).get("/api/settings/public").expect(200);
    assert.equal(publicSettings.body.branding.siteName, "BuildBridge Test Suite");

    await request(app)
      .put("/api/admin/settings")
      .set(as(customerOne.token))
      .send(branding)
      .expect(403);
  });

  test("runs the inquiry and proposal workflow with ownership checks", async () => {
    inquiryId = await createInquiry("Integration workflow for a web platform");

    const otherCustomer = await request(app)
      .get(`/api/inquiries/${inquiryId}`)
      .set(as(customerTwo.token))
      .expect(403);
    assert.match(otherCustomer.body.message, /access/i);

    await request(app)
      .post(`/api/inquiries/${inquiryId}/proposals`)
      .set(as(providerTwoToken))
      .send({
        message: "This proposal comes from a provider who was never invited to this inquiry.",
        estimatedCost: 1500,
        timelineDays: 7,
      })
      .expect(403);

    await request(app)
      .patch(`/api/inquiries/${inquiryId}/status`)
      .set(as(customerOne.token))
      .send({ status: "in_discussion" })
      .expect(403);

    await request(app)
      .patch(`/api/inquiries/${inquiryId}/status`)
      .set(as(customerOne.token))
      .send({ status: "completed" })
      .expect(400);

    const discussion = await request(app)
      .patch(`/api/inquiries/${inquiryId}/status`)
      .set(as(providerOneToken))
      .send({ status: "in_discussion" })
      .expect(200);
    assert.equal(discussion.body.inquiry.status, "in_discussion");

    const proposalResponse = await request(app)
      .post(`/api/inquiries/${inquiryId}/proposals`)
      .set(as(providerOneToken))
      .send({
        message: "We can deliver this engagement in four weeks with weekly demos and a documented handover.",
        estimatedCost: 4200,
        timelineDays: 28,
        deliverables: ["Discovery workshop", "Production build", "Handover documentation"],
      })
      .expect(201);
    const proposalId = proposalResponse.body.proposal.id;
    assert.ok(proposalId);
    assert.equal(proposalResponse.body.proposal.status, "sent");

    const duplicate = await request(app)
      .post(`/api/inquiries/${inquiryId}/proposals`)
      .set(as(providerOneToken))
      .send({
        message: "A duplicate proposal must not be allowed while one is still awaiting a response.",
        estimatedCost: 4000,
        timelineDays: 30,
      })
      .expect(400);
    assert.match(duplicate.body.message, /current state/i);

    await request(app)
      .post(`/api/proposals/${proposalId}/accept`)
      .set(as(customerTwo.token))
      .expect(403);

    const accepted = await request(app)
      .post(`/api/proposals/${proposalId}/accept`)
      .set(as(customerOne.token))
      .expect(200);
    assert.equal(accepted.body.proposal.status, "accepted");
    assert.equal(accepted.body.inquiry.status, "accepted");

    const earlyReview = await request(app)
      .post("/api/reviews")
      .set(as(customerOne.token))
      .send({
        inquiryId,
        rating: 5,
        comment: "This review is submitted before the engagement is marked complete.",
      })
      .expect(400);
    assert.match(earlyReview.body.message, /complete/i);

    await request(app)
      .patch(`/api/inquiries/${inquiryId}/status`)
      .set(as(providerOneToken))
      .send({ status: "completed" })
      .expect(403);

    const completed = await request(app)
      .patch(`/api/inquiries/${inquiryId}/status`)
      .set(as(customerOne.token))
      .send({ status: "completed" })
      .expect(200);
    assert.equal(completed.body.inquiry.status, "completed");
  });

  test("supports proposal withdrawal, resend and decline", async () => {
    const secondInquiry = await createInquiry("Second engagement for proposal state transitions");

    const sent = await request(app)
      .post(`/api/inquiries/${secondInquiry}/proposals`)
      .set(as(providerOneToken))
      .send({
        message: "A first proposal that will be withdrawn before the customer makes a decision.",
        estimatedCost: 2800,
        timelineDays: 21,
      })
      .expect(201);
    const proposalId = sent.body.proposal.id;

    const withdrawn = await request(app)
      .post(`/api/proposals/${proposalId}/withdraw`)
      .set(as(providerOneToken))
      .expect(200);
    assert.equal(withdrawn.body.proposal.status, "withdrawn");
    assert.equal(withdrawn.body.inquiry.status, "in_discussion");

    const resent = await request(app)
      .post(`/api/inquiries/${secondInquiry}/proposals`)
      .set(as(providerOneToken))
      .send({
        message: "A revised proposal after withdrawing the previous offer with updated terms.",
        estimatedCost: 2600,
        timelineDays: 18,
      })
      .expect(201);
    assert.equal(resent.body.proposal.id, proposalId);
    assert.equal(resent.body.proposal.status, "sent");
    assert.equal(resent.body.proposal.estimatedCost, 2600);

    const declined = await request(app)
      .post(`/api/proposals/${proposalId}/decline`)
      .set(as(customerOne.token))
      .expect(200);
    assert.equal(declined.body.proposal.status, "declined");
    assert.equal(declined.body.inquiry.status, "declined");
  });

  test("publishes reviews only for completed engagements and recalculates ratings", async () => {
    const providerReview = await request(app)
      .post("/api/reviews")
      .set(as(providerOneToken))
      .send({
        inquiryId,
        rating: 5,
        comment: "A provider must never be able to review their own engagement.",
      })
      .expect(403);
    assert.match(providerReview.body.message, /customer/i);

    const review = await request(app)
      .post("/api/reviews")
      .set(as(customerOne.token))
      .send({
        inquiryId,
        rating: 5,
        title: "Reliable delivery",
        comment: "The engagement was completed with clear communication and a documented handover.",
      })
      .expect(201);
    reviewId = review.body.review.id;
    assert.equal(review.body.providerRating.ratingCount, 1);
    assert.equal(review.body.providerRating.ratingAvg, 5);

    await request(app)
      .post("/api/reviews")
      .set(as(customerOne.token))
      .send({
        inquiryId,
        rating: 4,
        comment: "A second review for the same engagement must be rejected as a duplicate.",
      })
      .expect(409);

    const ratedProvider = await request(app).get("/api/providers/test-provider-one").expect(200);
    assert.equal(ratedProvider.body.provider.ratingCount, 1);
    assert.equal(ratedProvider.body.provider.ratingAvg, 5);
    assert.equal(ratedProvider.body.reviews.length, 1);

    const hidden = await request(app)
      .patch(`/api/admin/reviews/${reviewId}`)
      .set(as(adminToken))
      .send({ status: "hidden", moderationNote: "Automated integration test" })
      .expect(200);
    assert.equal(hidden.body.review.status, "hidden");

    const afterHide = await request(app).get("/api/providers/test-provider-one").expect(200);
    assert.equal(afterHide.body.provider.ratingCount, 0);
    assert.equal(afterHide.body.provider.ratingAvg, 0);
    assert.equal(afterHide.body.reviews.length, 0);

    await request(app)
      .patch(`/api/admin/reviews/${reviewId}`)
      .set(as(adminToken))
      .send({ status: "published" })
      .expect(200);

    const afterPublish = await request(app).get("/api/providers/test-provider-one").expect(200);
    assert.equal(afterPublish.body.provider.ratingCount, 1);
    assert.equal(afterPublish.body.provider.ratingAvg, 5);
  });

  test("keeps provider services private to their owner and preserves unchanged fields", async () => {
    const created = await request(app)
      .post("/api/provider/services")
      .set(as(providerOneToken))
      .send({
        title: "Integration service with non-default values",
        description: "A detailed service description used to verify that partial updates do not reset defaults.",
        category: String(category._id),
        startingPrice: 3500,
        deliveryDays: 30,
        status: "published",
      })
      .expect(201);
    const serviceId = created.body.service.id;
    assert.equal(created.body.service.startingPrice, 3500);
    assert.equal(created.body.service.deliveryDays, 30);
    assert.equal(created.body.service.status, "published");

    await request(app)
      .put(`/api/provider/services/${serviceId}`)
      .set(as(providerTwoToken))
      .send({ title: "Service hijacked by another provider" })
      .expect(404);

    const updated = await request(app)
      .put(`/api/provider/services/${serviceId}`)
      .set(as(providerOneToken))
      .send({ title: "Updated integration service title" })
      .expect(200);
    assert.equal(updated.body.service.title, "Updated integration service title");
    assert.equal(updated.body.service.startingPrice, 3500);
    assert.equal(updated.body.service.deliveryDays, 30);
    assert.equal(updated.body.service.status, "published");

    await request(app)
      .post("/api/provider/services")
      .set(as(providerOneToken))
      .send({
        title: "Invalid price range service",
        description: "A service whose maximum price is lower than its starting price must be rejected.",
        category: String(category._id),
        startingPrice: 900,
        maxPrice: 400,
      })
      .expect(400);
  });

  test("preserves portfolio publish status during partial updates", async () => {
    const created = await request(app)
      .post("/api/provider/portfolio")
      .set(as(providerOneToken))
      .send({
        title: "Published portfolio project",
        description: "A portfolio project created as published to verify partial updates keep its visibility.",
        category: String(category._id),
        status: "published",
      })
      .expect(201);
    const projectId = created.body.project.id;
    assert.equal(created.body.project.status, "published");

    const updated = await request(app)
      .put(`/api/provider/portfolio/${projectId}`)
      .set(as(providerOneToken))
      .send({ title: "Renamed portfolio project" })
      .expect(200);
    assert.equal(updated.body.project.title, "Renamed portfolio project");
    assert.equal(updated.body.project.status, "published");
  });

  test("validates uploads and keeps private attachments access-controlled", async () => {
    const beforeCount = await Upload.countDocuments();

    await request(app)
      .post("/api/uploads")
      .set(as(customerOne.token))
      .field("purpose", "avatar")
      .attach("file", Buffer.from("This is not an image.", "utf8"), {
        filename: "not-an-image.txt",
        contentType: "text/plain",
      })
      .expect(400);
    assert.equal(await Upload.countDocuments(), beforeCount);

    const uploaded = await request(app)
      .post("/api/uploads")
      .set(as(customerOne.token))
      .field("purpose", "attachment")
      .attach("file", Buffer.from("Private project brief for the integration suite.", "utf8"), {
        filename: "brief.txt",
        contentType: "text/plain",
      })
      .expect(201);
    const upload = uploaded.body.upload;
    uploadedFiles.push(upload.storedName);
    assert.equal(upload.isPublic, false);

    await request(app).get(`/api/uploads/${upload.id}/file`).expect(401);

    await request(app)
      .get(`/api/uploads/${upload.id}/file`)
      .set(as(customerTwo.token))
      .expect(403);

    const file = await request(app)
      .get(`/api/uploads/${upload.id}/file`)
      .set(as(customerOne.token))
      .expect(200);
    assert.match(file.headers["content-type"], /text\/plain/);

    await request(app)
      .delete(`/api/uploads/${upload.id}`)
      .set(as(customerTwo.token))
      .expect(404);

    await request(app)
      .delete(`/api/uploads/${upload.id}`)
      .set(as(customerOne.token))
      .expect(200);

    await request(app)
      .get(`/api/uploads/${upload.id}/file`)
      .set(as(customerOne.token))
      .expect(404);
  });

  test("accepts public contact messages for administrator follow-up", async () => {
    const subject = "Integration suite contact message";
    await request(app)
      .post("/api/contact")
      .send({
        name: "Integration Tester",
        email: "contact.tester@buildbridge.test",
        subject,
        message: "This message was created by the automated integration suite and needs no response.",
      })
      .expect(201);

    const list = await request(app)
      .get("/api/admin/messages?limit=100")
      .set(as(adminToken))
      .expect(200);
    const message = list.body.items.find((item) => item.subject === subject);
    assert.ok(message, "Contact message should appear in the admin inbox");
    assert.equal(message.status, "new");

    const updated = await request(app)
      .patch(`/api/admin/messages/${message._id}`)
      .set(as(adminToken))
      .send({ status: "read" })
      .expect(200);
    assert.equal(updated.body.contact.status, "read");
  });

  test("suspends providers with their account and republishes eligible profiles on reactivation", async () => {
    const suspended = await request(app)
      .patch(`/api/admin/users/${providerTwoUser._id}`)
      .set(as(adminToken))
      .send({ status: "suspended", suspensionReason: "Automated integration test" })
      .expect(200);
    assert.equal(suspended.body.user.status, "suspended");

    await request(app).get("/api/providers/test-provider-two").expect(404);
    await request(app).get("/api/provider/profile").set(as(providerTwoToken)).expect(403);
    await request(app)
      .post("/api/auth/login")
      .send({ email: "provider.two@buildbridge.test", password: PROVIDER_PASSWORD })
      .expect(403);

    await request(app)
      .patch(`/api/admin/providers/${providerTwo._id}`)
      .set(as(adminToken))
      .send({ status: "published" })
      .expect(400);

    const reactivated = await request(app)
      .patch(`/api/admin/users/${providerTwoUser._id}`)
      .set(as(adminToken))
      .send({ status: "active" })
      .expect(200);
    assert.equal(reactivated.body.user.status, "active");

    const restored = await request(app).get("/api/providers/test-provider-two").expect(200);
    assert.equal(restored.body.provider.status, "published");
  });
});
