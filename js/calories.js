/* ============================================
   Smart Calorie Calculator
   BMR (Mifflin-St Jeor) + TDEE + Goal Adjustment
   ============================================ */

const CalorieCalculator = {
  /* Activity level multipliers for TDEE */
  ACTIVITY_MULTIPLIERS: {
    sedentary: 1.2,       // Little or no exercise
    light: 1.375,         // Light exercise 1-3 days/week
    moderate: 1.55,       // Moderate exercise 3-5 days/week
    active: 1.725,        // Hard exercise 6-7 days/week
    veryActive: 1.9,      // Very hard exercise, physical job
  },

  /* Goal calorie adjustments (kcal/day) */
  GOAL_ADJUSTMENTS: {
    'Weight Loss': -500,
    'Muscle Gain': 300,
    'Maintenance': 0,
  },

  /* Recommended macro splits by goal (% of total calories) */
  MACRO_SPLITS: {
    'Weight Loss': { protein: 0.35, carbs: 0.35, fat: 0.30 },
    'Muscle Gain': { protein: 0.30, carbs: 0.45, fat: 0.25 },
    'Maintenance': { protein: 0.25, carbs: 0.50, fat: 0.25 },
  },

  /**
   * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation.
   * @param {number} weight - Weight in kg
   * @param {number} height - Height in cm
   * @param {number} age - Age in years
   * @param {string} gender - 'Male', 'Female', or 'Other'
   * @returns {number} BMR in kcal/day
   */
  calculateBMR(weight, height, age, gender) {
    const w = Number(weight);
    const h = Number(height);
    const a = Number(age);

    if (gender === 'Male') {
      return Math.round(10 * w + 6.25 * h - 5 * a + 5);
    }
    /* Female and Other use the female formula as a safe baseline */
    return Math.round(10 * w + 6.25 * h - 5 * a - 161);
  },

  /**
   * Calculate Total Daily Energy Expenditure.
   * @param {number} bmr - Basal Metabolic Rate
   * @param {string} activityLevel - Key from ACTIVITY_MULTIPLIERS
   * @returns {number} TDEE in kcal/day
   */
  calculateTDEE(bmr, activityLevel) {
    const multiplier = this.ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
    return Math.round(bmr * multiplier);
  },

  /**
   * Calculate daily calorie target based on goal.
   * @param {number} tdee - Total Daily Energy Expenditure
   * @param {string} goal - 'Weight Loss', 'Muscle Gain', or 'Maintenance'
   * @returns {number} Target calories per day
   */
  calculateTarget(tdee, goal) {
    const adjustment = this.GOAL_ADJUSTMENTS[goal] || 0;
    return Math.max(1200, tdee + adjustment); // Minimum 1200 kcal safety floor
  },

  /**
   * Calculate recommended macro targets in grams.
   * @param {number} targetCalories - Daily calorie target
   * @param {string} goal - User's goal
   * @returns {{ protein: number, carbs: number, fat: number }}
   */
  calculateMacros(targetCalories, goal) {
    const split = this.MACRO_SPLITS[goal] || this.MACRO_SPLITS['Maintenance'];
    return {
      protein: Math.round((targetCalories * split.protein) / 4), // 4 cal/g
      carbs: Math.round((targetCalories * split.carbs) / 4),     // 4 cal/g
      fat: Math.round((targetCalories * split.fat) / 9),         // 9 cal/g
    };
  },

  /**
   * Full calculation from profile data.
   * @param {object} profile - User profile with weight, height, age, gender, activityLevel, goal
   * @returns {{ bmr, tdee, targetCalories, macros }}
   */
  calculate(profile) {
    const bmr = this.calculateBMR(profile.weight, profile.height, profile.age, profile.gender);
    const tdee = this.calculateTDEE(bmr, profile.activityLevel);
    const targetCalories = this.calculateTarget(tdee, profile.goal);
    const macros = this.calculateMacros(targetCalories, profile.goal);

    return { bmr, tdee, targetCalories, macros };
  },
};
