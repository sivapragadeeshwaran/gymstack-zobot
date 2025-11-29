const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const isAdmin = require("../middleware/isAdmin.js");
const addMember = require("../controllers/addMember.js");
const getAllMembers = require("../controllers/getMember.js");
const updateMember = require("../controllers/updateMember.js");
const deleteMember = require("../controllers/deleteMember.js");
const User = require("../Models/user-model.js");
const mongoose = require("mongoose");

router.post("/addMembers", verifyToken, isAdmin, addMember);
router.get("/members", verifyToken, isAdmin, getAllMembers);
router.put("/members/:id", verifyToken, isAdmin, updateMember);
router.delete("/members/:id", verifyToken, isAdmin, deleteMember);
// Get member by ID
//const mongoose = require("mongoose");

router.get("/getmemberbyId/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID format",
      });
    }

    // ✅ Find member by ID
    const member = await User.findById(id).populate("membershipPlan"); // Optional: populate if needed

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    // ✅ Send response
    res.status(200).json({
      success: true,
      data: member,
    });
  } catch (err) {
    console.error("Error fetching member:", err.message); // Helpful for logs
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
