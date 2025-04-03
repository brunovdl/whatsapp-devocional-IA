// Módulo para gerenciar conversas individuais com os usuários

const fs = require('fs-extra');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const leitorDocumentos = require('./leitorDocumentos');
const historicoMensagens = require('./historicoMensagens');
const { logger, removerAcentos, limparString } = require('./utils');

// Configurações
const CONVERSAS_DIR = process.env.CONVERSAS_DIR || './Conversas';
const MAX_HISTORICO_CONVERSAS = parseInt(process.env.MAX_HISTORICO_CONVERSAS || '10', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Inicializar cliente Gemini
let genAI;
let geminiModel;

// Função para inicializar a API do Gemini
function inicializarGeminiAPI() {
  try {
    if (!GEMINI_API_KEY) {
      logger.error('Chave da API do Gemini não configurada no arquivo .env');
      return false;
    }
    
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Tentar usar o modelo mais avançado primeiro
    try {
      geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      logger.info('API do Google Gemini (gemini-1.5-pro) inicializada com sucesso');
    } catch (erro) {
      logger.warn(`Erro ao inicializar modelo gemini-1.5-pro: ${erro.message}`);
      // Fallback para outro modelo
      geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });
      logger.info('API do Google Gemini (gemini-pro) inicializada com sucesso');
    }
    
    return true;
  } catch (erro) {
    logger.error(`Erro ao inicializar API do Gemini: ${erro.message}`);
    return false;
  }
}

// Inicializar a API
inicializarGeminiAPI();

// Garantir que o diretório de conversas exista
function garantirDiretorioConversas() {
  if (!fs.existsSync(CONVERSAS_DIR)) {
    fs.mkdirSync(CONVERSAS_DIR, { recursive: true });
    logger.info(`Diretório de conversas criado: ${CONVERSAS_DIR}`);
  }
}

// Obter o caminho do arquivo de histórico para um telefone específico
function obterCaminhoHistoricoConversa(telefone) {
  garantirDiretorioConversas();
  const nomeArquivo = `${telefone}.json`;
  return path.join(CONVERSAS_DIR, nomeArquivo);
}

// Carregar histórico de conversa de um usuário
function carregarHistoricoConversa(telefone) {
  try {
    const caminhoArquivo = obterCaminhoHistoricoConversa(telefone);
    
    if (fs.existsSync(caminhoArquivo)) {
      const conteudo = fs.readFileSync(caminhoArquivo, 'utf8');
      return JSON.parse(conteudo);
    }
    
    // Retornar histórico vazio se não existir
    return {
      telefone: telefone,
      ultimaAtualizacao: new Date().toISOString(),
      ultimoDevocional: null,
      conversas: []
    };
  } catch (erro) {
    logger.error(`Erro ao carregar histórico de conversa para ${telefone}: ${erro.message}`);
    return {
      telefone: telefone,
      ultimaAtualizacao: new Date().toISOString(),
      ultimoDevocional: null,
      conversas: []
    };
  }
}

// Salvar histórico de conversa de um usuário
function salvarHistoricoConversa(historico) {
  try {
    garantirDiretorioConversas();
    
    // Atualizar a data da última atualização
    historico.ultimaAtualizacao = new Date().toISOString();
    
    // Limitar o número de mensagens no histórico
    if (historico.conversas.length > MAX_HISTORICO_CONVERSAS) {
      historico.conversas = historico.conversas.slice(-MAX_HISTORICO_CONVERSAS);
    }
    
    const caminhoArquivo = obterCaminhoHistoricoConversa(historico.telefone);
    fs.writeFileSync(caminhoArquivo, JSON.stringify(historico, null, 2));
    
    logger.info(`Histórico de conversa salvo para ${historico.telefone}`);
    return true;
  } catch (erro) {
    logger.error(`Erro ao salvar histórico de conversa para ${historico.telefone}: ${erro.message}`);
    return false;
  }
}

// Registrar um devocional enviado para um usuário
function registrarDevocionalEnviado(telefone, devocional) {
  try {
    const historico = carregarHistoricoConversa(telefone);
    
    // Registrar o devocional atual
    historico.ultimoDevocional = {
      data: new Date().toISOString(),
      conteudo: devocional
    };
    
    return salvarHistoricoConversa(historico);
  } catch (erro) {
    logger.error(`Erro ao registrar devocional para ${telefone}: ${erro.message}`);
    return false;
  }
}

// Registrar uma mensagem na conversa
function registrarMensagem(telefone, remetente, mensagem) {
  try {
    const historico = carregarHistoricoConversa(telefone);
    
    // Adicionar a mensagem ao histórico
    historico.conversas.push({
      timestamp: new Date().toISOString(),
      remetente: remetente, // 'usuario' ou 'bot'
      mensagem: mensagem
    });
    
    return salvarHistoricoConversa(historico);
  } catch (erro) {
    logger.error(`Erro ao registrar mensagem para ${telefone}: ${erro.message}`);
    return false;
  }
}

// Verificar se uma mensagem parece ser uma pergunta
function ePergunta(mensagem) {
  // Remover acentos e converter para minúsculas
  const textoNormalizado = removerAcentos(mensagem.toLowerCase());
  
  // Verificar se termina com ponto de interrogação
  if (textoNormalizado.includes('?')) {
    return true;
  }
  
  // Verificar palavras-chave de perguntas
  const palavrasChavePergunta = [
    'quem', 'como', 'por que', 'porque', 'quando', 'onde', 'qual', 'quais',
    'o que', 'oq', 'pq', 'me explica', 'pode explicar', 'explique', 'significa',
    'entendi', 'não entendi', 'nao entendi', 'duvida', 'dúvida'
  ];
  
  return palavrasChavePergunta.some(palavra => textoNormalizado.includes(palavra));
}

// Verificar se é a primeira interação de um usuário
async function isPrimeiraInteracao(telefone) {
  try {
    const caminhoArquivo = obterCaminhoHistoricoConversa(telefone);
    
    // Verificar se o arquivo de histórico existe
    const existeHistorico = fs.existsSync(caminhoArquivo);
    
    // Se o arquivo não existir, é a primeira interação
    if (!existeHistorico) {
      logger.info(`Arquivo de histórico não encontrado para ${telefone}, é a primeira interação`);
      return true;
    }
    
    // Se o arquivo existir, verificar se tem conteúdo válido
    try {
      const conteudo = fs.readFileSync(caminhoArquivo, 'utf8');
      const historico = JSON.parse(conteudo);
      
      // Verificar se o histórico tem conversas
      if (!historico.conversas || historico.conversas.length === 0) {
        logger.info(`Histórico vazio para ${telefone}, considerando como primeira interação`);
        return true;
      }
      
      // Se chegou aqui, não é a primeira interação
      logger.info(`Usuário ${telefone} já tem histórico com ${historico.conversas.length} mensagens`);
      return false;
    } catch (erroLeitura) {
      logger.error(`Erro ao ler histórico para ${telefone}: ${erroLeitura.message}`);
      // Em caso de erro de leitura, considerar como primeira interação para garantir
      return true;
    }
  } catch (erro) {
    logger.error(`Erro ao verificar primeira interação para ${telefone}: ${erro.message}`);
    return false;
  }
}

// Preparar o prompt para a resposta da IA
async function prepararPromptResposta(telefone, mensagemUsuario) {
  const historico = carregarHistoricoConversa(telefone);
  const ultimoDevocional = historico.ultimoDevocional ? historico.ultimoDevocional.conteudo : '';
  
  // Obter últimas conversas para contexto (limitado às 5 últimas)
  const conversasRecentes = historico.conversas.slice(-5);
  const conversasFormatadas = conversasRecentes.map(c => 
    `${c.remetente === 'usuario' ? 'Pessoa' : 'Bot'}: ${c.mensagem}`
  ).join('\n');
  
  // Obter conteúdo da base de conhecimento
  const baseConhecimento = await leitorDocumentos.obterConteudoBase();
  
  const prompt = `
  Você é um assistente espiritual que está respondendo perguntas sobre um devocional diário que você enviou para uma pessoa via WhatsApp.
  
  Seu último devocional enviado foi:
  ${ultimoDevocional}
  
  O contexto da conversa recente é:
  ${conversasFormatadas}
  
  A pessoa acabou de enviar esta mensagem para você:
  "${mensagemUsuario}"
  
  Baseie-se no devocional enviado e na seguinte base de conhecimento religiosa para responder:
  ${baseConhecimento.substring(0, 10000)}
  
  Responda à pergunta ou comentário da pessoa de forma amigável, acolhedora e espiritual. 
  Mantenha a resposta concisa (até 5 frases), mas esclarecedora e relevante para a mensagem da pessoa.
  Se for uma pergunta sobre o devocional, dê uma resposta específica baseada no versículo e na reflexão.
  Se não for uma pergunta relacionada ao devocional, responda de forma generalista e gentil, evitando debates teológicos complexos.
  
  Não mencione que você é uma IA ou um bot. Responda como um aconselhador espiritual amigável.
  `;
  
  return prompt.trim();
}

// Gerar resposta para uma mensagem do usuário
async function gerarRespostaParaMensagem(telefone, mensagemUsuario) {
  try {
    // Verificar se a API Gemini está inicializada
    if (!geminiModel) {
      const inicializou = inicializarGeminiAPI();
      if (!inicializou) {
        return "Não foi possível responder no momento. Por favor, tente novamente mais tarde.";
      }
    }
    
    // Registrar a mensagem do usuário
    registrarMensagem(telefone, 'usuario', mensagemUsuario);
    
    // Verificar se a mensagem é uma pergunta ou comentário que precisa de resposta
    if (!ePergunta(mensagemUsuario) && mensagemUsuario.length < 10) {
      const respostasSimples = [
        "Amém! Tenha um dia abençoado.",
        "Que Deus te abençoe hoje e sempre.",
        "Obrigado por compartilhar. Fique na paz de Cristo.",
        "Louvado seja Deus! Tenha um excelente dia.",
        "Que a graça de Deus esteja com você hoje."
      ];
      
      const resposta = respostasSimples[Math.floor(Math.random() * respostasSimples.length)];
      registrarMensagem(telefone, 'bot', resposta);
      return resposta;
    }
    
    // Preparar o prompt
    const prompt = await prepararPromptResposta(telefone, mensagemUsuario);
    
    // Gerar resposta com a IA
    const result = await geminiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });
    
    const resposta = result.response.text().trim();
    
    // Registrar a resposta do bot
    registrarMensagem(telefone, 'bot', resposta);
    
    return resposta;
  } catch (erro) {
    logger.error(`Erro ao gerar resposta para ${telefone}: ${erro.message}`);
    
    // Resposta de fallback em caso de erro
    const respostaFallback = "Agradeço sua mensagem. Estou refletindo sobre isso e logo poderei responder com mais clareza. Que Deus abençoe seu dia.";
    registrarMensagem(telefone, 'bot', respostaFallback);
    
    return respostaFallback;
  }
}

module.exports = {
  registrarDevocionalEnviado,
  gerarRespostaParaMensagem,
  ePergunta,
  isPrimeiraInteracao
};