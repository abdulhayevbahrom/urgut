const objectIdPattern = "^[0-9a-fA-F]{24}$";

const createAttendanceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["employeeId", "status"],
  properties: {
    employeeId: {
      type: "string",
      pattern: objectIdPattern,
    },
    status: {
      type: "string",
      enum: ["present", "absent"],
    },
    date: {
      type: "string",
      format: "date-time",
    },
  },
};

const attendanceHistoryQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: {
      type: "string",
      format: "date",
    },
    search: { type: "string", minLength: 1, maxLength: 120 },
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};

const attendanceMonthlyReportQuerySchema = {
  type: "object",
  additionalProperties: false,
  required: ["year", "month"],
  properties: {
    year: {
      type: "integer",
      minimum: 2000,
      maximum: 2100,
    },
    month: {
      type: "integer",
      minimum: 1,
      maximum: 12,
    },
    search: { type: "string", minLength: 1, maxLength: 120 },
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};

const attendanceEmployeesQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    search: { type: "string", minLength: 1, maxLength: 120 },
    date: { type: "string", format: "date" },
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};

module.exports = {
  createAttendanceSchema,
  attendanceHistoryQuerySchema,
  attendanceMonthlyReportQuerySchema,
  attendanceEmployeesQuerySchema,
};
