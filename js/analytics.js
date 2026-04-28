/* ============================================
   Predictive Analytics Engine
   Time-series analysis on meal history data
   Trend detection, deficiency alerts, predictions
   ============================================ */

const Analytics = {
  /**
   * Get extended meal history (up to 30 days)
   */
  getExtendedHistory(days = 30) {
    const allLogs = Storage.load(Storage.KEYS.MEAL_LOG, {});
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
      result.push({ date: key, meals, totalCalories, totalProtein, totalCarbs, totalFat, mealCount: meals.length });
    }
    return result.reverse(); /* Chronological order */
  },

  /**
   * Calculate moving average for a metric
   */
  movingAverage(data, field, window = 7) {
    const values = data.map(d => d[field]);
    const result = [];
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - window + 1);
      const slice = values.slice(start, i + 1);
      const nonZero = slice.filter(v => v > 0);
      const avg = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
      result.push(Math.round(avg));
    }
    return result;
  },

  /**
   * Detect trend direction (increasing, decreasing, stable)
   */
  detectTrend(data, field) {
    const nonZero = data.filter(d => d[field] > 0);
    if (nonZero.length < 3) return { direction: 'insufficient_data', slope: 0 };

    const recent = nonZero.slice(-7);
    const earlier = nonZero.slice(-14, -7);

    if (earlier.length === 0) return { direction: 'insufficient_data', slope: 0 };

    const recentAvg = recent.reduce((s, d) => s + d[field], 0) / recent.length;
    const earlierAvg = earlier.reduce((s, d) => s + d[field], 0) / earlier.length;

    const change = ((recentAvg - earlierAvg) / earlierAvg) * 100;

    if (change > 10) return { direction: 'increasing', slope: change, recentAvg: Math.round(recentAvg), earlierAvg: Math.round(earlierAvg) };
    if (change < -10) return { direction: 'decreasing', slope: change, recentAvg: Math.round(recentAvg), earlierAvg: Math.round(earlierAvg) };
    return { direction: 'stable', slope: change, recentAvg: Math.round(recentAvg), earlierAvg: Math.round(earlierAvg) };
  },

  /**
   * Predict next day values using linear regression
   */
  predictNext(data, field) {
    const nonZero = data.filter(d => d[field] > 0);
    if (nonZero.length < 3) return null;

    const recent = nonZero.slice(-7);
    const n = recent.length;
    const xMean = (n - 1) / 2;
    const yMean = recent.reduce((s, d) => s + d[field], 0) / n;

    let num = 0, den = 0;
    recent.forEach((d, i) => {
      num += (i - xMean) * (d[field] - yMean);
      den += (i - xMean) ** 2;
    });

    const slope = den !== 0 ? num / den : 0;
    const intercept = yMean - slope * xMean;
    const predicted = Math.round(intercept + slope * n);

    return Math.max(0, predicted);
  },

  /**
   * Identify nutritional deficiencies
   */
  identifyDeficiencies(data, profile) {
    if (!profile || !profile.weight) return [];

    const calc = CalorieCalculator.calculate(profile);
    const alerts = [];
    const activeDays = data.filter(d => d.mealCount > 0);

    if (activeDays.length < 3) return [{ type: 'info', message: 'Log meals for at least 3 days to see deficiency analysis.' }];

    const recent = activeDays.slice(-7);
    const avgCalories = Math.round(recent.reduce((s, d) => s + d.totalCalories, 0) / recent.length);
    const avgProtein = Math.round(recent.reduce((s, d) => s + d.totalProtein, 0) / recent.length);
    const avgCarbs = Math.round(recent.reduce((s, d) => s + d.totalCarbs, 0) / recent.length);
    const avgFat = Math.round(recent.reduce((s, d) => s + d.totalFat, 0) / recent.length);

    /* Check calorie intake */
    const calRatio = avgCalories / calc.targetCalories;
    if (calRatio < 0.7) {
      alerts.push({ type: 'warning', metric: 'Calories', message: `Average intake (${avgCalories} kcal) is ${Math.round((1-calRatio)*100)}% below your target (${calc.targetCalories} kcal). Consider increasing portion sizes.` });
    } else if (calRatio > 1.3) {
      alerts.push({ type: 'warning', metric: 'Calories', message: `Average intake (${avgCalories} kcal) is ${Math.round((calRatio-1)*100)}% above your target (${calc.targetCalories} kcal). Consider reducing portions.` });
    }

    /* Check protein */
    const protRatio = avgProtein / calc.macros.protein;
    if (protRatio < 0.7) {
      alerts.push({ type: 'danger', metric: 'Protein', message: `Average protein (${avgProtein}g) is significantly below target (${calc.macros.protein}g). Add lean meats, eggs, legumes, or protein shakes.` });
    }

    /* Check carbs */
    const carbRatio = avgCarbs / calc.macros.carbs;
    if (carbRatio < 0.6) {
      alerts.push({ type: 'info', metric: 'Carbs', message: `Carb intake (${avgCarbs}g avg) is low vs target (${calc.macros.carbs}g). Add whole grains, fruits, or starchy vegetables.` });
    }

    /* Check fat */
    const fatRatio = avgFat / calc.macros.fat;
    if (fatRatio < 0.6) {
      alerts.push({ type: 'info', metric: 'Fat', message: `Fat intake (${avgFat}g avg) is low vs target (${calc.macros.fat}g). Add nuts, avocado, olive oil, or fatty fish.` });
    } else if (fatRatio > 1.5) {
      alerts.push({ type: 'warning', metric: 'Fat', message: `Fat intake (${avgFat}g avg) is high vs target (${calc.macros.fat}g). Consider reducing fried foods and saturated fats.` });
    }

    if (alerts.length === 0) {
      alerts.push({ type: 'success', message: 'Great job! Your nutrition is well-balanced based on recent data.' });
    }

    return alerts;
  },

  /**
   * Generate weekly summary
   */
  weeklySummary(data) {
    const activeDays = data.filter(d => d.mealCount > 0).slice(-7);
    if (activeDays.length === 0) return null;

    const totalMeals = activeDays.reduce((s, d) => s + d.mealCount, 0);
    const avgCalories = Math.round(activeDays.reduce((s, d) => s + d.totalCalories, 0) / activeDays.length);
    const avgProtein = Math.round(activeDays.reduce((s, d) => s + d.totalProtein, 0) / activeDays.length);
    const bestDay = activeDays.reduce((best, d) => d.mealCount > best.mealCount ? d : best, activeDays[0]);
    const consistency = Math.round((activeDays.length / 7) * 100);

    return {
      daysTracked: activeDays.length,
      totalMeals,
      avgCalories,
      avgProtein,
      bestDay: bestDay.date,
      consistency,
    };
  },

  /**
   * Get meal timing patterns
   */
  getMealTimingPatterns(data) {
    const hours = {};
    data.forEach(d => {
      d.meals.forEach(m => {
        if (m.timestamp) {
          const hour = new Date(m.timestamp).getHours();
          hours[hour] = (hours[hour] || 0) + 1;
        }
      });
    });
    return hours;
  },
};
