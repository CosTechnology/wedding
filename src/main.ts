// ========================================
// Casamento Raynara & Gabriel — App Principal
// ========================================

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Family, FamiliesFile, MemberResponses, MemberStatus, RsvpData } from './types';
import '../css/style.css';

// ---- Elementos DOM ----
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const $loading = $<HTMLDivElement>('loading');
const $error = $<HTMLDivElement>('error-screen');
const $app = $<HTMLDivElement>('app');
const $familyName = $<HTMLSpanElement>('family-name-display');
const $membersList = $<HTMLDivElement>('members-list');
const $submitArea = $<HTMLDivElement>('submit-area');
const $btnSubmit = $<HTMLButtonElement>('btn-submit');
const $submitMsg = $<HTMLParagraphElement>('submit-msg');
const $alreadyResponded = $<HTMLDivElement>('already-responded');
const $responseSummary = $<HTMLDivElement>('response-summary');
const $btnChange = $<HTMLButtonElement>('btn-change-response');
const $storySection = $<HTMLElement>('story-section');
const $toast = $<HTMLDivElement>('toast');
const $btnSeeStoryResponded = $<HTMLButtonElement>('btn-see-story-responded');
const $deadlineExpired = $<HTMLDivElement>('deadline-expired');
const $deadlineNotice = $<HTMLDivElement>('deadline-notice');

// ---- Estado ----
let currentFamily: Family | null = null;
let memberResponses: MemberResponses = {};

// ---- Data limite para confirmação ----
const RSVP_DEADLINE = new Date('2026-06-15T23:59:59-03:00');

// ---- Inicialização ----
init();

async function init(): Promise<void> {
  startCountdown();

  const slug = getSlugFromHash();
  if (!slug) {
    showError();
    return;
  }

  try {
    const families = await loadFamilies();
    currentFamily = families.find(f => f.slug === slug) ?? null;

    if (!currentFamily) {
      showError();
      return;
    }

    currentFamily.members.forEach(name => {
      memberResponses[name] = null;
    });

    const existingResponse = await getExistingResponse(currentFamily.id);
    renderApp(existingResponse);
  } catch (err) {
    console.error('Erro ao carregar:', err);
    showError();
  }
}

// ---- Carregar famílias dos JSONs (Raynara + Gabriel) ----
async function loadFamilies(): Promise<Family[]> {
  const [resRay, resGabriel] = await Promise.all([
    fetch(import.meta.env.BASE_URL + 'data/families-raynara.json'),
    fetch(import.meta.env.BASE_URL + 'data/families-gabriel.json'),
  ]);

  if (!resRay.ok) throw new Error('Erro ao carregar families-raynara.json');
  if (!resGabriel.ok) throw new Error('Erro ao carregar families-gabriel.json');

  const dataRay: FamiliesFile = await resRay.json();
  const dataGabriel: FamiliesFile = await resGabriel.json();

  const rayFamilies: Family[] = dataRay.families.map(f => ({ ...f, side: 'raynara' }));
  const gabrielFamilies: Family[] = dataGabriel.families.map(f => ({ ...f, side: 'gabriel' }));

  return [...rayFamilies, ...gabrielFamilies];
}

// ---- Hash Routing: extrai slug de #/convite/slug ----
function getSlugFromHash(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/^#\/convite\/(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ---- Telas ----
function showError(): void {
  $loading.style.display = 'none';
  $error.style.display = 'flex';
}

function isDeadlinePassed(): boolean {
  return new Date() > RSVP_DEADLINE;
}

function renderApp(existingResponse: RsvpData | null): void {
  $loading.style.display = 'none';
  $app.style.display = 'block';

  $familyName.textContent = currentFamily!.familyName;

  if (existingResponse) {
    showAlreadyResponded(existingResponse);
  } else if (isDeadlinePassed()) {
    showDeadlineExpired();
  } else {
    renderMemberCards();
  }
}

function showDeadlineExpired(): void {
  $membersList.innerHTML = '';
  $submitArea.style.display = 'none';
  $alreadyResponded.style.display = 'none';
  $deadlineNotice.style.display = 'none';
  $deadlineExpired.style.display = 'block';
}

// ---- Render dos cards de membros ----
function renderMemberCards(): void {
  $membersList.innerHTML = '';
  $submitArea.style.display = 'block';
  $alreadyResponded.style.display = 'none';

  currentFamily!.members.forEach(name => {
    const card = document.createElement('div');
    card.className = 'member-card animate-in';
    card.style.opacity = '0';
    card.innerHTML = `
      <span class="member-name">${escapeHtml(name)}</span>
      <div class="member-actions">
        <button class="btn-confirm" data-member="${escapeHtml(name)}" data-action="confirmed">
          ✓ Vai
        </button>
        <button class="btn-decline" data-member="${escapeHtml(name)}" data-action="declined">
          ✗ Não vai
        </button>
      </div>
    `;
    $membersList.appendChild(card);
  });

  $membersList.querySelectorAll<HTMLButtonElement>('.btn-confirm, .btn-decline').forEach(btn => {
    btn.addEventListener('click', handleMemberAction);
  });

  updateSubmitButton();
}

function handleMemberAction(e: Event): void {
  const btn = e.currentTarget as HTMLButtonElement;
  const member = btn.dataset.member!;
  const action = btn.dataset.action as MemberStatus;
  const card = btn.closest('.member-card') as HTMLElement;

  memberResponses[member] = action;

  card.classList.remove('confirmed', 'declined');
  card.classList.add(action);

  card.querySelectorAll<HTMLButtonElement>('.btn-confirm, .btn-decline').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  updateSubmitButton();
}

function updateSubmitButton(): void {
  const allAnswered = Object.values(memberResponses).every(v => v !== null);
  $btnSubmit.disabled = !allAnswered;

  if (allAnswered) {
    $submitMsg.textContent = '';
  } else {
    const remaining = Object.values(memberResponses).filter(v => v === null).length;
    $submitMsg.textContent = `Falta confirmar ${remaining} pessoa${remaining > 1 ? 's' : ''}`;
    $submitMsg.className = 'submit-msg';
  }
}

// ---- Enviar resposta ----
$btnSubmit.addEventListener('click', async () => {
  if ($btnSubmit.disabled || !currentFamily) return;

  $btnSubmit.disabled = true;
  $btnSubmit.textContent = 'Enviando...';

  try {
    const rsvpData: RsvpData = {
      familyId: currentFamily.id,
      familyName: currentFamily.familyName,
      side: currentFamily.side,
      responses: { ...memberResponses } as Record<string, MemberStatus>,
      respondedAt: new Date().toISOString(),
    };

    await saveResponse(currentFamily.id, rsvpData);
    showToast('Resposta salva com sucesso! 💜');

    const saved = await getExistingResponse(currentFamily.id);
    showAlreadyResponded(saved ?? { responses: memberResponses as Record<string, MemberStatus> } as RsvpData);

    $storySection.classList.add('visible');
    setTimeout(() => {
      $storySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
  } catch (err) {
    console.error('Erro ao salvar:', err);
    $submitMsg.textContent = 'Erro ao salvar. Tente novamente.';
    $submitMsg.className = 'submit-msg error';
    $btnSubmit.disabled = false;
    $btnSubmit.textContent = 'Enviar Confirmação';
  }
});

// ---- Mostra seção "já respondeu" ----
function showAlreadyResponded(data: RsvpData): void {
  $membersList.innerHTML = '';
  $submitArea.style.display = 'none';
  $alreadyResponded.style.display = 'block';
  $storySection.classList.add('visible');

  const confirmed: string[] = [];
  const declined: string[] = [];

  if (data.responses) {
    Object.entries(data.responses).forEach(([name, status]) => {
      if (status === 'confirmed') confirmed.push(name);
      else declined.push(name);
    });
  }

  let summaryHTML = '';
  confirmed.forEach(name => {
    summaryHTML += `<div class="summary-item"><span class="status-icon">✅</span> ${escapeHtml(name)} — Confirmado</div>`;
  });
  declined.forEach(name => {
    summaryHTML += `<div class="summary-item"><span class="status-icon">❌</span> ${escapeHtml(name)} — Não vai</div>`;
  });

  $responseSummary.innerHTML = summaryHTML;

  const totalConfirmed = confirmed.length;
  const total = currentFamily!.members.length;
  const h3 = $alreadyResponded.querySelector('h3')!;
  const p = $alreadyResponded.querySelector('p')!;

  if (totalConfirmed === 0) {
    h3.textContent = 'Resposta registrada';
    p.textContent = 'Que pena que não poderão ir 😢 Se mudar de ideia, pode alterar a resposta!';
  } else if (totalConfirmed === total) {
    h3.textContent = 'Presença confirmada! 🎉';
    p.textContent = 'Estamos ansiosos para celebrar com vocês!';
  } else {
    h3.textContent = 'Resposta registrada!';
    p.textContent = `${totalConfirmed} de ${total} confirmado${totalConfirmed > 1 ? 's' : ''}. Obrigado!`;
  }
}

// ---- Botão "Alterar resposta" ----
$btnChange.addEventListener('click', () => {
  currentFamily!.members.forEach(name => {
    memberResponses[name] = null;
  });
  $storySection.classList.remove('visible');
  renderMemberCards();
  $membersList.scrollIntoView({ behavior: 'smooth' });
});

// ---- Botão "Ver história" (quando já respondeu) ----
$btnSeeStoryResponded.addEventListener('click', () => {
  $storySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---- Firebase: Salvar resposta ----
async function saveResponse(familyId: string, data: RsvpData): Promise<void> {
  await setDoc(doc(db, 'rsvp', familyId), data, { merge: true });
}

// ---- Firebase: Buscar resposta existente ----
async function getExistingResponse(familyId: string): Promise<RsvpData | null> {
  try {
    const snap = await getDoc(doc(db, 'rsvp', familyId));
    if (snap.exists()) {
      return snap.data() as RsvpData;
    }
  } catch (err) {
    console.warn('Não foi possível verificar resposta existente:', err);
  }
  return null;
}

// ---- Contagem Regressiva ----
function startCountdown(): void {
  const weddingDate = new Date('2026-07-12T13:00:00-03:00');

  function update(): void {
    const now = new Date();
    const diff = weddingDate.getTime() - now.getTime();

    if (diff <= 0) {
      $('countdown-days').textContent = '0';
      $('countdown-hours').textContent = '0';
      $('countdown-min').textContent = '0';
      $('countdown-sec').textContent = '0';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    $('countdown-days').textContent = String(days);
    $('countdown-hours').textContent = String(hours).padStart(2, '0');
    $('countdown-min').textContent = String(mins).padStart(2, '0');
    $('countdown-sec').textContent = String(secs).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

// ---- Toast ----
function showToast(msg: string): void {
  $toast.textContent = msg;
  $toast.classList.add('visible');
  setTimeout(() => {
    $toast.classList.remove('visible');
  }, 3000);
}

// ---- Link do endereço: menu de apps GPS no mobile ----
const ADDRESS = 'Rua Américo Torneiro, 468 - Jardim Mauá';
const COORDS = '-23.6509,-46.4611';

const $addressLink = $<HTMLAnchorElement>('address-link');
$addressLink.addEventListener('click', (e: Event) => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) return; // desktop: segue o href normal (Google Maps)

  e.preventDefault();
  showMapOptions();
});

function showMapOptions(): void {
  const overlay = document.createElement('div');
  overlay.className = 'map-overlay';
  overlay.innerHTML = `
    <div class="map-modal">
      <h3>Abrir no mapa</h3>
      <p>Escolha o aplicativo:</p>
      <div class="map-options">
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}" target="_blank" rel="noopener noreferrer" class="map-option">
          🗺️ Google Maps
        </a>
        <a href="https://waze.com/ul?q=${encodeURIComponent(ADDRESS)}&ll=${COORDS}&navigate=yes" target="_blank" rel="noopener noreferrer" class="map-option">
          🚗 Waze
        </a>
        <a href="https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${COORDS.split(',')[0]}&dropoff[longitude]=${COORDS.split(',')[1]}&dropoff[nickname]=${encodeURIComponent(ADDRESS)}" target="_blank" rel="noopener noreferrer" class="map-option">
          🚘 Uber
        </a>
        <a href="https://deep.99app.com/ride?lat=${COORDS.split(',')[0]}&lng=${COORDS.split(',')[1]}&title=${encodeURIComponent(ADDRESS)}" target="_blank" rel="noopener noreferrer" class="map-option">
          🚕 99
        </a>
        <a href="geo:${COORDS}?q=${encodeURIComponent(ADDRESS)}" class="map-option">
          📍 App padrão
        </a>
      </div>
      <button class="map-cancel">Cancelar</button>
    </div>
  `;

  overlay.addEventListener('click', (e: Event) => {
    if (e.target === overlay || (e.target as HTMLElement).classList.contains('map-cancel')) {
      overlay.remove();
    }
  });

  overlay.querySelector('.map-cancel')!.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

// ---- Segurança: escape HTML ----
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
