const Employee = require("../model/Employee");
const Attendance = require("../model/Attendance");
const response = require("../utils/response");

const toDayRange = (inputDate) => {
  const date = new Date(inputDate);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start, end };
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildPagination = (pageRaw, limitRaw) => {
  const page = Math.max(1, Number(pageRaw) || 1);
  const limit = Math.max(1, Math.min(100, Number(limitRaw) || 20));
  return { page, limit, skip: (page - 1) * limit };
};

const listAttendanceEmployees = async (req, res) => {
  try {
    const search = String(req.query?.search || "").trim();
    const { page, limit, skip } = buildPagination(req.query?.page, req.query?.limit);
    const dateValue = req.query?.date || new Date().toISOString();
    const { start, end } = toDayRange(dateValue);

    const filter = { isActive: true };
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ firstname: regex }, { lastname: regex }, { position: regex }];
    }

    const [employees, total] = await Promise.all([
      Employee.find(filter)
      .select("firstname lastname position")
      .sort({ firstname: 1, lastname: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
      Employee.countDocuments(filter),
    ]);

    const employeeIds = employees.map((item) => item._id);
    const attendanceList = await Attendance.find({
      employee: { $in: employeeIds },
      date: { $gte: start, $lt: end },
    })
      .select("_id employee status")
      .lean();

    const attendanceMap = new Map();
    attendanceList.forEach((item) => {
      attendanceMap.set(String(item.employee), item);
    });

    const items = employees.map((item) => ({
      employeeId: item._id,
      fullName: `${item.firstname || ""} ${item.lastname || ""}`.trim(),
      departmentName: item.position || "-",
      attendanceRecordId: attendanceMap.get(String(item._id))?._id || "",
      attendanceStatus: attendanceMap.get(String(item._id))?.status || "",
    }));

    return response.success(res, "Davomat hodimlari", {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return response.serverError(res, "Hodimlarni olishda xatolik", error.message);
  }
};

const createAttendance = async (req, res) => {
  try {
    const employeeId = String(req.body?.employeeId || "").trim();
    const status = String(req.body?.status || "").trim().toLowerCase();
    const dateValue = req.body?.date || new Date().toISOString();

    if (!employeeId) return response.error(res, "employeeId majburiy");
    if (!["present", "absent"].includes(status)) {
      return response.error(res, "status present yoki absent bo'lishi kerak");
    }

    const employee = await Employee.findById(employeeId).select("_id").lean();
    if (!employee) return response.notFound(res, "Hodim topilmadi");

    const { start, end } = toDayRange(dateValue);
    const exists = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: start, $lt: end },
    }).lean();

    if (exists) {
      return response.error(res, "Bu hodim uchun bugungi davomat allaqachon belgilangan");
    }

    const created = await Attendance.create({
      employee: employeeId,
      status,
      date: start,
      markedBy: req.admin.id,
    });

    return response.created(res, "Davomat saqlandi", created);
  } catch (error) {
    return response.serverError(res, "Davomat yaratishda xatolik", error.message);
  }
};

const getAttendanceByDate = async (req, res) => {
  try {
    const dateValue = req.query?.date || new Date().toISOString();
    const search = String(req.query?.search || "").trim();
    const { page, limit, skip } = buildPagination(req.query?.page, req.query?.limit);
    const { start, end } = toDayRange(dateValue);

    const employeeFilter = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      employeeFilter.$or = [{ firstname: regex }, { lastname: regex }, { position: regex }];
    }

    const records = await Attendance.find({ date: { $gte: start, $lt: end } })
      .populate({
        path: "employee",
        select: "firstname lastname position",
        match: employeeFilter,
      })
      .sort({ createdAt: -1 })
      .lean();

    const normalized = records
      .filter((item) => item.employee)
      .map((item) => ({
      id: item._id,
      employeeId: item.employee?._id || "",
      fullName: `${item.employee?.firstname || ""} ${item.employee?.lastname || ""}`.trim(),
      departmentName: item.employee?.position || "-",
      status: item.status,
      date: item.date,
    }));

    const total = normalized.length;
    const items = normalized.slice(skip, skip + limit);
    return response.success(res, "Sana bo'yicha davomat", {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return response.serverError(res, "Davomat tarixini olishda xatolik", error.message);
  }
};

const getMonthlyAttendanceReport = async (req, res) => {
  try {
    const year = Number(req.query?.year || new Date().getFullYear());
    const month = Number(req.query?.month || new Date().getMonth() + 1);

    const search = String(req.query?.search || "").trim();
    const { page, limit, skip } = buildPagination(req.query?.page, req.query?.limit);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return response.error(res, "Noto'g'ri year yoki month");
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const employeeFilter = { isActive: true };
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      employeeFilter.$or = [{ firstname: regex }, { lastname: regex }, { position: regex }];
    }

    const [employees, records] = await Promise.all([
      Employee.find(employeeFilter).select("firstname lastname position").lean(),
      Attendance.find({
        date: { $gte: start, $lt: end },
      })
        .select("employee status")
        .lean(),
    ]);

    const summaryMap = new Map();
    employees.forEach((employee) => {
      const employeeId = String(employee._id);
      summaryMap.set(employeeId, {
        employeeId,
        fullName: `${employee.firstname || ""} ${employee.lastname || ""}`.trim(),
        departmentName: employee.position || "-",
        presentCount: 0,
        absentCount: 0,
      });
    });

    records.forEach((record) => {
      const employeeId = String(record.employee || "");
      if (!summaryMap.has(employeeId)) return;
      const row = summaryMap.get(employeeId);
      if (record.status === "present") row.presentCount += 1;
      if (record.status === "absent") row.absentCount += 1;
    });

    const allItems = Array.from(summaryMap.values());
    const total = allItems.length;
    const items = allItems.slice(skip, skip + limit);
    return response.success(res, "Oylik davomat hisoboti", {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return response.serverError(res, "Oylik hisobotni olishda xatolik", error.message);
  }
};

module.exports = {
  listAttendanceEmployees,
  createAttendance,
  getAttendanceByDate,
  getMonthlyAttendanceReport,
};
