// ========================================
// Script: Enviar convites via WhatsApp
// ========================================
// Uso:
//   node scripts/send-invites.mjs --reset                    # só reset do banco
//   node scripts/send-invites.mjs --validate                 # valida dados e banco
//   node scripts/send-invites.mjs --clean-all                # limpa o banco completamente
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

let rayFamilies = [];
let gabrielFamilies = [];
let allFamilies = [];

// Carregar famílias com validação
function loadFamiliesData() {
  try {
    rayFamilies = JSON.parse(
      readFileSync('./public/data/families-raynara.json', 'utf-8')
    ).families.map(f => ({ ...f, side: 'raynara' }));

    gabrielFamilies = JSON.parse(
      readFileSync('./public/data/families-gabriel.json', 'utf-8')
    ).families.map(f => ({ ...f, side: 'gabriel' }));

    allFamilies = [...rayFamilies, ...gabrielFamilies];
  } catch (err) {
    console.error('❌ Erro ao carregar dados das famílias:', err.message);
    process.exit(1);
  }
}

// ---- VALIDAÇÕES ----

/**
 * Valida o formato de um número de telefone brasileiro
 * Aceita: 11993455580, 11 99345-5580, (11) 99345-5580, +55 11 99345-5580, etc
 */
function isValidPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return false;
  // Remove tudo que não é número
  const digits = phone.replace(/\D/g, '');
  // Deve ter 10 ou 11 dígitos (sem +55) ou 12-13 (com +55)
  return digits.length >= 10 && digits.length <= 13;
}

/**
 * Valida a estrutura completa de uma família
 */
function validateFamily(family, index) {
  const errors = [];

  if (!family.id) errors.push('  - Falta campo "id"');
  if (!family.slug) errors.push('  - Falta campo "slug"');
  if (!family.familyName) errors.push('  - Falta campo "familyName"');
  if (!Array.isArray(family.members) || family.members.length === 0) {
    errors.push('  - Campo "members" deve ser um array não-vazio');
  }
  if (!family.phone) errors.push('  - Falta campo "phone"');
  if (!isValidPhoneNumber(family.phone)) errors.push(`  - Telefone inválido: "${family.phone}"`);
  if (family.side !== 'raynara' && family.side !== 'gabriel') {
    errors.push('  - Campo "side" deve ser "raynara" ou "gabriel"');
  }

  if (errors.length > 0) {
    console.log(`❌ Família ${index + 1} inválida:`);
    errors.forEach(e => console.log(e));
    return false;
  }
  return true;
}

/**
 * Valida todos os dados das famílias
 */
function validateFamiliesData() {
  console.log('\n📋 Validando dados das famílias...\n');

  if (!allFamilies || allFamilies.length === 0) {
    console.error('❌ Nenhuma família carregada!');
    return false;
  }

  let hasErrors = false;

  // Valida cada família
  allFamilies.forEach((family, index) => {
    if (!validateFamily(family, index)) {
      hasErrors = true;
    }
  });

  // Verifica slugs duplicados
  const slugs = allFamilies.map(f => f.slug);
  const duplicateSlugs = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
  if (duplicateSlugs.length > 0) {
    console.error('❌ Slugs duplicados encontrados:', duplicateSlugs);
    hasErrors = true;
  }

  // Verifica IDs duplicados
  const ids = allFamilies.map(f => f.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    console.error('❌ IDs duplicados encontrados:', duplicateIds);
    hasErrors = true;
  }

  if (!hasErrors) {
    console.log(`✅ Todos os dados estão válidos!`);
    console.log(`   📊 Total de famílias: ${allFamilies.length}`);
    console.log(`   👥 Raynara: ${rayFamilies.length}`);
    console.log(`   👥 Gabriel: ${gabrielFamilies.length}`);
    console.log(`   📱 Famílias com telefone: ${allFamilies.filter(f => f.phone).length}`);
  }

  return !hasErrors;
}

/**
 * Valida a conexão com Firebase
 */
async function validateFirebaseConnection() {
  console.log('\n🔗 Testando conexão com Firebase...');
  try {
    const snapshot = await getDocs(collection(db, 'rsvp'));
    console.log(`✅ Conexão com Firebase OK`);
    console.log(`   📊 RSVPs existentes: ${snapshot.size}`);
    
    if (snapshot.size > 0) {
      console.log('\n   Últimos RSVPs:');
      snapshot.docs.slice(0, 3).forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.familyName || 'Sem nome'} (${doc.id})`);
      });
      if (snapshot.size > 3) {
        console.log(`   ... e mais ${snapshot.size - 3}`);
      }
    }
    return true;
  } catch (err) {
    console.error('❌ Erro ao conectar com Firebase:', err.message);
    return false;
  }
}

/**
 * Executa todas as validações
 */
async function validateAll() {
  console.log('═'.repeat(60));
  console.log('🔍 VALIDAÇÃO COMPLETA');
  console.log('═'.repeat(60));

  const dataValid = validateFamiliesData();
  const firebaseValid = await validateFirebaseConnection();

  console.log('\n' + '═'.repeat(60));
  if (dataValid && firebaseValid) {
    console.log('✅ TUDO VALIDADO COM SUCESSO!');
  } else {
    console.log('❌ ERROS ENCONTRADOS - VERIFIQUE ACIMA');
  }
  console.log('═'.repeat(60) + '\n');

  return dataValid && firebaseValid;
}

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

/**
 * Limpa completamente o banco de dados após confirmação
 */
async function cleanAllDatabase() {
  console.log('\n⚠️  AÇÃO DESTRUTIVA: Você está prestes a DELETAR TODOS OS DADOS do Firebase!');
  console.log('   Esta ação NÃO pode ser desfeita.\n');

  const response = await new Promise(resolve => {
    process.stdout.write('   Digite "confirmar" para continuar ou qualquer outra coisa para cancelar: ');
    process.stdin.once('data', data => {
      resolve(data.toString().trim());
    });
  });

  if (response.toLowerCase() !== 'confirmar') {
    console.log('\n❌ Operação cancelada.');
    return false;
  }

  console.log('\n🗑️  Deletando todos os dados...');
  const snapshot = await getDocs(collection(db, 'rsvp'));
  
  if (snapshot.empty) {
    console.log('✅ Banco já estava vazio.');
    return true;
  }

  const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'rsvp', d.id)));
  await Promise.all(deletePromises);
  console.log(`✅ ${snapshot.size} documento(s) deletado(s) permanentemente.`);
  return true;
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
  const shouldValidate = args.includes('--validate');
  const shouldCleanAll = args.includes('--clean-all');
  const sendAll = args.includes('--all');
  const sendAllRay = args.includes('--all-ray');
  const sendAllGabriel = args.includes('--all-gabriel');
  const slugs = args.filter(a => !a.startsWith('--'));

  if (args.length === 0) {
    console.log('Uso:');
    console.log('  node scripts/send-invites.mjs --validate                # valida dados + banco');
    console.log('  node scripts/send-invites.mjs --reset                   # reset do banco');
    console.log('  node scripts/send-invites.mjs --clean-all               # limpa completamente');
    console.log('  node scripts/send-invites.mjs maynara leonardo          # envia convites');
    console.log('  node scripts/send-invites.mjs --reset maynara leonardo  # reset + envia');
    console.log('  node scripts/send-invites.mjs --all                     # envia para TODOS');
    console.log('  node scripts/send-invites.mjs --all-ray                 # todas da Raynara');
    console.log('  node scripts/send-invites.mjs --all-gabriel             # todas do Gabriel');
    console.log('\nFamílias disponíveis:');
    console.log('  Raynara:', rayFamilies.map(f => f.slug).join(', '));
    console.log('  Gabriel:', gabrielFamilies.map(f => f.slug).join(', '));
    process.exit(0);
  }

  // Carrega dados das famílias
  loadFamiliesData();

  // Validação
  if (shouldValidate) {
    const isValid = await validateAll();
    process.exit(isValid ? 0 : 1);
  }

  // Limpeza completa
  if (shouldCleanAll) {
    await cleanAllDatabase();
    setTimeout(() => process.exit(0), 1000);
    return;
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
