// verificar-historico.js
// Script para diagnóstico e reparo do arquivo de histórico
// Executar com: node verificar-historico.js

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
moment.locale('pt-br');

// Configure o ambiente para teste
process.env.HISTORICO_DIR = '../Histórico';
process.env.HISTORICO_FILE = '../Histórico/historico.json';

// Importar funções utilitárias
const { formatarData, logger } = require('../src/utils');

// Verificar e reparar histórico
async function verificarHistorico() {
  console.log('=== DIAGNÓSTICO E REPARO DO HISTÓRICO ===\n');

  const historicoDIR = process.env.HISTORICO_DIR;
  const historicoFILE = process.env.HISTORICO_FILE;

  // 1. Verificar se o diretório existe
  console.log(`Verificando diretório ${historicoDIR}...`);
  if (!fs.existsSync(historicoDIR)) {
    console.log(`Diretório não encontrado. Criando ${historicoDIR}...`);
    fs.mkdirSync(historicoDIR, { recursive: true });
  } else {
    console.log('Diretório encontrado.');
  }

  // 2. Verificar permissões do diretório
  try {
    console.log(`Verificando permissões de ${historicoDIR}...`);
    await fs.access(historicoDIR, fs.constants.R_OK | fs.constants.W_OK);
    console.log('Permissões OK (leitura e escrita).');
  } catch (err) {
    console.error(`ERRO DE PERMISSÃO: O diretório ${historicoDIR} não tem permissões de leitura/escrita.`);
    console.log('Tentando corrigir permissões...');
    try {
      fs.chmodSync(historicoDIR, 0o755);
      console.log('Permissões atualizadas.');
    } catch (errChmod) {
      console.error(`Não foi possível corrigir permissões: ${errChmod.message}`);
    }
  }

  // 3. Verificar se o arquivo de histórico existe
  console.log(`\nVerificando arquivo ${historicoFILE}...`);
  let historico;
  
  if (!fs.existsSync(historicoFILE)) {
    console.log('Arquivo não encontrado. Criando novo arquivo de histórico...');
    historico = {
      ultimaAtualizacao: new Date().toISOString(),
      mensagens: []
    };
    fs.writeFileSync(historicoFILE, JSON.stringify(historico, null, 2));
    console.log('Arquivo de histórico criado.');
  } else {
    console.log('Arquivo de histórico encontrado.');
    
    // 4. Verificar se o conteúdo é JSON válido
    try {
      const conteudo = fs.readFileSync(historicoFILE, 'utf8');
      historico = JSON.parse(conteudo);
      console.log('Conteúdo é JSON válido.');
      
      // 5. Verificar estrutura do histórico
      if (!historico.ultimaAtualizacao || !Array.isArray(historico.mensagens)) {
        console.log('Estrutura inválida. Corrigindo...');
        if (!historico.ultimaAtualizacao) {
          historico.ultimaAtualizacao = new Date().toISOString();
        }
        if (!Array.isArray(historico.mensagens)) {
          historico.mensagens = [];
        }
        fs.writeFileSync(historicoFILE, JSON.stringify(historico, null, 2));
        console.log('Estrutura corrigida.');
      } else {
        console.log('Estrutura correta.');
      }
      
      // 6. Verificar conteúdo do histórico
      console.log(`\nConteúdo do histórico:`);
      console.log(`- Última atualização: ${historico.ultimaAtualizacao}`);
      console.log(`- Total de mensagens: ${historico.mensagens.length}`);
      
      if (historico.mensagens.length > 0) {
        const ultimaMensagem = historico.mensagens[historico.mensagens.length - 1];
        console.log(`\nÚltima mensagem:`);
        console.log(`- Data: ${ultimaMensagem.data || 'N/A'}`);
        console.log(`- Timestamp: ${ultimaMensagem.timestamp || 'N/A'}`);
        if (ultimaMensagem.versiculo) {
          console.log(`- Versículo: "${ultimaMensagem.versiculo.texto}" (${ultimaMensagem.versiculo.referencia})`);
        } else {
          console.log(`- Versículo: Não registrado`);
        }
      }
    } catch (err) {
      console.error(`ERRO: O arquivo ${historicoFILE} não contém JSON válido.`);
      console.log('Criando backup e novo arquivo...');
      
      // Criar backup do arquivo corrompido
      const backup = `${historicoFILE}.backup.${Date.now()}`;
      fs.copyFileSync(historicoFILE, backup);
      console.log(`Backup criado: ${backup}`);
      
      // Criar novo arquivo
      historico = {
        ultimaAtualizacao: new Date().toISOString(),
        mensagens: []
      };
      fs.writeFileSync(historicoFILE, JSON.stringify(historico, null, 2));
      console.log('Novo arquivo de histórico criado.');
    }
  }

  // 7. Verificar permissões do arquivo
  try {
    console.log(`\nVerificando permissões do arquivo ${historicoFILE}...`);
    await fs.access(historicoFILE, fs.constants.R_OK | fs.constants.W_OK);
    console.log('Permissões de arquivo OK (leitura e escrita).');
  } catch (err) {
    console.error(`ERRO DE PERMISSÃO: O arquivo ${historicoFILE} não tem permissões de leitura/escrita.`);
    console.log('Tentando corrigir permissões...');
    try {
      fs.chmodSync(historicoFILE, 0o644);
      console.log('Permissões de arquivo atualizadas.');
    } catch (errChmod) {
      console.error(`Não foi possível corrigir permissões: ${errChmod.message}`);
    }
  }

  // 8. Testar escrita no arquivo
  console.log('\nTestando capacidade de escrita no arquivo...');
  try {
    historico.testeEscrita = true;
    fs.writeFileSync(historicoFILE, JSON.stringify(historico, null, 2));
    delete historico.testeEscrita;
    fs.writeFileSync(historicoFILE, JSON.stringify(historico, null, 2));
    console.log('Teste de escrita bem-sucedido.');
  } catch (err) {
    console.error(`ERRO DE ESCRITA: Não foi possível escrever no arquivo: ${err.message}`);
  }

  console.log('\n=== DIAGNÓSTICO CONCLUÍDO ===');
}

// Executar verificação
verificarHistorico().catch(erro => {
  console.error(`Erro na verificação: ${erro.message}`);
  console.error(erro.stack);
});