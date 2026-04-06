const express = require('express');
const router = express.Router();
const { starUser, unstarUser } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.post('/star/:userId', protect, starUser);
router.delete('/star/:userId', protect, unstarUser);

module.exports = router;
