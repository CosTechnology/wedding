// ========================================
// Script: Enviar convites via WhatsApp
// ========================================
// Uso:
//   node scripts/send-invites.mjs --reset                    # só reset do banco
//   node scripts/send-invites.mjs maynara leonardo           # envia convites
//   node scripts/send-invites.mjs --reset maynara leonardo   # reset + envia
//   node scripts/send-invites.mjs --all                      # envia para TODOS
//   node scripts/send-invites.mjs --all-ray                  # envia para todas da Raynara
//   node scripts/send-invites.mjs --all-gabriel              # envia para todas do Gabriel

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { exec } from 'child_process';

// ---- Firebase Config ----
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

// ---- Dados ----
const BASE_URL = 'https://costechnology.github.io/wedding/#/convite/';

const rayFamilies = JSON.parse(
  readFileSync('./public/data/families-raynara.json', 'utf-8')
).families.map(f => ({ ...f, side: 'raynara' }));

const gabrielFamilies = JSON.parse(
  readFileSync('./public/data/families-gabriel.json', 'utf-8')
).families.map(f => ({ ...f, side: 'gabriel' }));

const allFamilies = [...rayFamilies, ...gabrielFamilies];

// ---- Reset do banco ----
async function resetDatabase() {
  console.log('\n🗑️  Resetando banco de dados (coleção rsvp)...');
  const snapshot = await getDocs(collection(db, 'rsvp'));
  if (snapshot.empty) {
    console.log('✅ Banco já estava vazio.');
    return;
  }
  const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'rsvp', d.id)));
  await Promise.all(deletePromises);
  console.log(`✅ ${snapshot.size} documento(s) removido(s).`);
}

// ---- Enviar convite via WhatsApp ----
function buildMessage(familyName, slug, members) {
  const link = `${BASE_URL}${slug}`;
  const nomes = members.join(', ');
  return [
    `Olá, ${familyName}! 🥂`,
    ``,
    `Vocês estão convidados para o almoço de celebração do casamento de *Ray & Gabriel*!`,
    ``,
    `📅 *12 de julho de 2026, às 13h*`,
    `📍 Espaço VIP — Av. Américo Torneiro, 468 — Jardim Mauá`,
    ``,
    `Confirme a presença de: *${nomes}*`,
    `👉 ${link}`,
    ``,
    `Por favor, confirme até 31/05/2026. Obrigado! 💜`,
  ].join('\n');
}

function openWhatsApp(phone, familyName, slug, members) {
  const message = buildMessage(familyName, slug, members);
  const url = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;

  return new Promise((resolve, reject) => {
    // Windows: abre no navegador padrão
    exec(`start "" "${url}"`, (err) => {
      if (err) {
        console.log(`❌ Erro ao abrir WhatsApp para ${familyName}: ${err.message}`);
        reject(err);
      } else {
        console.log(`📩 ${familyName} → 55${phone} (${slug})`);
        resolve();
      }
    });
  });
}

async function sendInvites(families) {
  console.log(`\n📨 Enviando ${families.length} convite(s)...\n`);

  for (const family of families) {
    if (!family.phone) {
      console.log(`⚠️  ${family.familyName} (${family.slug}) — sem telefone, pulando.`);
      continue;
    }
    await openWhatsApp(family.phone, family.familyName, family.slug, family.members);
    // Espera 3s entre cada para não abrir tudo de uma vez
    if (families.indexOf(family) < families.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log('\n✅ Todos os convites foram abertos no WhatsApp Web.');
  console.log('   Clique "Enviar" em cada conversa aberta no navegador.\n');
}

// ---- CLI ----
async function main() {
  const args = process.argv.slice(2);

  const shouldReset = args.includes('--reset');
  const sendAll = args.includes('--all');
  const sendAllRay = args.includes('--all-ray');
  const sendAllGabriel = args.includes('--all-gabriel');
  const slugs = args.filter(a => !a.startsWith('--'));

  if (args.length === 0) {
    console.log('Uso:');
    console.log('  node scripts/send-invites.mjs --reset                    # reset do banco');
    console.log('  node scripts/send-invites.mjs maynara leonardo           # envia convites');
    console.log('  node scripts/send-invites.mjs --reset maynara leonardo   # reset + envia');
    console.log('  node scripts/send-invites.mjs --all                      # envia para TODOS');
    console.log('  node scripts/send-invites.mjs --all-ray                  # todas da Raynara');
    console.log('  node scripts/send-invites.mjs --all-gabriel              # todas do Gabriel');
    console.log('\nFamílias disponíveis:');
    console.log('  Raynara:', rayFamilies.map(f => f.slug).join(', '));
    console.log('  Gabriel:', gabrielFamilies.map(f => f.slug).join(', '));
    process.exit(0);
  }

  // Reset
  if (shouldReset) {
    await resetDatabase();
  }

  // Determinar famílias para enviar
  let familiesToSend = [];

  if (sendAll) {
    familiesToSend = allFamilies;
  } else if (sendAllRay) {
    familiesToSend = rayFamilies;
  } else if (sendAllGabriel) {
    familiesToSend = gabrielFamilies;
  } else if (slugs.length > 0) {
    for (const slug of slugs) {
      const family = allFamilies.find(f => f.slug === slug);
      if (family) {
        familiesToSend.push(family);
      } else {
        console.log(`⚠️  Slug "${slug}" não encontrado.`);
      }
    }
  }

  if (familiesToSend.length > 0) {
    await sendInvites(familiesToSend);
  }

  setTimeout(() => process.exit(0), 2000);
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
