/* ============================================
   Storage Module
   Centralized localStorage utility for all
   data persistence across the application
   ============================================ */

const Storage = {
  /* --- Keys --- */
  KEYS: {
    PROFILE: 'dp_user_profile',
    MEAL_LOG: 'dp_meal_log',
    WATER_LOG: 'dp_water_log',
    DIET_PLAN: 'dp_current_diet_plan',
    GROCERY_LIST: 'dp_grocery_list',
    MEAL_HISTORY: 'dp_meal_history',
  },

  /* Save JSON data to localStorage */
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('Storage save error:', e);
      return false;
    }
  },

  /* Load JSON data from localStorage */
  load(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Storage load error:', e);
      return fallback;
    }
  },

  /* Remove a key from localStorage */
  remove(key) {
    localStorage.removeItem(key);
  },

  /* --- Profile helpers --- */
  getProfile() {
    return this.load(this.KEYS.PROFILE, {
      name: '',
      age: '',
      gender: '',
      height: '',
      weight: '',
      goal: 'Maintenance',
      activityLevel: 'moderate',
      dietType: 'Omnivore',
      allergies: '',
    });
  },

  saveProfile(profile) {
    return this.save(this.KEYS.PROFILE, profile);
  },

  /* --- Meal Log helpers (today's meals) --- */
  getTodayKey() {
    return new Date().toISOString().split('T')[0];
  },

  getMealLog() {
    const allLogs = this.load(this.KEYS.MEAL_LOG, {});
    const today = this.getTodayKey();
    return allLogs[today] || [];
  },

  saveMealEntry(entry) {
    const allLogs = this.load(this.KEYS.MEAL_LOG, {});
    const today = this.getTodayKey();
    if (!allLogs[today]) allLogs[today] = [];
    entry.id = Date.now() + Math.floor(Math.random() * 1000);
    entry.timestamp = new Date().toISOString();
    allLogs[today].push(entry);
    /* Keep last 30 days for analytics */
    this._pruneOldEntries(allLogs, 30);
    return this.save(this.KEYS.MEAL_LOG, allLogs);
  },

  removeMealEntry(entryId) {
    const allLogs = this.load(this.KEYS.MEAL_LOG, {});
    const today = this.getTodayKey();
    if (allLogs[today]) {
      allLogs[today] = allLogs[today].filter(e => e.id !== entryId);
      return this.save(this.KEYS.MEAL_LOG, allLogs);
    }
    return false;
  },

  getMealHistory(days = 7) {
    const allLogs = this.load(this.KEYS.MEAL_LOG, {});
    const result = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const meals = allLogs[key] || [];
      const totalCalories = meals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
      const totalProtein = meals.reduce((sum, m) => sum + (Number(m.protein) || 0), 0);
      const totalCarbs = meals.reduce((sum, m) => sum + (Number(m.carbs) || 0), 0);
      const totalFat = meals.reduce((sum, m) => sum + (Number(m.fat) || 0), 0);
      result.push({ date: key, meals, totalCalories, totalProtein, totalCarbs, totalFat });
    }
    return result;
  },

  _pruneOldEntries(logs, keepDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    for (const key of Object.keys(logs)) {
      if (key < cutoffStr) delete logs[key];
    }
  },

  /* --- Water Log helpers --- */
  getWaterLog() {
    const allLogs = this.load(this.KEYS.WATER_LOG, {});
    const today = this.getTodayKey();
    return allLogs[today] || { glasses: 0, goal: 8 };
  },

  addWaterGlass() {
    const allLogs = this.load(this.KEYS.WATER_LOG, {});
    const today = this.getTodayKey();
    if (!allLogs[today]) allLogs[today] = { glasses: 0, goal: 8 };
    allLogs[today].glasses += 1;
    return this.save(this.KEYS.WATER_LOG, allLogs);
  },

  removeWaterGlass() {
    const allLogs = this.load(this.KEYS.WATER_LOG, {});
    const today = this.getTodayKey();
    if (!allLogs[today]) allLogs[today] = { glasses: 0, goal: 8 };
    if (allLogs[today].glasses > 0) allLogs[today].glasses -= 1;
    return this.save(this.KEYS.WATER_LOG, allLogs);
  },

  setWaterGoal(goal) {
    const allLogs = this.load(this.KEYS.WATER_LOG, {});
    const today = this.getTodayKey();
    if (!allLogs[today]) allLogs[today] = { glasses: 0, goal: 8 };
    allLogs[today].goal = goal;
    return this.save(this.KEYS.WATER_LOG, allLogs);
  },

  /* --- Diet Plan helpers --- */
  saveDietPlan(plan) {
    plan.savedAt = new Date().toISOString();
    return this.save(this.KEYS.DIET_PLAN, plan);
  },

  getDietPlan() {
    return this.load(this.KEYS.DIET_PLAN, null);
  },

  /* --- Grocery List helpers --- */
  getGroceryList() {
    return this.load(this.KEYS.GROCERY_LIST, []);
  },

  saveGroceryList(list) {
    return this.save(this.KEYS.GROCERY_LIST, list);
  },

  addGroceryItem(item) {
    const list = this.getGroceryList();
    item.id = Date.now() + Math.floor(Math.random() * 1000);
    item.checked = false;
    list.push(item);
    return this.save(this.KEYS.GROCERY_LIST, list);
  },

  toggleGroceryItem(id) {
    const list = this.getGroceryList();
    const item = list.find(i => i.id === id);
    if (item) item.checked = !item.checked;
    return this.save(this.KEYS.GROCERY_LIST, list);
  },

  removeGroceryItem(id) {
    const list = this.getGroceryList().filter(i => i.id !== id);
    return this.save(this.KEYS.GROCERY_LIST, list);
  },
};
