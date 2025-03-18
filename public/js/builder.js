document.addEventListener("DOMContentLoaded", function() {
  // Mapping for image filenames per category
  const imageMap = {
    dough: {
      classic: "classic.png",
      pan_crust: "pan.png",
      thin_crust: "thin.png"
    },
    sauce: {
      marinara: "marinara.png",
      vodka: "vodka.png",
      pesto: "pesto.png",
      white_sauce: "white.png",
      bbq: "bbq.png"
    },
    cheese: {
      mozzarella: "mozzarella.png",
      extra_mozzarella: "extramozzarella.png",
      provolone: "provolone.png",
      cheddar: "cheddar.png",
      fresh_mozzarella: "freshmozzarella.png",
      blue_cheese: "blue.png",
      extra_fresh_mozzarella: "extrafreshmozzarella.png",
      ricotta: "ricotta.png",
      feta_crumbled: "crumbledfeta.png",
      feta_chunks: "fetachunks.png",
      vegan: "vegan.png"
    },
    proteins: {
      pepperoni: "pepperoni.png",
      pepperoni_cups: "pepperoni_cups.png",
      salami: "salami.png",
      ham: "ham.png",
      ground_beef: "groundbeef.png",
      bacon_crumble: "baconcrumble.png",
      bacon_strips: "baconstrips.png",
      crumbled_sausage: "crumbledsausage.png",
      diced_chicken: "dicedchicken.png"
    },
    veggies: {
      spinach: "spinach.png",
      sliced_tomatoes: "tomatosliced.png",
      mushrooms: "mushrooms.png",
      jalapenos: "jalapeno.png",
      green_olives: "greenolives.png",
      black_olives: "blackolives.png",
      pineapple: "pineapple.png",
      diced_green_peppers: "dicedgreenpepper.png",
      slivered_green_peppers: "sliveredgreenpepper.png",
      white_onion: "oniondiced.png",
      slivered_white_onion: "onionslivered.png",
      slivered_red_onion: "redonionslivered.png",
      caramelized_onion: "carmelizedonion.png",
      broccolli: "broccolli.png",
      basil: "basil.png"
    },
    extras: {
      marinara: "marinara.png",
      parmesan: "parmesan.png",
      pepper: "pepper.png",
      salt: "salt.png",
      chili_flakes: "chiliflakes.png",
      oregano: "oregano.png",
      garlic_drizzle: "garlicdrizzle.png",
      balsamic_drizzle: "blasamicdrizzle.png"
    }
  };

  // Single-selection categories
  const singleSelectionCategories = ["size", "dough", "sauce"];

  let selectedOptions = {
    size: ["large"],
    dough: ["classic"],
    sauce: ["marinara"],
    cheese: ["mozzarella"],
    proteins: ["pepperoni"],
    veggies: [],
    extras: []
  };

  // Stacking order arrays for multi-selection categories.
  const cheeseOrder = [
    "mozzarella",
    "extra_mozzarella",
    "provolone",
    "cheddar",
    "fresh_mozzarella",
    "blue_cheese",
    "extra_fresh_mozzarella",
    "ricotta",
    "feta_crumbled",
    "feta_chunks",
    "vegan"
  ];

  const proteinsOrder = [
    "pepperoni",
    "diced_chicken",
    "salami",
    "ham",
    "ground_beef",
    "bacon_crumble",
    "bacon_strips",
    "crumbled_sausage",
    "pepperoni_cups"
  ];

  const veggiesOrder = [
    "spinach",
    "sliced_tomatoes",
    "mushrooms",
    "jalapenos",
    "green_olives",
    "black_olives",
    "pineapple",
    "diced_green_peppers",
    "slivered_green_peppers",
    "white_onion",
    "slivered_white_onion",
    "slivered_red_onion",
    "caramelized_onion",
    "broccolli",
    "basil"
  ];

  const extrasOrder = [
    "marinara",
    "parmesan",
    "pepper",
    "salt",
    "chili_flakes",
    "oregano",
    "garlic_drizzle",
    "balsamic_drizzle"
  ];

  // Update pizza preview: add layers in proper stacking order
  function updatePizzaPreview() {
    const pizzaPreview = document.getElementById("pizzaPreview");
    // Clear existing layers
    pizzaPreview.innerHTML = "";

    // 0. Pan (always at bottom)
    const panImg = document.createElement("img");
    panImg.src = "images/pan/pan.png";
    panImg.classList.add("pizza-layer", "pan");
    pizzaPreview.appendChild(panImg);

    // 1. Dough (single selection)
    if (selectedOptions.dough.length > 0) {
      const doughValue = selectedOptions.dough[0];
      const doughImg = document.createElement("img");
      doughImg.src = `images/dough/${imageMap.dough[doughValue]}`;
      doughImg.classList.add("pizza-layer", "dough");
      pizzaPreview.appendChild(doughImg);
    }

    // 2. Sauce (single selection)
    if (selectedOptions.sauce.length > 0) {
      const sauceValue = selectedOptions.sauce[0];
      const sauceImg = document.createElement("img");
      sauceImg.src = `images/sauce/${imageMap.sauce[sauceValue]}`;
      sauceImg.classList.add("pizza-layer", "sauce");
      pizzaPreview.appendChild(sauceImg);
    }

    // 3. Cheese layers (sorted)
    if (selectedOptions.cheese.length > 0) {
      const sortedCheese = selectedOptions.cheese.slice().sort((a, b) =>
        cheeseOrder.indexOf(a) - cheeseOrder.indexOf(b)
      );
      sortedCheese.forEach(cheeseValue => {
        const cheeseImg = document.createElement("img");
        cheeseImg.src = `images/cheese/${imageMap.cheese[cheeseValue]}`;
        cheeseImg.classList.add("pizza-layer", "cheese");
        pizzaPreview.appendChild(cheeseImg);
      });
    }

    // 4. Proteins layers (sorted)
    if (selectedOptions.proteins.length > 0) {
      const sortedProteins = selectedOptions.proteins.slice().sort((a, b) =>
        proteinsOrder.indexOf(a) - proteinsOrder.indexOf(b)
      );
      sortedProteins.forEach(proteinValue => {
        const proteinImg = document.createElement("img");
        proteinImg.src = `images/proteins/${imageMap.proteins[proteinValue]}`;
        proteinImg.classList.add("pizza-layer", "proteins");
        pizzaPreview.appendChild(proteinImg);
      });
    }

    // 5. Veggies layers (sorted)
    if (selectedOptions.veggies.length > 0) {
      const sortedVeggies = selectedOptions.veggies.slice().sort((a, b) =>
        veggiesOrder.indexOf(a) - veggiesOrder.indexOf(b)
      );
      sortedVeggies.forEach(veggieValue => {
        const veggieImg = document.createElement("img");
        veggieImg.src = `images/veggies/${imageMap.veggies[veggieValue]}`;
        veggieImg.classList.add("pizza-layer", "veggies");
        pizzaPreview.appendChild(veggieImg);
      });
    }

    // 6. Extras layers (sorted)
    if (selectedOptions.extras.length > 0) {
      const sortedExtras = selectedOptions.extras.slice().sort((a, b) =>
        extrasOrder.indexOf(a) - extrasOrder.indexOf(b)
      );
      sortedExtras.forEach(extraValue => {
        const extraImg = document.createElement("img");
        extraImg.src = `images/extras/${imageMap.extras[extraValue]}`;
        extraImg.classList.add("pizza-layer", "extras");
        pizzaPreview.appendChild(extraImg);
      });
    }

    // Scale the preview based on size selection (optional)
    let scaleFactor = 1.0;
    if (selectedOptions.size.includes("small")) scaleFactor = 0.8;
    if (selectedOptions.size.includes("medium")) scaleFactor = 0.9;
    if (selectedOptions.size.includes("large")) scaleFactor = 1.0;
    if (selectedOptions.size.includes("xlarge")) scaleFactor = 1.1;
    if (selectedOptions.size.includes("square_slab")) scaleFactor = 1.0;
    pizzaPreview.style.transform = `scale(${scaleFactor})`;
  }

  // Accordion behavior: toggle panels
  const accordionHeaders = document.querySelectorAll(".accordion-header");
  accordionHeaders.forEach(header => {
    header.addEventListener("click", () => {
      const parentItem = header.parentElement;
      const accordion = parentItem.parentElement;
      accordion.querySelectorAll(".accordion-item").forEach(item => {
        if (item !== parentItem) {
          item.classList.remove("active");
        }
      });
      parentItem.classList.toggle("active");
    });
  });

  // Option button toggling
  const optionButtons = document.querySelectorAll(".option-button");
  optionButtons.forEach(button => {
    button.addEventListener("click", () => {
      const category = button.getAttribute("data-category");
      const value = button.getAttribute("data-value");

      if (singleSelectionCategories.includes(category)) {
        document.querySelectorAll(`.option-button[data-category="${category}"]`)
          .forEach(btn => btn.classList.remove("selected"));
        selectedOptions[category] = [value];
        button.classList.add("selected");
      } else {
        if (selectedOptions[category].includes(value)) {
          selectedOptions[category] = selectedOptions[category].filter(item => item !== value);
          button.classList.remove("selected");
        } else {
          selectedOptions[category].push(value);
          button.classList.add("selected");
        }
      }
      updatePizzaPreview();
    });
  });

  // Initialize default selections
  function initDefaultSelections() {
    for (let category in selectedOptions) {
      selectedOptions[category].forEach(value => {
        const btn = document.querySelector(`.option-button[data-category="${category}"][data-value="${value}"]`);
        if (btn) {
          btn.classList.add("selected");
        }
      });
    }
  }

  initDefaultSelections();
  updatePizzaPreview();
});
