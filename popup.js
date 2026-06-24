document.addEventListener("DOMContentLoaded", async () => {
  const tabs = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  const avatarPreview = document.getElementById("avatarPreview");
  const previewLoader = document.getElementById("previewLoader");
  const errorMessage = document.getElementById("errorMessage");
  const applyBtn = document.getElementById("applyBtn");
  const randomBtn = document.getElementById("randomBtn");

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
      debouncedLoadPreview();
    });
  });

  // Form elements event listeners
  const formElements = document.querySelectorAll("select, input[type='text'], input[type='checkbox']");
  formElements.forEach(elem => {
    elem.addEventListener("change", () => debouncedLoadPreview());
    if (elem.tagName === "INPUT" && elem.type === "text") {
      elem.addEventListener("input", () => debouncedLoadPreview());
    }
  });

  // Show error
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

    const skinColor = getConfigVal(config, "skinColor", "ffdbb4");
    const skinPicker = document.getElementById("skinColor");
    skinPicker.value = skinColor.startsWith("#") ? skinColor : `#${skinColor}`;
    document.getElementById("skinColorHex").textContent = skinPicker.value;

    document.getElementById("avatarStyle").value = getConfigVal(config, "style", "default");
    document.getElementById("flip").checked = getConfigVal(config, "flip", false);
    document.getElementById("scale").value = getConfigVal(config, "scale", "100");
    document.getElementById("seed").value = getConfigVal(config, "seed", "");

    // 2. Saç Sekme
    const topVal = getConfigVal(config, "top", "bob");
    const topProb = getConfigVal(config, "topProbability", 100);
    document.getElementById("top").value = topProb === 0 ? "none" : topVal;

    const hairColor = getConfigVal(config, "hairColor", "4a312c");
    const hairPicker = document.getElementById("hairColor");
    hairPicker.value = hairColor.startsWith("#") ? hairColor : `#${hairColor}`;
    document.getElementById("hairColorHex").textContent = hairPicker.value;

    const hatColor = getConfigVal(config, "hatColor", "262e33");
    const hatPicker = document.getElementById("hatColor");
    hatPicker.value = hatColor.startsWith("#") ? hatColor : `#${hatColor}`;
    document.getElementById("hatColorHex").textContent = hatPicker.value;

    // 3. Yüz Sekme
    document.getElementById("eyes").value = getConfigVal(config, "eyes", "default");
    document.getElementById("eyebrows").value = getConfigVal(config, "eyebrows", "defaultNatural");
    document.getElementById("mouth").value = getConfigVal(config, "mouth", "default");

    const facialHairVal = getConfigVal(config, "facialHair", "none");
    const facialHairProb = getConfigVal(config, "facialHairProbability", 0);
    document.getElementById("facialHair").value = facialHairProb === 0 ? "none" : facialHairVal;

    const facialHairColor = getConfigVal(config, "facialHairColor", "4a312c");
    const facialHairPicker = document.getElementById("facialHairColor");
    facialHairPicker.value = facialHairColor.startsWith("#") ? facialHairColor : `#${facialHairColor}`;
    document.getElementById("facialHairColorHex").textContent = facialHairPicker.value;

    // 4. Giyim/Aksesuar
    document.getElementById("clothing").value = getConfigVal(config, "clothing", "shirtCrewNeck");

    const clothesColor = getConfigVal(config, "clothesColor", "65c9ff");
    const clothesPicker = document.getElementById("clothesColor");
    clothesPicker.value = clothesColor.startsWith("#") ? clothesColor : `#${clothesColor}`;
    document.getElementById("clothesColorHex").textContent = clothesPicker.value;

    const clothingGraphic = getConfigVal(config, "clothingGraphic", "none");
    document.getElementById("clothingGraphic").value = clothingGraphic === null || clothingGraphic === undefined ? "none" : clothingGraphic;

    const accVal = getConfigVal(config, "accessories", "none");
    const accProb = getConfigVal(config, "accessoriesProbability", 0);
    document.getElementById("accessories").value = accProb === 0 ? "none" : accVal;

    const accColor = getConfigVal(config, "accessoriesColor", "ffffff");
    const accColorPicker = document.getElementById("accessoriesColor");
    accColorPicker.value = accColor.startsWith("#") ? accColor : `#${accColor}`;
    document.getElementById("accessoriesColorHex").textContent = accColorPicker.value;

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
    const topSelected = document.getElementById("top").value;
    if (topSelected === "none") {
      config.topProbability = 0;
    } else {
      config.top = [topSelected];
      config.topProbability = 100;
    }
    config.hairColor = [cleanHex(document.getElementById("hairColor").value)];
    config.hatColor = [cleanHex(document.getElementById("hatColor").value)];

    // 3. Yüz
    config.eyes = [document.getElementById("eyes").value];
    config.eyebrows = [document.getElementById("eyebrows").value];
    config.mouth = [document.getElementById("mouth").value];

    const facialHairSelected = document.getElementById("facialHair").value;
    if (facialHairSelected === "none") {
      config.facialHairProbability = 0;
    } else {
      config.facialHair = [facialHairSelected];
      config.facialHairProbability = 100;
    }
    config.facialHairColor = [cleanHex(document.getElementById("facialHairColor").value)];

    // 4. Giyim
    config.clothing = [document.getElementById("clothing").value];
    config.clothesColor = [cleanHex(document.getElementById("clothesColor").value)];
    
    const graphicSelected = document.getElementById("clothingGraphic").value;
    if (graphicSelected !== "none") {
      config.clothingGraphic = [graphicSelected];
    } else {
      config.clothingGraphic = [];
    }

    const accSelected = document.getElementById("accessories").value;
    if (accSelected === "none") {
      config.accessoriesProbability = 0;
    } else {
      config.accessories = [accSelected];
      config.accessoriesProbability = 100;
    }
    config.accessoriesColor = [cleanHex(document.getElementById("accessoriesColor").value)];

    return config;
  }

  // Load preview from DiceBear API
  let previewTimeout = null;
  function debouncedLoadPreview() {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(loadPreview, 300);
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
      
      // Top (Hair/Hat)
      if (config.topProbability === 0) {
        params.set("topProbability", "0");
      } else {
        params.set("top", config.top[0]);
        params.set("topProbability", "100");
      }
      params.set("hairColor", config.hairColor[0]);
      params.set("hatColor", config.hatColor[0]);

      // Face
      params.set("eyes", config.eyes[0]);
      params.set("eyebrows", config.eyebrows[0]);
      params.set("mouth", config.mouth[0]);

      // Facial Hair
      if (config.facialHairProbability === 0) {
        params.set("facialHairProbability", "0");
      } else {
        params.set("facialHair", config.facialHair[0]);
        params.set("facialHairProbability", "100");
      }
      params.set("facialHairColor", config.facialHairColor[0]);

      // Clothing & Accessories
      params.set("clothing", config.clothing[0]);
      params.set("clothesColor", config.clothesColor[0]);
      
      if (config.clothingGraphic && config.clothingGraphic.length > 0) {
        params.set("clothingGraphic", config.clothingGraphic[0]);
      }
      
      if (config.accessoriesProbability === 0) {
        params.set("accessoriesProbability", "0");
      } else {
        params.set("accessories", config.accessories[0]);
        params.set("accessoriesProbability", "100");
      }
      params.set("accessoriesColor", config.accessoriesColor[0]);

      const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?${params.toString()}`;
      
      const res = await fetch(dicebearUrl);
      if (!res.ok) throw new Error("Önizleme yüklenemedi");
      
      const svgText = await res.text();
      currentSvgText = svgText;
      avatarPreview.innerHTML = svgText;
      showError(null); // Clear errors on success
    } catch (err) {
      showError("Önizleme yüklenirken hata oluştu: " + err.message);
    } finally {
      previewLoader.style.display = "none";
    }
  }

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
    randomOption("top");
    randomOption("eyes");
    randomOption("eyebrows");
    randomOption("mouth");
    randomOption("facialHair");
    randomOption("clothing");
    randomOption("clothingGraphic");
    randomOption("accessories");
    randomOption("avatarStyle");

    // Randomize colors
    randomColor("bgColor");
    randomColor("skinColor");
    randomColor("hairColor");
    randomColor("hatColor");
    randomColor("facialHairColor");
    randomColor("clothesColor");
    randomColor("accessoriesColor");

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
        showError("Sunucu isteği reddetti: " + errDetail);
      }
    } catch (err) {
      showError("Kaydetme sırasında hata: " + err.message);
    } finally {
      applyBtn.disabled = false;
      applyBtn.textContent = "Değişiklikleri Uygula 🚀";
    }
  });

  // Run initializer
  initialize();
});