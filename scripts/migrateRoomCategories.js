require("dotenv").config();
const mongoose = require("mongoose");
const Room = require("../model/Room");

const CATEGORY_MAP = {
  standart: "standart_duxspalni",
  polulyuks: "standart_ikki_kishilik",
  lyuks: "standart_3kishilik",
  apartament: "standart_4kishilik",
  bir_kishilik: "standart_familiy",
  "Standart duxspalni": "standart_duxspalni",
  "Standart ikki kishilik": "standart_ikki_kishilik",
  "Standart 3kishilik": "standart_3kishilik",
  "Standard 4kishilik": "standart_4kishilik",
  "Standart 4kishilik": "standart_4kishilik",
  "Standart oilaviy": "standart_familiy",
};

const NEW_CATEGORIES = new Set(Object.values(CATEGORY_MAP));

async function migrate() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI topilmadi");
  }

  await mongoose.connect(process.env.MONGO_URI);

  let totalUpdated = 0;
  for (const [from, to] of Object.entries(CATEGORY_MAP)) {
    const result = await Room.updateMany({ category: from }, { $set: { category: to } });
    totalUpdated += Number(result.modifiedCount || 0);
    console.log(`'${from}' -> '${to}': ${result.modifiedCount || 0} ta`);
  }

  const unknownCount = await Room.countDocuments({
    category: { $nin: [...NEW_CATEGORIES] },
  });

  console.log(`Jami yangilangan: ${totalUpdated} ta xona`);
  console.log(`Noma'lum kategoriyada qolgan xonalar: ${unknownCount} ta`);

  await mongoose.disconnect();
}

migrate()
  .then(() => {
    console.log("Kategoriya migratsiyasi tugadi");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Migratsiya xatosi:", error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  });
