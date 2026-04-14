/* ============================================
   Meal Recommendation Engine
   Suggests meals based on remaining calories
   and protein needs. Categorized by diet type.
   ============================================ */

const MealRecommendations = {
  /* Built-in meal database categorized by diet type */
  MEAL_DB: [
    /* --- Vegetarian --- */
    { name: 'Greek Yogurt Bowl with Berries & Granola', calories: 320, protein: 18, carbs: 42, fat: 10, dietTypes: ['Vegetarian', 'Omnivore'], category: 'Breakfast' },
    { name: 'Veggie Omelette with Spinach & Cheese', calories: 350, protein: 22, carbs: 8, fat: 26, dietTypes: ['Vegetarian', 'Omnivore'], category: 'Breakfast' },
    { name: 'Overnight Oats with Chia Seeds & Banana', calories: 380, protein: 14, carbs: 58, fat: 12, dietTypes: ['Vegetarian', 'Vegan', 'Omnivore'], category: 'Breakfast' },
    { name: 'Avocado Toast with Poached Eggs', calories: 400, protein: 16, carbs: 32, fat: 24, dietTypes: ['Vegetarian', 'Omnivore'], category: 'Breakfast' },
    { name: 'Paneer Tikka Wrap', calories: 450, protein: 24, carbs: 38, fat: 22, dietTypes: ['Vegetarian', 'Omnivore'], category: 'Lunch' },
    { name: 'Quinoa & Black Bean Salad', calories: 420, protein: 18, carbs: 56, fat: 14, dietTypes: ['Vegetarian', 'Vegan', 'Omnivore'], category: 'Lunch' },
    { name: 'Chickpea Curry with Brown Rice', calories: 480, protein: 20, carbs: 64, fat: 16, dietTypes: ['Vegetarian', 'Vegan', 'Omnivore'], category: 'Lunch' },
    { name: 'Lentil Soup with Whole Wheat Bread', calories: 380, protein: 22, carbs: 52, fat: 8, dietTypes: ['Vegetarian', 'Vegan', 'Omnivore'], category: 'Lunch' },
    { name: 'Vegetable Stir-fry with Tofu & Rice', calories: 440, protein: 22, carbs: 52, fat: 16, dietTypes: ['Vegetarian', 'Vegan', 'Omnivore'], category: 'Dinner' },
    { name: 'Stuffed Bell Peppers with Cheese & Rice', calories: 380, protein: 16, carbs: 44, fat: 16, dietTypes: ['Vegetarian', 'Omnivore'], category: 'Dinner' },
    { name: 'Palak Paneer with Roti', calories: 420, protein: 20, carbs: 36, fat: 22, dietTypes: ['Vegetarian', 'Omnivore'], category: 'Dinner' },

    /* --- Non-Vegetarian / Omnivore --- */
    { name: 'Grilled Chicken Breast with Sweet Potato', calories: 450, protein: 42, carbs: 38, fat: 12, dietTypes: ['Omnivore'], category: 'Lunch' },
    { name: 'Turkey & Avocado Sandwich', calories: 420, protein: 30, carbs: 36, fat: 18, dietTypes: ['Omnivore'], category: 'Lunch' },
    { name: 'Chicken Caesar Salad', calories: 380, protein: 34, carbs: 14, fat: 22, dietTypes: ['Omnivore'], category: 'Lunch' },
    { name: 'Grilled Salmon with Asparagus', calories: 480, protein: 38, carbs: 12, fat: 30, dietTypes: ['Omnivore', 'Pescatarian'], category: 'Dinner' },
    { name: 'Lean Beef Stir-fry with Broccoli', calories: 420, protein: 36, carbs: 22, fat: 20, dietTypes: ['Omnivore'], category: 'Dinner' },
    { name: 'Baked Chicken Thighs with Roasted Veggies', calories: 460, protein: 38, carbs: 28, fat: 22, dietTypes: ['Omnivore'], category: 'Dinner' },
    { name: 'Egg White Omelette with Turkey Bacon', calories: 280, protein: 28, carbs: 6, fat: 16, dietTypes: ['Omnivore'], category: 'Breakfast' },

    /* --- Pescatarian --- */
    { name: 'Tuna Poke Bowl', calories: 420, protein: 32, carbs: 44, fat: 14, dietTypes: ['Pescatarian', 'Omnivore'], category: 'Lunch' },
    { name: 'Shrimp & Veggie Pasta', calories: 460, protein: 28, carbs: 52, fat: 16, dietTypes: ['Pescatarian', 'Omnivore'], category: 'Dinner' },
    { name: 'Smoked Salmon on Whole Grain Toast', calories: 320, protein: 22, carbs: 28, fat: 14, dietTypes: ['Pescatarian', 'Omnivore'], category: 'Breakfast' },

    /* --- Vegan --- */
    { name: 'Smoothie Bowl with Plant Protein', calories: 350, protein: 20, carbs: 48, fat: 10, dietTypes: ['Vegan', 'Vegetarian', 'Omnivore'], category: 'Breakfast' },
    { name: 'Buddha Bowl with Tahini Dressing', calories: 480, protein: 18, carbs: 56, fat: 22, dietTypes: ['Vegan', 'Vegetarian', 'Omnivore'], category: 'Lunch' },
    { name: 'Black Bean Tacos with Guacamole', calories: 440, protein: 16, carbs: 52, fat: 20, dietTypes: ['Vegan', 'Vegetarian', 'Omnivore'], category: 'Dinner' },
    { name: 'Tempeh Teriyaki with Brown Rice', calories: 460, protein: 24, carbs: 56, fat: 16, dietTypes: ['Vegan', 'Vegetarian', 'Omnivore'], category: 'Dinner' },

    /* --- Snacks (all diets) --- */
    { name: 'Mixed Nuts (30g)', calories: 180, protein: 6, carbs: 6, fat: 16, dietTypes: ['Vegetarian', 'Vegan', 'Pescatarian', 'Omnivore'], category: 'Snack' },
    { name: 'Apple with Peanut Butter', calories: 220, protein: 6, carbs: 28, fat: 12, dietTypes: ['Vegetarian', 'Vegan', 'Pescatarian', 'Omnivore'], category: 'Snack' },
    { name: 'Protein Bar', calories: 200, protein: 20, carbs: 22, fat: 8, dietTypes: ['Vegetarian', 'Omnivore'], category: 'Snack' },
    { name: 'Hummus with Carrot Sticks', calories: 150, protein: 6, carbs: 18, fat: 8, dietTypes: ['Vegetarian', 'Vegan', 'Pescatarian', 'Omnivore'], category: 'Snack' },
    { name: 'Greek Yogurt with Honey', calories: 160, protein: 14, carbs: 18, fat: 4, dietTypes: ['Vegetarian', 'Omnivore'], category: 'Snack' },
    { name: 'Banana with Almond Butter', calories: 240, protein: 6, carbs: 32, fat: 12, dietTypes: ['Vegetarian', 'Vegan', 'Pescatarian', 'Omnivore'], category: 'Snack' },
    { name: 'Rice Cakes with Avocado', calories: 180, protein: 4, carbs: 22, fat: 10, dietTypes: ['Vegetarian', 'Vegan', 'Pescatarian', 'Omnivore'], category: 'Snack' },
    { name: 'Cottage Cheese with Pineapple', calories: 170, protein: 16, carbs: 18, fat: 4, dietTypes: ['Vegetarian', 'Omnivore'], category: 'Snack' },
  ],

  /**
   * Get meal suggestions based on remaining calories and diet type.
   * @param {number} remainingCalories - Calories left for the day
   * @param {number} remainingProtein - Protein grams left
   * @param {string} dietType - User's diet type
   * @param {string} [mealCategory] - Optional filter: 'Breakfast', 'Lunch', 'Dinner', 'Snack'
   * @returns {Array} Sorted list of matching meals
   */
  getSuggestions(remainingCalories, remainingProtein, dietType, mealCategory) {
    let meals = this.MEAL_DB.filter(m => {
      /* Must fit within remaining calories (with 10% buffer) */
      if (m.calories > remainingCalories * 1.1) return false;
      /* Must match diet type */
      if (!m.dietTypes.includes(dietType)) return false;
      /* Optional category filter */
      if (mealCategory && m.category !== mealCategory) return false;
      return true;
    });

    /* Sort by protein-to-calorie ratio if protein is needed, else by calorie fit */
    if (remainingProtein > 20) {
      meals.sort((a, b) => (b.protein / b.calories) - (a.protein / a.calories));
    } else {
      /* Sort by how close the meal is to remaining calories (best fit first) */
      meals.sort((a, b) => {
        const diffA = Math.abs(remainingCalories * 0.4 - a.calories);
        const diffB = Math.abs(remainingCalories * 0.4 - b.calories);
        return diffA - diffB;
      });
    }

    return meals.slice(0, 6);
  },

  /**
   * Get all unique categories available for a diet type.
   */
  getCategories(dietType) {
    const cats = new Set();
    this.MEAL_DB.forEach(m => {
      if (m.dietTypes.includes(dietType)) cats.add(m.category);
    });
    return Array.from(cats);
  },
};
