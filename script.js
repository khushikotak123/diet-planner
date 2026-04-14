const form = document.getElementById("dietForm");
const result = document.getElementById("result");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    age: form.age.value,
    gender: form.gender.value,
    height: form.height.value,
    weight: form.weight.value,
    goal: form.goal.value,
    dietType: form.dietType.value,
    allergies: form.allergies.value,
  };

  result.innerHTML = "Loading...";

  try {
    const res = await fetch("http://localhost:5000/diet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    const plan = JSON.parse(json.plan); 

    let html = "";

    plan.meals.forEach((meal) => {
      html += `<h3>${meal.meal} - ${meal.calories} kcal</h3><ul>`;
      meal.items.forEach((item) => (html += `<li>${item}</li>`));
      html += `</ul>`;
      html += `<p>Protein: ${meal.protein}g, Carbs: ${meal.carbs}g, Fat: ${meal.fat}g</p>`;
    });

    if (plan.snacks.length) {
      html += `<h3>Snacks - ${plan.snacks.reduce((a,b) => a+b.calories,0)} kcal</h3>`;
      plan.snacks.forEach((snack) => {
        html += `<ul>`;
        snack.items.forEach((item) => (html += `<li>${item}</li>`));
        html += `</ul>`;
      });
    }

    html += `<h3>Total Calories: ${plan.totalCalories} kcal</h3>`;
    html += `<p><strong>Notes:</strong> ${plan.notes}</p>`;

    result.innerHTML = html;
  } catch (err) {
    console.error(err);
    result.innerHTML = "Error fetching diet plan.";
  }
});
