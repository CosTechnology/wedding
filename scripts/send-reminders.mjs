// ========================================
// Script: Enviar lembrete de confirmação via WhatsApp
// ========================================
// Abre o WhatsApp Web com uma mensagem de LEMBRETE para famílias
// que ainda não confirmaram presença.
//
// Uso:
//   node scripts/send-reminders.mjs --all-gabriel-pending   # só pendentes do Gabriel (via Firebase)
//   node scripts/send-reminders.mjs rosimeire michelly       # por slug

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { exec } from 'child_process';

const firebaseConfig = {
  apiKey: "AIzaSyDhs36P_CMxicoKinhlR0UkOgH7AMhi7mA",
  authDomain: "wedding-60654.firebaseapp.com",
  projectId: "wedding-60654",
  storageBucket: "wedding-60654.firebasestorage.app",
  messagingSenderId: "9308589526",
  appId: "1:9308589526:web:44fd9272f7564756dea877",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BASE_URL = 'https://costechnology.github.io/wedding/#/convite/';

// Famílias a NUNCA incluir no lembrete (ex.: Arminda)
const EXCLUDE_SLUGS = ['arminda'];

function loadGabriel() {
  return JSON.parse(
    readFileSync('./public/data/families-gabriel.json', 'utf-8')
  ).families.map(f => ({ ...f, side: 'gabriel' }));
}

function buildReminder(familyName, slug, members) {
  const link = `${BASE_URL}${slug}`;
  const nomes = members.join(', ');
  return [
    `Olá, ${familyName}!`,
    ``,
    `Passando para lembrar do almoço de celebração do casamento de *Ray & Gabriel* 💍`,
    ``,
    `📅 12 de julho de 2026, às 13h`,
    `📍 Espaço VIP — Av. Américo Torneiro, 468 — Jardim Mauá`,
    ``,
    `Ainda não recebemos a confirmação de vocês. Podem confirmar a presença de: *${nomes}*?`,
    `Link: ${link}`,
    ``,
    `O prazo é até 07/06/2026. Obrigado! 🙏`,
  ].join('\n');
}

function openWhatsApp(family) {
  const message = buildReminder(family.familyName, family.slug, family.members);
  const url = `https://wa.me/55${family.phone}?text=${encodeURIComponent(message)}`;
  return new Promise((resolve, reject) => {
    exec(`start "" "${url}"`, (err) => {
      if (err) {
        console.log(`❌ Erro ao abrir WhatsApp para ${family.familyName}: ${err.message}`);
        reject(err);
      } else {
        console.log(`📩 ${family.familyName} → 55${family.phone} (${family.slug})`);
        resolve();
      }
    });
  });
}

async function getPendingSlugs(families) {
  const snapshot = await getDocs(collection(db, 'rsvp'));
  const responded = new Set(snapshot.docs.map(d => d.id));
  return families.filter(f => !responded.has(f.id)).map(f => f.slug);
}

async function main() {
  const args = process.argv.slice(2);
  const gabriel = loadGabriel();

  let slugs = [];
  if (args.includes('--all-gabriel-pending')) {
    slugs = await getPendingSlugs(gabriel);
  } else {
    slugs = args.filter(a => !a.startsWith('--'));
  }

  slugs = slugs.filter(s => !EXCLUDE_SLUGS.includes(s));

  const toSend = [];
  for (const slug of slugs) {
    const family = gabriel.find(f => f.slug === slug);
    if (!family) {
      console.log(`⚠️  Slug "${slug}" não encontrado na lista do Gabriel.`);
      continue;
    }
    toSend.push(family);
  }

  if (toSend.length === 0) {
    console.log('Nenhuma família para enviar.');
    process.exit(0);
  }

  console.log(`\n📨 Abrindo ${toSend.length} lembrete(s) no WhatsApp Web...\n`);
  for (const family of toSend) {
    await openWhatsApp(family);
    if (toSend.indexOf(family) < toSend.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.log('\n✅ Conversas abertas. Clique "Enviar" em cada uma no navegador.\n');
  setTimeout(() => process.exit(0), 2000);
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
