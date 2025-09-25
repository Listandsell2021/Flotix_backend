import { Router, Request, Response } from "express";
import multer from "multer";
import {
  authenticate,
  checkRole,
  checkCompanyAccess,
  validate,
  createExpenseSchema,
  updateExpenseSchema,
  expenseFiltersSchema,
  auditExpenseCreate,
  auditExpenseUpdate,
  auditExpenseDelete,
  auditReportExport,
  asyncHandler,
  createError,
} from "../middleware";
import { Expense, User, Vehicle } from "../models";
import { ReceiptOCRService, FirebaseStorageService } from "../modules";
import { config } from "../config";
import {
  UserRole,
  ApiResponse,
  PaginatedResponse,
  CreateExpenseRequest,
  Expense as IExpense,
  ExpenseFilters,
} from "../types";

const router: ReturnType<typeof Router> = Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (
      config.ALLOWED_FILE_TYPES.includes(
        file.mimetype as (typeof config.ALLOWED_FILE_TYPES)[number]
      )
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG and PNG images are allowed."));
    }
  },
});

// POST /api/expenses/upload-image
// Upload image to Firebase and return URL only (no OCR)
router.post(
  "/upload-image",
  authenticate,
  checkRole([UserRole.DRIVER, UserRole.ADMIN, UserRole.MANAGER]),
  upload.single("image"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      } as ApiResponse);
    }

    const { buffer, mimetype, originalname } = req.file;
    const { userId, companyId } = (req as any).user;

    // Validate file
    const validation = FirebaseStorageService.validateReceiptFile(
      buffer,
      mimetype,
      originalname
    );
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      } as ApiResponse);
    }

    try {
      // Upload to Firebase only
      const imageUrl = await FirebaseStorageService.uploadReceiptImage(
        buffer,
        originalname,
        mimetype,
        userId,
        companyId
      );

      res.json({
        success: true,
        data: {
          imageUrl,
        },
        message: "Image uploaded successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("Image upload error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload image",
      } as ApiResponse);
    }
  })
);

// POST /api/expenses/upload-receipt
// Upload receipt and extract data with OCR
router.post(
  "/upload-receipt",
  authenticate,
  checkRole([UserRole.DRIVER, UserRole.ADMIN, UserRole.MANAGER]),
  upload.single("receipt"),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Receipt image is required",
      } as ApiResponse);
    }

    const { buffer, mimetype, originalname } = req.file;
    const { userId, companyId } = (req as any).user;

    // Validate file
    const validation = FirebaseStorageService.validateReceiptFile(
      buffer,
      mimetype,
      originalname
    );
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      } as ApiResponse);
    }

    try {
      // Upload to Firebase
      const receiptUrl = await FirebaseStorageService.uploadReceiptImage(
        buffer,
        originalname,
        mimetype,
        userId,
        companyId
      );

      // Extract data using OCR
      const ocrResult = await ReceiptOCRService.extractReceiptData(receiptUrl);

      res.json({
        success: true,
        data: {
          receiptUrl,
          ocrResult,
          confidence: ReceiptOCRService.getConfidenceDescription(
            ocrResult.confidence
          ),
          canEdit: true,
        },
        message: "Receipt uploaded and processed successfully",
      } as ApiResponse);
    } catch (error) {
      console.error("Receipt upload/OCR error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process receipt",
      } as ApiResponse);
    }
  })
);

// POST /api/expenses/batch
// Create multiple expenses in batch
router.post(
  "/batch",
  authenticate,
  checkRole([
    UserRole.DRIVER,
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.SUPER_ADMIN,
  ]), // All roles can batch upload
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, companyId, role } = (req as any).user;
    const { expenses } = req.body;

    // Validate batch request
    if (!expenses || !Array.isArray(expenses)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch request. Expected array of expenses",
      } as ApiResponse);
    }

    if (expenses.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No expenses provided in batch",
      } as ApiResponse);
    }

    if (expenses.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Batch size exceeds limit (max 100 expenses)",
      } as ApiResponse);
    }

    const results = {
      successful: [] as any[],
      failed: [] as any[],
      totalProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
    };

    // Process each expense
    for (let i = 0; i < expenses.length; i++) {
      const expenseData = expenses[i];
      results.totalProcessed++;

      try {
        // Validate individual expense data
        const validationResult =
          createExpenseSchema.shape.body.safeParse(expenseData);
        if (!validationResult.success) {
          results.failed.push({
            index: i,
            data: expenseData,
            error:
              validationResult.error.errors[0]?.message || "Validation failed",
          });
          results.totalFailed++;
          continue;
        }

        let driverId: string;
        let targetDriver: any;

        if (role === "DRIVER") {
          // Driver creating expenses for themselves - ignore driverId in request
          driverId = userId;
          targetDriver = await User.findOne({
            _id: userId,
            companyId,
            role: "DRIVER",
          });
          if (!targetDriver) {
            results.failed.push({
              index: i,
              data: expenseData,
              error: "Driver account not found",
            });
            results.totalFailed++;
            continue;
          }
        } else {
          // Admin/Manager creating expenses for a driver
          if (!expenseData.driverId) {
            results.failed.push({
              index: i,
              data: expenseData,
              error: "Driver ID is required when admin/manager creates expense",
            });
            results.totalFailed++;
            continue;
          }
          driverId = expenseData.driverId;
          targetDriver = await User.findOne({
            _id: driverId,
            companyId,
            role: "DRIVER",
          });
          if (!targetDriver) {
            results.failed.push({
              index: i,
              data: expenseData,
              error: `Driver with ID ${driverId} not found or not in your company`,
            });
            results.totalFailed++;
            continue;
          }
        }

        // Create expense with vehicle info if driver has assigned vehicle
        const expenseDataWithCompany = {
          ...expenseData,
          driverId, // Use the determined driverId (either from request or current user)
          companyId,
          vehicleId: targetDriver.assignedVehicleId || undefined,
        };

        const expense = new Expense(expenseDataWithCompany);
        await expense.save();

        // Update vehicle odometer if applicable
        if (
          targetDriver.assignedVehicleId &&
          (expenseData.odometerReading || expenseData.kilometers)
        ) {
          try {
            const vehicle = await Vehicle.findOne({
              _id: targetDriver.assignedVehicleId,
              companyId,
            });

            if (vehicle) {
              let newOdometerReading: number | undefined;

              if (
                expenseData.odometerReading &&
                expenseData.odometerReading > 0
              ) {
                newOdometerReading = expenseData.odometerReading;
                // Set kilometers to the same value as odometer reading
                expense.kilometers = expenseData.odometerReading;
              } else if (expenseData.kilometers && expenseData.kilometers > 0) {
                newOdometerReading =
                  vehicle.currentOdometer + expenseData.kilometers;
                // Set the odometer reading on the expense
                expense.odometerReading = newOdometerReading;
              }

              if (
                newOdometerReading &&
                newOdometerReading > vehicle.currentOdometer
              ) {
                vehicle.currentOdometer = newOdometerReading;
                await vehicle.save();
                // Re-save expense with updated fields
                await expense.save();
              }
            }
          } catch (error) {
            console.error(
              `Failed to update vehicle odometer for expense ${i}:`,
              error
            );
          }
        }

        // Populate driver and vehicle info
        await expense.populate("driverId", "name email");
        await expense.populate(
          "vehicleId",
          "make model year licensePlate type"
        );

        results.successful.push({
          index: i,
          expense: expense,
        });
        results.totalSuccessful++;
      } catch (error: any) {
        results.failed.push({
          index: i,
          data: expenseData,
          error: error.message || "Failed to create expense",
        });
        results.totalFailed++;
      }
    }

    // Log audit for batch operation
    console.log(
      `Batch expense creation: ${results.totalSuccessful} successful, ${results.totalFailed} failed out of ${results.totalProcessed} total`
    );

    res.status(results.totalSuccessful > 0 ? 201 : 400).json({
      success: results.totalSuccessful > 0,
      data: results,
      message: `Processed ${results.totalProcessed} expenses: ${results.totalSuccessful} successful, ${results.totalFailed} failed`,
    } as ApiResponse);
  })
);

// POST /api/expenses
// Create new expense
router.post(
  "/",
  authenticate,
  checkRole([UserRole.DRIVER, UserRole.ADMIN, UserRole.MANAGER]),
  validate(createExpenseSchema),
  auditExpenseCreate,
  asyncHandler(async (req: Request, res: Response) => {
    const expenseData: CreateExpenseRequest = req.body;
    const { userId, companyId, role } = (req as any).user;

    let driverId: string;
    let targetDriver: any;

    if (role === "DRIVER") {
      // Driver creating expense for themselves
      driverId = userId;
      targetDriver = await User.findOne({
        _id: userId,
        companyId,
        role: "DRIVER",
      });
      if (!targetDriver) {
        throw createError("Driver not found or unauthorized", 403);
      }
    } else if (role === "ADMIN" || role === "MANAGER") {
      // Admin/Manager creating expense for a driver
      if (!expenseData.driverId) {
        throw createError(
          "Driver ID is required when admin/manager creates expense",
          400
        );
      }
      driverId = expenseData.driverId;
      targetDriver = await User.findOne({
        _id: driverId,
        companyId,
        role: "DRIVER",
      });
      if (!targetDriver) {
        throw createError("Driver not found or not in your company", 404);
      }
    } else {
      throw createError("Unauthorized role", 403);
    }

    // Add the vehicle ID if the driver has an assigned vehicle
    console.log("Driver info:", {
      driverId,
      assignedVehicleId: targetDriver.assignedVehicleId,
      hasVehicle: !!targetDriver.assignedVehicleId,
    });

    const expenseDataWithVehicle = {
      ...expenseData,
      driverId,
      companyId,
      vehicleId: targetDriver.assignedVehicleId || undefined,
    };

    const expense = new Expense(expenseDataWithVehicle);

    await expense.save();

    console.log("Expense data received:", {
      kilometers: expenseData.kilometers,
      odometerReading: expenseData.odometerReading,
      hasAssignedVehicle: !!targetDriver.assignedVehicleId,
    });

    // Update vehicle odometer if kilometers or odometerReading is provided and driver has assigned vehicle
    if (
      targetDriver.assignedVehicleId &&
      (expenseData.odometerReading || expenseData.kilometers)
    ) {
      console.log("Attempting to update vehicle odometer:", {
        vehicleId: targetDriver.assignedVehicleId,
        odometerReading: expenseData.odometerReading,
        kilometers: expenseData.kilometers,
      });

      try {
        const vehicle = await Vehicle.findOne({
          _id: targetDriver.assignedVehicleId,
          companyId,
        });

        if (vehicle) {
          console.log("Vehicle found:", {
            licensePlate: vehicle.licensePlate,
            currentOdometer: vehicle.currentOdometer,
          });

          let newOdometerReading: number | undefined;

          // If odometerReading is provided, use it directly as the new total
          if (expenseData.odometerReading && expenseData.odometerReading > 0) {
            newOdometerReading = expenseData.odometerReading;
            // Set kilometers to the same value as odometer reading
            expense.kilometers = expenseData.odometerReading;
            await expense.save();
            console.log(
              `Setting odometer and kilometers to ${newOdometerReading} km`
            );
          }
          // If only kilometers is provided, add it to current odometer (treating it as distance traveled)
          else if (expenseData.kilometers && expenseData.kilometers > 0) {
            newOdometerReading =
              vehicle.currentOdometer + expenseData.kilometers;
            // Set the odometer reading on the expense
            expense.odometerReading = newOdometerReading;
            await expense.save();
            console.log(
              `Adding ${expenseData.kilometers} km to current odometer ${vehicle.currentOdometer}, new reading: ${newOdometerReading}`
            );
          }

          if (newOdometerReading !== undefined && newOdometerReading > 0) {
            // Only update if the new reading is higher than current
            if (newOdometerReading > vehicle.currentOdometer) {
              const previousOdometer = vehicle.currentOdometer;
              vehicle.currentOdometer = newOdometerReading;
              const savedVehicle = await vehicle.save();

              console.log(`✅ Vehicle odometer updated successfully:`, {
                licensePlate: vehicle.licensePlate,
                previousOdometer,
                newOdometer: savedVehicle.currentOdometer,
                difference: savedVehicle.currentOdometer - previousOdometer,
              });
            } else if (newOdometerReading < vehicle.currentOdometer) {
              console.warn(
                `⚠️ Warning: New odometer reading (${newOdometerReading}) is lower than current reading (${vehicle.currentOdometer}). Vehicle not updated.`
              );
            } else {
              console.log(
                `ℹ️ Odometer reading unchanged: ${vehicle.currentOdometer} km`
              );
            }
          } else {
            console.log("No valid odometer update data provided");
          }
        } else {
          console.warn(
            `⚠️ Warning: Vehicle with ID ${targetDriver.assignedVehicleId} not found in company ${companyId}`
          );
        }
      } catch (error) {
        console.error("❌ Error updating vehicle odometer:", error);
        // Don't fail the expense creation if odometer update fails
      }
    } else {
      console.log("Skipping odometer update:", {
        hasVehicle: !!targetDriver.assignedVehicleId,
        hasOdometerData: !!(
          expenseData.odometerReading || expenseData.kilometers
        ),
      });
    }

    // Populate driver and vehicle information for response
    await expense.populate("driverId", "name email");
    await expense.populate(
      "vehicleId",
      "make model year licensePlate type color status currentOdometer"
    );

    res.status(201).json({
      success: true,
      data: expense,
      message: "Expense created successfully",
    } as ApiResponse<IExpense>);
  })
);

// GET /api/expenses
// Get expenses (filtered for drivers, all for admins)
// --- Existing GET /api/expenses logic commented out for reference ---
/*
router.get('/',
  authenticate,
  checkRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DRIVER,
    UserRole.MANAGER,
    UserRole.VIEWER
  ]),
  checkCompanyAccess,
  validate(expenseFiltersSchema),
  asyncHandler(async (req: Request, res: Response) => {
    // ...existing logic...
  })
);
*/

// --- New GET /api/expenses logic matching frontend filter/sort ---
router.get(
  "/",
  authenticate,
  checkRole([
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.DRIVER,
    UserRole.MANAGER,
    UserRole.VIEWER,
  ]),
  checkCompanyAccess,
  validate(expenseFiltersSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { role, userId, companyId: userCompanyId } = (req as any).user;
    const filters: ExpenseFilters = req.query;
    const page = parseInt((req.query.page as string) || "1");
    const limit = Math.min(parseInt((req.query.limit as string) || "20"), 100);
    const skip = (page - 1) * limit;
    const sortBy = (req.query.sortBy as string) || "date";
    const sortOrder = (req.query.sortOrder as string) === "asc" ? 1 : -1;

    // Build query based on user role
    let companyId: string;
    if (role === "SUPER_ADMIN" && req.query.companyId) {
      companyId = req.query.companyId as string;
    } else {
      companyId = userCompanyId;
    }

    let query: any = { companyId };
    if (role === "DRIVER") {
      query.driverId = userId;
    }
    if (filters.type) query.type = filters.type;
    if (filters.driverId && role !== "DRIVER")
      query.driverId = filters.driverId;
    if (filters.category) query.category = filters.category;
    if (filters.dateFrom || filters.dateTo) {
      query.date = {};
      if (filters.dateFrom) query.date.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.date.$lte = new Date(filters.dateTo);
    }

    // Search query: merchant, driver name, type, category
    let mongoOr: any[] = [];
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");
      // Find user IDs where name matches searchRegex
      const matchingUsers = await User.find({ name: searchRegex }, "_id");
      const matchingUserIds = matchingUsers.map((u) => u._id);
      mongoOr = [
        { merchant: searchRegex },
        { type: searchRegex },
        { category: searchRegex },
        { notes: searchRegex },
        // Add driverId match if any users found
        ...(matchingUserIds.length > 0
          ? [{ driverId: { $in: matchingUserIds } }]
          : []),
      ];
      query.$or = mongoOr;
    }

    // Fetch expenses
    console.log("Fetching expenses with query:", query);
    let expenses = await Expense.find(query)
      .populate("driverId", "name email")
      .populate(
        "vehicleId",
        "make model year licensePlate type color status currentOdometer"
      );

    //expanse stat
    let statsResponse: any = {
      totalExpenses: expenses.length,
      totalAmount: 0,
      byType: {},
    };

    for (const exp of expenses) {
      const type = exp.type;
      const amount = exp.amountFinal || 0;

      statsResponse.totalAmount += amount;

      if (!statsResponse.byType[type]) {
        statsResponse.byType[type] = { count: 0, amount: 0 };
      }

      statsResponse.byType[type].count += 1;
      statsResponse.byType[type].amount += amount;
    }

    // Further filter by driver name if search is present
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      expenses = expenses.filter((exp) => {
        const driverName =
          typeof exp.driverId === "object" &&
          (exp.driverId as { name?: string })?.name
            ? (exp.driverId as { name?: string }).name!.toLowerCase()
            : "";
        return (
          (exp.merchant || "").toLowerCase().includes(searchLower) ||
          driverName.includes(searchLower) ||
          (exp.type || "").toLowerCase().includes(searchLower) ||
          (exp.category || "").toLowerCase().includes(searchLower) ||
          (exp.notes || "").toLowerCase().includes(searchLower)
        );
      });
    }

    // Sorting
    expenses.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      switch (sortBy) {
        case "date":
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case "amount":
          aValue = a.amountFinal || 0;
          bValue = b.amountFinal || 0;
          break;
        case "merchant":
          aValue = (a.merchant || "").toLowerCase();
          bValue = (b.merchant || "").toLowerCase();
          break;
        case "driver":
          aValue =
            typeof a.driverId === "object" &&
            (a.driverId as { name?: string })?.name
              ? (a.driverId as { name?: string }).name!.toLowerCase()
              : "";
          bValue =
            typeof b.driverId === "object" &&
            (b.driverId as { name?: string })?.name
              ? (b.driverId as { name?: string }).name!.toLowerCase()
              : "";
          break;
        default:
          aValue = new Date(a.date);
          bValue = new Date(b.date);
      }
      if (sortOrder === 1) {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Pagination
    const total = expenses.length;
    const paginatedExpenses = expenses.slice(skip, skip + limit);

    const response: PaginatedResponse<IExpense> = {
      data: paginatedExpenses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };

    res.json({
      success: true,
      data: response,
      stats: statsResponse,
      message: 'Expenses retrieved successfully'
    } as ApiResponse<PaginatedResponse<IExpense>>);
  })
);

// GET /api/expenses/export
// Export expenses to CSV
router.get(
  "/export",
  authenticate,
  checkCompanyAccess,
  validate(expenseFiltersSchema),
  auditReportExport,
  asyncHandler(async (req: Request, res: Response) => {
    const { role, userId, companyId } = (req as any).user;
    const filters: ExpenseFilters = req.query;

    // Build query (same logic as GET /expenses but without pagination)
    let query: any = { companyId };

    // Drivers can only export their own expenses
    // VIEWER, MANAGER, ADMIN can export all company expenses
    if (role === "DRIVER") {
      query.driverId = userId;
    }

    // Apply filters
    if (filters.dateFrom || filters.dateTo) {
      query.date = {};
      if (filters.dateFrom) query.date.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.date.$lte = new Date(filters.dateTo);
    }

    if (filters.type) query.type = filters.type;
    if (filters.driverId && role !== "DRIVER")
      query.driverId = filters.driverId;
    if (filters.category) query.category = filters.category;

    if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
      query.amountFinal = {};
      if (filters.amountMin !== undefined)
        query.amountFinal.$gte = filters.amountMin;
      if (filters.amountMax !== undefined)
        query.amountFinal.$lte = filters.amountMax;
    }

    if (filters.search) {
      query.$or = [
        { merchant: { $regex: filters.search, $options: "i" } },
        { notes: { $regex: filters.search, $options: "i" } },
      ];
    }

    // Get all expenses matching criteria
    const expenses = await Expense.find(query)
      .populate("driverId", "name email")
      .populate("vehicleId", "make model year licensePlate type currentOdometer")
      .sort({ date: -1 }); // Sort by date descending

    // Generate CSV content
    const csvHeader = [
      "Date",
      "Driver Name",
      "Driver Email",
      "Merchant",
      "Type",
      "Category",
      "Amount",
      "Currency",
      "Kilometers",
      "Vehicle",
      "License Plate",
      "Notes",
      "Created At",
      "Updated At",
    ].join(",");

    const csvRows = expenses.map((expense) => {
      const driver = expense.driverId as any;
      const vehicle = expense.vehicleId as any;
      return [
        new Date(expense.date).toLocaleDateString("en-US"),
        `"${driver?.name || "Unknown"}"`,
        `"${driver?.email || "Unknown"}"`,
        `"${expense.merchant || ""}"`,
        expense.type || "",
        expense.category || "",
        expense.amountFinal || 0,
        expense.currency || "EUR",
        expense.kilometers || "",
        vehicle
          ? `"${vehicle.year || ""} ${vehicle.make || ""} ${
              vehicle.model || ""
            }"`
          : '""',
        vehicle ? `"${vehicle.licensePlate || ""}"` : '""',
        `"${(expense.notes || "").replace(/"/g, '""')}"`,
        new Date(expense.createdAt).toLocaleString("en-US"),
        new Date(expense.updatedAt).toLocaleString("en-US"),
      ].join(",");
    });

    const csvContent = [csvHeader, ...csvRows].join("\\n");

    // Generate filename with current date and filters
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    let filename = `expenses_export_${dateStr}`;

    if (filters.dateFrom && filters.dateTo) {
      filename += `_${filters.dateFrom}_to_${filters.dateTo}`;
    } else if (filters.dateFrom) {
      filename += `_from_${filters.dateFrom}`;
    } else if (filters.dateTo) {
      filename += `_until_${filters.dateTo}`;
    }

    if (filters.type) {
      filename += `_${filters.type.toLowerCase()}`;
    }

    filename += ".csv";

    // Set headers for CSV download
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", Buffer.byteLength(csvContent, "utf8"));

    // Add BOM for proper UTF-8 encoding in Excel
    res.send("\\uFEFF" + csvContent);
  })
);

// GET /api/expenses/:id
// Get single expense
router.get(
  "/:id",
  authenticate,
  checkCompanyAccess,
  asyncHandler(async (req: Request, res: Response) => {
    const { role, userId, companyId } = (req as any).user;
    const { id } = req.params;

    let query: any = { _id: id, companyId };

    // Drivers can only see their own expenses
    if (role === "DRIVER") {
      query.driverId = userId;
    }

    const expense = await Expense.findOne(query)
      .populate("driverId", "name email")
      .populate(
        "vehicleId",
        "make model year licensePlate type color status currentOdometer"
      );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: expense,
      message: "Expense retrieved successfully",
    } as ApiResponse<IExpense>);
  })
);

// PUT /api/expenses/:id
// Update expense (drivers can only edit their own within time limit)
router.put(
  "/:id",
  authenticate,
  validate(updateExpenseSchema),
  auditExpenseUpdate,
  asyncHandler(async (req: Request, res: Response) => {
    const { role, userId, companyId } = (req as any).user;
    const { id } = req.params;
    const updateData = req.body;

    let query: any = { _id: id, companyId };

    // Drivers can only edit their own expenses
    if (role === "DRIVER") {
      query.driverId = userId;
    }

    const expense = await Expense.findOne(query);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      } as ApiResponse);
    }

    // Check if driver can still edit (within time limit)
    if (role === "DRIVER") {
      const now = new Date();
      const timeDiff = now.getTime() - expense.createdAt.getTime();

      if (timeDiff > config.EXPENSE_EDIT_TIME_LIMIT) {
        return res.status(403).json({
          success: false,
          message: "Expense can no longer be edited (time limit exceeded)",
        } as ApiResponse);
      }
    }

    // Store previous odometer reading for comparison
    const previousOdometerReading = expense.odometerReading;

    // Update expense
    Object.assign(expense, updateData);
    expense.updatedAt = new Date();
    await expense.save();

    // Update vehicle odometer if odometerReading changed and driver has assigned vehicle
    if (
      updateData.odometerReading &&
      updateData.odometerReading !== previousOdometerReading
    ) {
      try {
        const driver = await User.findById(expense.driverId);
        if (driver && driver.assignedVehicleId) {
          const vehicle = await Vehicle.findOne({
            _id: driver.assignedVehicleId,
            companyId,
          });

          if (vehicle) {
            // Set kilometers to the same value as odometer reading
            expense.kilometers = updateData.odometerReading;
            await expense.save();

            // Update vehicle odometer to the same value
            const previousVehicleOdometer = vehicle.currentOdometer;
            vehicle.currentOdometer = updateData.odometerReading;
            await vehicle.save();

            console.log(
              `Vehicle odometer and expense kilometers updated: ${vehicle.licensePlate} from ${previousVehicleOdometer} to ${updateData.odometerReading} km`
            );
          }
        }
      } catch (error) {
        console.error(
          "Error updating vehicle odometer during expense edit:",
          error
        );
        // Don't fail the expense update if odometer update fails
      }
    }

    // Populate driver and vehicle information for response
    await expense.populate("driverId", "name email");
    await expense.populate(
      "vehicleId",
      "make model year licensePlate type color status currentOdometer"
    );

    res.json({
      success: true,
      data: expense,
      message: "Expense updated successfully",
    } as ApiResponse<IExpense>);
  })
);

// DELETE /api/expenses/:id
// Delete expense (drivers can only delete their own within time limit)
router.delete(
  "/:id",
  authenticate,
  auditExpenseDelete,
  asyncHandler(async (req: Request, res: Response) => {
    const { role, userId, companyId } = (req as any).user;
    const { id } = req.params;

    let query: any = { _id: id, companyId };

    // Drivers can only delete their own expenses
    if (role === "DRIVER") {
      query.driverId = userId;
    }

    const expense = await Expense.findOne(query);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      } as ApiResponse);
    }

    // Check if driver can still delete (within time limit)
    if (role === "DRIVER") {
      const now = new Date();
      const timeDiff = now.getTime() - expense.createdAt.getTime();

      if (timeDiff > config.EXPENSE_EDIT_TIME_LIMIT) {
        return res.status(403).json({
          success: false,
          message: "Expense can no longer be deleted (time limit exceeded)",
        } as ApiResponse);
      }
    }

    // Delete receipt from Firebase
    try {
      await FirebaseStorageService.deleteReceiptImage(expense.receiptUrl);
    } catch (error) {
      console.error("Failed to delete receipt from Firebase:", error);
      // Continue with expense deletion even if receipt deletion fails
    }

    // Delete expense
    await Expense.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Expense deleted successfully",
    } as ApiResponse);
  })
);

export { router as expenseRoutes };
