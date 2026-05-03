const Room = require("../model/Room");
const Guest = require("../model/Guest");
const response = require("../utils/response");

const normalizeRoomNumber = (value) => String(value || "").trim().toUpperCase();
const ROOM_CATEGORY_MAP = new Map([
  ["standart", "standart_duxspalni"],
  ["standart duxspalni", "standart_duxspalni"],
  ["standart_duxspalni", "standart_duxspalni"],
  ["polulyuks", "standart_ikki_kishilik"],
  ["standart ikki kishilik", "standart_ikki_kishilik"],
  ["standart_ikki_kishilik", "standart_ikki_kishilik"],
  ["lyuks", "standart_3kishilik"],
  ["standart 3kishilik", "standart_3kishilik"],
  ["standart_3kishilik", "standart_3kishilik"],
  ["apartament", "standart_4kishilik"],
  ["standard 4kishilik", "standart_4kishilik"],
  ["standart 4kishilik", "standart_4kishilik"],
  ["standart_4kishilik", "standart_4kishilik"],
  ["bir_kishilik", "standart_familiy"],
  ["standart oilaviy", "standart_familiy"],
  ["standart_familiy", "standart_familiy"],
]);
const normalizeRoomCategory = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return ROOM_CATEGORY_MAP.get(key) || String(value || "").trim();
};
const getOccupancyStatus = (activeCount, capacity) =>
  activeCount >= capacity ? "band" : "bosh";

const createRoom = async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.roomNumber = normalizeRoomNumber(payload.roomNumber);
    payload.category = normalizeRoomCategory(payload.category);

    const exists = await Room.findOne({ roomNumber: payload.roomNumber });
    if (exists) return response.error(res, "Bu xona raqami allaqachon mavjud");

    const room = await Room.create({
      ...payload,
      activeGuestsCount: 0,
      status: "bosh",
    });
    return response.created(res, "Xona muvaffaqiyatli qo'shildi", room);
  } catch (error) {
    return response.serverError(res, error.message);
  }
};

const getRooms = async (_, res) => {
  try {
    const rooms = await Room.find().sort({ roomNumber: 1 });
    return response.success(res, "Xonalar ro'yxati", rooms);
  } catch (error) {
    return response.serverError(res, error.message);
  }
};

const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return response.notFound(res, "Xona topilmadi");
    return response.success(res, "Xona ma'lumotlari", room);
  } catch (error) {
    return response.serverError(res, error.message);
  }
};

const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    const current = await Room.findById(id);

    if (!current) return response.notFound(res, "Xona topilmadi");

    if (updates.roomNumber) {
      const normalized = normalizeRoomNumber(updates.roomNumber);
      const exists = await Room.findOne({ roomNumber: normalized, _id: { $ne: id } });
      if (exists) return response.error(res, "Bu xona raqami allaqachon mavjud");
      updates.roomNumber = normalized;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "category")) {
      updates.category = normalizeRoomCategory(updates.category);
    }

    const room = await Room.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (
      Object.prototype.hasOwnProperty.call(updates, "capacity") ||
      Object.prototype.hasOwnProperty.call(updates, "status")
    ) {
      const activeCount = await Guest.countDocuments({
        room: room._id,
        status: "active",
      });
      room.activeGuestsCount = activeCount;
      if (room.status !== "remont") {
        room.status = getOccupancyStatus(activeCount, room.capacity);
      }
      await room.save();
    }

    return response.success(res, "Xona yangilandi", room);
  } catch (error) {
    return response.serverError(res, error.message);
  }
};

const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return response.notFound(res, "Xona topilmadi");
    return response.success(res, "Xona o'chirildi");
  } catch (error) {
    return response.serverError(res, error.message);
  }
};

module.exports = {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
};
