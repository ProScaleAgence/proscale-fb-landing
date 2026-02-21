function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : "";
}

function setCookie(name, value, days = 90) {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

function ensureFbc() {
  let fbc = getCookie("_fbc");
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");

  // Si pas de _fbc mais qu'on a un fbclid (clic pub), on le génère
  if (!fbc && fbclid) {
    fbc = `fb.1.${Date.now()}.${fbclid}`;
    setCookie("_fbc", fbc);
  }

  return fbc || "";
}

function getMetaCookies() {
  const fbp = getCookie("_fbp") || ""; // créé par le pixel si pixel installé
  const fbc = ensureFbc();             // créé par pixel OU par nous si fbclid
  return { fbp, fbc };
}

(function () {
  const CAPI_URL = "https://go.proscalemarketing.ca/capi";

  const form = document.getElementById("proscaleForm");
  if (!form) return;

  // Modal
  const modal = document.getElementById("lpModal");
  const openModal = () => {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  };
  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  };

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeModal();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  // Validation
  const emailLooksValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

  const normalizePhoneToE164US = (raw) => {
    const digits = (raw || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) return "+1" + digits.slice(1);
    if (digits.length === 10) return "+1" + digits;
    return null;
  };

  const getRadioValue = (name) => {
    const el = form.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : "";
  };

  let locked = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (locked) return;

    const btn = form.querySelector('button[type="submit"]');

    const name = form.querySelector('[name="full_name"]')?.value?.trim() || "";
    const email = form.querySelector('[name="email"]')?.value?.trim() || "";
    const phoneRaw = form.querySelector('[name="phone"]')?.value?.trim() || "";
    const company = form.querySelector('[name="company_name"]')?.value?.trim() || "";
    const smsConsent = !!form.querySelector('[name="sms_consent"]')?.checked;

    if (!name) return alert("Écris ton nom complet.");
    if (!emailLooksValid(email)) return alert("Entre un e-mail valide. Exemple: nom@domaine.com");
    const phone = normalizePhoneToE164US(phoneRaw);
    if (!phone) return alert("Entre un numéro valide. Exemple: +1 514 000 0000");
    if (!company) return alert("Écris le nom de ton entreprise.");
    if (!revenue) return alert("Choisis une tranche de revenu.");
    if (!smsConsent) return alert("Tu dois cocher la case pour accepter les SMS.");

    locked = true;
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.textContent = "ENVOI EN COURS...";
    }

    // Meta cookies (pour matching CAPI)
    const { fbp, fbc } = getMetaCookies();

    const eventId = (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

    // Envoi stable vers GHL webhook: x-www-form-urlencoded
    const body = new URLSearchParams({
      name,
      email,
      phone,
      company_name: company,
      revenue_band: revenue,
      sms_consent: smsConsent ? "true" : "false",
      fbp,
      fbc,
      event_id: eventId,
      source: "proscale_fb_landing",
      landing_url: window.location.href,
      page: window.location.href,
      ts: new Date().toISOString()
    });

    try {
      await fetch(CAPI_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          company_name: company,
          fbp,
          fbc,
          event_id: eventId,
          landing_url: window.location.href,
          ts: new Date().toISOString()
        })
      });

      form.reset();
      openModal();

      // Optionnel: si Pixel installé, track Lead côté navigateur
    if (typeof window.fbq === "function") {
      window.fbq("track", "Lead", {}, { eventID: eventId });
    }
    } catch (err) {
      alert("Erreur d’envoi. Réessaie.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || "TESTER LA MACHINE!";
      }
      locked = false;
    }
  });
})();
