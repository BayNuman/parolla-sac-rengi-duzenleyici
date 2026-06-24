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

    const skinColor = getConfigVal(config, "skinColor", "f2d3b1");
    const skinPicker = document.getElementById("skinColor");
    skinPicker.value = skinColor.startsWith("#") ? skinColor : `#${skinColor}`;
    document.getElementById("skinColorHex").textContent = skinPicker.value;

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
    randomOption("hair");
    randomOption("eyes");
    randomOption("eyebrows");
    randomOption("mouth");
    randomOption("glasses");
    randomOption("earrings");
    randomOption("avatarStyle");

    // Randomize colors
    randomColor("bgColor");
    randomColor("skinColor");
    randomColor("hairColor");

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