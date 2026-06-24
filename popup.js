document.addEventListener("DOMContentLoaded", async () => {
  const tabs = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const avatarPreview = document.getElementById("avatarPreview");
  const previewLoader = document.getElementById("previewLoader");
  const errorMessage = document.getElementById("errorMessage");
  const applyBtn = document.getElementById("applyBtn");
  const randomBtn = document.getElementById("randomBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Hair Gradient UI Toggles
  const hairGradientType = document.getElementById("hairGradientType");
  const hairColor2Group = document.getElementById("hairColor2Group");
  const hairGradientDirGroup = document.getElementById("hairGradientDirGroup");
  const hairColor1Label = document.getElementById("hairColor1Label");

  // Presets Containers
  const bgPresetsContainer = document.getElementById("bgPresets");
  const hairPresetsContainer = document.getElementById("hairPresets");
  const skinPresets = document.querySelectorAll("#skinPresets .color-swatch");

  // Add Preset Buttons
  const addBgPresetBtn = document.getElementById("addBgPreset");
  const addHairPresetBtn = document.getElementById("addHairPreset");

  let userToken = "";
  let userProfile = null;
  let currentSvgText = "";

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  // Color picker hex labels auto-sync
  const colorInputs = document.querySelectorAll('input[type="color"]');
  colorInputs.forEach(input => {
    input.addEventListener("input", (e) => {
      const hexSpan = document.getElementById(`${e.target.id}Hex`);
      if (hexSpan) {
        hexSpan.textContent = e.target.value;
      }
      // Remove active states on preset swatches when user manually picks a color
      if (e.target.id === "skinColor") {
        skinPresets.forEach(s => s.classList.remove("active"));
      } else if (e.target.id === "bgColor") {
        document.querySelectorAll("#bgPresets .color-swatch").forEach(s => s.classList.remove("active"));
      } else if (e.target.id === "hairColor" || e.target.id === "hairColor2") {
        document.querySelectorAll("#hairPresets .color-swatch").forEach(s => s.classList.remove("active"));
      }
      debouncedLoadPreview();
    });
  });

  // Hair Gradient Type Toggle logic
  hairGradientType.addEventListener("change", () => {
    toggleHairGradientFields();
    debouncedLoadPreview();
  });

  function toggleHairGradientFields() {
    if (hairGradientType.value === "gradient") {
      hairColor2Group.classList.remove("hidden");
      hairGradientDirGroup.classList.remove("hidden");
      hairColor1Label.textContent = "Saç Rengi 1 (Üst)";
    } else {
      hairColor2Group.classList.add("hidden");
      hairGradientDirGroup.classList.add("hidden");
      hairColor1Label.textContent = "Saç Rengi";
    }
  }

  // Form elements event listeners
  const formElements = document.querySelectorAll("select, input[type='text'], input[type='checkbox']");
  formElements.forEach(elem => {
    elem.addEventListener("change", () => debouncedLoadPreview());
    if (elem.tagName === "INPUT" && elem.type === "text") {
      elem.addEventListener("input", () => debouncedLoadPreview());
    }
  });

  // PRESETS MANAGEMENT
  
  // 1. Skin Presets (Static standard colors)
  skinPresets.forEach(swatch => {
    swatch.addEventListener("click", () => {
      const color = swatch.dataset.color;
      document.getElementById("skinColor").value = color;
      document.getElementById("skinColorHex").textContent = color;
      
      skinPresets.forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
      
      debouncedLoadPreview();
    });
  });

  function highlightActiveSkinPreset(color) {
    skinPresets.forEach(swatch => {
      if (swatch.dataset.color.toLowerCase() === color.toLowerCase()) {
        swatch.classList.add("active");
      } else {
        swatch.classList.remove("active");
      }
    });
  }

  // 2. Background Presets (Custom)
  function getBgPresets() {
    try {
      return JSON.parse(localStorage.getItem("parolla_avatar_bg_presets")) || [];
    } catch {
      return [];
    }
  }

  function saveBgPresets(presets) {
    localStorage.setItem("parolla_avatar_bg_presets", JSON.stringify(presets));
  }

  function renderBgPresets() {
    bgPresetsContainer.innerHTML = "";
    const presets = getBgPresets();
    const currentVal = document.getElementById("bgColor").value.toLowerCase();

    presets.forEach((color, idx) => {
      const swatch = document.createElement("div");
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = color;
      swatch.title = color;
      if (color.toLowerCase() === currentVal) {
        swatch.classList.add("active");
      }

      // Click to apply
      swatch.addEventListener("click", () => {
        document.getElementById("bgColor").value = color;
        document.getElementById("bgColorHex").textContent = color;
        
        document.querySelectorAll("#bgPresets .color-swatch").forEach(s => s.classList.remove("active"));
        swatch.classList.add("active");
        debouncedLoadPreview();
      });

      // Remove preset element
      const removeBtn = document.createElement("span");
      removeBtn.className = "remove-preset";
      removeBtn.innerHTML = "&times;";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Avoid applying preset when removing
        const updated = getBgPresets();
        updated.splice(idx, 1);
        saveBgPresets(updated);
        renderBgPresets();
      });

      swatch.appendChild(removeBtn);
      bgPresetsContainer.appendChild(swatch);
    });
  }

  addBgPresetBtn.addEventListener("click", () => {
    const color = document.getElementById("bgColor").value;
    const presets = getBgPresets();
    if (!presets.includes(color)) {
      presets.push(color);
      saveBgPresets(presets);
      renderBgPresets();
    }
  });

  // 3. Hair Presets (Custom - Solid & Gradient)
  function getHairPresets() {
    try {
      return JSON.parse(localStorage.getItem("parolla_avatar_hair_presets")) || [];
    } catch {
      return [];
    }
  }

  function saveHairPresets(presets) {
    localStorage.setItem("parolla_avatar_hair_presets", JSON.stringify(presets));
  }

  function renderHairPresets() {
    hairPresetsContainer.innerHTML = "";
    const presets = getHairPresets();
    
    presets.forEach((preset, idx) => {
      const swatch = document.createElement("div");
      swatch.className = "color-swatch";
      
      if (preset.type === "gradient") {
        swatch.style.background = `linear-gradient(135deg, ${preset.color1}, ${preset.color2})`;
        swatch.title = `Gradyan: ${preset.color1} -> ${preset.color2}`;
      } else {
        swatch.style.backgroundColor = preset.color1;
        swatch.title = `Düz: ${preset.color1}`;
      }

      // Click to apply
      swatch.addEventListener("click", () => {
        hairGradientType.value = preset.type;
        document.getElementById("hairColor").value = preset.color1;
        document.getElementById("hairColorHex").textContent = preset.color1;
        
        if (preset.type === "gradient") {
          document.getElementById("hairColor2").value = preset.color2;
          document.getElementById("hairColor2Hex").textContent = preset.color2;
          document.getElementById("hairGradientDir").value = preset.dir || "vertical";
        }
        
        toggleHairGradientFields();
        document.querySelectorAll("#hairPresets .color-swatch").forEach(s => s.classList.remove("active"));
        swatch.classList.add("active");
        debouncedLoadPreview();
      });

      // Remove preset element
      const removeBtn = document.createElement("span");
      removeBtn.className = "remove-preset";
      removeBtn.innerHTML = "&times;";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const updated = getHairPresets();
        updated.splice(idx, 1);
        saveHairPresets(updated);
        renderHairPresets();
      });

      swatch.appendChild(removeBtn);
      hairPresetsContainer.appendChild(swatch);
    });
  }

  addHairPresetBtn.addEventListener("click", () => {
    const type = hairGradientType.value;
    const color1 = document.getElementById("hairColor").value;
    const color2 = document.getElementById("hairColor2").value;
    const dir = document.getElementById("hairGradientDir").value;

    const presets = getHairPresets();
    
    // Check duplicates
    const isDuplicate = presets.some(p => 
      p.type === type && 
      p.color1.toLowerCase() === color1.toLowerCase() && 
      (type === "solid" || (p.color2.toLowerCase() === color2.toLowerCase() && p.dir === dir))
    );

    if (!isDuplicate) {
      presets.push({ type, color1, color2, dir });
      saveHairPresets(presets);
      renderHairPresets();
    }
  });


  // Show error helper
  function showError(msg) {
    if (msg) {
      errorMessage.textContent = msg;
      errorMessage.style.display = "block";
    } else {
      errorMessage.style.display = "none";
    }
  }

  // Get token from Parolla.app page cookies
  async function initialize() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url.includes("parolla.app")) {
        showError("Lütfen bu işlemi Parolla.app profil/avatar düzenleme sayfasında yapın!");
        disableForm(true);
        return;
      }

      // Execute script in page context to extract token
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const cookieMatch = document.cookie.match(/(^|;\s*)auth\._token\.google=([^;]*)/);
          if (!cookieMatch) return null;
          const rawToken = decodeURIComponent(cookieMatch[2]);
          return rawToken.replace("Bearer ", "").trim();
        }
      });

      const token = results && results[0] ? results[0].result : null;
      if (!token) {
        showError("Giriş anahtarı (Cookie) bulunamadı! Lütfen hesabınıza giriş yaptığınızdan emin olun.");
        disableForm(true);
        return;
      }

      userToken = token;
      
      // Load stored custom color presets
      renderBgPresets();
      renderHairPresets();

      await fetchUserProfile();
    } catch (err) {
      showError("Başlatma sırasında hata oluştu: " + err.message);
      disableForm(true);
    }
  }

  // Disable/Enable form controls
  function disableForm(disabled) {
    const inputs = document.querySelectorAll("select, input, button");
    inputs.forEach(input => {
      if (input.id !== "errorMessage") {
        input.disabled = disabled;
      }
    });
  }

  // Fetch current profile from Parolla
  async function fetchUserProfile() {
    try {
      previewLoader.style.display = "flex";
      const res = await fetch("https://strapi.parolla.app/api/users/me", {
        headers: { "authorization": "Bearer " + userToken }
      });
      if (!res.ok) {
        throw new Error("Sunucudan profil bilgileri çekilemedi! Durum: " + res.status);
      }
      userProfile = await res.json();
      
      if (userProfile && userProfile.diceBear) {
        populateForm(userProfile.diceBear.config || {});
      } else {
        // Fallback default config if none exists
        loadPreview();
      }
    } catch (err) {
      showError(err.message);
    } finally {
      previewLoader.style.display = "none";
    }
  }

  // Helper to extract value from config (handles both array and raw values)
  function getConfigVal(config, key, defaultVal) {
    if (config[key] === undefined) return defaultVal;
    if (Array.isArray(config[key])) {
      return config[key][0] !== undefined ? config[key][0] : defaultVal;
    }
    return config[key];
  }

  // Populate form controls from Parolla config
  function populateForm(config) {
    // 1. Genel Sekme
    document.getElementById("bgType").value = getConfigVal(config, "backgroundType", "solid");
    
    const bgColor = getConfigVal(config, "backgroundColor", "65c9ff");
    const bgPicker = document.getElementById("bgColor");
    bgPicker.value = bgColor.startsWith("#") ? bgColor : `#${bgColor}`;
    document.getElementById("bgColorHex").textContent = bgPicker.value;

    const skinColor = getConfigVal(config, "skinColor", "f2d3b1");
    const skinPicker = document.getElementById("skinColor");
    skinPicker.value = skinColor.startsWith("#") ? skinColor : `#${skinColor}`;
    document.getElementById("skinColorHex").textContent = skinPicker.value;
    
    // Highlight standard skin preset if matches
    highlightActiveSkinPreset(skinPicker.value);

    document.getElementById("avatarStyle").value = getConfigVal(config, "style", "default");
    document.getElementById("flip").checked = getConfigVal(config, "flip", false);
    document.getElementById("scale").value = getConfigVal(config, "scale", "100");
    document.getElementById("seed").value = getConfigVal(config, "seed", "");

    // 2. Saç Sekme
    const hairVal = getConfigVal(config, "hair", "short01");
    const hairProb = getConfigVal(config, "hairProbability", 100);
    document.getElementById("hair").value = hairProb === 0 ? "none" : hairVal;

    const hairColor = getConfigVal(config, "hairColor", "cb6820");
    const hairPicker = document.getElementById("hairColor");
    hairPicker.value = hairColor.startsWith("#") ? hairColor : `#${hairColor}`;
    document.getElementById("hairColorHex").textContent = hairPicker.value;

    // Hair Gradient configs (custom extension fields inside config)
    hairGradientType.value = getConfigVal(config, "hairGradientType", "solid");
    
    const hairColor2 = getConfigVal(config, "hairColor2", "ab2a18");
    const hair2Picker = document.getElementById("hairColor2");
    hair2Picker.value = hairColor2.startsWith("#") ? hairColor2 : `#${hairColor2}`;
    document.getElementById("hairColor2Hex").textContent = hair2Picker.value;

    document.getElementById("hairGradientDir").value = getConfigVal(config, "hairGradientDir", "vertical");

    toggleHairGradientFields();

    // 3. Yüz Sekme
    document.getElementById("eyes").value = getConfigVal(config, "eyes", "variant01");
    document.getElementById("eyebrows").value = getConfigVal(config, "eyebrows", "variant01");
    document.getElementById("mouth").value = getConfigVal(config, "mouth", "variant01");

    // 4. Detay / Gözlük
    const glassesVal = getConfigVal(config, "glasses", "none");
    const glassesProb = getConfigVal(config, "glassesProbability", 0);
    document.getElementById("glasses").value = glassesProb === 0 ? "none" : glassesVal;

    const earringsVal = getConfigVal(config, "earrings", "none");
    const earringsProb = getConfigVal(config, "earringsProbability", 0);
    document.getElementById("earrings").value = earringsProb === 0 ? "none" : earringsVal;

    // Features checkboxes (mustache, blush, birthmark, freckles)
    const featuresList = config.features || [];
    document.getElementById("feat_mustache").checked = featuresList.includes("mustache");
    document.getElementById("feat_blush").checked = featuresList.includes("blush");
    document.getElementById("feat_birthmark").checked = featuresList.includes("birthmark");
    document.getElementById("feat_freckles").checked = featuresList.includes("freckles");

    // Refresh custom presets highlighting
    renderBgPresets();
    renderHairPresets();

    loadPreview();
  }

  // Collect values and build DiceBear config object
  function collectConfig() {
    const config = {};

    // Helper to strip #
    const cleanHex = (val) => val.replace("#", "").toLowerCase();

    // 1. Genel
    config.backgroundType = [document.getElementById("bgType").value];
    config.backgroundColor = [cleanHex(document.getElementById("bgColor").value)];
    config.skinColor = [cleanHex(document.getElementById("skinColor").value)];
    config.style = [document.getElementById("avatarStyle").value];
    config.flip = document.getElementById("flip").checked;
    
    const scaleVal = parseInt(document.getElementById("scale").value, 10);
    config.scale = isNaN(scaleVal) ? 100 : Math.max(0, Math.min(200, scaleVal));

    const seedVal = document.getElementById("seed").value.trim();
    if (seedVal) {
      config.seed = seedVal;
    }

    // 2. Saç
    const hairSelected = document.getElementById("hair").value;
    if (hairSelected === "none") {
      config.hairProbability = 0;
    } else {
      config.hair = [hairSelected];
      config.hairProbability = 100;
    }
    config.hairColor = [cleanHex(document.getElementById("hairColor").value)];

    // Hair Gradient Custom Fields
    config.hairGradientType = hairGradientType.value;
    config.hairColor2 = [cleanHex(document.getElementById("hairColor2").value)];
    config.hairGradientDir = document.getElementById("hairGradientDir").value;

    // 3. Yüz
    config.eyes = [document.getElementById("eyes").value];
    config.eyebrows = [document.getElementById("eyebrows").value];
    config.mouth = [document.getElementById("mouth").value];

    // 4. Detaylar
    const glassesSelected = document.getElementById("glasses").value;
    if (glassesSelected === "none") {
      config.glassesProbability = 0;
    } else {
      config.glasses = [glassesSelected];
      config.glassesProbability = 100;
    }

    const earringsSelected = document.getElementById("earrings").value;
    if (earringsSelected === "none") {
      config.earringsProbability = 0;
    } else {
      config.earrings = [earringsSelected];
      config.earringsProbability = 100;
    }

    // Features
    const featuresArray = [];
    if (document.getElementById("feat_mustache").checked) featuresArray.push("mustache");
    if (document.getElementById("feat_blush").checked) featuresArray.push("blush");
    if (document.getElementById("feat_birthmark").checked) featuresArray.push("birthmark");
    if (document.getElementById("feat_freckles").checked) featuresArray.push("freckles");
    
    config.features = featuresArray;
    config.featuresProbability = featuresArray.length > 0 ? 100 : 0;

    return config;
  }

  // Load preview from DiceBear API
  let previewTimeout = null;
  function debouncedLoadPreview() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(loadPreview, 300);
  }

  // Client-side SVG editing to apply the linear gradient to hair elements
  function applyHairGradient(svgText, color1, color2, direction, originalHairColor) {
    let x1 = "0%", y1 = "0%", x2 = "0%", y2 = "100%"; // vertical (default)
    if (direction === "horizontal") {
      x2 = "100%"; y2 = "0%";
    } else if (direction === "diagonal") {
      x2 = "100%"; y2 = "100%";
    }

    const gradientHtml = `<linearGradient id="hairGradient" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/></linearGradient>`;

    let updatedSvg = svgText;
    if (updatedSvg.includes("<defs>")) {
      updatedSvg = updatedSvg.replace("<defs>", `<defs>${gradientHtml}`);
    } else {
      updatedSvg = updatedSvg.replace(">", `><defs>${gradientHtml}</defs>`);
    }

    // Replaces fill attributes matching the hair color
    const regex1 = new RegExp(`fill="#${originalHairColor}"`, "gi");
    const regex2 = new RegExp(`fill: #${originalHairColor}`, "gi");
    const regex3 = new RegExp(`fill='\s*#${originalHairColor}\s*'`, "gi");
    const regex4 = new RegExp(`fill="%23${originalHairColor}"`, "gi");
    const regex5 = new RegExp(`fill='%23${originalHairColor}'`, "gi");

    updatedSvg = updatedSvg.replace(regex1, 'fill="url(#hairGradient)"');
    updatedSvg = updatedSvg.replace(regex2, 'fill: url(#hairGradient)');
    updatedSvg = updatedSvg.replace(regex3, "fill='url(#hairGradient)'");
    updatedSvg = updatedSvg.replace(regex4, 'fill="url(#hairGradient)"');
    updatedSvg = updatedSvg.replace(regex5, "fill='url(#hairGradient)'");

    return updatedSvg;
  }

  async function loadPreview() {
    try {
      previewLoader.style.display = "flex";
      const config = collectConfig();
      
      // Build DiceBear Query String
      const params = new URLSearchParams();
      
      if (config.seed) params.set("seed", config.seed);
      params.set("flip", config.flip);
      params.set("scale", config.scale);
      
      if (config.style) params.set("style", config.style[0]);
      if (config.backgroundType) params.set("backgroundType", config.backgroundType[0]);
      if (config.backgroundColor) params.set("backgroundColor", config.backgroundColor[0]);
      if (config.skinColor) params.set("skinColor", config.skinColor[0]);
      
      // Hair
      if (config.hairProbability === 0) {
        params.set("hairProbability", "0");
      } else {
        params.set("hair", config.hair[0]);
        params.set("hairProbability", "100");
      }
      params.set("hairColor", config.hairColor[0]);

      // Face
      params.set("eyes", config.eyes[0]);
      params.set("eyebrows", config.eyebrows[0]);
      params.set("mouth", config.mouth[0]);

      // Glasses & Earrings
      if (config.glassesProbability === 0) {
        params.set("glassesProbability", "0");
      } else {
        params.set("glasses", config.glasses[0]);
        params.set("glassesProbability", "100");
      }

      if (config.earringsProbability === 0) {
        params.set("earringsProbability", "0");
      } else {
        params.set("earrings", config.earrings[0]);
        params.set("earringsProbability", "100");
      }

      // Features
      if (config.featuresProbability === 0) {
        params.set("featuresProbability", "0");
      } else {
        params.set("featuresProbability", "100");
        config.features.forEach(feat => {
          params.append("features", feat);
        });
      }

      const dicebearUrl = `https://api.dicebear.com/7.x/adventurer/svg?${params.toString()}`;
      
      const res = await fetch(dicebearUrl);
      if (!res.ok) throw new Error("Önizleme yüklenemedi");
      
      let svgText = await res.text();

      // Apply gradient if enabled
      if (config.hairGradientType === "gradient" && config.hairProbability !== 0) {
        const c1 = document.getElementById("hairColor").value;
        const c2 = document.getElementById("hairColor2").value;
        const dir = config.hairGradientDir;
        svgText = applyHairGradient(svgText, c1, c2, dir, config.hairColor[0]);
      }

      currentSvgText = svgText;
      avatarPreview.innerHTML = svgText;
      showError(null); // Clear errors on success
    } catch (err) {
      showError("Önizleme yüklenirken hata oluştu: " + err.message);
    } finally {
      previewLoader.style.display = "none";
    }
  }

  // Reset all options to default settings
  resetBtn.addEventListener("click", () => {
    // 1. Genel
    document.getElementById("bgType").value = "solid";
    document.getElementById("bgColor").value = "#65c9ff";
    document.getElementById("bgColorHex").textContent = "#65c9ff";
    document.getElementById("skinColor").value = "#f2d3b1";
    document.getElementById("skinColorHex").textContent = "#f2d3b1";
    
    // Reset highlights
    highlightActiveSkinPreset("#f2d3b1");
    document.querySelectorAll("#bgPresets .color-swatch").forEach(s => s.classList.remove("active"));
    document.querySelectorAll("#hairPresets .color-swatch").forEach(s => s.classList.remove("active"));

    document.getElementById("avatarStyle").value = "default";
    document.getElementById("flip").checked = false;
    document.getElementById("scale").value = "100";
    document.getElementById("seed").value = "";

    // 2. Saç
    document.getElementById("hair").value = "short01";
    document.getElementById("hairColor").value = "#cb6820";
    document.getElementById("hairColorHex").textContent = "#cb6820";
    hairGradientType.value = "solid";
    document.getElementById("hairColor2").value = "#ab2a18";
    document.getElementById("hairColor2Hex").textContent = "#ab2a18";
    document.getElementById("hairGradientDir").value = "vertical";
    toggleHairGradientFields();

    // 3. Yüz
    document.getElementById("eyes").value = "variant01";
    document.getElementById("eyebrows").value = "variant01";
    document.getElementById("mouth").value = "variant01";

    // 4. Detaylar
    document.getElementById("glasses").value = "none";
    document.getElementById("earrings").value = "none";
    document.getElementById("feat_mustache").checked = false;
    document.getElementById("feat_blush").checked = false;
    document.getElementById("feat_birthmark").checked = false;
    document.getElementById("feat_freckles").checked = false;

    showError(null);
    loadPreview();
  });

  // Randomize values
  randomBtn.addEventListener("click", () => {
    const randomOption = (selectId) => {
      const select = document.getElementById(selectId);
      const options = select.options;
      const index = Math.floor(Math.random() * options.length);
      select.selectedIndex = index;
    };

    const randomColor = (inputId) => {
      const randomHex = Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
      const input = document.getElementById(inputId);
      input.value = `#${randomHex}`;
      const label = document.getElementById(`${inputId}Hex`);
      if (label) label.textContent = input.value;
    };

    // Randomize dropdowns
    randomOption("hair");
    randomOption("eyes");
    randomOption("eyebrows");
    randomOption("mouth");
    randomOption("glasses");
    randomOption("earrings");
    randomOption("avatarStyle");
    randomOption("hairGradientType");
    randomOption("hairGradientDir");

    toggleHairGradientFields();

    // Randomize colors
    randomColor("bgColor");
    randomColor("skinColor");
    randomColor("hairColor");
    randomColor("hairColor2");

    // Remove active swatch highlights
    skinPresets.forEach(s => s.classList.remove("active"));
    document.querySelectorAll("#bgPresets .color-swatch").forEach(s => s.classList.remove("active"));
    document.querySelectorAll("#hairPresets .color-swatch").forEach(s => s.classList.remove("active"));

    // Check if randomized skin color matches a preset to highlight
    highlightActiveSkinPreset(document.getElementById("skinColor").value);

    // Randomize checkboxes
    document.getElementById("feat_mustache").checked = Math.random() > 0.7;
    document.getElementById("feat_blush").checked = Math.random() > 0.5;
    document.getElementById("feat_birthmark").checked = Math.random() > 0.8;
    document.getElementById("feat_freckles").checked = Math.random() > 0.6;

    // Randomize switches & text
    document.getElementById("flip").checked = Math.random() > 0.5;
    document.getElementById("scale").value = Math.floor(Math.random() * 50) + 80; // 80 - 130
    document.getElementById("seed").value = Math.random().toString(36).substring(7);

    loadPreview();
  });

  // Apply Changes to Parolla Server
  applyBtn.addEventListener("click", async () => {
    if (!userProfile || !userToken) {
      showError("Profil bilgileri yüklenmemiş!");
      return;
    }

    try {
      applyBtn.disabled = true;
      applyBtn.textContent = "Kaydediliyor...";
      
      const config = collectConfig();
      // URL-encode the SVG to build the data URL scheme (Parolla's format)
      const dataImage = "data:image/svg+xml;utf8," + encodeURIComponent(currentSvgText);

      const payload = {
        username: userProfile.username,
        fullname: userProfile.fullname || userProfile.username,
        bio: userProfile.bio || "",
        diceBear: {
          dataImage: dataImage,
          config: config
        },
        avatarSource: "diceBear"
      };

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error("Aktif sekme bulunamadı");

      // We execute the API request inside Parolla page context to avoid CORS issues and share the credentials/cookie context
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [payload, userToken],
        func: async (payloadData, tokenVal) => {
          try {
            const res = await fetch("https://strapi.parolla.app/api/users/me", {
              method: "PUT",
              headers: {
                "accept": "application/json, text/plain, */*",
                "authorization": "Bearer " + tokenVal,
                "content-type": "application/json"
              },
              body: JSON.stringify(payloadData)
            });
            return { ok: res.ok, status: res.status };
          } catch (e) {
            return { ok: false, error: e.message };
          }
        }
      });

      const responseInfo = result && result[0] ? result[0].result : null;
      if (responseInfo && responseInfo.ok) {
        alert("Avatarınız başarıyla güncellendi! Profil sayfanız yenileniyor...");
        // Reload Parolla page to reflect new avatar
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => location.reload()
        });
        window.close(); // Close extension popup
      } else {
        const errDetail = responseInfo ? (responseInfo.error || "Hata kodu: " + responseInfo.status) : "Bilinmeyen hata";
        showError("Sunucer isteği reddetti: " + errDetail);
      }
    } catch (err) {
      showError("Kaydetme sırasında hata: " + err.message);
    } finally {
      applyBtn.disabled = false;
      applyBtn.textContent = "Uygula 🚀";
    }
  });

  // Run initializer
  initialize();
});