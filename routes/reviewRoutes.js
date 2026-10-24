const express = require("express");
const reviews = require("../controllers/reviewController");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { writeLimiter } = require("../middleware/rateLimits");

const router = express.Router();

router.use(requireAuth);
router.get("/mine", reviews.myReviews);
router.post("/", writeLimiter, validate(reviews.reviewSchema), reviews.createReview);

module.exports = router;
