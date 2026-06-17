document.getElementById("applyColorBtn").addEventListener("click", async () => {
  const colorPicker = document.getElementById("hairColorPicker");
  // Seçilen rengi alıyoruz (Örn: "#ff69b4") ve başındaki '#' işaretini siliyoruz ("ff69b4")
  const targetColor = colorPicker.value.replace("#", "").toLowerCase();

  // Aktif sekmeyi buluyoruz
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes("parolla.app")) {
    alert("Lütfen bu işlemi Parolla avatar düzenleme sayfasında yapın!");
    return;
  }

  // Kodu aktif sayfaya enjekte ediyoruz ve seçilen rengi parametre (args) olarak gönderiyoruz
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [targetColor],
    func: (chosenColor) => {
      // Çerezler arasından auth._token.google değerini çekiyoruz
      const cookieMatch = document.cookie.match(/(^|;\s*)auth\._token\.google=([^;]*)/);
      
      if (!cookieMatch) {
        alert("Giriş anahtarı (Cookie) bulunamadı! Lütfen hesaba giriş yaptığınızdan emin olun.");
        return;
      }

      const rawToken = decodeURIComponent(cookieMatch[2]); 
      const cleanToken = rawToken.replace("Bearer ", "").trim();

      // Mevcut profil verilerini çekiyoruz
      fetch("https://strapi.parolla.app/api/users/me", {
        headers: { "authorization": "Bearer " + cleanToken }
      })
      .then(r => {
        if (!r.ok) throw new Error("Profil verisi çekilemedi, durum: " + r.status);
        return r.json();
      })
      .then(user => {
        if (!user || !user.username) {
          alert("Kullanıcı bilgileri eksik veya geçersiz!");
          return;
        }

        const originalDiceBear = user.diceBear || {};
        let svg = originalDiceBear.dataImage || "";

        // SVG çizim verisi içindeki eski renk paternlerini dinamik seçilen renk ile değiştiriyoruz
        if (svg.includes("fill%3D%22%23")) {
          svg = svg.replace(/fill%3D%22%23[a-fA-F0-9]{6}%22/g, 'fill%3D%22%23' + chosenColor + '%22');
        } else if (svg.includes("fill='#")) {
          svg = svg.replace(/fill='#[a-fA-F0-9]{6}'/g, "fill='#" + chosenColor + "'");
        } else {
          svg = svg.replace(/%23[a-fA-F0-9]{6}/g, '%23' + chosenColor);
        }

        // DiceBear konfigürasyon dizisine yeni dinamik rengi atıyoruz
        const updatedConfig = { ...originalDiceBear.config, hairColor: [chosenColor] };
        
        const payload = {
          username: user.username,
          fullname: user.fullname || user.username,
          bio: user.bio || "",
          diceBear: { dataImage: svg, config: updatedConfig },
          avatarSource: "diceBear"
        };

        // Sunucuya güncelleme isteği gönderiyoruz
        return fetch("https://strapi.parolla.app/api/users/me", {
          method: "PUT",
          headers: {
            "accept": "application/json, text/plain, */*",
            "authorization": "Bearer " + cleanToken,
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      })
      .then(res => {
        if (res && res.ok) {
          alert("Saç rengi başarıyla güncellendi! Sayfa yenileniyor...");
          location.reload();
        } else if (res) {
          alert("Sunucu isteği kabul etmedi. Hata kodu: " + res.status);
        }
      })
      .catch(err => {
        alert("İşlem sırasında hata oluştu: " + err.message);
      });
    }
  });
});