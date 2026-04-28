/* ============================================
   Personalized AI Learning Module
   Tracks user preferences, dietary patterns,
   and improves recommendations over time
   ============================================ */

const AILearning = {
  KEYS: {
    PREFERENCES: 'dp_ai_preferences',
    FEEDBACK: 'dp_ai_feedback',
    FREQUENT_FOODS: 'dp_frequent_foods',
  },

  /**
   * Record that a user liked a meal/food
   */
  likeMeal(mealName, category) {
    const prefs = Storage.load(this.KEYS.PREFERENCES, { liked: [], disliked: [], tags: {} });
    if (!prefs.liked.includes(mealName)) {
      prefs.liked.push(mealName);
      /* Track category preference */
      if (category) {
        prefs.tags[category] = (prefs.tags[category] || 0) + 1;
      }
    }
    /* Remove from disliked if present */
    prefs.disliked = prefs.disliked.filter(m => m !== mealName);
    Storage.save(this.KEYS.PREFERENCES, prefs);
  },

  /**
   * Record that a user disliked a meal/food
   */
  dislikeMeal(mealName) {
    const prefs = Storage.load(this.KEYS.PREFERENCES, { liked: [], disliked: [], tags: {} });
    if (!prefs.disliked.includes(mealName)) {
      prefs.disliked.push(mealName);
    }
    prefs.liked = prefs.liked.filter(m => m !== mealName);
    Storage.save(this.KEYS.PREFERENCES, prefs);
  },

  /**
   * Track frequently logged foods
   */
  trackFood(foodName) {
    const foods = Storage.load(this.KEYS.FREQUENT_FOODS, {});
    foods[foodName] = (foods[foodName] || 0) + 1;
    Storage.save(this.KEYS.FREQUENT_FOODS, foods);
  },

  /**
   * Get top N frequently consumed foods
   */
  getFrequentFoods(limit = 10) {
    const foods = Storage.load(this.KEYS.FREQUENT_FOODS, {});
    return Object.entries(foods)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  },

  /**
   * Get user preferences summary
   */
  getPreferences() {
    return Storage.load(this.KEYS.PREFERENCES, { liked: [], disliked: [], tags: {} });
  },

  /**
   * Save feedback on a diet plan
   */
  savePlanFeedback(planId, rating, comment) {
    const feedback = Storage.load(this.KEYS.FEEDBACK, []);
    feedback.push({
      planId,
      rating,
      comment,
      timestamp: new Date().toISOString(),
    });
    /* Keep last 50 feedback entries */
    if (feedback.length > 50) feedback.splice(0, feedback.length - 50);
    Storage.save(this.KEYS.FEEDBACK, feedback);
  },

  /**
   * Get enhanced suggestions based on learning
   * Filters out disliked foods and boosts liked categories
   */
  getSmartSuggestions(remainingCalories, remainingProtein, dietType, mealCategory) {
    const prefs = this.getPreferences();
    const frequent = this.getFrequentFoods(5);

    /* Get base suggestions */
    let meals = MealRecommendations.getSuggestions(remainingCalories, remainingProtein, dietType, mealCategory);

    /* Filter out disliked meals */
    meals = meals.filter(m => !prefs.disliked.includes(m.name));

    /* Boost score for liked categories */
    meals.sort((a, b) => {
      const aScore = prefs.liked.includes(a.name) ? 2 : (prefs.tags[a.category] || 0);
      const bScore = prefs.liked.includes(b.name) ? 2 : (prefs.tags[b.category] || 0);
      return bScore - aScore;
    });

    return meals;
  },

  /**
   * Generate preference context for AI prompts
   */
  getPromptContext() {
    const prefs = this.getPreferences();
    const frequent = this.getFrequentFoods(5);
    let context = '';

    if (prefs.liked.length > 0) {
      context += `\nUser's liked foods: ${prefs.liked.slice(-10).join(', ')}`;
    }
    if (prefs.disliked.length > 0) {
      context += `\nUser's disliked foods (AVOID these): ${prefs.disliked.join(', ')}`;
    }
    if (frequent.length > 0) {
      context += `\nFrequently consumed: ${frequent.map(f => f.name).join(', ')}`;
    }

    return context;
  },

  /**
   * Clear all learning data
   */
  reset() {
    Storage.remove(this.KEYS.PREFERENCES);
    Storage.remove(this.KEYS.FEEDBACK);
    Storage.remove(this.KEYS.FREQUENT_FOODS);
  },
};
