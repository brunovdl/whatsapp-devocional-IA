// WhatsApp Devocional Diário com IA
// Ponto de entrada da aplicação

require('dotenv').config();
const fs = require('fs-extra');
const schedule = require('node-schedule');
const moment = require('moment');
moment.locale('pt-br');

// Importação dos módulos
const whatsapp = require('./whatsapp');
const geradorDevocional = require('./geradorDevocional');
const leitorContatos = require('./leitorContatos');
const historicoMensagens = require('./historicoMensagens');
const conversasHandler = require('./conversasHandler');
const leitorDocumentos = require('./leitorDocumentos');
const { criarDiretorios, formatarData, logger } = require('./utils');

// Garantir que os diretórios necessários existam
criarDiretorios();

// Função principal que executa o envio dos devocionais
async function enviarDevocionaisDiarios() {
  try {
    logger.info('Iniciando o processo de envio de devocionais diários');
    
    // Obter a data atual formatada
    const dataAtual = formatarData(new Date());
    logger.info(`Data atual: ${dataAtual}`);
    
    // Gerar o devocional do dia
    logger.info('Gerando devocional...');
    const devocional = await geradorDevocional.gerarDevocional(dataAtual);
    logger.info('Devocional gerado com sucesso');
    
    // Verificar se o cliente WhatsApp está pronto
    if (!whatsapp.clientePronto()) {
      logger.error('Cliente WhatsApp não está pronto. Tentando novamente em 5 minutos.');
      setTimeout(enviarDevocionaisDiarios, 5 * 60 * 1000);
      return;
    }
    
    // Obter a lista de contatos
    logger.info('Obtendo lista de contatos...');
    const contatos = await leitorContatos.obterContatos();
    logger.info(`${contatos.length} contatos encontrados`);
    
    // Enviar o devocional para cada contato
    let enviosComSucesso = 0;
    
    for (const contato of contatos) {
      try {
        logger.info(`Enviando devocional para ${contato.nome} (${contato.telefone})...`);
        await whatsapp.enviarMensagem(contato.telefone, devocional);
        
        // Registrar o devocional enviado para referência em conversas futuras
        await conversasHandler.registrarDevocionalEnviado(contato.telefone, devocional);
        
        enviosComSucesso++;
        logger.info(`Devocional enviado com sucesso para ${contato.nome}`);
      } catch (erro) {
        logger.error(`Erro ao enviar devocional para ${contato.nome}: ${erro.message}`);
      }
    }
    
    // Registrar no histórico
    historicoMensagens.registrarEnvio({
      data: dataAtual,
      devocional: devocional,
      totalContatos: contatos.length,
      enviosComSucesso: enviosComSucesso
    });
    
    logger.info(`Processo concluído. Enviado para ${enviosComSucesso}/${contatos.length} contatos.`);
  } catch (erro) {
    logger.error(`Erro ao executar o processo de envio: ${erro.message}`);
    logger.error(erro.stack);
  }
}

// Pré-processar a base de conhecimento
async function preprocessarBaseConhecimento() {
  try {
    logger.info('Iniciando pré-processamento da base de conhecimento...');
    const conteudoBase = await leitorDocumentos.obterConteudoBase();
    logger.info(`Base de conhecimento processada: ${conteudoBase.length} caracteres`);
    return true;
  } catch (erro) {
    logger.error(`Erro ao processar base de conhecimento: ${erro.message}`);
    return false;
  }
}

// Inicialização do sistema
async function iniciarSistema() {
  try {
    logger.info('Iniciando o sistema WhatsApp Devocional IA...');
    
    // Primeiro, processar a base de conhecimento
    logger.info('Processando base de conhecimento...');
    const baseProcessada = await preprocessarBaseConhecimento();
    
    if (!baseProcessada) {
      logger.warn('Houve um problema no processamento da base de conhecimento, mas o sistema continuará.');
    }
    
    // Depois, iniciar o cliente WhatsApp
    logger.info('Inicializando conexão com WhatsApp...');
    await whatsapp.iniciarCliente();
    
    // Agendar o envio diário de devocionais no horário configurado
    const horarioEnvio = process.env.SCHEDULE_TIME || '07:00';
    const [hora, minuto] = horarioEnvio.split(':').map(Number);
    
    schedule.scheduleJob(`${minuto} ${hora} * * *`, async () => {
      logger.info('Executando tarefa agendada de envio de devocionais');
      await enviarDevocionaisDiarios();
    });
    
    logger.info(`Sistema iniciado. Devocionais serão enviados diariamente às ${horarioEnvio}`);
    
    // Para desenvolvimento/testes: Descomentar para enviar um devocional imediatamente
     setTimeout(enviarDevocionaisDiarios, 10000);
  } catch (erro) {
    logger.error(`Erro ao iniciar o sistema: ${erro.message}`);
    logger.error(erro.stack);
  }
}

// Iniciar o sistema
iniciarSistema();

// Tratamento de encerramento gracioso
process.on('SIGINT', async () => {
  logger.info('Encerrando o sistema...');
  await whatsapp.encerrarCliente();
  process.exit(0);
});