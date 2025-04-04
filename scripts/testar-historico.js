// testar-historico.js - Script para testar o registro de mensagens no histórico
// Execute com: node testar-historico.js

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
moment.locale('pt-br');

// Configure o ambiente para teste
process.env.HISTORICO_DIR = './Histórico';
process.env.HISTORICO_FILE = './Histórico/historico.json';

// Importar módulos relevantes
const historicoManager = require('./src/historicoManager');
const historicoMensagens = require('./src/historicoMensagens');
const { formatarData, logger } = require('./src/utils');

// Data atual para teste
const dataAtual = formatarData(new Date());

// Exemplo de devocional para teste
const devocionalTeste = `📅 ${dataAtual}

📖 *Versículo:* "Façamos o homem à nossa imagem, conforme a nossa semelhança; e domine sobre os peixes do mar, e sobre as aves dos céus, e sobre o gado, e sobre toda a terra, e sobre todo réptil que se move sobre a terra." (Gênesis 1:26)

💭 *Reflexão:* Este versículo revela o propósito especial do ser humano na criação. Somos feitos à imagem e semelhança de Deus, o que significa que temos capacidade de raciocínio, criatividade, moralidade e relacionamento. Também fomos designados como mordomos da criação divina, com a responsabilidade de cuidar e administrar os recursos da Terra com sabedoria. 

🧗 *Prática:* Hoje, considere uma forma concreta de exercer sua mordomia sobre a criação, seja através de um ato de cuidado com a natureza ou usando seus talentos de maneira responsável.`;

// Dados de envio para teste
const dadosEnvioTeste = {
  data: dataAtual,
  devocional: devocionalTeste,
  totalContatos: 10,
  enviosComSucesso: 8
};

// Função para exibir o conteúdo atual do arquivo de histórico
function exibirHistoricoAtual() {
  try {
    const caminhoHistorico = process.env.HISTORICO_FILE;
    if (fs.existsSync(caminhoHistorico)) {
      const conteudo = fs.readFileSync(caminhoHistorico, 'utf8');
      console.log('\nConteúdo atual do histórico:');
      console.log(conteudo);
    } else {
      console.log('\nArquivo de histórico não encontrado.');
    }
  } catch (erro) {
    console.error(`Erro ao ler histórico: ${erro.message}`);
  }
}

// Função principal de teste
async function testarRegistroHistorico() {
  console.log('=== TESTE DE REGISTRO NO HISTÓRICO ===\n');
  
  // Mostrar histórico atual
  console.log('Estado inicial do histórico:');
  exibirHistoricoAtual();
  
  // Extrair versículo do devocional de teste
  const versiculo = historicoMensagens.extrairVersiculo(devocionalTeste);
  console.log('\nVersículo extraído do devocional de teste:');
  console.log(versiculo ? `"${versiculo.texto}" (${versiculo.referencia})` : 'Não foi possível extrair versículo');
  
  // Tentar registrar o envio no histórico
  console.log('\nRegistrando envio no histórico...');
  const resultado = historicoMensagens.registrarEnvio(dadosEnvioTeste);
  console.log(`Resultado: ${resultado ? 'Sucesso' : 'Falha'}`);
  
  // Mostrar histórico após o registro
  console.log('\nEstado final do histórico:');
  exibirHistoricoAtual();
  
  // Verificar se o versículo está na lista de recentes
  console.log('\nVerificando versículos recentes:');
  const versiculosRecentes = historicoMensagens.obterVersiculosRecentes(30);
  console.log(`Encontrados ${versiculosRecentes.length} versículos recentes`);
  versiculosRecentes.forEach((v, i) => {
    console.log(`${i+1}. ${v.referencia}: "${v.texto}"`);
  });
  
  // Testar se um versículo foi usado recentemente
  if (versiculo) {
    const foiUsado = historicoMensagens.versiculoFoiUsadoRecentemente(versiculo.referencia);
    console.log(`\nVersículo ${versiculo.referencia} foi usado recentemente? ${foiUsado ? 'SIM' : 'NÃO'}`);
  }
  
  console.log('\n=== TESTE CONCLUÍDO ===');
}

// Executar o teste
testarRegistroHistorico().catch(erro => {
  console.error(`Erro no teste: ${erro.message}`);
  console.error(erro.stack);
});