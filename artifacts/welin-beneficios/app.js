const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#main-navigation");

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const expanded = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!expanded));
    navigation.classList.toggle("is-open", !expanded);
    menuButton.innerHTML = expanded
      ? '<i class="fa-solid fa-bars" aria-hidden="true"></i>'
      : '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    menuButton.setAttribute("aria-label", expanded ? "Abrir menu" : "Fechar menu");
  });

  navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navigation.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Abrir menu");
      menuButton.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    });
  });
}

// Keep in-page navigation smooth while honoring reduced-motion preferences.
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href")?.slice(1);
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;

    event.preventDefault();
    history.pushState(null, "", `#${targetId}`);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  });
});

const form = document.querySelector("#proposal-form");
const feedback = document.querySelector("#form-feedback");

function digitsOnly(value) {
  return value.replace(/\D/g, "");
}

function isValidCnpj(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const calculateDigit = (base, weights) => {
    const sum = [...base].reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(digits.slice(0, 12) + firstDigit, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${firstDigit}${secondDigit}`);
}

function isValidBrazilianPhone(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 10 && digits.length !== 11) return false;
  const areaCode = Number(digits.slice(0, 2));
  if (areaCode < 11 || areaCode > 99) return false;
  return digits.length === 11 ? digits[2] === "9" : /^[2-5]/.test(digits.slice(2));
}

if (form && feedback) {
  const phone = document.querySelector("#phone");
  const cnpj = document.querySelector("#cnpj");

  cnpj?.addEventListener("input", (event) => {
    const digits = digitsOnly(event.target.value).slice(0, 14);
    event.target.value = digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  });

  phone?.addEventListener("input", (event) => {
    const digits = digitsOnly(event.target.value).slice(0, 11);
    event.target.value = digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d)(\d{4})$/, "$1-$2");
  });

  function validateField(field) {
    const error = document.querySelector(`#${field.id}-error`);
    let message = "";
    if (field.required && !field.value.trim()) {
      message = "Preencha este campo.";
    } else if (field.type === "email" && field.value && !field.validity.valid) {
      message = "Informe um e-mail válido.";
    } else if (field.id === "cnpj" && !isValidCnpj(field.value)) {
      message = "Informe um CNPJ válido com 14 dígitos.";
    } else if (field.id === "phone" && !isValidBrazilianPhone(field.value)) {
      message = "Informe um telefone válido com DDD.";
    }

    field.setAttribute("aria-invalid", message ? "true" : "false");
    if (error) error.textContent = message;
    return !message;
  }

  form.querySelectorAll("input[required], select[required], textarea[required]").forEach((field) => {
    field.addEventListener("blur", () => validateField(field));
    field.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid") === "true") validateField(field);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = [...form.querySelectorAll("input[required], select[required], textarea[required]")];
    const valid = fields.map(validateField).every(Boolean);
    feedback.classList.add("is-visible");

    if (!valid) {
      feedback.className = "form-feedback is-visible";
      feedback.setAttribute("role", "alert");
      feedback.innerHTML = '<strong><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>Confira os campos destacados.</strong> Corrija as informações indicadas antes de continuar.';
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const values = new FormData(form);
    const payload = {
      companyName: String(values.get("company") ?? "").trim(),
      cnpj: String(values.get("cnpj") ?? "").trim(),
      contactName: String(values.get("name") ?? "").trim(),
      email: String(values.get("email") ?? "").trim(),
      phone: String(values.get("phone") ?? "").trim(),
      employeeCount: String(values.get("team-size") ?? ""),
      message: String(values.get("message") ?? "").trim(),
      website: String(values.get("website") ?? ""),
    };

    if (submitButton) submitButton.disabled = true;
    feedback.className = "form-feedback is-visible";
    feedback.setAttribute("role", "status");
    feedback.textContent = "Enviando solicitação…";

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível registrar sua solicitação.");
      }

      feedback.textContent = "Solicitação registrada no sistema. No momento, a equipe WELIN não recebe aviso por e-mail; por isso, não podemos confirmar contato em até 24h.";
      form.reset();
      fields.forEach((field) => {
        field.setAttribute("aria-invalid", "false");
        const error = document.querySelector(`#${field.id}-error`);
        if (error) error.textContent = "";
      });
    } catch (error) {
      feedback.setAttribute("role", "alert");
      feedback.textContent = error instanceof Error
        ? error.message
        : "Não foi possível registrar sua solicitação. Tente novamente.";
    } finally {
      if (submitButton) submitButton.disabled = false;
      feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

const loginForm = document.querySelector("#company-login-form");
const loginFeedback = document.querySelector("#login-feedback");

if (loginForm && loginFeedback) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loginFeedback.textContent = "O acesso ainda não está conectado. Nenhuma credencial foi enviada.";
    loginFeedback.classList.add("is-visible");
    const passwordInput = loginForm.querySelector('input[type="password"]');
    if (passwordInput) passwordInput.value = "";
  });

  document.querySelectorAll("[data-access-action]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const action = link.getAttribute("data-access-action");
      loginFeedback.textContent = action === "reset"
        ? "A recuperação de senha ainda não está configurada."
        : "O cadastro de empresas ainda não está configurado.";
      loginFeedback.classList.add("is-visible");
    });
  });
}
