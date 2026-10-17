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
    } else if (field.id === "cnpj" && field.value.trim() && !isValidCnpj(field.value)) {
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
    const emailInput = loginForm.querySelector('input[type="email"]');
    if (emailInput) emailInput.value = "";
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

// Interactive, local-only product demonstrations. No credentials or personal
// data are collected, transmitted, or persisted by these screens.
const toast = document.querySelector("#app-toast");
let toastTimer;
function showDemoToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3600);
}

document.querySelectorAll("[data-demo-message]").forEach((button) => {
  button.addEventListener("click", () => showDemoToast(button.getAttribute("data-demo-message") || "Ação indisponível nesta demonstração."));
});

const appLoginScreen = document.querySelector("#app-login-screen");
const appAccessScreen = document.querySelector("#app-access-screen");
const appDashboard = document.querySelector("#app-dashboard");
const transactions = [
  { merchant: "Restaurante XYZ", category: "Refeição", amount: "− R$ 38,90", icon: "fa-utensils", date: "16/10", daysAgo: 0, time: "12:42" },
  { merchant: "Mercado ABC", category: "Alimentação", amount: "− R$ 85,50", icon: "fa-basket-shopping", date: "15/10", daysAgo: 1, time: "18:16" },
  { merchant: "Benefício recebido", category: "Crédito", amount: "+ R$ 250,00", icon: "fa-arrow-down-to-line", date: "12/09", daysAgo: 34, time: "09:00" },
];

function transactionDate(date) {
  return date;
}

function renderTransactions(filter = "7") {
  const cutoff = filter === "7" ? 7 : filter === "month" ? 30 : Infinity;
  const rows = transactions.filter((item) => item.daysAgo <= cutoff);
  document.querySelectorAll("[data-transactions]").forEach((container) => {
    container.innerHTML = rows.map((item, index) => `
      <article class="app-transaction" data-testid="transaction-sample-${index}">
        <span class="transaction-icon ${item.category === "Alimentação" ? "is-blue" : ""}"><i class="fa-solid ${item.icon}" aria-hidden="true"></i></span>
        <span class="transaction-copy"><strong>${item.merchant}</strong><small>${transactionDate(item.date)} · ${item.time} · ${item.category}</small></span>
        <strong class="transaction-amount">${item.amount}</strong>
      </article>`).join("") || '<p class="empty-transactions">Não há movimentações neste período demonstrativo.</p>';
  });
}

if (document.querySelector("[data-transactions]")) renderTransactions();

document.querySelectorAll("[data-demo-start]").forEach((button) => {
  button.addEventListener("click", () => {
    if (appLoginScreen) appLoginScreen.hidden = true;
    if (appAccessScreen) appAccessScreen.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

document.querySelectorAll("[data-demo-back]").forEach((button) => {
  button.addEventListener("click", () => {
    if (appAccessScreen) appAccessScreen.hidden = true;
    if (appLoginScreen) appLoginScreen.hidden = false;
  });
});

document.querySelectorAll("[data-demo-login]").forEach((button) => {
  button.addEventListener("click", () => {
    if (appLoginScreen) appLoginScreen.hidden = true;
    if (appAccessScreen) appAccessScreen.hidden = true;
    if (appDashboard) appDashboard.hidden = false;
    renderTransactions();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

document.querySelectorAll("[data-demo-logout]").forEach((button) => {
  button.addEventListener("click", () => {
    if (appDashboard) appDashboard.hidden = true;
    if (appAccessScreen) appAccessScreen.hidden = true;
    if (appLoginScreen) appLoginScreen.hidden = false;
    showDemoToast("Você saiu da demonstração. Nenhum dado foi salvo.");
  });
});

document.querySelectorAll("[data-app-nav]").forEach((button) => {
  button.addEventListener("click", () => {
    const viewName = button.getAttribute("data-app-nav");
    document.querySelectorAll(".app-view").forEach((view) => {
      const active = view.getAttribute("data-view") === viewName;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
    document.querySelectorAll(".app-bottom-nav [data-app-nav]").forEach((navButton) => navButton.classList.toggle("is-active", navButton.getAttribute("data-app-nav") === viewName));
    if (viewName === "extrato") renderTransactions(document.querySelector(".statement-filters [data-filter].is-selected")?.getAttribute("data-filter") || "7");
    if (appDashboard) appDashboard.scrollTo({ top: 0, behavior: "smooth" });
  });
});

document.querySelectorAll("[data-app-help]").forEach((button) => button.addEventListener("click", () => {
  document.querySelector('[data-app-nav="ajuda"]')?.click();
}));

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("is-selected", item === button));
    renderTransactions(button.getAttribute("data-filter") || "7");
  });
});

document.querySelectorAll("[data-balance-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const hidden = button.getAttribute("aria-label") === "Ocultar saldos";
    document.querySelectorAll("[data-balance]").forEach((balance) => {
      if (!balance.dataset.originalBalance) balance.dataset.originalBalance = balance.textContent || "";
      balance.textContent = hidden ? "••••••" : balance.dataset.originalBalance;
    });
    button.setAttribute("aria-label", hidden ? "Mostrar saldos" : "Ocultar saldos");
    button.innerHTML = `<i class="fa-regular ${hidden ? "fa-eye-slash" : "fa-eye"}" aria-hidden="true"></i>`;
  });
});

let cardIsLocked = false;
document.querySelectorAll("[data-card-lock]").forEach((button) => {
  button.addEventListener("click", () => {
    cardIsLocked = !cardIsLocked;
    document.querySelectorAll("[data-card-status]").forEach((status) => {
      status.textContent = cardIsLocked
        ? "Bloqueado nesta demonstração. Nenhum cartão real foi afetado."
        : "Cartão demonstrativo · não funciona para pagamentos";
    });
    document.querySelectorAll("[data-card-lock]").forEach((control) => {
      control.setAttribute("aria-pressed", String(cardIsLocked));
      control.textContent = cardIsLocked ? "Desbloquear cartão (demo)" : "Bloquear cartão";
    });
  });
});

let cardLastFourVisible = false;
document.querySelectorAll("[data-card-reveal]").forEach((button) => {
  button.addEventListener("click", () => {
    cardLastFourVisible = !cardLastFourVisible;
    document.querySelectorAll("[data-card-number-display]").forEach((number) => {
      number.textContent = cardLastFourVisible ? "••••  ••••  ••••  1234" : "••••  ••••  ••••  ••••";
    });
    document.querySelectorAll("[data-card-last-four]").forEach((number) => {
      number.textContent = cardLastFourVisible ? "1234" : "••••";
    });
    button.textContent = cardLastFourVisible ? "Ocultar final do cartão" : "Mostrar final do cartão";
    button.setAttribute("aria-pressed", String(cardLastFourVisible));
  });
});

document.querySelectorAll("[data-card-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("•••• •••• •••• 1234");
      showDemoToast("Número mascarado de demonstração copiado. O número completo não existe.");
    } catch {
      showDemoToast("Este cartão é fictício. Não existe número completo para copiar.");
    }
  });
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http") && document.querySelector(".welin-app-page")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js").catch(() => {}));
}
