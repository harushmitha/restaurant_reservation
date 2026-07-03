import { Router } from "express";
import { body } from "express-validator";
import {
  listTables,
  createTable,
  updateTable,
  deactivateTable,
} from "../controllers/tableController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

// Any authenticated user can list tables (needed by the booking UI).
router.get("/", authenticate, listTables);

// Admin-only management routes.
router.post(
  "/",
  authenticate,
  authorize("admin"),
  [
    body("tableNumber").isInt({ min: 1 }).withMessage("tableNumber must be a positive integer"),
    body("capacity").isInt({ min: 1 }).withMessage("capacity must be a positive integer"),
    body("isActive").optional().isBoolean(),
  ],
  validate,
  createTable
);

router.put(
  "/:id",
  authenticate,
  authorize("admin"),
  [
    body("tableNumber").optional().isInt({ min: 1 }),
    body("capacity").optional().isInt({ min: 1 }),
    body("isActive").optional().isBoolean(),
  ],
  validate,
  updateTable
);

router.delete("/:id", authenticate, authorize("admin"), deactivateTable);

export default router;
