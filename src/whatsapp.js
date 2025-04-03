// Módulo de conexão com WhatsApp usando Baileys (mais leve que Puppeteer)

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./utils');
const historicoMensagens = require('./historicoMensagens');
const { obterContatos, adicionarNovoContatoNaPlanilha } = require('./leitorContatos');

// Cliente WhatsApp
let wa = null;
let clienteInicializado = false;

// Importar o gerenciador de conversas
const conversasHandler = require('./conversasHandler');

// Pasta para armazenar os dados de autenticação
const AUTH_FOLDER = process.env.WHATSAPP_SESSION_PATH || './whatsapp-session';

// Configuração de presença
const TEMPO_ONLINE = 60000; // 1 minuto em milissegundos
let timerPresenca = null;

// Função para definir o status como offline
async function definirOffline() {
  try {
    if (wa && clienteInicializado) {
      // Definir o status como 'unavailable' (que mostra o "visto por último")
      await wa.sendPresenceUpdate('unavailable', null);
      logger.info('Status definido como offline (visto por último)');
    }
  } catch (erro) {
    logger.error(`Erro ao definir status offline: ${erro.message}`);
  }
}

// Função para gerenciar o status online
async function gerenciarPresenca() {
  // Limpar o timer existente, se houver
  if (timerPresenca) {
    clearTimeout(timerPresenca);
  }
  
  // Definir um novo timer para ficar offline após o tempo configurado
  timerPresenca = setTimeout(definirOffline, TEMPO_ONLINE);
}

// Inicializar o cliente WhatsApp
async function iniciarCliente() {
  try {
    logger.info('Inicializando cliente WhatsApp usando Baileys...');
    
    // Garantir que a pasta de autenticação existe
    if (!fs.existsSync(AUTH_FOLDER)) {
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
      logger.info(`Diretório de autenticação criado: ${AUTH_FOLDER}`);
    }
    
    // Carregar estado de autenticação (se existir)
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    const nullLogger = {
      child: () => nullLogger,
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      trace: () => {}
    };

    // Criar o socket WhatsApp
    wa = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      defaultQueryTimeoutMs: 60000, // Timeout mais longo para Raspberry Pi
      logger: nullLogger
    });
    
    // Manipular eventos de conexão e mensagens
    wa.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        // Exibir QR code no terminal
        logger.info('QR Code gerado. Escaneie-o com seu WhatsApp:');
        qrcode.generate(qr, { small: true });
      }
      
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        logger.warn(`Conexão fechada devido a ${lastDisconnect.error}. ${shouldReconnect ? 'Reconectando...' : 'Não será reconectado.'}`);
        
        clienteInicializado = false;
        
        if (shouldReconnect) {
          // Tentar reconectar após um breve intervalo
          setTimeout(iniciarCliente, 5000);
        }
      } else if (connection === 'open') {
        logger.info('Cliente WhatsApp conectado com sucesso!');
        clienteInicializado = true;
        
        // Definir como online inicialmente
        await wa.sendPresenceUpdate('available', null);
        // Iniciar o timer para ficar offline
        gerenciarPresenca();
      }
    });
    
    // Salvar credenciais quando atualizadas
    wa.ev.on('creds.update', saveCreds);
    
    // Manipular mensagens recebidas
    wa.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          // Processar apenas mensagens de outros (não enviadas por nós)
          if (!msg.key.fromMe) {
            await processarMensagemRecebida(msg);
          }
        }
      }
    });
    
    logger.info('Sistema de eventos do WhatsApp inicializado');
    return wa;
  } catch (erro) {
    logger.error(`Erro ao inicializar cliente WhatsApp: ${erro.message}`);
    logger.error(erro.stack);
    throw erro;
  }
}

// Processar mensagens recebidas
async function processarMensagemRecebida(msg) {
  try {
    
    // Verificar se é uma mensagem de grupo
    if (msg.key.remoteJid.includes('@g.us')) {
      return; // Ignorar mensagens de grupos
    }
    
    // Obter informações do remetente
    const remetente = msg.key.remoteJid;
    const telefone = remetente.split('@')[0];
    
    // Verificar se não é uma mensagem muito antiga
    const timestampMensagem = msg.messageTimestamp * 1000;
    const agora = Date.now();
    const diffMinutos = (agora - timestampMensagem) / (1000 * 60);
    
    if (diffMinutos > 10) {
      logger.info(`Ignorando mensagem antiga (${Math.floor(diffMinutos)} minutos atrás)`);
      return;
    }

    // Ao receber uma mensagem, definir como online
    await wa.sendPresenceUpdate('available', remetente);
    gerenciarPresenca(); // Iniciar o timer para ficar offline

    // Carregar histórico de conversa
    const caminhoArquivo = path.join(process.env.CONVERSAS_DIR || './Conversas', `${telefone}.json`);
    let devocionalJaEnviado = false;
    
    if (fs.existsSync(caminhoArquivo)) {
      try {
        const conteudo = fs.readFileSync(caminhoArquivo, 'utf8');
        const historico = JSON.parse(conteudo);
        
        // Verificar se já enviamos um devocional
        devocionalJaEnviado = historico && historico.ultimoDevocional;
        
        logger.info(`Usuário ${telefone}: ${devocionalJaEnviado ? 'já recebeu devocional' : 'ainda não recebeu devocional'}`);
      } catch (erroLeitura) {
        logger.error(`Erro ao ler histórico para ${telefone}: ${erroLeitura.message}`);
      }
    } else {
      logger.info(`Nenhum histórico encontrado para ${telefone}, enviando devocional de boas-vindas`);
    }

    if (!devocionalJaEnviado) {
      logger.info(`Primeira interação detectada para o número ${telefone}`);
    
      // Adicionar o novo contato à Planilha
      try {
        // Tenta extrair o nome do contato
        let nomeContato = "Novo Contato";
        
        // Tente pelo pushName que pode estar disponível na própria mensagem
        if (msg.pushName) {
          nomeContato = msg.pushName;
        }
        // Ou pelo objeto key da mensagem
        else if (msg.key && msg.key.pushName) {
          nomeContato = msg.key.pushName;
        }
        
        // Adicionar à Planilha
        await adicionarNovoContatoNaPlanilha(telefone, nomeContato);
        logger.info(`Contato ${telefone} (${nomeContato}) adicionado à planilha de contatos`);
      } catch (erroContato) {
        logger.error(`Erro ao adicionar contato à planilha: ${erroContato.message}`);
      }
      
      // Buscar o último devocional enviado hoje
      const devocionalHoje = await historicoMensagens.obterUltimoDevocionalEnviado();
      if (devocionalHoje) {
        
        // Enviar mensagem de boas-vindas
        await wa.sendMessage(remetente, { 
          text: "Olá 😀! Seja bem-vindo(a) ao Whatsapp Devocional-IA. Aqui está o devocional de hoje:" 
        });
        
        // Pequena pausa
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Enviar o devocional
        await wa.sendMessage(remetente, { text: devocionalHoje });
        
        // Registrar o devocional enviado para este contato
        await conversasHandler.registrarDevocionalEnviado(telefone, devocionalHoje);
        logger.info(`Devocional do dia enviado para novo contato: ${telefone}`);
        return;
      } else {
        logger.warn(`Não foi possível encontrar um devocional para enviar ao novo contato ${telefone}`);
      }
    }
    
    // Verificar o tipo de mensagem
    const messageType = Object.keys(msg.message || {})[0];
    
    // Processar áudio
    if (['audioMessage', 'pttMessage'].includes(messageType)) {
      logger.info(`Áudio recebido de ${telefone}, respondendo com mensagem padrão`);
      
      // Mensagens gentis e educadas para responder a áudios
      const mensagensAudio = [
        "Olá! Recebi seu áudio, mas ainda não consigo processá-lo. Você poderia, por gentileza, enviar sua pergunta ou comentário como mensagem de texto? Assim poderei lhe ajudar melhor. 🙏",
        "Agradeço pelo seu áudio! No momento, não disponho da capacidade de ouvi-lo. Poderia, por favor, compartilhar seu pensamento ou pergunta em forma de texto? Ficarei feliz em responder!",
        "Recebi sua mensagem de voz! Infelizmente, ainda não consigo compreender áudios. Se puder enviar o mesmo conteúdo em texto, será um prazer conversar sobre o devocional de hoje ou qualquer outro assunto espiritual."
      ];
      
      // Escolher uma mensagem aleatoriamente
      const respostaAudio = mensagensAudio[Math.floor(Math.random() * mensagensAudio.length)];
      
      // Indicar que está digitando (simulando digitação)
      await wa.sendPresenceUpdate('composing', remetente);
      
      // Pequena pausa para simular digitação (entre 1-3 segundos)
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      // Enviar a resposta
      await wa.sendMessage(remetente, { text: respostaAudio });
      logger.info(`Resposta para áudio enviada para ${telefone}`);
      
      // Reiniciar o timer de presença
      gerenciarPresenca();
      return;
    }
    
    // Extrair o conteúdo da mensagem de texto
    let conteudo = '';
    
    if (messageType === 'conversation') {
      conteudo = msg.message.conversation;
    } else if (messageType === 'extendedTextMessage') {
      conteudo = msg.message.extendedTextMessage.text;
    } else {
      // Outros tipos de mensagem (imagem, vídeo, etc.)
      conteudo = "Mídia recebida";
    }
    
    logger.info(`Mensagem recebida de ${telefone}: ${conteudo.substring(0, 50)}${conteudo.length > 50 ? '...' : ''}`);
    
    // Verificar se a mensagem precisa de resposta
    if (conversasHandler.ePergunta(conteudo) || conteudo.length >= 10) {
      logger.info(`Gerando resposta para mensagem de ${telefone}...`);
      
      // Indicar que está digitando (simulando digitação)
      await wa.sendPresenceUpdate('composing', remetente);
      
      // Gerar a resposta
      const resposta = await conversasHandler.gerarRespostaParaMensagem(telefone, conteudo);
      
      // Calcular tempo de digitação baseado no tamanho da resposta
      // Média de digitação: cerca de 5 caracteres por segundo (ajuste conforme necessário)
      const tempoDigitacao = Math.min(Math.max(resposta.length / 5 * 1000, 2000), 8000);
      
      // Simular tempo de digitação
      await new Promise(resolve => setTimeout(resolve, tempoDigitacao));
      
      // Parar de "digitar"
      await wa.sendPresenceUpdate('paused', remetente);
      
      // Pequena pausa antes de enviar (como se estivesse revisando)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Enviar a resposta
      await wa.sendMessage(remetente, { text: resposta });
      
      logger.info(`Resposta enviada para ${telefone}`);
    } else {
      logger.info(`Mensagem curta, enviando resposta simples`);
      
      // Indicar que está digitando
      await wa.sendPresenceUpdate('composing', remetente);
      
      // Para mensagens curtas ou agradecimentos, enviar uma resposta simples
      const resposta = await conversasHandler.gerarRespostaParaMensagem(telefone, conteudo);
      
      // Simular digitação rápida (1-3 segundos)
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      // Enviar resposta
      await wa.sendMessage(remetente, { text: resposta });
    }
    
    // Reiniciar o timer de presença após enviar mensagem
    gerenciarPresenca();
  } catch (erro) {
    logger.error(`Erro ao processar mensagem recebida: ${erro.message}`);
    try {
      // Tentar enviar uma mensagem de erro para o usuário
      await wa.sendMessage(msg.key.remoteJid, { 
        text: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde." 
      });
    } catch (erroEnvio) {
      logger.error(`Erro ao enviar mensagem de erro: ${erroEnvio.message}`);
    }
  }
}

// Verificar se o cliente está pronto
function clientePronto() {
  return wa !== null && clienteInicializado;
}

// Enviar mensagem para um contato
async function enviarMensagem(telefone, mensagem) {
  try {
    if (!clientePronto()) {
      throw new Error('Cliente WhatsApp não está pronto');
    }
    
    // Formatar o número de telefone (remover caracteres não numéricos)
    const numeroFormatado = telefone.toString().replace(/\D/g, '');
    
    // Garantir que o número tenha o formato correto para o WhatsApp
    const chatId = `${numeroFormatado}@s.whatsapp.net`;
    
    // Definir como online ao enviar mensagem
    await wa.sendPresenceUpdate('available', chatId);
    
    // Enviar a mensagem
    await wa.sendMessage(chatId, { text: mensagem });
    
    // Iniciar o timer para ficar offline
    gerenciarPresenca();
    
    return true;
  } catch (erro) {
    logger.error(`Erro ao enviar mensagem: ${erro.message}`);
    throw erro;
  }
}

// Encerrar o cliente
async function encerrarCliente() {
  try {
    if (wa) {
      // Definir como offline antes de desconectar
      try {
        await definirOffline();
      } catch (erroPresenca) {
        logger.warn(`Erro ao definir offline antes de encerrar: ${erroPresenca.message}`);
      }
      
      // Limpar o timer de presença
      if (timerPresenca) {
        clearTimeout(timerPresenca);
        timerPresenca = null;
      }
      
      // Não há um método específico para "destruir" no Baileys,
      // mas podemos remover os listeners e limpar referências
      wa.ev.removeAllListeners();
      wa = null;
      clienteInicializado = false;
      logger.info('Cliente WhatsApp encerrado');
    }
  } catch (erro) {
    logger.error(`Erro ao encerrar cliente WhatsApp: ${erro.message}`);
  }
}

module.exports = {
  iniciarCliente,
  clientePronto,
  enviarMensagem,
  encerrarCliente,
};