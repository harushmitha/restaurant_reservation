import { Router } from "express";
import { body } from "express-validator";
import {
  getAvailability,
  createReservation,
  myReservations,
  cancelReservation,
  listAllReservations,
  updateReservation,
} from "../controllers/reservationController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// All reservation routes require authentication.
router.use(authenticate);

// Availability + own reservations (any authenticated user).
router.get("/availability", getAvailability);
router.get("/my", myReservations);

// Create a reservation — customers only (admins manage via the admin routes).
router.post(
  "/",
  authorize("customer"),
  [
    body("date").isString().notEmpty(),
    body("timeSlot").isString().notEmpty(),
    body("guests").isInt({ min: 1 }).withMessage("guests must be a positive integer"),
    body("tableId").optional().isMongoId().withMessage("tableId must be a valid id"),
  ],
  validate,
  createReservation
);

// Cancel — owner (customer) or admin; ownership enforced in the controller.
router.patch("/:id/cancel", cancelReservation);

// Admin: list all / filter by date, and update any reservation.
router.get("/", authorize("admin"), listAllReservations);
router.patch("/:id", authorize("admin"), updateReservation);

export default router;
